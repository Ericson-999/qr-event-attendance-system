document.getElementById('eventForm').addEventListener('submit', handleCreate);
loadEvents();

async function handleCreate(e) {
  e.preventDefault();
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = '';

  const name = document.getElementById('eventName').value.trim();
  const date = document.getElementById('eventDate').value;

  try {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, date: date || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      errorMsg.textContent = data.error || 'Failed to create event';
      return;
    }
    document.getElementById('eventForm').reset();
    loadEvents();
  } catch (err) {
    errorMsg.textContent = 'Could not reach server';
  }
}

async function loadEvents() {
  const res = await fetch('/api/events');
  if (!res.ok) return;
  const events = await res.json();
  const tbody = document.querySelector('#eventsTable tbody');
  tbody.innerHTML = '';
  events.forEach(ev => {
    const tr = document.createElement('tr');
    const dateStr = new Date(ev.date).toLocaleDateString();
    tr.innerHTML = `
      <td>${escapeHtml(ev.name)}</td>
      <td>${dateStr}</td>
      <td><span class="pill ${ev.isActive ? 'active' : 'inactive'}">${ev.isActive ? 'Active' : 'Inactive'}</span></td>
      <td>
        ${ev.isActive
          ? `<button class="secondary" onclick="deactivate('${ev._id}')">Deactivate</button>`
          : `<button class="secondary" onclick="activate('${ev._id}')">Activate</button>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function activate(id) {
  await fetch(`/api/events/${id}/activate`, { method: 'PATCH' });
  loadEvents();
}

async function deactivate(id) {
  await fetch(`/api/events/${id}/deactivate`, { method: 'PATCH' });
  loadEvents();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
