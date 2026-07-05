// PackPickerPreview.jsx
// THROWAWAY design preview — a Category Blitz pack-picker built into a MOCK of
// the Blitz mode dialog. NOT wired to game logic, WS, createGame, or the real
// ModeDialog. Pure visual iteration surface. View it at /#pack-preview (see
// main.jsx conditional mount).
//
// Aesthetic: cute CHUNKY VECTOR STICKERS with a hand-inked outline — illustration
// quality, not flat UI chips. Two things carry it:
//   1) EDGE: every outline (pills, panel, buttons, title) is roughed by an SVG
//      feTurbulence + feDisplacementMap filter so the fat black border reads as an
//      inked marker line of uneven thickness, never a clean CSS border.
//   2) BODY: each pill has a layered gradient fill (light tint up top → base →
//      darker bottom) + an inner top-edge shine, so it reads as a glossy inflated
//      vector object with depth. Crisp Bungee labels ride ABOVE the roughed layer.
import { useState } from 'react';
import './PackPickerPreview.css';

// 14 packs. `color` = the base fill; the CSS builds a light/deep gradient off it.
// `rot` = hand-placed tilt. `sticker` = an optional chunky vector doodle slapped
// on the tile. `ink` seed varies the wobble per tile.
const PACKS = [
  { id: 'movies',     label: 'MOVIES',     emoji: '🎬', color: '#FF2EC4', rot: -3,   sticker: 'star' },
  { id: 'gaming',     label: 'GAMING',     emoji: '🎮', color: '#2EFFE0', rot: 2.5,  sticker: null },
  { id: 'food',       label: 'FOOD',       emoji: '🍔', color: '#FF6B3D', rot: -1.5, sticker: 'drip' },
  { id: 'animals',    label: 'ANIMALS',    emoji: '🐾', color: '#FFE94A', rot: 3,    sticker: null },
  { id: 'sports',     label: 'SPORTS',     emoji: '⚽', color: '#3DFF77', rot: -2.5, sticker: 'dots' },
  { id: 'world',      label: 'WORLD',      emoji: '🌍', color: '#3DA8FF', rot: 1.5,  sticker: null },
  { id: 'music',      label: 'MUSIC',      emoji: '🎵', color: '#9A28FF', rot: -2,   sticker: 'star' },
  { id: 'science',    label: 'SCIENCE',    emoji: '🔬', color: '#2ED6FF', rot: 2,    sticker: null },
  { id: 'history',    label: 'HISTORY',    emoji: '🏛️', color: '#FF9F1C', rot: -3,   sticker: null },
  { id: 'mythology',  label: 'MYTHOLOGY',  emoji: '⚡', color: '#B14DFF', rot: 1,    sticker: 'drip' },
  { id: 'literature', label: 'LITERATURE', emoji: '📚', color: '#FF5CA8', rot: -1,   sticker: null },
  { id: 'tech',       label: 'TECH',       emoji: '💻', color: '#4D8BFF', rot: 2.5,  sticker: 'dots' },
  { id: 'art',        label: 'ART',        emoji: '🎨', color: '#FFD23D', rot: -2.5, sticker: null },
  { id: 'tv',         label: 'TV',         emoji: '📺', color: '#FF4D6D', rot: 3,    sticker: 'star' },
];

const ALL_IDS = PACKS.map((p) => p.id);
const INK_IDS = ['ppp-ink-a', 'ppp-ink-b', 'ppp-ink-c'];

function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f));
  const g = Math.round(((n >> 8) & 255) * (1 - f));
  const b = Math.round((n & 255) * (1 - f));
  return `rgb(${r}, ${g}, ${b})`;
}
// Lighten toward white — the top highlight tint of the sticker gradient.
function lighten(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * f);
  const g = Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * f);
  const b = Math.round((n & 255) + (255 - (n & 255)) * f);
  return `rgb(${r}, ${g}, ${b})`;
}

// Chunky filled vector checkmark on a bold badge — stamped on selected tiles.
function RoughCheck() {
  return (
    <span className="ppp-check" aria-hidden="true">
      <svg viewBox="0 0 30 30" className="ppp-check-svg">
        <path
          d="M6 16 Q10 19 12.5 23 Q18 12 25 6"
          fill="none"
          stroke="#000"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#ppp-ink-thin)"
        />
      </svg>
    </span>
  );
}

// Tiny 4-point sparkle — a chunky filled vector diamond-star with its own outline,
// added to selected tiles for extra pop.
function Sparkle() {
  return (
    <span className="ppp-spark" aria-hidden="true">
      <svg viewBox="0 0 22 22">
        <path
          d="M11 0 C12 7 15 10 22 11 C15 12 12 15 11 22 C10 15 7 12 0 11 C7 10 10 7 11 0 Z"
          fill="#fff"
          stroke="#000"
          strokeWidth="2"
          strokeLinejoin="round"
          filter="url(#ppp-ink-thin)"
        />
      </svg>
    </span>
  );
}

