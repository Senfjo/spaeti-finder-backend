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
  // Like-count thresholds (see xp.service LIKE_MILESTONE) already paid out
  // for this rating, so PUT /add-like never double-awards. Never cleared on
  // unlike — milestone XP is a one-time achievement, not reversible.
  likeMilestonesAwarded: {
    type: [Number],
    default: [],
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
