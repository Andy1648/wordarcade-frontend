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
import { enteredTier } from './nameTier.js';
import { leagueOf, leagueMove } from './leagues.js';
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
      // nov3 RANK LEAGUES: the slab shows the league you are in now (its painted badge); crossing UP a league line is the
      // PROMOTION (the badge slams + its shards burst — KitRankBanner), crossing down is said quietly (no slam, no shards)
      const lg = leagueOf(to);
      const mv = leagueMove(from, to);
      const league = lg ? lg.key : undefined;
      const fromTo = { from: { name: `#${formatNum(from)}`, req: 'R0' }, to: { name: `#${formatNum(to)}`, req: 'R7' } };
      // a LEAGUE crossing goes through the one notice door that is open (V3.leagueNews); everything else stays V3.rankUp
      // (silent under the one-notice rule)
      const say = mv && V3.leagueNews ? V3.leagueNews : V3.rankUp;
      if (kind === 'passed') {
        say({ head: rivalCopy({ name, from, to, levels, rebirths }).title, league, drop: !!(mv && mv.dir === 'down'), ...fromTo });
      } else if (kind === 'dropped') {
        say({ head: `DROPPED TO ${lg ? lg.name : 'A LOWER LEAGUE'}`, league, drop: true, ...fromTo });
      } else if (mv && mv.dir === 'up') {
        say({ head: 'PROMOTED', league, promo: true, ...fromTo, to: { ...fromTo.to, code: lg.name } });
      } else {
        // a climb INTO a seal tier names it (Andy oct21 name prestige): "MADE TOP 10" / "NEW #1" instead of BOARD
        const t = enteredTier(from, to);
        const head = !t ? 'BOARD' : t.key === 'crown' ? 'NEW #1' : `MADE ${t.label}`;
        V3.rankUp({ head, league, ...fromTo, to: { ...fromTo.to, code: standing } });
      }
      if (popRef.current) popRef.current();
      if (doneRef.current) doneRef.current();
      return undefined;
    }
    // the season-1 card has no league drop: a dropped moment just hands the queue back
    if (kind === 'dropped') { if (doneRef.current) doneRef.current(); return undefined; }
    const a = setTimeout(() => setSaid(true), 60);
    const b = setTimeout(() => doneRef.current && doneRef.current(), RANKUP_MS);
    const c = setTimeout(() => popRef.current && popRef.current(), RANKUP_POP_MS);
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one moment per mount: its props are fixed for its life
  }, []);
  if (SEASON2) return null;
  if (kind === 'dropped') return null; // season 1 has no league drop card
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
