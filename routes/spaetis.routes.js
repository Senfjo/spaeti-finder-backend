const router = require("express").Router();
const Spaeti = require("../models/Spaeti.model");
const uploader = require("../middleware/cloudinary.config");
const Rating = require("../models/Rating.model");
const { raw } = require("express");

router.post("", uploader.single("image"), async (req, res) => {
  try {
    const createSpaeti = await Spaeti.create(req.body);
    res.status(201).json({ message: "created spaeti", data: createSpaeti });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.get("", async (req, res) => {
  try {
    const allSpaetis = await Spaeti.find();
    res.status(200).json({ message: "all speatis:", data: allSpaetis });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const findSpaeti = await Spaeti.findById(id)
      .populate("creator")
      .populate("rating")
      .lean();
    if (findSpaeti && findSpaeti.creator) {
      const keysToDelete = ["password", "email"];
      keysToDelete.forEach((key) => {
        delete findSpaeti.creator[key];
      });
    }

    res.status(200).json({ message: "found spaeti", data: findSpaeti });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.get("/ratings/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const findSpaeti = await Spaeti.findById(id)
      .populate({
        path: "rating",
        populate: {
          path: "user",
        },
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

router.patch("/update/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const updateSpaeti = await Spaeti.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    res.status(201).json({ message: "updated spaeti", data: updateSpaeti });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deleteSpaeti = await Spaeti.findByIdAndDelete(id);
    res.status(200).json({ message: "deleted spaeti", deleteSpaeti });
  } catch (error) {
    res.status(500).json(error);
  }
});

module.exports = router;
