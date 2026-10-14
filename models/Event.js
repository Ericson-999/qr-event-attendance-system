const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, default: Date.now },

    // Old flag, kept in sync with status (true only while the event is running)
    // so the scan page and older code keep working.
    isActive: { type: Boolean, default: false },

    // 'waiting' -> 'running' -> 'ended'.
    // No default on purpose: events created before this update have no status,
    // and are treated as running (if isActive) or ended (see utils/eventTime.js).
    status: { type: String, enum: ['waiting', 'running', 'ended'] },

    // Schedule typed by the admin (Asia/Manila time)
    scheduledStart: { type: Date },
    scheduledEnd: { type: Date },      // moves later when "Add time" is used
    extraMinutes: { type: Number, default: 0 },

    // Rules used by the time-in / time-out feature (next part)
    lateAfterMinutes: { type: Number, default: 30 },
    minStayMinutes: { type: Number, default: 10 },

    // Real moments the admin pressed Start / Stop
    startedAt: { type: Date },
    stoppedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', EventSchema);
