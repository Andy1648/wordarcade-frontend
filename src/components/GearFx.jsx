// GearFx.jsx — THE RARE-GEAR GLOW (Andy oct9: "by glow i was referencing clash royale cards (like evo cards or
// legendary cards — they just feel so satisfying)"). A DOCUMENTED, SCOPED exception to the flat / no-glow rule
// (CLAUDE.md, like .homepage-beat-glow): EVERY EPIC+ gear card, owned or locked (Andy oct9 22:56 "the glow should be
// everywhere then (not just whats found)") — the YOUR GEAR slot, the EQUIP screen, the INDEX tiles, the GEAR SHEET, and
// the ROLL screen (the reel cells, the reveal card, the stats extension).
//
// What Clash Royale does on a LEGENDARY / EVO card and what this borrows: a light AROUND the frame that breathes
// (evo cards pulse their violet aura), a shine that crosses the face (the sheen — the host's), and sparkles rising off
// the rim. Escalating per tier (oct9 v2 — Andy found v1 faint: brighter, wider assets with a hot rim + more motes):
//   EPIC       a clear violet aura + 2 motes
//   LEGENDARY  a wider gold aura + 4 motes
//   MYTHIC     louder: the widest pink aura + a cyan halo breathing out of phase + 6 motes
//   SECRET     its own colour: a rainbow aura + 6 white motes
//
// ART vs MOTION: the aura is a PRE-RENDERED asset (public/fx/gear-aura-<tier>.png — the falloff is baked in; no CSS
// filter / blurred box-shadow), the motes are an SVG sparkle (public/fx/gear-mote.svg) used as a mask. Motion is
// opacity (aura) and transform + opacity (motes) only, every cycle a FINITE WAAPI run started by ONE shared scheduler
// (a single setTimeout chain for every mounted GearFx — never a CSS infinite animation). will-change is set for a run
// and cleared when it ends.
// THE STAGGER: the scheduler wakes every TICK_MS and lets at most PER_TICK on-screen hosts breathe, round-robin, each
// no more often than BREATHE_EVERY_MS — so a lone card (the sheet, the reveal) breathes on its own rhythm and a grid of
// twenty glowing tiles ripples a few at a time instead of all at once. Off-screen hosts (IntersectionObserver) and a
// hidden tab are skipped. Between breaths the aura rests at a strong `lo` (it is visible at a glance at rest).
// live={false}: the aura only, still — no scheduler, no motes (the reel's passing cells).
// REDUCE MOTION: the aura stays, still, and no motes.
// The pool is fixed: an instance owns at most 2 aura nodes + 6 mote nodes, made once.
import { useEffect, useRef } from 'react';
import { useReduceMotion } from '../lib/useReduceMotion';
import './GearFx.css';

const FX = {
  epic: { lo: 0.8, out: 26, motes: 2, m: '#F3D2FF' },
  legendary: { lo: 0.86, out: 34, motes: 4, m: '#FFF3A6' },
  mythic: { two: true, lo: 0.9, out: 40, motes: 6, m: '#FFFFFF' },
  secret: { lo: 0.9, out: 40, motes: 6, m: '#FFFFFF' },
};
export const TICK_MS = 700;
export const PER_TICK = 1;
export const BREATHE_EVERY_MS = 4200;
export const BREATHE_MS = 2600;
export const MOTE_MS = 1700;
// rim spots (round the frame, staggered sides) — a mote rises from its spot
const SPOTS = [
  { side: 'left', top: '68%' },
  { side: 'right', top: '30%' },
  { side: 'right', top: '78%' },
  { side: 'left', top: '24%' },
  { side: 'left', top: '46%' },
  { side: 'right', top: '54%' },
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

export default function GearFx({ tier, scale = 1, live = true }) {
  const fx = FX[tier];
  const reduced = useReduceMotion();
  const still = reduced || !live;
  const root = useRef(null);
  useEffect(() => {
    const el = root.current;
    if (!fx || still || !el || typeof el.animate !== 'function') return undefined;
    const auras = [...el.querySelectorAll('.gfx-aura')];
    const motes = [...el.querySelectorAll('.gfx-mote')];
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
    const unsub = subscribe((now) => {
      if (!seen || now - last < BREATHE_EVERY_MS) return false;
      last = now;
      auras.forEach((n, k) => play(
        n,
        [{ opacity: fx.lo }, { opacity: 1 }, { opacity: fx.lo }],
        { duration: BREATHE_MS, delay: (k * BREATHE_MS) / 2, easing: 'ease-in-out' },
        'opacity',
      ));
      motes.forEach((n, k) => play(
        n,
        [
          { opacity: 0, transform: 'translateY(0) scale(0.4) rotate(0deg)' },
          { opacity: 1, transform: 'translateY(-16px) scale(1.15) rotate(35deg)', offset: 0.3 },
          { opacity: 0, transform: 'translateY(-52px) scale(0.6) rotate(80deg)' },
        ],
        { duration: MOTE_MS, delay: 250 + k * 230, easing: 'cubic-bezier(.2,.7,.4,1)' },
        'transform, opacity',
      ));
      return true;
    });
    return () => {
      unsub();
      if (io) io.disconnect();
      runs.forEach((a) => { try { a.cancel(); } catch { /* gone */ } });
    };
  }, [fx, still]);
  if (!fx) return null;
  const style = {
    '--gfx-m': fx.m,
    '--gfx-lo': still ? (fx.lo + 1) / 2 : fx.lo,
    '--gfx-out': `${Math.round(fx.out * scale)}px`,
    '--gfx-ms': `${Math.round(26 * Math.max(0.85, scale))}px`,
  };
  return (
    <span ref={root} className={`gfx${still ? ' is-still' : ''}`} data-glow={tier} style={style} aria-hidden="true">
      <span className="gfx-aura" />
      {fx.two ? <span className="gfx-aura is-2" /> : null}
      {!still && SPOTS.slice(0, fx.motes).map((s, k) => (
        <span key={k} className={`gfx-mote is-${s.side}`} style={{ top: s.top }} />
      ))}
    </span>
  );
}
