// AuthLanding.jsx — signed in with Google (085): mountLanding.jsx mounts this after the popup, and the menu (`resume`) while a
// restore still waits on the player. It runs auth.finishSignIn and says what happened in ONE place:
//   confirm_link   this device has a name and the account none yet: LINK <NAME> TO <email>? — LINK / NOT NOW (signs out).
//              Nothing links a board row without this (security review nov4, HIGH 2)
//   linked     a short stamp — "SIGNED IN · SAVED TO YOUR GOOGLE ACCOUNT" (it leaves on its own)
//   no_name    "SIGNED IN · PICK A NAME TO SAVE YOUR PROGRESS" (claiming a name links it)
//   confirm    the account has another board row and this device has progress of its own: LOAD <NAME> (LV · R) replaces
//              this device's progress with the account's; NOT NOW signs out of Google here and changes nothing
//   restored   the page reloads into the account's progress
// A modal only while it needs an answer; the stamp is pointer-events:none. Motion: one finite pop in.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { finishSignIn, restoreAccount, declineRestore, pendingRestore, linkThisDevice } from '../../leaderboard/auth.js';
import { kitPlay } from '../kit/motion.js';
import { formatNum } from '../../format';
import './AuthLanding.css';

const POP = [{ transform: 'scale(.7)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }];
const LINE = {
  linked: 'SIGNED IN · SAVED TO YOUR GOOGLE ACCOUNT',
  no_name: 'SIGNED IN · PICK A NAME TO SAVE YOUR PROGRESS',
  profile_taken: 'THIS NAME IS ALREADY ON ANOTHER GOOGLE ACCOUNT',
  account_taken: 'THIS GOOGLE ACCOUNT IS ALREADY ON ANOTHER NAME',
  relink_wait: 'UNLINKED RECENTLY · LINKING AGAIN OPENS IN 30 DAYS',
  google_only: 'ONLY A GOOGLE SIGN-IN CAN BE USED HERE',
  error: 'COULD NOT SIGN IN · TRY AGAIN FROM SETTINGS',
};

export default function AuthLanding({ resume = false, onDone }) {
  const [st, setSt] = useState(() => {
    const who = pendingRestore();
    return who && resume ? { state: 'confirm', who } : { state: 'busy' };
  });
  const boxRef = useRef(null);
  useEffect(() => {
    if (st.state !== 'busy') return undefined;
    let live = true;
    finishSignIn().then((r) => {
      if (!live) return;
      if (r.state === 'restored') { location.reload(); return; }
      setSt(r);
    });
    return () => { live = false; };
  }, [st.state]);
  useEffect(() => { kitPlay(boxRef.current, POP, { duration: 280, easing: 'cubic-bezier(.3,1.5,.5,1)' }); }, [st.state]);
  // a stamp leaves on its own
  useEffect(() => {
    if (st.state === 'busy' || st.state === 'confirm') return undefined;
    const t = setTimeout(() => onDone && onDone(), 3200);
    return () => clearTimeout(t);
  }, [st.state, onDone]);

  if (typeof document === 'undefined' || st.state === 'busy') return null;
  if (st.state === 'confirm_link') {
    const w = st.who || {};
    const link = async () => { setSt({ state: 'busy-restore' }); setSt(await linkThisDevice()); };
    const no = async () => { await declineRestore(); onDone && onDone(); };
    return createPortal(
      <div className="al-scrim" role="dialog" aria-modal="true" aria-label="Link this name to your Google account" data-testid="auth-confirm-link">
        <div ref={boxRef} className="al-box">
          <h2 className="al-h">LINK YOUR NAME?</h2>
          <p className="al-who"><b className="al-name">{w.username}</b>{w.email ? <> → {w.email}</> : null}</p>
          <p className="al-note is-calm">SIGN IN ON ANY DEVICE TO PLAY AS {w.username}</p>
          <div className="al-acts">
            <button type="button" className="al-btn is-go" onClick={link} data-testid="auth-link">LINK {w.username}</button>
            <button type="button" className="al-btn" onClick={no} data-testid="auth-link-not-now">NOT NOW</button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }
  if (st.state === 'confirm') {
    const w = st.who || {};
    const load = async () => {
      setSt({ state: 'busy-restore' });
      const r = await restoreAccount();
      if (r.state === 'restored') location.reload();
      else setSt({ state: 'error', reason: r.reason });
    };
    const no = async () => { await declineRestore(); onDone && onDone(); };
    return createPortal(
      <div className="al-scrim" role="dialog" aria-modal="true" aria-label="Load your Google account's progress" data-testid="auth-confirm">
        <div ref={boxRef} className="al-box">
          <h2 className="al-h">LOAD YOUR PROGRESS?</h2>
          <p className="al-who"><b className="al-name">{w.username}</b> · LV {formatNum(w.level || 1)} · R{formatNum(w.rebirths || 0)}</p>
          <p className="al-note">REPLACES THIS DEVICE'S PROGRESS</p>
          <div className="al-acts">
            <button type="button" className="al-btn is-go" onClick={load} data-testid="auth-load">LOAD {w.username}</button>
            <button type="button" className="al-btn" onClick={no} data-testid="auth-not-now">NOT NOW</button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }
  if (st.state === 'busy-restore') return null;
  const line = LINE[st.state] || LINE[st.reason] || LINE.error;
  return createPortal(
    <div ref={boxRef} className={`al-stamp is-${st.state === 'linked' || st.state === 'no_name' ? 'ok' : 'bad'}`} role="status" aria-live="polite" data-testid="auth-stamp">
      <img className="al-g" src="/brand/google-g.svg" width="22" height="22" alt="" aria-hidden="true" draggable="false" />
      {line}
    </div>,
    document.body,
  );
}
