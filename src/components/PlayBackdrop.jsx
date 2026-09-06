// PlayBackdrop.jsx
// The SAME dressed graffiti-wall backdrop the menu shows (WallScene), but rendered as a
// STATIC, self-contained layer scoped INSIDE a single play surface (the solo shell, the
// multiplayer game stage, the RUN stage). Before this, those play screens painted a flat
// dark panel over the persistent WallScene, so identical geometry read as a hole while the
// menu/shop/dialogs read "dressed". This drops the graffiti back behind the play content so
// every surface reads as one thing.
//
// WHY A SEPARATE, STATIC COMPONENT (not another <WallScene/>):
//   - The persistent WallScene is a SIBLING far outside these play roots, so the BE-PICKY
//     largest-empty-rectangle measure (which only counts content-bearing DOM *inside* the
//     measured root) never sees it. The wall's ink must live INSIDE the play root to fill
//     the void — hence a scoped layer.
//   - It runs DURING gameplay, so it must be CHEAP: NO self-writing-tag timers, NO cursor
//     parallax rAF, NO beat-driven halftone/flash, NO idle/infinite animation, NO per-frame
//     layout. Everything here is static module-level config painted once and composited.
//     (transform/opacity are the only properties touched, and only as static values.)
//
// It reuses the exact decor vocabulary + palette of WallScene (GraffitiTag / StickerInner /
// PaintSplatters) so it is visually the same wall, just calm and contained.
import { memo } from 'react';
import { StickerInner } from './decor/Stickers';
import GraffitiTag from './decor/GraffitiTag';
import {
  PaintSplatter1,
  PaintSplatter2,
  PaintSplatter3,
  PaintSplatter4,
  PaintSplatter5,
} from './decor/PaintSplatters';
import './WallScene.css'; // reuse .wall-bricks / .wall-floor-shade / .wall-splatter / .wall-sticker / .wall-halftone
import './PlayBackdrop.css';

// palette fill + a darker shade of each fill used as its colored outline (never black —
// per the project's colored-outline rule). Same pairs as WallScene.
const PINK = { fill: '#ff4fa3', line: '#991A75' };
const CYAN = { fill: '#2EFFE0', line: '#1A9985' };
const YELLOW = { fill: '#FFE94A', line: '#B8A020' };
const ORANGE = { fill: '#FF6B3D', line: '#B83D15' };
const PURPLE = { fill: '#9A1AFF', line: '#5A0EAA' };

// Spray-painted word tags, spread on a staggered layout so no large axis-aligned void
// survives at any play root's aspect (a framed card OR the full-viewport RUN stage). Faint
// (0.12–0.15) so they read as ambient wall grime behind the play UI, never competing with it.
const TAGS = [
  { word: 'WORD', c: PINK,   size: 40, rot: -12, top: 6,  left: 4,  op: 0.14, drip: 30 },
  { word: 'BOOM', c: YELLOW, size: 34, rot: 14,  top: 9,  left: 40, op: 0.13, drip: 0 },
  { word: 'ZAP',  c: CYAN,   size: 30, rot: -20, top: 5,  left: 76, op: 0.14, drip: 20 },
  { word: 'POW',  c: ORANGE, size: 36, rot: 16,  top: 22, left: 20, op: 0.13, drip: 0 },
  { word: 'FIRE', c: PURPLE, size: 38, rot: -8,  top: 20, left: 60, op: 0.13, drip: 30 },
  { word: 'GG',   c: YELLOW, size: 28, rot: 24,  top: 34, left: 88, op: 0.13, drip: 0 },
  { word: 'EPIC', c: CYAN,   size: 30, rot: -16, top: 40, left: 6,  op: 0.13, drip: 0 },
  { word: 'WOW',  c: PINK,   size: 32, rot: 10,  top: 52, left: 78, op: 0.14, drip: 24 },
  { word: 'EZ',   c: ORANGE, size: 26, rot: -26, top: 60, left: 34, op: 0.13, drip: 18 },
  { word: 'YOLO', c: YELLOW, size: 30, rot: -6,  top: 68, left: 12, op: 0.13, drip: 0 },
  { word: 'RIP',  c: PURPLE, size: 28, rot: 20,  top: 74, left: 62, op: 0.13, drip: 20 },
  { word: 'DOPE', c: CYAN,   size: 30, rot: 14,  top: 84, left: 30, op: 0.13, drip: 0 },
  { word: 'HYPE', c: PINK,   size: 30, rot: -12, top: 88, left: 82, op: 0.14, drip: 24 },
  { word: 'SICK', c: ORANGE, size: 28, rot: 18,  top: 46, left: 50, op: 0.12, drip: 0 },
];

