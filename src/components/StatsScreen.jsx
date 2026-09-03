// StatsScreen.jsx — a read-only, static progression readout (no animation). Reachable from the STATS
// corner button. Styled like the mode dialog (thick black border, hard offset shadow, #1a0b2e panel).
// Scrolls internally on a short viewport; never breaks 100dvh.
//
// TABS: this overlay now hosts THREE read-only readouts — STATS, COLLECTION, ACHIEVEMENTS — behind a
// tab bar. COLLECTION and ACHIEVEMENTS used to be their own menu footer links + views; they were
// consolidated in here (same kind of thing as records/progression/danger-zone) so the menu footer is
// CREDITS-only again. The tab bodies live in CollectionScreen.jsx / AchievementsScreen.jsx.
import { useEffect, useRef, useState } from 'react';
import './StatsScreen.css';
import {
  loadProgress,
  getRebirths,
  rebirthMult,
  getKeyTier,
  keyTierXp,
  xpPerInput,
} from '../progress/xp';
import { equippedPopMult, equippedSoundMult } from '../progress/shop';
import { getWins, getWinsLifetime, getRounds } from '../progress/wins';
import { rankTitle } from '../progress/rank';
import { bestWpmOverall, recentAvgWpm } from '../progress/wpm';
import { getStreak } from '../progress/streak';
import { readRecords, noteLevel } from '../progress/records';
import { formatNum } from '../format';
import { CollectionBody } from './CollectionScreen';
import { AchievementsBody } from './AchievementsScreen';
import { exportSave, importSave } from '../save/saveBackup';

const TABS = [
  { id: 'stats', label: 'STATS' },
  { id: 'collection', label: 'COLLECTION' },
  { id: 'achievements', label: 'ACHIEVEMENTS' },
];

const fmt = (n) => formatNum(Number.isFinite(n) ? n : 0);
const x = (n) => `×${formatNum(Number.isFinite(n) ? n : 0)}`; // formatNum so ×1e11 stays compact

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

