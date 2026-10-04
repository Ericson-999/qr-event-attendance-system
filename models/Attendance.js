const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    scannedAt: { type: Date, default: Date.now },
    status: { type: String, default: 'present' },
  },
  { timestamps: true }
);

AttendanceSchema.index({ student: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
