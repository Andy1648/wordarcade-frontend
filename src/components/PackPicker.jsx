// PackPicker.jsx — the real Category Blitz pack-picker (Stage 1).
//
// Adapted from the approved pack-picker preview. CONTROLLED: renders from props
// (no internal pack list), a pack is "on" when its id is in `selected`, and a
// click calls `onToggle(id)` — the parent owns the selection. The dev GRID/LIST
// toggle, the standalone-panel chrome (title/chip/AI-badge/liner/CREATE-JOIN) and
// the #pack-preview harness are stripped; this widget embeds INSIDE the Blitz
// ModeDialog, which owns that chrome. The pill LOOK + MOTION are unchanged.
//
// Reactions are INDIVIDUAL, precomputed once (per packs) into MOTION[] and fed as
// inherited CSS vars on each item's outer wrap:
//   1) ANIMATION — 5 distinct select-pop keyframes, assigned by index (i % 5).
//   2) TIMING — per-item bob phase/duration + a per-item delay that ripples the
//      one shared beat; jittered so nothing locksteps; per-neighbour cascade.
//   3) WEIGHT — each pack's category `count` → a 0..1 weight that scales amplitude,
//      duration (heavy = slower/springier), overshoot and shadow throw.
//
// Props:
//   packs     : array of { id, label, emoji, color, rot, sticker, count }
//   selected  : Set | array of selected pack ids
//   onToggle  : (id) => void — called on click (parent flips selection)
import { useEffect, useMemo, useRef, useState } from 'react';
import './PackPicker.css';

const INK_IDS = ['ppp-ink-a', 'ppp-ink-b', 'ppp-ink-c'];
const BURST_POINTS =
  '100,50 74,60 85.4,85.4 60,74 50,100 40,74 14.6,85.4 26,60 0,50 26,40 14.6,14.6 40,26 50,0 60,26 85.4,14.6 74,40';

// 5 distinct GRID select-pop keyframes; assigned by index so no two adjacent share.
const VARIANTS = ['ppp-sel-wide', 'ppp-sel-tall', 'ppp-sel-wobble', 'ppp-sel-bounce', 'ppp-sel-punch'];

// Deterministic per-index pseudo-random (stable across renders/resumes; no Math.random).
function rand(n) { const x = Math.sin(n * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); }

// Precompute each pack's motion signature once (per packs array). Weight is the
// pack's category count normalised across the current packs (0 = snappy, 1 = heavy).
function computeMotion(packs) {
  const counts = packs.map((p) => p.count);
  const cmin = Math.min(...counts);
  const cmax = Math.max(...counts);
  return packs.map((p, i) => {
    const w = cmax > cmin ? (p.count - cmin) / (cmax - cmin) : 0.5;
    const jitter = 0.88 + rand(i + 5) * 0.24;                       // ±~12% duration jitter
    const amp = +(0.7 + w * 0.85).toFixed(3);                       // squash/overshoot 0.70..1.55
    const variant = VARIANTS[i % VARIANTS.length];                  // adjacent indices differ
    // Press squash bias flavours the hold per variant.
    let sqx; let sqy;
    if (variant === 'ppp-sel-tall') { sqx = 1 - 0.09 * amp; sqy = 1 + 0.11 * amp; }
    else if (variant === 'ppp-sel-wobble') { sqx = 1 + 0.07 * amp; sqy = 1 - 0.05 * amp; }
    else { sqx = 1 + 0.15 * amp; sqy = 1 - 0.13 * amp; }
    return {
      variant, amp,
      popDur: +((0.30 + w * 0.26) * jitter).toFixed(3),   // heavy = slower
      relDur: +((0.28 + w * 0.20) * jitter).toFixed(3),
      nudgeDur: +((0.24 + w * 0.16) * jitter).toFixed(3),
      bobDur: +(2.7 + rand(i + 3) * 0.9).toFixed(3),       // varied so they drift out of lockstep
      bobDelay: +(i * -0.28).toFixed(3),                   // wider phase spread → travelling wave
      beatDelay: +((i % 14) * 0.009).toFixed(3),           // beat ripples across items
      selShadow: Math.round(6 + w * 8),                    // heavy packs throw a bigger shadow
      sqx: +sqx.toFixed(3), sqy: +sqy.toFixed(3),
      ease: w > 0.55 ? 'cubic-bezier(0.34, 1.8, 0.38, 1)' : 'cubic-bezier(0.3, 1.5, 0.5, 1)', // springier for heavy
    };
  });
}

