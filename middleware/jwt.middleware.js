const jwt = require("jsonwebtoken");
require("dotenv").config();

const isAuthenticated = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.TOKEN_SECRET);
    req.payload = payload;
    next();
  } catch (error) {
    console.log(error);
    res.status(401).json("token not provided or not valid");
  }
};

const isAdmin = (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.TOKEN_SECRET);

    if (payload.admin) {
      next();
    } else {
      res.status(403).json({ message: "Forbidden" });
    }
  } catch (error) {
    console.log(error);
    res.status(401).json("no access to this page");
  }
};

module.exports = {
  isAuthenticated,
  isAdmin,
};
