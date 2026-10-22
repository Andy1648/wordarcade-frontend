import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { qrMatrix, qrPath } from './qr.js';
import { classReport } from './classReport.js';

// The encoder was checked end-to-end against a real decoder (jsQR: 34 strings, versions 1–10, UTF-8)
// when it was written; these pin the structure so a refactor that breaks it fails here.
describe('qr', () => {
  const finderAt = (m, x0, y0) => {
    for (let y = 0; y < 7; y += 1)
      for (let x = 0; x < 7; x += 1) {
        const d = Math.max(Math.abs(x - 3), Math.abs(y - 3));
        if (m[y0 + y][x0 + x] !== (d !== 2)) return false;
      }
    return true;
  };

  it('picks the smallest version and draws the three finders', () => {
    const cases = [
      ['https://typeaword.com/french-rush?class=K7P2QX', 4], // 46 bytes → version 4 (33×33) at level M
      ['A', 1],
      ['x'.repeat(200), 10],
    ];
    for (const [text, ver] of cases) {
      const m = qrMatrix(text);
      const size = ver * 4 + 17;
      assert.equal(m.length, size);
      assert.equal(finderAt(m, 0, 0) && finderAt(m, size - 7, 0) && finderAt(m, 0, size - 7), true);
      assert.equal(m[size - 8][8], true); // the dark module
      for (let i = 8; i < size - 8; i += 1) assert.equal(m[6][i], i % 2 === 0); // timing
    }
  });

  it('is deterministic and refuses what does not fit version 10', () => {
    assert.deepEqual(qrPath('abc'), qrPath('abc'));
    assert.equal(qrMatrix('x'.repeat(300)), null);
    const p = qrPath('A');
    assert.equal(p.size, 21 + 8);
    assert.equal(p.d.startsWith('M4 4h1v1h-1z'), true);
  });
});

describe('classReport', () => {
  const snap = {
    code: 'K7P2QX',
    round: 1,
    total: 3,
    studentCount: 2,
    set: { theme: 'familles', level: 'standard', mode: 'briefing' },
    rows: [{ word: 'famille', pos: 'noun', gender: 'f' }, { word: 'ami', pos: 'noun', gender: 'm' }, { word: 'chanter' }],
    summary: [
      { index: 0, word: 'famille', clean: 1, hinted: 0, miss: 1 },
      { index: 1, word: 'ami', clean: 1, hinted: 1, miss: 0 },
      { index: 2, word: 'chanter', clean: 0, hinted: 0, miss: 2 },
    ],
    students: [
      { id: 'b', name: 'ben', clean: 1, hinted: 0, miss: 2, hints: 0 },
      { id: 'a', name: 'Ana', clean: 1, hinted: 1, miss: 1, hints: 2 },
    ],
  };
  const text = classReport({
    snap,
    categories: [{ id: 'familles', label: 'Families & communities' }],
    modes: [{ id: 'briefing', label: 'TYPE IT' }],
    now: new Date(2026, 9, 20, 10, 5),
  });
  const lines = text.split('\n');

  it('heads with the set and the class score', () => {
    assert.equal(lines[0], 'FRENCH RUSH — CLASS REPORT');
    assert.ok(text.includes('Class: K7P2QX'));
    assert.match(text, /Set: Families & communities · .+ · 3 words · TYPE IT/);
    assert.ok(text.includes('Students: 2'));
    assert.ok(text.includes('Class correct: 50%')); // 3 of 6 answers
  });

  it('lists the words hardest first and the students by name, tab-separated', () => {
    const w = lines.indexOf('WORDS (hardest first)');
    assert.equal(lines[w + 1], 'Word\tGot it\tWith hints\tMissed');
    assert.match(lines[w + 2].split('\t')[0], /chanter$/);
    assert.deepEqual(lines[w + 2].split('\t').slice(1), ['0', '0', '2']);
    assert.match(lines[w + 3].split('\t')[0], /famille$/);
    const s = lines.indexOf('STUDENTS');
    assert.equal(lines[s + 1], 'Name\tGot it\tWith hints\tMissed\tCorrect\tHints used');
    assert.equal(lines[s + 2], 'Ana\t1\t1\t1\t67%\t2');
    assert.equal(lines[s + 3], 'ben\t1\t0\t2\t33%\t0');
  });

  it('works against an older server with no per-student totals', () => {
    const t = classReport({ snap: { ...snap, students: undefined } });
    assert.ok(!t.includes('STUDENTS'));
    assert.ok(t.includes('Students: 2'));
  });
});
