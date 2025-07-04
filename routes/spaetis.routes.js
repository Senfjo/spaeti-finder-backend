// routes/spaetis.routes.js
const router = require("express").Router();
const Spaeti = require("../models/Spaeti.model");
const User = require("../models/User.model");
const uploader = require("../middleware/cloudinary.config");

// XP reward amounts
const XP_REWARDS = {
  CREATE_SPAETI_WITH_IMAGE: 50,
  CREATE_SPAETI_WITHOUT_IMAGE: 40,
};

// Helper function to award XP to a user
const awardXPToUser = async (userId, xpAmount, reason) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found for XP award: ${userId}`);
      return null;
    }

    // Initialize XP if it doesn't exist
    if (user.xp === undefined || user.xp === null) {
      user.xp = 0;
    }

    user.xp += xpAmount;
    await user.save();

    console.log(`XP awarded: ${xpAmount} to user ${user.username} for: ${reason}`);
    return { user, xpAwarded: xpAmount };
  } catch (error) {
    console.error("Error awarding XP:", error);
    return null;
  }
};

// ─── CREATE ────────────────────────────────────────────────────────────────────
router.post(
  "/",
  // 1) Multer parses the incoming multipart/form-data
  uploader.single("image"),
  // 2) Your existing create‐Spaeti handler
  async (req, res) => {
    try {
      const {
        name,
        street,
        zip,
        city,
        lat,
        lng,
        rating,
        seats,
        wc,
        creator,
        approved,
        sterni: incomingSterni,
        image: incomingImageUrl,
      } = req.body;

      const imageUrl = req.file
        ? req.file.path
        : incomingImageUrl || undefined;

      const price = parseFloat(incomingSterni) || 0;

      console.log("Image URL:====>", imageUrl)
      const newSpaeti = await Spaeti.create({
        name,
        street,
        zip,
        city,
        lat,
        lng,
        rating,
        seats,
        wc,
        creator,
        approved,
        image: imageUrl,
        sterniHistory: [price],
        sternAvg: price,
      });

      res.status(201).json({ message: "Created spaeti", data: newSpaeti });
    } catch (error) {
      console.error("❌ Error creating spaeti:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ─── GET ALL ────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const allSpaetis = await Spaeti.find()
      .lean()
      .populate("rating");
    res.status(200).json({ message: "All spaetis", data: allSpaetis });
  } catch (error) {
    console.error("Error fetching spaetis:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET ONE ────────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const spaeti = await Spaeti.findById(req.params.id).populate("rating");
    res.status(200).json({ message: "Found spaeti", data: spaeti });
  } catch (error) {
    console.error("Error fetching one spaeti:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET RATINGS ────────────────────────────────────────────────────────────────
router.get("/ratings/:id", async (req, res) => {
  try {
    const spaeti = await Spaeti.findById(req.params.id)
      .populate({
        path: "rating",
        populate: { path: "user" },
      })
      .lean();

    spaeti.rating.forEach((r) => {
      delete r.user.email;
      delete r.user.password;
    });

    res.status(200).json({ message: "Found ratings", rating: spaeti.rating });
  } catch (error) {
    console.error("Error fetching ratings:", error);
    res.status(500).json({ errorMessage: "Failed fetching ratings" });
  }
});

// ─── UPDATE (WITH XP REWARDS FOR APPROVAL) ──────────────────────────────────────
router.patch(
  "/update/:id",
  uploader.single("image"),
  async (req, res) => {
    try {
      const spa = await Spaeti.findById(req.params.id).populate('creator');
      if (!spa) {
        return res.status(404).json({ error: "Späti not found" });
      }

      // Check if this is an approval (approved field is being set to true)
      const isApproval = req.body.approved === true && !spa.approved;

      // 1) if new image file was uploaded, update it
      if (req.file) {
        spa.image = req.file.path;
      } else if (req.body.image) {
        // or if someone passed a new URL
        spa.image = req.body.image;
      }

      // 2) handle price update, if provided
      if (req.body.sterni !== undefined) {
        const price = parseFloat(req.body.sterni) || 0;
        spa.sterniHistory = spa.sterniHistory || [];
        spa.sterniHistory.push(price);
        const sum = spa.sterniHistory.reduce((a, b) => a + b, 0);
        spa.sternAvg = +(sum / spa.sterniHistory.length).toFixed(2);
      }

      // 3) apply all other fields (except image & sterni which we handled)
      const {
        sterni,  // exclude
        image,   // exclude
        ...otherFields
      } = req.body;
      Object.assign(spa, otherFields);

      // 4) save the updated Späti
      const updated = await spa.save();

      let xpResult = null;

      // 5) Award XP if this is an approval and creator exists
      if (isApproval && spa.creator) {
        const xpAmount = spa.image ? 
          XP_REWARDS.CREATE_SPAETI_WITH_IMAGE : 
          XP_REWARDS.CREATE_SPAETI_WITHOUT_IMAGE;
        
        const reason = spa.image ? 
          "Späti with image approved" : 
          "Späti without image approved";

        xpResult = await awardXPToUser(spa.creator._id, xpAmount, reason);
      }

      // 6) respond with appropriate message
      const message = isApproval && xpResult ? 
        "Updated spaeti and XP awarded" : 
        "Updated spaeti";

      res.status(200).json({ 
        message: message, 
        data: updated,
        xpAwarded: xpResult ? xpResult.xpAwarded : 0,
        creator: xpResult ? { 
          _id: xpResult.user._id, 
          username: xpResult.user.username, 
          newXP: xpResult.user.xp 
        } : null
      });
    } catch (error) {
      console.error("Error updating spaeti:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ─── DELETE ────────────────────────────────────────────────────────────────────
router.delete("/delete/:id", async (req, res) => {
  try {
    const deleted = await Spaeti.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Deleted spaeti", data: deleted });
  } catch (error) {
    console.error("Error deleting spaeti:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
