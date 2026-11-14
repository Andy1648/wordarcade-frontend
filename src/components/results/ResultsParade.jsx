// results/ResultsParade.jsx — the PROGRESS PARADE (progression phase 1, nov13; claude scratch progression-proposal §B):
// after the K.O. card lands, the game's progress fills in one row at a time, Brawl-Stars style — rows appear ONLY when
// something changed this game:
//   XP       the quest XP that landed on the bar (from → to, LV stamp on a level-up)
//   QUEST ×2 the quests this game moved (bar fills from → to, a DONE stamp + its +wins / +XP on a finish)
//   CONTRACT a daily contract this game finished (2/3) — STREAK KEPT plays HERE, in the flow (its toast holds)
//   LEAGUE   your board place rolled (#219 → #212), a PROMOTED stamp across a league line (the league v3 badge)
// …and it ends on the NUDGE: the quest closest to done and what finishes it ("1 MORE GAME FINISHES A QUEST"), with one
// 200 ms bump on PLAY AGAIN. ~4.5 s from the card's slam; nothing loops after.
//
// RULES (the storyboard): PLAY AGAIN is live from frame 0 — the parade never blocks a button. The FIRST tap anywhere
// skips (every row at its end value); a second tap does what you tapped (a quest row / the nudge open the quest list).
// MOTION: finite WAAPI one-shots through kitPlay (transform / opacity only, will-change only while running, REDUCE
// MOTION = the end state, no timers). The rows are a fixed set of nodes (≤ 5) — nothing is created per beat. ONE layout
// read pass when the rows are known (does the column fit them? — drop the least important row until it does), never per
// frame. SOUND: one synthesized tick per row (pitch rising row by row), a stamp thud on a quest DONE (juice/audio.js —
// the arcade mute applies).
// LAZY (its own chunk, with questsLive.js): first paint never carries it (payload ratchet).
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { kitPlay } from '../kit/motion.js';
import { KitStamp } from '../kit/KitStamp.jsx';
import { reduceMotion } from '../../lib/reduceMotion';
import { rollDigits } from '../../juice/rollDigits.js';
import { scoreTick, stampThud } from '../../juice/audio.js';
import { formatNum } from '../../format';
import { gemsLedgerSince } from '../../progress/gemsCore.js';
import { peekToday } from '../../progress/contracts/bus.js';
import { getStreak } from '../../progress/streak.js';
import { LEADERBOARD_ENABLED, fetchMyRank, getLastRank, getMyProfile, getRankFrom } from '../../leaderboard/client.js';
import { leagueMove } from '../../leaderboard/leagues.js';
import LeagueBadge from '../../leaderboard/LeagueBadge.jsx';
import { BY_ID, WEEK, nudge as nudgeOf } from '../../progress/quests.js';
import { today, lastGameResult, QUESTS_RESULT } from '../../progress/questsLive.js';
import { QUEST_ART, MODE_ART } from './questArt.js';
import '../kit/tokens.css';
import './ResultsParade.css';

const QuestsSheet = lazy(() => import('../quests/QuestsSheet.jsx'));

// the storyboard (ms from the card's mount): XP at 1.0 s, quests from 1.3 s 250 ms apart, contract, league, then the nudge
const T = { xp: 1000, quest: 1300, gap: 250, row: 300, fill: 420, nudgeAfter: 420 };
const WAIT_RESULT_MS = 900; // the game's quest RESULT is settled within ms of game over; wait this long at most
const WAIT_LEAGUE_MS = 900; // the board read joins only if it is back by then (else BoardClimb in the extras says it)
const RISE = [{ transform: 'translateX(-26px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }];
const POP = [{ transform: 'scale(.3) rotate(-10deg)', opacity: 0 }, { transform: 'scale(1.2) rotate(3deg)', opacity: 1, offset: 0.6 }, { transform: 'scale(1) rotate(0)', opacity: 1 }];
const BUMP = [{ transform: 'scale(1)' }, { transform: 'scale(1.06)', offset: 0.45 }, { transform: 'scale(1)' }];
const DROP_ORDER = ['xp', 'league', 'contract', 'quest', 'nudge']; // the least important goes first when the column is short

const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));
// the newest RESULT a parade already showed — a PLAY AGAIN's next card must never replay the last game's
let shownAt = 0;

