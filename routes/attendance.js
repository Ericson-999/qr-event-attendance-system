const express = require('express');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const requireAuth = require('../middleware/auth');
const { categorize, buildBuckets } = require('../utils/attendanceRules');

const router = express.Router();

// Attendance for one event: the log, the four lists (present / late / unfinished /
// absent, each with course/section/year) and the stats for the dashboard boxes.
router.get('/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params;

    const all = await Attendance.find({ event: eventId })
      .populate('student')
      .sort({ scannedAt: -1 });
    const records = all.filter(r => r.student); // a student may have been deleted after scanning

    const seenIds = records.map(r => r.student._id);
    const absentDocs = await Student.find({ _id: { $nin: seenIds } })
      .select('fullName schoolId section course year')
      .sort({ fullName: 1 });

    const b = buildBuckets(records, absentDocs);
    const totalStudents = await Student.countDocuments();

    res.json({
      records: records.map(r => {
        const c = categorize(r);
        return {
          _id: r._id, student: r.student, scannedAt: r.scannedAt,
          timeIn: c.timeIn, timeOut: c.timeOut, isLate: c.isLate, category: c.category,
        };
      }),
      presentStudents: b.present,
      lateStudents: b.late,
      unfinishedStudents: b.unfinished,
      absentStudents: b.absent,
      stats: {
        totalStudents,
        presentCount: b.present.length,
        lateCount: b.late.length,
        unfinishedCount: b.unfinished.length,
        absentCount: b.absent.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load attendance' });
  }
});

module.exports = router;
