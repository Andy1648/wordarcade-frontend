// Mascot.jsx
// The reactive bomb mascot. Swaps between five pose PNGs; changing `pose`
// remounts the <img> (key={pose}) so the pop-in enter animation replays.
//
// Four nested layers keep the transforms from fighting (only one CSS animation
// can own `transform` per element):
//   .mascot-container  -> beat-pop on each detected music beat (data-beat)
//   .mascot-emote      -> a transient/looping EMOTION reaction (see EMOTES below),
//                         driven by the `emote` prop from game state/events
//   .mascot-bounce     -> the constant idle squash-stretch
//   .mascot-img        -> the per-pose enter pop
//
// `emote` is layered ON TOP of `pose` so callers can both swap to a fitting pose
// PNG and play a motion reaction (e.g. pose="celebrate" + emote="celebrate" on a
// win, or pose="panic" + emote="slump" on a loss). Emotes are pure transform /
// filter (GPU-friendly, no layout) and never block input (the mascot is
// pointer-events:none). All are gated under prefers-reduced-motion in the CSS.
import './Mascot.css';

const POSE_SRC = {
  idle: '/mascot-idle.png',
  panic: '/mascot-panic.png',
  celebrate: '/mascot-celebrate.png',
  run: '/mascot-run.png',
  taunt: '/mascot-taunt.png',
};

// Recognised emote names -> their CSS class. Anything else (or null) = no emote.
//   bored     : lobby/waiting - occasional impatient fidget (loops)
//   pop       : a player joined - excited scale-up + brightness flash (one-shot)
//   bob       : your word accepted - a small happy bob (one-shot)
//   flinch    : life lost / answer rejected - shake + squash recoil (one-shot)
//   ko        : eliminated - knocked-back tilt then recover (one-shot)
//   celebrate : victory - bounce + wiggle (loops)
//   slump     : defeat - droop down + desaturate, then hold (one-shot, holds)
const EMOTES = new Set([
  'bored',
  'pop',
  'bob',
  'flinch',
  'ko',
  'celebrate',
  'slump',
]);

export default function Mascot({ pose = 'idle', emote = null, size = 120, className = '', style }) {
  const src = POSE_SRC[pose] || POSE_SRC.idle;
  const emoteClass = emote && EMOTES.has(emote) ? ` emote-${emote}` : '';
  return (
    <div
      className={`mascot-container${className ? ` ${className}` : ''}`}
      style={{ '--mascot-size': `${size}px`, ...style }}
      aria-hidden="true"
    >
      {/* The emote class lives on its own layer so it never fights the pose
          enter-pop (on .mascot-img) or the idle bounce. One-shot emotes replay by
          the caller cycling the prop back to null between events (see CB accept /
          the room join-pop), so the class is removed and re-added. */}
      <div className={`mascot-emote${emoteClass}`}>
        <div className="mascot-bounce">
          <img key={pose} className="mascot-img" src={src} alt="" draggable="false" />
        </div>
      </div>
    </div>
  );
}
