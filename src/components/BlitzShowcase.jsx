// BlitzShowcase.jsx — THE BREAK BETWEEN ROUNDS as a showcase (Andy oct21: "emphasis on the time in between games. That
// should be long enough for people to analyze each other, get that juice of competitiveness … we need design. That
// doesn't mean overcrowding, but we definitely need to fill in stuff."), plus the game-over AWARDS row.
//
// Cosmetic (Tier 2): everything here is derived from round_end (everyone's answers + round scores) and the running
// totals the client already keeps. Behind ?cbshow=1 while it is a preview.
//
//   MOMENTS   up to 3 painted callouts that slam in after the reveal: who TOOK THE LEAD, MOST UNIQUE, who THINK ALIKE
//             (the pair that shared the most answers), the BIG CLIMB in the standings.
//   BOARD     every player side by side in standings order: place + movement (▲2), round score counting up, total,
//             the UNIQUE stamp, and their answers (unique = pink). It never scrolls: chips step down a size to fit.
//   BREAK BAR the time left to read, draining (one transform animation the length of the break).
//   AWARDS    game over: MVP, MOST UNIQUE, THINK ALIKE, BIG COMEBACK across the whole game.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './BlitzShowcase.css';

const ART = {
  crown: '/fx/blitz-crown.webp',
  stamp: '/fx/blitz-stamp.webp',
  rocket: '/fx/blitz-rocket.webp',
  brains: '/fx/blitz-brains.webp',
  medal: '/fx/blitz-medal.webp',
};

export function showcaseOn() {
  try {
    const q = new URLSearchParams(window.location.search).get('cbshow');
    if (q) sessionStorage.setItem('taw.cbshow', q);
    return sessionStorage.getItem('taw.cbshow') === '1' || window.__CB_SHOW === true;
  } catch {
    return false;
  }
}