// Decorative stickers slapped on the wall (kind drives the inline SVG body). Flat fill + a
// thick darker-shade outline, slight rotation, low opacity, static.
const STICKERS = [
  { kind: 'star',   c: YELLOW, size: 44, rot: -14, top: 14, left: 30, op: 0.16 },
  { kind: 'bolt',   c: CYAN,   size: 42, rot: 18,  top: 30, left: 90, op: 0.16 },
  { kind: 'skull',  c: PINK,   size: 46, rot: -8,  top: 64, left: 8,  op: 0.15 },
  { kind: 'crown',  c: ORANGE, size: 46, rot: 12,  top: 12, left: 66, op: 0.16 },
  { kind: 'bomb',   c: PURPLE, size: 40, rot: -22, top: 78, left: 48, op: 0.15 },
  { kind: 'speech', c: PINK,   size: 44, rot: 8,   top: 44, left: 22, op: 0.16 },
  { kind: 'star',   c: CYAN,   size: 40, rot: 16,  top: 90, left: 60, op: 0.15 },
  { kind: 'crown',  c: YELLOW, size: 42, rot: -12, top: 56, left: 92, op: 0.16 },
];

// Big spray-paint splatters — low opacity, cheap wide area coverage so the periphery of the
// wide RUN stage never reads as a flat void.
const SPLATTERS = [
  { comp: PaintSplatter1, color: '#ff4fa3', size: 160, top: 8,  left: 54, rot: 14,  op: 0.11 },
  { comp: PaintSplatter3, color: '#FFE94A', size: 150, top: 58, left: 4,  rot: -20, op: 0.10 },
  { comp: PaintSplatter5, color: '#2EFFE0', size: 140, top: 76, left: 66, rot: 8,   op: 0.11 },
  { comp: PaintSplatter2, color: '#9A1AFF', size: 150, top: 28, left: 30, rot: -10, op: 0.10 },
  { comp: PaintSplatter4, color: '#FF6B3D', size: 150, top: 70, left: 84, rot: 12,  op: 0.10 },
  { comp: PaintSplatter1, color: '#2EFFE0', size: 140, top: 4,  left: 86, rot: 20,  op: 0.10 },
];

// Dried vertical paint streaks (decorative only; divs, not counted as ink — pure look).
const DRIPS = [
  { left: 22, w: 3, h: 160, c: PINK,   op: 0.12 },
  { left: 58, w: 4, h: 220, c: YELLOW, op: 0.11 },
  { left: 90, w: 2, h: 180, c: PURPLE, op: 0.10 },
];

/**
 * A static, non-interactive graffiti-wall backdrop scoped to a play surface.
 * Mount it as the FIRST child of a positioned play root; CSS pins it to the root and drops
 * it behind the content (z-index:-1), so it never intercepts pointer events or covers the UI.
 * @param {object} props
 * @param {string} [props.className] extra class (per-mode tint hook, optional)
 */
// memo: several play roots (the solo shell, the game stage) re-render every frame while a
// clock ticks. PlayBackdrop's output depends only on `className`, so memo lets React skip
// re-reconciling its ~28 static decor nodes on those per-frame parent renders — it paints
// once and then costs nothing per frame.
function PlayBackdrop({ className = '' }) {
  return (
    <div className={`play-backdrop${className ? ` ${className}` : ''}`} aria-hidden="true">
      {/* Wall tone (soft top-lit concrete) + floor shade — the same ambient base as the menu wall. */}
      <div className="wall-bricks" />
      <div className="wall-floor-shade" />

      {/* Splatters (organic blob + droplets). */}
      {SPLATTERS.map((sp, i) => {
        const Splat = sp.comp;
        return (
          <div
            key={`splat${i}`}
            className="wall-splatter"
            style={{
              top: `${sp.top}%`,
              left: `${sp.left}%`,
              width: `${sp.size}px`,
              height: `${sp.size}px`,
              opacity: sp.op,
              transform: `rotate(${sp.rot}deg)`,
            }}
          >
            <Splat color={sp.color} className="wall-splatter-svg" />
          </div>
        );
      })}

      {/* Spray-painted tags. */}
      {TAGS.map((t, i) => (
        <GraffitiTag
          key={`tag${i}`}
          word={t.word}
          fill={t.c.fill}
          line={t.c.line}
          size={t.size}
          top={t.top}
          left={t.left}
          rotation={t.rot}
          opacity={t.op}
          drip={t.drip}
        />
      ))}

      {/* Stickers. */}
      {STICKERS.map((st, i) => (
        <svg
          key={`stk${i}`}
          className="wall-sticker"
          viewBox="-50 -50 100 100"
          aria-hidden="true"
          style={{
            top: `${st.top}%`,
            left: `${st.left}%`,
            width: `${st.size}px`,
            height: `${st.size}px`,
            opacity: st.op,
            '--rot': `${st.rot}deg`,
          }}
        >
          <StickerInner kind={st.kind} fill={st.c.fill} line={st.c.line} />
        </svg>
      ))}

      {/* Dried paint drips (decor only). */}
      {DRIPS.map((d, i) => (
        <div
          key={`drip${i}`}
          className="wall-paint-drip"
          style={{
            left: `${d.left}%`,
            width: `${d.w}px`,
            height: `${d.h}px`,
            background: d.c.fill,
            opacity: d.op,
          }}
        />
      ))}

      {/* Comic halftone dot texture (static opacity — no per-frame recompute). */}
      <div className="wall-halftone" />
    </div>
  );
}

export default memo(PlayBackdrop);