/** The rows this game earned, in parade order (≤ 4) + the nudge. */
function buildRows({ result, contract, league }) {
  const rows = [];
  if (result && result.xp && result.xp.gained > 0) rows.push({ key: 'xp', kind: 'xp', ...result.xp });
  const ticks = (result && result.ticks) || [];
  const quests = ticks
    .filter((t) => BY_ID[t.id])
    .sort((a, b) => (b.done - a.done) || ((b.to - b.from) / b.target - (a.to - a.from) / a.target))
    .slice(0, 2)
    .map((t) => ({ key: `q-${t.id}`, kind: 'quest', ...t, q: BY_ID[t.id], pay: ((result && result.payouts) || []).find((p) => p.id === t.id) || null }));
  rows.push(...quests);
  if (contract) rows.push({ key: 'contract', kind: 'contract', ...contract });
  if (league) rows.push({ key: 'league', kind: 'league', ...league });
  while (rows.length > 4) rows.splice(rows.findIndex((r) => r.kind === 'xp') >= 0 ? rows.findIndex((r) => r.kind === 'xp') : rows.length - 1, 1);
  return rows;
}

/** This game's finished contracts, from the gem ledger the card already reads (reason 'contract' since the round mark). */
function contractRow(gemsSince) {
  try {
    const paid = gemsLedgerSince(gemsSince).filter((e) => e.reason === 'contract');
    const tasks = paid.filter((e) => e.detail !== 'sweep');
    if (!tasks.length) return null;
    const day = peekToday();
    const done = day ? day.done.length : tasks.length;
    const of = day ? day.picks.length : 3;
    return { done, of, from: Math.max(0, done - tasks.length), kept: done > 0 && done === tasks.length, gems: paid.reduce((a, e) => a + e.amount, 0), streak: Math.max(1, getStreak().count) };
  } catch {
    return null;
  }
}

function QuestRow({ row }) {
  const { q, from, to, target, done, pay } = row;
  return (
    <>
      <span className="rp-art" aria-hidden="true">
        <img src={q.tier === WEEK && QUEST_ART.weekly ? QUEST_ART.weekly : MODE_ART[q.mode] || MODE_ART.any} alt="" width="64" height="64" draggable="false" />
      </span>
      <span className="rp-main">
        <span className="rp-k">{q.tier === WEEK ? <b className="rp-tier">WEEKLY</b> : null}{q.goal}</span>
        <span className="rp-barline">
          <span className="rp-bar" aria-hidden="true"><span className="rp-fill" style={{ transform: `scaleX(${clamp01(to / target)})` }} data-from={clamp01(from / target)} /></span>
          {done && pay && pay.wins > 0 ? <span className="rp-pay rp-reward">+{formatNum(pay.wins)}</span> : null}
        </span>
      </span>
      {done ? (
        <span className="rp-done">
          <span className="rp-stamp" aria-hidden="true">
            {QUEST_ART.doneStamp ? <img src={QUEST_ART.doneStamp} alt="" width="512" height="256" draggable="false" /> : <span className="rp-stamp-kit"><KitStamp kind="done" angle={-9} /></span>}
          </span>
        </span>
      ) : (
        <span className="rp-n" data-from={`${formatNum(from)}/${formatNum(target)}`} data-to={`${formatNum(to)}/${formatNum(target)}`}>{formatNum(to)}/{formatNum(target)}</span>
      )}
    </>
  );
}

function XpRow({ row }) {
  const up = Math.floor(row.to.level) - Math.floor(row.from.level);
  return (
    <>
      <span className="rp-art rp-art--xp" aria-hidden="true"><img src="/results/xp-hex.webp" alt="" width="64" height="64" draggable="false" /></span>
      <span className="rp-main">
        <span className="rp-k"><b className="rp-tier">QUEST XP</b>+{formatNum(Math.round(row.gained))}</span>
        <span className="rp-bar rp-bar--xp" aria-hidden="true"><span className="rp-fill" style={{ transform: `scaleX(${clamp01(row.to.frac)})` }} data-from={up > 0 ? 0 : clamp01(row.from.frac)} /></span>
      </span>
      <span className="rp-n rp-lv">LV {formatNum(Math.floor(row.to.level))}</span>
      {up > 0 ? <span className="rp-done rp-lvup"><span className="rp-chip">LV UP</span></span> : null}
    </>
  );
}

