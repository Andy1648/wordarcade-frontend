// BlitzRivalJuice.jsx — the moments BETWEEN players in a Category Blitz room (Andy oct21: "i need some more visual
// stimulation - that addictive feel for category blitz (especially popular since people are playing with others)").
//
// PURELY COSMETIC (Tier 2): it reads state GameScreen already has — the roster, the per-rival answer counts the server
// broadcasts (player_progress), my own answers, and round_end's revealed answers — and changes nothing about scoring, the
// WebSocket or the round. On by default; ?cbjuice=0 turns it off.
//
//   RaceStrip   live race: every player (me included) on one ladder, sorted by answers, a fill bar against the leader,
//               the painted CROWN on whoever leads, a "+1" pop on a rival's row the moment they score, a FLAME on anyone
//               on a run (3 answers inside 8 s). Rows move by transform only (fixed row height, no layout reads).
//   OvertakeBanner  the painted BANNER slams in when I take the lead / pass someone / get passed, with a stage punch
//               and a synth sting. One node, re-played with WAAPI.
//   RevealBoard round end: players reveal lowest → highest, each score COUNTS UP and slams; answers nobody else had get
//               the painted UNIQUE stamp; the round's top scorer gets the crown last.
//
// House rules: real painted assets (/public/fx/blitz-*.webp, never CSS shapes); transform/opacity only; every animation is
// a finite one-shot (zero new infinite animations); repeated effects re-use their node; no layout reads per event.
import { useEffect, useMemo, useRef, useState } from 'react';
import './BlitzRivalJuice.css';

const CROWN = '/fx/blitz-crown.webp';
const FLAME = '/fx/blitz-flame.webp';
const STAMP = '/fx/blitz-stamp.webp';
const BANNER = '/fx/blitz-banner.webp';

// ON by default (Andy oct21: "Love the category Blitz addictive juice thing … I'm fine with banners and stuff").
// ?cbjuice=0 (kept for the tab) is the off switch, so a regression can be ruled in or out in one reload.
export function juiceOn() {
  try {
    const q = new URLSearchParams(window.location.search).get('cbjuice');
    if (q) sessionStorage.setItem('taw.cbjuice', q);
    return sessionStorage.getItem('taw.cbjuice') !== '0' && window.__CB_JUICE !== false;
  } catch {
    return true;
  }
}

