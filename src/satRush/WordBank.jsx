// WordBank.jsx — FRENCH RUSH's word list: every word, by AP theme and level, with its article, its
// meaning, a 🔊, and where the student stands with it (known / learning / new). Search matches the
// French with or without accents, and the English. It is a LIST, so it scrolls — inside its page.
// Useful to a student before a test and to a teacher picking a set.
import { useMemo, useState } from 'react';
import PrintPicker from './PrintPicker';
import { speakFr, canSpeak, withArticle } from './speak';

const fold = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// the level a word sits in, matching CASE SETUP's bands (runSpec FR_DIFFICULTIES)
const LEVEL = (r) => (r.ap === 1 && r.tier <= 2 ? 'basics' : r.ap <= 2 && r.tier <= 4 ? 'exam core' : 'score 5');
const SHOW = [
  { value: 'all', label: 'All words' },
  { value: 'todo', label: 'Still to learn' },
  { value: 'known', label: 'Known' },
  { value: 'studied', label: 'Studied' },
  { value: 'unstudied', label: 'Not studied yet' },
  { value: 'study', label: "Can't guess from English" },
  { value: 'false', label: 'False friends' },
];
const STATUS_LABEL = { known: 'known', learning: 'learning', new: 'new' };

export default function WordBank({ words = [], categories = [], masteryOf, studiedOf, onBack }) {
  const [theme, setTheme] = useState('all');
  const [q, setQ] = useState('');
  const [show, setShow] = useState('all');
  const label = (id) => (categories.find((c) => c.id === id) || {}).label || id;

  const rows = useMemo(() => {
    const f = fold(q.trim());
    return words
      .filter((r) => theme === 'all' || r.category === theme)
      .filter((r) => !f || fold(r.word).includes(f) || fold(r.gloss).includes(f))
      .map((r) => ({ ...r, status: masteryOf ? masteryOf(r.word) : 'new', studied: studiedOf ? studiedOf(r.word) : false }))
      .filter((r) => {
        if (show === 'todo') return r.status !== 'known';
        if (show === 'known') return r.status === 'known';
        if (show === 'studied') return r.studied;
        if (show === 'unstudied') return !r.studied;
        if (show === 'study') return !r.guessable; // the words STUDY FIRST teaches
        if (show === 'false') return r.falseFriend;
        return true;
      })
      .sort((a, b) => a.ap - b.ap || a.tier - b.tier || a.word.localeCompare(b.word, 'fr'));
  }, [words, theme, q, show, masteryOf, studiedOf]);

  const known = useMemo(() => words.filter((r) => masteryOf && masteryOf(r.word) === 'known').length, [words, masteryOf]);

  return (
    <div className="sr-screen">
      <div className="sr-bank">
        <div className="sr-bank-head">
          <div className="sr-modeselect-head sr-print" data-v="WORD BANK">
            WORD BANK
          </div>
          <div className="sr-setup-sub">
            {words.length} words · you know {known}
          </div>
        </div>
        <div className="sr-bank-filters">
          <PrintPicker
            className="sr-bank-field"
            label="theme"
            value={theme}
            options={[{ value: 'all', label: 'All themes' }, ...categories.map((c) => ({ value: c.id, label: c.label }))]}
            onChange={setTheme}
          />
          <PrintPicker className="sr-bank-field" label="show" value={show} options={SHOW} onChange={setShow} />
          <label className="sr-bank-field grow">
            <span className="sr-setup-label">search</span>
            <input
              type="search"
              value={q}
              placeholder="French or English"
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              spellCheck="false"
            />
          </label>
        </div>
        <ul className="sr-bank-list">
          {rows.map((r) => (
            <li key={r.word} className={`sr-bank-row ${r.status}`}>
              <div className="sr-bank-top">
                <b className="sr-bank-word">{withArticle(r.word, r.pos, r.gender)}</b>
                {canSpeak() && (
                  <button type="button" className="sr-say" onClick={() => speakFr(r.word)} aria-label={`say ${r.word}`}>
                    🔊
                  </button>
                )}
                <span className="sr-bank-gloss">{r.gloss}</span>
              </div>
              <div className="sr-bank-meta">
                <span>{label(r.category)}</span>
                <span>{LEVEL(r)}</span>
                <span className={`sr-bank-status ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                {r.studied && <span className="sr-bank-tag">studied</span>}
                {r.falseFriend && <span className="sr-bank-tag warn">false friend</span>}
              </div>
            </li>
          ))}
          {rows.length === 0 && <li className="sr-bank-empty">No words match.</li>}
        </ul>
        <div className="sr-setup-exits">
          <button type="button" className="sr-exit-chip" onClick={onBack}>
            <span aria-hidden="true">←</span> BACK
          </button>
        </div>
      </div>
    </div>
  );
}
