const express = require('express');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const requireAuth = require('../middleware/auth');

const router = express.Router();

router.get('/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    const records = await Attendance.find({ event: eventId })
      .populate('student')
      .sort({ scannedAt: -1 });

    const totalStudents = await Student.countDocuments();
    const presentCount = records.length;

    res.json({
      records,
      stats: {
        totalStudents,
        presentCount,
        absentCount: Math.max(totalStudents - presentCount, 0),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load attendance' });
  }
});

module.exports = router;
