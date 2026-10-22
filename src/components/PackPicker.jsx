// PackPicker.jsx — the Category Blitz pack-picker (Stage 1).
//
// CONTROLLED: renders from props (packs/selected/onToggle/onSetAll) — a pack is
// "on" when its id is in `selected`, and a click calls onToggle(id); the parent
// owns the selection. This widget embeds INSIDE the Blitz ModeDialog, which owns
// the surrounding panel/scrim chrome.
//
// LOOK — Andy oct21 ("too AI generated" → picked direction A, STICKER SLAP): every pack is its own
// painted die-cut sticker (public/blitz-packs/<id>.webp, one Gemini set), slapped onto the navy board
// at the pack's hand-set `rot` from packs.js. No tile box, no emoji: the art's silhouette IS the tile.
// ON = full colour at its tilt; OFF = peeled (dimmed, flattened, shrunk). A black check disc marks ON
// so state never rides on opacity alone.
//
// MOTION — minimal: ONE select-pop on toggle, a press squash (:active), a hover
// lift that straightens the sticker, and a shared 500ms beat that pulses SELECTED
// tiles only, rippled across the grid by each tile's --i. No idle bob, nothing loops.
//
// Props:
//   packs     : array of { id, label, rot, count } — art is /blitz-packs/<id>.webp
//   selected  : Set | array of selected pack ids
//   onToggle  : (id) => void — parent flips selection
//   onSetAll  : (all: boolean) => void — SELECT ALL / CLEAR
//   rounds / onSetRounds : the game length (3 / 5 / 10); the row is hidden without onSetRounds
import { useEffect, useMemo, useRef, useState } from 'react';
import './PackPicker.css';
import { reduceMotion } from '../lib/reduceMotion';
import { beatSyncOn } from '../lib/beatSync';

function prefersReduced() {
  return reduceMotion();
}

const ROUND_OPTIONS = [3, 5, 10];

export default function PackPicker({ packs, selected, onToggle, onSetAll, rounds = 3, onSetRounds }) {
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
      if (!host || !beatSyncOn()) return; // Andy oct14: BEAT SYNC off = no pulsing
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
                    style={{ '--tilt': `${p.rot || 0}deg` }}
                    onClick={() => { addPop(p.id); onToggle(p.id); }}
                    aria-pressed={on}
                    aria-label={p.label}
                  >
                    <img className="ppp-sticker" src={`/blitz-packs/${p.id}.webp`} alt="" draggable="false" decoding="async" />
                    <span className="ppp-pill-label">{p.label}</span>
                    <span className="ppp-pill-count" aria-hidden="true">{p.count}</span>
                    {on && (
                      <span className="ppp-check" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M5 13 L10 18 L19 6" fill="none" stroke="#2EFFE0"
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

      {onSetRounds && (
        <div className="ppp-rounds" role="radiogroup" aria-label="Rounds">
          <span className="ppp-rounds-label">ROUNDS</span>
          {ROUND_OPTIONS.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rounds === n}
              className={`ppp-round${rounds === n ? ' is-on' : ''}`}
              onClick={() => onSetRounds(n)}>
              {n}
            </button>
          ))}
        </div>
      )}

      <div className="ppp-count">
        <span className="ppp-count-num" key={`${count}-${cats}`}>
          {count === 0
            ? 'PICK AT LEAST ONE PACK'
            : `${count} PACK${count === 1 ? '' : 'S'} · ${cats} ${cats === 1 ? 'CATEGORY' : 'CATEGORIES'}`}
        </span>
      </div>
    </div>
  );
}
