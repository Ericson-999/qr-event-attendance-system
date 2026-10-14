// Lists for the selected event. Present = in + out, Late = late in + out,
// Unfinished = in but no out, Absent = never timed in.
let currentLists = { present: [], late: [], unfinished: [], absent: [] };
let activeBreakdownType = null; // 'present' | 'late' | 'unfinished' | 'absent'

const BREAKDOWN_TITLES = {
  present: 'Present Students',
  late: 'Late Students',
  unfinished: 'Unfinished Students (no time-out)',
  absent: 'Absent Students',
};

document.getElementById('eventSelect').addEventListener('change', e => loadAttendance(e.target.value));
document.getElementById('statTotalBox').addEventListener('click', goToRegisteredStudents);
document.getElementById('statPresentBox').addEventListener('click', () => openBreakdown('present'));
document.getElementById('statLateBox').addEventListener('click', () => openBreakdown('late'));
document.getElementById('statUnfinishedBox').addEventListener('click', () => openBreakdown('unfinished'));
document.getElementById('statAbsentBox').addEventListener('click', () => openBreakdown('absent'));
document.getElementById('closeBreakdownBtn').addEventListener('click', closeBreakdown);
document.getElementById('breakdownModalBackdrop').addEventListener('click', e => {
  if (e.target.id === 'breakdownModalBackdrop') closeBreakdown();
});
['filterCourse', 'filterSection', 'filterYear'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderBreakdownList);
});

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
    const tag = ev.state === 'running' ? ' (Active)' : ev.state === 'waiting' ? ' (Waiting)' : '';
    opt.textContent = `${ev.name}${tag}`;
    select.appendChild(opt);
  });

  const active = events.find(ev => ev.state === 'running') || events[0];
  select.value = active._id;
  loadAttendance(active._id);
}

function fmtTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
}

async function loadAttendance(eventId) {
  if (!eventId) return;
  const res = await fetch(`/api/attendance/${eventId}`);
  if (!res.ok) return;
  const data = await res.json();

  currentLists = {
    present: data.presentStudents || [],
    late: data.lateStudents || [],
    unfinished: data.unfinishedStudents || [],
    absent: data.absentStudents || [],
  };

  document.getElementById('statTotal').textContent = data.stats.totalStudents;
  document.getElementById('statPresent').textContent = data.stats.presentCount;
  document.getElementById('statLate').textContent = data.stats.lateCount;
  document.getElementById('statUnfinished').textContent = data.stats.unfinishedCount;
  document.getElementById('statAbsent').textContent = data.stats.absentCount;

  const tbody = document.querySelector('#attTable tbody');
  tbody.innerHTML = '';
  data.records.forEach(r => {
    if (!r.student) return;
    const label = r.category === 'late' ? 'Late'
      : r.category === 'unfinished' ? (r.isLate ? 'Unfinished (late)' : 'Unfinished')
      : 'Present';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.student.fullName)}</td>
      <td>${escapeHtml(r.student.schoolId)}</td>
      <td>${escapeHtml(r.student.section)}</td>
      <td>${escapeHtml(r.student.course)}</td>
      <td>${escapeHtml(r.student.year)}</td>
      <td>${fmtTime(r.timeIn)}</td>
      <td>${fmtTime(r.timeOut)}</td>
      <td>${label}</td>
    `;
    tbody.appendChild(tr);
  });
}

function goToRegisteredStudents() {
  window.location.href = '/register.html#studentsTable';
}

// --- Breakdown modal ---
function openBreakdown(type) {
  window.__breakdown = { type: type, eventId: document.getElementById('eventSelect').value };
  activeBreakdownType = type;
  const list = currentLists[type] || [];

  document.getElementById('breakdownTitle').textContent = BREAKDOWN_TITLES[type];

  populateFilterOptions(list);
  renderBreakdownList();
  document.getElementById('breakdownModalBackdrop').style.display = 'flex';
}

function closeBreakdown() {
  document.getElementById('breakdownModalBackdrop').style.display = 'none';
}

function populateFilterOptions(list) {
  const courses = [...new Set(list.map(s => s.course))].sort();
  const sections = [...new Set(list.map(s => s.section))].sort();
  const years = [...new Set(list.map(s => s.year))].sort();

  fillSelect('filterCourse', courses, 'All Courses');
  fillSelect('filterSection', sections, 'All Sections');
  fillSelect('filterYear', years, 'All Years', y => `${y}${ordinalSuffix(y)} Year`);
}

function fillSelect(id, values, allLabel, labelFn) {
  const select = document.getElementById(id);
  const previousValue = select.value;
  select.innerHTML = `<option value="">${allLabel}</option>`;
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = labelFn ? labelFn(v) : v;
    select.appendChild(opt);
  });
  // keep the previous selection if it's still a valid option for this list
  if (values.includes(previousValue)) select.value = previousValue;
}

function renderBreakdownList() {
  const list = currentLists[activeBreakdownType] || [];
  const courseFilter = document.getElementById('filterCourse').value;
  const sectionFilter = document.getElementById('filterSection').value;
  const yearFilter = document.getElementById('filterYear').value;

  const filtered = list.filter(s =>
    (!courseFilter || s.course === courseFilter) &&
    (!sectionFilter || s.section === sectionFilter) &&
    (!yearFilter || s.year === yearFilter)
  );

  const container = document.getElementById('breakdownList');
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<div class="attendance-empty">No students match this filter.</div>';
    return;
  }

  // Group by course + section + year so results read like "BSCS - Section A - 1st Year"
  const groups = {};
  filtered.forEach(s => {
    const key = `${s.course}||${s.section}||${s.year}`;
    if (!groups[key]) groups[key] = { course: s.course, section: s.section, year: s.year, students: [] };
    groups[key].students.push(s);
  });

  const showTimes = activeBreakdownType !== 'absent';

  Object.values(groups)
    .sort((a, b) => (a.course + a.section + a.year).localeCompare(b.course + b.section + b.year))
    .forEach(group => {
      const groupEl = document.createElement('div');
      groupEl.className = 'attendance-group';
      groupEl.innerHTML = `<div class="attendance-group-title">${escapeHtml(group.course)} - Section ${escapeHtml(group.section)} - ${escapeHtml(group.year)}${ordinalSuffix(group.year)} Year (${group.students.length})</div>`;

      group.students
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
        .forEach(s => {
          const row = document.createElement('div');
          row.className = 'attendance-row';
          let times = '';
          if (showTimes) {
            times = activeBreakdownType === 'unfinished'
              ? `In ${fmtTime(s.timeIn)}`
              : `In ${fmtTime(s.timeIn)} | Out ${fmtTime(s.timeOut)}`;
          }
          const lateTag = activeBreakdownType === 'unfinished' && s.isLate ? '<span class="tag-late">LATE</span>' : '';
          row.innerHTML = `
            <span class="name">${escapeHtml(s.fullName)}${lateTag}</span>
            <span class="meta">${escapeHtml(s.schoolId)}</span>
            ${showTimes ? `<span class="times">${times}</span>` : ''}
          `;
          groupEl.appendChild(row);
        });

      container.appendChild(groupEl);
    });
}

function ordinalSuffix(n) {
  const num = parseInt(n, 10);
  if (isNaN(num)) return '';
  if (num === 1) return 'st';
  if (num === 2) return 'nd';
  if (num === 3) return 'rd';
  return 'th';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
