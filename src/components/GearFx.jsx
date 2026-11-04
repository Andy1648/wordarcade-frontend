// GearFx.jsx — THE RARE-GEAR GLOW (Andy oct9: "by glow i was referencing clash royale cards (like evo cards or
// legendary cards — they just feel so satisfying)"). A DOCUMENTED, SCOPED exception to the flat / no-glow rule
// (CLAUDE.md, like .homepage-beat-glow): EVERY EPIC+ gear card, owned or locked (Andy oct9 22:56 "the glow should be
// everywhere then (not just whats found)") — the YOUR GEAR slot, the EQUIP screen, the INDEX tiles, the GEAR SHEET, and
// the ROLL screen (the reel cells, the reveal card, the stats extension).
//
// THE RARITY LADDER (gear UI v3, Andy oct9 "i want the display for the gear rarities to be even better (like mythic and
// secret should be even greater)") — each tier unmistakably grander, mythic and secret a different CLASS:
//   EPIC       a violet aura + 2 motes
//   LEGENDARY  a wider gold aura + 4 motes
//   MYTHIC     two auras (pink + its cyan second colour, breathing out of phase), 8 BIG two-colour motes
//   SECRET     the rainbow aura SWAPS through three baked colourings (the colours cycle), a GLITCH plate (an RGB-split
//              asset) tears across it as each breath starts, and an ORBITING RING of 8 rainbow motes circles the card
//              once per breath (+ 4 rising motes)
//
// ART vs MOTION: every aura is a PRE-RENDERED asset (public/fx/gear-aura-<tier>.png — the falloff is baked in; no CSS
// filter / blurred box-shadow), the motes are an SVG sparkle (public/fx/gear-mote.svg) used as a mask. Motion is
// opacity (auras) and transform + opacity (motes, glitch, orbit) only, every cycle a FINITE WAAPI run started by ONE
// shared scheduler (a single setTimeout chain for every mounted GearFx — never a CSS infinite animation). will-change
// is set for a run and cleared when it ends.
// THE STAGGER: the scheduler wakes every TICK_MS and lets at most PER_TICK on-screen hosts breathe, round-robin, each
// no more often than BREATHE_EVERY_MS — so a lone card (the sheet, the reveal) breathes on its own rhythm and a grid of
// twenty glowing tiles ripples a few at a time instead of all at once. Off-screen hosts (IntersectionObserver) and a
// hidden tab are skipped. Between breaths the aura rests at a strong `lo` (it is visible at a glance at rest).
// FLARE: a host may fire one breath NOW (the YOUR GEAR showcase — gearShowcase.js) by dispatching `gfx:flare` on
// the .gfx node; it is the same finite breath, plus a radial mote BURST, and it resets that host's scheduler clock.
// live={false}: the aura only, still — no scheduler, no motes (the reel's passing cells).
// REDUCE MOTION: the aura stays, still, and no motes / orbit / glitch.
// The pool is fixed: an instance owns at most 4 aura nodes + 8 rim motes + 8 orbit motes, made once. The orbit's
// ellipse is measured ONCE on mount (offsetWidth / offsetHeight — never in a frame or a breath).
import { useEffect, useRef } from 'react';
import { useReduceMotion } from '../lib/useReduceMotion';
import { shardSrc, TIP_DEG } from '../fx/shards/shardPlan.js';
import './GearFx.css';

