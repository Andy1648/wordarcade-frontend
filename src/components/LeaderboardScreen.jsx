// LeaderboardScreen.jsx — STEP 24, the global board (Andy A13: no Google sign-in, username only,
// block bad names).
//
// One overlay, two jobs: CLAIM a name (if this browser has none) and SHOW the board: rank, username,
// level + rebirth stars, lifetime words, WINS/WORD. The claim form gives the client filter's verdict
// instantly and asks the server (lb_name_status) for "taken" after a 350 ms pause; the server is
// what actually refuses a name (DB trigger + lb_claim), so a bypassed client can't put one on the
// board. Moderation beyond that is Andy editing rows in the Supabase Table Editor.
import { useEffect, useRef, useState } from 'react';
import {
  LEADERBOARD_ENABLED,
  claimName,
  fetchBoard,
  fetchWeekly,
  weekResetInMs,
  formatResetIn,
  getMyProfile,
  myStats,
  nameStatus,
  submitStats,
  setLastRank,
  setRankNews,
  boardCaps,
  getSecret,
  adoptRecoveryCode,
  rankMoveSinceSeen,
  clearRankFrom,
  markBoardSeen,
} from '../leaderboard/client.js';
import { targetLine } from '../leaderboard/boardTarget.js';
import { formatRecoveryCode } from '../save/cloudSave.js';
import { nameVerdict } from '../leaderboard/nameFilter.js';
import './LeaderboardScreen.css';
import PodiumIcon from './PodiumIcon';
import { formatNum, formatRate } from '../format';

const VERDICT_COPY = {
  shape: '3–16 LETTERS, NUMBERS OR _',
  blocked: 'NOT THAT ONE. PICK ANOTHER NAME.',
  taken: 'TAKEN. TRY ANOTHER.',
  ok: 'NICE. THAT ONE’S FREE.',
  checking: 'CHECKING…',
};
const ERROR_COPY = {
  username_taken: 'SOMEONE JUST TOOK THAT ONE.',
  username_blocked: 'NOT THAT ONE. PICK ANOTHER NAME.',
  username_shape: '3–16 LETTERS, NUMBERS OR _',
  unavailable: 'THE BOARD IS OFFLINE RIGHT NOW.',
  rate_limited: 'TOO MANY NEW NAMES FROM HERE. TRY LATER.',
  rename_cooldown: 'ONE NAME CHANGE PER DAY. TRY TOMORROW.',
};

// STEP 47: a board under this many rows is padded with invitations, never fake players.
export const MIN_ROWS = 10;

// STEP 51 (Andy oct2): no rebirth stars — the REBIRTH TIER is the name's colour and frame.
// R0 plain white · R1-2 cyan · R3-4 yellow · R5-9 orange · R10-19 pink · R20+ purple, framed.
export const REBIRTH_TIERS = [
  { min: 0, name: 'R0', colour: '#ffffff', frame: false },
  { min: 1, name: 'REBORN', colour: '#2EFFE0', frame: false },
  { min: 3, name: 'TWICE-BORN', colour: '#FFE94A', frame: false },
  { min: 5, name: 'PHOENIX', colour: '#FF6B3D', frame: true },
  { min: 10, name: 'ETERNAL', colour: '#FF4FA3', frame: true },
  { min: 20, name: 'ASCENDED', colour: '#C58BFF', frame: true },
];
export function rebirthTier(n) {
  const r = Math.max(0, Math.floor(Number(n) || 0));
  let t = REBIRTH_TIERS[0];
  for (const x of REBIRTH_TIERS) if (r >= x.min) t = x;
  return t;
}
function NameTag({ name, rebirths }) {
  const t = rebirthTier(rebirths);
  return (
    <span
      className={`lb-name${t.frame ? ' is-framed' : ''}`}
      style={{ color: t.colour, '--rb': t.colour }}
      title={rebirths > 0 ? `${rebirths} rebirth${rebirths === 1 ? '' : 's'} — ${t.name}` : undefined}
    >
      {name}
    </span>
  );
}

// ONE number format app-wide (Andy oct2 evening E2): the old private fmtRate only knew K, so a
// 1e9 wins/word read "1000000.0K". format.js names every tier (K M B T … to 1e306).
const fmt = (n) => formatNum(Number(n) || 0);
const fmtRate = (n) => formatRate(Number(n) || 0);