function prefersReduced() {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f));
  const g = Math.round(((n >> 8) & 255) * (1 - f));
  const b = Math.round((n & 255) * (1 - f));
  return `rgb(${r}, ${g}, ${b})`;
}
function lighten(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * f);
  const g = Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * f);
  const b = Math.round((n & 255) + (255 - (n & 255)) * f);
  return `rgb(${r}, ${g}, ${b})`;
}
function packVars(p, inkId) {
  return {
    '--pack': p.color,
    '--pack-light': lighten(p.color, 0.5),
    '--pack-deep': darken(p.color, 0.3),
    '--rot': `${p.rot}deg`,
    '--ink-url': `url(#${inkId})`,
  };
}
// The per-item motion signature as inherited CSS vars (set on the OUTER wrap).
function motionVars(m, i) {
  return {
    '--i': i,
    '--amp': m.amp,
    '--pop-name': m.variant,
    '--pop-dur': `${m.popDur}s`,
    '--rel-dur': `${m.relDur}s`,
    '--nudge-dur': `${m.nudgeDur}s`,
    '--bob-dur': `${m.bobDur}s`,
    '--bob-delay': `${m.bobDelay}s`,
    '--beat-delay': `${m.beatDelay}s`,
    '--sel-shadow': `${m.selShadow}px`,
    '--sqx': m.sqx,
    '--sqy': m.sqy,
    '--pop-ease': m.ease,
  };
}

