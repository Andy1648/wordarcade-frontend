// UnlistedStamp.jsx — THE REVEAL: the word you typed, the UNLISTED ink stamp slamming down on it, then the gear and
// its serial ("#0042") landing beside it. It plays in the game screen's ONE reaction slot (`.wb-react`, the anchored
// row above the field — CLAUDE.md: no orphan fixed UI), where the word landing would otherwise be, and takes that slot
// for its life (GameScreen hides the landing while it plays).
//
// ONE-SHOT: it mounts on a reveal, plays ~3.4 s of transform/opacity keyframes, and unmounts. Nothing loops; there is
// no pool because it fires at most once per gear, ever. Reduced motion: the same frames, no slam (an opacity fade).
// The sting is Web Audio synthesis (juice/audio.unlistedSting), silent when muted. LAZY: GameScreen loads this only when a
// reveal fires (the hook that listens, useUnlistedReveal.js, is the only part in the game chunk).
import { useEffect } from 'react';
import { unlistedArt, formatSerial } from './unlisted.js';
import { unlistedSting } from '../juice/audio.js';
import './UnlistedStamp.css';

/** @param {{ rv: object|null, reduced?: boolean }} p — `rv` from useUnlistedReveal (the caller owns the one subscription). */
export default function UnlistedStamp({ rv, reduced = false }) {
  const key = rv ? rv.key : 0;
  useEffect(() => {
    if (key) { try { unlistedSting(); } catch { /* audio best-effort */ } }
  }, [key]);
  if (!rv || !rv.gear) return null;
  const word = String(rv.word || rv.gear.name || '').toUpperCase();
  return (
    <div key={rv.key} className={`uls${reduced ? ' is-reduced' : ''}`} data-testid="unlisted-stamp" data-gear={rv.gear.id} aria-live="polite">
      <span className="uls-word">
        <span className="uls-word-text">{word}</span>
        <img className="uls-ink" src="/fx/unlisted-stamp.webp" alt="UNLISTED" width="560" height="268" />
      </span>
      <span className="uls-gear">
        <img className="uls-art" src={unlistedArt(rv.gear)} alt="" width="256" height="256" />
        <span className="uls-plate">
          <span className="uls-name">{rv.gear.name}</span>
          <span className="uls-serial">{formatSerial(rv.serial)}</span>
        </span>
      </span>
    </div>
  );
}
