// wpm.js — typing-speed (WPM) calculation + per-session persistence for a TYPING game that
// never showed typing speed. PURE calc + localStorage-backed history, every access guarded (a
// blocked/absent store degrades to empty, never throws).
//
// WPM uses the standard 5-characters-per-"word" convention: (chars / 5) / minutes. "chars" is
// the length of the words the player got ACCEPTED (a correct-WPM, so mashing junk never inflates
// it); in the menu self-test it's the letters of each real word typed. Live HUD readouts recompute
// this at most ~4×/sec (see useWpmTracker) so the number never jitters.

export const WPM_KEY = 'taw.wpm';
// The modes we track a best for — ONLY the continuous-typing modes where wall-clock-free WPM is
// meaningful (§2). Word Bomb and Category Blitz are turn-based (you spend most of the round
// WAITING for your turn), so a typing-speed number there is noise — they no longer record a
// session, and any stored best for them is dropped on the next load (loadWpm reads only these
// modes). 'menu' is the free-typing self-test. Human-readable labels drive the Stats readout.
export const WPM_MODES = ['satRush', 'chain', 'fuse', 'menu'];
export const WPM_MODE_LABELS = { satRush: 'SAT RUSH', chain: 'CHAIN', fuse: 'FUSE', menu: 'MENU' };
// Keep at most this many recent sessions (oldest evicted first).
export const RECENT_CAP = 30;
// A session shorter than this (ms) or with fewer chars is ignored — too little signal, and it
// would let a 1-letter "run" spike the best.
const MIN_SESSION_MS = 2000;
const MIN_SESSION_CHARS = 10;

// Pure: words-per-minute from a character count and an elapsed time in ms. 0 for non-positive or
// non-finite inputs (so a not-yet-started tracker reads 0, never NaN/Infinity).
export function wpmFrom(chars, ms) {
  const c = Number.isFinite(chars) ? chars : 0;
  const m = Number.isFinite(ms) ? ms : 0;
  if (c <= 0 || m <= 0) return 0;
  return c / 5 / (m / 60000);
}

function freshData() {
  const best = {};
  for (const m of WPM_MODES) best[m] = 0;
  return { best, sum: 0, n: 0, recent: [] };
}

// Guarded read → always a well-formed object (fresh on any unreadable/blocked/garbage blob).
export function loadWpm() {
  const data = freshData();
  try {
    const raw = localStorage.getItem(WPM_KEY);
    if (raw == null) return data;
    const o = JSON.parse(raw) || {};
    if (o.best && typeof o.best === 'object') {
      for (const m of WPM_MODES) {
        const v = Number(o.best[m]);
        if (Number.isFinite(v) && v > 0) data.best[m] = Math.floor(v);
      }
    }
    if (Number.isFinite(Number(o.sum)) && Number(o.sum) >= 0) data.sum = Number(o.sum);
    if (Number.isFinite(Number(o.n)) && Number(o.n) >= 0) data.n = Math.floor(Number(o.n));
    if (Array.isArray(o.recent)) {
      data.recent = o.recent
        .filter((s) => s && WPM_MODES.includes(s.m) && Number.isFinite(Number(s.w)))
        .slice(-RECENT_CAP)
        .map((s) => ({ m: s.m, w: Math.floor(Number(s.w)) }));
    }
  } catch {
    return freshData();
  }
  return data;
}

function saveWpm(data) {
  try {
    localStorage.setItem(WPM_KEY, JSON.stringify(data));
  } catch {
    /* storage blocked — the session simply isn't remembered */
  }
}

// Record one finished session's typing speed: bumps the mode's best, folds into the all-time
// average, and appends to the recent ring (evicting the OLDEST first past RECENT_CAP). A session
// below the MIN_SESSION thresholds is ignored (returns the unchanged data). Pure given storage.
// Returns the updated data (also the computed wpm on the object as `.lastWpm` for the caller).
export function recordSession({ mode, chars, ms } = {}) {
  const data = loadWpm();
  if (!WPM_MODES.includes(mode)) return data;
  if (!(ms >= MIN_SESSION_MS) || !(chars >= MIN_SESSION_CHARS)) return data;
  const wpm = Math.round(wpmFrom(chars, ms));
  if (wpm <= 0) return data;
  data.best[mode] = Math.max(data.best[mode] || 0, wpm);
  data.sum += wpm;
  data.n += 1;
  data.recent.push({ m: mode, w: wpm });
  while (data.recent.length > RECENT_CAP) data.recent.shift(); // oldest (front) evicted first
  data.lastWpm = wpm;
  saveWpm(data);
  return data;
}

// The all-time average WPM across every recorded session (0 with no sessions). NOTE: sum/n is a
// running aggregate that may still carry historical Word Bomb / Blitz sessions recorded before
// those modes were dropped (§2) — it can't self-clean. For a display that must reflect ONLY the
// currently-tracked modes, use recentAvgWpm() below (the recent ring self-cleans on load).
export function allTimeAvgWpm() {
  const { sum, n } = loadWpm();
  return n > 0 ? Math.round(sum / n) : 0;
}

// The average WPM across the recent-session ring. loadWpm() filters `recent` down to WPM_MODES on
// every read, so once Word Bomb / Blitz left that set their old entries are dropped here — this
// average reflects ONLY the modes we still measure (§2d). 0 with no recent sessions.
export function recentAvgWpm() {
  const { recent } = loadWpm();
  if (!recent.length) return 0;
  const sum = recent.reduce((a, s) => a + (s.w || 0), 0);
  return Math.round(sum / recent.length);
}

// The best WPM for a mode (0 if none yet).
export function bestWpm(mode) {
  return loadWpm().best[mode] || 0;
}

// The best across ALL modes (for the share card's headline number).
export function bestWpmOverall() {
  const best = loadWpm().best;
  return WPM_MODES.reduce((mx, m) => Math.max(mx, best[m] || 0), 0);
}

// The most recent recorded session's WPM for a mode (0 if none). Used by the share card to show
// THIS run's typing speed — wpmEnd() flushes the run before the share is built, so the last
// recent entry for the mode is that run.
export function lastSessionWpm(mode) {
  const { recent } = loadWpm();
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].m === mode) return recent[i].w;
  }
  return 0;
}
