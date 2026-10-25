// navWipe.js — the ONE pooled screen-change transition (Andy oct24: "transition screens for all buttons (or at
// least major ones)"). A single overlay node (TransitionOverlay) is mounted ONCE for the life of the app and
// registers its parts here; every transition — a `view` change in App, or a menu sheet opening / closing
// (GEARS / ROLL, CONTRACTS, REWARDS, PROFILE) — replays the SAME nodes through WAAPI. No node is ever created
// per transition (CLAUDE.md "pool every repeated element"): the word is written into pooled letter spans.
//
// LOOK (Andy oct25: the painted swipe "doesnt cover edges, its too quick … not as clean as the original one"):
// the GAME TRANSITION SCREEN — TransitionIntro's fight card, trimmed for nav. Timeline (ms, a worded card):
//     0        the flat black field cuts in over every edge (no travelling band, so no edge ever shows)
//    20–300    line 1 PUNCHES in (intro-punch 2.05 → 1) with its letters machine-gunning in (type-letter-in)
//   110–370    line 2 (a two-word name: DAILY / BLITZ) DRAGS in heavier (intro-drag + die-letter-in), pink
//   120 / 230  impact: white frame + shake + the one-frame zoom punch (the intro's hits)
//   ~370–430   settled — held to read; the slash draws along the 4° seam
//   430–600    KNIFE-SPLIT: the live card cuts out onto two identical clipped halves, which part up / down
// A wordless card (a sheet closing) is the same cut + slash + split, ~340ms.
//
// PURELY COSMETIC (CLAUDE.md Known Bugs): callers swap the screen FIRST (or in the same tick) and this only
// lays the card on top — position:fixed, pointer-events:none. Nothing here returns a promise, gates, delays or
// blocks which screen is shown; a card that never plays loses nothing but motion.
//
// Motion law: transform + opacity ONLY, finite one-shots (no breathe / glitch / drip idles — those are the
// intro's, never the nav card's), no layout reads (sizes come from CSS; the only read is window.innerWidth, a
// cached viewport value, not layout), will-change set on play and cleared on finish, REDUCE MOTION skips it.
import { reduceMotion } from './reduceMotion.js';

export const WIPE_MS = 600;
export const SPLIT_AT = 430;
export const WORDLESS_MS = 340;
export const WORDLESS_SPLIT_AT = 160;
export const MAX_LETTERS = 16;
// ONE WIPE PER JOURNEY (Andy oct14 "weird yellow column"): a burst of view changes (READY? → SQUAD UP →
// LET'S GO!) gets one card, not three stacked on a mounting game.
export const COALESCE_MS = 900;

const LINE1_AT = 20;
const LINE2_AT = 110;
const HIT1_AT = LINE1_AT + 100;
const HIT2_AT = LINE2_AT + 120;
const SLASH_DRAW = 70;
const OPEN_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'; // KnifeSplit's open
const SHAKE_EASE = 'cubic-bezier(0.36, 0.07, 0.19, 0.97)';

let parts = null; // { root, live, stage, halves:[top,bottom], flash, slash, copies:[{slots,lines,letters}] }
let running = [];
let lastAt = -Infinity;
let lastResult = 'skipped'; // 'played' | 'skipped' (no overlay / reduce motion) | 'coalesced'

/** What the last playWipe call did — App's view-change whoosh plays unless the change was COALESCED. */
export function lastWipeResult() {
  return lastResult;
}

/** Called once by TransitionOverlay on mount. Returns the unregister function. */
export function registerWipe(p) {
  parts = p;
  return () => {
    stop();
    if (parts === p) parts = null;
  };
}

/** A destination name → at most two lines (the intro's TYPE FAST. / DIE SLOW. pair), each ≤ MAX_LETTERS. */
export function splitLines(word) {
  const w = String(word || '').trim().toUpperCase();
  if (!w) return [];
  const i = w.indexOf(' ');
  const lines = i < 0 ? [w] : [w.slice(0, i), w.slice(i + 1).trim()];
  return lines.filter(Boolean).map((l) => l.slice(0, MAX_LETTERS));
}

// per-SEGMENT easing (a CSS @keyframes timing function applies between each pair of keyframes; WAAPI's
// timing.easing would apply to the whole iteration — so the intro's curves are copied onto every frame)
const seg = (frames, easing) => frames.map((f, i) => (i < frames.length - 1 ? { ...f, easing } : f));

