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

// The five poses. Each ships as AVIF + WebP + PNG of the same 500x500 artwork; the
// <picture> below lets the browser take the smallest format it understands. The PNG is
// NOT legacy dead weight — it is the real fallback, and it is also what the consumers
// that cannot use <picture> still point at (the SVG <image> in GameScreen's bomb, the
// canvas share card in share/, LoadingScreen).
const POSES = ['idle', 'panic', 'celebrate', 'run', 'taunt'];

// Intrinsic size of every pose PNG. Emitted as width/height attributes so the browser
// can reserve the box before the image arrives (PageSpeed flagged their absence — an
// image with no intrinsic size contributes layout shift). CSS still sizes the rendered
// image by height with width:auto, so these only supply the aspect ratio.
const POSE_W = 500;
const POSE_H = 500;

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
  const name = POSES.includes(pose) ? pose : 'idle';
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
          {/* Re-keyed per pose so the enter-pop replays on every swap — the key sits on
              <picture> so the whole element (and the <img> inside it) remounts. */}
          <picture key={name} className="mascot-pic">
            <source srcSet={`/mascot-${name}.avif`} type="image/avif" />
            <source srcSet={`/mascot-${name}.webp`} type="image/webp" />
            <img
              className="mascot-img"
              src={`/mascot-${name}.png`}
              alt=""
              draggable="false"
              width={POSE_W}
              height={POSE_H}
            />
          </picture>
        </div>
      </div>
    </div>
  );
}
