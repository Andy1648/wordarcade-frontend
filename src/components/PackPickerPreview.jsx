// PackPickerPreview.jsx
// THROWAWAY design preview — a Category Blitz pack-picker built into a MOCK of
// the Blitz mode dialog. NOT wired to game logic, WS, createGame, or the real
// ModeDialog. Pure visual iteration surface. View it at /#pack-preview (see
// main.jsx conditional mount).
//
// Aesthetic: cute hand-drawn vector stickers slapped in a dialog, graffiti
// energy — Newgrounds/FNF, NOT a polished component library. The KEY move is the
// edge quality: every outline (pills, panel, buttons, title) is roughed by an SVG
// feTurbulence + feDisplacementMap filter so the black outline reads as an inked
// marker/spray line of uneven thickness, never a clean CSS border. The colored
// fill + the crisp Bungee label ride ON TOP of the roughed ink layer, so text
// stays legible while its frame wobbles.
import { useState } from 'react';
import './PackPickerPreview.css';

// 14 packs. `color` = the high-saturation fill worn when SELECTED. `rot` = a
// hand-placed resting tilt. `sticker` = an optional little graffiti accent
// slapped on the tile (star / drip / spray dots) for character — only a few, so
// it stays cute not cluttered. `ink` picks one of three displacement seeds so no
// two tiles wobble identically.
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

// Hand-drawn checkmark stamped on selected tiles — a rough two-stroke tick, black
// marker over a little pack-colored blob. Roughed by the thin ink filter.
function RoughCheck() {
  return (
    <span className="ppp-check" aria-hidden="true">
      <svg viewBox="0 0 28 28" className="ppp-check-svg">
        <path
          d="M5 15 Q9 18 11 21 Q16 11 23 6"
          fill="none"
          stroke="#000"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#ppp-ink-thin)"
        />
      </svg>
    </span>
  );
}

// Little slapped-on graffiti stickers. Each is a rough inked doodle.
function Sticker({ kind }) {
  if (kind === 'star') {
    return (
      <span className="ppp-sticker ppp-sticker-star" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path
            d="M12 2 L15 9 L22 9.5 L16.5 14 L18.5 21 L12 17 L5.5 21 L7.5 14 L2 9.5 L9 9 Z"
            fill="#FFE94A"
            stroke="#000"
            strokeWidth="2.4"
            strokeLinejoin="round"
            filter="url(#ppp-ink-thin)"
          />
        </svg>
      </span>
    );
  }
  if (kind === 'drip') {
    return (
      <span className="ppp-sticker ppp-sticker-drip" aria-hidden="true">
        <svg viewBox="0 0 20 30">
          <path
            d="M10 1 C6 1 4 5 4 10 C4 16 10 18 10 26 C10 18 16 16 16 10 C16 5 14 1 10 1 Z"
            fill="#FF2EC4"
            stroke="#000"
            strokeWidth="2.2"
            strokeLinejoin="round"
            filter="url(#ppp-ink-thin)"
          />
        </svg>
      </span>
    );
  }
  // dots — a little spray cluster
  return (
    <span className="ppp-sticker ppp-sticker-dots" aria-hidden="true">
      <svg viewBox="0 0 26 22">
        <g stroke="#000" strokeWidth="1.6" filter="url(#ppp-ink-thin)">
          <circle cx="6" cy="7" r="3.4" fill="#2EFFE0" />
          <circle cx="17" cy="5" r="2.4" fill="#FF6B3D" />
          <circle cx="20" cy="14" r="3" fill="#FFE94A" />
          <circle cx="10" cy="16" r="2" fill="#9A28FF" />
        </g>
      </svg>
    </span>
  );
}

// One inked outline layer: sits behind the tile's label, wears the fill + the
// thick black border, and gets the displacement filter (via CSS var --ink-url)
// so its edge goes wobbly + the hard offset shadow follows the wobble.
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
      {/* ---- Filter defs: the ink/roughen filters. Hidden, rendered once. ----
          feTurbulence makes noise; feDisplacementMap pushes each pixel of the
          source (the bordered box / stroked path) by that noise → a rough,
          marker-drawn edge of uneven thickness. Different seeds = different
          wobble so tiles don't all ripple in sync. */}
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
          {/* Bigger, gentler wobble for the large panel frame. */}
          <filter id="ppp-ink-panel" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* Buttons. */}
          <filter id="ppp-ink-btn" x="-20%" y="-40%" width="140%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.016 0.022" numOctaves="2" seed="4" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* Title: small scale so the outlined lettering stays readable but the
              stroke edge still ripples like it was inked by hand. */}
          <filter id="ppp-ink-title" x="-8%" y="-30%" width="116%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.014 0.02" numOctaves="2" seed="3" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* Thin doodles (check, stickers). */}
          <filter id="ppp-ink-thin" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.05 0.06" numOctaves="2" seed="6" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* MOCK of the Blitz mode dialog panel. */}
      <div className="ppp-panel">
        {/* Roughed frame layer: the wobbly inked black border + its hard offset
            shadow. Behind everything. */}
        <div className="ppp-panel-ink" aria-hidden="true" />
        {/* Halftone dot grit — very low opacity. */}
        <div className="ppp-halftone" aria-hidden="true" />

        <div className="ppp-content">
          <div className="ppp-chip">
            <span className="ppp-chip-ink" aria-hidden="true" />
            <span className="ppp-chip-text">SOLO · MULTI</span>
          </div>

          <div className="ppp-title-wrap">
            {/* graffiti star tucked by the title */}
            <span className="ppp-title-star" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M12 2 L15 9 L22 9.5 L16.5 14 L18.5 21 L12 17 L5.5 21 L7.5 14 L2 9.5 L9 9 Z"
                  fill="#FFE94A" stroke="#000" strokeWidth="2.4" strokeLinejoin="round"
                  filter="url(#ppp-ink-thin)"
                />
              </svg>
            </span>
            <h1 className="ppp-title">CATEGORY BLITZ</h1>
            {/* a little paint drip off the title */}
            <span className="ppp-title-drip" aria-hidden="true">
              <svg viewBox="0 0 20 30">
                <path
                  d="M10 1 C6 1 4 5 4 10 C4 16 10 18 10 26 C10 18 16 16 16 10 C16 5 14 1 10 1 Z"
                  fill="#3DA8FF" stroke="#000" strokeWidth="2.2" strokeLinejoin="round"
                  filter="url(#ppp-ink-thin)"
                />
              </svg>
            </span>
          </div>

          <div className="ppp-subline">PICK YOUR PACKS — MIX &amp; MATCH</div>

          {/* EVERYTHING master toggle. */}
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

          {/* The pack pills. */}
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
                    '--pack-dark': darken(p.color, 0.5),
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
                </button>
              );
            })}
          </div>

          {/* Count readout. */}
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
