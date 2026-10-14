const express = require('express');
const Student = require('../models/Student');
const Event = require('../models/Event');
const Attendance = require('../models/Attendance');
const requireAuth = require('../middleware/auth');
const { verifyStudentToken } = require('../utils/qrToken');
const { serialize } = require('../utils/eventTime');
const { evaluateScan, fmtManila } = require('../utils/attendanceRules');

const router = express.Router();

const NO_RUNNING = 'No running event. Go to Events and press Start first.';

// Shared by lookup + confirm so both apply exactly the same checks.
async function prepare(req) {
  const { token } = req.body || {};
  const mode = req.body && req.body.mode === 'out' ? 'out' : 'in';
  if (!token) return { status: 400, error: 'No QR token provided' };

  let payload;
  try {
    payload = verifyStudentToken(token);
  } catch (err) {
    return { status: 400, error: 'Invalid or tampered QR code' };
  }

  const student = await Student.findById(payload.sid);
  if (!student) return { status: 404, error: 'Student not found for this QR code' };

  const event = await Event.findOne({ isActive: true });
  if (!event) return { status: 400, error: NO_RUNNING };

  const record = await Attendance.findOne({ student: student._id, event: event._id });
  const verdict = evaluateScan({ name: student.fullName, event, record, mode });
  return { student, event, record, mode, verdict };
}

// Step 1: look the student up. Nothing is written.
router.post('/lookup', requireAuth, async (req, res) => {
  try {
    const p = await prepare(req);
    if (p.error) return res.status(p.status).json({ error: p.error });
    const { student, event, record, mode, verdict } = p;

    res.json({
      student,
      event: serialize(event),
      mode,
      canApprove: verdict.ok,
      action: verdict.action,
      flagType: verdict.flagType,
      flagMessage: verdict.message,
      willBeLate: !!verdict.isLate,
      timeIn: record ? (record.timeIn || record.scannedAt) : null,
      timeOut: record ? record.timeOut || null : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to look up QR code' });
  }
});

// Step 2: the admin approved. Re-check everything, then write.
router.post('/confirm', requireAuth, async (req, res) => {
  try {
    const p = await prepare(req);
    if (p.error) return res.status(p.status).json({ error: p.error });
    const { student, event, record, verdict } = p;

    if (!verdict.ok) {
      return res.status(200).json({ ok: false, message: verdict.message, student, event: serialize(event) });
    }

    const now = new Date();
    if (verdict.action === 'time-in') {
      let created;
      try {
        created = await Attendance.create({
          student: student._id, event: event._id,
          timeIn: now, scannedAt: now, isLate: !!verdict.isLate,
        });
      } catch (err) {
        if (err && err.code === 11000) {
          return res.status(200).json({ ok: false, message: `${student.fullName} already timed in.`, student, event: serialize(event) });
        }
        throw err;
      }
      return res.status(201).json({
        ok: true, action: 'time-in', isLate: !!verdict.isLate,
        message: verdict.isLate
          ? `${student.fullName} timed in LATE at ${fmtManila(now)}.`
          : `${student.fullName} timed in at ${fmtManila(now)}.`,
        student, event: serialize(event), record: created,
      });
    }

    // time-out
    record.timeOut = now;
    await record.save();
    return res.status(200).json({
      ok: true, action: 'time-out', isLate: !!record.isLate,
      message: `${student.fullName} timed out at ${fmtManila(now)}.`,
      student, event: serialize(event), record,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

module.exports = router;
