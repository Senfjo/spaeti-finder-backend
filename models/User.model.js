const { Schema, model } = require("mongoose");

// TODO: Please make sure you edit the User model to whatever makes sense in this case
const userSchema = new Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required."],
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
    },
    image: {
      type: String,
      default: "https://pbs.twimg.com/media/EM5IQXcVUAERaFN.jpg",
    },
    xp: {
      type: Number,
      default: 0,
    },
    ratings: {
      type: [Schema.Types.ObjectId],
      ref: "ratings",
    },
    likes: {
      type: [Schema.Types.ObjectId],
      ref: "likes",
    }
  },
  {
    // this second object adds extra properties: `createdAt` and `updatedAt`
    timestamps: true,
  }
);

const User = model("User", userSchema);

module.exports = User;
