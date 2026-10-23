// dailyBlitz/DailyBlitzGame.jsx — the DAILY BLITZ screen: COVER -> six PROMPTS -> RESULTS (+ share).
// A lazy chunk of its own (App.jsx). No account, no WebSocket: the prompts are seeded by the local date,
// answers are judged against the shipped Blitz lists (data.json, loaded here), and the only network call is
// the one tally submit when the day ends (client.js — it never blocks, it only adds the "X% said this").
//
// FITS WITHOUT SCROLLING on laptop, Chromebook and phone: one column, every block sized off the viewport
// (DailyBlitz.css). Motion is one-shot WAAPI on transform/opacity only (kitPlay) — nothing loops at rest.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { localDateKey } from '../daily/dailySeed.js';
import {
  PROMPTS, ROUND_MS, MAX_POINTS, dayNumberFor, promptsForDay, judge, displayFor, scoreDay, bandFor, formatPct,
  buildShareText,
} from './engine.js';
import { loadRun, saveRun, resumeAt, finishDay, currentStreak } from './store.js';
import { submitDay, fetchTallies } from './client.js';
import { kitPlay } from '../components/kit/motion.js';
import { sndWordAccepted, sndWordRejected, sndRunOver, sndStreakExtended } from '../audio/gameSounds.js';
import { track } from '../lib/analytics.js';
import { formatNum } from '../format';
import { SHARE_ARRIVAL } from './launch.js';
import './DailyBlitz.css';

