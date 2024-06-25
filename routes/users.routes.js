const router = require("express").Router();
const User = require("../models/User.model");


router.post("", async (req, res) => {
  try {
    const createUser = await User.create(req.body);
    res.status(201).json({ message: "created user", data: createUser });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.get("", async (req, res) => {
  try {
    const allUsers = await User.find();
    res.status(200).json({ message: "found all users", data: allUsers });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const findUser = await User.findById(id);
    res.status(200).json({ message: "found user", data: findUser });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.put("/update/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const updateUser = await User.findByIdAndUpdate(id, req.body, {
      new: true,
    });
    res.status(201).json({message: "updated user", data: updateUser})
  } catch (error) {
    res.status(500).json(error);
  }
});

router.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deleteUser = await User.findByIdAndDelete(id);
    res.status(200).json({ message: "deleted user", data: deleteUser });
  } catch (error) {
    res.status(500).json(error);
  }
});


module.exports = router;
