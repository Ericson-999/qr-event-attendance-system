// Adds a "Download Word (.docx)" button to the breakdown modal
// (Present / Late / Unfinished / Absent). Load it AFTER dashboard.js.
(function () {
  const modal = document.getElementById('breakdownModalBackdrop');
  const closeBtn = document.getElementById('closeBreakdownBtn');
  if (!modal || !closeBtn) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'downloadDocBtn';
  btn.className = closeBtn.className;   // same theme style as the Close button
  btn.textContent = '⬇ Download Word (.docx)';
  closeBtn.parentNode.insertBefore(btn, closeBtn);

  function state() {
    const s = window.__breakdown || {};
    const eventSel = document.getElementById('eventSelect');
    const title = (modal.querySelector('h2, h3, .modal-title') || {}).textContent || '';
    let guess = 'present';
    if (/absent/i.test(title)) guess = 'absent';
    else if (/late/i.test(title)) guess = 'late';
    else if (/unfinished/i.test(title)) guess = 'unfinished';
    return {
      eventId: s.eventId || (eventSel && eventSel.value),
      type: s.type || guess,
    };
  }

  btn.addEventListener('click', async () => {
    const { eventId, type } = state();
    if (!eventId) { alert('Please select an event first.'); return; }
    const qs = new URLSearchParams({ type });
    ['Course', 'Section', 'Year'].forEach((k) => {
      const el = document.getElementById('filter' + k);
      if (el && el.value) qs.set(k.toLowerCase(), el.value);
    });
    const old = btn.textContent;
    btn.disabled = true; btn.textContent = 'Preparing...';
    try {
      const res = await fetch(`/api/attendance/${eventId}/export?${qs}`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Download failed');
      const blob = await res.blob();
      const m = /filename="?([^"]+)"?/.exec(res.headers.get('Content-Disposition') || '');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = m ? m[1] : `${type}_list.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      alert(e.message);
    } finally {
      btn.disabled = false; btn.textContent = old;
    }
  });
})();
