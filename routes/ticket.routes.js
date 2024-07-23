const router = require("express").Router();
const Ticket = require("../models/Ticket.model");
const Spaeti = require("../models/Spaeti.model");
const { isAuthenticated, isAdmin } = require("../middleware/jwt.middleware");

router.post("", isAuthenticated, async (req, res) => {
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

router.get("", isAdmin, async (req, res) => {
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

router.post("/:id/approve", isAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const spaeti = await Spaeti.findById(ticket.spaetiId);
    if (!spaeti) {
      return res.status(404).json({ error: "Späti not found" });
    }

    // Log initial states
    console.log("Initial Späti:", spaeti);
    console.log("Ticket changes:", ticket.changes);

    // Update the Späti with changes from the ticket
    for (const [key, value] of ticket.changes.entries()) {
      spaeti[key] = value;
    }

    const updatedSpaeti = await spaeti.save(); // Save the updated Späti
    console.log("Updated Späti:", updatedSpaeti);

    ticket.status = "approved";
    const updatedTicket = await ticket.save(); // Save the updated ticket
    console.log("Updated Ticket:", updatedTicket);

    res.status(200).json({ message: "Ticket approved and Späti updated", data: updatedTicket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/:id/reject", isAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    ticket.status = "rejected";
    const updatedTicket = await ticket.save();
    res.status(200).json({ message: "Ticket rejected", data: updatedTicket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
