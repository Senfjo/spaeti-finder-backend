// routes/ticket.routes.js

const router = require("express").Router();
const Ticket = require("../models/Ticket.model");
const Spaeti = require("../models/Spaeti.model");
const User = require("../models/User.model");
const { isAuthenticated, isAdmin } = require("../middleware/jwt.middleware");
const uploader = require("../middleware/cloudinary.config"); // Use same config as spaetis

// XP reward amounts
const XP_REWARDS = {
  UPDATE_SPAETI: 30,
};

// Helper function to award XP to a user
const awardXPToUser = async (userId, xpAmount, reason) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.error(`User not found for XP award: ${userId}`);
      return null;
    }

    // Initialize XP if it doesn't exist
    if (user.xp === undefined || user.xp === null) {
      user.xp = 0;
    }

    user.xp += xpAmount;
    await user.save();

    console.log(`XP awarded: ${xpAmount} to user ${user.username} for: ${reason}`);
    return { user, xpAwarded: xpAmount };
  } catch (error) {
    console.error("Error awarding XP:", error);
    return null;
  }
};

// ─── Create a new ticket ───────────────────────────────────────────────────────
router.post("/", isAuthenticated, uploader.single("image"), async (req, res) => {
  try {
    const { spaetiId, changes, userId } = req.body;
    
    // Parse changes if it's a string (from FormData)
    const parsedChanges = typeof changes === 'string' ? JSON.parse(changes) : changes;
    
    // Add image URL to changes if uploaded via Cloudinary
    if (req.file) {
      parsedChanges.image = req.file.path; // Cloudinary URL
    }

    const ticket = await Ticket.create({
      spaetiId,
      changes: parsedChanges,
      userId,
    });
    
    res.status(201).json({ message: "Ticket created", data: ticket });
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── List pending tickets ───────────────────────────────────────────────────────
router.get("/", isAdmin, async (req, res) => {
  try {
    const tickets = await Ticket.find({ status: "pending" })
      .populate("userId spaetiId")
      .lean();

    tickets.forEach((ticket) => {
      if (ticket.userId) {
        delete ticket.userId.email;
        delete ticket.userId.password;
        delete ticket.userId.admin;
      }
    });

    res.status(200).json({ message: "Pending tickets", data: tickets });
  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Approve a ticket (UPDATED WITH XP REWARDS) ──────────────────────────────────
router.post("/:id/approve", isAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('userId');
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    // Check if already processed
    if (ticket.status === "approved") {
      return res.status(400).json({ error: "Ticket has already been processed" });
    }

    console.log("Applying ticket changes:", ticket.changes);

    // Get changes object - handle both Map and regular object
    let changes;
    if (ticket.changes instanceof Map) {
      changes = Object.fromEntries(ticket.changes);
    } else if (ticket.changes.toObject) {
      changes = ticket.changes.toObject();
    } else {
      changes = ticket.changes;
    }

    console.log("Parsed changes:", changes);

    // Prepare update object
    const updateObject = {};

    // 1) Handle Sterni price update
    if (changes.proposedSterni !== undefined) {
      const proposedPrice = parseFloat(changes.proposedSterni);
      if (!isNaN(proposedPrice)) {
        // We need to handle sterniHistory in the update
        const currentSpaeti = await Spaeti.findById(ticket.spaetiId);
        const newHistory = [...(currentSpaeti.sterniHistory || []), proposedPrice];
        const sum = newHistory.reduce((a, b) => a + b, 0);
        
        updateObject.sterniHistory = newHistory;
        updateObject.sternAvg = +(sum / newHistory.length).toFixed(2);
      }
    }

    // 2) Apply all other changes directly
    if (changes.name !== undefined) updateObject.name = changes.name;
    if (changes.seats !== undefined) updateObject.seats = changes.seats;
    if (changes.wc !== undefined) updateObject.wc = changes.wc;
    if (changes.image !== undefined) updateObject.image = changes.image;

    console.log("Update object:", updateObject);

    // 3) Use findByIdAndUpdate for atomic update
    const updatedSpaeti = await Spaeti.findByIdAndUpdate(
      ticket.spaetiId,
      updateObject,
      { new: true } // Return the updated document
    );

    if (!updatedSpaeti) {
      return res.status(404).json({ error: "Späti not found" });
    }

    // 4) Award XP to the user who submitted the change request
    let xpResult = null;
    if (ticket.userId) {
      xpResult = await awardXPToUser(
        ticket.userId._id, 
        XP_REWARDS.UPDATE_SPAETI, 
        "Change request approved"
      );
    }

    // 5) Mark ticket as approved
    await Ticket.findByIdAndUpdate(req.params.id, { status: "approved" });

    console.log("Späti updated successfully:", updatedSpaeti);

    res.status(200).json({ 
      message: "Ticket approved and Späti updated" + (xpResult ? " and XP awarded" : ""), 
      data: updatedSpaeti,
      xpAwarded: xpResult ? xpResult.xpAwarded : 0,
      user: xpResult ? { 
        _id: xpResult.user._id, 
        username: xpResult.user.username, 
        newXP: xpResult.user.xp 
      } : null
    });
  } catch (error) {
    console.error("Error approving ticket:", error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Reject a ticket ───────────────────────────────────────────────────────────
router.post("/:id/reject", isAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    ticket.status = "rejected";
    await ticket.save();
    
    res.status(200).json({ message: "Ticket rejected", data: ticket });
  } catch (error) {
    console.error("Error rejecting ticket:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
