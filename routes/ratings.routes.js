const express = require("express");
const router = express.Router();
const Rating = require("../models/Rating.model");
const User = require("../models/User.model");
const Spaeti = require("../models/Spaeti.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");
const { awardXP, XP } = require("../services/xp.service");

// GET /api/ratings - Get all ratings
router.get("/", async (req, res, next) => {
  try {
    const ratings = await Rating.find()
      .populate("user", "username")
      .populate("spaeti", "name");
    res.json(ratings);
  } catch (error) {
    console.error("Error fetching ratings:", error);
    res.status(500).json({ message: "Error fetching ratings" });
  }
});

// GET /api/ratings/spaeti/:spaetiId - Get ratings for a specific Späti
router.get("/spaeti/:spaetiId", async (req, res, next) => {
  try {
    const { spaetiId } = req.params;
    const ratings = await Rating.find({ spaeti: spaetiId })
      .populate("user", "username")
      .sort({ createdAt: -1 });
    res.json(ratings);
  } catch (error) {
    console.error("Error fetching Späti ratings:", error);
    res.status(500).json({ message: "Error fetching ratings" });
  }
});

// GET /api/ratings/user/:userId - Get ratings by a specific user
router.get("/user/:userId", async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    // First try the new Rating model approach
    const ratings = await Rating.find({ user: userId })
      .populate("spaeti", "name")
      .sort({ createdAt: -1 });
    
    if (ratings && ratings.length > 0) {
      return res.status(200).json({ 
        message: "found user ratings", 
        data: ratings 
      });
    }
    
    // Fallback: try the old approach (User model with ratings array)
    const user = await User.findById(userId)
      .populate({
        path: "ratings",
        populate: {
          path: "spaeti"
        }
      })
      .lean();

    if (user && user.ratings) {
      const keysToDelete = ["password", "email"];
      keysToDelete.forEach((key) => {
        delete user[key];
      });
      return res.status(200).json({ 
        message: "found user ratings", 
        data: user.ratings 
      });
    }
    
    // No ratings found
    res.status(200).json({ 
      message: "No ratings found", 
      data: [] 
    });
    
  } catch (error) {
    console.error("Error fetching user ratings:", error);
    res.status(500).json({ message: "Error fetching user ratings" });
  }
});

// POST /api/ratings - Create a new rating (awards 10 XP)
router.post("/", isAuthenticated, async (req, res, next) => {
  try {
    const { stars, rating, comment, spaeti: spaetiFromBody, spaetiId, user } = req.body;
    const userId = req.payload._id; // From JWT token

    // Use 'stars' field (accept 'rating' for backward compatibility)
    const finalStars = stars || rating;
    const finalSpaetiId = spaetiFromBody || spaetiId;
    const finalUserId = userId; // Always use the authenticated user ID

    // Validate required fields
    if (!finalStars || !finalSpaetiId) {
      return res.status(400).json({ message: "Stars and Späti ID are required" });
    }

    // Check if rating is between 1 and 5
    if (finalStars < 1 || finalStars > 5) {
      return res.status(400).json({ message: "Stars must be between 1 and 5" });
    }

    // Check if Späti exists
    const spaetiDoc = await Spaeti.findById(finalSpaetiId);
    if (!spaetiDoc) {
      return res.status(404).json({ message: "Späti not found" });
    }

    // Check if user has already rated this Späti
    const existingRating = await Rating.findOne({ user: finalUserId, spaeti: finalSpaetiId });
    if (existingRating) {
      return res.status(400).json({ message: "Du hast diesen Späti bereits bewertet." });
    }

    // Create the rating
    const newRating = new Rating({
      stars: finalStars,
      comment,
      user: finalUserId,
      spaeti: finalSpaetiId
    });

    const savedRating = await newRating.save();

    // Award XP for creating a rating
    const xpResult = await awardXP(finalUserId, XP.RATING_CREATED);

    // Update the User model to include this rating (for compatibility with existing structure)
    try {
      await User.findByIdAndUpdate(
        finalUserId,
        { $push: { ratings: savedRating._id } },
        { new: true }
      );
    } catch (userUpdateError) {
      console.warn("Could not update user ratings array:", userUpdateError);
    }

    // Update the Späti model to include this rating (for compatibility with existing structure)
    try {
      await Spaeti.findByIdAndUpdate(
        finalSpaetiId,
        { $push: { rating: savedRating._id } },
        { new: true }
      );
    } catch (spaetiUpdateError) {
      console.warn("Could not update spaeti ratings array:", spaetiUpdateError);
    }

    // Populate the rating before sending response
    const populatedRating = await Rating.findById(savedRating._id)
      .populate("user", "username")
      .populate("spaeti", "name");

    res.status(201).json({
      message: "Rating created successfully",
      data: populatedRating, // Match your existing API format
      rating: populatedRating,
      xp: xpResult
    });
  } catch (error) {
    console.error("Error creating rating:", error);
    res.status(500).json({ message: "Error creating rating", error: error.message });
  }
});

