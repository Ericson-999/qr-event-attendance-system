const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const Student = require('../models/Student');
const { generateStudentToken } = require('../utils/qrToken');

const router = express.Router();

// Reuses the same upload folder as the admin registration flow
const uploadDir = path.join(__dirname, '..', 'uploads', 'students');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const safeId = (req.body.schoolId || 'student').replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${safeId}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// Public self-registration — no admin login required.
// A photo is mandatory here (unlike the admin-side form) since there's no
// admin present to take one, and the scan-time verification step depends on it.
router.post('/register', upload.single('photo'), async (req, res) => {
  try {
    const { fullName, schoolId, section, course, year } = req.body;
    if (!fullName || !schoolId || !section || !course || !year) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'A photo is required so the admin can verify you at scan time' });
    }

    const existing = await Student.findOne({ schoolId });
    if (existing) {
      return res.status(409).json({
        error: 'This School ID is already registered. Use "Retrieve My QR" below instead.',
      });
    }

    const student = await Student.create({
      fullName,
      schoolId,
      section,
      course,
      year,
      photoPath: `/uploads/students/${req.file.filename}`,
    });

    const token = generateStudentToken(student);
    const qrDataUrl = await QRCode.toDataURL(token);

    res.status(201).json({ student, qrDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Lets a student retrieve their QR again if they lost it. Requires both
// School ID and full name to match, as a light deterrent against pulling
// up someone else's code with just a guessed/known ID.
router.post('/retrieve', async (req, res) => {
  try {
    const { schoolId, fullName } = req.body;
    if (!schoolId || !fullName) {
      return res.status(400).json({ error: 'School ID and full name are required' });
    }

    const student = await Student.findOne({ schoolId: schoolId.trim() });
    if (!student || student.fullName.trim().toLowerCase() !== fullName.trim().toLowerCase()) {
      return res.status(404).json({ error: 'No matching registration found. Check your details and try again.' });
    }

    const token = generateStudentToken(student);
    const qrDataUrl = await QRCode.toDataURL(token);

    res.json({ student, qrDataUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to retrieve QR code' });
  }
});

module.exports = router;
