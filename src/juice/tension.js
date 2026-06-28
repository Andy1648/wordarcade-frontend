// src/juice/tension.js
// JUICE 02 — the Word Bomb tension SKIN. Purely presentational: it READS the
// game's remaining-time fraction (fed in from the Word Bomb view) and maps it to
// a 0..1 tension `t = 1 - remainingFraction`, then escalates the visuals + audio.
//
// IT IS NOT A CLOCK. It never counts down on its own — `t` only moves when the
// real remaining time is fed via tensionSetRatio(). Between feeds the DISPLAYED
// t merely EASES toward that real target so it looks smooth at 60fps; it can
// never run past or drive the real timer. Tension reaching 1 does NOT cause the
// explosion — the game's existing timeout/elimination event is the sole trigger.
//
// It draws on the ONE shared juice canvas (via particles.setOverlay) inside the
// ONE shared rAF loop, and builds its rumble/siren on the ONE shared
// AudioContext. The existing --danger vignette, bomb rattle, heartbeat, colour
// drain and panic pose are left untouched — this only adds the layers that
// weren't already there (edge colour grade, speed lines, HURRY!/GET OUT! prompt,
// final throb, rumble + siren).

import { setOverlay } from './particles';
import { getJuiceCtx, getJuiceMaster } from './audio';
import { reduced, soundAllowed } from './settings';
import { JUICE } from './config';

const T = JUICE.TENSION;

// --- state -----------------------------------------------------------------
let active = false;
let targetT = 0; // real tension target (from the fed remaining-time fraction)
let shownT = 0; // eased, displayed tension (what we render this frame)
let promptPhase = 0; // accumulates for the prompt pulse
let finalPhase = 0; // accumulates for the final-moment throb
let sirenPhase = 0; // accumulates for the siren sweep

// --- audio voices (built lazily on the shared context, torn down fully) ------
let rumbleOsc = null;
let rumbleGain = null;
let sirenOsc = null;
let sirenGain = null;

function buildAudio() {
  if (rumbleOsc) return; // already built
  const ctx = getJuiceCtx();
  const master = getJuiceMaster();
  if (!ctx || !master) return;
  try {
    // Low rumble drone: a detuned-ish sine bed. Gain rides t (starts at 0).
    rumbleGain = ctx.createGain();
    rumbleGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    rumbleGain.connect(master);
    rumbleOsc = ctx.createOscillator();
    rumbleOsc.type = 'sine';
    rumbleOsc.frequency.setValueAtTime(T.audio.rumble.baseFreq, ctx.currentTime);
    rumbleOsc.connect(rumbleGain);
    rumbleOsc.start();

    // Siren: a triangle whose pitch sweeps; gain only opens past siren.start.
    sirenGain = ctx.createGain();
    sirenGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    sirenGain.connect(master);
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.setValueAtTime(T.audio.siren.lo, ctx.currentTime);
    sirenOsc.connect(sirenGain);
    sirenOsc.start();
  } catch {
    teardownAudio();
  }
}

// Stop + DISCONNECT every tension node so nothing dangles or bleeds into the
// menu / next round. Safe to call repeatedly.
function teardownAudio() {
  for (const node of [rumbleOsc, sirenOsc]) {
    try { node && node.stop(); } catch { /* already stopped */ }
    try { node && node.disconnect(); } catch { /* noop */ }
  }
  for (const node of [rumbleGain, sirenGain]) {
    try { node && node.disconnect(); } catch { /* noop */ }
  }
  rumbleOsc = rumbleGain = sirenOsc = sirenGain = null;
}

// Drive the voices from the displayed t each frame. Mute or inactivity tears the
// nodes down entirely (no silent-but-running oscillators).
function updateAudio(t, dt) {
  if (!active || !soundAllowed()) {
    teardownAudio();
    return;
  }
  buildAudio();
  const ctx = getJuiceCtx();
  if (!ctx || !rumbleGain) return;
  const now = ctx.currentTime;
  const ease = Math.min(1, T.audio.gainEase * dt);

  // Rumble: ramps in from rumble.start, pitch climbs with t.
  const r = T.audio.rumble;
  const rT = t > r.start ? (t - r.start) / (1 - r.start) : 0;
  const rGain = rT * rT * r.maxGain;
  rumbleGain.gain.setTargetAtTime(Math.max(0.0001, rGain), now, 0.05);
  try { rumbleOsc.frequency.setTargetAtTime(r.baseFreq + r.freqRise * rT, now, 0.1); } catch { /* noop */ }

  // Siren: only past siren.start; sweeps lo<->hi.
  const s = T.audio.siren;
  if (t > s.start && sirenGain) {
    sirenPhase += dt * s.sweepHz;
    const sweep = (Math.sin(sirenPhase * Math.PI * 2) + 1) / 2; // 0..1
    const sT = (t - s.start) / (1 - s.start);
    sirenGain.gain.setTargetAtTime(Math.max(0.0001, sT * s.maxGain), now, 0.05);
    try { sirenOsc.frequency.setTargetAtTime(s.lo + (s.hi - s.lo) * sweep, now, 0.03); } catch { /* noop */ }
  } else if (sirenGain) {
    sirenGain.gain.setTargetAtTime(0.0001, now, 0.08);
  }
  void ease;
}

