// xp.js — the menu XP meta-progression MODEL. Pure and framework-free (no DOM, no React,
// no timers): the React layer owns the keydown capture, the clock, and the DOM; this file
// owns the numbers, the rate cap, and the localStorage bridge. Kept pure so the level
// curve and the anti-mash cap are unit-testable under node.
//
// Currency is XP (not letters). A menu keystroke is worth 1 XP; game modes multiply the
// per-word/letter award. `lifetimeLetters` counts RAW keystrokes (unmultiplied) and is a
// SEPARATE running total for a future profile screen — never surfaced on the menu.

// Per-source XP multipliers, all in one place. Menu typing is the 1x baseline.
export const XP_MULTIPLIERS = {
  menu: 1,
  'word-bomb': 2,
  'category-blitz': 2,
  'sat-rush': 3,
};

// Cost to advance FROM level n to n+1. Superlinear so later levels take real play.
//   need(1)=10  need(5)=112  need(10)=316  need(20)=894
export function need(n) {
  return Math.round(10 * Math.pow(n, 1.5));
}

// Level (and progress within it) derived from a cumulative XP total. Level 1 starts at
// 0 XP. Returns the level, XP into the current level, that level's cost, the remainder to
// the next level, and the 0..1 fill fraction for the bar.
export function levelFromXp(xp) {
  const total = Number.isFinite(xp) && xp > 0 ? xp : 0;
  let level = 1;
  let spent = 0; // cumulative cost consumed to REACH `level`
  while (total - spent >= need(level)) {
    spent += need(level);
    level += 1;
  }
  const cost = need(level);
  const intoLevel = total - spent;
  return {
    level,
    intoLevel,
    cost,
    toNext: cost - intoLevel,
    frac: cost > 0 ? intoLevel / cost : 0,
  };
}

// Apply a credited award. Pure: returns the next {xp, lifetimeLetters} and whether the
// award crossed a level boundary (so the caller can fire the one-shot celebration).
export function creditXp(state, xpGain, rawKeys = 1) {
  const prev = {
    xp: Number.isFinite(state && state.xp) ? state.xp : 0,
    lifetimeLetters: Number.isFinite(state && state.lifetimeLetters) ? state.lifetimeLetters : 0,
  };
  const beforeLevel = levelFromXp(prev.xp).level;
  const next = {
    xp: prev.xp + xpGain,
    lifetimeLetters: prev.lifetimeLetters + rawKeys,
  };
  const afterLevel = levelFromXp(next.xp).level;
  return { state: next, leveledUp: afterLevel > beforeLevel, level: afterLevel };
}

// Anti-mash rate cap: at most `capacity` credited keystrokes per rolling `windowMs`. Pure
// given an injected `now` (ms). Over-cap calls return false so the caller drops them
// silently (no XP, no popup, no sound). Held keys / modifier chords are filtered upstream
// by isCreditableKey, not here.
export function createRateLimiter({ capacity = 16, windowMs = 1000 } = {}) {
  let stamps = [];
  return {
    tryConsume(now) {
      stamps = stamps.filter((t) => now - t < windowMs);
      if (stamps.length >= capacity) return false;
      stamps.push(now);
      return true;
    },
  };
}

// Is this keydown a creditable menu keystroke? Single a-z/0-9 character, not an
// auto-repeat, no ctrl/meta/alt, and NOT typed into a real field (input/textarea/
// contenteditable). The dialog/modal-open guard is DOM/app state and lives in the caller.
export function isCreditableKey(e) {
  if (!e) return false;
  if (e.repeat) return false;
  if (e.ctrlKey || e.metaKey || e.altKey) return false;
  const k = e.key;
  if (typeof k !== 'string' || k.length !== 1 || !/[a-z0-9]/i.test(k)) return false;
  const t = e.target;
  if (t) {
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return false;
    if (t.isContentEditable) return false;
  }
  return true;
}

// ---- Persistence ---------------------------------------------------------------------
// { xp, lifetimeLetters } ⇄ localStorage taw.xp / taw.letters. Every access wrapped: a
// storage-blocked or storage-less environment reads back 0 and never throws.
export const XP_KEY = 'taw.xp';
export const LETTERS_KEY = 'taw.letters';

function readNum(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function loadProgress() {
  return { xp: readNum(XP_KEY), lifetimeLetters: readNum(LETTERS_KEY) };
}

export function saveProgress(state) {
  try {
    localStorage.setItem(XP_KEY, String(state.xp));
    localStorage.setItem(LETTERS_KEY, String(state.lifetimeLetters));
  } catch {
    // storage blocked — progress simply isn't persisted this session.
  }
}
