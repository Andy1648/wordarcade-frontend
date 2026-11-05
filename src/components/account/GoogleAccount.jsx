// GoogleAccount.jsx — SIGN IN WITH GOOGLE (085, leaderboard/auth.js), the one button + the one account line every place
// shares (SETTINGS → ACCOUNT, PROFILE, the shop's GEMS tab).
//   GoogleButton     Google's own sign-in button look (white, the four-colour G from public/brand/google-g.svg, dark
//                    label) — the brand rules say not to restyle it, so it is the one control that is not house-styled
//   AccountLine      signed out: what signing in is for + the button · signed in: SIGNED IN · <email> + SIGN OUT
//                    (the email shows only here, on this player's own device — the server never stores it)
// Optional to play: nothing here blocks the game. The GEMS tab alone requires it (PaidGemsShelf).
import { useEffect, useState } from 'react';
import { authAvailable, readSession, signInWithGoogle, signOut, AUTH_CHANGE } from '../../leaderboard/auth.js';
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

export function GoogleButton({ label = 'SIGN IN WITH GOOGLE', className = '' }) {
  if (!authAvailable()) return null;
  return (
    <button type="button" className={`gsi-btn ${className}`} onClick={() => { signInWithGoogle(); }} data-testid="google-signin">
      <img className="gsi-g" src="/brand/google-g.svg" width="20" height="20" alt="" aria-hidden="true" draggable="false" />
      <span className="gsi-t">{label}</span>
    </button>
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
