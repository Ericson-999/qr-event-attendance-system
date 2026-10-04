const express = require('express');
const Event = require('../models/Event');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, date } = req.body;
    if (!name) return res.status(400).json({ error: 'Event name is required' });

    const event = await Event.create({ name, date: date || Date.now() });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const events = await Event.find().sort({ createdAt: -1 });
  res.json(events);
});

router.get('/active', requireAuth, async (req, res) => {
  const active = await Event.findOne({ isActive: true });
  res.json(active || null);
});

router.patch('/:id/activate', requireAuth, async (req, res) => {
  await Event.updateMany({}, { isActive: false });
  const event = await Event.findByIdAndUpdate(req.params.id, { isActive: true }, { new: true });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(event);
});

router.patch('/:id/deactivate', requireAuth, async (req, res) => {
  const event = await Event.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json(event);
});

module.exports = router;