// H2a: the ▲N chip on your own row when you climbed since you last opened the board. It pops in
// (finite, transform/opacity) as the row lands; reduced motion = the static chip.
function MoveChip({ move }) {
  if (!move || !(move.from > move.to)) return null;
  const n = move.from - move.to;
  return <span className="lb-move" aria-label={`up ${n} place${n === 1 ? '' : 's'} since you last looked`}>▲{n}</span>;
}

function Row({ row, mine, flash, move }) {
  const top = row.rank <= 3 ? ` is-top${row.rank}` : '';
  return (
    <li className={`lb-row${top}${mine ? ' is-me' : ''}${mine && flash ? ' is-flash' : ''}`} data-rank={row.rank}>
      <span className="lb-rank">{row.rank}</span>
      <span className="lb-who">
        <span className="lb-name-line">
          <NameTag name={row.username} rebirths={row.rebirths} />
          {mine && <span className="lb-you-badge">YOU</span>}
          {mine && <MoveChip move={move} />}
        </span>
        {/* words are SECONDARY now (Andy oct2, later: the board ranks by LEVEL) */}
        <span className="lb-lv lb-words-sub">{fmt(row.lifetime_words)} WORDS</span>
      </span>
      {/* LV is the headline — the board ranks by LEVEL only (rebirth is just the name's colour). */}
      <span className="lb-num lb-level">LV {fmt(row.level)}</span>
      <span className="lb-num lb-rate">{Number(row.lifetime_words) > 0 ? fmtRate(row.wins_per_word) : '—'}</span>
    </li>
  );
}

// BB3: a THIS WEEK row — words typed this ET week are the number; the level is the small line.
function WeekRow({ row, mine }) {
  const top = row.rank <= 3 ? ` is-top${row.rank}` : '';
  return (
    <li className={`lb-row lb-row--week${top}${mine ? ' is-me' : ''}`} data-rank={row.rank}>
      <span className="lb-rank">{row.rank}</span>
      <span className="lb-who">
        <span className="lb-name-line">
          <NameTag name={row.username} rebirths={row.rebirths} />
          {mine && <span className="lb-you-badge">YOU</span>}
        </span>
        <span className="lb-lv lb-words-sub">LV {fmt(row.level)}</span>
      </span>
      <span className="lb-num lb-level lb-week-words">{fmt(row.week_words)}</span>
    </li>
  );
}