// PUT /api/ratings/:ratingId - Update a rating
router.put("/:ratingId", isAuthenticated, async (req, res, next) => {
  try {
    const { ratingId } = req.params;
    const { stars, rating, comment } = req.body;
    const userId = req.payload._id;

    // Use 'stars' field (accept 'rating' for backward compatibility)
    const finalStars = stars || rating;

    // Find the existing rating
    const existingRating = await Rating.findById(ratingId);
    if (!existingRating) {
      return res.status(404).json({ message: "Rating not found" });
    }

    // Check if the user owns this rating
    if (existingRating.user.toString() !== userId) {
      return res.status(403).json({ message: "You can only update your own ratings" });
    }

    // Validate rating value
    if (finalStars && (finalStars < 1 || finalStars > 5)) {
      return res.status(400).json({ message: "Stars must be between 1 and 5" });
    }

    // Update the rating
    const updateData = {};
    if (finalStars !== undefined) updateData.stars = finalStars;
    if (comment !== undefined) updateData.comment = comment;
    updateData.updatedAt = new Date();

    const updatedRating = await Rating.findByIdAndUpdate(
      ratingId,
      updateData,
      { new: true }
    ).populate("user", "username").populate("spaeti", "name");

    res.json({
      message: "Rating updated successfully",
      rating: updatedRating,
      data: updatedRating // Add data field for compatibility
    });
  } catch (error) {
    console.error("Error updating rating:", error);
    res.status(500).json({ message: "Error updating rating" });
  }
});

// DELETE /api/ratings/:ratingId - Delete a rating
// Reverses the XP awarded on creation (clamped at 0) and pulls the rating's
// id out of User.ratings and Spaeti.rating so no dangling refs remain. This,
// combined with the "already rated" guard in POST /, closes the
// rate -> delete -> re-rate XP farm loop: a user can never hold more XP from
// a given Späti's rating than the single RATING_CREATED award, since delete
// always gives it back before the "already rated" check can be bypassed.
router.delete("/:ratingId", isAuthenticated, async (req, res, next) => {
  try {
    const { ratingId } = req.params;
    const userId = req.payload._id;

    // Find the rating
    const rating = await Rating.findById(ratingId);
    if (!rating) {
      return res.status(404).json({ message: "Rating not found" });
    }

    // Check if the user owns this rating or is an admin
    const caller = await User.findById(userId);
    if (!caller) {
      return res.status(404).json({ message: "User not found" });
    }
    if (rating.user.toString() !== userId && !caller.admin) {
      return res.status(403).json({ message: "You can only delete your own ratings" });
    }

    // Delete the rating
    await Rating.findByIdAndDelete(ratingId);

    // Reverse the XP awarded for creating this rating (clamped so it never
    // goes below 0), and pull the now-deleted rating's id out of
    // User.ratings in the same update.
    try {
      const ratingOwner = await User.findById(rating.user).select("xp");
      const currentXP = ratingOwner ? ratingOwner.xp || 0 : 0;
      const newXP = Math.max(0, currentXP - XP.RATING_CREATED);
      await User.findByIdAndUpdate(rating.user, {
        xp: newXP,
        $pull: { ratings: ratingId }
      });
    } catch (xpError) {
      console.warn("Could not reverse XP on rating delete:", xpError);
    }

    // Remove the now-deleted rating's id from the Späti's rating array too.
    await Spaeti.findByIdAndUpdate(rating.spaeti, { $pull: { rating: ratingId } });

    res.json({ message: "Rating deleted successfully" });
  } catch (error) {
    console.error("Error deleting rating:", error);
    res.status(500).json({ message: "Error deleting rating" });
  }
});

