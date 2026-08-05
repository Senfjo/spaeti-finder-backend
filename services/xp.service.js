// services/xp.service.js
// Central XP/leveling logic. All XP-awarding routes should go through this
// service instead of copy-pasting a read-modify-save "awardXPToUser" helper.
const User = require("../models/User.model");

// XP amounts for each source. PHOTO_APPROVED and LIKE_MILESTONE are not wired
// up to any route yet — they're defined now for Phase E (photo approval XP,
// like-milestone XP) so that phase doesn't need to touch this file.
const XP = {
  RATING_CREATED: 10,
  SPAETI_APPROVED: 40,
  SPAETI_WITH_PHOTO_APPROVED: 50,
  TICKET_APPROVED: 30,
  PHOTO_APPROVED: 20,
  LIKE_MILESTONE: 25,
};

// Every 100 XP = 1 level, starting at level 1.
function levelFor(xp) {
  return Math.floor(xp / 100) + 1;
}

// Atomically increments a user's XP via $inc (avoids the race condition of
// find -> mutate in JS -> save that the old per-route helpers used).
// Never throws — returns null on any failure (user not found or DB error).
async function awardXP(userId, amount) {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { xp: amount } },
      { new: true }
    );
    if (!user) {
      return null;
    }

    const totalXP = user.xp;
    const level = levelFor(totalXP);
    const leveledUp = level > levelFor(totalXP - amount);

    return {
      awarded: amount,
      totalXP,
      level,
      leveledUp,
    };
  } catch (error) {
    console.warn("Error awarding XP:", error);
    return null;
  }
}

module.exports = { XP, levelFor, awardXP };
