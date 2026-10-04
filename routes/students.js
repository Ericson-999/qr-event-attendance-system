const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const QRCode = require('qrcode');
const Student = require('../models/Student');
const requireAuth = require('../middleware/auth');
const { generateStudentToken } = require('../utils/qrToken');

const router = express.Router();

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

router.post('/', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const { fullName, schoolId, section, course, year } = req.body;
    if (!fullName || !schoolId || !section || !course || !year) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = await Student.findOne({ schoolId });
    if (existing) {
      return res.status(409).json({ error: 'A student with this School ID already exists' });
    }

    const student = await Student.create({
      fullName, schoolId, section, course, year,
      photoPath: req.file ? `/uploads/students/${req.file.filename}` : null,
    });

    const token = generateStudentToken(student);
    const qrDataUrl = await QRCode.toDataURL(token);

    res.status(201).json({ student, qrDataUrl, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register student' });
  }
});

router.get('/', requireAuth, async (req, res) => {
  const students = await Student.find().sort({ createdAt: -1 });
  res.json(students);
});

router.get('/:id', requireAuth, async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
});

router.put('/:id', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const { fullName, schoolId, section, course, year } = req.body;
    if (!fullName || !schoolId || !section || !course || !year) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    if (schoolId !== student.schoolId) {
      const existing = await Student.findOne({ schoolId });
      if (existing) {
        return res.status(409).json({ error: 'A student with this School ID already exists' });
      }
    }

    const oldPhotoPath = student.photoPath;

    student.fullName = fullName;
    student.schoolId = schoolId;
    student.section = section;
    student.course = course;
    student.year = year;
    if (req.file) {
      student.photoPath = `/uploads/students/${req.file.filename}`;
    }
    await student.save();

    if (req.file && oldPhotoPath) {
      const oldFile = path.join(__dirname, '..', oldPhotoPath);
      fs.unlink(oldFile, () => {});
    }

    const token = generateStudentToken(student);
    const qrDataUrl = await QRCode.toDataURL(token);

    res.json({ student, qrDataUrl, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

router.get('/:id/qr', requireAuth, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const token = generateStudentToken(student);
    const qrDataUrl = await QRCode.toDataURL(token);
    res.json({ qrDataUrl, token });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  const student = await Student.findByIdAndDelete(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  if (student.photoPath) {
    const filePath = path.join(__dirname, '..', student.photoPath);
    fs.unlink(filePath, () => {});
  }

  res.json({ success: true });
});

module.exports = router;