// Slapped-on graffiti stickers — bold FILLED vector shapes with a thick black
// outline (mini-stickers), each with a little white shine so they read as chunky
// vector art, not thin line work.
function Sticker({ kind }) {
  if (kind === 'star') {
    return (
      <span className="ppp-sticker ppp-sticker-star" aria-hidden="true">
        <svg viewBox="0 0 26 26">
          <path
            d="M13 1 L16.5 9.5 L25 10 L18.5 15.5 L21 24 L13 19 L5 24 L7.5 15.5 L1 10 L9.5 9.5 Z"
            fill="#FFE94A" stroke="#000" strokeWidth="3.4" strokeLinejoin="round"
            filter="url(#ppp-ink-thin)"
          />
          <circle cx="10.5" cy="10.5" r="1.6" fill="#fff" />
        </svg>
      </span>
    );
  }
  if (kind === 'drip') {
    return (
      <span className="ppp-sticker ppp-sticker-drip" aria-hidden="true">
        <svg viewBox="0 0 22 32">
          <path
            d="M11 1 C6.5 1 4 5.5 4 11 C4 17.5 11 19 11 28 C11 19 18 17.5 18 11 C18 5.5 15.5 1 11 1 Z"
            fill="#FF2EC4" stroke="#000" strokeWidth="3.2" strokeLinejoin="round"
            filter="url(#ppp-ink-thin)"
          />
          <ellipse cx="8.5" cy="9" rx="1.6" ry="3" fill="#fff" opacity="0.8" />
        </svg>
      </span>
    );
  }
  // dots — a chunky spray cluster
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

export default function PackPickerPreview() {
  const [selected, setSelected] = useState(() => new Set(ALL_IDS));

  const allOn = selected.size === PACKS.length;
  const count = selected.size;

  function togglePack(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleEverything() {
    setSelected((prev) => (prev.size === PACKS.length ? new Set() : new Set(ALL_IDS)));
  }

  return (
    <div className="ppp-stage">
      {/* ---- Ink/roughen filter defs: hidden, rendered once. feTurbulence makes
          noise; feDisplacementMap pushes each pixel of the bordered box / stroked
          path by it → a rough marker edge. Different seeds = different wobble. */}
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
          <filter id="ppp-ink-panel" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="ppp-ink-btn" x="-20%" y="-40%" width="140%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.016 0.022" numOctaves="2" seed="4" result="n" />
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

      {/* MOCK of the Blitz mode dialog panel. */}
      <div className="ppp-panel">
        <div className="ppp-panel-ink" aria-hidden="true" />
        <div className="ppp-halftone" aria-hidden="true" />

        <div className="ppp-content">
          <div className="ppp-chip">
            <span className="ppp-chip-ink" aria-hidden="true" />
            <span className="ppp-chip-text">SOLO · MULTI</span>
          </div>

          <div className="ppp-title-wrap">
            <span className="ppp-title-star" aria-hidden="true">
              <svg viewBox="0 0 26 26">
                <path
                  d="M13 1 L16.5 9.5 L25 10 L18.5 15.5 L21 24 L13 19 L5 24 L7.5 15.5 L1 10 L9.5 9.5 Z"
                  fill="#FFE94A" stroke="#000" strokeWidth="3.4" strokeLinejoin="round"
                  filter="url(#ppp-ink-thin)"
                />
                <circle cx="10.5" cy="10.5" r="1.6" fill="#fff" />
              </svg>
            </span>
            <h1 className="ppp-title">CATEGORY BLITZ</h1>
            <span className="ppp-title-drip" aria-hidden="true">
              <svg viewBox="0 0 22 32">
                <path
                  d="M11 1 C6.5 1 4 5.5 4 11 C4 17.5 11 19 11 28 C11 19 18 17.5 18 11 C18 5.5 15.5 1 11 1 Z"
                  fill="#3DA8FF" stroke="#000" strokeWidth="3.2" strokeLinejoin="round"
                  filter="url(#ppp-ink-thin)"
                />
                <ellipse cx="8.5" cy="9" rx="1.6" ry="3" fill="#fff" opacity="0.8" />
              </svg>
            </span>
          </div>

          <div className="ppp-subline">PICK YOUR PACKS — MIX &amp; MATCH</div>

          <button
            className={`ppp-every${allOn ? ' is-on' : ''}`}
            onClick={toggleEverything}
            type="button"
          >
            <span className="ppp-every-ink" aria-hidden="true" />
            <span className="ppp-every-text">
              <span className="ppp-every-star">★</span>
              EVERYTHING
              <span className="ppp-every-star">★</span>
            </span>
          </button>

          <div className="ppp-grid">
            {PACKS.map((p, i) => {
              const on = selected.has(p.id);
              const inkId = INK_IDS[i % INK_IDS.length];
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`ppp-pill${on ? ' is-on' : ''}`}
                  onClick={() => togglePack(p.id)}
                  style={{
                    '--pack': p.color,
                    '--pack-light': lighten(p.color, 0.5),
                    '--pack-deep': darken(p.color, 0.3),
                    '--rot': `${p.rot}deg`,
                    '--ink-url': `url(#${inkId})`,
                  }}
                  aria-pressed={on}
                >
                  <span className="ppp-pill-ink" aria-hidden="true" />
                  <span className="ppp-pill-body">
                    <span className="ppp-pill-emoji" aria-hidden="true">{p.emoji}</span>
                    <span className="ppp-pill-label">{p.label}</span>
                  </span>
                  {p.sticker && <Sticker kind={p.sticker} />}
                  {on && <RoughCheck />}
                  {on && <Sparkle />}
                </button>
              );
            })}
          </div>

          <div className="ppp-count">
            {count === 0
              ? 'NO PACKS — PICK AT LEAST ONE'
              : `${count} PACK${count === 1 ? '' : 'S'} LOADED`}
          </div>

          <div className="ppp-actions">
            <button type="button" className="ppp-btn ppp-btn-create" disabled={count === 0}>
              <span className="ppp-btn-ink" aria-hidden="true" />
              <span className="ppp-btn-text">CREATE</span>
            </button>
            <button type="button" className="ppp-btn ppp-btn-join">
              <span className="ppp-btn-ink" aria-hidden="true" />
              <span className="ppp-btn-text">JOIN</span>
            </button>
          </div>
        </div>
      </div>

      <div className="ppp-watermark">PREVIEW · /#pack-preview · not wired to game logic</div>
    </div>
  );
}