export default function LeaderboardScreen({ onBack }) {
  const [board, setBoard] = useState({ rows: [], me: null });
  const [loading, setLoading] = useState(LEADERBOARD_ENABLED);
  const [loadError, setLoadError] = useState(false);
  const [profile, setProfile] = useState(() => getMyProfile());
  const [editing, setEditing] = useState(() => !getMyProfile());
  const [draft, setDraft] = useState('');
  const [verdict, setVerdict] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState(null);
  const [flash, setFlash] = useState(false);
  const [caps, setCaps] = useState({ letters: false, cjk: false, cloud: false });
  // STEP 52: the recovery code is shown ONCE, right after a claim (and on demand after that).
  const [showCode, setShowCode] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreDraft, setRestoreDraft] = useState('');
  const [restoreMsg, setRestoreMsg] = useState(null);
  const overlayRef = useRef(null);
  const bodyRef = useRef(null);
  // H2a: the rank move since the board was last opened (read once per visit) and whether the slide has
  // already played this visit (a tab switch back to ALL-TIME must not replay it).
  const [move, setMove] = useState(null);
  const movedRef = useRef(false);
  const slidRef = useRef(false);
  // H2a: your row scrolled out of the board's view → a pin strip at the panel foot (outside the
  // scroller, so it takes its own space and never covers a row).
  const [meHidden, setMeHidden] = useState(false);
  // BB3: ALL-TIME (level) or THIS WEEK (words typed this ET week; resets Monday 00:00 ET
  // in the DB). The switch exists only once 013_weekly_board.sql is applied (lb_caps.weekly).
  const [view, setView] = useState('all');
  const [week, setWeek] = useState({ rows: [], me: null, loaded: false, error: false });
  useEffect(() => {
    let live = true;
    boardCaps().then((c) => { if (live) setCaps(c); });
    return () => { live = false; };
  }, []);
  async function openWeek() {
    setView('week');
    try {
      const w = await fetchWeekly();
      setWeek({ ...w, loaded: true, error: false });
    } catch {
      setWeek((w) => ({ ...w, loaded: true, error: true }));
    }
  }

  async function load() {
    if (!LEADERBOARD_ENABLED) return;
    setLoading(true);
    try {
      await submitStats();
      const b = await fetchBoard();
      setBoard(b);
      setLoadError(false);
      // Reading the board is reading the news: clear the trophy badge and remember this rank as
      // the baseline the next rank-up is measured from.
      const mine = getMyProfile();
      const meNow = mine && (b.rows.find((r) => r.id === mine.id) || b.me);
      // H2a: read the move BEFORE the baseline is overwritten (only the first load of this visit).
      if (meNow && !movedRef.current) {
        movedRef.current = true;
        setMove(rankMoveSinceSeen(Number(meNow.rank)));
      }
      setRankNews(false);
      clearRankFrom();
      if (meNow) setLastRank(Number(meNow.rank));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    markBoardSeen(); // any entry route: a menu rank check still in flight must not write after this
    load();
    if (overlayRef.current) overlayRef.current.focus();
    const onKey = (e) => { if (e.key === 'Escape') onBack && onBack(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // H2a RANK-CHANGE ANIMATION — once per visit. Your row is first brought into the board's view with
  // room under it (one scrollTop write), then rises from where you were — capped to the VISIBLE room
  // below it, so the whole slide happens on screen — and the ▲N chip pops as it lands. Translate only
  // (no scale on a full-width row), WAAPI, will-change set for the run and cleared on finish. Measured
  // ONCE here (offsetTop/offsetHeight/clientHeight), never per frame. Reduced motion: no slide, no
  // pop — the static ▲N chip says it.
  useEffect(() => {
    if (!move || view !== 'all' || slidRef.current) return undefined;
    const root = overlayRef.current;
    const body = bodyRef.current;
    const el = root && root.querySelector('.lb-row.is-me');
    if (!el || !body || typeof el.animate !== 'function') return undefined;
    slidRef.current = true;
    let reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* old browser */ }
    if (reduced) return undefined;
    const h = el.offsetHeight;
    const sib = el.previousElementSibling || el.nextElementSibling;
    const pitch = (sib && Math.abs(sib.offsetTop - el.offsetTop)) || h + 6;
    const top = el.offsetTop; // .lb-body is the offset parent (position: relative)
    const viewH = body.clientHeight;
    if (top + h > body.scrollTop + viewH) body.scrollTop = Math.max(0, top - viewH * 0.45);
    const room = body.scrollTop + viewH - (top + h) - 4;
    const d = Math.max(0, Math.min((move.from - move.to) * pitch, room));
    const delay = 280; // after the panel's 260 ms entrance
    const rows = Math.max(1, Math.round(d / pitch));
    const dur = 460 + Math.min(rows, 6) * 50;
    let run = null;
    if (d >= 8) {
      el.style.willChange = 'transform';
      run = el.animate(
        [
          { transform: `translateY(${Math.round(d)}px)` },
          { transform: 'translateY(-4px)', offset: 0.8 },
          { transform: 'none' },
        ],
        { duration: dur, delay, easing: 'cubic-bezier(0.22, 0.9, 0.3, 1)', fill: 'backwards' },
      );
      run.onfinish = () => { el.style.willChange = ''; };
    }
    const chips = [el.querySelector('.lb-move'), root.querySelector('.lb-hero-move')].filter(Boolean);
    const pops = chips.map((c) => {
      c.style.willChange = 'transform, opacity';
      const a = c.animate(
        [
          { transform: 'scale(0.2) rotate(-12deg)', opacity: 0 },
          { transform: 'scale(1.35) rotate(4deg)', opacity: 1, offset: 0.6 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 340, delay: run ? delay + dur - 140 : delay, easing: 'cubic-bezier(0.34, 1.5, 0.64, 1)', fill: 'backwards' },
      );
      a.onfinish = () => { c.style.willChange = ''; };
      return a;
    });
    return () => {
      if (run) run.cancel();
      pops.forEach((a) => a.cancel());
      el.style.willChange = '';
      chips.forEach((c) => { c.style.willChange = ''; });
    };
  }, [move, view]);

  // H2a PIN: watch your row against the board's scroll box. IntersectionObserver, so nothing is
  // measured on scroll; the pin only exists while your row is (mostly) out of view.
  useEffect(() => {
    const root = overlayRef.current;
    const body = bodyRef.current;
    const el = root && root.querySelector('.lb-row.is-me');
    if (!el || !body || typeof IntersectionObserver !== 'function') { setMeHidden(false); return undefined; }
    const io = new IntersectionObserver(([e]) => setMeHidden(e.intersectionRatio < 0.6), { root: body, threshold: [0, 0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [board, week, view, profile, editing]);

  function showMe() {
    const el = overlayRef.current && overlayRef.current.querySelector('.lb-row.is-me');
    if (!el) return;
    let reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* old browser */ }
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
  }

  // Instant client verdict; the server's "taken" after a short pause.
  useEffect(() => {
    if (!draft) { setVerdict(null); return undefined; }
    const local = nameVerdict(draft, { cjk: caps.cjk });
    if (local !== 'ok') { setVerdict(local); return undefined; }
    if (profile && draft.toLowerCase() === profile.username.toLowerCase()) { setVerdict('ok'); return undefined; }
    setVerdict('checking');
    let live = true;
    const t = setTimeout(() => {
      nameStatus(draft).then((v) => { if (live) setVerdict(v); }).catch(() => { if (live) setVerdict('ok'); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [draft, profile, caps.cjk]);

  async function claim(e) {
    e.preventDefault();
    if (claiming || verdict !== 'ok') return;
    setClaiming(true);
    setClaimError(null);
    try {
      const row = await claimName(draft);
      setProfile({ id: row.id, username: row.username });
      setEditing(false);
      setDraft('');
      setFlash(true);
      setTimeout(() => setFlash(false), 900);
      if (caps.cloud) setShowCode(true);
      setBoard(await fetchBoard());
    } catch (err) {
      setClaimError(ERROR_COPY[err.code] || 'COULDN’T SAVE THAT. TRY AGAIN.');
      if (err.code === 'username_taken') setVerdict('taken');
      if (err.code === 'username_blocked') setVerdict('blocked');
    } finally {
      setClaiming(false);
    }
  }

  const stats = myStats();
  const meRow = profile && (board.rows.find((r) => r.id === profile.id) || board.me);
  const weekMe = profile && (week.rows.find((r) => r.id === profile.id) || week.me);
  const heroMove = move && move.from > move.to ? move.from - move.to : 0;
  const pinRow = view === 'week' ? weekMe : meRow;
  const longTarget = view === 'all' && meRow ? targetLine(board.rows, meRow) : '';
  const shortTarget = view === 'all' && meRow ? targetLine(board.rows, meRow, { short: true }) : '';

  return (
    <div className="lb-overlay" role="dialog" aria-modal="true" aria-label="Leaderboard" tabIndex={-1} ref={overlayRef}>
      <div className="lb-panel">
        <div className="lb-header">
          {/* the menu's podium glyph, wearing your rank on this board — one symbol for the leaderboard */}
          <span className="lb-title-wrap">
            <PodiumIcon rank={meRow ? Number(meRow.rank) : null} className="lb-head-podium" />
            <h2 className="lb-title">LEADERBOARD</h2>
          </span>
          <button type="button" className="lb-close" onClick={onBack} aria-label="Back to menu">✕</button>
        </div>

        <div className="lb-body" ref={bodyRef}>
          {!LEADERBOARD_ENABLED && <p className="lb-note">THE BOARD IS OFFLINE RIGHT NOW.</p>}
          {/* H2a SPLIT: your card (the hero) in a side column beside the list from 900px up; below that
              the hero collapses to a one-line strip above the list. */}
          <div className="lb-side">

          {LEADERBOARD_ENABLED && (editing ? (
            <form className="lb-claim" onSubmit={claim} noValidate>
              <label className="lb-claim-label" htmlFor="lb-name-input">
                {profile ? 'NEW NAME' : 'CLAIM YOUR NAME'}
              </label>
              <div className="lb-claim-row">
                <input
                  id="lb-name-input"
                  className="lb-claim-input"
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value.replace(/\s/g, '_').slice(0, 16)); setClaimError(null); }}
                  lang={caps.cjk ? 'zh' : undefined}
                  maxLength={16}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  enterKeyHint="done"
                  placeholder="YOUR_NAME"
                  aria-describedby="lb-claim-verdict"
                />
                <button type="submit" className="lb-claim-btn" disabled={claiming || verdict !== 'ok'}>
                  {claiming ? '…' : 'CLAIM'}
                </button>
              </div>
              <p id="lb-claim-verdict" className={`lb-verdict is-${claimError ? 'blocked' : verdict || 'idle'}`} aria-live="polite">
                {claimError || (verdict === 'shape' && caps.cjk ? '3–16 LETTERS, NUMBERS OR _ · 中文 2–12 字' : verdict ? VERDICT_COPY[verdict] : 'NO SIGN-IN. JUST A NAME.')}
              </p>
              {profile && (
                <button type="button" className="lb-link-btn" onClick={() => { setEditing(false); setDraft(''); setClaimError(null); }}>
                  KEEP {profile.username}
                </button>
              )}
            </form>
          ) : (
            <div className="lb-you lb-hero">
              <span className="lb-hero-label">YOUR RANK</span>
              {/* the rank line: on a phone this IS the strip — "#9 ▲3 · 58 LV TO #8" */}
              <span className="lb-hero-line">
                {/* the rank of the board you are LOOKING at — THIS WEEK shows your weekly place */}
                <span className="lb-you-rank">
                  {/* no place yet: a line, not a giant dash in the hero's numeral slot */}
                  {view === 'week'
                    ? (weekMe ? <>#{weekMe.rank}<span className="lb-you-rank-sub"> THIS WEEK</span></> : <span className="lb-you-rank-sub">NOT ON THIS WEEK’S BOARD YET</span>)
                    : (meRow ? `#${meRow.rank}` : <span className="lb-you-rank-sub">NOT RANKED YET</span>)}
                </span>
                {view === 'all' && heroMove > 0 && (
                  <span className="lb-hero-move">▲{heroMove}<span className="lb-long"> SINCE LAST LOOK</span></span>
                )}
                {longTarget && (
                  <span className="lb-hero-target">
                    <span className="lb-long">{longTarget}</span>
                    <span className="lb-short">· {shortTarget}</span>
                  </span>
                )}
              </span>
              {view === 'all' && meRow && <span className="lb-hero-lv">LV {fmt(meRow.level)}</span>}
              <span className="lb-hero-who">
                <span className="lb-you-name">{profile.username}</span>
                {caps.cloud && (
                  <button type="button" className="lb-link-btn" onClick={() => setShowCode((v) => !v)}>
                    {showCode ? 'HIDE CODE' : 'RECOVERY CODE'}
                  </button>
                )}
                <button type="button" className="lb-link-btn" onClick={() => setEditing(true)}>CHANGE NAME</button>
              </span>
            </div>
          ))}

          {/* STEP 52 — CLOUD SAVE. The code restores this progress on any device / after a wipe. */}
          {LEADERBOARD_ENABLED && caps.cloud && profile && showCode && (
            <div className="lb-code">
              <div className="lb-code-title">YOUR RECOVERY CODE</div>
              <code className="lb-code-value">{formatRecoveryCode(getSecret())}</code>
              <div className="lb-code-note">YOUR PROGRESS IS BACKED UP. ON A NEW PHONE OR AFTER SAFARI WIPES IT, ENTER THIS CODE HERE TO GET IT BACK. KEEP IT PRIVATE.</div>
              <button
                type="button"
                className="lb-claim-btn"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(formatRecoveryCode(getSecret()));
                  } catch {
                    /* clipboard blocked */
                  }
                }}
              >
                COPY
              </button>
            </div>
          )}
          {LEADERBOARD_ENABLED && caps.cloud && !profile && (
            restoreOpen ? (
              <form
                className="lb-claim lb-restore"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setRestoreMsg('RESTORING…');
                  const r = await adoptRecoveryCode(restoreDraft);
                  if (!r.ok) {
                    setRestoreMsg(r.error === 'bad_code' ? 'THAT CODE IS 12 GROUPS OF 4.' : 'NO SAVE FOR THAT CODE.');
                    return;
                  }
                  setRestoreMsg(r.restored ? 'RESTORED — RELOADING…' : `WELCOME BACK, ${r.username || ''}`);
                  setTimeout(() => window.location.reload(), 900);
                }}
              >
                <label className="lb-claim-label" htmlFor="lb-restore-input">RECOVERY CODE</label>
                <div className="lb-claim-row">
                  <input
                    id="lb-restore-input"
                    className="lb-claim-input"
                    value={restoreDraft}
                    onChange={(e) => setRestoreDraft(e.target.value.slice(0, 80))}
                    autoComplete="off"
                    spellCheck="false"
                    placeholder="XXXX-XXXX-…"
                  />
                  <button type="submit" className="lb-claim-btn">RESTORE</button>
                </div>
                {restoreMsg && <p className="lb-verdict" aria-live="polite">{restoreMsg}</p>}
              </form>
            ) : (
              <button type="button" className="lb-link-btn lb-restore-open" onClick={() => setRestoreOpen(true)}>
                HAVE A RECOVERY CODE?
              </button>
            )
          )}

          </div>
          <div className="lb-main">
          {LEADERBOARD_ENABLED && caps.weekly && (
            <div className="lb-tabs" role="tablist" aria-label="Board">
              <button type="button" role="tab" aria-selected={view === 'all'} className={`lb-tab${view === 'all' ? ' is-on' : ''}`} onClick={() => setView('all')}>ALL-TIME</button>
              <button type="button" role="tab" aria-selected={view === 'week'} className={`lb-tab${view === 'week' ? ' is-on' : ''}`} onClick={openWeek}>THIS WEEK</button>
            </div>
          )}
          {LEADERBOARD_ENABLED && view === 'week' && (
            <>
              <div className="lb-cols lb-cols--week" aria-hidden="true">
                <span>#</span><span>PLAYER</span><span className="lb-num">WORDS THIS WEEK</span>
              </div>
              {!week.loaded && <p className="lb-note">LOADING THIS WEEK…</p>}
              {week.error && <p className="lb-note">COULDN’T LOAD THIS WEEK. <button type="button" className="lb-link-btn" onClick={openWeek}>RETRY</button></p>}
              {week.loaded && !week.error && week.rows.length === 0 && <p className="lb-note">NOBODY HAS TYPED THIS WEEK YET. BE FIRST.</p>}
              <ol className="lb-list">
                {week.rows.map((r) => <WeekRow key={r.id} row={r} mine={!!profile && r.id === profile.id} />)}
              </ol>
              {week.me && (
                <ol className="lb-list lb-list--me" aria-label="Your rank this week">
                  <WeekRow row={week.me} mine />
                </ol>
              )}
              <p className="lb-note lb-week-reset">RESETS MONDAY 00:00 ET · IN {formatResetIn(weekResetInMs())}</p>
            </>
          )}
          {LEADERBOARD_ENABLED && view === 'all' && (
            <>
              {/* fine-tune (oct2 evening): no column headers over an error with nothing under them */}
              {!(loadError && board.rows.length === 0) && (
                <div className="lb-cols" aria-hidden="true">
                  <span>#</span><span>PLAYER</span><span className="lb-num">LEVEL</span><span className="lb-num">WINS/WORD</span>
                </div>
              )}
              {loading && board.rows.length === 0 && <p className="lb-note">LOADING THE BOARD…</p>}
              {loadError && <p className="lb-note">COULDN’T LOAD THE BOARD. <button type="button" className="lb-link-btn" onClick={load}>RETRY</button></p>}
              <ol className="lb-list">
                {board.rows.map((r) => <Row key={r.id} row={r} mine={!!profile && r.id === profile.id} flash={flash} move={move} />)}
                {/* NEVER A DEAD BOARD: open places are invitations, numbered, never invented people.
                    For an unclaimed viewer the first one is a button into the claim field. */}
                {!loading && !loadError && Array.from({ length: Math.max(0, MIN_ROWS - board.rows.length) }, (_, i) => {
                  const n = board.rows.length + i + 1;
                  const first = !profile; // every open place is a way in for an unclaimed viewer
                  return (
                    <li key={`slot-${n}`} className={`lb-slot${first && i === 0 ? ' is-open' : ''}`} data-rank={n}>
                      <span className="lb-rank">{n}</span>
                      {first ? (
                        <button type="button" className="lb-slot-btn" onClick={() => { setEditing(true); const el = document.getElementById('lb-name-input'); if (el) el.focus(); }}>
                          YOUR NAME HERE?
                        </button>
                      ) : (
                        <span className="lb-slot-text">YOUR NAME HERE?</span>
                      )}
                    </li>
                  );
                })}
              </ol>
              {board.me && (
                <ol className="lb-list lb-list--me" aria-label="Your rank">
                  <Row row={board.me} mine flash={flash} move={move} />
                </ol>
              )}
              {!profile && (
                <p className="lb-note lb-preview">
                  YOU'D SHOW AS LV {fmt(stats.level)} · {fmt(stats.lifetimeWords)} WORDS
                </p>
              )}
            </>
          )}
          </div>
        </div>
        {LEADERBOARD_ENABLED && profile && pinRow && meHidden && (
          <button type="button" className="lb-pin-btn" onClick={showMe} aria-label={`You are #${pinRow.rank}. Show my row`}>
            <span className="lb-pin-rank">#{pinRow.rank}</span>
            <span className="lb-pin-name">{profile.username}</span>
            {view === 'all' && heroMove > 0 && <span className="lb-pin-move">▲{heroMove}</span>}
            <span className="lb-pin-go">SHOW ME ▼</span>
          </button>
        )}
      </div>
    </div>
  );
}
