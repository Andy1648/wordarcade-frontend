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
import './rarity/RarityFin.css';
import { loadProgress, getRebirths, need } from '../progress/xp';
import { statBoard, boardMult } from '../progress/statBoard';
import { getChainRuns, getFuseRuns } from '../solo/shared.js';
import { getWins, getWinsLifetime, getRounds } from '../progress/wins';
import { rankTitle } from '../progress/rank';
import { secretsProgress } from '../progress/achievements';
import { secretsCollection } from '../secrets/secrets';
import { bestWpmOverall, recentAvgWpm } from '../progress/wpm';
import { getStreak } from '../progress/streak';
import { readRecords, noteLevel } from '../progress/records';
import * as satLexicon from '../satRush/lexicon';
import { formatNum, formatRate } from '../format';
import { CollectionBody } from './CollectionScreen';
import { AchievementsBody } from './AchievementsScreen';
import { SEASON2 } from '../progress/season';
import { exportSave, importSave } from '../save/saveBackup';
import { MASTERY_MODES, masteryWords } from '../progress/mastery';
import { getMyProfile, selfReset } from '../leaderboard/client';
import { useMomentHold } from '../lib/useMomentSlot';
import { flagOn } from '../lib/featureFlags';
import { rebirthLadder } from '../progress/rebirthLadder';
import { rarityClass, rebirthRarity, levelRarity } from '../lib/rarityStyle.js';
import { takeStatsTab } from '../lib/statsTab';

// TIER IDENTITY (Andy oct5): a ladder chip's rebirth count — BASE is R0, NOW is yours, NEXT is one more.
const ladderRb = (id, rc) => (id === 'base' ? 0 : id === 'next' ? rc + 1 : rc);
const ladderLook = (id, rc) => {
  const k = rebirthRarity(ladderRb(id, rc));
  return k ? ` ${rarityClass(k, { tint: id === 'next' })}` : '';
};

const TABS = [
  { id: 'stats', label: 'STATS' },
  { id: 'collection', label: 'COLLECTION' },
  { id: 'achievements', label: 'ACHIEVEMENTS' },
].filter((t) => !(SEASON2 && t.id === 'achievements')); // v3: the season's ACHIEVEMENTS are their own screen (menu trophy)

const fmt = (n) => formatNum(Number.isFinite(n) ? n : 0);

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
      sub: rec.rarest ? rec.rarest.band : '', // the band only — rarity pays no ×N (Rebirth Rush)
      req: 'ACCEPT A WORD',
    },
    // H6/M6: the in-run combo is a COMBO; STREAK means the daily streak (the row below).
    { label: 'BEST COMBO', locked: rec.longestCombo <= 0, value: fmt(rec.longestCombo), req: '2 WORDS IN A ROW' },
    { label: 'LONGEST DAILY STREAK', locked: rec.longestStreak <= 0, value: fmt(rec.longestStreak), req: 'PLAY 2 DAYS' },
    { label: 'CURRENT DAILY STREAK', locked: streakNow <= 0, value: fmt(streakNow), req: 'PLAY TODAY' },
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

// RESET ALL PROGRESS: wipe every taw.* key (xp, level, wins, purchases, rebirths, lifetime stats — all
// live under the taw. namespace) and hard-reload so every screen re-reads zeros. N2 (Andy oct2): with a
// claimed name it also resets the BOARD ROW and the CLOUD SAVE (client.selfReset → 014 lb_self_reset,
// the admin reset path) and keeps the name. Never throws; the reload always fires.
async function resetAllProgress() {
  try {
    await selfReset();
  } catch {
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
  }
  try {
    window.location.reload();
  } catch {
    /* non-browser env — no-op */
  }
}

