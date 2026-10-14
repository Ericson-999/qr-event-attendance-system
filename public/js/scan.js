let html5QrCode = null;
let pendingToken = null;
let pendingMode = 'in';          // the mode that was active when the QR was scanned
let mode = 'in';                 // 'in' | 'out' (the admin's toggle)
let activeEvent = null;
let cameras = [];
let currentCamId = null;

const $ = id => document.getElementById(id);

try { if (sessionStorage.getItem('scanMode') === 'out') mode = 'out'; } catch (e) {}

init();

async function init() {
  $('modeInBtn').addEventListener('click', () => setMode('in'));
  $('modeOutBtn').addEventListener('click', () => setMode('out'));
  setMode(mode);

  await loadActiveEvent();

  html5QrCode = new Html5Qrcode('reader');

  $('approveBtn').addEventListener('click', approveScan);
  $('rejectBtn').addEventListener('click', rejectScan);

  // camera picker
  $('cameraSelect').addEventListener('change', onCameraChange);
  $('refreshCamBtn').addEventListener('click', () => loadCameras());
  $('flipToggle').checked = readPref('scanFlip') === '1';
  applyFlip();
  $('flipToggle').addEventListener('change', () => {
    writePref('scanFlip', $('flipToggle').checked ? '1' : '0');
    applyFlip();
  });
  // a phone-as-webcam app that connects later shows up without a page reload
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', () => loadCameras({ keepCurrent: true }));
  }

  await loadCameras();
}

// ---- camera helpers ----
function readPref(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
function writePref(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

function applyFlip() {
  $('reader').classList.toggle('flipped', $('flipToggle').checked);
}

// Saved choice first (by id, then by name), then a back/rear camera, then the first one.
function pickCamera(cameras) {
  const savedId = readPref('scanCamId');
  const savedLabel = readPref('scanCamLabel');
  return (savedId && cameras.find(c => c.id === savedId))
    || (savedLabel && cameras.find(c => c.label === savedLabel))
    || cameras.find(c => /back|rear/i.test(c.label))
    || cameras[0];
}

async function loadCameras(opts = {}) {
  const select = $('cameraSelect');
  try {
    cameras = await Html5Qrcode.getCameras();
  } catch (err) {
    select.innerHTML = '<option value="">No camera access</option>';
    logEntry('Camera access denied or unavailable.', 'dup');
    return;
  }
  if (!cameras || cameras.length === 0) {
    select.innerHTML = '<option value="">No camera found</option>';
    logEntry('No camera found on this device.', 'dup');
    return;
  }

  select.innerHTML = '';
  cameras.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.label || `Camera ${i + 1}`;
    select.appendChild(opt);
  });

  // on a device-change event keep what is already running if it is still there
  const stillThere = opts.keepCurrent && currentCamId && cameras.find(c => c.id === currentCamId);
  if (stillThere) {
    select.value = currentCamId;
    return;
  }
  const chosen = pickCamera(cameras);
  select.value = chosen.id;
  await startCamera(chosen.id);
}

async function stopCamera() {
  try {
    if (html5QrCode) {
      const st = html5QrCode.getState();
      if (st === Html5QrcodeScannerState.SCANNING || st === Html5QrcodeScannerState.PAUSED) {
        await html5QrCode.stop();
      }
    }
  } catch (err) {}
}

async function startCamera(id) {
  await stopCamera();
  try {
    await html5QrCode.start(id, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess);
    currentCamId = id;
  } catch (err) {
    currentCamId = null;
    logEntry('Could not start that camera. Pick another one or press Refresh.', 'dup');
  }
}

async function onCameraChange() {
  const select = $('cameraSelect');
  // switching is blocked while a student is being reviewed
  if (pendingToken) {
    if (currentCamId) select.value = currentCamId;
    logEntry('Finish the current review before switching cameras.', 'dup');
    return;
  }
  const id = select.value;
  if (!id) return;
  const cam = cameras.find(c => c.id === id);
  writePref('scanCamId', id);
  writePref('scanCamLabel', cam ? cam.label : '');
  await startCamera(id);
}

function setMode(next) {
  // the mode is locked while a student is being reviewed
  if (pendingToken) return;
  mode = next;
  try { sessionStorage.setItem('scanMode', mode); } catch (e) {}
  $('modeInBtn').className = mode === 'in' ? 'primary' : 'secondary';
  $('modeOutBtn').className = mode === 'out' ? 'primary' : 'secondary';
  $('modeLabel').textContent = mode === 'in'
    ? 'MODE: TIME IN - scans record when students arrive.'
    : 'MODE: TIME OUT - scans record when students leave.';
}

