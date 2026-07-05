// PackPickerPreview.jsx
// THROWAWAY design preview — a Category Blitz pack-picker built into a MOCK of
// the Blitz mode dialog. NOT wired to game logic, WS, createGame, or the real
// ModeDialog. Pure visual iteration surface. View it at /#pack-preview (see
// main.jsx conditional mount). Aesthetic target: Friday Night Funkin' freeplay
// menu — thick black outlines, outlined arcade lettering, high-saturation flat
// fills, chunky hard offset shadows, pill/capsule shapes, hand-placed rotations.
import { useMemo, useState } from 'react';
import './PackPickerPreview.css';

// 14 packs. `color` is the high-saturation fill worn when SELECTED; deselected
// tiles fall back to a dark dimmed chip (see CSS). `rot` is a hand-placed resting
// tilt so the row reads as stuck-on stickers, never a tidy grid. `emoji` is pure
// flavor — the label itself is Bungee.
const PACKS = [
  { id: 'movies',     label: 'MOVIES',     emoji: '🎬', color: '#FF2EC4', rot: -3 },
  { id: 'gaming',     label: 'GAMING',     emoji: '🎮', color: '#2EFFE0', rot: 2.5 },
  { id: 'food',       label: 'FOOD',       emoji: '🍔', color: '#FF6B3D', rot: -1.5 },
  { id: 'animals',    label: 'ANIMALS',    emoji: '🐾', color: '#FFE94A', rot: 3 },
  { id: 'sports',     label: 'SPORTS',     emoji: '⚽', color: '#3DFF77', rot: -2.5 },
  { id: 'world',      label: 'WORLD',      emoji: '🌍', color: '#3DA8FF', rot: 1.5 },
  { id: 'music',      label: 'MUSIC',      emoji: '🎵', color: '#9A28FF', rot: -2 },
  { id: 'science',    label: 'SCIENCE',    emoji: '🔬', color: '#2ED6FF', rot: 2 },
  { id: 'history',    label: 'HISTORY',    emoji: '🏛️', color: '#FF9F1C', rot: -3 },
  { id: 'mythology',  label: 'MYTHOLOGY',  emoji: '⚡', color: '#B14DFF', rot: 1 },
  { id: 'literature', label: 'LITERATURE', emoji: '📚', color: '#FF5CA8', rot: -1 },
  { id: 'tech',       label: 'TECH',       emoji: '💻', color: '#4D8BFF', rot: 2.5 },
  { id: 'art',        label: 'ART',        emoji: '🎨', color: '#FFD23D', rot: -2.5 },
  { id: 'tv',         label: 'TV',         emoji: '📺', color: '#FF4D6D', rot: 3 },
];

const ALL_IDS = PACKS.map((p) => p.id);

// Darken a #rrggbb toward black by f (0..1) — used for each pill's own darker
// outline (FNF outlines are black, but the deselected chip + selected shadow tints
// read richer with a shade of the fill in places).
function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f));
  const g = Math.round(((n >> 8) & 255) * (1 - f));
  const b = Math.round((n & 255) * (1 - f));
  return `rgb(${r}, ${g}, ${b})`;
}

export default function PackPickerPreview() {
  const [selected, setSelected] = useState(() => new Set(ALL_IDS));

  const allOn = selected.size === PACKS.length;

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

  const count = selected.size;

  return (
    <div className="ppp-stage">
      {/* MOCK of the Blitz mode dialog panel. Not the real ModeDialog — a
          standalone shell so the picker can be iterated at real fidelity. */}
      <div className="ppp-panel">
        {/* Halftone dot grit — very low opacity, sits above the fill, below content. */}
        <div className="ppp-halftone" aria-hidden="true" />

        <div className="ppp-content">
          <div className="ppp-chip">SOLO · MULTI</div>

          <h1 className="ppp-title" data-text="CATEGORY BLITZ">CATEGORY BLITZ</h1>

          <div className="ppp-subline">PICK YOUR PACKS — MIX &amp; MATCH</div>

          {/* EVERYTHING master toggle. */}
          <button
            className={`ppp-every${allOn ? ' is-on' : ''}`}
            onClick={toggleEverything}
            type="button"
          >
            <span className="ppp-every-star">★</span>
            EVERYTHING
            <span className="ppp-every-star">★</span>
          </button>

          {/* The pack pills. */}
          <div className="ppp-grid">
            {PACKS.map((p) => {
              const on = selected.has(p.id);
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
                  }}
                  aria-pressed={on}
                >
                  <span className="ppp-pill-emoji" aria-hidden="true">{p.emoji}</span>
                  <span className="ppp-pill-label">{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Count readout + actions. */}
          <div className="ppp-count">
            {count === 0
              ? 'NO PACKS — PICK AT LEAST ONE'
              : `${count} PACK${count === 1 ? '' : 'S'} LOADED`}
          </div>

          <div className="ppp-actions">
            <button type="button" className="ppp-btn ppp-btn-create" disabled={count === 0}>
              CREATE
            </button>
            <button type="button" className="ppp-btn ppp-btn-join">
              JOIN
            </button>
          </div>
        </div>
      </div>

      <div className="ppp-watermark">PREVIEW · /#pack-preview · not wired to game logic</div>
    </div>
  );
}