const HOT_N = 3;
const HOT_MS = 8000;
const reduced = () => {
  try {
    return document.documentElement.dataset.reduceMotion === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** Everyone's live count + rank. Ties keep roster order, so a tie never shuffles rows. */
export function useRace({ roomPlayers, myId, myCount, playerProgress }) {
  return useMemo(() => {
    const rows = (roomPlayers || []).map((p, i) => ({
      id: p.id,
      name: p.name,
      count: p.id === myId ? myCount : (playerProgress[p.id] || 0),
      seat: i,
    }));
    const sorted = [...rows].sort((a, b) => b.count - a.count || a.seat - b.seat);
    const top = sorted[0] ? sorted[0].count : 0;
    sorted.forEach((r, i) => {
      r.rank = i; // the row's slot on screen (ties by seat)
      r.leads = top > 0 && i === 0 && (sorted[1] ? sorted[1].count < top : true);
    });
    return { rows: sorted, top };
  }, [roomPlayers, myId, myCount, playerProgress]);
}

/** Who is on a run: HOT_N answers inside HOT_MS. A 1 s check only while someone is hot. */
function useHeat(rows, roundKey) {
  const stamps = useRef({});
  const last = useRef({});
  const [hot, setHot] = useState({});
  useEffect(() => { stamps.current = {}; last.current = {}; setHot({}); }, [roundKey]);
  useEffect(() => {
    const now = Date.now();
    for (const r of rows) {
      const prev = last.current[r.id] ?? r.count;
      if (r.count > prev) (stamps.current[r.id] = stamps.current[r.id] || []).push(...Array(r.count - prev).fill(now));
      last.current[r.id] = r.count;
    }
    const compute = () => {
      const t = Date.now();
      const next = {};
      for (const [id, xs] of Object.entries(stamps.current)) {
        const recent = xs.filter((s) => t - s < HOT_MS);
        stamps.current[id] = recent;
        if (recent.length >= HOT_N) next[id] = true;
      }
      setHot((h) => (JSON.stringify(h) === JSON.stringify(next) ? h : next));
      return Object.keys(next).length > 0;
    };
    if (!compute()) return undefined;
    const iv = window.setInterval(() => { if (!compute()) window.clearInterval(iv); }, 1000);
    return () => window.clearInterval(iv);
  }, [rows]);
  return hot;
}

function RaceRow({ row, slot, hidden, me, top, hot, color }) {
  const popRef = useRef(null);
  const prev = useRef(row.count);
  useEffect(() => {
    if (row.count > prev.current && popRef.current && !reduced()) {
      popRef.current.animate(
        // easing PER KEYFRAME, linear overall: an overshoot curve on the whole timeline races it into the fade
        [{ transform: 'translate(0,0) scale(.6)', opacity: 0, easing: 'cubic-bezier(.2,1.4,.4,1)' }, { transform: 'translate(0,-6px) scale(1.15)', opacity: 1, offset: 0.3, easing: 'ease-in' }, { transform: 'translate(0,-22px) scale(1)', opacity: 0 }],
        { duration: 650 },
      );
    }
    prev.current = row.count;
  }, [row.count]);
  const frac = top > 0 ? row.count / top : 0;
  return (
    <li className={`rj-row${me ? ' is-me' : ''}${row.leads ? ' is-lead' : ''}${hidden ? ' is-out' : ''}`} style={{ '--slot': slot, '--pc': color }} aria-hidden={hidden || undefined}>
      <span className="rj-rank">{row.rank + 1}</span>
      <span className="rj-name" translate="no">{me ? 'YOU' : row.name}</span>
      <span className="rj-track" aria-hidden="true"><span className="rj-fill" style={{ transform: `scaleX(${frac})` }} /></span>
      <span className="rj-count">{row.count}</span>
      {row.leads && <img className="rj-crown" src={CROWN} alt="" aria-hidden="true" key={`c-${row.id}`} />}
      {hot && <img className="rj-flame" src={FLAME} alt="" aria-hidden="true" />}
      <span className="rj-pop" ref={popRef} aria-hidden="true">+1</span>
    </li>
  );
}

// A full lobby shows a WINDOW of the race, not all of it (it would squeeze YOUR ANSWERS into a scroll): the top three, you,
// and whoever is right ahead of / behind you — at most 5 rows, each keeping its TRUE rank number, so the gap reads.
const RACE_WINDOW = 5;
function raceWindow(rows, myId) {
  if (rows.length <= RACE_WINDOW) return new Set(rows.map((r) => r.id));
  const me = rows.findIndex((r) => r.id === myId);
  const keep = new Set([0, 1, 2]);
  if (me >= 0) [me, me - 1, me + 1].forEach((i) => { if (i >= 0 && i < rows.length) keep.add(i); });
  for (let i = 3; keep.size < RACE_WINDOW && i < rows.length; i += 1) keep.add(i);
  return new Set([...keep].sort((x, y) => x - y).slice(0, RACE_WINDOW).map((i) => rows[i].id));
}

export function RaceStrip({ race, myId, colorOf, roundKey }) {
  const hot = useHeat(race.rows, roundKey);
  const shown = raceWindow(race.rows, myId);
  const slots = {};
  race.rows.filter((r) => shown.has(r.id)).forEach((r, i) => { slots[r.id] = i; });
  const n = Object.keys(slots).length;
  return (
    <div className="rj-race">
      <div className="cb-section-label">THE RACE</div>
      <ol className={`rj-list${race.rows.length >= 5 ? ' is-full' : ''}`} style={{ '--n': n }}>
        {/* rendered in ROSTER order (stable DOM); each row's place comes from --slot, so a pass slides, never re-mounts */}
        {[...race.rows].sort((x, y) => x.seat - y.seat).map((r) => (
          <RaceRow key={r.id} row={r} slot={slots[r.id] ?? n - 1} hidden={!shown.has(r.id)} me={r.id === myId}
            top={race.top} hot={!!hot[r.id]} color={colorOf(r.id)} />
        ))}
      </ol>
    </div>
  );
}

/** Watches my place in the race and slams a banner on a change. */
export function useOvertake(race, myId, roundKey, sound, stageRef) {
  const [banner, setBanner] = useState(null);
  const prev = useRef(null); // { me, rivals: { id: count }, leader }
  const lastAt = useRef(0);
  useEffect(() => { prev.current = null; setBanner(null); }, [roundKey]);
  useEffect(() => {
    const mine = race.rows.find((r) => r.id === myId);
    if (!mine || race.rows.length < 2) return;
    const rivals = race.rows.filter((r) => r.id !== myId);
    const leader = race.rows[0] && race.rows[0].leads ? race.rows[0].id : null;
    const was = prev.current;
    prev.current = { me: mine.count, rivals: Object.fromEntries(rivals.map((r) => [r.id, r.count])), leader };
    if (!was || mine.count + race.top === 0) return;
    // a PASS: a rival who was level with or ahead of me is now strictly behind; PASSED BY: one who was level or behind
    // is now strictly ahead. A tie is never either.
    const passed = rivals.filter((r) => (was.rivals[r.id] ?? 0) >= was.me && r.count < mine.count);
    const passedBy = rivals.filter((r) => (was.rivals[r.id] ?? 0) <= was.me && r.count > mine.count);
    const now = Date.now();
    if (now - lastAt.current < 1200) return;
    let next = null;
    if (leader === myId && was.leader !== myId) next = { text: 'YOU TOOK THE LEAD!', kind: 'up' };
    else if (passed.length) next = { text: `PASSED ${passed.length > 1 ? `${passed.length} PLAYERS` : passed[0].name}!`.toUpperCase(), kind: 'up' };
    else if (passedBy.length) next = { text: `${passedBy[0].name} PASSED YOU!`.toUpperCase(), kind: 'down' };
    if (!next) return;
    lastAt.current = now;
    setBanner({ ...next, key: now });
    try { (next.kind === 'up' ? sound.punch : sound.whoosh)(); } catch { /* audio never blocks */ }
    const stage = stageRef.current;
    if (stage && !reduced() && next.kind === 'up') {
      stage.animate(
        [{ transform: 'translate(0,0)' }, { transform: 'translate(-5px,2px)' }, { transform: 'translate(4px,-2px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(0,0)' }],
        { duration: 260, easing: 'ease-out' },
      );
    }
  }, [race, myId, sound, stageRef]);
  return banner;
}

export function OvertakeBanner({ banner }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!banner || !el) return;
    if (reduced()) {
      el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 1400 });
      return;
    }
    el.animate(
      [
        // easing per keyframe (slam in, settle, hold, lift out); the overall timeline stays linear
        { transform: 'translate(-50%, -20px) scale(1.6) rotate(-6deg)', opacity: 0, easing: 'cubic-bezier(.2,1.3,.4,1)' },
        { transform: 'translate(-50%, 0) scale(.94) rotate(-2deg)', opacity: 1, offset: 0.14, easing: 'ease-out' },
        { transform: 'translate(-50%, 0) scale(1) rotate(-2deg)', opacity: 1, offset: 0.22 },
        { transform: 'translate(-50%, 0) scale(1) rotate(-2deg)', opacity: 1, offset: 0.82, easing: 'ease-in' },
        { transform: 'translate(-50%, -14px) scale(.9) rotate(-2deg)', opacity: 0 },
      ],
      { duration: 1500 },
    );
  }, [banner]);
  return (
    <div className={`rj-banner${banner && banner.kind === 'down' ? ' is-down' : ''}`} ref={ref} aria-live="polite">
      <img src={BANNER} alt="" aria-hidden="true" />
      <span className="rj-banner-text">{banner ? banner.text : ''}</span>
    </div>
  );
}