function ContractRow({ row }) {
  return (
    <>
      <span className="rp-art" aria-hidden="true"><img src="/cast/props/flame.webp" alt="" width="64" height="64" draggable="false" /></span>
      <span className="rp-main">
        <span className="rp-k"><b className="rp-tier">CONTRACT</b>{row.kept ? `STREAK ${formatNum(row.streak)} KEPT` : 'CONTRACT DONE'}</span>
        <span className="rp-pips" aria-hidden="true">{Array.from({ length: row.of }, (_, i) => <i key={i} className={i < row.done ? 'is-on' : ''} />)}</span>
      </span>
      <span className="rp-n" data-from={`${formatNum(row.from)}/${formatNum(row.of)}`} data-to={`${formatNum(row.done)}/${formatNum(row.of)}`}>{formatNum(row.done)}/{formatNum(row.of)}</span>
      {row.kept ? <span className="rp-done"><span className="rp-chip rp-chip--kept">KEPT</span></span> : null}
    </>
  );
}

function LeagueRow({ row }) {
  return (
    <>
      <span className="rp-league"><LeagueBadge rank={row.to} /></span>
      <span className="rp-main">
        <span className="rp-k"><b className="rp-tier">BOARD</b>▲{formatNum(row.from - row.to)}</span>
      </span>
      <span className="rp-n rp-place" data-from={`#${formatNum(row.from)}`} data-to={`#${formatNum(row.to)}`}>#{formatNum(row.to)}</span>
      {row.move && row.move.dir === 'up' ? <span className="rp-done"><span className="rp-chip rp-chip--promo">PROMOTED</span></span> : null}
    </>
  );
}

/**
 * @param {object} p
 * @param {React.Ref} p.cardRef   the results card root (the tap-to-skip surface + the PLAY AGAIN bump)
 * @param {boolean}   p.narrow    the phone stack: the parade takes the tally's place once the tally has landed
 * @param {number}    p.gemsSince the gems ledger mark for this game (contracts)
 * @param {boolean}   p.inFlow    EVERY OTHER MODE's end card (nov14): the parade is one more block in the card's own column —
 *                                no tally to wait for, and the fit drops rows until the CARD (and the page) does not scroll.
 *                                The card gets data-parade-collapsed on a phone so its CSS can fold secondary lines.
 */
