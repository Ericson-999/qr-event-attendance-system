let html5QrCode = null;
let pendingToken = null;

init();

async function init() {
  await loadActiveEvent();

  html5QrCode = new Html5Qrcode('reader');
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  document.getElementById('approveBtn').addEventListener('click', approveScan);
  document.getElementById('rejectBtn').addEventListener('click', rejectScan);

  Html5Qrcode.getCameras()
    .then(cameras => {
      if (!cameras || cameras.length === 0) {
        logEntry('No camera found on this device.', 'dup');
        return;
      }
      const camId = (cameras.find(c => /back|rear/i.test(c.label)) || cameras[0]).id;
      html5QrCode.start(camId, config, onScanSuccess);
    })
    .catch(() => logEntry('Camera access denied or unavailable.', 'dup'));
}

async function loadActiveEvent() {
  const res = await fetch('/api/events/active');
  const event = await res.json();
  const label = document.getElementById('activeEventLabel');
  if (!event) {
    label.textContent = 'No active event. Go to Events and activate one before scanning.';
  } else {
    label.textContent = `Recording attendance for: ${event.name}`;
  }
}

async function onScanSuccess(decodedText) {
  if (pendingToken) return;

  pendingToken = decodedText;
  await pauseCamera();

  try {
    const res = await fetch('/api/scan/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: decodedText }),
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
  const { student, alreadyRecorded, recordedAt } = data;

  document.getElementById('reviewPhoto').src = student.photoPath || '';
  document.getElementById('reviewPhoto').onerror = function () {
    this.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="%23eef1f7"/></svg>'
    );
  };
  document.getElementById('reviewName').textContent = student.fullName;
  document.getElementById('reviewMeta').innerHTML = `
    <div class="row"><strong>School ID:</strong> ${escapeHtml(student.schoolId)}</div>
    <div class="row"><strong>Section:</strong> ${escapeHtml(student.section)}</div>
    <div class="row"><strong>Course:</strong> ${escapeHtml(student.course)}</div>
    <div class="row"><strong>Year:</strong> ${escapeHtml(student.year)}</div>
  `;

  const flag = document.getElementById('reviewFlag');
  const approveBtn = document.getElementById('approveBtn');
  if (alreadyRecorded) {
    flag.style.display = 'block';
    flag.textContent = `Already marked present at ${new Date(recordedAt).toLocaleTimeString()}`;
    approveBtn.textContent = 'Already Recorded';
    approveBtn.disabled = true;
  } else {
    flag.style.display = 'none';
    approveBtn.textContent = 'Approve & Mark Present';
    approveBtn.disabled = false;
  }

  document.getElementById('reviewPanel').style.display = 'block';
}

function hideReviewPanel() {
  document.getElementById('reviewPanel').style.display = 'none';
}

async function approveScan() {
  if (!pendingToken) return;
  const token = pendingToken;

  try {
    const res = await fetch('/api/scan/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();

    if (!res.ok) {
      logEntry(data.error || 'Failed to record attendance', 'dup');
    } else if (data.duplicate) {
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
  logEntry('Scan rejected by admin — not recorded.', 'rejected');
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
  const log = document.getElementById('scanLog');
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
