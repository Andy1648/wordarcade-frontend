// ParticleField.jsx
// A persistent, lightweight field of small glowing dots drifting up the screen
// at all times, behind the content. Pure CSS motion; on a detected beat (the
// html[data-beat] hook set by useBeatSync) they all briefly speed up, so the
// field "jumps" with the music. Static module config (no per-render randomness)
// so the layout never reshuffles on re-render. 12 nodes total.
import './ParticleField.css';

const PARTICLES = [
  { left: 6,  size: 4, dur: 14, delay: 0,   color: '#FF2EC4', op: 0.13 },
  { left: 15, size: 3, dur: 18, delay: 3,   color: '#2EFFE0', op: 0.11 },
  { left: 24, size: 5, dur: 12, delay: 6,   color: '#FFE94A', op: 0.10 },
  { left: 33, size: 3, dur: 20, delay: 1.5, color: '#FF6B3D', op: 0.14 },
  { left: 42, size: 4, dur: 16, delay: 8,   color: '#9A1AFF', op: 0.12 },
  { left: 51, size: 5, dur: 13, delay: 4,   color: '#2EFFE0', op: 0.11 },
  { left: 60, size: 3, dur: 19, delay: 10,  color: '#FF2EC4', op: 0.13 },
  { left: 69, size: 4, dur: 15, delay: 2,   color: '#FFE94A', op: 0.10 },
  { left: 78, size: 5, dur: 11, delay: 7,   color: '#FF6B3D', op: 0.12 },
  { left: 86, size: 3, dur: 17, delay: 5,   color: '#2EFFE0', op: 0.11 },
  { left: 93, size: 4, dur: 21, delay: 9,   color: '#9A1AFF', op: 0.13 },
  { left: 48, size: 3, dur: 23, delay: 12,  color: '#FF2EC4', op: 0.10 },
];

export default function ParticleField() {
  return (
    <div className="particle-field" aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="particle"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            '--p-op': p.op,
            '--p-dur': `${p.dur}s`,
            '--p-delay': `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
