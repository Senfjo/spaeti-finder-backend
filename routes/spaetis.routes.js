// routes/spaetis.routes.js
const router = require("express").Router();
const Spaeti = require("../models/Spaeti.model");
const User = require("../models/User.model");
const uploader = require("../middleware/cloudinary.config");
const { isAuthenticated, isAdmin } = require("../middleware/jwt.middleware");
const { awardXP, XP } = require("../services/xp.service");

// Fields a non-creator caller is allowed to change via PATCH /update/:id.
// Deliberately excludes: creator, approved (admin-gated, see below), images,
// rating, sterniHistory/sterniReporters/sternAvg (handled by the sterni block).
const ALLOWED_UPDATE_FIELDS = [
  "name", "street", "zip", "city", "lat", "lng", "seats", "wc", "atm", "card",
];

// ─── CREATE ────────────────────────────────────────────────────────────────────
router.post(
  "/",
  // 1) Must be logged in before we touch Cloudinary or the DB
  isAuthenticated,
  // 2) Multer parses the incoming multipart/form-data (no-op for JSON bodies)
  uploader.single("image"),
  // 3) Your existing create‐Spaeti handler
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
        sterni: incomingSterni,
        image: incomingImageUrl,
      } = req.body;

      // creator/approved are never trusted from the client:
      // creator is always the authenticated caller, approved always starts false.
      const creator = req.payload._id;
      const approved = false;

      const imageUrl = req.file
        ? req.file.path
        : incomingImageUrl || undefined;

      const price = incomingSterni ? parseFloat(incomingSterni) : null;

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
        sterniHistory: price ? [price] : [],
        sterniReporters: (price && creator) ? [{ user: creator, price }] : [],
        sternAvg: price || 0,
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
  // Auth must run before multer ever touches Cloudinary.
  isAuthenticated,
  uploader.single("image"),
  async (req, res) => {
    try {
      const spa = await Spaeti.findById(req.params.id).populate('creator');
      if (!spa) {
        return res.status(404).json({ error: "Späti not found" });
      }

      // 0) "approved" is field-gated: only an admin may change it. Any other
      // authenticated user (e.g. reporting a sterni price) has it silently
      // stripped rather than being 403'd for the whole request.
      let approvedRequested = req.body.approved;
      if (approvedRequested !== undefined) {
        const caller = await User.findById(req.payload._id).select("admin").lean();
        const callerIsAdmin = !!(caller && caller.admin === true);
        if (!callerIsAdmin) {
          approvedRequested = undefined;
        }
      }

      // Coerce "true"/"false" strings (multipart form fields arrive as strings).
      if (approvedRequested !== undefined && typeof approvedRequested === "string") {
        approvedRequested = approvedRequested === "true";
      }

      // Check if this is an approval (approved field is being set true->false transition)
      const isApproval = approvedRequested === true && !spa.approved;

      // 1) if new image file was uploaded, update it
      if (req.file) {
        spa.image = req.file.path;
      } else if (req.body.image) {
        // or if someone passed a new URL
        spa.image = req.body.image;
      }

      // 2) handle price update with per-user deduplication
      if (req.body.sterni !== undefined) {
        const price = parseFloat(req.body.sterni);
        const userId = req.payload._id.toString();
        if (!spa.sterniReporters) spa.sterniReporters = [];
        const existingIdx = spa.sterniReporters.findIndex(
          r => r.user.toString() === userId
        );
        if (existingIdx >= 0) {
          spa.sterniReporters[existingIdx].price = price;
        } else {
          spa.sterniReporters.push({ user: userId, price });
        }
        spa.markModified('sterniReporters');
        const prices = spa.sterniReporters.map(r => r.price);
        spa.sterniHistory = prices;
        spa.sternAvg = +(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
      }

      // 3) apply only whitelisted fields (creator/approved/images/rating/sterni*
      // are never mass-assignable; approved is handled separately below)
      for (const key of ALLOWED_UPDATE_FIELDS) {
        if (req.body[key] !== undefined) {
          spa[key] = req.body[key];
        }
      }

      // 3b) apply the admin-gated approved change, if any
      if (approvedRequested !== undefined) {
        spa.approved = approvedRequested;
      }

      // 4) save the updated Späti
      const updated = await spa.save();

      let xpResult = null;

      // 5) Award XP if this is an approval and creator exists (always credited
      // to the spaeti's creator, never the caller who triggered the approval)
      if (isApproval && spa.creator) {
        const xpAmount = spa.image
          ? XP.SPAETI_WITH_PHOTO_APPROVED
          : XP.SPAETI_APPROVED;

        xpResult = await awardXP(spa.creator._id, xpAmount);
      }

      // 6) respond with appropriate message
      const message = isApproval && xpResult ?
        "Updated spaeti and XP awarded" :
        "Updated spaeti";

      res.status(200).json({
        message: message,
        data: updated,
        xpAwarded: xpResult ? xpResult.awarded : 0,
        creator: xpResult ? {
          _id: spa.creator._id,
          username: spa.creator.username,
          newXP: xpResult.totalXP
        } : null
      });
    } catch (error) {
      console.error("Error updating spaeti:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ─── DELETE ────────────────────────────────────────────────────────────────────
router.delete("/delete/:id", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const deleted = await Spaeti.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Deleted spaeti", data: deleted });
  } catch (error) {
    console.error("Error deleting spaeti:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── ADD IMAGE (user uploads, needs approval) ──────────────────────────────────
router.post(
  "/:id/images",
  isAuthenticated,
  uploader.single("image"),
  async (req, res) => {
    try {
      const spa = await Spaeti.findById(req.params.id);
      if (!spa) return res.status(404).json({ error: "Späti not found" });
      if (!req.file) return res.status(400).json({ error: "No image provided" });
      const approvedCount = spa.images.filter(i => i.approved).length;
      if (approvedCount >= 5) return res.status(400).json({ error: "Max 5 Bilder erreicht" });
      spa.images.push({ url: req.file.path, approved: false, uploadedBy: req.payload._id });
      await spa.save();
      res.status(201).json({ message: "Image uploaded", data: spa });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ─── APPROVE IMAGE (admin only) ────────────────────────────────────────────────
router.patch(
  "/:id/images/:imageId/approve",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const spa = await Spaeti.findById(req.params.id);
      if (!spa) return res.status(404).json({ error: "Späti not found" });
      const img = spa.images.id(req.params.imageId);
      if (!img) return res.status(404).json({ error: "Image not found" });
      img.approved = true;
      await spa.save();
      res.status(200).json({ message: "Image approved", data: spa });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// ─── DELETE IMAGE (admin only) ─────────────────────────────────────────────────
router.delete(
  "/:id/images/:imageId",
  isAuthenticated,
  isAdmin,
  async (req, res) => {
    try {
      const spa = await Spaeti.findById(req.params.id);
      if (!spa) return res.status(404).json({ error: "Späti not found" });
      spa.images.pull({ _id: req.params.imageId });
      await spa.save();
      res.status(200).json({ message: "Image deleted", data: spa });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

module.exports = router;
