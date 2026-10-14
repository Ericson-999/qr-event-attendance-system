// GET /api/attendance/:eventId/export?type=present|late|unfinished|absent&course=&section=&year=
// Mount this BEFORE the existing attendance router in server.js.
const express = require('express');
const router = express.Router();
const authMod = require('../middleware/auth');
const requireAuth = typeof authMod === 'function' ? authMod : authMod.requireAuth;
const Event = require('../models/Event');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const { buildBuckets } = require('../utils/attendanceRules');
const { buildAttendanceDoc } = require('../utils/attendanceDoc');

const TYPES = ['present', 'late', 'unfinished', 'absent'];
const clean = (v) => (v == null ? '' : String(v).trim());
const slug = (s) => clean(s).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'event';

router.get('/:eventId/export', requireAuth, async (req, res) => {
  try {
    const type = TYPES.includes(req.query.type) ? req.query.type : 'present';
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const all = await Attendance.find({ event: event._id }).populate('student');
    const records = all.filter(r => r.student);
    const absentDocs = await Student.find({ _id: { $nin: records.map(r => r.student._id) } });
    let students = buildBuckets(records, absentDocs)[type];

    const filters = { course: clean(req.query.course), section: clean(req.query.section), year: clean(req.query.year) };
    students = students.filter((s) =>
      (!filters.course || clean(s.course) === filters.course) &&
      (!filters.section || clean(s.section) === filters.section) &&
      (!filters.year || clean(s.year) === filters.year));

    const buf = await buildAttendanceDoc({
      eventName: event.name, eventDate: event.date, type, filters, students,
    });
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${type}_${slug(event.name)}.docx"`,
    });
    res.send(buf);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to generate document' });
  }
});

module.exports = router;
