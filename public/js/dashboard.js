document.getElementById('eventSelect').addEventListener('change', e => loadAttendance(e.target.value));
init();

async function init() {
  const res = await fetch('/api/events');
  const events = await res.json();
  const select = document.getElementById('eventSelect');
  select.innerHTML = '';

  if (events.length === 0) {
    select.innerHTML = '<option value="">No events yet</option>';
    return;
  }

  events.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev._id;
    opt.textContent = `${ev.name}${ev.isActive ? ' (Active)' : ''}`;
    select.appendChild(opt);
  });

  const active = events.find(ev => ev.isActive) || events[0];
  select.value = active._id;
  loadAttendance(active._id);
}

async function loadAttendance(eventId) {
  if (!eventId) return;
  const res = await fetch(`/api/attendance/${eventId}`);
  if (!res.ok) return;
  const data = await res.json();

  document.getElementById('statTotal').textContent = data.stats.totalStudents;
  document.getElementById('statPresent').textContent = data.stats.presentCount;
  document.getElementById('statAbsent').textContent = data.stats.absentCount;

  const tbody = document.querySelector('#attTable tbody');
  tbody.innerHTML = '';
  data.records.forEach(r => {
    if (!r.student) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.student.fullName)}</td>
      <td>${escapeHtml(r.student.schoolId)}</td>
      <td>${escapeHtml(r.student.section)}</td>
      <td>${escapeHtml(r.student.course)}</td>
      <td>${escapeHtml(r.student.year)}</td>
      <td>${new Date(r.scannedAt).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
