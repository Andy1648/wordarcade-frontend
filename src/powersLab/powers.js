// powers.js — the POWERS LAB rules, PURE (no DOM, no timers, no React). PROTOTYPE ONLY:
// reachable at /?powers=1, never wired into the economy, the server or any room.
//
// Four of the eight designed powers are playable here (see claude/powers-lab/ONE-PAGER in the notes
// folder for all eight):
//   HOLD BREATH  hold Space     the fuse burns at 30% while you hold; the breath meter refills by the
//                               LETTERS of the words you land (long words = more breath).
//   WIND-UP      hold Enter     hold before you release the word; a full wind-up SLAMS it: ×2 points
//                               and the bot gets half its clock. Your own clock keeps burning.
//   AUTOCORRECT  passive        after 4 words it arms; your next one-letter typo is fixed for you.
//   ONE ROW      passive        a word typed on ONE keyboard row (TYPEWRITER, FLASK) pays ×3 + 2 s.

export const TURN_MS = 9000; // the player's fuse per turn
export const BOT_TURN_MS = 9000;

// ---- HOLD BREATH ------------------------------------------------------------------------
export const BREATH = {
  capacityMs: 3000, // a full meter = 3 s of held breath (real time)
  slowScale: 0.3, // the fuse burns at 30% while held
  refillPerLetterMs: 140, // an accepted 7-letter word refills ~1 s
  minToStartMs: 250, // a nearly-empty meter cannot be started (no flicker-taps)
};

/** Breath left after an accepted word of `letters` letters. */
export function refillBreath(ms, letters) {
  return Math.min(BREATH.capacityMs, ms + Math.max(0, letters) * BREATH.refillPerLetterMs);
}

// ---- WIND-UP ------------------------------------------------------------------------------
export const WINDUP = {
  fullMs: 700, // hold Enter this long for a full wind-up
  tapMs: 160, // shorter than this is an ordinary submit (no wind-up cue at all)
  pips: 3, // accepted words needed to arm one SLAM
  scoreMult: 2,
  botClockScale: 0.5,
};

/** 0..1 wind-up fraction for a hold of `heldMs`. */
export function windupFrac(heldMs) {
  if (!(heldMs > WINDUP.tapMs)) return 0;
  return Math.min(1, (heldMs - WINDUP.tapMs) / (WINDUP.fullMs - WINDUP.tapMs));
}

// ---- ONE ROW ------------------------------------------------------------------------------
export const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
export const ONE_ROW = { scoreMult: 3, bonusMs: 2000, minLen: 4 };

/** Index of the single keyboard row `word` is typed on, or -1. Needs ONE_ROW.minLen+ letters. */
export function oneRowOf(word) {
  const w = String(word || '').toLowerCase();
  if (w.length < ONE_ROW.minLen || !/^[a-z]+$/.test(w)) return -1;
  for (let r = 0; r < ROWS.length; r++) {
    let ok = true;
    for (const ch of w) if (!ROWS[r].includes(ch)) { ok = false; break; }
    if (ok) return r;
  }
  return -1;
}

/** The row the CURRENT draft still fits on (for the live hint), or -1. Any length ≥ 2. */
export function draftRowOf(draft) {
  const w = String(draft || '').toLowerCase();
  if (w.length < 2 || !/^[a-z]+$/.test(w)) return -1;
  for (let r = 0; r < ROWS.length; r++) if ([...w].every((c) => ROWS[r].includes(c))) return r;
  return -1;
}

// ---- AUTOCORRECT --------------------------------------------------------------------------
export const AUTOCORRECT = { pips: 4 };
const ABC = 'abcdefghijklmnopqrstuvwxyz';

/**
 * The best real word ONE edit away from `typed` (substitute / insert / delete / swap two
 * neighbours) that contains `fragment`, is in `accept` and is not in `used`. Prefers the more
 * common word (`rank`: Map word → frequency index, lower = more common), then a substitution
 * (keeps the length the player meant). Returns { word, kind, at } or null.
 *   kind: 'sub' | 'ins' | 'del' | 'swap'; at = index in the FIXED word of the changed letter.
 */
export function autocorrect(typed, fragment, accept, used, rank) {
  const t = String(typed || '').toLowerCase();
  const frag = String(fragment || '').toLowerCase();
  if (t.length < 2 || !/^[a-z]+$/.test(t)) return null;
  const cands = [];
  const consider = (w, kind, at) => {
    if (w.length < 3 || !w.includes(frag) || !accept.has(w) || (used && used.has(w))) return;
    cands.push({ word: w, kind, at });
  };
  for (let i = 0; i < t.length; i++) {
    for (const c of ABC) if (c !== t[i]) consider(t.slice(0, i) + c + t.slice(i + 1), 'sub', i);
  }
  for (let i = 0; i <= t.length; i++) {
    for (const c of ABC) consider(t.slice(0, i) + c + t.slice(i), 'ins', i);
  }
  for (let i = 0; i < t.length; i++) consider(t.slice(0, i) + t.slice(i + 1), 'del', Math.max(0, i - 1));
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i] === t[i + 1]) continue;
    consider(t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2), 'swap', i);
  }
  if (!cands.length) return null;
  const KIND_ORDER = { sub: 0, swap: 1, ins: 2, del: 3 };
  const r = (w) => (rank && rank.has(w) ? rank.get(w) : 1e9);
  cands.sort((a, b) => r(a.word) - r(b.word) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  return cands[0];
}

// ---- scoring ----------------------------------------------------------------------------
export const POINTS_PER_LETTER = 10;
export function wordPoints(word, mult = 1) {
  return Math.round(String(word).length * POINTS_PER_LETTER * mult);
}

// ---- the lab's power list (display + gating plan) -----------------------------------------
export const LAB_POWERS = [
  { id: 'breath', name: 'HOLD BREATH', how: 'HOLD SPACE', phone: 'HOLD THE PAD', kind: 'HOLD', tier: 'A2' },
  { id: 'windup', name: 'WIND-UP', how: 'HOLD ENTER', phone: 'HOLD GO', kind: 'HOLD', tier: 'A4' },
  { id: 'autocorrect', name: 'AUTOCORRECT', how: 'PASSIVE', phone: 'PASSIVE', kind: 'PASSIVE', tier: 'A1' },
  { id: 'onerow', name: 'ONE ROW', how: 'PASSIVE', phone: 'PASSIVE', kind: 'PASSIVE', tier: 'A3' },
];
