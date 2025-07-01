// routes/spaetis.routes.js

const router = require("express").Router();
const Spaeti = require("../models/Spaeti.model");
const uploader = require("../middleware/cloudinary.config");

// ─── CREATE ────────────────────────────────────────────────────────────────────
router.post("", uploader.single("image"), async (req, res) => {
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
      image,
      sterni: incomingSterni  // still called "sterni" in the request
    } = req.body;

    const price = parseFloat(incomingSterni) || 0;

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
      image,
      // initialize the new fields
      sterniHistory: [price],
      sternAvg: price
    });

    res.status(201).json({ message: "created spaeti", data: newSpaeti });
  } catch (error) {
    res.status(500).json(error);
  }
});

// ─── GET ALL ────────────────────────────────────────────────────────────────────
router.get("", async (req, res) => {
  try {
    const allSpaetis = await Spaeti.find()
      .lean()
      .populate({ path: "rating" });
    res.status(200).json({ message: "all spaetis", data: allSpaetis });
  } catch (error) {
    res.status(500).json(error);
  }
});

// ─── GET ONE ────────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const findSpaeti = await Spaeti.findById(id).populate("rating");
    res.status(200).json({ message: "found spaeti", data: findSpaeti });
  } catch (error) {
    res.status(500).json(error);
  }
});

// ─── GET RATINGS ────────────────────────────────────────────────────────────────
router.get("/ratings/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const findSpaeti = await Spaeti.findById(id)
      .populate({
        path: "rating",
        populate: { path: "user" },
      })
      .lean();

    findSpaeti.rating.forEach((rating) => {
      delete rating.user.email;
      delete rating.user.password;
    });

    res.status(200).json({ message: "found spaeti", rating: findSpaeti.rating });
  } catch (error) {
    res.status(500).json({ errorMessage: "Failed fetching one spaeti" });
  }
});

// ─── UPDATE ────────────────────────────────────────────────────────────────────
router.patch("/update/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // separate out any incoming sterni value
    const { sterni: incomingSterni, ...otherFields } = req.body;

    if (incomingSterni !== undefined) {
      // 1) load the document
      const spa = await Spaeti.findById(id);
      if (!spa) return res.status(404).json({ error: "Späti not found" });

      // 2) update the history & average
      const price = parseFloat(incomingSterni) || 0;
      spa.sterniHistory = spa.sterniHistory || [];
      spa.sterniHistory.push(price);
      const sum = spa.sterniHistory.reduce((a, b) => a + b, 0);
      spa.sternAvg = +(sum / spa.sterniHistory.length).toFixed(2);
      console.log("Updated sterni =>", spa.sternAvg)

      // 3) apply all other updates
      Object.assign(spa, otherFields);

      const updated = await spa.save();
      return res.status(200).json({ message: "updated spaeti", data: updated });
    }

    // no price change: update other fields directly
    const updatedSpaeti = await Spaeti.findByIdAndUpdate(id, otherFields, {
      new: true,
    });
    res.status(200).json({ message: "updated spaeti", data: updatedSpaeti });
  } catch (error) {
    res.status(500).json(error);
  }
});

// ─── DELETE ────────────────────────────────────────────────────────────────────
router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deleteSpaeti = await Spaeti.findByIdAndDelete(id);
    res.status(200).json({ message: "deleted spaeti", data: deleteSpaeti });
  } catch (error) {
    res.status(500).json(error);
  }
});

module.exports = router;