// the willChange writes: on for the card's life, off at rest (never on an idle pooled node)
function willChange(on) {
  if (!parts) return;
  const v = (s) => (on ? s : '');
  parts.root.style.willChange = v('transform');
  parts.live.style.willChange = v('opacity');
  parts.stage.style.willChange = v('transform');
  for (const h of parts.halves) h.style.willChange = v('transform');
  parts.slash.style.willChange = v('transform, opacity');
  for (const l of parts.copies[0].lines) l.style.willChange = v('transform');
}

function stop() {
  for (const a of running) {
    try { a.cancel(); } catch { /* already gone */ }
  }
  running = [];
  if (!parts) return;
  parts.root.dataset.state = 'idle';
  willChange(false);
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function fill(lines) {
  for (const c of parts.copies) {
    c.slots.forEach((slot, i) => {
      const text = lines[i] || '';
      slot.hidden = !text;
      c.letters[i].forEach((span, j) => {
        const ch = j < text.length ? text[j] : '';
        span.textContent = ch === ' ' ? ' ' : ch;
      });
    });
  }
}

/**
 * Play the card. `dir` 'forward' (deeper) or 'back' (returning: a one-line word goes DIE SLOW pink).
 * Returns true when a card actually started (false: reduced motion, coalesced, no overlay, no WAAPI).
 */
export function playWipe(word, dir = 'forward') {
  // the coalesce clock runs FIRST and ticks even when nothing can be drawn (no overlay yet, reduce motion), exactly
  // like the old App-side wipe: a journey is one journey whether or not it was animated
  const t0 = now();
  if (t0 - lastAt < COALESCE_MS) { lastResult = 'coalesced'; return false; }
  lastAt = t0;
  lastResult = 'skipped';
  if (!parts || reduceMotion()) return false;
  if (typeof parts.root.animate !== 'function') return false;
  lastResult = 'played';
  stop();
  const { root, live, stage, halves, flash, slash, copies } = parts;
  const lines = splitLines(word);
  const T = lines.length ? WIPE_MS : WORDLESS_MS;
  const S = lines.length ? SPLIT_AT : WORDLESS_SPLIT_AT;
  const at = (ms) => Math.min(1, ms / T);

  root.dataset.state = 'play';
  root.dataset.dir = dir === 'back' ? 'back' : 'forward';
  root.dataset.word = lines.join(' ');
  root.dataset.tone = lines.length === 1 && dir === 'back' ? 'pink' : 'cyan';
  root.style.setProperty('--nt-n', String(Math.max(4, ...lines.map((l) => l.length))));
  fill(lines);
  willChange(true);

  const go = (el, frames, timing) => {
    const a = el.animate(frames, timing);
    running.push(a);
    return a;
  };
  const card = { duration: T, easing: 'linear', fill: 'both' };

  // ---- the black field: the live card holds, cuts out at the split, the knife halves part ----
  go(live, [{ opacity: 1 }, { opacity: 1, offset: at(S) }, { opacity: 0, offset: at(S + 1) }, { opacity: 0 }], card);
  const [top, bottom] = halves;
  const open = (y) => [
    { transform: 'translateY(0)' },
    { transform: 'translateY(0)', offset: at(S), easing: OPEN_EASE },
    { transform: `translateY(${y})` },
  ];
  const clock = go(top, open('-130%'), card);
  go(bottom, open('130%'), card);
  // the slash draws along the seam just before the split, then fades as the halves part
  go(
    slash,
    [
      { transform: 'scaleX(0)', opacity: 1 },
      { transform: 'scaleX(0)', opacity: 1, offset: at(S - SLASH_DRAW), easing: 'cubic-bezier(0.1, 0.85, 0.3, 1)' },
      { transform: 'scaleX(1)', opacity: 1, offset: at(S) },
      { transform: 'scaleX(1)', opacity: 0, offset: at(S + 90) },
      { transform: 'scaleX(1)', opacity: 0 },
    ],
    card,
  );

  if (lines.length) {
    const [l1, l2] = copies[0].lines;
    const [ls1, ls2] = copies[0].letters;
    // LINE 1 = TYPE FAST: the whole word slams in huge and snaps to rest, letters machine-gun in place
    go(l1, seg([
      { transform: 'scale(2.05)' },
      { transform: 'scale(2)', offset: 0.12 },
      { transform: 'scale(0.86)', offset: 0.46 },
      { transform: 'scale(1.1)', offset: 0.66 },
      { transform: 'scale(0.97)', offset: 0.84 },
      { transform: 'scale(1)' },
    ], 'cubic-bezier(0.2, 1.4, 0.3, 1)'), { duration: 280, delay: LINE1_AT, fill: 'both' });
    const n1 = lines[0].length;
    const st1 = n1 > 1 ? Math.min(18, 160 / (n1 - 1)) : 0;
    for (let j = 0; j < n1; j += 1) {
      go(ls1[j], [
        { opacity: 0, transform: 'scale(1.35)', easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
        { opacity: 1, offset: 0.55 },
        { opacity: 1, transform: 'scale(1)' },
      ], { duration: 120, delay: LINE1_AT + j * st1, fill: 'both' });
    }
    // LINE 2 = DIE SLOW: heavier drag, tired letters dropping in
    if (lines[1]) {
      go(l2, seg([
        { transform: 'translateY(-0.06em) scale(1.32)' },
        { transform: 'translateY(-0.04em) scale(1.3)', offset: 0.16 },
        { transform: 'translateY(0.05em) scale(0.97)', offset: 0.62 },
        { transform: 'translateY(0) scale(1)' },
      ], 'cubic-bezier(0.22, 0.61, 0.36, 1)'), { duration: 260, delay: LINE2_AT, fill: 'both' });
      const n2 = lines[1].length;
      const st2 = n2 > 1 ? Math.min(20, 150 / (n2 - 1)) : 0;
      for (let j = 0; j < n2; j += 1) {
        go(ls2[j], [
          { opacity: 0, transform: 'translateY(-0.4em) scale(1.2)', easing: 'cubic-bezier(0.22, 0.7, 0.3, 1)' },
          { opacity: 1, transform: 'translateY(0.06em) scale(0.995)', offset: 0.65, easing: 'cubic-bezier(0.22, 0.7, 0.3, 1)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ], { duration: 170, delay: LINE2_AT + j * st2, fill: 'both' });
      }
    }

    // ---- the hits: white frame + shake + the one-frame zoom punch (the intro's impact) ----
    const k = typeof window !== 'undefined' && window.innerWidth <= 600 ? 0.45 : 1; // the intro's gentler phone shake
    const px = (x, y) => `translate(${Math.round(x * k)}px, ${Math.round(y * k)}px)`;
    const hit = (atMs, heavy) => {
      go(flash, [{ opacity: heavy ? 0.3 : 0.35 }, { opacity: 0 }], {
        duration: heavy ? 170 : 90, delay: atMs, easing: heavy ? 'steps(2, end)' : 'steps(1, end)',
      });
      const z = heavy ? 1.08 : 1.05;
      go(root, [
        { transform: `scale(${z})` },
        { transform: `scale(${z})`, offset: 0.5 },
        { transform: 'scale(1)', offset: 0.51 },
        { transform: 'scale(1)' },
      ], { duration: heavy ? 44 : 32, delay: atMs });
      // the heavy shake is trimmed (320 → 180ms) so it has fully settled before the split at 430
      go(stage, seg(heavy
        ? [{ transform: px(0, 0) }, { transform: px(-16, 9), offset: 0.18 }, { transform: px(14, -9), offset: 0.4 },
          { transform: px(-9, 5), offset: 0.62 }, { transform: px(6, -4), offset: 0.82 }, { transform: px(0, 0) }]
        : [{ transform: px(0, 0) }, { transform: px(-10, 6), offset: 0.2 }, { transform: px(9, -6), offset: 0.45 },
          { transform: px(-5, 3), offset: 0.7 }, { transform: px(3, -2), offset: 0.88 }, { transform: px(0, 0) }], SHAKE_EASE),
      { duration: heavy ? 180 : 260, delay: atMs });
    };
    hit(HIT1_AT, false);
    if (lines[1]) hit(HIT2_AT, true);
  }

  clock.onfinish = () => { if (running.includes(clock)) stop(); };
  return true;
}

/** Test seam: forget the coalesce clock. */
export function _resetWipeClock() {
  lastAt = -Infinity;
}
