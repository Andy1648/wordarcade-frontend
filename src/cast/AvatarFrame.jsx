// AvatarFrame.jsx — your hero's PORTRAIT in the square frame you wear (avatarFrame.js). Wear none and it renders its
// children untouched (the portrait as it always was). Wear one and it takes the portrait's slot (`className` = the
// portrait's own sizing class): the face becomes a rounded square in the frame's window and the painted frame sits on
// top, a little bigger than the slot (`grow`) so its crystals / flames / brackets break the box.
// The frames stay still, each its own idea; JACKPOT alone adds a payout (JackpotCoins.jsx).
import { useEffect, useRef, useState } from 'react';
import { AVATAR_WIN, KIT_CHANGE, avatarFrameSrc, wornAvatarFrame } from './avatarFrame.js';
import JackpotCoins from './JackpotCoins.jsx';
import { badgeFrameOf, playAct, registerBadgeIdle } from './badgeFrames.js';
import { reduceMotion } from '../lib/reduceMotion';
import './AvatarFrame.css';

const pct = (n) => `${Math.round(n * 100) / 100}%`;

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
  const badge = badgeFrameOf(frame);
  if (badge) return <BadgeFrame key={frame} frame={frame} badge={badge} src={src} className={className} still={still} />;
  const [cx, cy, r] = AVATAR_WIN[frame];
  const off = ((1 - grow) / 2) * 100; // the ring box, centred on the slot
  const face = { left: pct(off + (cx - r) * grow), top: pct(off + (cy - r) * grow), width: pct(2 * r * grow), height: pct(2 * r * grow), background: bg };
  const ring = { left: pct(off), top: pct(off), width: pct(grow * 100), height: pct(grow * 100) };
  return (
    <span className={`avf ${className}`} data-avf={frame} aria-hidden="true">
      <span className="avf-face" style={face}><img src={src} alt="" draggable="false" /></span>
      <img className="avf-ring" src={avatarFrameSrc(frame)} style={ring} width="256" height="256" alt="" draggable="false" />
      {frame === 'jackpot' ? <JackpotCoins box={ring} /> : null}
    </span>
  );
}

// THE STICKER-BADGE FRAME (badgeFrames.js, nov21): the painted badge, the WHOLE hero standing on it (no square crop), and
// the frame's own painted props. It LANDS when it appears (equip / try-on), the props act + the hero hops on hover / tap,
// and the shared idle scheduler gives it a burst every few seconds while on screen. Finite one-shots only; a `still`
// host (picker tiles) and reduced motion get the resting pose.
function BadgeFrame({ frame, badge, src, className, still }) {
  const root = useRef(null);
  const badgeRef = useRef(null);
  const heroRef = useRef(null);
  const propRefs = useRef([]);
  useEffect(() => {
    const el = root.current;
    if (!el || still || reduceMotion()) return undefined;
    const burst = (lead = 0) => {
      playAct(heroRef.current, 'hop', lead);
      playAct(badgeRef.current, 'wobble', lead + 40);
      badge.props.forEach((p, i) => playAct(propRefs.current[i], p.act, lead + 90 + i * 110));
    };
    playAct(badgeRef.current, 'land');
    burst(260);
    const host = el.closest('button, [role="button"], a') || el;
    const onEnter = () => burst();
    host.addEventListener('pointerenter', onEnter);
    const off = registerBadgeIdle(el, () => burst());
    return () => { host.removeEventListener('pointerenter', onEnter); off(); };
  }, [frame, still, badge]);
  return (
    <span className={`avf avf-b ${className}`} data-avf={frame} data-badge="1" ref={root} aria-hidden="true">
      <img className="avf-b-badge" ref={badgeRef} src={badge.badge} alt="" draggable="false" />
      <img className="avf-b-hero" ref={heroRef} src={src} alt="" draggable="false" />
      {badge.props.map((p, i) => (
        <span key={i} className="avf-b-prop" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%` }}>
          <img ref={(n) => { propRefs.current[i] = n; }} src={p.src} alt="" draggable="false" style={p.flip ? { scale: '-1 1' } : undefined} />
        </span>
      ))}
      {frame === 'jackpot' && !still ? <JackpotCoins box={{ left: '0%', top: '0%', width: '100%', height: '100%' }} /> : null}
    </span>
  );
}
