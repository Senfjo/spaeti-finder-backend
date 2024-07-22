const router = require('express').Router();
const Ticket = require('../models/Ticket.model');
const Spaeti = require('../models/Spaeti.model');
const { isAuthenticated, isAdmin } = require('../middleware/jwt.middleware');

router.post('', isAuthenticated, async (req, res) => {
  try {
    const { spaetiId, changes } = req.body;
    console.log("req body in ticket route", req.body)
    const ticket = await Ticket.create({
      spaetiId,
      changes,
      userId: req.body.userId,
    });
    res.status(201).json({ message: 'Ticket created', data: ticket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('', isAdmin, async (req, res) => {
  try {
    const tickets = await Ticket.find({ status: 'pending' }).populate('userId spaetiId');
    res.status(200).json({ message: 'Pending tickets', data: tickets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/approve', isAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const spaeti = await Spaeti.findById(ticket.spaetiId);
    if (!spaeti) {
      return res.status(404).json({ error: 'Späti not found' });
    }

    Object.assign(spaeti, ticket.changes);
    await spaeti.save();
    ticket.status = 'approved';
    await ticket.save();

    res.status(200).json({ message: 'Ticket approved', data: ticket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reject', isAdmin, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    ticket.status = 'rejected';
    await ticket.save();
    res.status(200).json({ message: 'Ticket rejected', data: ticket });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
