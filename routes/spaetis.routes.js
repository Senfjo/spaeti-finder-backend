const router = require("express").Router();
const Spaeti = require("../models/Spaeti.model");


router.post("", async (req, res) => {
    try {
      const createSpaeti = await Spaeti.create(req.body);
      res.status(201).json({ message: "created spaeti", data: createSpaeti });
    } catch (error) {
      res.status(500).json(error);
    }
  });

router.get("", async (req, res) => {
  try {
    const allSpaetis = await Spaeti.find();
    res.status(200).json({ message: "found all spaetis", data: allSpaetis });
  } catch (error) {
    res.status(500).json(error);
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const findSpaeti = await Spaeti.findById(id);
    res.status(200).json({ message: "found spaeti", data: findSpaeti });
  } catch (error) {
    res.status(500).json(error);
  }
});

  router.patch("/update/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const updateSpaeti = await Spaeti.findByIdAndUpdate(id);
      res.status(201).json({message: "updated spaeti", data: updateSpaeti})
    } catch (error) {
      res.status(500).json(error);
    }
  });

router.delete("/delete/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const deleteSpaeti = await Spaeti.findByIdAndDelete(id);
      res.status(200).json({ message: "deleted spaeti", deleteSpaeti });
    } catch (error) {
      res.status(500).json(error);
    }
  });
  

module.exports = router;