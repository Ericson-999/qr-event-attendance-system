const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },

    // Time-in / time-out (set by the scan page's IN / OUT mode)
    timeIn: { type: Date },
    timeOut: { type: Date },
    isLate: { type: Boolean, default: false }, // frozen at time-in

    // Kept for older records and older code. For new records scannedAt = timeIn.
    scannedAt: { type: Date, default: Date.now },
    status: { type: String, default: 'present' },
  },
  { timestamps: true }
);

AttendanceSchema.index({ student: 1, event: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
