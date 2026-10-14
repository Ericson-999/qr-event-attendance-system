const express = require('express');
const Event = require('../models/Event');
const requireAuth = require('../middleware/auth');
const { getState, serialize, parseEventInput, intField } = require('../utils/eventTime');

const router = express.Router();

// Create an event with its schedule. It starts as "waiting".
router.post('/', requireAuth, async (req, res) => {
  try {
    const parsed = parseEventInput(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const event = await Event.create({ ...parsed.value, status: 'waiting', isActive: false });
    res.status(201).json(serialize(event));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    res.json(events.map(e => serialize(e)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load events' });
  }
});

// The running event (the scan page uses this). Returns null when none is running.
router.get('/active', requireAuth, async (req, res) => {
  try {
    const active = await Event.findOne({ isActive: true });
    res.json(active ? serialize(active) : null);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load active event' });
  }
});

// Start: waiting -> running. Only one event can run at a time.
router.patch('/:id/start', requireAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (getState(event) !== 'waiting') {
      return res.status(400).json({ error: 'Only a waiting event can be started' });
    }
    const running = await Event.findOne({ isActive: true });
    if (running) {
      return res.status(409).json({ error: `"${running.name}" is still running. Stop it before starting another event.` });
    }
    event.status = 'running';
    event.isActive = true;
    event.startedAt = new Date();
    await event.save();
    res.json(serialize(event));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start event' });
  }
});

// Stop: running -> ended. The page asks the admin to confirm first.
router.patch('/:id/stop', requireAuth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (getState(event) !== 'running') {
      return res.status(400).json({ error: 'Only a running event can be stopped' });
    }
    event.status = 'ended';
    event.isActive = false;
    event.stoppedAt = new Date();
    await event.save();
    res.json(serialize(event));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to stop event' });
  }
});

// Add time: pushes the scheduled end later. Does not change the late cutoff.
router.patch('/:id/add-time', requireAuth, async (req, res) => {
  try {
    const m = intField(req.body && req.body.minutes, undefined, 1, 240, 'Minutes');
    if (m.error || m.value === undefined) {
      return res.status(400).json({ error: m.error || 'Minutes must be a whole number from 1 to 240' });
    }
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (getState(event) !== 'running') {
      return res.status(400).json({ error: 'Time can only be added to a running event' });
    }
    if (!event.scheduledEnd) {
      return res.status(400).json({ error: 'This older event has no end time to extend' });
    }
    event.scheduledEnd = new Date(new Date(event.scheduledEnd).getTime() + m.value * 60000);
    event.extraMinutes = (event.extraMinutes || 0) + m.value;
    await event.save();
    res.json(serialize(event));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add time' });
  }
});

module.exports = router;
