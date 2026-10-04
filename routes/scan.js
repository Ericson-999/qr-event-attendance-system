const express = require('express');
const Student = require('../models/Student');
const Event = require('../models/Event');
const Attendance = require('../models/Attendance');
const requireAuth = require('../middleware/auth');
const { verifyStudentToken } = require('../utils/qrToken');

const router = express.Router();

router.post('/lookup', requireAuth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'No QR token provided' });

  let payload;
  try {
    payload = verifyStudentToken(token);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid or tampered QR code' });
  }

  try {
    const student = await Student.findById(payload.sid);
    if (!student) return res.status(404).json({ error: 'Student not found for this QR code' });

    const activeEvent = await Event.findOne({ isActive: true });
    if (!activeEvent) {
      return res.status(400).json({ error: 'No active event/session. Activate one first.' });
    }

    const already = await Attendance.findOne({ student: student._id, event: activeEvent._id });

    res.json({
      student,
      event: activeEvent,
      alreadyRecorded: !!already,
      recordedAt: already ? already.scannedAt : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to look up QR code' });
  }
});

router.post('/confirm', requireAuth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'No QR token provided' });

  let payload;
  try {
    payload = verifyStudentToken(token);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid or tampered QR code' });
  }

  try {
    const student = await Student.findById(payload.sid);
    if (!student) return res.status(404).json({ error: 'Student not found for this QR code' });

    const activeEvent = await Event.findOne({ isActive: true });
    if (!activeEvent) {
      return res.status(400).json({ error: 'No active event/session. Activate one first.' });
    }

    const already = await Attendance.findOne({ student: student._id, event: activeEvent._id });
    if (already) {
      return res.status(200).json({
        duplicate: true,
        message: `${student.fullName} was already marked present for this session.`,
        student,
        event: activeEvent,
      });
    }

    const record = await Attendance.create({ student: student._id, event: activeEvent._id });

    res.status(201).json({
      duplicate: false,
      message: `${student.fullName} marked present.`,
      student,
      event: activeEvent,
      record,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

module.exports = router;
