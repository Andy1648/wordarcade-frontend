// ClaimPrompt — STEP 47 (A13): the end-screen nudge onto the leaderboard.
//
// "YOU'D BE #N ON THE BOARD — CLAIM YOUR NAME", shown after a run ONLY when: the board is on, this
// browser has no name, it has banked at least one word (lifetime — the board ranks lifetime stats, so
// a 0-word run by a player with history still has a place to claim), those stats would land on the
// top 10 (or anywhere below it — the rank is counted on the server), and it hasn't been SEEN this session (or dismissed 3× in a week). One tap opens an inline
// name field (same client filter + server verdict as the board); a claim lands without leaving the
// end screen. A failed board read shows nothing — never an error on an end screen.
//
// "Seen" means ON SCREEN (IntersectionObserver), not rendered: on a short laptop the end card scrolls
// and the prompt can sit below the fold, and a prompt nobody saw must not spend the session's one shot.
// The rank comes from the session's single board read (client.js caches it).
//
// Mounted just above TryModeRow on every end screen.
// STEP 47 compared three looks (claude/step47/shots/{strip,stamp,ticket}-*): the STAMP shipped — a
// tilted yellow sticker whose big pink "#N" makes the place itself the hook, and which reads as a
// reward rather than more end-screen chrome (the strip blended in; the purple ticket fought the card).
import { useEffect, useRef, useState } from 'react';
import { standingText } from './boardTarget.js';
import { formatNum } from '../format';
import {
  LEADERBOARD_ENABLED,
  claimName,
  claimPromptAllowed,
  fetchMyRank,
  getMyProfile,
  markClaimPromptSeen,
  myStats,
  nameStatus,
  noteClaimPromptDismissed,
  rankIfClaimed,
} from './client.js';
import { nameVerdict } from './nameFilter.js';
import PodiumIcon from '../components/PodiumIcon';
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
  rate_limited: 'THE BOARD IS BUSY FROM THIS NETWORK. TRY IN AN HOUR.',
  rename_cooldown: 'ONE NAME CHANGE PER DAY. TRY TOMORROW.',
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
  const boxRef = useRef(null);

  useEffect(() => {
    if (!LEADERBOARD_ENABLED || getMyProfile() || !claimPromptAllowed() || myStats().lifetimeWords < 1) return undefined;
    let live = true;
    rankIfClaimed().then((r) => {
      if (!live || !r) return;
      setRank(r);
      setPhase('offer');
    });
    return () => { live = false; };
  }, []);

  // Spend the session's one shot only once the prompt has actually been on screen.
  useEffect(() => {
    if (phase !== 'offer' || !boxRef.current) return undefined;
    if (typeof IntersectionObserver === 'undefined') { markClaimPromptSeen(); return undefined; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { markClaimPromptSeen(); io.disconnect(); }
    }, { threshold: 0.6 });
    io.observe(boxRef.current);
    return () => io.disconnect();
  }, [phase]);

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

  function dismiss() {
    markClaimPromptSeen();
    noteClaimPromptDismissed();
    setPhase('dismissed');
  }

  async function claim(e) {
    e.preventDefault();
    if (busy || verdict !== 'ok') return;
    setBusy(true);
    setError(null);
    try {
      await claimName(draft);
      setClaimedRank(await fetchMyRank()); // the board's word for it, never the estimate
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
    <section ref={boxRef} className={`lb-cp is-${phase}`} aria-label="Claim your leaderboard name" role="status">
      {phase === 'offer' && (
        <>
          <span className="lb-cp-rank" aria-hidden="true">#{formatNum(rank)}</span>
          <span className="lb-cp-copy">
            {/* CLUTTER PASS: the big #rank beside it is the number — the kicker no longer repeats it */}
            <span className="lb-cp-kicker">YOU’D BE ON THE BOARD</span>
            {/* the board ranks REBIRTHS, then LEVEL (Andy oct3 19:55) — say the numbers that earn the place */}
            <span className="lb-cp-hint">{(({ rebirths, level }) => standingText(rebirths, level))(myStats())} · NO SIGN-IN. JUST A NAME.</span>
          </span>
          <button type="button" className="lb-cp-go" onClick={() => { markClaimPromptSeen(); setPhase('form'); }}>CLAIM YOUR NAME</button>
          <button type="button" className="lb-cp-x" onClick={dismiss} aria-label="Dismiss">✕</button>
        </>
      )}
      {phase === 'form' && (
        <form className="lb-cp-form" onSubmit={claim} noValidate>
          <span className="lb-cp-rank" aria-hidden="true">#{formatNum(rank)}</span>
          <label className="lb-cp-label" htmlFor="lb-cp-input">YOUR NAME ON THE BOARD</label>
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
          <button type="button" className="lb-cp-x" onClick={dismiss} aria-label="Dismiss">✕</button>
        </form>
      )}
      {phase === 'done' && (
        <>
          {claimedRank ? <span className="lb-cp-rank" aria-hidden="true">#{formatNum(claimedRank)}</span> : null}
          <p className="lb-cp-done">
            {claimedRank ? '' : 'YOU’RE ON THE BOARD. ' /* with a rank, the big #n beside it says it */}
            FIND IT UNDER <PodiumIcon size={26} className="lb-cp-trophy" /> ON THE MENU.
          </p>
          <button type="button" className="lb-cp-x" onClick={() => setPhase('dismissed')} aria-label="Close">✕</button>
        </>
      )}
    </section>
  );
}
