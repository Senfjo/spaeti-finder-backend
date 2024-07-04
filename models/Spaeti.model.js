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
    ref: "Rating",
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
    ref: "User",
  },
  approved: {
    type: Boolean,
  },
  image: {
    type: String,
    default:
      "https://www.berlin-live.de/wp-content/uploads/sites/10/2024/03/imago0105469791h-e1710357404842.jpg",
  },
});

const Spaeti = model("Spaeti", spaetiSchema);
module.exports = Spaeti;