export default function ResultsParade({ cardRef, narrow = false, gemsSince = 0, inFlow = false }) {
  const mountAt = useRef(Date.now());
  const [data, setData] = useState(null); // { rows, nudge }
  const [rows, setRows] = useState(null);
  const [phase, setPhase] = useState('load'); // load → fit → run → done
  const [shown, setShown] = useState(0); // rows revealed (the nudge is index rows.length)
  const [sheet, setSheet] = useState(false);
  const rootRef = useRef(null);
  const skipRef = useRef(() => {});
  const swallow = useRef(false);

  const earlySkip = useRef(false); // a tap before the rows are known still means "skip the parade"

  // the contract toasts hold while the parade is up (contracts/live.js) — the row says it in the flow instead
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.paradeUp = '1';
    const card = cardRef && cardRef.current;
    const early = (e) => { if (!(e.target && e.target.closest && e.target.closest('button, a'))) earlySkip.current = true; };
    if (card) card.addEventListener('pointerdown', early);
    return () => {
      delete html.dataset.paradeUp;
      if (card) card.removeEventListener('pointerdown', early);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- the card is mounted once per game

  // ---- the data: this game's quest RESULT (questsLive settles it on the game's end event), the contracts, the board
  useEffect(() => {
    let live = true;
    let result = null;
    let league = null;
    let resultDone = false;
    let leagueDone = !LEADERBOARD_ENABLED;
    // this game's RESULT: settled within ms of the game-over (this lazy parade can mount a beat later), never one shown before
    const fresh = (r) => !!r && r.at > shownAt && r.at >= mountAt.current - 5000;
    const finish = () => {
      if (!live || !resultDone || !leagueDone) return;
      live = false;
      if (result) shownAt = Math.max(shownAt, result.at);
      let n = result && result.nudge;
      if (!n) { try { n = nudgeOf(today()); } catch { n = null; } }
      let rows = [];
      try { rows = buildRows({ result, contract: contractRow(gemsSince), league }); } catch { rows = []; } // never a stuck card
      setData({ rows, nudge: n });
      const card = cardRef && cardRef.current;
      if (card && league) card.dataset.paradeLeague = '1';
    };
    const onResult = (e) => { if (fresh(e.detail)) { result = e.detail; resultDone = true; finish(); } };
    window.addEventListener(QUESTS_RESULT, onResult);
    if (fresh(lastGameResult())) { result = lastGameResult(); resultDone = true; }
    const t1 = setTimeout(() => { resultDone = true; finish(); }, WAIT_RESULT_MS);
    // the board: BoardClimb (the extras) pushed this run's stats on mount; read the place it landed on
    const me = LEADERBOARD_ENABLED ? getMyProfile() : null;
    const from = me && me.id ? getRankFrom() || getLastRank() : null;
    if (!from) leagueDone = true;
    else {
      fetchMyRank().then((to) => {
        if (to && to < from) league = { from, to, move: leagueMove(from, to) };
      }, () => {}).finally(() => { leagueDone = true; finish(); });
    }
    const t2 = setTimeout(() => { leagueDone = true; finish(); }, WAIT_LEAGUE_MS);
    finish();
    return () => { live = false; clearTimeout(t1); clearTimeout(t2); window.removeEventListener(QUESTS_RESULT, onResult); };
  }, [gemsSince]); // eslint-disable-line react-hooks/exhaustive-deps -- cardRef is the card root (stable)

  // ---- a PHONE has one column: once the tally has landed (or a tap skipped it) the tally COLLAPSES to its summary row
  // (gems + total) and the parade takes the freed space in flow — never laid over the tally. The laptop fits straight away.
  useEffect(() => {
    if (!data) return undefined;
    const card = cardRef && cardRef.current;
    const go = () => {
      if (narrow && card && (data.rows.length || data.nudge)) card.dataset.paradeCollapsed = '1'; // nothing to show: the tally stays
      setRows(data.rows);
      setPhase('fit');
    };
    if (!narrow || !card || inFlow || card.dataset.tally === 'done') { go(); return undefined; }
    const mo = new MutationObserver(() => { if (card.dataset.tally === 'done') { mo.disconnect(); go(); } });
    mo.observe(card, { attributes: true, attributeFilter: ['data-tally'] });
    return () => mo.disconnect();
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps -- one end layout per card
  useEffect(() => () => { const card = cardRef && cardRef.current; if (card) delete card.dataset.paradeCollapsed; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- FIT (one layout pass, never per frame): drop the least important row until the parade fits its column
  useLayoutEffect(() => {
    if (phase !== 'fit' || !rows) return;
    const el = rootRef.current;
    const card = cardRef && cardRef.current;
    if (!el || !card) { setPhase('run'); return; }
    let over;
    if (inFlow) {
      // the card's own column: neither it nor the page may scroll (it scrolls only when it is the scroller, so both are read)
      const de = document.scrollingElement || document.documentElement;
      let sc = card.parentElement; // the card may sit in a scrolling scrim (CHAIN / FUSE): that box must not scroll either
      while (sc && sc !== document.body && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
      over = card.scrollHeight - card.clientHeight > 1 || de.scrollHeight - window.innerHeight > 1
        || (!!sc && sc !== document.body && sc.scrollHeight - sc.clientHeight > 1);
    } else if (narrow) {
      over = card.scrollHeight - card.clientHeight > 0; // in flow: the one column must not scroll
    } else {
      const pr = el.getBoundingClientRect();
      const players = card.querySelector('.rs2-players');
      const list = players && players.offsetParent !== null ? players.querySelector('.rs2-plist') : null;
      const top = list ? list.getBoundingClientRect().bottom + 10 : (card.querySelector('.rs2-tally') || el).getBoundingClientRect().top;
      over = el.scrollHeight > pr.bottom - top + 1;
    }
    if (over) {
      const kinds = rows.map((r) => r.kind);
      const drop = DROP_ORDER.find((k) => (k === 'nudge' ? !!data.nudge && !el.dataset.noNudge : kinds.includes(k)));
      if (drop === 'nudge') { el.dataset.noNudge = '1'; setRows(rows.slice()); return; }
      if (drop) {
        const i = rows.map((r) => r.kind).lastIndexOf(drop);
        setRows(rows.filter((_, j) => j !== i));
        return;
      }
    }
    setPhase('run');
  }, [phase, rows]); // eslint-disable-line react-hooks/exhaustive-deps -- one pass per row set

  // ---- RUN: the timeline. Desktop starts on the storyboard clock; a phone waits for its tally to land.
  useEffect(() => {
    if (phase !== 'run' || !rows) return undefined;
    const el = rootRef.current;
    const card = cardRef && cardRef.current;
    const hasNudge = !!data.nudge && !(el && el.dataset.noNudge);
    const total = rows.length + (hasNudge ? 1 : 0);
    if (!el || total === 0) { setPhase('done'); return undefined; }
    const nodes = () => [...el.querySelectorAll('.rp-row, .rp-nudge')];
    const settle = () => {
      setShown(total);
      for (const n of nodes()) {
        n.classList.remove('rp-wait');
        for (const a of [n, ...n.querySelectorAll('.rp-fill, .rp-done, .rp-n, .rp-reward')]) {
          if (a.__kitAnim) { try { a.__kitAnim.finish(); } catch { /* gone */ } }
        }
        const num = n.querySelector('.rp-n[data-to]');
        if (num) num.textContent = num.dataset.to;
      }
      el.dataset.state = 'done';
      setPhase('done');
    };
    if (reduceMotion() || earlySkip.current) { el.classList.remove('is-held'); settle(); return undefined; }
    el.dataset.state = 'run';
    const timers = [];
    let finished = false;
    const reveal = (i) => {
      const n = nodes()[i];
      if (!n || finished) return;
      n.classList.remove('rp-wait');
      setShown(i + 1);
      kitPlay(n, RISE, { duration: 300, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'backwards' });
      scoreTick(total > 1 ? i / (total - 1) : 1);
      if (n.classList.contains('rp-nudge')) {
        const again = card && card.querySelector('.game-over-rematch, [data-parade-again]');
        if (again) kitPlay(again, BUMP, { duration: 200, easing: 'ease-out' });
        return;
      }
      const fill = n.querySelector('.rp-fill');
      if (fill) {
        const from = Number(fill.dataset.from) || 0;
        const to = fill.style.transform;
        kitPlay(fill, [{ transform: `scaleX(${from})` }, { transform: to }], { duration: T.fill, delay: 120, easing: 'cubic-bezier(.3,1.1,.5,1)', fill: 'backwards' });
      }
      const num = n.querySelector('.rp-n[data-to]');
      if (num) rollDigits(num, num.dataset.to, { delay: 120, ms: T.fill });
      const done = n.querySelector('.rp-done');
      const reward = n.querySelector('.rp-reward');
      if (done) {
        timers.push(setTimeout(() => {
          if (finished) return;
          kitPlay(done, POP, { duration: 360, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'backwards' });
          if (reward) kitPlay(reward, POP, { duration: 360, delay: 90, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'backwards' });
          stampThud();
        }, 120 + T.fill));
      }
    };
    const start = () => {
      if (finished) return;
      for (const num of el.querySelectorAll('.rp-n[data-from]')) num.textContent = num.dataset.from; // every count starts where it was
      const base = Date.now() - mountAt.current;
      let t = narrow ? 0 : Math.max(0, (rows[0] && rows[0].kind === 'xp' ? T.xp : T.quest) - base);
      let lastEnd = t;
      rows.forEach((r, i) => {
        timers.push(setTimeout(() => reveal(i), t));
        const end = t + 120 + T.fill + (r.kind === 'quest' && r.done ? 360 : 0);
        lastEnd = Math.max(lastEnd, end);
        t += r.kind === 'quest' ? T.gap : T.row;
      });
      const nudgeAt = Math.max(t, lastEnd) + T.nudgeAfter;
      if (hasNudge) timers.push(setTimeout(() => reveal(rows.length), nudgeAt));
      timers.push(setTimeout(() => { if (!finished) { finished = true; settle(); } }, nudgeAt + 420));
    };
    // a phone shows the parade over the tally once the tally has landed (the card marks data-tally="done")
    let mo = null;
    start();
    // TAP TO SKIP: the first press anywhere on the card lands the parade (a button — PLAY AGAIN / MENU — is never eaten)
    skipRef.current = (e) => {
      if (finished) return;
      if (e && e.target && e.target.closest && e.target.closest('button, a')) return;
      finished = true;
      if (mo) { mo.disconnect(); mo = null; }
      for (const id of timers) clearTimeout(id);
      el.classList.remove('is-held');
      if (e && e.target && e.target.closest && e.target.closest('.rp')) swallow.current = true; // that tap was the skip
      settle();
    };
    const onDown = (e) => skipRef.current(e);
    const surface = card || el;
    surface.addEventListener('pointerdown', onDown);
    return () => {
      finished = true;
      if (mo) mo.disconnect();
      for (const id of timers) clearTimeout(id);
      surface.removeEventListener('pointerdown', onDown);
    };
  }, [phase === 'run']); // eslint-disable-line react-hooks/exhaustive-deps -- one timeline per card

  const openList = () => {
    if (swallow.current) { swallow.current = false; return; }
    if (phase !== 'done') return;
    setSheet(true);
  };
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (phase === 'done') setSheet(true); } };

  const nudge = data && data.nudge;
  const noNudge = rootRef.current && rootRef.current.dataset.noNudge;
  const list = rows || [];
  return (
    <section ref={rootRef} className={`rp${narrow ? ' rp--narrow' : ''}${inFlow ? ' rp--flow' : ''}${data ? '' : ' is-loading'}`} aria-label="Your progress this game" data-testid="results-parade" data-phase={phase} data-rows={list.map((r) => r.kind).join(',')}>
      {list.map((r, i) => {
        const tap = r.kind === 'quest';
        return (
          <div
            key={r.key}
            className={`rp-row rp-row--${r.kind}${r.done ? ' is-done' : ''}${phase === 'done' || i < shown ? '' : ' rp-wait'}`}
            data-kind={r.kind}
            data-quest={r.id || undefined}
            {...(tap ? { role: 'button', tabIndex: 0, onClick: openList, onKeyDown: onKey, 'aria-label': `${r.q.text}: ${formatNum(r.to)} of ${formatNum(r.target)}${r.done ? ', done' : ''}. Open the quest list` } : {})}
          >
            {r.kind === 'quest' ? <QuestRow row={r} /> : r.kind === 'xp' ? <XpRow row={r} /> : r.kind === 'contract' ? <ContractRow row={r} /> : <LeagueRow row={r} />}
          </div>
        );
      })}
      {nudge && !noNudge ? (
        <div
          className={`rp-nudge${phase === 'done' || shown > list.length ? '' : ' rp-wait'}`}
          role="button"
          tabIndex={0}
          onClick={openList}
          onKeyDown={onKey}
          aria-label={`${nudge.text}. Open the quest list`}
          data-testid="parade-nudge"
          style={QUEST_ART.nudgeBanner ? { backgroundImage: `url(${QUEST_ART.nudgeBanner})` } : undefined}
        >
          <span className="rp-nudge-t">{nudge.text}</span>
          <span className="rp-nudge-go" aria-hidden="true">▸</span>
        </div>
      ) : null}
      {sheet ? (
        <Suspense fallback={null}>
          <QuestsSheet onClose={() => setSheet(false)} />
        </Suspense>
      ) : null}
      <span className="rp-sr" aria-live="polite">{phase === 'done' && list.length ? list.map((r) => (r.kind === 'quest' ? `${r.q.goal} ${r.to}/${r.target}${r.done ? ' done' : ''}` : r.kind)).join('. ') : ''}</span>
    </section>
  );
}
