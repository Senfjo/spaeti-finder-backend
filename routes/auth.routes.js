// routes/auth.routes.js
const router = require("express").Router();
const User = require("../models/User.model");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { isAuthenticated } = require("../middleware/jwt.middleware");

// Helper to validate password (not used here, but you can re-enable)
function isValidPassword(pw) {
  return true;
  // return /^(?=.*[0-9])(?=.*[a-z])(?=.*[A-Z])(?!.* ).{8,}$/.test(pw);
}

// ─── SIGNUP ────────────────────────────────────────────────────────────────────
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, image } = req.body;

    // 1) Check for duplicates
    const foundEmail    = await User.findOne({ email });
    const foundUsername = await User.findOne({ username });
    if (foundEmail || foundUsername) {
      let msg = foundEmail && foundUsername
        ? "Email and username already exist"
        : foundEmail
          ? "Email already exists"
          : "Username already exists";
      return res.status(400).json({ errorMessage: msg });
    }

    // 2) (Optional) validate password strength
    // if (!isValidPassword(password)) {
    //   return res.status(400).json({ errorMessage: "Password does not meet criteria" });
    // }

    // 3) Hash the password
    const salt = bcryptjs.genSaltSync(10);
    const hash = bcryptjs.hashSync(password, salt);

    // 4) Create the user, using the provided image URL or default
    const newUser = await User.create({
      username,
      email,
      password: hash,
      ...(image && { image }),  // if image is truthy, include it
    });

    // 5) Remove sensitive fields before responding
    const userRes = newUser.toObject();
    delete userRes.password;
    delete userRes.email;

    res.status(201).json({ message: "User created", data: userRes });
  } catch (error) {
    console.error("Error in signup:", error);
    res.status(500).json({ errorMessage: error.message });
  }
});

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const foundUser = await User.findOne({ username });
    if (!foundUser) {
      return res.status(401).json({ errorMessage: "Invalid credentials" });
    }

    const isMatch = bcryptjs.compareSync(password, foundUser.password);
    if (!isMatch) {
      return res.status(401).json({ errorMessage: "Invalid credentials" });
    }

    const payload = {
      _id:    foundUser._id,
      user:   foundUser.username,
      admin:  foundUser.admin,
      image:  foundUser.image,
    };

    const token = jwt.sign(payload, process.env.TOKEN_SECRET, {
      algorithm: "HS256",
      expiresIn: "6h",
    });

    res.status(200).json({ message: "Login successful", authToken: token });
  } catch (error) {
    console.error("Error in login:", error);
    res.status(500).json({ errorMessage: error.message });
  }
});

// ─── VERIFY ────────────────────────────────────────────────────────────────────
router.get("/verify", isAuthenticated, (req, res) => {
  res.status(200).json({ message: "Token valid", user: req.payload });
});

module.exports = router;
