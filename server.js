require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const eventRoutes = require('./routes/events');
const scanRoutes = require('./routes/scan');
const attendanceRoutes = require('./routes/attendance');
const publicRoutes = require('./routes/public');

const app = express();

connectDB();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change_this_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 },
  })
);

// Serve uploaded student photos and the front-end
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Root just sends people to the login page
app.get('/', (req, res) => res.redirect('/login.html'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/attendance', require('./routes/attendanceExport'));
app.use('/api/attendance', attendanceRoutes);
app.use('/api/public', publicRoutes); // no login required — used by the self-registration page

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Something went wrong' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[server] Running at http://localhost:${PORT}`));
