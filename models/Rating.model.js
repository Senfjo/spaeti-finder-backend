const { Schema, model } = require("mongoose");

const ratingSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  stars: {
    type: Number,
    enum: [1, 2, 3, 4, 5],
  },
  comment: {
    type: String,
  },
  likes: {
    type: [Schema.Types.ObjectId],
    ref: "User",
  },
  date: {
    type: Date,
    default: Date.now,
  },
  spaeti: {
    type: Schema.Types.ObjectId,
    ref: "Spaeti",
  },
});

const Rating = model("Rating", ratingSchema);
module.exports = Rating;
