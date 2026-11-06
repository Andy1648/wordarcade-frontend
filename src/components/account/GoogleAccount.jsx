// GoogleAccount.jsx — SIGN IN WITH GOOGLE (085, leaderboard/auth.js), the one button + the one account line every place
// shares (SETTINGS → ACCOUNT, PROFILE, the shop's GEMS tab).
//   GoogleButton     Google's own button (Google Identity Services draws it; the popup stays on this page). Its height is
//                    Google's ~40 px, the one target under the 44 px floor; it can't be changed
//   AccountLine      signed out: what signing in is for + the button · signed in: SIGNED IN · <email> + SIGN OUT
//                    (the email shows only here, on this player's own device — the server never stores it)
// Optional to play: nothing here blocks the game. The GEMS tab alone requires it (PaidGemsShelf).
import { useEffect, useRef, useState } from 'react';
import { authAvailable, readSession, renderGoogleButton, signOut, AUTH_CHANGE, AUTH_FAIL } from '../../leaderboard/auth.js';
import './GoogleAccount.css';

export function useAuthSession() {
  const [s, setS] = useState(readSession);
  useEffect(() => {
    const on = () => setS(readSession());
    window.addEventListener(AUTH_CHANGE, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(AUTH_CHANGE, on); window.removeEventListener('storage', on); };
  }, []);
  return s;
}

const NO_ANSWER_MS = 12000; // GIS can't say the popup was closed or a school blocked it: a click with no sign-in by then gets a hint
const NO_ANSWER_LINE = 'NOT WORKING? SCHOOL ACCOUNTS ARE OFTEN BLOCKED · TRY A PERSONAL ONE';
const FAIL_LINE = {
  nonce: 'SIGN-IN FAILED A SAFETY CHECK · TRY AGAIN',
  refused: 'GOOGLE SIGN-IN DIDN\u2019T FINISH · TRY AGAIN',
  offline: 'CAN\u2019T REACH THE SERVER · TRY AGAIN',
};

/** Google's own button (its iframe, its look: it can't be restyled). The library loads when this first shows, never on the
 *  menu. If it can't load (a school filter, offline), a clear line + RETRY instead of a dead button. */
export function GoogleButton({ className = '' }) {
  const slot = useRef(null);
  const noAnswer = useRef(0);
  const [phase, setPhase] = useState('loading'); // loading | ready | blocked
  const [note, setNote] = useState(null);
  const [tries, setTries] = useState(0); // a retry, or a failed attempt's re-arm
  const on = authAvailable();
  useEffect(() => {
    if (!on) return undefined;
    let live = true;
    setPhase('loading');
    const el = slot.current;
    const onClick = () => { // the signed-in state unmounts this, which clears the timer: it only fires on no answer
      setNote(null);
      clearTimeout(noAnswer.current);
      noAnswer.current = setTimeout(() => setNote(NO_ANSWER_LINE), NO_ANSWER_MS);
    };
    // the slot is hidden while blocked (RETRY), so measure the wrap around it
    renderGoogleButton(el, el && el.parentElement ? el.parentElement.clientWidth : 0, onClick).then(() => { if (live) setPhase('ready'); }, () => { if (live) setPhase('blocked'); });
    return () => { live = false; };
  }, [on, tries]);
  useEffect(() => {
    const onFail = (e) => { clearTimeout(noAnswer.current); setNote(FAIL_LINE[e.detail && e.detail.reason] || FAIL_LINE.refused); setTries((n) => n + 1); };
    window.addEventListener(AUTH_FAIL, onFail);
    return () => { window.removeEventListener(AUTH_FAIL, onFail); clearTimeout(noAnswer.current); };
  }, []);
  if (!on) return null;
  return (
    <div className={`gsi-wrap ${className}`} data-testid="google-signin" data-phase={phase}>
      {/* always mounted: Google's button draws into it. The slot keeps the button's height while it loads, so nothing jumps */}
      <div ref={slot} className={`gsi-slot${phase === 'blocked' ? ' is-off' : ''}`} />
      {phase === 'loading' ? <span className="gsi-load">LOADING GOOGLE…</span> : null}
      {phase === 'blocked' ? (
        <div className="gsi-blocked" role="status" data-testid="google-blocked">
          <span className="gsi-blocked-t">GOOGLE IS BLOCKED HERE · SAVE CODE STILL WORKS</span>
          <button type="button" className="gsi-out" onClick={() => setTries((n) => n + 1)} data-testid="google-retry">RETRY</button>
        </div>
      ) : null}
      {note ? <span className="gsi-note" role="status" data-testid="google-note">{note}</span> : null}
    </div>
  );
}

/** `why` = the one line under the button while signed out (each place says what it is for there). */
export default function AccountLine({ why = 'KEEP YOUR PROGRESS ON EVERY DEVICE', className = '' }) {
  const s = useAuthSession();
  if (!authAvailable()) return null;
  if (!s) {
    return (
      <div className={`gsi-line ${className}`} data-testid="account-line" data-signed="no">
        <GoogleButton />
        <span className="gsi-why">{why}</span>
      </div>
    );
  }
  return (
    <div className={`gsi-line is-in ${className}`} data-testid="account-line" data-signed="yes">
      <span className="gsi-who">
        <img className="gsi-g" src="/brand/google-g.svg" width="20" height="20" alt="" aria-hidden="true" draggable="false" />
        <span className="gsi-k">SIGNED IN</span>
        {s.email ? <span className="gsi-mail">{s.email}</span> : null}
      </span>
      <button type="button" className="gsi-out" onClick={() => signOut()} data-testid="google-signout">SIGN OUT</button>
    </div>
  );
}
