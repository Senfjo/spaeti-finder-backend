const router = require("express").Router();
const User = require("../models/User.model");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { isAuthenticated } = require("../middleware/jwt.middleware");

// Checks password: at least 1 capital letter, 1 lowercase letter, 1 digit, no whitespace and a length of 8 characters
function isValidPassword(pw) {
  return true;
  // pw.match(/^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?!.* ).{8,}$/g);
}

const uploader = require("../middleware/cloudinary.config");

router.post("/signup", uploader.single("image"), async (req, res) => {
  let userImage;
  if (req.file) {
    userImage = req.file.path;
  }

  try {
    const foundEmail = await User.findOne({
      email: req.body.email,
    });
    const foundUsername = await User.findOne({
      username: req.body.username,
    });
    if (foundEmail && foundUsername) throw "email and username already exist";
    else if (foundEmail) throw "email already exists";
    else if (foundUsername) throw "username already exists";
    // else if (!isValidPassword(req.body.password)) throw "invalid password";

    const salt = bcryptjs.genSaltSync(10);
    const hashedPassword = bcryptjs.hashSync(req.body.password, salt);

    const newUser = await User.create({
      ...req.body,
      password: hashedPassword,
      image: userImage,
    });
    res.status(201).json({ message: "Created new user" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: error });
  }
});

router.post("/login", async (req, res) => {
  try {
    const foundUser = await User.findOne({
      username: req.body.username,
    });
    if (foundUser) {
      const passwordMatch = bcryptjs.compareSync(
        req.body.password,
        foundUser.password
      );
      if (passwordMatch) {
        const loggedInUser = {
          _id: foundUser._id,
          user: foundUser.username,
        };
        const authToken = jwt.sign(loggedInUser, process.env.TOKEN_SECRET, {
          algorithm: "HS256",
          expiresIn: "6h",
        });
        res.status(200).json({ message: "Login successful", authToken });
      } else {
        res.status(500).json({ errorMessage: "Invalid credentials" });
      }
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/verify", isAuthenticated, (req, res) => {
  if (req.payload) {
    console.log("payload in verify", req.payload);
    res
      .status(200)
      .json({ message: "Valid token", user: { ...req.payload, admin: false } });
  } else {
    res.status(401).json({ errorMessage: "Invalid token" });
  }
});

module.exports = router;