const RAINBOW = ['#FF3D7F', '#FFC23D', '#2EFFE0', '#3D8BFF', '#B04BFF'];
const FX = {
  epic: { lo: 0.8, out: 26, motes: 2 },
  legendary: { lo: 0.86, out: 34, motes: 4, streaks: 6 },
  mythic: { two: true, lo: 0.9, out: 42, motes: 8, big: 1.35, waves: 2 },
  secret: { swap: 3, glitch: true, orbit: 8, lo: 0.9, out: 42, motes: 4, big: 1.15 },
};
export const TICK_MS = 700;
export const PER_TICK = 1;
export const BREATHE_EVERY_MS = 4200;
export const BREATHE_MS = 2600;
export const MOTE_MS = 1300; // the FLOATING BLADES' breath (nov2): the rise is up front, the hang is the read
export const SWAP_MS = 3900; // SECRET: one full trip through its three colourings
export const ORBIT_MS = 3400; // SECRET: one lap of the mote ring
export const GLITCH_MS = 420;
// HOVER CONCEPTS (Andy oct12): LEGENDARY — light STREAKS rise up both sides of the card, in the glow band (never over the
// stats); MYTHIC — SHOCKWAVES of its own glow pulse out through the aura. While hovered only: each node chains one
// FINITE run to the next (no Infinity, like the SECRET orbit); leaving lets the current run finish and stops.
export const STREAK_MS = 900;
export const WAVE_MS = 1150;
// a LANCE per slot (Andy nov3: the old flat bars → painted art at MYTHIC's level): side, x across the glow band
// (0 = outer edge, 1 = the card), height % of the host. One painted gold sceptre-lance (public/fx/lance/), its width
// follows its own aspect — never stretched into a bar.
export const LANCE_SRC = '/fx/lance/lance-gold-v1.webp';
const STREAKS = [
  { side: 'left', x: 0.45, h: 40 },
  { side: 'right', x: 0.4, h: 34 },
  { side: 'left', x: 0.1, h: 28 },
  { side: 'right', x: 0.7, h: 44 },
  { side: 'left', x: 0.75, h: 32 },
  { side: 'right', x: 0.1, h: 26 },
];
// rim spots (round the frame, staggered sides) — a mote rises from its spot
const SPOTS = [
  { side: 'left', top: '68%' },
  { side: 'right', top: '30%' },
  { side: 'right', top: '78%' },
  { side: 'left', top: '24%' },
  { side: 'left', top: '46%' },
  { side: 'right', top: '54%' },
  { side: 'left', top: '88%' },
  { side: 'right', top: '12%' },
];

// ---- THE shared scheduler: one timer for every glow on screen ----
// subscribers: fn(now) → true when it breathed (it was due and on screen)
const subs = [];
let cursor = 0;
let timer = null;
function tick() {
  timer = setTimeout(tick, TICK_MS);
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const n = subs.length;
  const now = Date.now();
  let woke = 0;
  for (let k = 0; k < n && woke < PER_TICK; k += 1) {
    const i = (cursor + k) % n;
    if (subs[i](now)) {
      woke += 1;
      cursor = i + 1;
    }
  }
}
function subscribe(fn) {
  subs.push(fn);
  if (!timer) timer = setTimeout(tick, 300);
  return () => {
    const i = subs.indexOf(fn);
    if (i >= 0) subs.splice(i, 1);
    if (cursor > subs.length) cursor = 0;
    if (!subs.length && timer) { clearTimeout(timer); timer = null; }
  };
}

// a blade's resting pose: its painted tip (TIP_DEG, drawn up-right) turned to point up-and-OUT on its side, a few
// degrees different per slot so a row of blades never reads as stamped copies
const bladePose = (dir, k) => {
  const tip = TIP_DEG[k % TIP_DEG.length];
  const want = dir > 0 ? -62 + (k % 3) * 9 : -118 - (k % 3) * 9; // up-right on the right side, up-left on the left
  return Math.round(want - tip);
};
/** A breath: the blade rises from behind the card's side, snaps up (the first third), hangs with a slow turn and a
 *  small outward lean, then fades — it stays IN the glow band (never drifts onto the text beside a card, e.g. the
 *  gear sheet's stats). Transform + opacity only. */
export function floatBlade(dir, k) {
  const r = bladePose(dir, k);
  const t = dir * (6 + (k % 3) * 3);
  return [
    { opacity: 0, transform: `translate(${-dir * 4}px, 12px) rotate(${r - t}deg) scale(0.45)`, easing: 'cubic-bezier(.1,.75,.25,1)' },
    { opacity: 1, transform: `translate(${dir * 4}px, -16px) rotate(${r}deg) scale(1)`, offset: 0.32, easing: 'cubic-bezier(.4,0,.6,1)' },
    { opacity: 1, transform: `translate(${dir * 7}px, -30px) rotate(${r + t}deg) scale(0.96)`, offset: 0.72, easing: 'cubic-bezier(.5,0,.9,.6)' },
    { opacity: 0, transform: `translate(${dir * 10}px, -44px) rotate(${r + t * 1.6}deg) scale(0.6)` },
  ];
}
/** A flare (the YOUR GEAR showcase): the blade is thrown out sideways, tip first, and fades — still inside the glow
 *  band (the menu slot sits next to the mode cards; a blade must never land on their text). */
