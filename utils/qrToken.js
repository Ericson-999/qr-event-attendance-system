const jwt = require('jsonwebtoken');

function getSecret() {
  return process.env.QR_SECRET || 'change_this_qr_secret';
}

function generateStudentToken(student) {
  return jwt.sign(
    { sid: student._id.toString(), schoolId: student.schoolId },
    getSecret(),
    { expiresIn: '2y' }
  );
}

function verifyStudentToken(token) {
  return jwt.verify(token, getSecret());
}

module.exports = { generateStudentToken, verifyStudentToken };
