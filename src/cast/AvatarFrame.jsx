// AvatarFrame.jsx — your hero's PORTRAIT in the round frame you wear (avatarFrame.js). Wear none and it renders its
// children untouched (the portrait as it always was). Wear one and it takes the portrait's slot (`className` = the
// portrait's own sizing class): the face becomes a circle in the frame's window and the painted ring sits on top,
// a little bigger than the slot (`grow`) so its crystals / flames / bolts break the box. Static: no motion of its own.
import { useEffect, useState } from 'react';
import { AVATAR_WIN, KIT_CHANGE, wornAvatarFrame } from './avatarFrame.js';
import './AvatarFrame.css';

const pct = (n) => `${Math.round(n * 100) / 100}%`;

export default function AvatarFrame({ src, bg = '#2a1647', className = '', grow = 1.3, preview, children = null }) {
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
  const [cx, cy, r] = AVATAR_WIN[frame];
  const off = ((1 - grow) / 2) * 100; // the ring box, centred on the slot
  const face = { left: pct(off + (cx - r) * grow), top: pct(off + (cy - r) * grow), width: pct(2 * r * grow), height: pct(2 * r * grow), background: bg };
  const ring = { left: pct(off), top: pct(off), width: pct(grow * 100), height: pct(grow * 100) };
  return (
    <span className={`avf ${className}`} data-frame={frame} aria-hidden="true">
      <span className="avf-face" style={face}><img src={src} alt="" draggable="false" /></span>
      <img className="avf-ring" src={`/cast/avatar/${frame}.webp`} style={ring} width="256" height="256" alt="" draggable="false" />
    </span>
  );
}
