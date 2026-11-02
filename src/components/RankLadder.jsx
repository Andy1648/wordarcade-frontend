// RankLadder.jsx — TITLES (Andy oct11: "a popup … where user can click ranks to see all ranks"; oct28: "titles still look
// shit … no personality … title screen is so cramped"). LAZY: the profile's title plate opens it.
//
// Two zones (claude research titles-research.md — a pinned live preview + a grouped grid; density from grouping, never
// from smaller tiles):
//   STAGE  your name with the title you're looking at, BIG, the size it shows on the board; its deadpan line; then NEXT
//          TITLE — what's left to reach it.
//   SHELF  the 16 titles grouped by their FORMAT (TAPE → STICKER → STEEL → BANNER → NEON → MARQUEE): each tile is the
//          painted plate + one line. Reached = tap to wear; the next two are dimmed; past that a silhouette.
// Hover / focus a tile: the STAGE shows it. Esc, the ✕ or a tap on the scrim closes it; the moments queue is held while up.
import { useEffect, useRef, useState } from 'react';
import { KitRankPlate } from './kit/KitRankPlate.jsx';
import { titleSections } from './kit/titleFormats.js';
import { RANKS_V3, liveRankV3 } from '../progress/v3/ranks.js';
import { s2Rebirths, getStarsV3 } from '../progress/v3/store.js';
import { useMomentHold } from '../lib/useMomentSlot';
import { getPlatePick, setPlatePick } from '../progress/platePick';
import { getMyProfile } from '../leaderboard/client.js';
import './RankLadder.css';
import { loadProgress, getRebirths, rebirthThreshold } from '../progress/xp.js';
import { formatNum } from '../format.js';

// RANK ROAD (Andy oct15 night): the joke lives in a deadpan line under a straight-faced plate. No emoji anywhere.
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
const myName = () => {
  try { const p = getMyProfile(); return (p && p.username) || 'YOU'; } catch { return 'YOU'; }
};

export default function RankLadder({ onClose }) {
  useMomentHold(true);
  const closeRef = useRef(null);
  const you = (() => {
    try { return RANKS_V3.indexOf(liveRankV3()); } catch { return 0; }
  })();
  const [pick, setPick] = useState(() => getPlatePick());
  const wearing = pick != null && pick <= you ? pick : you;
  const [look, setLook] = useState(null); // the tile being hovered / focused — the STAGE previews it
  const shown = look != null ? look : wearing;
  const next = RANKS_V3[you + 1] || null;
  const name = myName();
  const wear = (i) => {
    if (i > you) return;
    const v = i === you ? null : i; // the current title = no pick (it moves up with you)
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
  const sx = RANKS_V3[shown];
  const hidden = shown > you + 2;
  return (
    <div className="rl" role="dialog" aria-modal="true" aria-labelledby="rl-title" data-testid="rank-ladder" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rl-panel">
        <button type="button" className="rl-x" aria-label="Close" onClick={onClose} ref={closeRef}>✕</button>
        <section className="rl-stage" aria-live="polite">
          <h2 id="rl-title" className="rl-title">TITLES</h2>
          <div className={`rl-show${hidden ? ' is-hidden' : ''}${shown > you ? ' is-locked' : ''}`} key={shown}>
            <span className="rl-show-name">{name}</span>
            <KitRankPlate rank={sx.req} fit className="rl-show-plate" />
            <span className="rl-show-quip">{hidden ? '…climb to find out.' : QUIP[sx.name]}</span>
            <span className="rl-show-tag">{shown === wearing ? 'WEARING' : shown > you ? `LOCKED · ${how(sx)}` : 'TAP TO WEAR'}</span>
          </div>
          {next ? (
            <div className="rl-next" data-testid="rank-next">
              <span className="rl-next-k">NEXT TITLE</span>
              <KitRankPlate rank={next.req} fit shine={false} className="rl-next-plate" />
              <span className="rl-next-go">{togo(next)}</span>
              {next.s == null && <span className="rl-next-lv">{gateLine()}</span>}
            </div>
          ) : (
            <div className="rl-next is-max"><span className="rl-next-k">EVERY TITLE · YOU WIN</span></div>
          )}
        </section>
        <div className="rl-shelf" onMouseLeave={() => setLook(null)}>
          {titleSections().map((sec) => (
            <section key={sec.f} className={`rl-sec rl-sec--${sec.f}`}>
              <h3 className="rl-sec-k">{sec.label}</h3>
              <ol className="rl-list">
                {sec.titles.map((t) => {
                  const i = t.i;
                  const x = RANKS_V3[i];
                  return (
                    <li
                      key={x.req}
                      className={`rl-item${i === you ? ' is-you' : ''}${i > you ? ' is-locked' : ''}${i === you + 1 ? ' is-next' : ''}${i > you + 2 ? ' is-hidden' : ''}${i === wearing ? ' is-wearing' : ''}`}
                      tabIndex={0}
                      style={{ '--rl-d': `${Math.min(i, 12) * 25}ms` }}
                      data-rank={x.req}
                      role={i <= you ? 'button' : undefined}
                      aria-pressed={i <= you ? i === wearing : undefined}
                      aria-label={i <= you ? `${x.name} — ${i === wearing ? 'wearing' : 'tap to wear'}` : i > you + 2 ? 'Hidden title' : `${x.name} — ${how(x)}`}
                      onMouseEnter={() => setLook(i)}
                      onFocus={() => setLook(i)}
                      onBlur={() => setLook(null)}
                      onClick={() => wear(i)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wear(i); } }}
                    >
                      <span className="rl-plate"><KitRankPlate rank={x.req} fit shine={false} label={i > you + 2 ? '???' : undefined} /></span>
                      <span className="rl-how">{i === wearing ? 'WEARING' : i === you ? 'YOURS' : how(x)}</span>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
