let eventsById = {};
let stopId = null;
let timeId = null;

const $ = id => document.getElementById(id);

$('eventForm').addEventListener('submit', handleCreate);
$('eventsTable').addEventListener('click', handleTableClick);

$('stopCancelBtn').addEventListener('click', () => closeModal('stopModalBackdrop'));
$('stopConfirmBtn').addEventListener('click', confirmStop);
$('timeCancelBtn').addEventListener('click', () => closeModal('timeModalBackdrop'));
$('timeConfirmBtn').addEventListener('click', confirmAddTime);
document.querySelectorAll('#timeModalBackdrop [data-min]').forEach(b =>
  b.addEventListener('click', () => { $('customMinutes').value = b.dataset.min; })
);
['stopModalBackdrop', 'timeModalBackdrop'].forEach(id =>
  $(id).addEventListener('click', e => { if (e.target.id === id) closeModal(id); })
);

// default the date picker to today (Manila)
$('eventDate').value = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

loadEvents();
setInterval(loadEvents, 30000); // keeps the "past end time" status fresh

async function handleCreate(e) {
  e.preventDefault();
  const errorMsg = $('errorMsg');
  errorMsg.textContent = '';

  const body = {
    name: $('eventName').value.trim(),
    date: $('eventDate').value || undefined,
    startTime: $('startTime').value,
    endTime: $('endTime').value,
    lateAfterMinutes: $('lateAfter').value,
    minStayMinutes: $('minStay').value,
  };

  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      errorMsg.textContent = data.error || 'Failed to create event';
      return;
    }
    $('eventForm').reset();
    $('eventDate').value = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    $('lateAfter').value = 30;
    $('minStay').value = 10;
    loadEvents();
  } catch (err) {
    errorMsg.textContent = 'Could not reach server';
  }
}

function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
}

function statusPill(ev) {
  if (ev.state === 'waiting') return '<span class="pill waiting">Waiting</span>';
  if (ev.state === 'running') {
    return ev.isOvertime
      ? '<span class="pill overtime">Active - past end time</span>'
      : '<span class="pill active">Active</span>';
  }
  return '<span class="pill ended">Ended</span>';
}

function actionButtons(ev) {
  if (ev.state === 'waiting') {
    return `<button class="secondary" data-action="start" data-id="${ev._id}">Start</button>`;
  }
  if (ev.state === 'running') {
    const addBtn = ev.scheduledEnd
      ? `<button class="secondary" data-action="add-time" data-id="${ev._id}">+ Add time</button>`
      : '';
    return `<div class="row-actions">${addBtn}<button class="secondary" data-action="stop" data-id="${ev._id}">Stop</button></div>`;
  }
  return '<span style="color:var(--muted)">-</span>';
}

async function loadEvents() {
  const res = await fetch('/api/events');
  if (!res.ok) return;
  const events = await res.json();
  eventsById = {};
  const tbody = document.querySelector('#eventsTable tbody');
  tbody.innerHTML = '';
  events.forEach(ev => {
    eventsById[ev._id] = ev;
    const tr = document.createElement('tr');
    const dateStr = new Date(ev.date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' });
    let timeStr = '-';
    if (ev.scheduledStart && ev.scheduledEnd) {
      timeStr = `${fmtTime(ev.scheduledStart)} - ${fmtTime(ev.scheduledEnd)}`;
      if (ev.extraMinutes) timeStr += `<small>+${ev.extraMinutes} min added</small>`;
    }
    tr.innerHTML = `
      <td>${escapeHtml(ev.name)}</td>
      <td>${dateStr}</td>
      <td class="event-time">${timeStr}</td>
      <td>${statusPill(ev)}</td>
      <td>${actionButtons(ev)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function showActionError(msg) {
  $('actionMsg').textContent = msg || '';
}

async function handleTableClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const ev = eventsById[id];
  if (!ev) return;
  showActionError('');

  if (btn.dataset.action === 'start') {
    const r = await callPatch(`/api/events/${id}/start`);
    if (!r.ok) showActionError(r.error);
  } else if (btn.dataset.action === 'stop') {
    stopId = id;
    $('stopModalText').textContent = `Are you sure you want to stop "${ev.name}"?`;
    openModal('stopModalBackdrop');
  } else if (btn.dataset.action === 'add-time') {
    timeId = id;
    $('timeModalText').textContent = `"${ev.name}" currently ends at ${fmtTime(ev.scheduledEnd)}.`;
    $('customMinutes').value = 10;
    $('timeModalError').textContent = '';
    openModal('timeModalBackdrop');
  }
}

async function callPatch(url, body) {
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || 'Request failed' };
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: 'Could not reach server' };
  } finally {
    loadEvents();
  }
}

async function confirmStop() {
  if (!stopId) return;
  const r = await callPatch(`/api/events/${stopId}/stop`);
  closeModal('stopModalBackdrop');
  if (!r.ok) showActionError(r.error);
  stopId = null;
}

async function confirmAddTime() {
  if (!timeId) return;
  const minutes = Number($('customMinutes').value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    $('timeModalError').textContent = 'Enter a whole number from 1 to 240.';
    return;
  }
  const r = await callPatch(`/api/events/${timeId}/add-time`, { minutes });
  if (!r.ok) {
    $('timeModalError').textContent = r.error;
    return;
  }
  closeModal('timeModalBackdrop');
  timeId = null;
}

function openModal(id) { $(id).style.display = 'flex'; }
function closeModal(id) { $(id).style.display = 'none'; }

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
