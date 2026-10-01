// ClaimPrompt — STEP 47 (A13): the end-screen nudge onto the leaderboard.
//
// "YOU'D BE #N — CLAIM YOUR NAME", shown after a run ONLY when: the board is on, this browser has
// no name, it has banked at least one word (lifetime), my stats would actually land on the top 100, and it
// has not been shown this session. One tap opens an inline name field (same client filter + server
// verdict as the board); a claim lands without leaving the end screen. Dismissible; never shown
// twice per session; a failed board read shows nothing (no errors on an end screen).
//
// Mounted next to TryModeRow on every end screen. Renders nothing until the rank is known.
// STEP 47 compared three looks (claude/step47/shots/{strip,stamp,ticket}-*): the STAMP shipped — a
// tilted yellow sticker whose big pink "#N" makes the place itself the hook, and which reads as a
// reward rather than more end-screen chrome (the strip blended in; the purple ticket fought the card).
import { useEffect, useRef, useState } from 'react';
import {
  LEADERBOARD_ENABLED,
  claimName,
  claimPromptSeen,
  fetchMyRank,
  getMyProfile,
  markClaimPromptSeen,
  myStats,
  nameStatus,
  rankIfClaimed,
} from './client.js';
import { nameVerdict } from './nameFilter.js';
import './ClaimPrompt.css';


const VERDICT_COPY = {
  shape: '3–16 LETTERS, NUMBERS OR _',
  blocked: 'NOT THAT ONE. PICK ANOTHER NAME.',
  taken: 'TAKEN. TRY ANOTHER.',
  ok: 'FREE. CLAIM IT.',
  checking: 'CHECKING…',
};
const ERROR_COPY = {
  username_taken: 'SOMEONE JUST TOOK THAT ONE.',
  username_blocked: 'NOT THAT ONE. PICK ANOTHER NAME.',
  username_shape: '3–16 LETTERS, NUMBERS OR _',
  rate_limited: 'TOO MANY NEW NAMES FROM HERE. TRY LATER.',
  unavailable: 'THE BOARD IS OFFLINE RIGHT NOW.',
};

export default function ClaimPrompt() {
  const [rank, setRank] = useState(null);
  const [phase, setPhase] = useState('hidden'); // hidden | offer | form | done | dismissed
  const [draft, setDraft] = useState('');
  const [verdict, setVerdict] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [claimedRank, setClaimedRank] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    // A player who has never banked a word has nothing to put on a board yet.
    if (!LEADERBOARD_ENABLED || getMyProfile() || claimPromptSeen() || myStats().lifetimeWords < 1) return undefined;
    let live = true;
    rankIfClaimed().then((r) => {
      if (!live || !r) return;
      markClaimPromptSeen(); // shown = spent for this session, whether or not they act on it
      setRank(r);
      setPhase('offer');
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (phase === 'form' && inputRef.current) inputRef.current.focus();
  }, [phase]);

  useEffect(() => {
    if (!draft) { setVerdict(null); return undefined; }
    const local = nameVerdict(draft);
    if (local !== 'ok') { setVerdict(local); return undefined; }
    setVerdict('checking');
    let live = true;
    const t = setTimeout(() => {
      nameStatus(draft).then((v) => { if (live) setVerdict(v); }).catch(() => { if (live) setVerdict('ok'); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [draft]);

  async function claim(e) {
    e.preventDefault();
    if (busy || verdict !== 'ok') return;
    setBusy(true);
    setError(null);
    try {
      await claimName(draft);
      setClaimedRank((await fetchMyRank()) || rank);
      setPhase('done');
    } catch (err) {
      setError(ERROR_COPY[err.code] || 'COULDN’T SAVE THAT. TRY AGAIN.');
      if (err.code === 'username_taken') setVerdict('taken');
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'hidden' || phase === 'dismissed') return null;

  return (
    <section className={`lb-cp is-${phase}`} aria-label="Claim your leaderboard name">
      {phase === 'offer' && (
        <>
          <span className="lb-cp-rank" aria-hidden="true">#{rank}</span>
          <span className="lb-cp-copy">
            <span className="lb-cp-kicker">YOU’D BE #{rank} ON THE BOARD</span>
          </span>
          <button type="button" className="lb-cp-go" onClick={() => setPhase('form')}>CLAIM YOUR NAME</button>
          <button type="button" className="lb-cp-x" onClick={() => setPhase('dismissed')} aria-label="Dismiss">✕</button>
        </>
      )}
      {phase === 'form' && (
        <form className="lb-cp-form" onSubmit={claim} noValidate>
          <span className="lb-cp-rank" aria-hidden="true">#{rank}</span>
          <label className="lb-cp-label" htmlFor="lb-cp-input">YOUR NAME — NO SIGN-IN</label>
          <div className="lb-cp-row">
            <input
              id="lb-cp-input"
              ref={inputRef}
              className="lb-cp-input"
              value={draft}
              onChange={(e) => { setDraft(e.target.value.replace(/\s/g, '_').slice(0, 16)); setError(null); }}
              maxLength={16}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              enterKeyHint="done"
              placeholder="YOUR_NAME"
              aria-describedby="lb-cp-verdict"
            />
            <button type="submit" className="lb-cp-go" disabled={busy || verdict !== 'ok'}>{busy ? '…' : 'CLAIM'}</button>
          </div>
          <p id="lb-cp-verdict" className={`lb-cp-verdict is-${error ? 'blocked' : verdict || 'idle'}`} aria-live="polite">
            {error || (verdict ? VERDICT_COPY[verdict] : '3–16 LETTERS, NUMBERS OR _')}
          </p>
          <button type="button" className="lb-cp-x" onClick={() => setPhase('dismissed')} aria-label="Dismiss">✕</button>
        </form>
      )}
      {phase === 'done' && (
        <p className="lb-cp-done" role="status">
          <span className="lb-cp-rank" aria-hidden="true">#{claimedRank}</span>
          YOU’RE ON THE BOARD. SEE IT FROM THE MENU 🏆
        </p>
      )}
    </section>
  );
}