/** Count up to `to` once, after `delay` ms. rAF only while counting. */
function CountUp({ to, delay, onLand }) {
  const [v, setV] = useState(reduced() ? to : 0);
  useEffect(() => {
    if (reduced()) { onLand && onLand(); return undefined; }
    let raf = 0;
    const t0 = performance.now() + delay;
    const dur = Math.min(700, 220 + to * 40);
    const step = (t) => {
      const k = Math.max(0, Math.min(1, (t - t0) / dur));
      setV(Math.round(to * (1 - (1 - k) * (1 - k))));
      if (k < 1) raf = requestAnimationFrame(step);
      else onLand && onLand();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, delay]);
  return <>{v}</>;
}

const keyOf = (a) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Round-end board: reveal lowest → highest, count up, slam, stamp the unique answers, crown the top. */
export function RevealBoard({ results, myId, colorOf, totals, sound, PlayerDot, formatNum }) {
  const rows = useMemo(() => {
    const prs = results.playerResults || [];
    const seen = new Map();
    for (const pr of prs) for (const a of new Set(pr.answers.map(keyOf))) seen.set(a, (seen.get(a) || 0) + 1);
    const withU = prs.map((pr) => ({ ...pr, unique: new Set(pr.answers.filter((a) => seen.get(keyOf(a)) === 1).map(keyOf)) }));
    return [...withU].sort((a, b) => b.roundScore - a.roundScore);
  }, [results]);
  const n = rows.length;
  const STEP = Math.min(650, Math.max(380, 2600 / Math.max(1, n))); // the whole reveal lands inside the shortest break
  const topScore = rows[0] ? rows[0].roundScore : 0;
  const solo = n < 2;
  return (
    <div className="rj-reveal">
      {rows.map((pr, i) => {
        const order = n - 1 - i; // lowest reveals first
        const delay = order * STEP;
        const pc = colorOf(pr.id);
        const crowned = !solo && topScore > 0 && pr.roundScore === topScore;
        return (
          <div key={pr.id} className={`rj-res${pr.id === myId ? ' is-me' : ''}`} style={{ '--pc': pc.color, '--pc-dark': pc.dark, '--d': `${delay}ms` }}>
            <div className="rj-res-head">
              <span className="cb-result-name">
                <PlayerDot color={pc.color} dark={pc.dark} tier={pc.tier} />
                <span className="cb-result-name-text" translate="no">{pr.name}</span>
                {pr.id === myId && <span className="game-player-you">YOU</span>}
              </span>
              {pr.unique.size > 0 && !solo && (
                <span className="rj-uniq" style={{ '--d': `${delay + 260}ms` }}>
                  <img src={STAMP} alt="" aria-hidden="true" />
                  <span className="rj-uniq-n">{pr.unique.size}</span>
                  <span className="rj-uniq-l">UNIQUE</span>
                </span>
              )}
              <span className="rj-res-score">
                +<CountUp to={pr.roundScore} delay={delay} onLand={() => { try { sound.combo(order + 1); if (crowned) sound.punch(); } catch { /* */ } }} />
                <span className="cb-result-total">{formatNum(totals[pr.id] != null ? totals[pr.id] : pr.roundScore)} TOTAL</span>
              </span>
              {crowned && <img className="rj-res-crown" src={CROWN} alt="" aria-hidden="true" style={{ '--d': `${n * STEP + 120}ms` }} />}
            </div>
            <div className="cb-result-answers" translate="no">
              {pr.answers.length === 0 ? (
                <span className="game-used-empty">NO ANSWERS</span>
              ) : (
                pr.answers.map((a, k) => (
                  <span key={`${a}-${k}`} className={`cb-answer-chip${!solo && pr.unique.has(keyOf(a)) ? ' rj-chip-unique' : ''}`}>
                    {a.toUpperCase()}
                  </span>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
