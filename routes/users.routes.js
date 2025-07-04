// routes/user.routes.js
const router = require("express").Router();
const User = require("../models/User.model");
const keysToDelete = ["password", "email"];
const { isAuthenticated } = require("../middleware/jwt.middleware");

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

module.exports = router;
