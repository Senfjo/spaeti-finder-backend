const express = require("express");
const router = express.Router();
const Rating = require("../models/Rating.model");
const User = require("../models/User.model");
const Spaeti = require("../models/Spaeti.model");
const { isAuthenticated } = require("../middleware/jwt.middleware");

// Helper function to award XP to a user
async function awardXPToUser(userId, xpAmount) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: "User not found" };
    }

    // Initialize XP if it doesn't exist
    if (typeof user.xp !== 'number') {
      user.xp = 0;
    }

    // Award XP
    user.xp += xpAmount;
    await user.save();

    // Calculate level (every 100 XP = 1 level)
    const level = Math.floor(user.xp / 100) + 1;
    const xpToNextLevel = 100 - (user.xp % 100);

    return {
      success: true,
      xp: user.xp,
      level,
      xpToNextLevel,
      xpAwarded: xpAmount
    };
  } catch (error) {
    console.error("Error awarding XP:", error);
    return { success: false, message: "Error awarding XP" };
  }
}

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

    // Award 10 XP for creating a rating
    const xpResult = await awardXPToUser(finalUserId, 10);

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

    // Update Späti's average rating
    const allRatings = await Rating.find({ spaeti: finalSpaetiId });
    const totalRating = allRatings.reduce((sum, r) => sum + (r.stars || 0), 0);
    const averageRating = totalRating / allRatings.length;

    await Spaeti.findByIdAndUpdate(finalSpaetiId, { 
      averageRating: Math.round(averageRating * 10) / 10 // Round to 1 decimal place
    });

    res.status(201).json({
      message: "Rating created successfully",
      data: populatedRating, // Match your existing API format
      rating: populatedRating,
      xp: xpResult.success ? {
        awarded: xpResult.xpAwarded,
        total: xpResult.xp,
        level: xpResult.level,
        xpToNextLevel: xpResult.xpToNextLevel
      } : null
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

    // Update Späti's average rating if rating value changed
    if (finalStars !== undefined) {
      const allRatings = await Rating.find({ spaeti: existingRating.spaeti });
      const totalRating = allRatings.reduce((sum, r) => sum + (r.stars || 0), 0);
      const averageRating = totalRating / allRatings.length;

      await Spaeti.findByIdAndUpdate(existingRating.spaeti, { 
        averageRating: Math.round(averageRating * 10) / 10
      });
    }

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
    const user = await User.findById(userId);
    if (rating.user.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ message: "You can only delete your own ratings" });
    }

    const spaetiId = rating.spaeti;

    // Delete the rating
    await Rating.findByIdAndDelete(ratingId);

    // Update Späti's average rating
    const remainingRatings = await Rating.find({ spaeti: spaetiId });
    if (remainingRatings.length > 0) {
      const totalRating = remainingRatings.reduce((sum, r) => sum + (r.stars || 0), 0);
      const averageRating = totalRating / remainingRatings.length;
      await Spaeti.findByIdAndUpdate(spaetiId, { 
        averageRating: Math.round(averageRating * 10) / 10
      });
    } else {
      // No ratings left, remove averageRating
      await Spaeti.findByIdAndUpdate(spaetiId, { 
        $unset: { averageRating: 1 }
      });
    }

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
    
    res.status(201).json({ 
      message: "Successfully updated", 
      addLike: updatedRating 
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
    
    res.status(201).json({ 
      message: "Successfully updated", 
      removeLike: updatedRating 
    });
  } catch (error) {
    console.error("Error removing like:", error);
    res.status(500).json({ message: "Error removing like" });
  }
});

// Legacy routes for backward compatibility
router.delete("/delete/:ratingId", isAuthenticated, async (req, res) => {
  try {
    const { ratingId } = req.params;
    const userId = req.payload._id;

    // Find the rating
    const rating = await Rating.findById(ratingId);
    if (!rating) {
      return res.status(404).json({ message: "Rating not found" });
    }

    // Check if the user owns this rating or is an admin
    const user = await User.findById(userId);
    if (rating.user.toString() !== userId && user.role !== 'admin') {
      return res.status(403).json({ message: "You can only delete your own ratings" });
    }

    const spaetiId = rating.spaeti;

    // Delete the rating
    await Rating.findByIdAndDelete(ratingId);

    // Update Späti's average rating
    const remainingRatings = await Rating.find({ spaeti: spaetiId });
    if (remainingRatings.length > 0) {
      const totalRating = remainingRatings.reduce((sum, r) => sum + (r.stars || 0), 0);
      const averageRating = totalRating / remainingRatings.length;
      await Spaeti.findByIdAndUpdate(spaetiId, { 
        averageRating: Math.round(averageRating * 10) / 10
      });
    } else {
      // No ratings left, remove averageRating
      await Spaeti.findByIdAndUpdate(spaetiId, { 
        $unset: { averageRating: 1 }
      });
    }

    res.json({ message: "Rating deleted successfully" });
  } catch (error) {
    console.error("Error deleting rating:", error);
    res.status(500).json({ message: "Error deleting rating" });
  }
});

router.put("/update/:ratingId", isAuthenticated, async (req, res) => {
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

    // Update Späti's average rating if rating value changed
    if (finalStars !== undefined) {
      const allRatings = await Rating.find({ spaeti: existingRating.spaeti });
      const totalRating = allRatings.reduce((sum, r) => sum + (r.stars || 0), 0);
      const averageRating = totalRating / remainingRatings.length;

      await Spaeti.findByIdAndUpdate(existingRating.spaeti, { 
        averageRating: Math.round(averageRating * 10) / 10
      });
    }

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

module.exports = router;
