const router = require("express").Router();

router.get("/", (req, res, next) => { f
  res.json("All good in here");
});

module.exports = router;
