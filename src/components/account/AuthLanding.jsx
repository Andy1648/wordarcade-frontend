// AuthLanding.jsx — back from Google (085): the menu mounts this (lazy) once, on a sign-in landing or while a restore
// waits on the player. It runs auth.finishSignIn and says what happened in ONE place:
//   linked     a short stamp — "SIGNED IN · SAVED TO YOUR GOOGLE ACCOUNT" (it leaves on its own)
//   no_name    "SIGNED IN · PICK A NAME TO SAVE YOUR PROGRESS" (claiming a name links it)
//   confirm    the account has another board row and this device has progress of its own: LOAD <NAME> (LV · R) replaces
//              this device's progress with the account's; NOT NOW signs out of Google here and changes nothing
//   restored   the page reloads into the account's progress
// A modal only while it needs an answer; the stamp is pointer-events:none. Motion: one finite pop in.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { finishSignIn, restoreAccount, declineRestore, pendingRestore } from '../../leaderboard/auth.js';
import { kitPlay } from '../kit/motion.js';
import { formatNum } from '../../format';
import './AuthLanding.css';

const POP = [{ transform: 'scale(.7)', opacity: 0 }, { transform: 'scale(1.06)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }];
const LINE = {
  linked: 'SIGNED IN · SAVED TO YOUR GOOGLE ACCOUNT',
  no_name: 'SIGNED IN · PICK A NAME TO SAVE YOUR PROGRESS',
  profile_taken: 'THIS NAME IS ALREADY ON ANOTHER GOOGLE ACCOUNT',
  error: 'COULD NOT SIGN IN · TRY AGAIN FROM SETTINGS',
};

export default function AuthLanding({ landing, onDone }) {
  const [st, setSt] = useState(() => {
    const who = pendingRestore();
    return who && !landing ? { state: 'confirm', who } : { state: 'busy' };
  });
  const boxRef = useRef(null);
  useEffect(() => {
    if (st.state !== 'busy') return undefined;
    let live = true;
    Promise.resolve(landing).then(() => finishSignIn()).then((r) => {
      if (!live) return;
      if (r.state === 'restored') { location.reload(); return; }
      setSt(r);
    });
    return () => { live = false; };
  }, [st.state, landing]);
  useEffect(() => { kitPlay(boxRef.current, POP, { duration: 280, easing: 'cubic-bezier(.3,1.5,.5,1)' }); }, [st.state]);
  // a stamp leaves on its own
  useEffect(() => {
    if (st.state === 'busy' || st.state === 'confirm') return undefined;
    const t = setTimeout(() => onDone && onDone(), 3200);
    return () => clearTimeout(t);
  }, [st.state, onDone]);

  if (typeof document === 'undefined' || st.state === 'busy') return null;
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