// The PERSONAL RECORDS grid cells — personal bests + lifetime firsts no other screen surfaces. Each
// cell is EARNED (a value) or LOCKED (a silhouette + how to unlock it), never an empty slot. The
// OBSCURE FINDS (vocabulary) and LUCKY WORDS (chance) split is the point of the record-surface work;
// per-mode WPM is intentionally NOT duplicated here (the TYPING SPEED block already shows it).
function buildRecordCells(rec, streakNow, rebirths, highestLevel) {
  return [
    {
      label: 'RAREST WORD',
      wide: true,
      locked: !rec.rarest,
      value: rec.rarest ? rec.rarest.word.toUpperCase() : '',
      sub: rec.rarest ? `${rec.rarest.band} ${x(rec.rarest.mult)}` : '',
      req: 'ACCEPT A WORD',
    },
    { label: 'BEST STREAK', locked: rec.longestCombo <= 0, value: fmt(rec.longestCombo), req: 'CHAIN 2 WORDS' },
    { label: 'LONGEST STREAK', locked: rec.longestStreak <= 0, value: fmt(rec.longestStreak), req: 'PLAY 2 DAYS' },
    { label: 'CURRENT STREAK', locked: streakNow <= 0, value: fmt(streakNow), req: 'PLAY TODAY' },
    { label: 'DISTINCT WORDS', locked: rec.distinct <= 0, value: fmt(rec.distinct), req: 'ACCEPT A WORD' },
    // OBSCURE FINDS = a VOCABULARY record (accepts in the rarest frequency band); LUCKY WORDS = a
    // CHANCE record (the 1/40 RNG windfall). Deliberately two separate cells.
    { label: 'OBSCURE FINDS', locked: rec.obscure <= 0, value: fmt(rec.obscure), req: 'FIND AN OBSCURE WORD' },
    { label: 'LUCKY WORDS', locked: rec.lucky <= 0, value: fmt(rec.lucky), req: 'HIT A LUCKY WORD' },
    { label: 'HIGHEST LEVEL', locked: highestLevel <= 1, value: `LV ${fmt(highestLevel)}`, req: 'REACH LV 2' },
    { label: 'TOTAL REBIRTHS', locked: rebirths <= 0, value: fmt(rebirths), req: 'REBIRTH ONCE' },
    { label: 'FIRST PLAYED', locked: rec.firstPlayed <= 0, value: fmtDate(rec.firstPlayed), req: 'PLAY A ROUND' },
    { label: 'TOTAL SESSIONS', locked: rec.sessions <= 0, value: fmt(rec.sessions), req: 'PLAY A ROUND' },
  ];
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
  // BACKUP (feat/save-export): copy the whole progress save as one code, or restore from a pasted
  // code. Recovery path only — reads/writes the current loose keys, no schema change. Import is
  // two-step (a paste never auto-applies) and validates fully before touching anything.
  const [copyMsg, setCopyMsg] = useState('');
  const [restoreText, setRestoreText] = useState('');
  const [restoreMsg, setRestoreMsg] = useState('');
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const handleCopySave = async () => {
    const code = exportSave();
    try {
      await navigator.clipboard.writeText(code);
      setCopyMsg('COPIED — PASTE IT SOMEWHERE SAFE');
    } catch {
      // Clipboard blocked (permissions / insecure context): drop the code into the restore box so
      // the player can still select + copy it manually. Never lose the code.
      setRestoreText(code);
      setCopyMsg('COPY BLOCKED — SELECT THE CODE BELOW');
    }
    window.setTimeout(() => setCopyMsg(''), 4000);
  };
  const handleRestore = () => {
    const res = importSave(restoreText);
    if (res.ok) {
      // Reload so every module re-reads the restored progress from storage.
      window.location.reload();
      return;
    }
    setConfirmingRestore(false);
    setRestoreMsg(res.error); // readable; existing progress untouched
  };
  // Active tab: STATS (default — the one the layout gate exercises) | COLLECTION | ACHIEVEMENTS.
  const [tab, setTab] = useState('stats');
  const activeLabel = TABS.find((t) => t.id === tab)?.label || 'STATS';
  // A11y: move focus into the dialog on open; Escape closes it (once on mount).
  useEffect(() => {
    // Fold the current run's level into the all-time peak (survives a later rebirth's reset). Read
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
  const { level, intoLevel } = loadProgress();
  const rounds = getRounds();
  const rebirths = getRebirths();

  const rbMult = rebirthMult(rebirths);
  const keyTier = getKeyTier();
  const baseXp = keyTierXp(keyTier); // Key Power TIER's XP per letter
  // MENU XP / LETTER must MATCH the "+N" that pops on every menu keystroke — so compute it the
  // SAME way the live credit does (useXpCapture → xpPerInput), applying the equipped cosmetic
  // pop/sound multipliers and the daily-streak multiplier, not just base × rebirth. (The old
  // base×rebirth understated it whenever a cosmetic was equipped or a streak was active.)
  const menuXp = xpPerInput({ mode: 'menu', popMult: equippedPopMult(), soundMult: equippedSoundMult() });

  const progression = [
    ['LEVEL', level],
    ['RANK', rankTitle(level)], // Job 5 — the level band's name (a string; see the render below)
    ['XP INTO LEVEL', intoLevel],
    // ('XP TO NEXT LEVEL' row removed by request — the level + XP-into read is enough.)
    ['REBIRTHS', rebirths],
    ['WINS BALANCE', getWins()],
    ['WINS EARNED (ALL-TIME)', getWinsLifetime()],
  ];
  // XP stack: Key Power (base) × rebirth × equipped cosmetics × streak — MENU XP / LETTER below
  // is the full product (matches the live keystroke pop), BASE XP / LETTER is just the Key Power tier.
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
  // TYPING SPEED (§2d): best + recent average, measured as ACTIVE typing time only and ONLY in the
  // continuous-typing modes (turn-based Word Bomb / Blitz are excluded — the label names the
  // contributors so it's clear what feeds these numbers).
  const bestWpm = bestWpmOverall();
  const avgWpm = recentAvgWpm();

  // PERSONAL RECORDS (record-surface): personal bests + lifetime firsts. `highestLevel` folds the
  // live level into the stored peak so it's always current; streak/rebirths read from their stores.
  const records = readRecords();
  const highestLevel = Math.max(records.maxLevel, level);
  const recordCells = buildRecordCells(records, getStreak().count, rebirths, highestLevel);

  return (
    <div className="stats-overlay" role="dialog" aria-modal="true" aria-label={activeLabel} tabIndex={-1} ref={overlayRef}>
      <div className="stats-panel">
        <div className="stats-header">
          <h2 className="stats-title">{activeLabel}</h2>
          <button type="button" className="stats-close" onClick={onBack} aria-label="Back to menu">
            ✕
          </button>
        </div>

        {/* Tab bar — STATS / COLLECTION / ACHIEVEMENTS. Sized to fit three labels at 360px wide
            without clipping (Space Mono, responsive font); the layout gate only exercises STATS. */}
        <div className="stats-tabs" role="tablist" aria-label="Stats sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`stats-tab${tab === t.id ? ' is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="stats-body">
          {tab === 'stats' && (
          <>
          {/* PERSONAL RECORDS — the headline grid (record-surface). Every cell is EARNED (a value)
              or LOCKED (a silhouette + how to unlock it), never an empty slot. Static, zero motion. */}
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

          <h3 className="stats-subtitle">TYPING SPEED</h3>
          {/* The label names the contributing modes so it's clear these count only where typing
              speed is meaningful — the continuous modes + menu, never the turn-based games (§2d). */}
          <p className="stats-caption">SAT RUSH · CHAIN · FUSE · MENU — active typing only</p>
          <dl className="stats-list">
            <div className="stats-row">
              <dt>BEST WPM</dt>
              <dd>{fmt(bestWpm)}</dd>
            </div>
            <div className="stats-row">
              <dt>AVG WPM (RECENT)</dt>
              <dd>{fmt(avgWpm)}</dd>
            </div>
          </dl>

          {/* BACKUP — copy your whole save as a code, or restore from one. Progress only (no device
              settings). The recovery path ships before any versioned-save migration. */}
          <h3 className="stats-subtitle">BACKUP</h3>
          <p className="stats-caption">COPY YOUR SAVE SOMEWHERE SAFE — OR RESTORE IT ON A NEW DEVICE. PROGRESS ONLY.</p>
          <div className="stats-backup">
            <button type="button" className="stats-backup-copy" onClick={handleCopySave}>
              COPY SAVE
            </button>
            {copyMsg && <p className="stats-backup-msg" aria-live="polite">{copyMsg}</p>}
            <textarea
              className="stats-backup-input"
              value={restoreText}
              onChange={(e) => {
                setRestoreText(e.target.value);
                setRestoreMsg('');
              }}
              placeholder="PASTE A SAVE CODE TO RESTORE…"
              spellCheck="false"
              autoCapitalize="off"
              autoCorrect="off"
              rows={2}
            />
            {restoreMsg && <p className="stats-backup-err" role="alert">{restoreMsg}</p>}
            {confirmingRestore ? (
              <div className="stats-backup-confirm" role="alertdialog" aria-label="Confirm restore">
                <p className="stats-backup-warn">
                  Restoring <b>replaces</b> your current progress with the code's. Your device audio
                  settings are untouched.
                </p>
                <div className="stats-backup-actions">
                  <button type="button" className="stats-reset-confirm" onClick={handleRestore}>
                    YES, RESTORE
                  </button>
                  <button type="button" className="stats-reset-cancel" onClick={() => setConfirmingRestore(false)}>
                    CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="stats-backup-restore"
                disabled={!restoreText.trim()}
                onClick={() => {
                  setRestoreMsg('');
                  setConfirmingRestore(true);
                }}
              >
                RESTORE FROM CODE
              </button>
            )}
          </div>

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
          </>
          )}
          {tab === 'collection' && <CollectionBody />}
          {tab === 'achievements' && <AchievementsBody />}
        </div>

        <button type="button" className="stats-back" onClick={onBack}>
          ← BACK TO MENU
        </button>
      </div>
    </div>
  );
}
