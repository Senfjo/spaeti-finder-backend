// routes/spaetis.routes.js
const router = require("express").Router();
const Spaeti = require("../models/Spaeti.model");
const uploader = require("../middleware/cloudinary.config");

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

// ─── UPDATE ────────────────────────────────────────────────────────────────────
router.patch(
  "/update/:id",
  uploader.single("image"),
  async (req, res) => {
    try {
      const spa = await Spaeti.findById(req.params.id);
      if (!spa) {
        return res.status(404).json({ error: "Späti not found" });
      }

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

      // 4) save & respond
      const updated = await spa.save();
      res.status(200).json({ message: "Updated spaeti", data: updated });
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
