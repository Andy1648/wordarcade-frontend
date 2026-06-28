// src/juice/particles.js
// ONE shared full-screen canvas + ONE rAF loop for ALL particle sprays in the
// app (never per-component), driven by a fixed pre-allocated pool so a burst
// allocates nothing per frame. A second, lower canvas holds persistent "marks"
// (splats) for accumulating graffiti. Both canvases and the loop are created
// lazily on first use, so importing this module has no side effects.

import { motionFlag, reduced } from './settings';
import { isHitStopped } from './motion';

const POOL_CAP = 300; // hard ceiling on simultaneous particles
const PALETTE = ['#FF2EC4', '#2EFFE0', '#FFE94A', '#FF6B3D', '#9A1AFF'];
const GRAVITY = 900; // px/s^2
const DRAG = 2.5; // velocity damping per second

let fxCanvas = null, fxCtx = null; // top spray layer
let bgCanvas = null, bgCtx = null; // back persistent-mark layer
let pool = null;
let rafId = 0;
let lastT = 0;
let dpr = 1;
let resizeBound = false;
const marks = []; // persistent splats, kept so we can redraw on resize

// Shockwave rings, a full-screen flash, and rising floating letters all share
// the ONE fx canvas + the ONE rAF loop below (no new canvas, no new loop).
const rings = []; // { x, y, maxR, life, maxLife, color, width }
const floaters = []; // { x, y, vy, char, life, maxLife, color, size }
let flash = null; // { life, maxLife, color, peak }

// --- canvas plumbing -------------------------------------------------------
function styleOverlay(c, z) {
  Object.assign(c.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: String(z),
  });
  c.setAttribute('aria-hidden', 'true');
}