// --- colour helpers --------------------------------------------------------
function lerp(a, b, k) { return a + (b - a) * k; }
function gradeColor(t) {
  // teal -> orange across 0..0.6, orange -> red across 0.6..1
  const g = T.colorGrade;
  let c;
  if (t < 0.6) {
    const k = t / 0.6;
    c = [lerp(g.calm[0], g.warn[0], k), lerp(g.calm[1], g.warn[1], k), lerp(g.calm[2], g.warn[2], k)];
  } else {
    const k = (t - 0.6) / 0.4;
    c = [lerp(g.warn[0], g.crit[0], k), lerp(g.warn[1], g.crit[1], k), lerp(g.warn[2], g.crit[2], k)];
  }
  return c.map((n) => Math.round(n));
}

// --- the per-frame overlay (drawn behind particles, on the shared canvas) ----
function draw(ctx, w, h, dt, frozen) {
  // Ease the displayed t toward the real target (NOT a countdown — purely visual
  // smoothing of the fed value). Frozen (hitStop) holds the frame.
  if (!frozen) {
    shownT += (targetT - shownT) * Math.min(1, T.ease * dt);
    if (Math.abs(targetT - shownT) < 0.001) shownT = targetT;
  }
  const t = shownT;
  updateAudio(t, frozen ? 0 : dt);
  if (t <= 0.001) return; // calm: nothing to paint

  const isReduced = reduced();

  // 1) Edge colour grade — transparent-centre radial tint, alpha ramps with t.
  const grade = T.colorGrade;
  const cap = isReduced ? grade.reducedCap : grade.capAlpha;
  const alpha = Math.min(cap, cap * t);
  if (alpha > 0.002) {
    const [cr, cg, cb] = gradeColor(t);
    const cx = w / 2;
    const cy = h / 2;
    const rad = Math.hypot(w, h) / 2;
    const grad = ctx.createRadialGradient(cx, cy, rad * grade.innerStop, cx, cy, rad);
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},${alpha.toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Reduced motion stops here (faint colour shift only — no streaks/throb/text).
  if (isReduced) return;

  // 2) Edge speed lines — vertical streaks hugging the L/R edges.
  const sl = T.speedLines;
  if (t > sl.start) {
    const k = (t - sl.start) / (1 - sl.start);
    const n = Math.round(sl.maxPerSide * k);
    ctx.lineWidth = 2;
    for (let side = 0; side < 2; side++) {
      const baseX = side === 0 ? 0 : w - sl.edgeBand;
      for (let i = 0; i < n; i++) {
        const x = baseX + (0.15 + 0.7 * ((i * 73.13 + finalPhase * 40) % 1)) * sl.edgeBand;
        const len = h * (0.18 + 0.5 * ((i * 51.7) % 1));
        const y = ((i * 97.31 + finalPhase * 220) % 1) * (h + len) - len;
        ctx.strokeStyle = `rgba(${sl.color},${(sl.maxAlpha * k).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + len);
        ctx.stroke();
      }
    }
  }

  // 3) Prompt — HURRY! then GET OUT!, pulsing, centre-top (above the bomb).
  const pr = T.prompt;
  if (t > pr.hurryAt) {
    promptPhase += dt;
    const getOut = t > pr.getOutAt;
    const label = getOut ? pr.getOut : pr.hurry;
    const pulse = 1 + 0.12 * Math.sin(promptPhase * Math.PI * 2 * pr.pulseHz);
    const size = pr.size * pulse * (getOut ? 1.15 : 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, (t - pr.hurryAt) / 0.15);
    ctx.fillStyle = getOut ? pr.critColor : pr.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = Math.max(3, size * 0.12);
    ctx.font = `700 ${size.toFixed(0)}px Bungee, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const px = w / 2;
    const py = Math.min(h * 0.16, 120);
    ctx.strokeText(label, px, py);
    ctx.fillText(label, px, py);
    ctx.restore();
  }

  // 4) Final-moment throb — soft red full-screen breath (opacity only, no timing).
  const fp = T.finalPulse;
  if (t > fp.start) {
    finalPhase += dt;
    const breath = (Math.sin(finalPhase * Math.PI * 2 * fp.hz) + 1) / 2;
    const a = fp.maxAlpha * ((t - fp.start) / (1 - fp.start)) * breath;
    ctx.fillStyle = `rgba(${fp.color},${a.toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  } else {
    // keep finalPhase advancing a touch so speed-line scroll stays lively
    finalPhase += dt * 0.5;
  }
}

// --- public lifecycle API --------------------------------------------------
// Start the tension skin (install the overlay on the shared loop). Idempotent.
export function tensionStart() {
  if (active) return;
  active = true;
  setOverlay(draw);
}

// Feed the REAL remaining-time fraction (0..1). Forces calm during the countdown
// / at game over. Read-only — this never changes the timer.
export function tensionSetRatio(remainingFraction, opts = {}) {
  if (opts.showCountdown || opts.gameOver) {
    targetT = 0;
    return;
  }
  const frac = Math.max(0, Math.min(1, remainingFraction));
  targetT = 1 - frac;
}

// Fully stop: remove the overlay, disconnect every audio node, reset state. Call
// on round end / explosion / leave / unmount / mute. Idempotent.
export function tensionStop() {
  active = false;
  targetT = 0;
  shownT = 0;
  promptPhase = finalPhase = sirenPhase = 0;
  setOverlay(null);
  teardownAudio();
}
