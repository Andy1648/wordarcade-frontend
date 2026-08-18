// PackPicker.jsx — the Category Blitz pack-picker (Stage 1).
//
// CONTROLLED: renders from props (packs/selected/onToggle/onSetAll) — a pack is
// "on" when its id is in `selected`, and a click calls onToggle(id); the parent
// owns the selection. This widget embeds INSIDE the Blitz ModeDialog, which owns
// the surrounding panel/scrim chrome.
//
// LOOK — flat blocky tiles on Blitz blue, on the locked house style: flat fill,
// 3px black outline, 10px radius, hard offset shadow, alternating ±1.1° tilt that
// straightens on hover. Colour is STATE, not identity: ON = #3DA8FF, OFF =
// #152744. The per-pack color/rot/sticker fields in packs.js are IGNORED here —
// only id / label / emoji / count are used. No SVG-filter ink, no stickers.
//
// MOTION — minimal: ONE select-pop on toggle, a press squash (:active), a hover
// lift, and a shared 500ms beat that pulses SELECTED tiles only, rippled across
// the grid by each tile's --i. No idle bob, no per-item motion signature.
//
// Props:
//   packs     : array of { id, label, emoji, count }
//   selected  : Set | array of selected pack ids
//   onToggle  : (id) => void — parent flips selection
//   onSetAll  : (all: boolean) => void — SELECT ALL / CLEAR
import { useEffect, useMemo, useRef, useState } from 'react';
import './PackPicker.css';

function prefersReduced() {
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function PackPicker({ packs, selected, onToggle, onSetAll }) {
  // Selection comes from props (controlled). Normalise Set|array to a Set for O(1) lookups.
  const selectedSet = useMemo(
    () => (selected instanceof Set ? selected : new Set(selected || [])),
    [selected],
  );
  const count = selectedSet.size;
  const allOn = count === packs.length;
  // Total categories across the SELECTED packs — the footer's headline number.
  const cats = useMemo(
    () => packs.reduce((s, p) => (selectedSet.has(p.id) ? s + p.count : s), 0),
    [packs, selectedSet],
  );

  // Transient select-pop flags (visual feedback only — NOT the selection). Cleared
  // on animation end so a tile can pop again on its next toggle.
  const [popping, setPopping] = useState(() => new Set());
  const addPop = (id) => setPopping((s) => { const n = new Set(s); n.add(id); return n; });
  const clearPop = (id) => setPopping((s) => { if (!s.has(id)) return s; const n = new Set(s); n.delete(id); return n; });

  // ONE shared beat clock → toggles data-beat; CSS pulses selected tiles, rippled
  // by each tile's --i. No per-item timer, no re-render per beat. Off under reduced
  // motion.
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

  return (
    <div className="ppp-picker" ref={stageRef}>
      {onSetAll && (
        <button type="button" className="ppp-selall"
          onClick={() => onSetAll(!allOn)}
          aria-label={allOn ? 'Clear pack selection' : 'Select all packs'}>
          {allOn ? 'CLEAR' : 'SELECT ALL'}
        </button>
      )}

      <div className="ppp-subline">
        <span className="ppp-subline-glyph" aria-hidden="true">▓</span> PICK YOUR PACKS
      </div>

      <div className="ppp-window">
        {/* KEEP the inner scroll window so the pack grid never blows out the dialog. */}
        <div className="ppp-window-scroll">
          <div className="ppp-grid">
            {packs.map((p, i) => {
              const on = selectedSet.has(p.id);
              return (
                <div
                  className={`ppp-pill-wrap${on ? ' is-on' : ''}${popping.has(p.id) ? ' pop' : ''}`}
                  style={{ '--i': i }}
                  key={p.id}
                  onAnimationEnd={(e) => { if (e.target === e.currentTarget) clearPop(p.id); }}
                >
                  <button
                    type="button"
                    className={`ppp-pill${on ? ' is-on' : ''}`}
                    style={{ '--tilt': `${i % 2 === 0 ? -1.1 : 1.1}deg` }}
                    onClick={() => { addPop(p.id); onToggle(p.id); }}
                    aria-pressed={on}
                    aria-label={p.label}
                  >
                    <span className="ppp-pill-emoji" aria-hidden="true">{p.emoji}</span>
                    <span className="ppp-pill-label">{p.label}</span>
                    <span className="ppp-pill-count" aria-hidden="true">{p.count}</span>
                    {on && (
                      <span className="ppp-check" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M5 13 L10 18 L19 6" fill="none" stroke="#3DA8FF"
                            strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ppp-count">
        <span className="ppp-count-num" key={`${count}-${cats}`}>
          {count === 0
            ? 'NO PACKS — PICK AT LEAST ONE'
            : `${count} PACK${count === 1 ? '' : 'S'} · ${cats} ${cats === 1 ? 'CATEGORY' : 'CATEGORIES'} LOADED`}
        </span>
      </div>
    </div>
  );
}
