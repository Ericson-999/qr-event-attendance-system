const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, TableLayoutType,
} = require('docx');

const FULL = 9360;
const TITLES = {
  present: 'LIST OF PRESENT STUDENTS',
  late: 'LIST OF LATE STUDENTS',
  unfinished: 'LIST OF UNFINISHED STUDENTS (NO TIME-OUT)',
  absent: 'LIST OF ABSENT STUDENTS',
}; // US Letter, 1" margins, in DXA
const border = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const borders = { top: border, bottom: border, left: border, right: border };

function ordinal(n) {
  const v = parseInt(n, 10);
  if (isNaN(v)) return String(n || '');
  const s = ['th', 'st', 'nd', 'rd'], m = v % 100;
  return v + (s[(m - 20) % 10] || s[m] || s[0]);
}

function groupTitle(g) {
  return `${g.course || 'No Course'} - Section ${g.section || '-'} - ${ordinal(g.year) || '-'} Year (${g.rows.length})`;
}

function cell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: opts.header ? { fill: 'E8E8E8', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text ?? ''), bold: !!opts.header, size: 20 })],
    })],
  });
}

const COLS = {
  present:    { widths: [500, 3300, 1600, 1980, 1980], heads: ['#', 'Full Name', 'School ID', 'Time In', 'Time Out'] },
  late:       { widths: [500, 3300, 1600, 1980, 1980], heads: ['#', 'Full Name', 'School ID', 'Time In', 'Time Out'] },
  unfinished: { widths: [500, 3560, 1700, 2200, 1400], heads: ['#', 'Full Name', 'School ID', 'Time In', 'Late?'] },
  absent:     { widths: [600, 5760, 3000],             heads: ['#', 'Full Name', 'School ID'] },
};

function fmtTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' });
}

function rowCells(r, idx, type) {
  const base = [idx + 1, r.fullName, r.schoolId];
  if (type === 'present' || type === 'late') return [...base, fmtTime(r.timeIn), fmtTime(r.timeOut)];
  if (type === 'unfinished') return [...base, fmtTime(r.timeIn), r.isLate ? 'Yes' : 'No'];
  return base;
}

function buildTable(rows, type) {
  const { widths, heads } = COLS[type];
  const head = new TableRow({
    tableHeader: true,
    children: heads.map((h, i) => cell(h, widths[i], { header: true, center: i === 0 })),
  });
  const body = rows.map((r, idx) => new TableRow({
    cantSplit: true,
    children: rowCells(r, idx, type).map((v, i) => cell(v, widths[i], { center: i === 0 })),
  }));
  return new Table({
    width: { size: FULL, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [head, ...body],
  });
}

/**
 * @param {{eventName:string, eventDate:Date|string, type:'present'|'late'|'unfinished'|'absent',
 *          filters:{course?:string,section?:string,year?:string}, students:Array}} o
 */
async function buildAttendanceDoc(o) {
  const f = o.filters || {};
  const filterText = [
    f.course ? `Course: ${f.course}` : null,
    f.section ? `Section: ${f.section}` : null,
    f.year ? `Year: ${ordinal(f.year)}` : null,
  ].filter(Boolean).join('  |  ') || 'All courses, sections and years';

  // group by course / section / year
  const map = new Map();
  for (const s of o.students) {
    const key = [s.course, s.section, s.year].join('||');
    if (!map.has(key)) map.set(key, { course: s.course, section: s.section, year: s.year, rows: [] });
    map.get(key).rows.push(s);
  }
  const groups = [...map.values()].sort((a, b) =>
    String(a.course).localeCompare(String(b.course)) ||
    String(a.section).localeCompare(String(b.section)) ||
    String(a.year).localeCompare(String(b.year), undefined, { numeric: true }));
  groups.forEach((g) => g.rows.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName))));

  const dateStr = o.eventDate ? new Date(o.eventDate).toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' }) : '';
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
      children: [new TextRun({ text: TITLES[o.type] || 'LIST OF STUDENTS', bold: true, size: 30 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
      children: [new TextRun({ text: `Event: ${o.eventName}`, bold: true, size: 24 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
      children: [new TextRun({ text: `Date: ${dateStr}`, size: 22 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
      children: [new TextRun({ text: filterText, size: 20, color: '555555' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
      children: [new TextRun({ text: `Total: ${o.students.length}`, bold: true, size: 22 })] }),
  ];

  if (!groups.length) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'No students match the selected filters.', italics: true, size: 22 })] }));
  }
  for (const g of groups) {
    children.push(new Paragraph({ keepNext: true, spacing: { before: 240, after: 100 },
      children: [new TextRun({ text: groupTitle(g), bold: true, size: 24 })] }));
    children.push(buildTable(g.rows, o.type));
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}

module.exports = { buildAttendanceDoc };
