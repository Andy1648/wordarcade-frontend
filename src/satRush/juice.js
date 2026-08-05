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
  ring,
  screenFlash,
  sfx,
  validCue,
  scoreTick,
  fanfare,
  defeatTone,
  sparkle,
  unlockAudio,
} from '../juice';

const VIOLET = '#a855f7';
const CHROME = '#e8eef5';
const AMBER = '#ffc53d';
const RED = '#ff3d6e';
const WHITE = '#ffffff';

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
    flash(m, VIOLET);
  }
  // Higher stage = lower ante = lower pitch. scoreTick maps 0..1 -> pitch.
  scoreTick(maxStage > 0 ? 1 - stage / maxStage : 0);
}

// --- a correct clear --------------------------------------------------------
// Colour + intensity scale with the word's state. validCue's pitch rises with
// the streak so a hot run reads as higher-stakes.
export function answerCorrect({ streak = 0, viaAlt = false, silver, deepCut, revenant } = {}) {
  const { x, y } = centerOf('.sr-slots', centerOf('.sr-card'));
  const color = revenant ? RED : deepCut ? AMBER : silver ? CHROME : VIOLET;
  const card = el('.sr-card');
  if (card) flash(card, color);
  validCue(streak);
  const big = deepCut || silver;
  burst(x, y, {
    count: viaAlt ? 10 : big ? 30 : 18,
    colors: [color, WHITE],
    speed: big ? 320 : 240,
    life: 0.7,
  });
  ring(x, y, { radius: big ? 150 : 110, color, width: 4 });
  if (deepCut) {
    // the +150 flourish
    sparkle();
    screenFlash({ alpha: 0.18, color: AMBER, life: 0.2 });
  }
}

// --- a rejected keystroke ---------------------------------------------------
// Layered on top of the CSS shake/bad-pulse: a low buzz + a small red screen
// wash so the reject reads without ever stranding the player.
export function wrongKey() {
  sfx('reject');
  screenFlash({ alpha: 0.1, color: RED, life: 0.14 });
  shake(4, 220);
}

// --- PRIORITY 2: SILVER TONGUE — the biggest moment -------------------------
// Entry: a brief world-stop, a chrome flash-over, a fat burst + double ring, and
// a bright fanfare. This should feel like the mode cracking open.
export function silverEnter() {
  const { x, y } = centerOf('.sr-card');
  hitStop(90); // fire-and-forget freeze; particles hold mid-air
  screenFlash({ alpha: 0.55, color: CHROME, life: 0.32 });
  burst(x, y, { count: 64, colors: [CHROME, WHITE, VIOLET], speed: 460, life: 1.1 });
  ring(x, y, { radius: 260, color: CHROME, width: 6, life: 0.6 });
  ring(x, y, { radius: 170, color: WHITE, width: 3, life: 0.5 });
  shake(7, 360);
  fanfare();
  sparkle();
}

// Break: the chrome shatters. A colder flash, a grey shard burst, a hard shake
// and a downward tone — the loss of the flex, distinct from a normal miss.
export function silverBreak() {
  const { x, y } = centerOf('.sr-card');
  screenFlash({ alpha: 0.4, color: CHROME, life: 0.26 });
  burst(x, y, { count: 40, colors: ['#c9d3df', '#8a95a6', CHROME], speed: 380, life: 0.9 });
  shake(9, 380);
  defeatTone();
}

// --- PRIORITY 3: Deep Cut ---------------------------------------------------
// Entry: a low whoosh, an amber wash + ring, a small shake — a dramatic arrival.
export function deepCutEnter() {
  const { x, y } = centerOf('.sr-card');
  sfx('open');
  screenFlash({ alpha: 0.22, color: AMBER, life: 0.34 });
  ring(x, y, { radius: 220, color: AMBER, width: 5, life: 0.6 });
  shake(4, 300);
}

// --- PRIORITY 4: Revenant — glitchy red entry -------------------------------
export function revenantEnter() {
  const { x, y } = centerOf('.sr-card');
  sfx('slash');
  // Two quick offset red washes read as a glitch stutter.
  screenFlash({ alpha: 0.24, color: RED, life: 0.12 });
  shake(7, 320);
  setTimeout(() => screenFlash({ alpha: 0.16, color: RED, life: 0.12 }), 90);
  ring(x, y, { radius: 150, color: RED, width: 3, life: 0.4 });
}

// A plain miss (life lost, no silver to break): a red wash + KO thud + shake.
export function miss() {
  sfx('ko');
  screenFlash({ alpha: 0.3, color: RED, life: 0.28 });
  shake(6, 340);
}

// --- PRIORITY 5: death ------------------------------------------------------
// The final life. A heavy world-stop + white-out; the results screen picks up
// the score reveal from here.
export function death() {
  hitStop(120);
  sfx('ko');
  defeatTone();
  screenFlash({ alpha: 0.7, color: WHITE, life: 0.4 });
  shake(11, 460);
}

// --- results-screen celebration primitives (reused from the shared layer) ---
export { scoreTick, sfx as resultSfx, burst as resultBurst, screenFlash as resultFlash };
export function resultsStamp() {
  sfx('ko'); // heavy slam for the DEAD stamp
  screenFlash({ alpha: 0.5, color: WHITE, life: 0.3 });
  shake(6, 320);
}
export function resultsSting() {
  defeatTone();
}
export function resultsBest() {
  sparkle();
}
