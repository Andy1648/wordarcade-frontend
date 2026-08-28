// StatsScreen.jsx — a read-only, static progression readout (no animation). Reachable from
// the STATS footer link. Styled like the mode dialog (thick black border, hard offset
// shadow, #1a0b2e panel). Scrolls internally on a short viewport; never breaks 100dvh.
import { useEffect, useRef, useState } from 'react';
import './StatsScreen.css';
import {
  loadProgress,
  getTaps,
  getRebirths,
  rebirthMult,
  getKeyTier,
  keyTierXp,
} from '../progress/xp';
import { getWins, getWinsLifetime, getRounds } from '../progress/wins';
import { bestWpm, allTimeAvgWpm } from '../progress/wpm';
import { getStreak } from '../progress/streak';
import { readRecords, noteLevel } from '../progress/records';
import { rankTitle } from '../progress/rank';
import { formatNum } from '../format';

const fmt = (n) => formatNum(Number.isFinite(n) ? n : 0);
const x = (n) => `×${formatNum(Number.isFinite(n) ? n : 0)}`; // formatNum so ×1e11 stays compact

// The per-mode WPM cells (menu self-test excluded — it isn't a played round). label → wpm.js mode.
const WPM_RECORD_MODES = [
  ['WORD BOMB', 'wordBomb'],
  ['CATEGORY BLITZ', 'blitz'],
  ['SAT RUSH', 'satRush'],
  ['CHAIN', 'chain'],
  ['FUSE', 'fuse'],
];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
// Compact, house-style date (e.g. "AUG 27 2026"). Guarded — a bad stamp reads as a dash.
function fmtDate(ms) {
  try {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '—';
    return `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
  } catch {
    return '—';
  }
}

// Build the permanent-record grid cells from the record blob + existing storage. Each cell is
// EARNED (a value) or LOCKED (a silhouette + the requirement to unlock it) — never an empty slot.
// `highestLevel` folds the current run's live level into the stored peak so it's always current.
function buildRecordCells(rec, streakNow, rebirths, highestLevel) {
  const cells = WPM_RECORD_MODES.map(([label, mode]) => {
    const v = bestWpm(mode);
    return { label: `BEST WPM · ${label}`, locked: v <= 0, value: fmt(v), req: `PLAY ${label}` };
  });
  const avg = allTimeAvgWpm();
  cells.push({ label: 'AVG WPM', locked: avg <= 0, value: fmt(avg), req: 'FINISH A ROUND' });
  cells.push({
    label: 'RAREST WORD',
    wide: true,
    locked: !rec.rarest,
    value: rec.rarest ? rec.rarest.word.toUpperCase() : '',
    sub: rec.rarest ? `${rec.rarest.band} ${x(rec.rarest.mult)}` : '',
    req: 'ACCEPT A WORD',
  });
  cells.push({ label: 'LONGEST COMBO', locked: rec.longestCombo <= 0, value: fmt(rec.longestCombo), req: 'CHAIN 2 WORDS' });
  cells.push({ label: 'LONGEST STREAK', locked: rec.longestStreak <= 0, value: fmt(rec.longestStreak), req: 'PLAY 2 DAYS' });
  cells.push({ label: 'CURRENT STREAK', locked: streakNow <= 0, value: fmt(streakNow), req: 'PLAY TODAY' });
  cells.push({ label: 'DISTINCT WORDS', locked: rec.distinct <= 0, value: fmt(rec.distinct), req: 'ACCEPT A WORD' });
  // Two DISTINCT achievements: OBSCURE FINDS is a VOCABULARY record (words in the rarest
  // frequency band); LUCKY WORDS is a CHANCE record (the 1/40 RNG windfall from luck.js).
  cells.push({ label: 'OBSCURE FINDS', locked: rec.obscure <= 0, value: fmt(rec.obscure), req: 'FIND AN OBSCURE WORD' });
  cells.push({ label: 'LUCKY WORDS', locked: rec.lucky <= 0, value: fmt(rec.lucky), req: 'HIT A LUCKY WORD' });
  cells.push({ label: 'HIGHEST LEVEL', locked: highestLevel <= 1, value: `LV ${fmt(highestLevel)}`, req: 'REACH LV 2' });
  cells.push({ label: 'TOTAL REBIRTHS', locked: rebirths <= 0, value: fmt(rebirths), req: 'REBIRTH ONCE' });
  cells.push({ label: 'FIRST PLAYED', locked: rec.firstPlayed <= 0, value: fmtDate(rec.firstPlayed), req: 'PLAY A ROUND' });
  cells.push({ label: 'TOTAL SESSIONS', locked: rec.sessions <= 0, value: fmt(rec.sessions), req: 'PLAY A ROUND' });
  return cells;
}

// RESET ALL PROGRESS: wipe every taw.* key (xp, level, wins, purchases, rebirths, lifetime
// stats — all live under the taw. namespace) and hard-reload so every screen re-reads zeros.
// Wrapped so a blocked/absent store can't throw; the reload still fires.
function resetAllProgress() {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith('taw.')) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* storage blocked — nothing to clear */
  }
  try {
    window.location.reload();
  } catch {
    /* non-browser env — no-op */
  }
}

export default function StatsScreen({ onBack }) {
  const overlayRef = useRef(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  // Two-step guard for the destructive reset: the button reveals a confirm panel that names
  // exactly what is destroyed; only its second button actually wipes.
  const [confirmingReset, setConfirmingReset] = useState(false);
  // A11y: move focus into the dialog on open; Escape closes it (once on mount).
  useEffect(() => {
    // Persist the current level into the all-time peak (survives a later rebirth's reset). Read
    // fresh inside the effect so it stays a one-shot with no render-scope dependency.
    noteLevel(loadProgress().level);
    overlayRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onBackRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Economy v5 storage: {level, intoLevel}. There is no cumulative "total XP" any more (that
  // was the number that hit the float64 cliff), so the readout shows XP INTO the current level.
  const { level, intoLevel, lifetimeLetters } = loadProgress();
  const rounds = getRounds();
  const rebirths = getRebirths();

  // Permanent-record grid: the record blob + the live level folded into the stored peak, so
  // HIGHEST LEVEL reads true even before a rebirth captures it (the mount effect persists it).
  const records = readRecords();
  const highestLevel = Math.max(records.maxLevel, level);
  const recordCells = buildRecordCells(records, getStreak().count, rebirths, highestLevel);

  const rbMult = rebirthMult(rebirths);
  const keyTier = getKeyTier();
  const baseXp = keyTierXp(keyTier); // Key Power TIER's XP per letter
  const menuXp = Math.round((baseXp * rbMult) / 10) * 10; // per menu keystroke (mode ×1), ×10

  const progression = [
    ['LEVEL', level],
    ['RANK', rankTitle(level)], // Job 5 — the level band's name (a string; see the render below)
    ['XP INTO LEVEL', intoLevel],
    // ('XP TO NEXT LEVEL' row removed by request — the level + XP-into read is enough.)
    ['REBIRTHS', rebirths],
    ['LETTERS TYPED', lifetimeLetters],
    ['TAPS', getTaps()],
    ['WINS BALANCE', getWins()],
    ['WINS EARNED (ALL-TIME)', getWinsLifetime()],
  ];
  // XP stack is now Key Power (base) × rebirth. Cosmetics are pure flair — not shown here.
  const multipliers = [
    ['KEY POWER', `T${keyTier}`],
    ['BASE XP / LETTER', fmt(baseXp)],
    ['REBIRTH', x(rbMult)],
    ['MENU XP / LETTER', fmt(menuXp)],
  ];
  const roundsPlayed = [
    ['WORD BOMB', rounds.wordBomb],
    ['CATEGORY BLITZ', rounds.blitz],
    ['SAT RUSH', rounds.satRush],
  ];

  return (
    <div className="stats-overlay" role="dialog" aria-modal="true" aria-label="Stats" tabIndex={-1} ref={overlayRef}>
      <div className="stats-panel">
        <div className="stats-header">
          <h2 className="stats-title">STATS</h2>
          <button type="button" className="stats-close" onClick={onBack} aria-label="Back to menu">
            ✕
          </button>
        </div>

        <div className="stats-body">
          {/* PERSONAL RECORDS — the headline grid. Every cell is EARNED (a value) or LOCKED (a
              silhouette + how to unlock it), never an empty slot. Static, zero animation. */}
          <h3 className="stats-subtitle stats-subtitle--first">PERSONAL RECORDS</h3>
          <div className="rec-grid">
            {recordCells.map((c) => (
              <div
                className={`rec-cell${c.locked ? ' rec-cell--locked' : ''}${c.wide ? ' rec-cell--wide' : ''}`}
                key={c.label}
                aria-label={c.locked ? `${c.label}: locked — ${c.req}` : `${c.label}: ${c.value}${c.sub ? ` ${c.sub}` : ''}`}
              >
                <span className="rec-label">{c.label}</span>
                {c.locked ? (
                  <>
                    <span className="rec-silhouette" aria-hidden="true" />
                    <span className="rec-req">{c.req}</span>
                  </>
                ) : (
                  <>
                    <span className="rec-value">{c.value}</span>
                    {c.sub ? <span className="rec-sub">{c.sub}</span> : null}
                  </>
                )}
              </div>
            ))}
          </div>

          <h3 className="stats-subtitle">PROGRESSION</h3>
          <dl className="stats-list">
            {progression.map(([k, v]) => (
              <div className="stats-row" key={k}>
                <dt>{k}</dt>
                {/* progression rows are numeric except RANK (a string) — pass strings through raw. */}
                <dd>{typeof v === 'number' ? fmt(v) : v}</dd>
              </div>
            ))}
          </dl>

          <h3 className="stats-subtitle">XP STACK</h3>
          <dl className="stats-list">
            {multipliers.map(([k, v]) => (
              <div className="stats-row" key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>

          <h3 className="stats-subtitle">ROUNDS PLAYED</h3>
          <dl className="stats-list">
            {roundsPlayed.map(([k, v]) => (
              <div className="stats-row" key={k}>
                <dt>{k}</dt>
                <dd>{fmt(v)}</dd>
              </div>
            ))}
          </dl>

          {/* DANGER ZONE — hard-separated from everything above so RESET is never a mis-tap. */}
          <div className="stats-danger">
            {confirmingReset ? (
              <div className="stats-danger-confirm" role="alertdialog" aria-label="Confirm reset">
                <p className="stats-danger-warn">
                  This <b>permanently destroys</b> your XP, level, wins, all purchases,
                  rebirths, and every lifetime stat. It cannot be undone.
                </p>
                <div className="stats-danger-actions">
                  <button type="button" className="stats-reset-confirm" onClick={resetAllProgress}>
                    YES, WIPE EVERYTHING
                  </button>
                  <button type="button" className="stats-reset-cancel" onClick={() => setConfirmingReset(false)}>
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="stats-reset" onClick={() => setConfirmingReset(true)}>
                RESET ALL PROGRESS
              </button>
            )}
          </div>
        </div>

        <button type="button" className="stats-back" onClick={onBack}>
          ← BACK TO MENU
        </button>
      </div>
    </div>
  );
}