function sizeCanvas(c, ctx) {
  dpr = Math.min(window.devicePixelRatio || 1, 2); // cap DPR so huge retina areas stay cheap
  c.width = Math.max(1, Math.floor(window.innerWidth * dpr));
  c.height = Math.max(1, Math.floor(window.innerHeight * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
}

function onResize() {
  if (fxCanvas) sizeCanvas(fxCanvas, fxCtx);
  if (bgCanvas) {
    sizeCanvas(bgCanvas, bgCtx);
    bgCtx.clearRect(0, 0, bgCanvas.width / dpr, bgCanvas.height / dpr);
    for (let i = 0; i < marks.length; i++) drawMark(marks[i]); // marks survive resize
  }
}

function bindResize() {
  if (resizeBound) return;
  window.addEventListener('resize', onResize, { passive: true });
  resizeBound = true;
}

function makePool() {
  const arr = new Array(POOL_CAP);
  for (let i = 0; i < POOL_CAP; i++) {
    arr[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 0, color: '#fff', rot: 0, vr: 0 };
  }
  return arr;
}

function ensureFx() {
  if (fxCanvas) return;
  fxCanvas = document.createElement('canvas');
  styleOverlay(fxCanvas, 2147483646); // on top of app UI
  document.body.appendChild(fxCanvas);
  fxCtx = fxCanvas.getContext('2d');
  sizeCanvas(fxCanvas, fxCtx);
  if (!pool) pool = makePool();
  bindResize();
}

function ensureBg() {
  if (bgCanvas) return;
  bgCanvas = document.createElement('canvas');
  styleOverlay(bgCanvas, 0); // sits behind app content
  document.body.appendChild(bgCanvas);
  bgCtx = bgCanvas.getContext('2d');
  sizeCanvas(bgCanvas, bgCtx);
  bindResize();
}

// --- the single shared rAF loop -------------------------------------------
function tick(now) {
  rafId = 0;
  const dt = lastT ? Math.min((now - lastT) / 1000, 0.05) : 0.016;
  lastT = now;
  const frozen = isHitStopped(); // hitStop freezes the spray mid-air

  fxCtx.clearRect(0, 0, fxCanvas.width / dpr, fxCanvas.height / dpr);
  let any = false;
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (!p.active) continue;
    any = true;
    if (!frozen) {
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += GRAVITY * dt;
      p.vx -= p.vx * DRAG * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    fxCtx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife)); // alpha = life fade
    fxCtx.save();
    fxCtx.translate(p.x, p.y);
    fxCtx.rotate(p.rot);
    fxCtx.fillStyle = p.color;
    const s = p.size;
    fxCtx.fillRect(-s / 2, -s / 2, s, s);
    fxCtx.restore();
  }

  // Shockwave rings: expand from r0 to maxR over their life, stroke fades out.
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    if (!frozen) {
      r.life -= dt;
      if (r.life <= 0) { rings.splice(i, 1); continue; }
    }
    any = true;
    const t = 1 - r.life / r.maxLife; // 0 -> 1 as it expands
    const cur = 4 + (r.maxR - 4) * t;
    fxCtx.globalAlpha = Math.max(0, r.life / r.maxLife);
    fxCtx.lineWidth = Math.max(0.5, r.width * (1 - t * 0.6));
    fxCtx.strokeStyle = r.color;
    fxCtx.beginPath();
    fxCtx.arc(r.x, r.y, cur, 0, Math.PI * 2);
    fxCtx.stroke();
  }

  // Floating letters: rise + fade.
  if (floaters.length) {
    fxCtx.textAlign = 'center';
    fxCtx.textBaseline = 'middle';
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      if (!frozen) {
        f.life -= dt;
        if (f.life <= 0) { floaters.splice(i, 1); continue; }
        f.y += f.vy * dt;
        f.vy *= 1 - 0.6 * dt; // ease the rise
      }
      any = true;
      fxCtx.globalAlpha = Math.max(0, f.life / f.maxLife);
      fxCtx.fillStyle = f.color;
      fxCtx.font = `700 ${f.size}px "Space Mono", monospace`;
      fxCtx.fillText(f.char, f.x, f.y);
    }
  }

  // Full-screen flash, drawn last so it sits over everything on the fx layer.
  if (flash) {
    if (!frozen) {
      flash.life -= dt;
      if (flash.life <= 0) flash = null;
    }
    if (flash) {
      any = true;
      fxCtx.globalAlpha = Math.max(0, flash.life / flash.maxLife) * flash.peak;
      fxCtx.fillStyle = flash.color;
      fxCtx.fillRect(0, 0, fxCanvas.width / dpr, fxCanvas.height / dpr);
    }
  }

  fxCtx.globalAlpha = 1;
  // Keep looping while anything lives; idle to save battery when it all dies.
  if (any) rafId = requestAnimationFrame(tick);
  else lastT = 0;
}

// Start the shared loop if it isn't already running.
function kick() {
  if (!rafId) {
    lastT = 0;
    rafId = requestAnimationFrame(tick);
  }
}

// --- public API ------------------------------------------------------------
// burst(x, y, opts): spray particles from a point. opts: count, colors[],
// speed, spread (radians), angle (base direction, radians), sizeMin/sizeMax,
// life (seconds). Reduced-motion drops the count; motion-off skips it. Never
// exceeds the pool cap (extra requested particles are simply dropped).
export function burst(x, y, opts = {}) {
  if (!motionFlag()) return; // hard off switch
  ensureFx();
  let count = opts.count ?? 14;
  if (reduced()) count = Math.max(3, Math.round(count * 0.3));
  const colors = opts.colors || PALETTE;
  const speed = opts.speed ?? 260;
  const spread = opts.spread ?? Math.PI * 2; // full circle by default
  const angle = opts.angle ?? -Math.PI / 2; // upward base
  const sizeMin = opts.sizeMin ?? 3;
  const sizeMax = opts.sizeMax ?? 7;
  const life = opts.life ?? 0.55;

  let spawned = 0;
  for (let i = 0; i < pool.length && spawned < count; i++) {
    const p = pool[i];
    if (p.active) continue; // pool full of live particles -> drop the rest
    const a = angle + (Math.random() - 0.5) * spread;
    const sp = speed * (0.4 + Math.random() * 0.8);
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp;
    p.maxLife = life * (0.7 + Math.random() * 0.6);
    p.life = p.maxLife;
    p.size = sizeMin + Math.random() * (sizeMax - sizeMin);
    p.color = colors[(Math.random() * colors.length) | 0];
    p.rot = Math.random() * Math.PI;
    p.vr = (Math.random() - 0.5) * 12;
    spawned++;
  }
  kick();
}

