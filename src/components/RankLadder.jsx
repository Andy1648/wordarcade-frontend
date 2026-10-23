// RankLadder.jsx — ALL RANKS (Andy oct11: "a popup … where user can click ranks to see all ranks"). LAZY: the menu's
// RANK plate opens it. The 16 v3 ranks as their real plates (KitRankPlate — the art the leaderboard wears), each with
// what earns it; yours wears YOU, the ones above it are dimmed. Hover / focus a plate: it pops + tilts (transform only).
// Esc, the ✕ or a tap on the scrim closes it; the menu moments queue is held while it is up.
// PICK A PLATE (Andy oct14 "remove rank plate [from settings] (people can choose from the rank menu)"): tap any rank
// you have REACHED to wear it next to your name (platePick); your current rank = the default. WEARING marks it.
import { useEffect, useRef, useState } from 'react';
import { KitRankPlate } from './kit/KitRankPlate.jsx';
import { RANKS_V3, liveRankV3 } from '../progress/v3/ranks.js';
import { s2Rebirths, getStarsV3 } from '../progress/v3/store.js';
import { useMomentHold } from '../lib/useMomentSlot';
import { getPlatePick, setPlatePick } from '../progress/platePick';
import './RankLadder.css';
import { loadProgress, getRebirths, rebirthThreshold } from '../progress/xp.js';
import { formatNum } from '../format.js';

// RANK ROAD (Andy oct15 night "make ranks more appeasing visually … coolness and addicting, funny"; research: the joke
// lives in a deadpan line under a straight-faced plate (TF2 strange ranks / Clash arenas), the NEXT rank is spotlit with
// a progress bar, and ranks past it are silhouettes — a tease, not a spoiler). No emoji anywhere.
const QUIP = {
  INKLING: 'Has located the keyboard.',
  TYPO: "Spellcheck's best customer.",
  CLACKER: 'The neighbours can hear you.',
  HOTKEY: 'Ctrl+C. Ctrl+V. Ctrl+Victory.',
  INKSTORM: 'Leaves letters everywhere.',
  WORDSMITH: 'Forges vowels by hand.',
  KEYFIEND: 'Asked for a second keyboard.',
  CAPSLOCK: 'PERMANENTLY YELLING.',
  OVERCLOCK: 'Fingers void the warranty.',
  GLYPHLORD: 'Owns all 26 letters.',
  LEXIBEAST: 'Eats dictionaries. Hardcover.',
  VOIDTYPER: 'Types into the void. It types back.',
  ASCENDANT: 'The spacebar has a halo now.',
  OMNIKEY: 'Every key. At once.',
  'FINAL BOSS': 'Other players get a health bar.',
  ENDGAME: 'There is nothing left to type.',
};
const togo = (x) => {
  if (x.s != null) { const n = Math.max(0, x.s - getStarsV3()); return `${n} ★ STAR${n === 1 ? '' : 'S'} TO GO`; }
  const n = Math.max(0, x.r - s2Rebirths());
  return `${n} REBIRTH${n === 1 ? '' : 'S'} TO GO`;
};
const gateLine = () => {
  try { return `LV ${formatNum(loadProgress().level)} / ${formatNum(rebirthThreshold(getRebirths()))} TO THE NEXT REBIRTH`; } catch { return ''; }
};
const how = (x) => (x.s != null ? `${x.s} ★ STAR${x.s === 1 ? '' : 'S'}` : x.r === 0 ? 'START' : `REBIRTH ${x.r}`);

export default function RankLadder({ onClose }) {
  useMomentHold(true);
  const closeRef = useRef(null);
  const you = (() => {
    try { return RANKS_V3.indexOf(liveRankV3()); } catch { return 0; }
  })();
  const [pick, setPick] = useState(() => getPlatePick());
  const wearing = pick != null && pick <= you ? pick : you;
  const next = RANKS_V3[you + 1] || null;
  const wear = (i) => {
    if (i > you) return;
    const v = i === you ? null : i; // the current rank = no pick (it moves up with you)
    setPlatePick(v);
    setPick(v);
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (!(e.target && e.target.closest && e.target.closest('.rl'))) e.stopImmediatePropagation(); // menu typing pauses
    };
    window.addEventListener('keydown', onKey, true);
    if (closeRef.current) closeRef.current.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="rl" role="dialog" aria-modal="true" aria-labelledby="rl-title" data-testid="rank-ladder" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rl-panel">
        <button type="button" className="rl-x" aria-label="Close" onClick={onClose} ref={closeRef}>✕</button>
        <h2 id="rl-title" className="rl-title">ALL TITLES</h2>
        <p className="rl-sub">REBIRTH TO CLIMB · TAP A TITLE YOU'VE REACHED TO WEAR IT</p>
        {next ? (
          <div className="rl-next" data-testid="rank-next">
            <span className="rl-next-k">NEXT TITLE</span>
            <span className="rl-next-plate"><KitRankPlate rank={next.req} w={210} shine /></span>
            <span className="rl-next-quip">{QUIP[next.name]}</span>
            <span className="rl-next-go">{togo(next)}</span>
            {next.s == null && <span className="rl-next-lv">{gateLine()}</span>}
          </div>
        ) : (
          <div className="rl-next is-max"><span className="rl-next-k">MAX RANK</span><span className="rl-next-quip">{QUIP.ENDGAME}</span></div>
        )}
        <ol className="rl-list">
          {RANKS_V3.map((x, i) => (
            <li
              key={x.req}
              className={`rl-item${i === you ? ' is-you' : ''}${i > you ? ' is-locked' : ''}${i === you + 1 ? ' is-next' : ''}${i > you + 2 ? ' is-hidden' : ''}${i === wearing ? ' is-wearing' : ''}`}
              tabIndex={0}
              style={{ '--rl-d': `${Math.min(i, 12) * 25}ms` }}
              data-rank={x.req}
              role={i <= you ? 'button' : undefined}
              aria-pressed={i <= you ? i === wearing : undefined}
              aria-label={i <= you ? `${x.name} — ${i === wearing ? 'wearing' : 'tap to wear'}` : undefined}
              onClick={() => wear(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wear(i); } }}
            >
              <span className="rl-plate"><KitRankPlate rank={x.req} w={150} shine={i === you} /></span>
              {i > you + 2 ? <span className="rl-mystery" aria-hidden="true">???</span> : null}
              <span className="rl-quip">{i > you + 2 ? '…climb to find out.' : QUIP[x.name]}</span>
              <span className="rl-how">{how(x)}</span>
              {i === wearing ? <span className="rl-you">WEARING</span> : i === you ? <span className="rl-you is-dim">YOU</span> : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