const reduced = () => {
  try {
    return document.documentElement.dataset.reduceMotion === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};
const keyOf = (a) => String(a || '').trim().toLowerCase().replace(/\s+/g, ' ');
const first = (name) => String(name || '').toUpperCase();

/** places by score: ties share a place (1, 1, 3) */
function places(list, scoreOf) {
  const sorted = [...list].sort((a, b) => scoreOf(b) - scoreOf(a));
  const out = {};
  sorted.forEach((p, i) => { out[p.id] = i > 0 && scoreOf(p) === scoreOf(sorted[i - 1]) ? out[sorted[i - 1].id] : i + 1; });
  return out;
}
function soleLeader(list, scoreOf) {
  const s = [...list].sort((a, b) => scoreOf(b) - scoreOf(a));
  return s[0] && scoreOf(s[0]) > 0 && (!s[1] || scoreOf(s[1]) < scoreOf(s[0])) ? s[0] : null;
}

/** Everything the board shows, from round_end + running totals. Pure. */
export function analyseRound(results, totals) {
  const prs = results.playerResults || [];
  const count = new Map();
  for (const pr of prs) for (const k of new Set(pr.answers.map(keyOf))) count.set(k, (count.get(k) || 0) + 1);
  const rows = prs.map((pr) => {
    const total = totals[pr.id] != null ? totals[pr.id] : pr.roundScore;
    return {
      ...pr,
      total,
      before: total - pr.roundScore,
      unique: new Set(pr.answers.filter((a) => count.get(keyOf(a)) === 1).map(keyOf)),
      keys: new Set(pr.answers.map(keyOf)),
    };
  });
  const nowPlace = places(rows, (r) => r.total);
  const wasPlace = places(rows, (r) => r.before);
  rows.forEach((r) => { r.place = nowPlace[r.id]; r.moved = (results.round || 1) > 1 ? wasPlace[r.id] - nowPlace[r.id] : 0; });
  rows.sort((a, b) => a.place - b.place || b.roundScore - a.roundScore);

  const moments = [];
  if (rows.length >= 2) {
    const lead = soleLeader(rows, (r) => r.total);
    const wasLead = soleLeader(rows, (r) => r.before);
    if (lead && (results.round || 1) > 1 && (!wasLead || wasLead.id !== lead.id)) moments.push({ kind: 'lead', art: ART.crown, title: 'TOOK THE LEAD', who: first(lead.name) });
    else if (lead) moments.push({ kind: 'lead', art: ART.crown, title: 'IN THE LEAD', who: first(lead.name) });
    const uq = [...rows].sort((a, b) => b.unique.size - a.unique.size)[0];
    if (uq && uq.unique.size >= 2) moments.push({ kind: 'unique', art: ART.stamp, title: 'MOST UNIQUE', who: first(uq.name), n: uq.unique.size });
    let pair = null;
    for (let i = 0; i < rows.length; i += 1) for (let j = i + 1; j < rows.length; j += 1) {
      let k = 0;
      for (const a of rows[i].keys) if (rows[j].keys.has(a)) k += 1;
      if (k >= 2 && (!pair || k > pair.k)) pair = { a: rows[i], b: rows[j], k };
    }
    if (pair) moments.push({ kind: 'alike', art: ART.brains, title: 'THINK ALIKE', who: `${first(pair.a.name)} + ${first(pair.b.name)}`, n: pair.k });
    const climb = [...rows].sort((a, b) => b.moved - a.moved)[0];
    if (climb && climb.moved >= 1) moments.push({ kind: 'climb', art: ART.rocket, title: 'BIG CLIMB', who: first(climb.name), n: climb.moved, up: true });
  }
  return { rows, moments: moments.slice(0, 3) };
}

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

/** The round-break board. `breakMs` is the server's break (round_end.nextInMs). */
export function ShowcaseBoard({ results, totals, myId, colorOf, sound, PlayerDot, breakMs, MissedAnswers }) {
  const { rows, moments } = useMemo(() => analyseRound(results, totals), [results, totals]);
  const n = rows.length;
  const solo = n < 2;
  const STEP = Math.min(520, Math.max(300, 2200 / Math.max(1, n)));
  const byRound = [...rows].sort((a, b) => a.roundScore - b.roundScore); // reveal lowest round score first
  const order = Object.fromEntries(byRound.map((r, i) => [r.id, i]));
  const momentsAt = n * STEP + 450;

  // NO SCROLL: if the chips outgrow their card, every card steps down a size together; if even the smallest size
  // overflows (8 players on a phone), each card keeps what fits — uniques first — and folds the rest into "+N".
  // Measured once per round and per resize (clip === null means "measure now"), never per frame or keystroke.
  const gridRef = useRef(null);
  const [clip, setClip] = useState(null);
  useEffect(() => { setClip(null); }, [results]);
  useEffect(() => {
    const onResize = () => setClip(null);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useLayoutEffect(() => {
    const g = gridRef.current;
    if (!g || clip !== null) return;
    g.dataset.fit = '0';
    const boxes = () => [...g.querySelectorAll('.sc-chips')];
    const over = () => boxes().some((c) => c.scrollHeight > c.clientHeight + 1);
    for (let d = 1; d <= 3 && over(); d += 1) g.dataset.fit = String(d);
    const next = {};
    for (const box of boxes()) {
      if (box.scrollHeight <= box.clientHeight + 1) continue;
      const chips = [...box.children];
      const fits = chips.filter((c) => c.offsetTop + c.offsetHeight <= box.clientHeight + 1).length;
      next[box.dataset.id] = chips.length - Math.max(0, fits - 1); // leave a slot for the "+N" chip
    }
    setClip(next);
  }, [clip]);

  // the break bar drains over the whole break: one finite transform animation
  const barRef = useRef(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el || !breakMs) return;
    el.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: breakMs, easing: 'linear', fill: 'forwards' });
  }, [breakMs, results]);

  useEffect(() => {
    if (solo || !moments.length) return undefined;
    const t = window.setTimeout(() => { try { sound.punch(); } catch { /* audio never blocks */ } }, momentsAt);
    return () => window.clearTimeout(t);
  }, [results, momentsAt, solo, moments.length, sound]);

  return (
    <div className={`sc-show sc-n${Math.min(n, 8)}`}>
      {!solo && moments.length > 0 && (
        <div className="sc-moments">
          {moments.map((m, i) => (
            <div key={m.kind} className={`sc-moment sc-moment--${m.kind}`} style={{ '--d': `${momentsAt + i * 220}ms` }}>
              <img src={m.art} alt="" aria-hidden="true" />
              <span className="sc-moment-text">
                <span className="sc-moment-title">{m.title}{m.n != null && <span className="sc-moment-n">{m.up ? ` ▲${m.n}` : ` ×${m.n}`}</span>}</span>
                <span className="sc-moment-who" translate="no">{m.who}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="sc-grid" ref={gridRef}>
        {rows.map((r) => {
          const pc = colorOf(r.id);
          const delay = order[r.id] * STEP;
          const lead = !solo && r.place === 1 && rows.filter((x) => x.place === 1).length === 1;
          return (
            <div key={r.id} className={`sc-card${r.id === myId ? ' is-me' : ''}${lead ? ' is-lead' : ''}`}
              style={{ '--pc': pc.color, '--pc-dark': pc.dark, '--d': `${delay}ms` }}>
              {lead && <img className="sc-crown" src={ART.crown} alt="" aria-hidden="true" style={{ '--d': `${n * STEP + 120}ms` }} />}
              <div className="sc-head">
                <span className="sc-place">
                  {r.place}
                  {r.moved > 0 && <span className="sc-move is-up">▲{r.moved}</span>}
                  {r.moved < 0 && <span className="sc-move is-down">▼{-r.moved}</span>}
                </span>
                <span className="sc-name">
                  <PlayerDot color={pc.color} dark={pc.dark} tier={pc.tier} />
                  <span className="cb-result-name-text" translate="no">{r.name}</span>
                  {r.id === myId && <span className="game-player-you">YOU</span>}
                </span>
              </div>
              <div className="sc-score-row">
                <span className="sc-round">
                  +<CountUp to={r.roundScore} delay={delay} onLand={() => { try { sound.combo(order[r.id] + 1); } catch { /* */ } }} />
                </span>
                <span className="sc-total">{r.total}<span className="sc-total-l"> TOTAL</span></span>
                {!solo && r.unique.size > 0 && (
                  <span className="sc-uniq" style={{ '--d': `${delay + 260}ms` }}>
                    <img src={ART.stamp} alt="" aria-hidden="true" />
                    <span className="sc-uniq-n">{r.unique.size}</span>
                  </span>
                )}
              </div>
              <div className="sc-chips" translate="no" data-id={r.id}>
                {r.answers.length === 0 ? (
                  <span className="game-used-empty">NO ANSWERS</span>
                ) : (() => {
                  const isU = (a) => !solo && r.unique.has(keyOf(a));
                  const ordered = [...r.answers.filter(isU), ...r.answers.filter((a) => !isU(a))]; // uniques lead
                  const hide = (clip && clip[r.id]) || 0;
                  const shown = hide ? ordered.slice(0, ordered.length - hide) : ordered;
                  return (
                    <>
                      {shown.map((a, k) => (
                        <span key={`${a}-${k}`} className={`cb-answer-chip${isU(a) ? ' sc-chip-unique' : ''}`}>{a.toUpperCase()}</span>
                      ))}
                      {hide > 0 && <span className="cb-answer-chip sc-chip-more">+{hide}</span>}
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {MissedAnswers && (results.sampleAnswers || []).length > 0 && (
        <div className="sc-missed"><MissedAnswers key={results.round} answers={results.sampleAnswers} /></div>
      )}

      {breakMs ? <div className="sc-break" aria-hidden="true"><span className="sc-break-fill" ref={barRef} /></div> : null}
    </div>
  );
}

/** Game over: the whole game's awards, from every round_end this client saw. */
export function analyseGame(history, finalScores) {
  if (!history.length || !finalScores || finalScores.length < 2) return [];
  const names = Object.fromEntries(finalScores.map((s) => [s.id, s.name]));
  const uniq = {};
  const shared = {};
  const placeByRound = [];
  const running = {};
  for (const res of history) {
    const prs = res.playerResults || [];
    const count = new Map();
    for (const pr of prs) for (const k of new Set(pr.answers.map(keyOf))) count.set(k, (count.get(k) || 0) + 1);
    for (const pr of prs) {
      uniq[pr.id] = (uniq[pr.id] || 0) + new Set(pr.answers.filter((a) => count.get(keyOf(a)) === 1).map(keyOf)).size;
      running[pr.id] = (running[pr.id] || 0) + pr.roundScore;
    }
    for (let i = 0; i < prs.length; i += 1) for (let j = i + 1; j < prs.length; j += 1) {
      const a = new Set(prs[i].answers.map(keyOf));
      let k = 0;
      for (const x of new Set(prs[j].answers.map(keyOf))) if (a.has(x)) k += 1;
      const key = [prs[i].id, prs[j].id].sort().join('|');
      shared[key] = (shared[key] || 0) + k;
    }
    placeByRound.push(places(Object.keys(running).map((id) => ({ id })), (p) => running[p.id]));
  }
  const awards = [];
  const mvp = [...finalScores].sort((a, b) => b.score - a.score)[0];
  if (mvp && mvp.score > 0) awards.push({ kind: 'mvp', art: ART.medal, title: 'MVP', who: first(mvp.name), n: mvp.score, unit: 'PTS' });
  const uq = Object.entries(uniq).sort((a, b) => b[1] - a[1])[0];
  if (uq && uq[1] >= 2) awards.push({ kind: 'unique', art: ART.stamp, title: 'MOST UNIQUE', who: first(names[uq[0]]), n: uq[1], unit: 'ONLY THEM' });
  const pair = Object.entries(shared).sort((a, b) => b[1] - a[1])[0];
  if (pair && pair[1] >= 2) {
    const [a, b] = pair[0].split('|');
    awards.push({ kind: 'alike', art: ART.brains, title: 'THINK ALIKE', who: `${first(names[a])} + ${first(names[b])}`, n: pair[1], unit: 'SAME ANSWERS' });
  }
  if (placeByRound.length >= 2) {
    let best = null;
    for (const id of Object.keys(running)) {
      const worst = Math.max(...placeByRound.map((p) => p[id] || 1));
      const end = placeByRound[placeByRound.length - 1][id] || 1;
      const climb = worst - end;
      if (climb >= 1 && (!best || climb > best.climb)) best = { id, climb };
    }
    if (best) awards.push({ kind: 'climb', art: ART.rocket, title: 'COMEBACK', who: first(names[best.id]), n: best.climb, unit: 'PLACES UP' });
  }
  return awards.slice(0, 4);
}

export function AwardsRow({ awards }) {
  if (!awards.length) return null;
  return (
    <div className="sc-awards">
      {awards.map((a, i) => (
        <div key={a.kind} className={`sc-award sc-award--${a.kind}`} style={{ '--d': `${300 + i * 180}ms` }}>
          <img src={a.art} alt="" aria-hidden="true" />
          <span className="sc-award-title">{a.title}</span>
          <span className="sc-award-who" translate="no">{a.who}</span>
          <span className="sc-award-n">{a.n} {a.unit}</span>
        </div>
      ))}
    </div>
  );
}
