# QR Attendance System

Admin-managed web app for registering students, generating a **signed QR
code** per student, and scanning attendance for one event/session at a
time. Students can now register themselves through a public link — no
admin data entry required for that step.

## Stack
- Node.js + Express (backend, REST API)
- MongoDB + Mongoose (data storage)
- Vanilla HTML/CSS/JS (frontend, no build step)
- `html5-qrcode` (browser webcam scanning, loaded via CDN)
- `qrcode` (server-side QR image generation)
- `jsonwebtoken` (signs each student's QR payload so it can't be forged/edited)
- `express-session` (admin login session)
- `multer` (photo upload, stored on disk)

## How it works
1. **Student self-registration** (`/join.html`, public, no login) — a
   student fills in their name, school ID, section, course, year, and
   uploads their own photo. On submit, the server signs a JWT containing
   their student ID and shows them a QR code immediately to save/download.
   If they lose it, the "Retrieve My QR" tab looks it up by School ID +
   full name.
2. **Admin registration** (`/register.html`, admin only) — the admin can
   still register students directly (e.g., for students without phones),
   and can copy the shareable self-registration link from the top of that
   page to send to students.
3. **Events**: create an event/session and mark it **Active**. Only one
   event can be active at a time.
4. **Scan**: open the Scan page, allow camera access, and scan each
   student's QR. The server verifies the signature (rejects tampered/fake
   codes), shows the student's photo and details for the admin to visually
   confirm, and only then records attendance **against the currently
   active event**. Re-scanning the same student in the same session is
   detected and flagged as a duplicate, not double-counted.
5. **Dashboard**: pick an event and see who's present, who's missing, and
   the full scan log with timestamps.

## Setup

```bash
npm install
cp .env.example .env
# edit .env: set MONGO_URI, SESSION_SECRET, QR_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD
```

You need a MongoDB instance running (local `mongod`, Docker, or a free
MongoDB Atlas cluster) and its connection string in `MONGO_URI`.

Start it:
```bash
npm start
# or, for auto-restart during development:
npm run dev
```

Then open **http://localhost:3000** (or your configured port) — you'll
land on the admin login page. Share **http://localhost:3000/join.html**
(or your deployed URL) with students for self-registration.

## Project structure
```
qr-attendance-system/
├── server.js              # app entry point
├── config/db.js           # MongoDB connection
├── middleware/auth.js     # session guard for admin routes
├── models/                # Student, Event, Attendance schemas
├── routes/                # auth, students, events, scan, attendance, public
├── utils/qrToken.js       # signs/verifies the QR payload
├── public/                # login, register, events, scan, dashboard, join (public)
└── uploads/students/      # uploaded student photos (served at /uploads/...)
```

## Security notes before deploying beyond a local classroom
- Change `SESSION_SECRET`, `QR_SECRET`, and `ADMIN_PASSWORD` in `.env` — the
  defaults are only placeholders.
- This demo compares the admin password as plain text from `.env`. For
  anything beyond local/trusted use, hash it (e.g. with `bcryptjs`, already
  a dependency) and compare the hash instead.
- Serve over HTTPS in production so the session cookie and camera access
  are secure (browsers also require HTTPS — or localhost — for webcam
  access).
- The QR code encodes a signed token, not the raw school ID, so someone
  can't hand-write or edit a QR to impersonate another student — but a
  screenshot of a legitimate student's QR is still just as scannable as the
  original. The admin's photo-verification step at scan time is the main
  safeguard against that.
- **Public self-registration trade-off:** since anyone with the `/join.html`
  link can submit a registration, there's no admin double-checking that the
  uploaded photo is genuinely that student *at registration time* — only
  later, at scan time. This is a reasonable trade-off for a school project,
  but if stricter control is needed, consider adding a shared access code
  or requiring admin approval of new self-registrations before they're
  scannable.
