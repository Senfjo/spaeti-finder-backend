const router = require("express").Router();
const Rating = require("../models/Rating.model");
const Spaeti = require("../models/Spaeti.model");
const User = require("../models/User.model");

router.post("", async (req, res) => {
  try {
    const createRating = await Rating.create(req.body);
    res.status(201).json({ message: "created rating", data: createRating });

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

router.put("/add-like/:id", async (req, res)=>{
  const {id} = req.params;

  try {
    const addLike = await Rating.findByIdAndUpdate(id, { $push: { likes: req.body.user } },
      { new: true })
      res.status(201).json({message: "Successfully updated", addLike})
  } catch (error) {
    console.log(error)
    res.status(500).json(error)
  }
})

router.put("/remove-like/:id", async (req, res)=>{
  const {id} = req.params;

  try {
    const removeLike = await Rating.findByIdAndUpdate(id, { $pull: { likes: req.body.user } },
      { new: true })
      res.status(201).json({message: "Successfully updated", removeLike})
  } catch (error) {
    console.log(error)
    res.status(500).json(error)
  }
})

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deleteRating = await Rating.findByIdAndDelete(id);
    res.status(200).json({ message: "deleted rating", data: deleteRating });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId)
      .populate({
        path: "ratings",
        populate: {
          path: "spaeti"
        }
      })
      .lean();

    if (user && user.ratings) {
      const keysToDelete = ["password", "email"];
      keysToDelete.forEach((key) => {
        delete user[key];
      });
      res.status(200).json({ message: "found user ratings", data: user.ratings });
    } else {
      res.status(404).json({ message: "User or ratings not found" });
    }
  } catch (error) {
    res.status(500).json({ errorMessage: "Error fetching user ratings" });
  }
});


module.exports = router;
