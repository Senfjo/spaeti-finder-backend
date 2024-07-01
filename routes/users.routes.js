const router = require("express").Router();
const User = require("../models/User.model");
const keysToDelete = ["password", "email"];

router.post("", async (req, res) => {
  try {
    const createUser = await User.create(req.body);
    console.log(createUser);
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

router.get("", async (req, res) => {
  try {
    const allUsers = await User.find().lean();
    console.log(allUsers);
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

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const findUser = await User.findById(id).lean();
    console.log(findUser);
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

module.exports = router;
