// Helpers for event schedule + status. All typed times are Asia/Manila (UTC+8).
const TZ_OFFSET = '+08:00';

function todayManila() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }); // YYYY-MM-DD
}

function toManilaDate(dateStr, timeStr) {
  const d = new Date(`${dateStr}T${timeStr}:00${TZ_OFFSET}`);
  return isNaN(d.getTime()) ? null : d;
}

// waiting | running | ended  (old events have no status field)
function getState(ev) {
  if (ev.status) return ev.status;
  return ev.isActive ? 'running' : 'ended';
}

// Plain object for the browser, with the computed state.
function serialize(ev, now = new Date()) {
  const o = typeof ev.toObject === 'function' ? ev.toObject() : { ...ev };
  o.state = getState(o);
  o.isOvertime = o.state === 'running' && !!o.scheduledEnd && now > new Date(o.scheduledEnd);
  return o;
}

function intField(value, fallback, min, max, label) {
  if (value === undefined || value === null || value === '') return { value: fallback };
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    return { error: `${label} must be a whole number from ${min} to ${max}` };
  }
  return { value: n };
}

// Validates the "create event" form. Returns { error } or { value }.
function parseEventInput(body) {
  const name = String(body.name || '').trim();
  if (!name) return { error: 'Event name is required' };

  const dateStr = body.date ? String(body.date) : todayManila();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: 'Invalid date' };

  const startTime = String(body.startTime || '');
  const endTime = String(body.endTime || '');
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return { error: 'Start time and end time are required' };
  }
  const scheduledStart = toManilaDate(dateStr, startTime);
  const scheduledEnd = toManilaDate(dateStr, endTime);
  if (!scheduledStart || !scheduledEnd) return { error: 'Invalid date or time' };
  if (scheduledEnd <= scheduledStart) return { error: 'End time must be after the start time' };

  const late = intField(body.lateAfterMinutes, 30, 0, 600, 'Late after');
  if (late.error) return { error: late.error };
  const stay = intField(body.minStayMinutes, 10, 0, 600, 'Minimum stay');
  if (stay.error) return { error: stay.error };

  const durationMin = Math.round((scheduledEnd - scheduledStart) / 60000);
  if (stay.value > durationMin) return { error: 'Minimum stay cannot be longer than the event' };

  return {
    value: {
      name, date: scheduledStart, scheduledStart, scheduledEnd,
      lateAfterMinutes: late.value, minStayMinutes: stay.value,
    },
  };
}

module.exports = { todayManila, toManilaDate, getState, serialize, parseEventInput, intField };
