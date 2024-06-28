const jwt = require("jsonwebtoken");
require("dotenv").config();

const isAuthenticated = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.TOKEN_SECRET);
    req.payload = payload;
    console.log("this is the payload", req.payload)

    next();
  } catch (error) {
    console.log(error);
    res.status(401).json("token not provided or not valid");
  }
};

module.exports = {
  isAuthenticated,
};
