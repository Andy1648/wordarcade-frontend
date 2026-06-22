// Mascot.jsx
// The reactive bomb mascot. Swaps between five pose PNGs; changing `pose`
// remounts the <img> (key={pose}) so the pop-in enter animation replays.
//
// Three nested layers keep the transforms from fighting (only one CSS animation
// can own `transform` per element):
//   .mascot-container  -> beat-pop on each detected music beat (data-beat)
//   .mascot-bounce     -> the constant idle squash-stretch
//   .mascot-img        -> the per-pose enter pop
import './Mascot.css';

const POSE_SRC = {
  idle: '/mascot-idle.png',
  panic: '/mascot-panic.png',
  celebrate: '/mascot-celebrate.png',
  run: '/mascot-run.png',
  taunt: '/mascot-taunt.png',
};

export default function Mascot({ pose = 'idle', size = 120, className = '', style }) {
  const src = POSE_SRC[pose] || POSE_SRC.idle;
  return (
    <div
      className={`mascot-container${className ? ` ${className}` : ''}`}
      style={{ '--mascot-size': `${size}px`, ...style }}
      aria-hidden="true"
    >
      <div className="mascot-bounce">
        <img key={pose} className="mascot-img" src={src} alt="" draggable="false" />
      </div>
    </div>
  );
}
