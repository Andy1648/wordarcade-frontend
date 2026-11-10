// AvatarFrame.jsx — your hero's PORTRAIT in the square frame you wear (avatarFrame.js). Wear none and it renders its
// children untouched (the portrait as it always was). Wear one and it takes the portrait's slot (`className` = the
// portrait's own sizing class): the face becomes a rounded square in the frame's window and the frame sits on top, a
// little bigger than the slot (`grow`) so its props break the box.
// A frame with a KIT (frameKit.js, nov9) is built from layered painted parts: four bars, four corner caps, its own props.
// They clamp on when the frame appears (equip / try-on) and the props act again on hover: finite WAAPI transform/opacity
// one-shots, nothing at rest, none under reduced motion, none on a `still` tile. A frame without a kit yet draws its
// single painted ring as before. JACKPOT adds its payout (JackpotCoins.jsx).
import { useEffect, useRef, useState } from 'react';
import { AVATAR_WIN, KIT_CHANGE, avatarFrameSrc, wornAvatarFrame } from './avatarFrame.js';
import { frameKitOf, kitPieces, kitWindow, FRAME_ACTS } from './frameKit.js';
import { reduceMotion } from '../lib/reduceMotion';
import JackpotCoins from './JackpotCoins.jsx';
import './AvatarFrame.css';

const pct = (n) => `${Math.round(n * 100) / 100}%`;
const box = (p) => ({ left: pct(p.x), top: pct(p.y), width: pct(p.w), height: pct(p.h) });
// the bar is painted horizontal: a side bar turns its strip 90° inside its tall box (width / height swapped through %), and
// a flipped bar mirrors it so the painted outer edge faces out. The strip is never stretched (no image off its own ratio,
// e2e/shop-aspect): it holds enough copies of the bar AT ITS NATIVE RATIO (barAR) to cover the run, every other one
// mirrored so each join meets its own pixels, centred, the overhang cropped under the corner caps.
const barStrip = (q) => (q.rot
  ? { left: '50%', top: '50%', width: pct((q.h / q.w) * 100), height: pct((q.w / q.h) * 100), transform: `translate(-50%, -50%) rotate(90deg)${q.flipV ? ' scaleY(-1)' : ''}` }
  : { left: 0, top: 0, width: '100%', height: '100%', transform: q.flipV ? 'scaleY(-1)' : undefined });
function Bar({ q, kit }) {
  const run = q.rot ? q.h / q.w : q.w / q.h; // the strip's length over its thickness
  const n = Math.max(1, Math.ceil(run / kit.barAR));
  return (
    <span className="avf-bar" style={box(q)}>
      <span className="avf-bar-strip" style={barStrip(q)}>
        {Array.from({ length: n }, (_, k) => <img key={k} className={k % 2 ? 'is-fliph' : undefined} src={kit.bar} alt="" draggable="false" />)}
      </span>
    </span>
  );
}

function play(el, act, delay = 0) {
  const a = FRAME_ACTS[act];
  if (!el || !a || typeof el.animate !== 'function' || el.getAnimations().length) return;
  el.style.willChange = 'transform, opacity';
  const run = el.animate(a.frames, { duration: a.ms, delay, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' });
  const off = () => { el.style.willChange = ''; };
  run.finished.then(off, off);
}

function Kit({ id, kit, still }) {
  const root = useRef(null);
  useEffect(() => {
    const el = root.current;
    if (!el || still || reduceMotion()) return undefined;
    const corners = [...el.querySelectorAll('.avf-corner')];
    const props = [...el.querySelectorAll('.avf-prop')];
    corners.forEach((c, k) => play(c, 'clamp', k * 50));
    props.forEach((p, k) => play(p, p.dataset.act, 220 + k * 90));
    const host = el.parentElement;
    const again = () => props.forEach((p, k) => play(p, p.dataset.act, k * 90));
    host.addEventListener('pointerenter', again);
    return () => {
      host.removeEventListener('pointerenter', again);
      [...corners, ...props].forEach((n) => n.getAnimations().forEach((a) => a.cancel()));
    };
  }, [id, still]);
  const pieces = kitPieces(kit);
  return (
    <span className="avf-ring avf-kit" ref={root} aria-hidden="true">
      {kit.parts.filter((p) => p.z === 'under').map((p) => <Prop key={p.src} p={p} />)}
      {pieces.map((q, k) => (q.kind === 'bar'
        ? <Bar key={k} q={q} kit={kit} />
        : <img key={k} className={`avf-corner${q.flipH ? ' is-fliph' : ''}${q.flipV ? ' is-flipv' : ''}`} src={q.b ? kit.cornerB : kit.corner} style={box(q)} alt="" draggable="false" />))}
      {kit.parts.filter((p) => p.z !== 'under').map((p) => <Prop key={p.src} p={p} />)}
    </span>
  );
}

const Prop = ({ p }) => (
  <img className="avf-prop" data-act={p.act} src={p.src} alt="" draggable="false"
    style={{ left: pct(p.x), top: pct(p.y), width: pct(p.w), transformOrigin: p.o || '50% 50%' }} />
);

export default function AvatarFrame({ src, bg = '#2a1647', className = '', grow = 1.3, preview, still = false, children = null }) {
  const [worn, setFrame] = useState(wornAvatarFrame);
  // `preview` (CUSTOMIZE try-on) shows that frame instead of the worn one
  const frame = preview !== undefined ? (Object.prototype.hasOwnProperty.call(AVATAR_WIN, preview) ? preview : null) : worn;
  useEffect(() => {
    const on = () => setFrame(wornAvatarFrame());
    window.addEventListener(KIT_CHANGE, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(KIT_CHANGE, on); window.removeEventListener('storage', on); };
  }, []);
  if (!frame) return children;
  const kit = frameKitOf(frame);
  const [cx, cy, r] = kit ? kitWindow(kit) : AVATAR_WIN[frame];
  const off = ((1 - grow) / 2) * 100; // the ring box, centred on the slot
  const face = { left: pct(off + (cx - r) * grow), top: pct(off + (cy - r) * grow), width: pct(2 * r * grow), height: pct(2 * r * grow), background: bg };
  const ring = { left: pct(off), top: pct(off), width: pct(grow * 100), height: pct(grow * 100) };
  return (
    <span className={`avf ${className}`} data-avf={frame} data-kit={kit ? '1' : undefined} aria-hidden="true">
      <span className="avf-face" style={face}><img src={src} alt="" draggable="false" /></span>
      {kit
        ? <span className="avf-box" style={ring}><Kit key={frame} id={frame} kit={kit} still={still} /></span>
        : <img className="avf-ring" src={avatarFrameSrc(frame)} style={ring} width="256" height="256" alt="" draggable="false" />}
      {frame === 'jackpot' && !still ? <JackpotCoins box={ring} /> : null}
    </span>
  );
}