const TIER_LABEL = ['EASY', 'EASY', 'MEDIUM', 'MEDIUM', 'NICHE', 'NICHE'];
const REVEAL_MS = 900; // the stamp after an answer / a timeout, before the next prompt
const SHAKE = [
  { transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(9px)' },
  { transform: 'translateX(-6px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' },
];
const STAMP = [
  { transform: 'scale(1.6) rotate(-10deg)', opacity: 0 },
  { transform: 'scale(0.92) rotate(-4deg)', opacity: 1, offset: 0.55 },
  { transform: 'scale(1) rotate(-4deg)', opacity: 1 },
];

function msToMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next - now;
}
function formatLeft(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}H ${m % 60}M` : `${m}M`;
}

export default function DailyBlitzGame({ onExit, audioSlot = null }) {
  const today = useMemo(() => {
    const dateKey = localDateKey();
    const day = dayNumberFor(dateKey);
    return { dateKey, day, prompts: promptsForDay(day) };
  }, []);
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState(false);
  const [run, setRun] = useState(() => resumeAt(loadRun(today.day)).run);
  const [phase, setPhase] = useState(() => (run.done ? 'results' : 'cover'));
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [reveal, setReveal] = useState(null); // { band, display } | { miss: true }
  const [secs, setSecs] = useState(ROUND_MS / 1000);
  const [streak, setStreak] = useState(() => currentStreak(today.day));
  const [shareNote, setShareNote] = useState('');
  const runRef = useRef(run);
  runRef.current = run;
  const inputRef = useRef(null);
  const cardRef = useRef(null);
  const fillRef = useRef(null);
  const stampRef = useRef(null);
  const timers = useRef({ tick: 0, end: 0, next: 0 });
  const deadline = useRef(0);
  const finishedHere = useRef(false); // this visit played the day out (finish() sends the one submit)

  const at = run.rows.length;
  // while an answer's stamp is up, the card still shows the prompt it answered
  const shown = Math.min(reveal ? Math.max(0, at - 1) : at, PROMPTS - 1);
  const catName = today.prompts[shown];
  const cat = data ? data.cats[catName] : null;

  // the lists ride their own chunk (~40 KB gz) — loaded on mount, never on the menu
  useEffect(() => {
    let live = true;
    import('./data.json').then(
      (m) => { if (live) setData(m.default || m); },
      () => { if (live) setLoadErr(true); },
    );
    if (SHARE_ARRIVAL) track('daily_blitz_share_arrival', { day: today.day });
    track('daily_blitz_open', { day: today.day, done: !!runRef.current.done });
    return () => { live = false; };
  }, [today.day]);

  const persist = useCallback((next) => {
    runRef.current = next;
    setRun(next);
    saveRun(next);
  }, []);

  const clearTimers = () => {
    clearInterval(timers.current.tick);
    clearTimeout(timers.current.end);
    clearTimeout(timers.current.next);
  };
  useEffect(() => clearTimers, []);

  // ---- the clock ----
  const startClock = useCallback((index) => {
    clearTimers();
    deadline.current = Date.now() + ROUND_MS;
    setSecs(ROUND_MS / 1000);
    timers.current.tick = setInterval(() => {
      setSecs(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 250);
    timers.current.end = setTimeout(() => onTimeout(index), ROUND_MS);
    kitPlay(fillRef.current, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ROUND_MS, easing: 'linear', fill: 'forwards', keep: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const begin = useCallback((index) => {
    const r = runRef.current;
    persist({ ...r, started: index + 1 }); // started BEFORE it shows: a reload now counts it as a miss
    setText('');
    setMsg('');
    setReveal(null);
    setPhase('play');
    startClock(index);
    requestAnimationFrame(() => inputRef.current && inputRef.current.focus());
  }, [persist, startClock]);

  // ---- the end of the day ----
  const finish = useCallback(async (rowsDone) => {
    clearTimers();
    finishedHere.current = true;
    const base = { ...runRef.current, rows: rowsDone, done: true };
    const provisional = scoreDay(rowsDone, null);
    persist({ ...base, total: provisional.total, points: provisional.rows.map((r) => r.points) });
    const st = finishDay(today.day, provisional.total);
    setStreak(currentStreak(today.day));
    if (st.streak >= 2) sndStreakExtended(); else sndRunOver();
    setPhase('results');
    track('daily_blitz_finish', { day: today.day, total: provisional.total, answered: rowsDone.filter((r) => r.key).length });
    const tallies = await submitDay(today.dateKey, rowsDone.map((r) => r.key || ''));
    if (tallies) {
      const scored = scoreDay(rowsDone, tallies);
      // the score LOCKS here (first tallies): a later revisit refreshes the percentages, never the score
      persist({ ...runRef.current, sent: true, tallies, total: scored.total, points: scored.rows.map((r) => r.points) });
      finishDay(today.day, scored.total);
    }
  }, [persist, today.day, today.dateKey]);

  const advance = useCallback((rows) => {
    if (rows.length >= PROMPTS) {
      timers.current.next = setTimeout(() => finish(rows), REVEAL_MS);
    } else {
      timers.current.next = setTimeout(() => begin(rows.length), REVEAL_MS);
    }
  }, [begin, finish]);

  function onTimeout(index) {
    const r = runRef.current;
    if (r.rows.length !== index) return; // already answered
    clearInterval(timers.current.tick);
    setSecs(0);
    const rows = [...r.rows, { key: null, display: null, prior: null, typed: '' }];
    persist({ ...r, rows });
    setReveal({ miss: true });
    sndWordRejected();
    requestAnimationFrame(() => kitPlay(stampRef.current, STAMP, { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' }));
    advance(rows);
  }

  const submit = (e) => {
    if (e) e.preventDefault();
    if (phase !== 'play' || reveal || !cat) return;
    const r = runRef.current;
    const j = judge(cat, text);
    if (!j.ok) {
      if (j.reason === 'empty') return;
      setMsg(`"${text.trim().slice(0, 24).toUpperCase()}" ISN'T ON THE LIST`);
      sndWordRejected();
      kitPlay(cardRef.current, SHAKE, { duration: 280, easing: 'ease-out' });
      setText('');
      return;
    }
    clearTimers();
    try { fillRef.current && fillRef.current.getAnimations().forEach((a) => a.pause()); } catch { /* no WAAPI */ }
    const rows = [...r.rows, { key: j.key, display: j.display, prior: j.prior, typed: text.trim().slice(0, 48) }];
    persist({ ...r, rows });
    const band = bandFor(j.prior);
    setReveal({ band, display: j.display });
    setMsg('');
    sndWordAccepted(Math.round(j.prior / 20));
    requestAnimationFrame(() => kitPlay(stampRef.current, STAMP, { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' }));
    advance(rows);
  };

  // a resumed, unfinished day whose remaining prompts were all interrupted: close it out
  useEffect(() => {
    if (phase === 'cover' && run.rows.length >= PROMPTS && !run.done) finish(run.rows);
  }, [phase, run, finish]);

  // results revisit: refresh the percentages (or send a day whose submit never landed)
  useEffect(() => {
    if (phase !== 'results' || !runRef.current.done || finishedHere.current) return;
    let live = true;
    const r = runRef.current;
    const keys = r.rows.map((x) => x.key || '');
    (r.sent ? fetchTallies(today.dateKey, keys) : submitDay(today.dateKey, keys)).then((t) => {
      if (!live || !t) return;
      persist({ ...runRef.current, sent: true, tallies: t });
    });
    return () => { live = false; };
    // once per entry into results
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---------------------------------------------------------------- render
  const exitBtn = (
    <button type="button" className="dbz-exit" onClick={() => { clearTimers(); onExit && onExit(); }} aria-label="Back to the menu">
      ← MENU
    </button>
  );

  if (phase === 'cover') {
    const resumed = run.rows.length > 0;
    return (
      <div className="dbz" data-testid="daily-blitz" data-phase="cover">
        <div className="dbz-top">{exitBtn}<span className="dbz-right"><span className="dbz-day">#{today.day}</span>{audioSlot}</span></div>
        <div className="dbz-cover">
          <img className="dbz-brain" src="/cards/cb-hero.webp" alt="" aria-hidden="true" draggable="false" />
          <h1 className="dbz-title"><span>DAILY</span><span>BLITZ</span></h1>
          <ul className="dbz-rules">
            <li><b>6</b> PROMPTS · <b>20s</b> EACH · <b>ONE</b> ANSWER</li>
            <li>THE <b className="is-gold">RARER</b> YOUR ANSWER, THE MORE IT SCORES</li>
            <li>SAME PROMPTS FOR EVERYONE TODAY</li>
          </ul>
          {streak > 0 ? <p className="dbz-streakline">🔥 {streak}-DAY STREAK — KEEP IT GOING</p> : null}
          <button type="button" className="dbz-go" data-testid="daily-blitz-start" disabled={!data && !loadErr}
            onClick={() => { track('daily_blitz_start', { day: today.day, resumed }); begin(run.rows.length); }}>
            {resumed ? `CONTINUE (${run.rows.length}/${PROMPTS})` : data || loadErr ? 'START' : 'LOADING…'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'play') {
    return (
      <div className="dbz" data-testid="daily-blitz" data-phase="play">
        <div className="dbz-top">
          {exitBtn}
          <span className="dbz-prog" aria-label={`Prompt ${shown + 1} of ${PROMPTS}`}>
            {Array.from({ length: PROMPTS }, (_, i) => {
              const row = run.rows[i];
              const cls = row ? (row.key ? `is-${bandFor(row.prior).id}` : 'is-miss') : i === shown ? 'is-now' : '';
              return <i key={i} className={cls} />;
            })}
          </span>
          <span className="dbz-right"><span className="dbz-day">#{today.day}</span>{audioSlot}</span>
        </div>
        <div className="dbz-clock" aria-hidden="true"><div ref={fillRef} className="dbz-clock-fill" /></div>
        <div ref={cardRef} className="dbz-card">
          <div className="dbz-tier">{TIER_LABEL[shown]} · {shown + 1}/{PROMPTS}</div>
          <h2 className="dbz-cat" data-testid="daily-blitz-prompt">{catName}</h2>
          <p className="dbz-ask">NAME ONE — THE RARER, THE BETTER</p>
          <div className={`dbz-secs${secs <= 5 ? ' is-low' : ''}`} aria-live="off">{secs}</div>
          {reveal ? (
            <div ref={stampRef} className={`dbz-stamp${reveal.miss ? ' is-miss' : ''}`} style={reveal.band ? { '--band': reveal.band.color } : undefined} role="status">
              {reveal.miss ? 'TIME!' : <><span className="dbz-stamp-k">{reveal.band.name}</span><span className="dbz-stamp-w">{reveal.display}</span></>}
            </div>
          ) : null}
        </div>
        <form className="dbz-form" onSubmit={submit}>
          <input
            ref={inputRef}
            className="dbz-input"
            data-testid="daily-blitz-input"
            value={text}
            onChange={(e) => { setText(e.target.value); if (msg) setMsg(''); }}
            placeholder={cat ? 'TYPE AN ANSWER' : 'LOADING…'}
            maxLength={48}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            disabled={!!reveal}
            aria-label={`Answer for ${catName}`}
          />
          <button type="submit" className="dbz-send" disabled={!!reveal || !cat}>GO</button>
        </form>
        <p className="dbz-msg" role="alert">{msg}</p>
      </div>
    );
  }

  // ---- RESULTS ----
  const scored = scoreDay(run.rows, run.tallies);
  const points = Array.isArray(run.points) && run.points.length === PROMPTS ? run.points : scored.rows.map((r) => r.points);
  const rows = scored.rows.map((r, i) => ({ ...r, points: points[i], band: bandFor(points[i]) }));
  const total = Number.isFinite(run.total) ? run.total : rows.reduce((s, r) => s + r.points, 0);
  let rarest = -1;
  rows.forEach((r, i) => { if (r.points > 0 && (rarest < 0 || r.points > rows[rarest].points)) rarest = i; });
  const plays = run.tallies ? run.tallies.plays : 0;
  const shareText = buildShareText({ dayNumber: today.day, rows, total, streak, origin: typeof window !== 'undefined' ? window.location.origin : undefined });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setShareNote('COPIED!');
    } catch {
      setShareNote('COPY FAILED — HOLD TO SELECT');
    }
    track('daily_blitz_share', { day: today.day, method: 'copy' });
  };
  const share = async () => {
    track('daily_blitz_share', { day: today.day, method: 'share' });
    try {
      if (navigator.share) {
        let files = null;
        try {
          const { renderShareImage } = await import('./shareImage.js');
          const blob = await renderShareImage({ dayNumber: today.day, rows, total, streak, origin: window.location.origin });
          if (blob) {
            const f = new File([blob], `daily-blitz-${today.day}.png`, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [f] })) files = [f];
          }
        } catch { /* no image — share the text alone */ }
        await navigator.share(files ? { text: shareText, files } : { text: shareText });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return; // closed the sheet
    }
    copy();
  };

  return (
    <div className="dbz is-results" data-testid="daily-blitz" data-phase="results">
      <div className="dbz-top">{exitBtn}<span className="dbz-day"><span className="dbz-day-k">DAILY BLITZ </span>#{today.day}</span>
        <span className="dbz-right">
          {streak > 0 ? <span className="dbz-streak" aria-label={`${streak} day streak`}><img src="/cast/props/flame.webp" alt="" width="28" height="28" />{streak}</span> : null}
          {audioSlot}
        </span>
      </div>
      <div className="dbz-score">
        <span className="dbz-total" data-testid="daily-blitz-total">{formatNum(total)}</span>
        <span className="dbz-max">/{PROMPTS * MAX_POINTS}</span>
      </div>
      <p className="dbz-rarest">
        {rarest >= 0 ? (
          <>RAREST: <b style={{ color: rows[rarest].band.color }}>{rows[rarest].display}</b>
            {rows[rarest].pct != null ? <> — ONLY {formatPct(rows[rarest].pct)} SAID IT</> : <> — {rows[rarest].band.name}</>}</>
        ) : 'NO ANSWERS TODAY — TOMORROW IS A NEW BOARD'}
      </p>
      <ol className="dbz-rows" data-testid="daily-blitz-rows">
        {rows.map((r, i) => {
          const t = run.tallies && run.tallies.prompts[i];
          const c = data ? data.cats[today.prompts[i]] : null;
          const top = t && c ? t.top.map(([k, n]) => [displayFor(c, k), n]).filter(([d]) => d).slice(0, 2) : [];
          return (
            <li key={i} className={`dbz-row is-${r.band.id}${i === rarest ? ' is-rarest' : ''}`} style={{ '--band': r.band.color }}>
              <i className="dbz-sq" aria-hidden="true" />
              <span className="dbz-row-main">
                <span className="dbz-row-cat">{today.prompts[i]}</span>
                <span className="dbz-row-ans">{r.key ? r.display : '—'}</span>
              </span>
              <span className="dbz-row-side">
                <b className="dbz-row-pts">{formatNum(r.points)}</b>
                <span className="dbz-row-pct">{r.pct != null ? `${formatPct(r.pct)} SAID IT` : r.band.name}</span>
              </span>
              {top.length ? (
                <span className="dbz-row-top">MOST SAID: {top.map(([d, n]) => `${d} ${formatPct(plays ? n / plays : 0)}`).join(' · ')}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className="dbz-share">
        <button type="button" className="dbz-go" data-testid="daily-blitz-share" onClick={share}>SHARE</button>
        <button type="button" className="dbz-copy" data-testid="daily-blitz-copy" onClick={copy}>COPY</button>
      </div>
      <p className="dbz-foot" role="status">{shareNote || `${plays ? `${plays} PLAYED TODAY · ` : ''}NEW PROMPTS IN ${formatLeft(msToMidnight())}`}</p>
    </div>
  );
}
