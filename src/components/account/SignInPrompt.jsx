// SignInPrompt.jsx — SAVE YOUR PROGRESS, asked where it matters (nov21, Andy: "give more spaces to sign in with google …
// make things more user friendly"). Two shapes over ONE frequency cap (signInNudge.js):
//   SignInPrompt  an inline row IN a screen's own layout (the leaderboard, the profile): a headline, the why, Google's own
//                 button and NOT NOW. No fixed position, never a dialog — it never blocks play.
//   SignInSheet   the same, as a small modal, for a TAP from a one-off moment (the results parade's last row, the save-code
//                 card): Google's button is its own iframe and can only be clicked where it is drawn, so a moment opens this.
// Both: hidden while Google sign-in is off (authAvailable), once signed in (useAuthSession), and for a guest with no board
// name (signing in links a NAME: "claim a name" comes first). NOT NOW snoozes that place a week (the third no retires it).
// Motion: one finite pop on the sheet; the row has none. Nothing loops.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { authAvailable } from '../../leaderboard/auth.js';
import { getMyProfile } from '../../leaderboard/client.js';
import { GoogleButton, useAuthSession } from './GoogleAccount.jsx';
import { mayAsk, sayNo, markShown } from './signInNudge.js';
import { kitPlay } from '../kit/motion.js';
import './SignInPrompt.css';

/** May a guest be asked at `place` right now? (Google on · not signed in · has a board name · the cap allows.) */
export function guestAsk(place, session) {
  if (session || !authAvailable()) return false;
  let me = null;
  try { me = getMyProfile(); } catch { me = null; }
  return !!me && mayAsk(place);
}

/** The inline row. `title` = the headline (SAVE YOUR RANK …), `why` = one line under it. */
export default function SignInPrompt({ place, title = 'SAVE YOUR PROGRESS', why = 'SIGN IN ONCE · PLAY AS YOU ON ANY DEVICE', className = '' }) {
  const s = useAuthSession();
  const [open, setOpen] = useState(() => guestAsk(place, s));
  if (!open || s) return null;
  const no = () => { sayNo(place); setOpen(false); };
  return (
    <div className={`sip ${className}`} data-testid={`signin-${place}`} role="region" aria-label={title}>
      <span className="sip-text">
        <span className="sip-h"><img className="sip-g" src="/brand/google-g.svg" width="18" height="18" alt="" aria-hidden="true" draggable="false" />{title}</span>
        <span className="sip-why">{why}</span>
      </span>
      <span className="sip-acts">
        <GoogleButton className="sip-btn" />
        <button type="button" className="sip-no" onClick={no} data-testid={`signin-${place}-no`}>NOT NOW</button>
      </span>
    </div>
  );
}

const POP = [{ transform: 'scale(.85)', opacity: 0 }, { transform: 'scale(1.03)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }];

/** The modal for a tap from a moment. Closes itself once signed in (the landing dialog takes over from there). */
export function SignInSheet({ place, title = 'SAVE YOUR PROGRESS', why = 'SIGN IN ONCE · PLAY AS YOU ON ANY DEVICE', onClose }) {
  const s = useAuthSession();
  const box = useRef(null);
  useEffect(() => { kitPlay(box.current, POP, { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' }); }, []);
  useEffect(() => { if (s && onClose) onClose(); }, [s, onClose]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose && onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  if (typeof document === 'undefined' || !authAvailable()) return null;
  const no = () => { sayNo(place); onClose && onClose(); };
  return createPortal(
    <div className="sis-scrim" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div ref={box} className="sis" role="dialog" aria-modal="true" aria-label={title} data-testid="signin-sheet">
        <h2 className="sis-h">{title}</h2>
        <p className="sis-why">{why}</p>
        <GoogleButton className="sis-btn" />
        <p className="sis-fine">FREE · YOUR EMAIL IS NEVER SHOWN · YOUR SAVE CODE STILL WORKS</p>
        <button type="button" className="sip-no sis-no" onClick={no} data-testid="signin-sheet-no">NOT NOW</button>
      </div>
    </div>,
    document.body,
  );
}

/** A moment's caller: note the showing once (starts its gap) — call when the moment actually shows the ask. */
export const noteMoment = (place) => markShown(place);
