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
    required: true
  },
  comment: {
    type: String,
    default: ""
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
    required: true
  },
}, {
  timestamps: true  // This adds createdAt and updatedAt automatically
});

const Rating = model("Rating", ratingSchema);
module.exports = Rating;
