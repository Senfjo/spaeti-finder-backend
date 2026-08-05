// routes/user.routes.js
const router = require("express").Router();
const User = require("../models/User.model");
const keysToDelete = ["password", "email"];
const { isAuthenticated } = require("../middleware/jwt.middleware");
const uploader = require("../middleware/cloudinary.config");
const { levelFor } = require("../services/xp.service");

// Shared helper: caller may act on `targetId` if it's their own account, or
// if the caller (looked up fresh from the DB, not trusted from the JWT) is
// an admin. Returns true/false; never throws (treat lookup errors as "no").
async function isSelfOrAdmin(req, targetId) {
  if (req.payload._id === targetId) return true;
  try {
    const caller = await User.findById(req.payload._id).select("admin").lean();
    return !!(caller && caller.admin === true);
  } catch (error) {
    return false;
  }
}

// ─── GET ALL ─────────────────────────────────────────────────────────────────────
router.get("", isAuthenticated, async (req, res) => {
  try {
    const allUsers = await User.find().lean();
    if (allUsers) {
      allUsers.forEach((user) => {
        keysToDelete.forEach((key) => {
          delete user[key];
        });
      });
    }
    res.status(200).json({ message: "found all users", data: allUsers });
  } catch (error) {
    res.status(500).json(error);
  }
});

// ─── SEARCH BY USERNAME ───────────────────────────────────────────────────────────
router.get("/search", isAuthenticated, async (req, res) => {
  const { username } = req.query;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ message: "Query must be at least 2 characters" });
  }
  try {
    const users = await User.find({
      username: { $regex: username.trim(), $options: "i" },
    })
      .select("_id username image xp")
      .lean();
    res.status(200).json({ data: users });
  } catch (error) {
    res.status(500).json(error);
  }
});

// ─── GET ONE ─────────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const findUser = await User.findById(id)
      .populate({
        path: "ratings",
        populate: {
          path: "spaeti",
          select: "name _id"
        }
      })
      .lean();
    if (findUser) {
      keysToDelete.forEach((key) => {
        delete findUser[key];
      });
    }
    res.status(200).json({ message: "found user", data: findUser });
  } catch (error) {
    res.status(500).json(error);
  }
});

// ─── UPDATE ──────────────────────────────────────────────────────────────────────
router.put("/update/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await isSelfOrAdmin(req, id))) return res.sendStatus(403);

    // Whitelist: never let the client set admin/xp/password/friends/etc.
    // via this route, no matter what the body contains.
    const allowedUpdate = {};
    if (req.body.image !== undefined) allowedUpdate.image = req.body.image;
    if (req.body.username !== undefined) allowedUpdate.username = req.body.username;
    if (req.body.email !== undefined) allowedUpdate.email = req.body.email;

    const updateUser = await User.findByIdAndUpdate(id, allowedUpdate, {
      new: true,
    }).lean();
    if (updateUser) {
      keysToDelete.forEach((key) => {
        delete updateUser[key];
      });
    }
    res.status(201).json({ message: "updated user", data: updateUser });
  } catch (error) {
    res.status(500).json(error);
  }
});

// ─── DELETE ──────────────────────────────────────────────────────────────────────
router.delete("/delete/:id", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  try {
    if (!(await isSelfOrAdmin(req, id))) return res.sendStatus(403);

    const deleteUser = await User.findByIdAndDelete(id).lean();
    if (deleteUser) {
      keysToDelete.forEach((key) => {
        delete deleteUser[key];
      });
    }
    res.status(200).json({ message: "deleted user", data: deleteUser });
  } catch (error) {
    res.status(500).json(error);
  }
});

// ── NEUE ROUTE: Liste aller Favoriten (Spaeti-Dokumente) ────────────────────────
router.get(
  "/:id/favorites",
  isAuthenticated,
  async (req, res) => {
    const { id } = req.params;
    // nur eigener User darf seine Favoriten sehen
    if (req.payload._id !== id) return res.sendStatus(403);
    try {
      // populate liefert volle Spaeti-Dokumente
      const user = await User.findById(id).populate("favorites").lean();
      res.status(200).json({ data: user.favorites });
    } catch (error) {
      res.status(500).json(error);
    }
  }
);

// ── NEUE ROUTE: Favorit an-/abbestellen via $addToSet / $pull ─────────────────────
router.patch(
  "/:id/favorite/:spaetiId",
  isAuthenticated,
  async (req, res) => {
    const { id, spaetiId } = req.params;
    // nur eigener User darf ändern
    if (req.payload._id !== id) return res.sendStatus(403);

    try {
      // req.body.add: true = hinzufügen, false = entfernen
      const op = req.body.add
        ? { $addToSet: { favorites: spaetiId } }
        : { $pull:     { favorites: spaetiId } };

      const updatedUser = await User.findByIdAndUpdate(
        id,
        op,
        { new: true }
      ).lean();

      // sensible Felder entfernen
      if (updatedUser) {
        keysToDelete.forEach((key) => {
          delete updatedUser[key];
        });
      }

      // nur das aktualisierte Array zurückgeben
      res.status(200).json({ data: updatedUser.favorites });
    } catch (error) {
      res.status(500).json(error);
    }
  }
);

// ── XP MANAGEMENT ROUTES ─────────────────────────────────────────────────────────
// NOTE: the old PATCH /:userId/xp "add arbitrary XP" endpoint was removed —
// it let any authenticated user grant themselves XP directly. XP is now only
// ever awarded server-side via services/xp.service.js (awardXP), from the
// routes that actually earn it (ratings, spaeti approval, ticket approval).

