// middleware/cloudinary.config.js

require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

// configure your Cloudinary credentials
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key:    process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// set up CloudinaryStorage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "berlinFolder",
    // allow JPG, JPEG and PNG uploads
    allowed_formats: ["jpg", "jpeg", "png"],
    // use the original filename (without extension) as public_id
    public_id: (req, file) =>
      file.originalname.replace(/\.[^/.]+$/, ""),
  },
});

module.exports = multer({ storage });
