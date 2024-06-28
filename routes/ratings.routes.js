const router = require("express").Router();
const Rating = require("../models/Rating.model");


router.post("", async (req, res) => {
  try {
    const createRating = await Rating.create(req.body);
    res.status(201).json({ message: "created rating", data: createRating });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.get("", async (req, res) => {
  try {
    const allRatings = await Rating.find().populate("user").lean()
    console.log("all ratings get route", allRatings[0].user)

    if (allRatings) {
      const keysToDelete = ["password", "email"]; 
      keysToDelete.forEach((key, index) => {
        delete allRatings[index].user[key];
      });
    }

    res.status(200).json({ message: "found all ratings", data: allRatings });
  } catch (error) {
    res.status(500).json(error);
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
    res.status(201).json({message: "updated rating", data: updateRating })
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