// COMPATIBILITY ROUTES - Add these routes for frontend compatibility

// GET /api/ratings/:id - Get a single rating (for likes functionality)
router.get("/:ratingId", async (req, res) => {
  try {
    const { ratingId } = req.params;
    const rating = await Rating.findById(ratingId).populate("user", "username");
    if (!rating) {
      return res.status(404).json({ message: "Rating not found" });
    }
    res.status(200).json({ 
      message: "Rating found", 
      data: rating 
    });
  } catch (error) {
    console.error("Error fetching rating:", error);
    res.status(500).json({ message: "Error fetching rating" });
  }
});

// PUT /api/ratings/add-like/:id - Add like to a rating
router.put("/add-like/:ratingId", isAuthenticated, async (req, res) => {
  try {
    const { ratingId } = req.params;
    // Liker kommt aus dem Token, nicht aus dem Body (fälschungssicher).
    const user = req.payload._id;

    const updatedRating = await Rating.findByIdAndUpdate(
      ratingId,
      { $addToSet: { likes: user } },
      { new: true }
    );

    if (!updatedRating) {
      return res.status(404).json({ message: "Rating not found" });
    }

    // Like-milestone XP: paid once per threshold to the rating's author (not
    // the liker), never revoked on unlike (anti-oscillation-farming). The
    // findOneAndUpdate filter (likeMilestonesAwarded not already containing
    // the threshold) means only one concurrent request can win the
    // $addToSet push, so only that request awards XP even under a race.
    const LIKE_MILESTONES = [5, 10, 25];
    let xpAwardedToOwner = false;
    for (const threshold of LIKE_MILESTONES) {
      if (updatedRating.likes.length < threshold) continue;
      if (updatedRating.likeMilestonesAwarded.includes(threshold)) continue;

      const milestoneWon = await Rating.findOneAndUpdate(
        { _id: ratingId, likeMilestonesAwarded: { $ne: threshold } },
        { $addToSet: { likeMilestonesAwarded: threshold } },
        { new: true }
      );
      if (milestoneWon) {
        await awardXP(updatedRating.user, XP.LIKE_MILESTONE);
        xpAwardedToOwner = true;
      }
    }

    res.status(200).json({
      message: "Successfully updated",
      addLike: updatedRating,
      xpAwardedToOwner
    });
  } catch (error) {
    console.error("Error adding like:", error);
    res.status(500).json({ message: "Error adding like" });
  }
});

// PUT /api/ratings/remove-like/:id - Remove like from a rating
router.put("/remove-like/:ratingId", isAuthenticated, async (req, res) => {
  try {
    const { ratingId } = req.params;
    // Liker kommt aus dem Token, nicht aus dem Body (fälschungssicher).
    const user = req.payload._id;

    const updatedRating = await Rating.findByIdAndUpdate(
      ratingId,
      { $pull: { likes: user } },
      { new: true }
    );
    
    if (!updatedRating) {
      return res.status(404).json({ message: "Rating not found" });
    }
    
    res.status(200).json({
      message: "Successfully updated",
      removeLike: updatedRating
    });
  } catch (error) {
    console.error("Error removing like:", error);
    res.status(500).json({ message: "Error removing like" });
  }
});

module.exports = router;
