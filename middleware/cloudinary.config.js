// middleware/cloudinary.config.js

require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key:    process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "berlinFolder",
    allowed_formats: ["jpg", "jpeg", "png"],
    // always generate a unique ID so uploads never overwrite each other
    public_id: () => uuidv4(),
  },
});

module.exports = multer({ storage });
