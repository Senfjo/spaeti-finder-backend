// routes/ticket.routes.js

const router = require("express").Router();
const Ticket = require("../models/Ticket.model");
const Spaeti = require("../models/Spaeti.model");
const { isAuthenticated, isAdmin } = require("../middleware/jwt.middleware");

// ─── Create a new ticket ───────────────────────────────────────────────────────
router.post("/", isAuthenticated, async (req, res) => {
  try {
    const { spaetiId, changes } = req.body;
    const ticket = await Ticket.create({
      spaetiId,
      changes,
      userId: req.body.userId,
    });
    res.status(201).json({ message: "Ticket created", data: ticket });
  } catch (error) {
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
      delete ticket.userId.email;
      delete ticket.userId.password;
      delete ticket.userId.admin;
    });

    res.status(200).json({ message: "Pending tickets", data: tickets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── Approve a ticket ──────────────────────────────────────────────────────────
router.post("/:id/approve", isAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const spaeti = await Spaeti.findById(ticket.spaetiId);
    if (!spaeti) return res.status(404).json({ error: "Späti not found" });

    // 1) Parse the proposedSterni (might come in as a string)
    const raw = ticket.changes.get("proposedSterni");
    const proposed = raw != null ? parseFloat(raw) : NaN;

    if (!isNaN(proposed)) {
      // ensure history array exists
      spaeti.sterniHistory = spaeti.sterniHistory || [];
      spaeti.sterniHistory.push(proposed);

      // recompute average
      const sum = spaeti.sterniHistory.reduce((a, b) => a + b, 0);
      spaeti.sternAvg = +(sum / spaeti.sterniHistory.length).toFixed(2);
    }

    // 2) Apply any other field changes
    for (const [key, value] of ticket.changes.entries()) {
      if (key === "proposedSterni") continue;
      spaeti[key] = value;
    }

    // 3) Save updated Späti and mark ticket approved
    await spaeti.save();
    ticket.status = "approved";
    await ticket.save();

    res
      .status(200)
      .json({ message: "Ticket approved and Späti updated", data: spaeti });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Reject a ticket ───────────────────────────────────────────────────────────
router.post("/:id/reject", isAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    ticket.status = "rejected";
    const updatedTicket = await ticket.save();
    res.status(200).json({ message: "Ticket rejected", data: updatedTicket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
