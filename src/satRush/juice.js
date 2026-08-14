// satRush/juice.js — SAT RUSH game-feel, built ENTIRELY on the shared juice
// primitives (../juice). No new canvas, no new AudioContext, no parallel system:
// every effect here is a composition of squash/flash/shake/hitStop, burst/ring/
// screenFlash, and the synthesized cues. All primitives already honor
// prefers-reduced-motion and the global motion/sound flags, so callers just call.
//
// Priority (per the build spec): the multiplier drop + its tick is the mechanic
// and gets the most attention; SILVER TONGUE entry/break is the biggest moment;
// then Deep Cut, Revenant, and the death/score reveal.
import {
  squash,
  flash,
  shake,
  hitStop,
  setShakeRoot,
  burst,
  screenFlash,
  sfx,
  validCue,
  scoreTick,
  fanfare,
  defeatTone,
  sparkle,
  unlockAudio,
} from '../juice';

// Print-role palette. The retro-print rebuild moved the STATE visuals onto the
// page itself (stamps, the black corner ribbon, the negative-reprint invert, the
// page tear), so the per-event particle bursts / screen washes are gone — cues
// stay, screen-wide spam went. What survives here mostly plays sound; only a few
// rare, high-impact moments (silver break, death) keep a wash. STRICT DUOTONE:
// every wash/shard is INK or PAPER — no spot colour, no chrome greys, no white, no
// red. Danger reads through heavy ink + jagged form + screentone. Deep Cut is its
// audio cue + the CSS treatment (form, not colour).
const INK = '#111111';
const PAPER = '#f0ead9';

const el = (sel) => (typeof document !== 'undefined' ? document.querySelector(sel) : null);
function centerOf(sel, fallback) {
  const node = el(sel);
  if (!node) return fallback || { x: 0, y: 0 };
  const r = node.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Call inside a real user gesture (Play click / first keydown) so later cues can
// sound. Safe to call repeatedly.
export { unlockAudio };

// Scope screen-shake to this mode's container (Word Bomb retargets the shake root
// to its own wrapper, so SAT RUSH must claim it on mount and release it on exit,
// or shake would target a stale/detached node). Pass null to release.
export function setShakeTarget(elm) {
  setShakeRoot(elm || null);
}

// --- PRIORITY 1: the multiplier drop ---------------------------------------
// Fires on every stage advance. The number punches and dims, and a pitched tick
// DESCENDS with the ante so "the value is dropping" is felt as much as seen.
export function multiplierDrop(stage, maxStage) {
  const m = el('.sr-mult');
  if (m) {
    squash(m);
    flash(m, INK);
  }
  // Higher stage = lower ante = lower pitch. scoreTick maps 0..1 -> pitch.
  scoreTick(maxStage > 0 ? 1 - stage / maxStage : 0);
}

// --- a correct clear --------------------------------------------------------
// The clear's VISUALS now live on the page (the "GOT IT!" / "CLOSE!" stamp, the
// tile squash). juice just plays the cue, whose pitch rises with the streak so a
// hot run reads as higher-stakes. No burst, no ring, no card flash.
export function answerCorrect({ streak = 0 } = {}) {
  validCue(streak);
}

// --- a rejected keystroke ---------------------------------------------------
// Carried visually by the CSS shake / bad-pulse + the "TCH!" tick; juice just
// plays the buzz (no screen wash, no juice shake — the CSS wiring owns the shake).
export function wrongKey() {
  sfx('reject');
}

// --- PRIORITY 2: SILVER TONGUE — the biggest moment -------------------------
// The page REPRINTS IN NEGATIVE (CSS invert + a 2-frame impact flash) — the state
// IS the visual. juice just lands the fanfare.
export function silverEnter() {
  fanfare();
}

// Break: the existing shatter cue — a wash + a grey shard burst + a hard shake +
// a downward tone — fires as the page snaps back out of negative.
export function silverBreak() {
  const { x, y } = centerOf('.sr-card');
  screenFlash({ alpha: 0.4, color: PAPER, life: 0.26 });
  burst(x, y, { count: 40, colors: [INK, PAPER], speed: 380, life: 0.9 });
  shake(9, 380);
  defeatTone();
}

// --- PRIORITY 3: Deep Cut ---------------------------------------------------
// Marked for the whole word by the black corner ribbon (CSS); arrival is its whoosh.
export function deepCutEnter() {
  sfx('open');
}

// --- PRIORITY 4: Revenant ---------------------------------------------------
// The "IT'S BACK" stamp (CSS) carries the arrival; juice plays the slash.
export function revenantEnter() {
  sfx('slash');
}

// A plain miss (life lost, no silver to break): the "MISS!!" stamp + page tear
// (CSS) carry it; the KO thud + a shake stay (shake is kept for miss + death).
export function miss() {
  sfx('ko');
  shake(6, 340);
}

// --- PRIORITY 5: death ------------------------------------------------------
// The final life. A heavy world-stop + white-out; the results screen picks up
// the score reveal from here.
export function death() {
  hitStop(120);
  sfx('ko');
  defeatTone();
  screenFlash({ alpha: 0.7, color: PAPER, life: 0.4 });
  shake(11, 460);
}

// --- results-screen celebration primitives (reused from the shared layer) ---
export { scoreTick, sfx as resultSfx, burst as resultBurst, screenFlash as resultFlash };
export function resultsStamp() {
  sfx('ko'); // heavy slam for the DEAD stamp
  screenFlash({ alpha: 0.5, color: PAPER, life: 0.3 });
  shake(6, 320);
}
export function resultsSting() {
  defeatTone();
}
export function resultsBest() {
  sparkle();
}