// Route to get user's XP and level information (read-only — no write-on-read)
router.get("/:userId/xp", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("xp username").lean();
    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const xp = user.xp || 0;

    res.status(200).json({
      message: "XP information retrieved successfully",
      data: {
        userId: user._id,
        username: user.username,
        xp,
        level: levelFor(xp)
      }
    });

  } catch (error) {
    console.error("Error fetching user XP:", error);
    res.status(500).json({
      message: "Server error fetching XP",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ─── UPLOAD PROFILE IMAGE ─────────────────────────────────────────────────────
router.post(
  "/:id/image",
  isAuthenticated,
  uploader.single("image"),
  async (req, res) => {
    try {
      if (req.payload._id !== req.params.id) return res.sendStatus(403);
      if (!req.file) return res.status(400).json({ error: "No image provided" });
      const user = await User.findByIdAndUpdate(
        req.params.id,
        { image: req.file.path },
        { new: true }
      ).lean();
      keysToDelete.forEach(k => delete user[k]);
      res.status(200).json({ message: "Image updated", data: user });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ─── FRIENDSHIP ROUTES ───────────────────────────────────────────────────────────

// GET pending requests (received + sent) for a user
router.get("/:id/friend-requests", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  if (req.payload._id !== id) return res.sendStatus(403);
  try {
    const user = await User.findById(id)
      .populate("friendRequestsReceived", "_id username image xp")
      .populate("friendRequestsSent", "_id username image xp")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({
      data: {
        // Legacy-Dokumente haben diese Felder evtl. nicht – immer Arrays liefern.
        received: user.friendRequestsReceived || [],
        sent: user.friendRequestsSent || [],
      },
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

// GET friends list
router.get("/:id/friends", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  if (req.payload._id !== id) return res.sendStatus(403);
  try {
    const user = await User.findById(id)
      .populate("friends", "_id username image xp")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ data: user.friends });
  } catch (error) {
    res.status(500).json(error);
  }
});

// POST send friend request
router.post("/:id/friend-request/:targetId", isAuthenticated, async (req, res) => {
  const { id, targetId } = req.params;
  if (req.payload._id !== id) return res.sendStatus(403);
  if (id === targetId) return res.status(400).json({ message: "Cannot add yourself" });
  try {
    const [sender, target] = await Promise.all([
      User.findById(id),
      User.findById(targetId),
    ]);
    if (!sender || !target) return res.status(404).json({ message: "User not found" });

    const alreadyFriends = sender.friends.some((f) => f.toString() === targetId);
    const alreadySent = sender.friendRequestsSent.some((r) => r.toString() === targetId);
    if (alreadyFriends) return res.status(400).json({ message: "Already friends" });
    if (alreadySent) return res.status(400).json({ message: "Request already sent" });

    await Promise.all([
      User.findByIdAndUpdate(id, { $addToSet: { friendRequestsSent: targetId } }),
      User.findByIdAndUpdate(targetId, { $addToSet: { friendRequestsReceived: id } }),
    ]);
    res.status(200).json({ message: "Friend request sent" });
  } catch (error) {
    res.status(500).json(error);
  }
});

// DELETE cancel a sent friend request
router.delete("/:id/friend-request/:targetId", isAuthenticated, async (req, res) => {
  const { id, targetId } = req.params;
  if (req.payload._id !== id) return res.sendStatus(403);
  try {
    await Promise.all([
      User.findByIdAndUpdate(id, { $pull: { friendRequestsSent: targetId } }),
      User.findByIdAndUpdate(targetId, { $pull: { friendRequestsReceived: id } }),
    ]);
    res.status(200).json({ message: "Friend request cancelled" });
  } catch (error) {
    res.status(500).json(error);
  }
});

// PATCH accept a friend request
router.patch("/:id/friend-request/:requesterId/accept", isAuthenticated, async (req, res) => {
  const { id, requesterId } = req.params;
  if (req.payload._id !== id) return res.sendStatus(403);
  try {
    await Promise.all([
      User.findByIdAndUpdate(id, {
        $pull: { friendRequestsReceived: requesterId },
        $addToSet: { friends: requesterId },
      }),
      User.findByIdAndUpdate(requesterId, {
        $pull: { friendRequestsSent: id },
        $addToSet: { friends: id },
      }),
    ]);
    res.status(200).json({ message: "Friend request accepted" });
  } catch (error) {
    res.status(500).json(error);
  }
});

// PATCH reject a friend request
router.patch("/:id/friend-request/:requesterId/reject", isAuthenticated, async (req, res) => {
  const { id, requesterId } = req.params;
  if (req.payload._id !== id) return res.sendStatus(403);
  try {
    await Promise.all([
      User.findByIdAndUpdate(id, { $pull: { friendRequestsReceived: requesterId } }),
      User.findByIdAndUpdate(requesterId, { $pull: { friendRequestsSent: id } }),
    ]);
    res.status(200).json({ message: "Friend request rejected" });
  } catch (error) {
    res.status(500).json(error);
  }
});

// DELETE remove a friend
router.delete("/:id/friends/:friendId", isAuthenticated, async (req, res) => {
  const { id, friendId } = req.params;
  if (req.payload._id !== id) return res.sendStatus(403);
  try {
    await Promise.all([
      User.findByIdAndUpdate(id, { $pull: { friends: friendId } }),
      User.findByIdAndUpdate(friendId, { $pull: { friends: id } }),
    ]);
    res.status(200).json({ message: "Friend removed" });
  } catch (error) {
    res.status(500).json(error);
  }
});

module.exports = router;
