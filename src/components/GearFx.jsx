// GearFx.jsx — THE RARE-GEAR GLOW (Andy oct9: "by glow i was referencing clash royale cards (like evo cards or
// legendary cards — they just feel so satisfying)"). A DOCUMENTED, SCOPED exception to the flat / no-glow rule
// (CLAUDE.md, like .homepage-beat-glow): only EPIC+ gears, only the YOUR GEAR slot and the INDEX / GEAR SHEET cards.
//
// What Clash Royale does on a LEGENDARY / EVO card and what this borrows: a soft light AROUND the frame that breathes
// (evo cards pulse their violet aura), a shine that crosses the face (the sheen — already the INDEX's / the slot's), and
// little sparkles rising off the rim. Escalating per tier:
//   EPIC       the aura only
//   LEGENDARY  the aura + motes (3) — the host owns the sheen sweep
//   MYTHIC     louder: a wider, brighter aura + a SECOND aura colour breathing out of phase + 4 motes
//   SECRET     its own colour: a rainbow aura (a baked asset) + 4 white motes
//
// ART vs MOTION: the aura is a PRE-RENDERED asset (public/fx/gear-aura.png — the blur is baked in; painted the tier
// colour through it as a MASK, never a CSS filter / blurred box-shadow), the motes are an SVG sparkle
// (public/fx/gear-mote.svg). Motion is opacity (aura) and transform + opacity (motes) only, every cycle a FINITE WAAPI
// run started by ONE shared scheduler (a single setTimeout chain for every mounted GearFx — never a CSS infinite
// animation). will-change is set for a run and cleared when it ends. Off-screen hosts (IntersectionObserver) and a
// hidden tab skip their turn. REDUCE MOTION: the aura stays, still, and no motes.
// The pool is fixed: an instance owns at most 2 aura nodes + 4 mote nodes, made once.
import { useEffect, useRef } from 'react';
import { useReduceMotion } from '../lib/useReduceMotion';
import './GearFx.css';

const FX = {
  epic: { c: '#B04BFF', lo: 0.55, out: 14, motes: 0 },
  legendary: { c: '#FFC23D', lo: 0.65, out: 18, motes: 3, m: '#FFE94A' },
  mythic: { c: '#FF3D7F', c2: '#2EFFE0', lo: 0.75, out: 24, motes: 4, m: '#FFFFFF' },
  secret: { rainbow: true, lo: 0.75, out: 24, motes: 4, m: '#FFFFFF' },
};
export const BREATHE_EVERY_MS = 4200;
export const BREATHE_MS = 2600;
export const MOTE_MS = 1500;
// rim spots (left / right edges, low → high) — a mote rises 40px from its spot
const SPOTS = [
  { side: 'left', top: '70%' },
  { side: 'right', top: '52%' },
  { side: 'left', top: '34%' },
  { side: 'right', top: '82%' },
];

// ---- THE shared scheduler: one timer for every glow on screen ----
const subs = new Set();
let timer = null;
function tick() {
  timer = setTimeout(tick, BREATHE_EVERY_MS);
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  let i = 0;
  for (const fn of subs) fn(i++);
}
function subscribe(fn) {
  subs.add(fn);
  if (!timer) timer = setTimeout(tick, 500);
  return () => {
    subs.delete(fn);
    if (!subs.size && timer) { clearTimeout(timer); timer = null; }
  };
}

export default function GearFx({ tier, scale = 1 }) {
  const fx = FX[tier];
  const reduced = useReduceMotion();
  const root = useRef(null);
  useEffect(() => {
    const el = root.current;
    if (!fx || reduced || !el || typeof el.animate !== 'function') return undefined;
    const auras = [...el.querySelectorAll('.gfx-aura')];
    const motes = [...el.querySelectorAll('.gfx-mote')];
    let seen = true;
    let io = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; });
      io.observe(el);
    }
    const runs = new Set();
    const play = (node, frames, opts, wc) => {
      node.style.willChange = wc;
      const a = node.animate(frames, opts);
      runs.add(a);
      const off = () => { node.style.willChange = ''; runs.delete(a); };
      a.finished.then(off, off);
    };
    const unsub = subscribe((i) => {
      if (!seen) return;
      const lag = (i % 6) * 320; // many cards on one screen: a ripple, never in lockstep
      auras.forEach((n, k) => play(
        n,
        [{ opacity: fx.lo }, { opacity: 1 }, { opacity: fx.lo }],
        { duration: BREATHE_MS, delay: lag + (k * BREATHE_MS) / 2, easing: 'ease-in-out' },
        'opacity',
      ));
      motes.forEach((n, k) => play(
        n,
        [
          { opacity: 0, transform: 'translateY(0) scale(0.4) rotate(0deg)' },
          { opacity: 1, transform: 'translateY(-14px) scale(1) rotate(30deg)', offset: 0.3 },
          { opacity: 0, transform: 'translateY(-40px) scale(0.6) rotate(70deg)' },
        ],
        { duration: MOTE_MS, delay: lag + 300 + k * 280, easing: 'cubic-bezier(.2,.7,.4,1)' },
        'transform, opacity',
      ));
    });
    return () => {
      unsub();
      if (io) io.disconnect();
      runs.forEach((a) => { try { a.cancel(); } catch { /* gone */ } });
    };
  }, [fx, reduced]);
  if (!fx) return null;
  const style = {
    '--gfx-c': fx.c || '#fff',
    '--gfx-c2': fx.c2 || fx.c || '#fff',
    '--gfx-m': fx.m || '#fff',
    '--gfx-lo': reduced ? (fx.lo + 1) / 2 : fx.lo,
    '--gfx-out': `${Math.round(fx.out * scale)}px`,
  };
  return (
    <span ref={root} className={`gfx${reduced ? ' is-still' : ''}`} data-glow={tier} style={style} aria-hidden="true">
      <span className={`gfx-aura${fx.rainbow ? ' is-rainbow' : ''}`} />
      {fx.c2 ? <span className="gfx-aura is-2" /> : null}
      {!reduced && SPOTS.slice(0, fx.motes).map((s, k) => (
        <span key={k} className={`gfx-mote is-${s.side}`} style={{ top: s.top }} />
      ))}
    </span>
  );
}
