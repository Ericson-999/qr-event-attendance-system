// All the attendance rules in one place (used by the scan, dashboard and Word export).
//
//  Present    = time-in on time + time-out
//  Late       = time-in after the late cutoff + time-out
//  Unfinished = time-in but no time-out (has an isLate tag)
//  Absent     = never timed in
//  Records saved before this update have no timeIn: they count as Present.

const DEFAULT_LATE_MINUTES = 30;

function fmtManila(d) {
  return new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
}

// Late cutoff = the moment the admin pressed Start + "late after" minutes.
function lateCutoff(event) {
  if (!event || !event.startedAt) return null;
  const m = event.lateAfterMinutes == null ? DEFAULT_LATE_MINUTES : event.lateAfterMinutes;
  return new Date(new Date(event.startedAt).getTime() + m * 60000);
}

function isLateAt(event, when) {
  const cutoff = lateCutoff(event);
  return !!cutoff && new Date(when) > cutoff;
}

function categorize(record) {
  if (!record.timeIn) {
    return { category: 'present', legacy: true, timeIn: record.scannedAt, timeOut: null, isLate: false };
  }
  const isLate = !!record.isLate;
  if (!record.timeOut) return { category: 'unfinished', legacy: false, timeIn: record.timeIn, timeOut: null, isLate };
  return { category: isLate ? 'late' : 'present', legacy: false, timeIn: record.timeIn, timeOut: record.timeOut, isLate };
}

/**
 * Decides what a scan may do. Pure function, no database.
 * @returns {{ok:boolean, action:'time-in'|'time-out'|null, code:string, message:string,
 *            flagType:'error'|'warn'|null, isLate?:boolean}}
 */
function evaluateScan({ name, event, record, mode, now = new Date() }) {
  if (mode === 'out') {
    if (!record) {
      return { ok: false, action: null, code: 'no-time-in', flagType: 'error',
        message: `${name} has no time-in for this event, so they cannot time out.` };
    }
    if (!record.timeIn) {
      return { ok: false, action: null, code: 'legacy', flagType: 'warn',
        message: `${name} was recorded before time-out tracking. No time-out needed.` };
    }
    if (record.timeOut) {
      return { ok: false, action: null, code: 'already-out', flagType: 'warn',
        message: `${name} already timed out at ${fmtManila(record.timeOut)}.` };
    }
    const minStay = event.minStayMinutes || 0;
    const elapsedMs = new Date(now) - new Date(record.timeIn);
    if (elapsedMs < minStay * 60000) {
      const left = Math.ceil((minStay * 60000 - elapsedMs) / 60000);
      return { ok: false, action: null, code: 'too-soon', flagType: 'error',
        message: `${name} timed in at ${fmtManila(record.timeIn)}. Minimum stay is ${minStay} min, so time-out opens in ${left} min.` };
    }
    return { ok: true, action: 'time-out', code: 'ok', flagType: null, message: '' };
  }

  // mode === 'in'
  if (record) {
    const at = record.timeIn || record.scannedAt;
    return { ok: false, action: null, code: 'already-in', flagType: 'warn',
      message: `${name} already timed in at ${fmtManila(at)}.` };
  }
  const late = isLateAt(event, now);
  const cutoff = lateCutoff(event);
  return {
    ok: true, action: 'time-in', code: 'ok', isLate: late,
    flagType: late ? 'warn' : null,
    message: late ? `This will be marked LATE (cutoff was ${fmtManila(cutoff)}).` : '',
  };
}

function plainStudent(s, extra) {
  return {
    _id: s._id, fullName: s.fullName, schoolId: s.schoolId,
    section: s.section, course: s.course, year: s.year, ...extra,
  };
}

/**
 * @param records  Attendance docs with `student` populated (students that exist)
 * @param absentStudents  Student docs with no record for the event
 */
function buildBuckets(records, absentStudents) {
  const out = { present: [], late: [], unfinished: [], absent: [] };
  for (const r of records) {
    if (!r.student) continue;
    const c = categorize(r);
    out[c.category].push(plainStudent(r.student, {
      timeIn: c.timeIn, timeOut: c.timeOut, isLate: c.isLate, scannedAt: c.timeIn,
    }));
  }
  out.absent = absentStudents.map(s => plainStudent(s, {}));
  return out;
}

module.exports = { DEFAULT_LATE_MINUTES, fmtManila, lateCutoff, isLateAt, categorize, evaluateScan, buildBuckets };
