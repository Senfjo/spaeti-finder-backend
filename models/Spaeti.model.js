const { Schema, model } = require("mongoose");

const spaetiSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  street: {
    type: String,
    required: true,
  },
  zip: {
    type: Number,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  rating: {
    type: [Schema.Types.ObjectId],
    ref: "rating",
  },
  sterni: {
    type: Number,
  },
  seats: {
    type: Boolean,
  },
  wc: {
    type: Boolean,
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: "creator",
  },
  approved: {
    type: Boolean,
  },
  image: {
    type: String,
    default:
      "https://www.seo-freundlich.de/wp-content/uploads/SEO-fuer-Spaetkauf-Kiosk.jpg",
  },
});

const Spaeti = model("Spaeti", spaetiSchema);
module.exports = Spaeti;
