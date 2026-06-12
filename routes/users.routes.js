// routes/user.routes.js
const router = require("express").Router();
const User = require("../models/User.model");
const keysToDelete = ["password", "email"];
const { isAuthenticated } = require("../middleware/jwt.middleware");
const uploader = require("../middleware/cloudinary.config");

// ─── CREATE ────────────────────────────────────────────────────────────────────
router.post("", async (req, res) => {
  try {
    const createUser = await User.create(req.body);
    if (createUser) {
      keysToDelete.forEach((key) => {
        delete createUser[key];
      });
    }
    res.status(201).json({ message: "created user", data: createUser });
  } catch (error) {
    res.status(500).json(error);
  }
});

// ─── GET ALL ─────────────────────────────────────────────────────────────────────
router.get("", async (req, res) => {
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
router.put("/update/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const updateUser = await User.findByIdAndUpdate(id, req.body, {
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
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
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

// Route to update user XP
router.patch("/:userId/xp", isAuthenticated, async (req, res) => {
  try {
    const { userId } = req.params;
    const { xpToAdd, reason } = req.body;

    // Verify the requesting user is the same user or an admin
    if (req.payload._id !== userId && !req.payload.admin) {
      return res.status(403).json({ 
        message: "Not authorized to update this user's XP" 
      });
    }

    // Validate XP amount
    if (typeof xpToAdd !== 'number' || isNaN(xpToAdd)) {
      return res.status(400).json({ 
        message: "Invalid XP amount provided" 
      });
    }

    // Find the user and update XP
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        message: "User not found" 
      });
    }

    // Initialize XP if it doesn't exist
    if (user.xp === undefined || user.xp === null) {
      user.xp = 0;
    }

    // Store previous XP for response
    const previousXP = user.xp;

    // Add XP (ensure it doesn't go below 0)
    user.xp = Math.max(0, user.xp + xpToAdd);

    await user.save();

    console.log(`XP awarded: ${xpToAdd} to user ${user.username} (${userId}) for: ${reason}`);

    res.status(200).json({
      message: "XP updated successfully",
      data: {
        user: {
          _id: user._id,
          username: user.username,
          previousXP: previousXP,
          newXP: user.xp
        },
        xpAdded: xpToAdd,
        reason: reason || "XP award"
      }
    });

  } catch (error) {
    console.error("Error updating user XP:", error);
    res.status(500).json({ 
      message: "Server error updating XP",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Route to get user's XP and level information
router.get("/:userId/xp", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('xp username');
    if (!user) {
      return res.status(404).json({ 
        message: "User not found" 
      });
    }

    // Initialize XP if it doesn't exist
    if (user.xp === undefined || user.xp === null) {
      user.xp = 0;
      await user.save();
    }

    res.status(200).json({
      message: "XP information retrieved successfully",
      data: {
        userId: user._id,
        username: user.username,
        xp: user.xp
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