export default function StatsScreen({ onBack }) {
  useMomentHold(true); // H5: no queued moment (rank-up, claim popup, tutorial…) starts under this panel
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
  const [tab, setTab] = useState(() => takeStatsTab() || 'stats');
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


  // STAT BOARD (Andy oct5): WINS / WORD and XP / LETTER as BASE → one line per multiplier → TOTAL, read from the
  // live save; TOTAL is the payout's own number (progress/statBoard.js, asserted in statBoard.test.js).
  const board = statBoard();
  // EXTENSION d (dormant, ?ladder=1): BASE / NOW / NEXT rebirth chips under the STAT BOARD. The chips read the live
  // Rebirth Rush rebirthMult (5^R) and rebirthThreshold (LV 15 + 18R) — never a copied table.
  const ladder = flagOn('ladder') ? rebirthLadder(rebirths) : null;

  // TWO different hidden sets, and they are NOT the same thing — so they do not share a heading.
  // `hidden` is the five SECRET-category achievements (thresholds you cross). `secrets` is the five
  // discoverable SECRETS (things you do), which used to announce themselves as a centre-screen
  // sticker over the menu and now live here and at the word they fire on.
  const hidden = secretsProgress();
  const secrets = secretsCollection();
  // H7 (oct3): LEVEL, RANK, REBIRTHS and WINS EARNED (ALL-TIME) were printed here a second time —
  // the PLAYER CARD above already shows all four (LV hero, rank, R-n, WINS EARNED). PROGRESSION now
  // holds only what the card does not: the XP into this level, and the spendable balance.
  const progression = [
    // H6/M16: progress with its cost, not a bare number.
    ['XP INTO LEVEL', `${fmt(intoLevel)} / ${fmt(need(level))}`],
    ['WINS BALANCE', getWins()],
  ];
  const roundsPlayed = [
    ['WORD BOMB', rounds.wordBomb],
    ['CATEGORY BLITZ', rounds.blitz],
    ['SAT RUSH', rounds.satRush],
    // H6/M17: the solo modes' own persisted run counters (bumped on every run start).
    ['CHAIN', getChainRuns()],
    ['FUSE', getFuseRuns()],
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
  // EARNED FIRST (fine-tune oct2 / Andy N3): the records you hold lead the grid at full size; the
  // locked ones follow as compact one-line goals, so the screen's big thing is what you've done.
  const recordCellsAll = buildRecordCells(records, getStreak().count, rebirths, highestLevel);
  const recordCells = [...recordCellsAll.filter((c) => !c.locked), ...recordCellsAll.filter((c) => c.locked)];
  // BB2 (Andy oct2): the PLAYER CARD — the screen worth screenshotting. LEVEL is the hero (the board
  // ranks rebirths, then level); four big numbers under it; who / rank / rebirths / since on one strip.
  let wordsTyped = 0;
  for (const m of MASTERY_MODES) wordsTyped += masteryWords(m) || 0;
  const me = getMyProfile();
  const card = {
    name: me && me.username ? me.username : null,
    rank: rankTitle(level),
    level,
    rebirths,
    cells: [
      { label: 'WORDS TYPED', value: fmt(wordsTyped) },
      { label: 'WINS EARNED', value: fmt(getWinsLifetime()) },
      { label: 'BEST WPM', value: bestWpm > 0 ? fmt(Math.round(bestWpm)) : '—' },
      { label: 'RAREST WORD', value: records.rarest ? records.rarest.word.toUpperCase() : '—', sub: records.rarest ? records.rarest.band : '' },
    ],
    since: records.firstPlayed > 0 ? fmtDate(records.firstPlayed) : null,
    streak: getStreak().count,
  };
  // SAT RUSH spaced-repetition: the persistent WORDS YOU KEEP MISSING list, read
  // from the SAT lexicon store (lexicon.load is storage-access-safe on its own).
  const satMissing = satLexicon.mostMissed(
    satLexicon.load(typeof window !== 'undefined' ? window.localStorage : null),
    8,
  );

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
          <PlayerCard card={card} />
          {/* PERSONAL RECORDS — the headline grid (record-surface). Every cell is EARNED (a value)
              or LOCKED (a silhouette + how to unlock it), never an empty slot. Static, zero motion. */}
          <h3 className="stats-subtitle">PERSONAL RECORDS</h3>
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
                {/* numeric rows go through fmt; preformatted strings (XP INTO LEVEL) pass through raw. */}
                <dd>{typeof v === 'number' ? fmt(v) : v}</dd>
              </div>
            ))}
          </dl>

          {/* SECRETS — a COLLECTION, not a random popup (feat/progression-clarity). Five hidden
              achievements paid one lump each and then vanished into the achievements grid; nothing
              ever told you how many there were or that you were missing any. As a row of
              silhouettes with a found count they read as a set to complete. The unfound ones stay
              masked — a silhouette board, not a spoiler. */}
          <h3 className="stats-subtitle">
            SECRETS <span className="stats-secret-count">{fmt(secrets.found)} / {fmt(secrets.total)} FOUND</span>
          </h3>
          <div className="stats-secrets">
            {secrets.items.map((sec) => (
              <div
                key={sec.id}
                className={`stats-secret${sec.earned ? ' is-found' : ''}`}
              >
                <span className="stats-secret-mark" aria-hidden="true">{sec.earned ? '★' : '?'}</span>
                <span className="stats-secret-name">{sec.name}</span>
                <span className="stats-secret-hint">{sec.blurb}</span>
              </div>
            ))}
          </div>

          <h3 className="stats-subtitle">
            HIDDEN ACHIEVEMENTS{' '}
            <span className="stats-secret-count">{fmt(hidden.found)} / {fmt(hidden.total)} FOUND</span>
          </h3>
          <div className="stats-secrets">
            {hidden.items.map((sec) => (
              <div
                key={sec.id}
                className={`stats-secret${sec.earned ? ' is-found' : ''}`}
              >
                <span className="stats-secret-mark" aria-hidden="true">{sec.earned ? '★' : '?'}</span>
                <span className="stats-secret-name">{sec.name}</span>
                <span className="stats-secret-hint">{sec.earned ? sec.hint : 'UNDISCOVERED'}</span>
              </div>
            ))}
          </div>

          {/* STAT BOARD (Andy oct5): TOTAL ×N huge first, then BASE, then each multiplier on its own line, then the pay;
              huge — WINS / WORD, then XP / LETTER. The rebirth ladder chips (?ladder=1) sit under the two boards. */}
          <StatBoard stack={board.wins} title="WINS / WORD" />
          <StatBoard stack={board.xp} title="XP / LETTER" />
          {ladder && (
            <div className="stats-ladder stats-ladder-chips" role="group" aria-label="Rebirth ladder">
              {ladder.map((c) => (
                <span className={`stats-chip is-${c.state}${ladderLook(c.id, rebirths)}`} key={c.id}>
                  {[`${c.name} ${c.mult}`, c.gate, c.gain].filter(Boolean).join(' · ')}
                </span>
              ))}
            </div>
          )}

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

          {/* WORDS YOU KEEP MISSING — SAT RUSH spaced-repetition study list, from the
              lexicon SRS. Only rendered once the player has genuinely-sticky misses. */}
          {satMissing.length > 0 && (
            <>
              <h3 className="stats-subtitle">WORDS YOU KEEP MISSING</h3>
              <p className="stats-caption">SAT RUSH</p>
              <dl className="stats-list">
                {satMissing.map((m) => (
                  <div className="stats-row" key={m.w}>
                    <dt>{m.w.toUpperCase()}</dt>
                    <dd>{/* H2d: a count, not a multiplier — no "×" */}MISSED {fmt(m.missed)} OF {fmt(m.seen)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          {/* BACKUP — copy your whole save as a code, or restore from one. Progress only (no device
              settings). The recovery path ships before any versioned-save migration. */}
          <h3 className="stats-subtitle">BACKUP</h3>
          <p className="stats-caption">BACK UP · MOVE TO A NEW DEVICE</p>
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
                  THIS <b>NUKES EVERYTHING</b> — XP, LEVEL, WINS, EVERY PURCHASE,
                  EVERY REBIRTH, EVERY LIFETIME STAT. GONE FOR GOOD. NO TAKEBACKS.
                  {getMyProfile() && <> YOUR BOARD ROW GOES BACK TO LV 1 TOO — YOUR NAME STAYS.</>}
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
      </div>
    </div>
  );
}

// STAT BOARD (Andy oct5): the TOTAL MULTIPLIER (×N, huge) FIRST, then BASE, then a line per multiplier (rarity/tier
// colour on KEY, REBIRTH, MARK), then "= " the pay itself (BASE × the multiplier — the payout's own number). Static
// like the rest of this screen. The big numerals size to their box by length (cqw), so a long "1.25Qa" never
// overflows a phone. A ×1 line is dimmed, not hidden: every multiplier keeps its line.
function StatBoard({ stack, title }) {
  const baseText = formatRate(stack.base);
  const totalText = formatRate(stack.total);
  const multText = `×${boardMult(stack.base > 0 ? stack.total / stack.base : 1)}`;
  return (
    <section className={`sb sb--${stack.id}`} aria-label={title}>
      <h3 className="stats-subtitle sb-title">{title}</h3>
      <div className="sb-total">
        <span className="sb-k">TOTAL</span>
        <span className="sb-total-v" style={{ '--sb-len': Math.max(4, multText.length) }}>{multText}</span>
      </div>
      <div className="sb-base">
        <span className="sb-k">BASE</span>
        <span className="sb-base-v" style={{ '--sb-len': Math.max(4, baseText.length) }}>{baseText}</span>
      </div>
      <ul className="sb-lines">
        {stack.lines.map((l) => (
          <li className={`sb-line${l.mult === 1 ? ' is-one' : ''}`} key={l.id} data-line={l.id}>
            <span className="sb-k">
              {l.label}
              {l.id === 'key' ? <span className="sb-sub">TIER {fmt(l.keyTier)}</span> : null}
            </span>
            <span className={`sb-x${l.tier ? ` rarity-chip ${rarityClass(l.tier)}` : ''}`}>×{boardMult(l.mult)}</span>
          </li>
        ))}
      </ul>
      <div className="sb-base sb-pay">
        <span className="sb-k">=</span>
        <span className="sb-base-v" style={{ '--sb-len': Math.max(4, totalText.length) }}>{totalText}</span>
      </div>
    </section>
  );
}

// BB2 — the PLAYER CARD. Static (this screen has no motion); a flat card in the house style.
function PlayerCard({ card }) {
  const tier = Math.min(card.rebirths, 5);
  return (
    <section className={`pc-card pc-tier-${tier}`} aria-label="Player card">
      <div className="pc-top">
        <span className="pc-name">{card.name || 'YOU'}</span>
        <span className="pc-rank">{card.rank}</span>
      </div>
      <div className="pc-hero">
        <span className="pc-lv-unit">LV</span>
        <span className={`pc-lv rarity-ink is-${levelRarity(card.level)}`}>{fmt(card.level)}</span>
        {card.rebirths > 0 && <span className={`pc-rb rarity-chip ${rarityClass(rebirthRarity(card.rebirths))}`}>R{fmt(card.rebirths)}</span>}
      </div>
      <dl className="pc-grid">
        {card.cells.map((c) => (
          <div className="pc-cell" key={c.label}>
            <dt className="pc-label">{c.label}</dt>
            <dd className="pc-val">{c.value}</dd>
            {c.sub ? <dd className="pc-sub">{c.sub}</dd> : null}
          </div>
        ))}
      </dl>
      <div className="pc-foot">
        {card.since ? <span>PLAYING SINCE {card.since}</span> : <span>FIRST GAME: TODAY</span>}
        {card.streak > 0 && <span>{fmt(card.streak)}-DAY STREAK</span>}
        <span className="pc-site">TYPEAWORD.COM</span>
      </div>
    </section>
  );
}
