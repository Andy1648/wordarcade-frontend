// classReport.js — the FRENCH RUSH CLASS REPORT the teacher copies off the CLASS DONE console: plain
// text to paste into a gradebook or an email (date, the set, the class % correct, every word hardest
// first, per-student totals). Pure: the console passes the host's done snapshot (summary + students).
import { difficultiesFor } from '../runSpec.js';
import { withArticle } from '../speak.js';
import { formatNum } from '../../format.js';

// The CLASS REPORT: plain text for a gradebook or an email. Tab-separated tables, so a paste into a
// spreadsheet lands in columns and a paste into an email still lines up.
export function classReport({ snap, categories = [], modes = [], now = new Date() }) {
  const set = snap.set || {};
  const levels = difficultiesFor('fr');
  const themeLabel = set.theme ? (categories.find((c) => c.id === set.theme) || {}).label || set.theme : 'All themes';
  const levelLabel = (levels[set.level] || {}).label || set.level || '';
  const modeLabel = (modes.find((m) => m.id === set.mode) || {}).label || '';
  const words = (snap.summary || []).slice().sort((a, b) => b.miss - a.miss || b.hinted - a.hinted);
  const answered = words.reduce((n, r) => n + r.clean + r.hinted + r.miss, 0);
  const got = words.reduce((n, r) => n + r.clean + r.hinted, 0);
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
  let when = '';
  try {
    when = `${now.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}, ${now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  } catch {
    when = now.toString();
  }
  const students = (snap.students || []).slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const lines = [
    'FRENCH RUSH — CLASS REPORT',
    `Date: ${when}`,
    `Class: ${snap.code}${snap.round > 1 ? ` (set ${formatNum(snap.round)})` : ''}`,
    `Set: ${[themeLabel, levelLabel, `${formatNum(snap.total)} words`, modeLabel].filter(Boolean).join(' · ')}${set.replay ? ' · replay of the hardest' : ''}`,
    `Students: ${formatNum(students.length || snap.studentCount || 0)}`,
    `Class correct: ${pct(got, answered)} (got it + with hints)`,
    '',
    'WORDS (hardest first)',
    ['Word', 'Got it', 'With hints', 'Missed'].join('\t'),
    ...words.map((r) => [withArticle(r.word, ((snap.rows || [])[r.index] || {}).pos, ((snap.rows || [])[r.index] || {}).gender), r.clean, r.hinted, r.miss].join('\t')),
  ];
  if (students.length) {
    lines.push('', 'STUDENTS', ['Name', 'Got it', 'With hints', 'Missed', 'Correct', 'Hints used'].join('\t'));
    students.forEach((s) => {
      const tot = s.clean + s.hinted + s.miss;
      lines.push([s.name, s.clean, s.hinted, s.miss, pct(s.clean + s.hinted, tot), s.hints].join('\t'));
    });
  }
  return `${lines.join('\n')}\n`;
}