function CheckMark() {
  return (
    <svg viewBox="0 0 30 30" className="ppp-check-svg">
      <path d="M6 16 Q10 19 12.5 23 Q18 12 25 6" fill="none" stroke="#000"
        strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" filter="url(#ppp-ink-thin)" />
    </svg>
  );
}
function RoughCheck() { return <span className="ppp-check" aria-hidden="true"><CheckMark /></span>; }
function Sparkle() {
  return (
    <span className="ppp-spark" aria-hidden="true">
      <svg viewBox="0 0 22 22">
        <path d="M11 0 C12 7 15 10 22 11 C15 12 12 15 11 22 C10 15 7 12 0 11 C7 10 10 7 11 0 Z"
          fill="#fff" stroke="#000" strokeWidth="2" strokeLinejoin="round" filter="url(#ppp-ink-thin)" />
      </svg>
    </span>
  );
}
function Sticker({ kind }) {
  if (kind === 'star') {
    return (
      <span className="ppp-sticker ppp-sticker-star" aria-hidden="true">
        <svg viewBox="0 0 26 26">
          <path d="M13 1 L16.5 9.5 L25 10 L18.5 15.5 L21 24 L13 19 L5 24 L7.5 15.5 L1 10 L9.5 9.5 Z"
            fill="#FFE94A" stroke="#000" strokeWidth="3.4" strokeLinejoin="round" filter="url(#ppp-ink-thin)" />
          <circle cx="10.5" cy="10.5" r="1.6" fill="#fff" />
        </svg>
      </span>
    );
  }
  if (kind === 'drip') {
    return (
      <span className="ppp-sticker ppp-sticker-drip" aria-hidden="true">
        <svg viewBox="0 0 22 32">
          <path d="M11 1 C6.5 1 4 5.5 4 11 C4 17.5 11 19 11 28 C11 19 18 17.5 18 11 C18 5.5 15.5 1 11 1 Z"
            fill="#FF2EC4" stroke="#000" strokeWidth="3.2" strokeLinejoin="round" filter="url(#ppp-ink-thin)" />
          <ellipse cx="8.5" cy="9" rx="1.6" ry="3" fill="#fff" opacity="0.8" />
        </svg>
      </span>
    );
  }
  return (
    <span className="ppp-sticker ppp-sticker-dots" aria-hidden="true">
      <svg viewBox="0 0 30 24">
        <g stroke="#000" strokeWidth="2.6" filter="url(#ppp-ink-thin)">
          <circle cx="7" cy="8" r="4.4" fill="#2EFFE0" />
          <circle cx="20" cy="6" r="3.2" fill="#FF6B3D" />
          <circle cx="23" cy="16" r="3.8" fill="#FFE94A" />
          <circle cx="12" cy="17" r="2.6" fill="#9A28FF" />
        </g>
      </svg>
    </span>
  );
}

export default function PackPicker({ packs, selected, onToggle }) {
  // Selection comes from props (controlled). Normalise Set|array to a Set for O(1) lookups.
  const selectedSet = useMemo(
    () => (selected instanceof Set ? selected : new Set(selected || [])),
    [selected],
  );
  const count = selectedSet.size;

  // Motion signature per pack, recomputed only when the packs array identity changes.
  const MOTION = useMemo(() => computeMotion(packs), [packs]);

  // Transient per-item animation flags (visual feedback only — NOT the selection).
  const [popIn, setPopIn] = useState(() => new Set());
  const [popOut, setPopOut] = useState(() => new Set());
  const [pressId, setPressId] = useState(null);
  const [releasing, setReleasing] = useState(() => new Set());
  const [nudging, setNudging] = useState(() => new Set());

  // ONE shared beat clock → toggles data-beat; CSS pulses selected items, rippled
  // by each item's --beat-delay. No per-item timer, no re-render per beat. Off under
  // reduced motion.
  const stageRef = useRef(null);
  useEffect(() => {
    if (prefersReduced()) return undefined;
    const host = stageRef.current;
    let offTimer = 0;
    const id = window.setInterval(() => {
      if (!host) return;
      host.setAttribute('data-beat', '');
      window.clearTimeout(offTimer);
      offTimer = window.setTimeout(() => host && host.removeAttribute('data-beat'), 210);
    }, 500);
    return () => { window.clearInterval(id); window.clearTimeout(offTimer); };
  }, []);

  function addTo(setter, ids) { setter((s) => { const n = new Set(s); ids.forEach((x) => n.add(x)); return n; }); }
  function delFrom(setter, id) { setter((s) => { if (!s.has(id)) return s; const n = new Set(s); n.delete(id); return n; }); }

  function pop(id, dir) {
    if (dir === 'in') { addTo(setPopIn, [id]); delFrom(setPopOut, id); }
    else { addTo(setPopOut, [id]); delFrom(setPopIn, id); }
  }
  function clearPop(id) { delFrom(setPopIn, id); delFrom(setPopOut, id); }
  function clearSquish(id) { delFrom(setReleasing, id); delFrom(setNudging, id); }

  function press(id) { setPressId(id); }
  function release(id) { setPressId((cur) => (cur === id ? null : cur)); addTo(setReleasing, [id]); }

  function togglePack(id) {
    const idx = packs.findIndex((p) => p.id === id);
    const willBe = !selectedSet.has(id); // optimistic; the parent owns the real state
    pop(id, willBe ? 'in' : 'out');
    const neighbours = [packs[idx - 1], packs[idx + 1]].filter(Boolean).map((p) => p.id);
    if (neighbours.length) addTo(setNudging, neighbours);
    onToggle(id);
  }

  const pressProps = (id) => ({
    onPointerDown: () => press(id),
    onPointerUp: () => release(id),
    onPointerLeave: () => release(id),
  });
  const squishCls = (id) =>
    (pressId === id ? ' pressing' : '') + (releasing.has(id) ? ' releasing' : '') + (nudging.has(id) ? ' nudging' : '');

  return (
    <div className="ppp-picker" ref={stageRef}>
      {/* ---- Ink/roughen filter defs: hidden, rendered once. ---- */}
      <svg className="ppp-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter id="ppp-ink-a" x="-25%" y="-40%" width="150%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022 0.028" numOctaves="2" seed="2" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="ppp-ink-b" x="-25%" y="-40%" width="150%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.02 0.03" numOctaves="2" seed="9" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="5.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="ppp-ink-c" x="-25%" y="-40%" width="150%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.025 0.024" numOctaves="2" seed="15" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="4.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="ppp-ink-window" x="-12%" y="-12%" width="124%" height="124%">
            <feTurbulence type="fractalNoise" baseFrequency="0.013 0.016" numOctaves="2" seed="11" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="ppp-ink-title" x="-8%" y="-30%" width="116%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.014 0.02" numOctaves="2" seed="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="ppp-ink-thin" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.06" numOctaves="2" seed="6" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <div className="ppp-subline">
        <span className="ppp-subline-glyph" aria-hidden="true">▓</span> PICK YOUR PACKS
      </div>

      <div className="ppp-window">
        <div className="ppp-window-ink" aria-hidden="true" />
        <div className="ppp-window-scroll">
          <div className="ppp-grid">
            {packs.map((p, i) => {
              const on = selectedSet.has(p.id);
              const inkId = INK_IDS[i % INK_IDS.length];
              const beatCls = (popIn.has(p.id) ? ' pop-in' : '') + (popOut.has(p.id) ? ' pop-out' : '');
              return (
                <div className="ppp-pill-wrap" style={{ ...packVars(p, inkId), ...motionVars(MOTION[i], i) }} key={p.id}>
                  <div
                    className={`ppp-pill-beat${on ? ' is-on' : ''}${beatCls}`}
                    onAnimationEnd={(e) => { if (e.target === e.currentTarget) clearPop(p.id); }}
                  >
                    <div
                      className={`ppp-pill-squish${squishCls(p.id)}`}
                      onAnimationEnd={(e) => { if (e.target === e.currentTarget) clearSquish(p.id); }}
                    >
                      <button
                        type="button"
                        className={`ppp-pill${on ? ' is-on' : ''}`}
                        onClick={() => togglePack(p.id)}
                        {...pressProps(p.id)}
                        aria-pressed={on}
                        aria-label={p.label}
                      >
                        {popIn.has(p.id) && (
                          <span className="ppp-burst" aria-hidden="true">
                            <svg viewBox="0 0 100 100">
                              <polygon points={BURST_POINTS} fill="var(--pack)" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
                            </svg>
                          </span>
                        )}
                        <span className="ppp-pill-ink" aria-hidden="true" />
                        <span className="ppp-pill-body">
                          <span className="ppp-pill-emoji" aria-hidden="true">{p.emoji}</span>
                          <span className="ppp-pill-label">{p.label}</span>
                        </span>
                        {p.sticker && <Sticker kind={p.sticker} />}
                        {on && <RoughCheck />}
                        {on && <Sparkle />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ppp-count">
        <span className="ppp-count-num" key={count}>
          {count === 0 ? 'NO PACKS — PICK AT LEAST ONE' : `${count} PACK${count === 1 ? '' : 'S'} LOADED`}
        </span>
      </div>
    </div>
  );
}
