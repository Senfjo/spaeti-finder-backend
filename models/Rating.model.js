const { Schema, model } = require("mongoose");

const ratingSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "user",
  },
  stars: {
    type: Number,
    enum: [1, 2, 3, 4, 5],
  },
  comment: {
    type: String,
  },
  img: {
    type: String,
  },
  likes: {
    type: [Schema.Types.ObjectId],
    ref: "likes",
  },
  date: { 
    type: Date, 
    default: Date.now 
  },
});

const Rating = model("Rating", ratingSchema);
module.exports = Rating;