export function flareBlade(dir, k) {
  const r = bladePose(dir, k) + dir * 30; // flatter: pointing out more than up
  return [
    { opacity: 0, transform: `translate(0, 0) rotate(${r - dir * 20}deg) scale(0.4)`, easing: 'cubic-bezier(.05,.7,.2,1)' },
    { opacity: 1, transform: `translate(${dir * 12}px, -14px) rotate(${r}deg) scale(1.1)`, offset: 0.3, easing: 'cubic-bezier(.4,0,.8,.6)' },
    { opacity: 0, transform: `translate(${dir * 28}px, -34px) rotate(${r + dir * 25}deg) scale(0.6)` },
  ];
}

/** The SECRET swap: aura k of n holds the light for its third of the trip; the first rests at `lo` at both ends. */
export function swapFrames(k, n, lo) {
  if (k === 0) return [{ opacity: lo, offset: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0, offset: 0.36 }, { opacity: 0, offset: 0.8 }, { opacity: lo, offset: 1 }];
  const peak = k / n + 0.12;
  return [{ opacity: 0, offset: 0 }, { opacity: 0, offset: Math.max(0.01, peak - 0.24) }, { opacity: 1, offset: peak }, { opacity: 0, offset: Math.min(0.99, peak + 0.26) }, { opacity: 0, offset: 1 }];
}

