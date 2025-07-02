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
    const findUser = await User.findById(id).lean();
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


module.exports = router;
