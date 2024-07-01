const router = require("express").Router();
const Rating = require("../models/Rating.model");
const Spaeti = require("../models/Spaeti.model");
const User = require("../models/User.model");

router.post("", async (req, res) => {
  try {
    const createRating = await Rating.create(req.body);
    res.status(201).json({ message: "created rating", data: createRating });
    console.log("this is createRating:", createRating._id);

    const updateSpaeti = await Spaeti.findByIdAndUpdate(
      createRating.spaeti,
      { $push: { rating: createRating._id } },
      { new: true }
    );

    const updateUser = await User.findByIdAndUpdate(
      createRating.user,
      { $push: { ratings: createRating._id } },
      { new: true }
    );
  } catch (error) {
    res.status(500).json({ errorMessage: error });
  }
});

router.get("", async (req, res) => {
  try {
    const allRatings = await Rating.find().populate("user").lean();
    console.log(allRatings);

    if (allRatings) {
      const keysToDelete = ["password", "email"];
      allRatings.forEach((rating) => {
        keysToDelete.forEach((key) => {
          delete rating.user[key];
        });
      });
    }

    res.status(200).json({ message: "found all ratings", data: allRatings });
  } catch (error) {
    res.status(500).json({ errorMessage: "Error fetching the ratings" });
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const findRating = await Rating.findById(id);
    res.status(200).json({ message: "found rating", data: findRating });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.put("/update/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const updateRating = await Rating.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    res.status(201).json({ message: "updated rating", data: updateRating });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRating = await Rating.findByIdAndDelete(id);
    res.status(200).json({ message: "deleted rating", data: deleteRating });
  } catch (error) {
    res.status(500).json(error);
  }
});

module.exports = router;
