// ---------- Transcript export to PDF and CSV ----------

function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val);
  if (/^[=+\-@]/.test(s)) return "'" + s;
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function downloadTranscriptCsv(t) {
  const student = t.student || {};
  const totals = t.totals || {};
  const rows = [
    ['Student Name', escapeCsv(student.name)],
    ['Student ID', escapeCsv(student.student_code)],
    ['Campus', escapeCsv(student.campus)],
    [],
    ['Summary Metric', 'Value'],
    ['Club Days attended', escapeCsv(totals.club_days_attended ?? 0)],
    ['Submissions', escapeCsv(totals.submissions ?? 0)],
    ['Average score', escapeCsv(totals.average_score != null ? `${totals.average_score} / ${totals.max_score}` : '—')],
    ['Presentations', escapeCsv(totals.presentations ?? 0)],
    ['Events attended', escapeCsv(totals.events_attended ?? 0)],
    ['Certificates', escapeCsv(totals.certificates ?? 0)],
    [],
    ['Type', 'Activity / Event', 'Club / Campus', 'Date', 'Attendance', 'Submission', 'Score', 'Presentation / Team', 'Rank', 'Certificate']
  ];

  for (const cd of t.club_days || []) {
    const score = cd.score != null ? `${cd.score} / ${totals.max_score || 10}` : '';
    rows.push([
      'Club Day',
      escapeCsv(cd.title || cd.topic || 'Club Day'),
      escapeCsv(cd.club_name || ''),
      escapeCsv(cd.day_date || ''),
      escapeCsv(cd.attendance_count ? (cd.checked_in_late ? 'Attended (late)' : 'Attended') : 'Not checked in'),
      escapeCsv((cd.grading_status || '').replace('_', ' ')),
      escapeCsv(score),
      escapeCsv(cd.presentation_title || ''),
      '',
      escapeCsv(cd.certificate_status || '')
    ]);
  }

  for (const ev of t.events || []) {
    rows.push([
      'Event',
      escapeCsv(ev.name || ''),
      escapeCsv(ev.host_campus || ''),
      escapeCsv(ev.starts_at || ''),
      escapeCsv(ev.checked_in_at ? 'Checked in' : 'Registered'),
      '',
      '',
      escapeCsv(ev.team_name || ''),
      escapeCsv(ev.rank || ''),
      escapeCsv(ev.certificate_status || '')
    ]);
  }

  const csvContent = rows.map(r => r.join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `transcript-${student.student_code || student.id || 'student'}.csv`;
  triggerDownload(blob, filename);
}

function escapePdf(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function downloadTranscriptPdf(t) {
  const student = t.student || {};
  const totals = t.totals || {};

  // Build printable PDF lines
  const lines = [
    'MIRAI PROJECT - STUDENT ACTIVITY TRANSCRIPT',
    '========================================================================',
    `Name:        ${student.name || '—'}`,
    `Student ID:  ${student.student_code || student.id || '—'}`,
    `Campus:      ${student.campus || '—'}`,
    '------------------------------------------------------------------------',
    'SUMMARY TOTALS',
    `Club Days attended: ${totals.club_days_attended ?? 0}`,
    `Submissions:        ${totals.submissions ?? 0}`,
    `Average score:      ${totals.average_score != null ? `${totals.average_score} / ${totals.max_score}` : '—'}`,
    `Presentations:      ${totals.presentations ?? 0}`,
    `Events attended:    ${totals.events_attended ?? 0} (Registered: ${totals.events_registered ?? 0})`,
    `Certificates:       ${totals.certificates ?? 0}`,
    '------------------------------------------------------------------------',
    'CLUB DAYS ACTIVITY'
  ];

  if ((t.club_days || []).length === 0) {
    lines.push('  No Club Day activity recorded yet.');
  } else {
    for (const cd of t.club_days) {
      const act = cd.title || cd.topic || 'Club Day';
      const att = cd.attendance_count ? (cd.checked_in_late ? 'Attended (late)' : 'Attended') : 'Not checked in';
      const score = cd.score != null ? ` | Score: ${cd.score}/${totals.max_score || 10}` : '';
      lines.push(`* [${cd.day_date || '—'}] ${act} (${cd.club_name || ''})`);
      lines.push(`    Attendance: ${att} | Submission: ${cd.grading_status || 'none'}${score}`);
      if (cd.presentation_title) lines.push(`    Presentation: ${cd.presentation_title}`);
      if (cd.certificate_status) lines.push(`    Certificate: ${cd.certificate_status}`);
    }
  }

  lines.push('------------------------------------------------------------------------');
  lines.push('CAMPUS EVENTS');

  if ((t.events || []).length === 0) {
    lines.push('  No events recorded.');
  } else {
    for (const ev of t.events) {
      const att = ev.checked_in_at ? 'Checked in' : 'Registered';
      lines.push(`* [${ev.starts_at ? String(ev.starts_at).slice(0, 10) : '—'}] ${ev.name || 'Event'} (${ev.host_campus || ''})`);
      lines.push(`    Status: ${att}${ev.team_name ? ' | Team: ' + ev.team_name : ''}${ev.rank ? ' | Rank: ' + ev.rank : ''}`);
      if (ev.certificate_status) lines.push(`    Certificate: ${ev.certificate_status}`);
    }
  }

  lines.push('========================================================================');
  lines.push(`Generated: ${new Date().toISOString().slice(0, 10)} · Verified Record`);

  // Assemble valid PDF 1.4
  let content = 'BT /F1 9 Tf 40 800 Td 13 TL\n';
  for (const line of lines) {
    content += `(${escapePdf(line)}) Tj T*\n`;
  }
  content += 'ET';

  const streamLen = typeof Buffer !== 'undefined'
    ? Buffer.byteLength(content, 'utf8')
    : new TextEncoder().encode(content).length;

  let out = '%PDF-1.4\n';
  const offsets = [0];
  function add(str) {
    offsets.push(typeof Buffer !== 'undefined'
      ? Buffer.byteLength(out, 'utf8')
      : new TextEncoder().encode(out).length);
    out += str + '\n';
  }

  add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  add('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  add('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj');
  add('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj');
  add(`5 0 obj\n<< /Length ${streamLen} >>\nstream\n${content}\nendstream\nendobj`);

  const xrefOffset = typeof Buffer !== 'undefined'
    ? Buffer.byteLength(out, 'utf8')
    : new TextEncoder().encode(out).length;

  out += 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) {
    out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  out += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([out], { type: 'application/pdf' });
  const filename = `transcript-${student.student_code || student.id || 'student'}.pdf`;
  triggerDownload(blob, filename);
}

function triggerDownload(blob, filename) {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
