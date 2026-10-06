// RankUpMoment — STEP 47: "#12 → #7" on the first menu visit after a claimed player's board rank
// improves (Duolingo-league style: the CHANGE is the reward). One finite card over the menu. H5: it is
// mounted only when its turn comes on the ONE moments queue (Homepage announces it at PRIORITY.LEVEL), so
// it plays at once — the old 1.6 s RANKUP_DELAY_MS guess at the level-up card's length is gone.
//
// It never blocks the menu: the card is pointer-events:none (a tap meant for a mode card goes to the
// mode card), and the news doesn't depend on catching it — the trophy keeps a dot until the board is
// opened, and the board shows the rank. Announced to screen readers via a status line. Static card
// for the same duration under reduced motion.
//
// kind="passed" (extensions-spec a, dormant behind flagOn('rival')): the SAME card names who passed you —
// "XAVI PASSED YOU" / "#5 → #6" / "2 LV BEHIND" (or "1 RB BEHIND": the board ranks rebirths first). It is the one tappable variant: tapping it opens the
// board (the way to win the spot back), so only that card takes pointer events, never the layer.
import { useEffect, useRef, useState } from 'react';
import { myStats } from './client.js';
import { formatNum } from '../format';
import { standingText } from './boardTarget.js';
import PodiumIcon from '../components/PodiumIcon';
import { RANKUP_MS } from '../lib/menuMoments.js';
import { rivalCopy, rivalGapLine, rivalGapSpoken } from './rival.js';
import { SEASON2, V3 } from '../progress/season.js'; // P7: V3.rankUp = the kit's top-edge RANK-UP banner (v3 chunk)
import './RankUpMoment.css';

export { RANKUP_MS };
// the "#to" pops at 30-40% of the card (lb-rankup-pop): the menu's podium bounces + ticks on the same beat
export const RANKUP_POP_MS = Math.round(RANKUP_MS * 0.36);

export default function RankUpMoment({ from, to, onDone, onPop, kind = 'up', name = '', levels = 0, rebirths = 0, onTap }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const sentRef = useRef(false);
  const popRef = useRef(onPop);
  popRef.current = onPop;
  // Andy oct3 19:55: the board ranks REBIRTHS, then LEVEL — the moment names both ("R8 · LV16").
  const [standing] = useState(() => { const s = myStats(); return standingText(s.rebirths, s.level); });
  // a live region announces a CHANGE, so the status line fills a beat after the region mounts
  const [said, setSaid] = useState(false);
  useEffect(() => {
    // P7 POPUP PURGE (SEASON2 only): no card over the menu — the board news drops from the TOP edge (the RANK-UP
    // banner; it pays nothing), the podium ticks at once and the queue is released. Flag OFF: the card below, unchanged.
    if (SEASON2) {
      if (sentRef.current) return undefined; // once per mount (StrictMode re-runs effects in dev)
      sentRef.current = true;
      if (kind === 'passed') {
        V3.rankUp({ head: rivalCopy({ name, from, to, levels, rebirths }).title, from: { name: `#${formatNum(from)}`, req: 'R6' }, to: { name: `#${formatNum(to)}`, req: 'R0' } });
      } else {
        V3.rankUp({ head: 'BOARD', from: { name: `#${formatNum(from)}`, req: 'R0' }, to: { name: `#${formatNum(to)}`, req: 'R7', code: standing } });
      }
      if (popRef.current) popRef.current();
      if (doneRef.current) doneRef.current();
      return undefined;
    }
    const a = setTimeout(() => setSaid(true), 60);
    const b = setTimeout(() => doneRef.current && doneRef.current(), RANKUP_MS);
    const c = setTimeout(() => popRef.current && popRef.current(), RANKUP_POP_MS);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one moment per mount: its props are fixed for its life
  }, []);
  if (SEASON2) return null;
  if (kind === 'passed') {
    const copy = rivalCopy({ name, from, to, levels, rebirths });
    const gap = rivalGapLine(levels, rebirths);
    return (
      <div className="lb-rankup-layer">
        <p className="lb-rankup-sr" role="status">{said ? `${copy.title}. Number ${formatNum(from)} to number ${formatNum(to)}. ${rivalGapSpoken(levels, rebirths)}.` : ''}</p>
        <button type="button" className="lb-rankup is-passed" aria-label={`${copy.title} — open leaderboard`} onClick={() => onTap && onTap()}>
          <PodiumIcon size={64} className="lb-rankup-podium" />
          <span className="lb-rankup-kicker">{copy.title}</span>
          <span className="lb-rankup-line" aria-hidden="true">
            <span className="lb-rankup-from">#{formatNum(from)}</span>
            <span className="lb-rankup-arrow">→</span>
            <span className="lb-rankup-to">#{formatNum(to)}</span>
          </span>
          <span className="lb-rankup-sub">{gap}</span>
        </button>
      </div>
    );
  }
  return (
    <div className="lb-rankup-layer">
      <p className="lb-rankup-sr" role="status">{said ? `Leaderboard rank up: from number ${from} to number ${to}.` : ''}</p>
      <div className="lb-rankup" aria-hidden="true">
        {/* the same podium glyph as the menu's golden button — one symbol for the leaderboard. It wears the
            STAR here, not the rank: "#to" is already the line right under it */}
        <PodiumIcon size={64} className="lb-rankup-podium" />
        <span className="lb-rankup-kicker">RANK UP</span>
        <span className="lb-rankup-line">
          <span className="lb-rankup-from">#{formatNum(from)}</span>
          <span className="lb-rankup-arrow">→</span>
          <span className="lb-rankup-to">#{formatNum(to)}</span>
        </span>
        {/* CLUTTER PASS: no "· ON THE LEADERBOARD" — the podium glyph above is the leaderboard */}
        <span className="lb-rankup-sub">{standing}</span>
      </div>
    </div>
  );
}