// ring(x, y, opts): a single expanding shockwave ring on the shared fx canvas.
// opts: radius (max), color, width, life (seconds). Pure flourish, so it is
// SKIPPED under reduced-motion / motion-off (the flash still carries the beat).
export function ring(x, y, opts = {}) {
  if (!motionFlag() || reduced()) return;
  ensureFx();
  rings.push({
    x,
    y,
    maxR: opts.radius ?? 120,
    life: opts.life ?? 0.5,
    maxLife: opts.life ?? 0.5,
    color: opts.color || '#2EFFE0',
    width: opts.width ?? 4,
  });
  kick();
}

// screenFlash(opts): a brief full-screen color wash on the fx canvas. opts:
// alpha (peak), color, life. This is functional impact feedback, so it still
// plays under reduced-motion (capped faint) — matching the "keep a faint flash
// only" accessibility rule.
export function screenFlash(opts = {}) {
  ensureFx();
  const requested = opts.alpha ?? 0.18;
  const peak = reduced() ? Math.min(0.15, requested) : requested;
  const life = opts.life ?? 0.18;
  flash = { life, maxLife: life, color: opts.color || '#ffffff', peak };
  kick();
}

// floater(x, y, char, opts): a single letter that rises + fades from a point.
// Used for the optional keystroke flourish; skipped under reduced-motion.
export function floater(x, y, char, opts = {}) {
  if (!motionFlag() || reduced()) return;
  ensureFx();
  floaters.push({
    x,
    y,
    vy: opts.vy ?? -64,
    char: String(char),
    life: opts.life ?? 0.7,
    maxLife: opts.life ?? 0.7,
    color: opts.color || '#2EFFE0',
    size: opts.size ?? 22,
  });
  kick();
}

// --- persistent marks (background graffiti layer) --------------------------
function drawMark(m) {
  bgCtx.save();
  bgCtx.translate(m.x, m.y);
  bgCtx.fillStyle = m.color;
  bgCtx.globalAlpha = m.alpha;
  // Irregular splat: a ring of offset blobs + a solid core, sized off a stored
  // per-mark seed so it draws identically every redraw (e.g. after a resize).
  const blobs = 5;
  for (let i = 0; i < blobs; i++) {
    const a = (Math.PI * 2 * i) / blobs + m.seed * 6.283;
    const d = m.size * (0.25 + ((m.seed * 9.7 * (i + 1)) % 1) * 0.55);
    const r = m.size * (0.3 + ((m.seed * 5.3 * (i + 2)) % 1) * 0.4);
    bgCtx.beginPath();
    bgCtx.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, Math.PI * 2);
    bgCtx.fill();
  }
  bgCtx.beginPath();
  bgCtx.arc(0, 0, m.size * 0.55, 0, Math.PI * 2);
  bgCtx.fill();
  bgCtx.restore();
}

// mark(x, y, opts): stamp a persistent splat on the back layer. opts: color,
// size, alpha. Persists until clearMarks(). Used later for Word Bomb's
// accumulating graffiti.
export function mark(x, y, opts = {}) {
  ensureBg();
  const m = {
    x,
    y,
    color: opts.color || PALETTE[(Math.random() * PALETTE.length) | 0],
    size: opts.size ?? 28,
    alpha: opts.alpha ?? 0.85,
    seed: Math.random(),
  };
  marks.push(m);
  drawMark(m);
}

export function clearMarks() {
  marks.length = 0;
  if (bgCtx) bgCtx.clearRect(0, 0, bgCanvas.width / dpr, bgCanvas.height / dpr);
}
