// ModeDialogBackground.jsx
// STATIC per-mode background for the mode dialog (fix/dialog-quality item 1). The animated
// <canvas> (flame / streaks, painting on rAF behind the content) was the cause of the choppy
// open — main-thread per-frame drawing competing with the open transition. It is GONE: this is
// now a single static SVG starburst tinted to the mode accent, no rAF, no draw loop. The `mode`
// prop selects the accent; `roar` is accepted-and-ignored for call-site compatibility.
import { MODES } from './modeDialogConfig';

export { MODES };

// One static starburst behind the content — flat, no animation. Rays radiate from up-centre and
// fade out; painted once as SVG. `preserveAspectRatio: none` lets it stretch to fill.
const RAYS = [-84, -61, -40, -12, 8, 33, 55, 78, 100, 128, 152, 168, -168, -140, -116];

export default function ModeDialogBackground({ mode = 'bomb' }) {
  const accent = (MODES[mode] || MODES.bomb).accent;
  const CX = 50;
  const CY = 30; // up-centre origin
  return (
    <svg
      className="mode-dialog-bg-burst"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {RAYS.map((a, i) => {
        const rad = (a * Math.PI) / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        return (
          <line
            key={i}
            x1={CX + dx * 8}
            y1={CY + dy * 8}
            x2={CX + dx * 90}
            y2={CY + dy * 90}
            stroke={accent}
            strokeWidth={i % 3 === 0 ? 0.7 : 0.35}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}
