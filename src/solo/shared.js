// shared.js — logic common to both solo modes (CHAIN + FUSE).
//
// Pure and framework-free. The React hooks own the clock and localStorage; this file
// holds the constants and helpers both modes agree on, so the two can't drift.

// ---- Red zone -------------------------------------------------------------------
// The clock turns hostile when this little time is left, in BOTH modes.
export const RED_ZONE_MS = 1600;

// ---- Arm state ------------------------------------------------------------------
// The run clock does NOT start until the player's first accepted character on word 1,
// so word 1 can't be lost before the rule has even been read. The prompt shown until
// then is PER-MODE now (each screen passes its own `armHint` to SoloShell), because the
// old shared line explained the clock, not the game.

// ---- Reject reasons -------------------------------------------------------------
// A rejected word NEVER clears the input and NEVER shakes — the sill flashes and one of
// these named reasons prints, so the player keeps the evidence of what they tried.
// Wording is deliberately "NOT IN OUR WORD LIST", never "NOT A WORD": it's our list.
export const REJECT = {
  TOO_SHORT: 'too_short',
  NOT_IN_LIST: 'not_in_list',
  ALREADY_USED: 'already_used',
  BAD_START: 'bad_start', // CHAIN: must start with the required letter
  BAD_CONTAIN: 'bad_contain', // FUSE: must contain the fragment
};

// Human-readable reason string for a reject code. `letter`/`fragment` fill the blanks.
export function rejectMessage(code, { letter = '', fragment = '' } = {}) {
  switch (code) {
    case REJECT.TOO_SHORT:
      return 'MIN 3 LETTERS';
    case REJECT.NOT_IN_LIST:
      return 'NOT IN OUR WORD LIST';
    case REJECT.ALREADY_USED:
      return 'ALREADY USED THIS RUN';
    case REJECT.BAD_START:
      return `MUST START WITH ${String(letter).toUpperCase()}`;
    case REJECT.BAD_CONTAIN:
      return `MUST CONTAIN ${String(fragment).toUpperCase()}`;
    default:
      return 'REJECTED';
  }
}

// ---- Restart arming -------------------------------------------------------------
// The death-card RESTART button is clickable at 0ms, but Enter-to-restart is armed
// only after a delay, so an Enter-masher can't skip the death card (it's the tutorial).
// The delay is longer on run 1, or on any run that ended under 3 words — the runs where
// the player most needs to actually read the card.
export const RESTART_ARM_MS = 400;
export const RESTART_ARM_MS_LONG = 900;

export function restartArmMs({ runIndex = 0, wordsThisRun = 0 } = {}) {
  if (runIndex <= 0 || wordsThisRun < 3) return RESTART_ARM_MS_LONG;
  return RESTART_ARM_MS;
}

// ---- Personal bests -------------------------------------------------------------
// localStorage-backed, every access wrapped: an absent/garbage value reads back as 0,
// and a storage-blocked browser degrades to "no best" instead of throwing into a run.
export function getPB(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

// Persist a new best only if it beats the stored one. Returns the best now on record.
export function setPB(key, value) {
  try {
    const prev = getPB(key);
    if (Number.isFinite(value) && value > prev) {
      localStorage.setItem(key, String(value));
      return value;
    }
    return prev;
  } catch {
    return Number.isFinite(value) ? value : 0;
  }
}

export const PB_KEYS = {
  CHAIN: 'wa_solo_chain_best',
  FUSE: 'wa_solo_fuse_best',
};

// ---- CHAIN run counter ----------------------------------------------------------
// Persisted count of CHAIN runs STARTED (all-time, this browser). Drives the first-run
// tutorial death card: run 1 gets the how-to-play card instead of the score card. Every
// access is wrapped, so a storage-blocked browser degrades to "always run 0" (which just
// means the tutorial card shows whenever the run also ended under 3 words).
const CHAIN_RUNS_KEY = 'taw.chain.runs';

export function getChainRuns() {
  try {
    const raw = localStorage.getItem(CHAIN_RUNS_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

// Increment on run START and return the new count (the count of THIS run). Falls back to
// getChainRuns()+1 without persisting if storage throws.
export function bumpChainRuns() {
  const next = getChainRuns() + 1;
  try {
    localStorage.setItem(CHAIN_RUNS_KEY, String(next));
  } catch {
    // storage blocked — the return value still lets this run behave correctly
  }
  return next;
}

// ---- FUSE run counter (Job 14) ---------------------------------------------------
// Parallel to CHAIN's: drives FUSE's first-run tutorial death card (run 1, or any run that
// ended under 3 words, gets the how-to-play card instead of the score card). Guarded.
const FUSE_RUNS_KEY = 'taw.fuse.runs';

export function getFuseRuns() {
  try {
    const raw = localStorage.getItem(FUSE_RUNS_KEY);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function bumpFuseRuns() {
  const next = getFuseRuns() + 1;
  try {
    localStorage.setItem(FUSE_RUNS_KEY, String(next));
  } catch {
    /* storage blocked — the return value still lets this run behave correctly */
  }
  return next;
}

// ---- Accepted-word submit (shared by both solo screens) -------------------------
// Runs the engine's submit and, ONLY on an accepted word, fires the onAccept side-effect exactly
// once. CHAIN and FUSE both drive their engine through this one path (via useSoloGame), so the
// "a word was accepted" hook — currently bumping the daily streak, see progress/streak.touchStreak
// — is wired identically for both and can't be attached to one mode but forgotten on the other.
// The touch fires PER ACCEPTED WORD (mid-run), never on run-over, so a player who never finishes a
// run still counts the day. A rejected word fires nothing. Returns the engine result unchanged.
export function submitSoloWord(engine, word, onAccept) {
  const r = engine.submit(word);
  if (r && r.ok && typeof onAccept === 'function') onAccept();
  return r;
}

// ---- Seeded RNG -----------------------------------------------------------------
// mulberry32 — a tiny deterministic PRNG. The engines take an injected rng (default
// Math.random) so simulations/tests are reproducible. Same idiom as the satRush tests.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
