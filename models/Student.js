const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    schoolId: { type: String, required: true, unique: true, trim: true },
    section: { type: String, required: true, trim: true },
    course: { type: String, required: true, trim: true },
    year: { type: String, required: true, trim: true },
    photoPath: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Student', StudentSchema);