export default function GearFx({ tier, scale = 1, live = true }) {
  const fx = FX[tier];
  const reduced = useReduceMotion();
  const still = reduced || !live;
  const root = useRef(null);
  useEffect(() => {
    const el = root.current;
    if (!fx || still || !el || typeof el.animate !== 'function') return undefined;
    const auras = [...el.querySelectorAll('.gfx-aura:not(.is-glitch)')];
    const glitch = el.querySelector('.gfx-aura.is-glitch');
    const motes = [...el.querySelectorAll('.gfx-mote')];
    const orbit = el.querySelector('.gfx-orbit');
    const spin = el.querySelector('.gfx-orbit-spin');
    if (orbit) {
      // the ring's ellipse: measured ONCE (layout reads never run in a breath)
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w > 0 && h > 0) orbit.style.setProperty('--gfx-osx', String(Math.min(1.6, Math.max(0.4, w / h))));
    }
    let seen = true;
    let io = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; });
      io.observe(el);
    }
    let last = 0;
    const runs = new Set();
    const play = (node, frames, opts, wc) => {
      node.style.willChange = wc;
      const a = node.animate(frames, opts);
      runs.add(a);
      const off = () => { node.style.willChange = ''; runs.delete(a); };
      a.finished.then(off, off);
    };
    const breathe = (burst) => {
      if (fx.swap) {
        auras.forEach((n, k) => play(n, swapFrames(k, auras.length, fx.lo), { duration: SWAP_MS, easing: 'ease-in-out' }, 'opacity'));
      } else {
        auras.forEach((n, k) => play(
          n,
          [{ opacity: fx.lo }, { opacity: 1 }, { opacity: fx.lo }],
          { duration: BREATHE_MS, delay: (k * BREATHE_MS) / 2, easing: 'ease-in-out' },
          'opacity',
        ));
      }
      if (glitch) {
        play(glitch, [
          { opacity: 0, transform: 'translateX(0)' },
          { opacity: 1, transform: 'translateX(-5px)', offset: 0.18 },
          { opacity: 0.2, transform: 'translateX(4px)', offset: 0.36 },
          { opacity: 1, transform: 'translateX(-2px)', offset: 0.55 },
          { opacity: 0, transform: 'translateX(0)' },
        ], { duration: GLITCH_MS, easing: 'steps(6, end)' }, 'transform, opacity');
      }
      if (spin && burst) { // Andy oct11: the ring is a HOVER effect now — a breath leaves it alone; a flare still laps once
        play(spin, [
          { opacity: 0, transform: 'rotate(0deg)' },
          { opacity: 1, transform: 'rotate(60deg)', offset: 0.18 },
          { opacity: 1, transform: 'rotate(300deg)', offset: 0.82 },
          { opacity: 0, transform: 'rotate(360deg)' },
        ], { duration: ORBIT_MS, delay: burst ? 0 : 200, easing: 'cubic-bezier(.35,.1,.45,.9)' }, 'transform, opacity');
      }
      motes.forEach((n, k) => {
        // THE FLOATING BLADES (nov2, Andy: "shards … mobile legends aamon"): each mote is a PAINTED crystal blade in the
        // tier's colours (fx/shards). A breath lifts it out from behind the card's side, tip up-and-out, to HANG in the
        // glow and drift away; a FLARE throws it sideways, tip first.
        const dir = n.classList.contains('is-left') ? -1 : 1;
        const frames = burst ? flareBlade(dir, k) : floatBlade(dir, k);
        play(n, frames, { duration: burst ? 820 : MOTE_MS, delay: burst ? k * 40 : 250 + k * 230, easing: 'linear' }, 'transform, opacity');
      });
    };
    const unsub = subscribe((now) => {
      if (!seen || now - last < BREATHE_EVERY_MS) return false;
      last = now;
      breathe(false);
      return true;
    });
    const onFlare = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      last = Date.now();
      breathe(true);
    };
    el.addEventListener('gfx:flare', onFlare);
    // SECRET ORBIT ON HOVER (Andy oct11 "the stars revolving … can be a hover animation instead (continuously)"): while
    // the card's host is hovered the ring laps, one FINITE linear lap chained to the next (no Infinity); leaving fades
    // the ring out, then drops the lap.
    const host = orbit && spin ? el.parentElement : null;
    let hov = false;
    let lap = null;
    let fade = null;
    const runLap = (first) => {
      if (!hov) return;
      const prev = lap;
      spin.style.willChange = 'transform, opacity';
      lap = spin.animate(
        first
          ? [{ opacity: 0, transform: 'rotate(0deg)' }, { opacity: 1, transform: 'rotate(40deg)', offset: 0.12 }, { opacity: 1, transform: 'rotate(360deg)' }]
          : [{ opacity: 1, transform: 'rotate(0deg)' }, { opacity: 1, transform: 'rotate(360deg)' }],
        { duration: first ? ORBIT_MS : ORBIT_MS * 0.8, easing: first ? 'cubic-bezier(.35,.1,.6,1)' : 'linear', fill: 'forwards' },
      );
      if (prev) prev.cancel();
      lap.onfinish = () => runLap(false);
    };
    const enter = () => {
      if (hov) return;
      hov = true;
      if (fade) { fade.cancel(); fade = null; }
      if (!lap) runLap(true);
    };
    const leave = () => {
      if (!hov) return;
      hov = false;
      if (!lap) return;
      fade = orbit.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' });
      const end = () => {
        if (hov) return;
        if (lap) { lap.onfinish = null; lap.cancel(); lap = null; }
        spin.style.willChange = '';
        fade = null;
      };
      fade.finished.then(end, () => {});
    };
    if (host) {
      host.addEventListener('pointerenter', enter);
      host.addEventListener('pointerleave', leave);
      host.addEventListener('focusin', enter);
      host.addEventListener('focusout', leave);
    }
    // LEGENDARY streaks / MYTHIC shockwaves — hover-only, each node a finite run chained while the host is hovered
    const streaks = [...el.querySelectorAll('.gfx-streak')];
    const waves = [...el.querySelectorAll('.gfx-wave')];
    const fxHost = streaks.length || waves.length ? el.parentElement : null;
    let hov2 = false;
    const chain = (node, frames, opts, gap) => {
      if (!hov2) return;
      node.style.willChange = 'transform, opacity';
      const a = node.animate(frames, opts);
      runs.add(a);
      a.onfinish = () => {
        runs.delete(a);
        if (hov2) chain(node, frames, { ...opts, delay: gap }, gap);
        else node.style.willChange = '';
      };
    };
    const enter2 = () => {
      if (hov2) return;
      hov2 = true;
      streaks.forEach((n, k) => chain(n, [
        // a lance THRUSTS up out of the band's floor tip-first (snap), glides, and fades as it clears the card's shoulder
        { opacity: 0, transform: 'translateY(40%) scale(0.8)' },
        { opacity: 1, transform: 'translateY(-25%) scale(1.04)', offset: 0.2, easing: 'cubic-bezier(.2,.7,.4,1)' },
        { opacity: 1, transform: 'translateY(-95%) scale(1)', offset: 0.7 },
        { opacity: 0, transform: 'translateY(-140%) scale(0.9)' },
      ], { duration: STREAK_MS + (k % 3) * 160, delay: k * 140, easing: 'cubic-bezier(.3,.1,.5,1)' }, 160 + (k % 4) * 110));
      waves.forEach((n, k) => chain(n, [
        { opacity: 0, transform: 'scale(0.9)' },
        { opacity: 1, transform: 'scale(1.02)', offset: 0.22 },
        { opacity: 0, transform: 'scale(1.34)' },
      ], { duration: WAVE_MS, delay: k * (WAVE_MS / 2), easing: 'cubic-bezier(.2,.7,.35,1)' }, 120));
    };
    const leave2 = () => { hov2 = false; };
    if (fxHost) {
      fxHost.addEventListener('pointerenter', enter2);
      fxHost.addEventListener('pointerleave', leave2);
      fxHost.addEventListener('focusin', enter2);
      fxHost.addEventListener('focusout', leave2);
    }
    return () => {
      if (fxHost) {
        fxHost.removeEventListener('pointerenter', enter2);
        fxHost.removeEventListener('pointerleave', leave2);
        fxHost.removeEventListener('focusin', enter2);
        fxHost.removeEventListener('focusout', leave2);
      }
      hov2 = false;
      unsub();
      el.removeEventListener('gfx:flare', onFlare);
      if (host) {
        host.removeEventListener('pointerenter', enter);
        host.removeEventListener('pointerleave', leave);
        host.removeEventListener('focusin', enter);
        host.removeEventListener('focusout', leave);
      }
      hov = false;
      if (lap) { lap.onfinish = null; lap.cancel(); }
      if (fade) fade.cancel();
      if (io) io.disconnect();
      runs.forEach((a) => { try { a.cancel(); } catch { /* gone */ } });
    };
  }, [fx, still]);
  if (!fx) return null;
  const ms = Math.round(26 * Math.max(0.85, scale) * (fx.big || 1));
  const style = {
    '--gfx-lo': still ? (fx.lo + 1) / 2 : fx.lo,
    '--gfx-out': `${Math.round(fx.out * scale)}px`,
    '--gfx-ms': `${ms}px`,
  };
  const swaps = fx.swap ? Array.from({ length: fx.swap }, (_, k) => k) : [0];
  return (
    <span ref={root} className={`gfx${still ? ' is-still' : ''}`} data-glow={tier} style={style} aria-hidden="true">
      {swaps.map((k) => <span key={k} className={`gfx-aura${k ? ` is-s${k + 1}` : ''}`} />)}
      {fx.two ? <span className="gfx-aura is-2" /> : null}
      {fx.glitch && !still ? <span className="gfx-aura is-glitch" /> : null}
      {fx.orbit && !still ? (
        <span className="gfx-orbit">
          <span className="gfx-orbit-spin">
            {Array.from({ length: fx.orbit }, (_, k) => (
              <span key={k} className="gfx-orbit-arm" style={{ transform: `rotate(${(360 / fx.orbit) * k}deg)` }}>
                <span className="gfx-orbit-mote" style={{ background: RAINBOW[k % RAINBOW.length] }} />
              </span>
            ))}
          </span>
        </span>
      ) : null}
      {fx.waves && !still ? Array.from({ length: fx.waves }, (_, k) => <span key={`w${k}`} className={`gfx-wave${k % 2 ? ' is-2' : ''}`} />) : null}
      {fx.streaks && !still ? (
        <span className="gfx-streaks">
          {STREAKS.slice(0, fx.streaks).map((s, k) => (
            <img key={`s${k}`} className={`gfx-streak is-${s.side}`} src={LANCE_SRC} alt="" draggable="false" style={{ '--gfx-sx': s.x, height: `${s.h}%` }} />
          ))}
        </span>
      ) : null}
      {!still && SPOTS.slice(0, fx.motes).map((s, k) => (
        <img key={k} className={`gfx-mote is-${s.side}`} style={{ top: s.top }} src={shardSrc(tier, k)} alt="" draggable="false" />
      ))}
    </span>
  );
}
