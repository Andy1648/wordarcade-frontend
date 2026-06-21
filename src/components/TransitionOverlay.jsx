// TransitionOverlay.jsx
// A Persona 5-style diagonal bar wipe played over a view change. App mounts this
// with a fresh `key` each navigation so the whole 500ms animation replays:
//   - 0-250ms: five skewed palette-coloured bars sweep in from the left
//     (staggered 30ms each), covering the screen.
//   - at the peak: a big white Bungee word flashes for ~150ms.
//   - 250-500ms: the bars continue right and exit.
// Fixed, full-screen, and pointer-events:none so it never blocks the UI.
import './TransitionOverlay.css';

// Five bars in the graffiti palette, each kicking off 30ms after the previous.
const BARS = [
  { color: '#FF2EC4', delay: 0 },
  { color: '#FFE94A', delay: 30 },
  { color: '#2EFFE0', delay: 60 },
  { color: '#FF6B3D', delay: 90 },
  { color: '#9A1AFF', delay: 120 },
];

export default function TransitionOverlay({ word }) {
  return (
    <div className="transition-overlay" aria-hidden="true">
      {BARS.map((b, i) => (
        <span
          key={i}
          className="transition-bar"
          style={{
            background: b.color,
            // Tile the bars across the screen so that at mid-sweep they overlap
            // into full coverage; each then rides the same sweep keyframe.
            left: `${i * 22 - 20}%`,
            animationDelay: `${b.delay}ms`,
          }}
        />
      ))}
      {word && <div className="transition-word">{word}</div>}
    </div>
  );
}