function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
}

async function loadActiveEvent() {
  const res = await fetch('/api/events/active');
  const event = await res.json();
  activeEvent = event;
  const label = $('activeEventLabel');
  if (!event) {
    label.textContent = 'No running event. Go to Events and press Start before scanning.';
    return;
  }
  let text = `Recording attendance for: ${event.name}`;
  if (event.startedAt) {
    const m = event.lateAfterMinutes == null ? 30 : event.lateAfterMinutes;
    const cutoff = new Date(new Date(event.startedAt).getTime() + m * 60000);
    text += ` | Late after ${fmtTime(cutoff)}`;
  }
  if (event.isOvertime) text += ' | Past scheduled end time';
  label.textContent = text;
}

async function onScanSuccess(decodedText) {
  if (pendingToken) return;

  pendingToken = decodedText;
  pendingMode = mode;
  await pauseCamera();

  try {
    const res = await fetch('/api/scan/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: decodedText, mode: pendingMode }),
    });
    const data = await res.json();

    if (!res.ok) {
      logEntry(data.error || 'Scan failed', 'dup');
      pendingToken = null;
      await resumeCamera();
      return;
    }

    showReviewPanel(data);
  } catch (err) {
    logEntry('Could not reach server', 'dup');
    pendingToken = null;
    await resumeCamera();
  }
}

function showReviewPanel(data) {
  const { student, canApprove, flagMessage, flagType } = data;
  const isOut = data.mode === 'out';

  $('reviewTitle').textContent = isOut ? 'Verify Student - TIME OUT' : 'Verify Student - TIME IN';
  $('reviewPhoto').src = student.photoPath || '';
  $('reviewPhoto').onerror = function () {
    this.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="%23eef1f7"/></svg>'
    );
  };
  $('reviewName').textContent = student.fullName;

  let meta = `
    <div class="row"><strong>School ID:</strong> ${escapeHtml(student.schoolId)}</div>
    <div class="row"><strong>Section:</strong> ${escapeHtml(student.section)}</div>
    <div class="row"><strong>Course:</strong> ${escapeHtml(student.course)}</div>
    <div class="row"><strong>Year:</strong> ${escapeHtml(student.year)}</div>
  `;
  if (isOut && data.timeIn) {
    meta += `<div class="row"><strong>Timed in:</strong> ${fmtTime(data.timeIn)}</div>`;
  }
  $('reviewMeta').innerHTML = meta;

  const flag = $('reviewFlag');
  const approveBtn = $('approveBtn');
  if (flagMessage) {
    flag.style.display = 'block';
    flag.textContent = flagMessage;
    flag.classList.toggle('flag-error', flagType === 'error');
  } else {
    flag.style.display = 'none';
    flag.classList.remove('flag-error');
  }

  if (canApprove) {
    approveBtn.textContent = isOut ? 'Approve & Time Out' : 'Approve & Time In';
    approveBtn.disabled = false;
  } else {
    approveBtn.textContent = 'Cannot approve';
    approveBtn.disabled = true;
  }

  $('reviewPanel').style.display = 'block';
}

function hideReviewPanel() {
  $('reviewPanel').style.display = 'none';
}

async function approveScan() {
  if (!pendingToken) return;
  const token = pendingToken;

  try {
    const res = await fetch('/api/scan/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, mode: pendingMode }),
    });
    const data = await res.json();

    if (!res.ok) {
      logEntry(data.error || 'Failed to record attendance', 'dup');
    } else if (!data.ok) {
      logEntry(data.message, 'dup');
    } else {
      logEntry(data.message, 'ok');
    }
  } catch (err) {
    logEntry('Could not reach server', 'dup');
  }

  closeReviewAndResume();
}

function rejectScan() {
  logEntry('Scan rejected by admin - not recorded.', 'rejected');
  closeReviewAndResume();
}

async function closeReviewAndResume() {
  hideReviewPanel();
  pendingToken = null;
  await resumeCamera();
}

async function pauseCamera() {
  try {
    if (html5QrCode && html5QrCode.getState() === Html5QrcodeScannerState.SCANNING) {
      await html5QrCode.pause(true);
    }
  } catch (err) {}
}

async function resumeCamera() {
  try {
    if (html5QrCode) await html5QrCode.resume();
  } catch (err) {}
}

function logEntry(text, cls) {
  const log = $('scanLog');
  const div = document.createElement('div');
  div.className = `entry ${cls}`;
  const time = new Date().toLocaleTimeString();
  div.textContent = `[${time}] ${text}`;
  log.prepend(div);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
