const router = require("express").Router();
const User = require("../models/User.model");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { isAuthenticated } = require("../middleware/jwt.middleware");

router.post("/signup", async (req, res) => {
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

    const salt = bcryptjs.genSaltSync(10);
    const hashedPassword = bcryptjs.hashSync(req.body.password, salt);

    const newUser = await User.create({
      ...req.body,
      password: hashedPassword,
    });
    res.status(201).json({ message: "Created new user", newUser });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errorMessage: error });
  }
});

router.post("/login", async (req, res) => {
  try {
    const foundUser = await User.findOne({
      email: req.body.email,
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
        res.status(200).json({message: "Login successful", authToken})
      }
      else{
        res.status(500).json({errorMessage:"Invalid credentials"})
      }
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/verify", isAuthenticated, (req,res)=>{
    if (req.payload){
        res.status(200).json({message: "Valid token", user: req.payload})
    }else{
        res.status(401).json({errorMessage: "Invalid token"})
    }
})

module.exports = router;
