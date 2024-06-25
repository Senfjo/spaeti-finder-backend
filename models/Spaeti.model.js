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
  sterni:{
    type: Number,
  },
  TrackEvent: {
    type: Boolean,
  },
  seats: {
    type: Boolean,
  },
  wc: {
    type: Boolean,
  },
});

const Spaeti = model("Spaeti", spaetiSchema);
module.exports = Spaeti;
