// SaveCodeNudge.jsx — WRITE DOWN YOUR CODE (save-safety oct28; codeNudge.js says when). LAZY: S2Notify imports this
// only when it checks the menu's news, so neither the menu nor the game carries it.
//
// NO NEW FIXED UI: the card is one more toast in the existing RIGHT-edge stack (KitEdgeToastHost) — a STICKY one
// (it stays until COPY or ✕) and the only toast that takes a pointer. Not centred, not a dialog, pays nothing: the
// ONE-NOTICE rule's edge layer (installUi.jsx), like the achievement READY toasts. Motion: the stack's own slide-in.
// Also: SaveCodeChip — the PROFILE popup's SAVE CODE chip (same code, same COPY).
import { useEffect, useState } from 'react';
import { LEADERBOARD_ENABLED, getMyProfile, peekSecret, rpc } from '../leaderboard/client.js';
import { issueShortCode, formatShort, copyText } from './saveCode.js';
import { dueNudge, readSaid, writeSaid } from './codeNudge.js';
import { storedLevel } from '../progress/xp.js';
import { s2Rebirths } from '../progress/v3/store.js';
import './SaveCodeNudge.css';

/** This account's short code (formatted), or null — no board name, offline, 071 not run. Never throws. */
export async function myShortCode() {
  try {
    const me = LEADERBOARD_ENABLED ? getMyProfile() : null;
    const secret = me ? peekSecret() : null;
    if (!secret) return null;
    const r = await issueShortCode({ rpc, secret, profileId: me.id });
    return r.ok ? formatShort(r.code) : null;
  } catch {
    return null;
  }
}

function useCopy(code) {
  const [said, setSaid] = useState('');
  const copy = () => {
    if (!code) return Promise.resolve(false);
    return copyText(code).then((ok) => {
      setSaid(ok ? 'COPIED' : 'WRITE IT DOWN');
      return ok;
    }, () => {
      setSaid('WRITE IT DOWN');
      return false;
    });
  };
  return [said, copy];
}

/** The toast body (KitEdgeToast renders a payload's Body in the stack). */
export function SaveCodeCard({ t, close }) {
  const [said, copy] = useCopy(t.code);
  return (
    <div className="scn" data-testid="save-code-nudge">
      <span className="scn-head">WRITE DOWN YOUR CODE</span>
      <span className="scn-code" data-testid="save-code-nudge-code">{t.code}</span>
      <span className="scn-row">
        <button type="button" className="scn-copy" onClick={() => copy().then((ok) => { if (ok) setTimeout(close, 1200); })}>{said || 'COPY'}</button>
        <button type="button" className="scn-x" onClick={close} aria-label="Close">✕</button>
      </span>
    </div>
  );
}

let busy = false;
/** On each menu visit, after the arrival: a milestone passed since the last card → the card (with the code). */
export async function runCodeNudge(push, { state = null } = {}) {
  if (busy) return false;
  busy = true;
  try {
    const s = state || { level: storedLevel(), rebirths: s2Rebirths() };
    const due = dueNudge(s, readSaid());
    if (!due) return false;
    const code = await myShortCode();
    if (!code) return false; // no name yet / offline / 071 not run: said on a later visit
    writeSaid(due.mark);
    push({ Body: SaveCodeCard, sticky: true, step: 176, code, tile: '#2EFFE0' });
    return true;
  } catch {
    return false;
  } finally {
    busy = false;
  }
}

/** PROFILE → the SAVE CODE chip: the code fetched on open, COPY on the tap (inside the gesture). */
export default function SaveCodeChip() {
  const [code, setCode] = useState(null);
  const [said, copy] = useCopy(code);
  useEffect(() => {
    let live = true;
    myShortCode().then((c) => { if (live) setCode(c); });
    return () => { live = false; };
  }, []);
  if (!code) return null;
  return (
    <button type="button" className="scn-chip" onClick={copy} data-testid="profile-save-code" aria-label={`Save code ${code} — copy`}>
      <span className="scn-chip-k">{said || 'SAVE CODE'}</span>
      <span className="scn-chip-v">{code}</span>
    </button>
  );
}
