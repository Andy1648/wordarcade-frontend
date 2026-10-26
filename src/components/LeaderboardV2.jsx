// LeaderboardV2.jsx — THE v2 LEADERBOARD (claude/mockups/v2/Leaderboard.dc.html; SEASON2 only, P8).
//
// LAZY, its own chunk: LeaderboardScreen renders it in place of the live board only while the SEASON2 flag is on and a
// name is claimed (claiming / renaming stays on the live screen's form). Live players see no change until the flip.
//   * ALL TIME reads the season-2 board (client.fetchBoard → public.leaderboard_s2, 022: ★ → rebirths → level).
//   * THIS WEEK reads public.leaderboard_s2_weekly (024: ★ / rebirths / levels GAINED this ET week); until 024 runs it
//     falls back to the live weekly view filtered to season-2 rows (words this week).
//   * a WHITE PODIUM for the top 3 (vector blocks, the crown on #1), then ranks 4 … 10 in rows.
//   * every name wears its v3 RANK plate (INKLING … ENDGAME — by rebirths, then ★; s2Board.rankPlate).
//   * ▲▼ = the place each player held the last time this browser looked at the same tab (a snapshot under taw.s2.).
//   * YOUR row is lifted and pulses (a FINITE pulse when the board lands / the tab changes) — wherever you are: on the
//     podium (top 3), in the list, or pinned under it with your real rank when you are past #10.
//   * CHASE (what passes the player above, in the board's order) and CLIMB (what reaches your next rank).
// Motion: kit one-shots (transform / opacity; will-change only while playing); NOTHING loops at rest (the mockup's
// crown wobble / ▲ bob / ▼ sink / own-row pulse play once on arrival); REDUCE MOTION plays none of it.
import { Fragment, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './kit/tokens.css';
import './LeaderboardV2.css';
import { kitPlay } from './kit/motion.js';
import { KitRankPlate } from './kit/KitRankPlate.jsx';
import { shownPlateIndex } from '../progress/platePick';
import {
  boardCaps,
  fetchBoard,
  fetchView,
  fetchBoardCount,
  topPercent,
  getMyProfile,
  submitStats,
  setLastRank,
  setRankNews,
  clearRankFrom,
  markBoardSeen,
  weekResetInMs,
  formatResetIn,
  claimName,
  nameStatus,
  BOARD_SIZE,
  rankBand,
} from '../leaderboard/client.js';
import { nameVerdict } from '../leaderboard/nameFilter.js';
import { rankPlate, boardMoves, boardSnapshot, hasEarned } from '../leaderboard/s2Board.js';
import { useMomentHold } from '../lib/useMomentSlot';
import { formatNum } from '../format';
import CastArt from '../cast/CastArt.jsx';
import { CAST, castFor, heroById } from '../cast/cast.js';
import KitIcon from './kit/KitIcon.jsx';
import FitText from './kit/FitText.jsx';
import { weekPrize } from '../leaderboard/weekPrizes.js';
import RankSeal from '../leaderboard/RankSeal.jsx';
import { nameTier, enteredTier } from '../leaderboard/nameTier.js';
import { lazyWithReload } from '../lib/chunkReload';

const fmt = (n) => formatNum(Number(n) || 0);
// 031 LEADERBOARD PROFILES (Andy oct10): tap a row / a podium spot → that player's card (gear, BASE, POWER …). Lazy.
const ProfileCard = lazyWithReload(() => import('./ProfileCard.jsx'), 'ProfileCard');
/** Row / podium props that open a profile: a button by role, Enter / Space too. */
const peekProps = (row, open) => (row ? {
  role: 'button',
  tabIndex: 0,
  'aria-label': `${row.username}, rank ${row.rank}. Open profile`,
  onClick: () => open(row),
  onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(row); } },
} : {});
const SEEN_KEY = 'taw.s2.lbseen'; // { all: { id: rank }, week: { id: rank } } — the last look, per tab
const WEEK_COLS = 'rank,id,username,level,rebirths,stars,week_stars,week_rebirths,week_levels,week_words';

function readSeen() {
  try {
    const o = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}
function writeSeen(tab, snap) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [tab]: snap }));
  } catch {
    /* storage blocked */
  }
}

/** THIS WEEK: the season-2 weekly view (024), else the live weekly view filtered to season-2 rows (words). */
async function loadWeek() {
  try {
    const w = await fetchView('leaderboard_s2_weekly', WEEK_COLS);
    return { ...w, gains: true };
  } catch (e) {
    if (!(e && e.status === 404)) throw e;
    const w = await fetchView('leaderboard_weekly', 'rank,id,username,level,rebirths,week_words', 10, '&econ=eq.13');
    // the live view numbers every row (season 1 too): renumber the season-2 rows we got
    return { rows: w.rows.map((r, i) => ({ ...r, rank: i + 1 })), me: w.me, gains: false };
  }
}

// ---- THE PODIUM AS LAYERS (art run oct16 — Andy: the old podium "DEFINITELY does not work"; names go WITH the
// characters on a ribbon, not on the blocks). Back to front: #1's sunburst → the medal EMBLEM → the player's CAST
// member (HERO pose) → their name RIBBON → the painted BLOCK (the rank numeral sits on its laurel) → fx. All painted
// assets in public/stage/ (Gemini / ChatGPT, cut by scripts/split-sheet.py + cutout-art.py); CSS only moves them.

// WEEKLY TOP 10 (Andy oct12, migration 034): THIS WEEK's top-10 places show the gems the place pays when the week ends
function Prize({ rank, pod = false }) {
  const g = weekPrize(rank);
  if (!g) return null;
  return (
    <span className={`lb2-prize${pod ? ' is-pod' : ''}`} title={`Finish the week #${fmt(rank)}: +${fmt(g)} gems`} aria-label={`Wins ${fmt(g)} gems`}>
      <KitIcon name="gems" size={pod ? 22 : 18} shadow={1} extras={false} />
      +{fmt(g)}
    </span>
  );
}

// P9a: every name wears its SHAPED v3 plate (KitLevelUp.dc.html 03 — kit/KitRankPlate, FIT mode for a dense list).
function Plate({ row, className = '', mine = false }) {
  const base = rankPlate(row);
  // YOUR row / podium spot shows the plate you picked in SETTINGS (Andy oct8) — any rank already reached
  const p = mine ? { ...base, i: shownPlateIndex(base.i) } : base;
  return <KitRankPlate rank={p.i} fit shine={false} className={`lb2-plate ${className}`} />;
}

function Move({ n }) {
  if (n > 0) {
    return (
      <span className="lb2-mv is-up" aria-label={`up ${n}`}>
        <img className="lb2-mv-ico" src="/lb/arrow-up.webp" width="18" height="18" alt="" aria-hidden="true" draggable="false" />
        <span>{fmt(n)}</span>
      </span>
    );
  }
  if (n < 0) {
    return (
      <span className="lb2-mv is-down" aria-label={`down ${-n}`}>
        <img className="lb2-mv-ico" src="/lb/arrow-down.webp" width="18" height="18" alt="" aria-hidden="true" draggable="false" />
        <span>{fmt(-n)}</span>
      </span>
    );
  }
  // no change → nothing drawn (Andy oct8 "the leaderboard looks shit": a grey dash on every row read as filler)
  return <span className="lb2-mv is-flat" aria-label="no change" />;
}

/** The two numbers a row shows, for the tab it is on. */
function nums(row, tab, gains) {
  if (tab === 'week' && gains) {
    const st = Number(row.week_stars) || 0;
    return { r: `${st > 0 ? `+★${fmt(st)} ` : ''}+R${fmt(row.week_rebirths)}`, lv: `+${fmt(row.week_levels)}` };
  }
  if (tab === 'week') return { r: `R${fmt(row.rebirths)}`, lv: fmt(row.week_words) };
  // 028: a row that has earned nothing in season 2 keeps its old place and shows "—" for every stat
  if (!hasEarned(row)) return { r: '—', lv: '—' };
  const st = Number(row.stars) || 0;
  return { r: `${st > 0 ? `★${fmt(st)} ` : ''}R${fmt(row.rebirths)}`, lv: fmt(row.level) };
}
/** The 1366×657 mockup fit to the window (measured on mount / resize only). */
function useStageScale(ref) {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1000); // Andy oct14: tablets + narrow laptops take the stacked layout (was < 700 — a 1280/1366 stage squeezed or shrunk to 0.6)
  useLayoutEffect(() => {
    const set = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const k = w >= 1000 ? Math.max(0.6, Math.min(1.7, Math.min((w - 8) / 1366, h / 657))) : 1;
      if (ref.current) ref.current.style.setProperty('--lb2-k', k.toFixed(4));
      setNarrow(w < 1000);
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, [ref]);
  return narrow;
}

const SLIDE = [{ transform: 'translateX(40px)', opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }];
const FILL = [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }];
const BOB = [{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)', offset: 0.5 }, { transform: 'translateY(0)' }];
// TOP 3 CELEBRATION (Andy oct12 "make the people feel good for being top 3"): one-shots on arrival, motion only on
// existing art — a medal-tinted burst ring behind each place, the painted win burst behind #1, the name slams in, the
// place number pops. Nothing loops. (oct18 Andy: the confetti throw "looks horrendous" — removed.)
const POPN = [{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.22)', opacity: 1, offset: 0.55 }, { transform: 'scale(1)', opacity: 1 }];
// TOP 3 IDLE (Andy oct12 "at least give some idle animation for the top 3"): ONE setTimeout chain for the podium — every
// IDLE_EVERY_MS the next place (#1 → #2 → #3) plays one finite beat: its character moves (BEATS), a sparkle glints.
// Hidden tab skipped; reduced motion never starts it (kitPlay is a no-op then too). No CSS loop, nothing infinite.
// PER-CHARACTER IDLE: each cast member's squash-and-stretch breath (cast.js CAST_BEATS — shared with the menu showcase);
// (oct17: #1's crown removed — Andy: it "doesn't match well at all" with the painted cast.)
// THE ENTRANCE (art run oct16), one sequenced one-shot per column: the blocks rise 2 → 1 → 3, each emblem spins in
// on its block, the character drops and squash-lands, the ribbon unrolls. Every
// effect is transform / opacity and ends before 2.5 s (the e2e asserts nothing but the idle beat runs at 2.6 s); the
// drops start only a short way up (-18%) so no frame ever leaves the screen — #1 stands near the top on a short
// window, and CI's slower runner measured it mid-drop at -38% above the viewport (the e2e measures mid-entrance too).
const BLOCK_AT = { 2: 0, 1: 140, 3: 280 }; // ms: rise order 2-1-3
const BLOCK_RISE = [{ transform: 'translateY(70%) scaleY(.7)', opacity: 0 }, { transform: 'translateY(-4%) scaleY(1.04)', opacity: 1, offset: 0.7 }, { transform: 'translateY(0) scaleY(1)', opacity: 1 }];
const DROP = [
  { transform: 'translateY(-18%) scale(.9, 1.1)', opacity: 0 },
  { transform: 'translateY(-16%) scale(.94, 1.08)', opacity: 1, offset: 0.12 },
  { transform: 'translateY(0) scale(.94, 1.08)', opacity: 1, offset: 0.55, easing: 'ease-out' },
  { transform: 'translateY(0) scale(1.2, .78)', opacity: 1, offset: 0.68 },
  { transform: 'translateY(-4%) scale(.95, 1.06)', opacity: 1, offset: 0.84 },
  { transform: 'translateY(0) scale(1, 1)', opacity: 1 },
];
// NAME PRESTIGE (Andy oct21 "make people feel even better for being top"): every top-50 name wears a painted NUMBERED
// seal (nameTier.js). On arrival each seal STAMPS down once (rows stagger top-down); the climb INTO a better tier since
// your last look gets the big slam + a NEW · TOP 10 tag on your own row. One-shots on existing nodes; nothing loops.
const STAMP = [
  { transform: 'scale(1.9) rotate(-14deg)', opacity: 0 },
  { transform: 'scale(.86) rotate(3deg)', opacity: 1, offset: 0.6 },
  { transform: 'scale(1.06) rotate(-1deg)', opacity: 1, offset: 0.82 },
  { transform: 'scale(1) rotate(0)', opacity: 1 },
];
const SLAM = [
  { transform: 'scale(1)', opacity: 1 },
  { transform: 'scale(3.2) rotate(-18deg)', opacity: 0, offset: 0.01 },
  { transform: 'scale(.78) rotate(6deg)', opacity: 1, offset: 0.45 },
  { transform: 'scale(1.18) rotate(-3deg)', opacity: 1, offset: 0.7 },
  { transform: 'scale(1) rotate(0)', opacity: 1 },
];
const TAG_IN = [{ transform: 'translateX(-14px) scale(.4)', opacity: 0 }, { transform: 'translateX(0) scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'translateX(0) scale(1)', opacity: 1 }];
const SINK = [{ transform: 'translateY(0)' }, { transform: 'translateY(3px)', offset: 0.5 }, { transform: 'translateY(0)' }];
const pulse = (base) => [{ transform: `${base} scale(1)` }, { transform: `${base} scale(1.018)`, offset: 0.5 }, { transform: `${base} scale(1)` }];

// A name's printed width in em of Bungee caps (wide W/M ~1, CJK ~1.1, the rest ~0.8) — lets a long name SHRINK to
// fit its cell (Andy oct8: "show full usernames") instead of being cut to "GREWUPALILPO…". Pure, per render.
export function nameEms(name) {
  let em = 0;
  for (const ch of String(name || '')) em += /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(ch) ? 1.1 : /[WM]/i.test(ch) ? 1.0 : 0.8;
  return Math.max(4, em);
}

const RENAME_VERDICT = {
  shape: '3–16 LETTERS, NUMBERS OR _',
  blocked: 'NOT THAT ONE. PICK ANOTHER NAME.',
  taken: 'TAKEN. TRY ANOTHER.',
  ok: 'NICE. THAT ONE’S FREE.',
  checking: 'CHECKING…',
};
const RENAME_ERROR = {
  username_taken: 'SOMEONE JUST TOOK THAT ONE.',
  username_blocked: 'NOT THAT ONE. PICK ANOTHER NAME.',
  username_shape: '3–16 LETTERS, NUMBERS OR _',
  unavailable: 'THE BOARD IS OFFLINE RIGHT NOW.',
  rate_limited: 'TOO MANY NEW NAMES FROM HERE. TRY LATER.',
  rename_cooldown: 'ONE NAME CHANGE PER DAY. TRY TOMORROW.',
};
/** The inline CHANGE NAME box: the same client verdict + server "taken" check + lb_claim the live screen used.
 *  `claim` (no name yet — Andy oct9: a fresh player sees THIS board too): the same box, worded as the first claim,
 *  and it does not grab focus (it is open on arrival, and a phone keyboard would cover the board). */
function RenameBox({ current, cjk, onDone, claim = false }) {
  const [draft, setDraft] = useState('');
  const [verdict, setVerdict] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const inputRef = useRef(null);
  useEffect(() => { if (!claim) inputRef.current?.focus(); }, [claim]);
  useEffect(() => {
    if (!draft) { setVerdict(null); return undefined; }
    const local = nameVerdict(draft, { cjk });
    if (local !== 'ok') { setVerdict(local); return undefined; }
    if (draft.toLowerCase() === String(current).toLowerCase()) { setVerdict(null); return undefined; }
    setVerdict('checking');
    let live = true;
    const t = setTimeout(() => {
      nameStatus(draft).then((v) => { if (live) setVerdict(v); }).catch(() => { if (live) setVerdict('ok'); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [draft, current, cjk]);
  async function save(e) {
    e.preventDefault();
    if (busy || verdict !== 'ok') return;
    setBusy(true);
    setErr(null);
    try {
      onDone(await claimName(draft));
    } catch (x) {
      setErr(RENAME_ERROR[x && x.code] || 'COULDN’T SAVE THAT. TRY AGAIN.');
      setBusy(false);
    }
  }
  const msg = err || (verdict ? RENAME_VERDICT[verdict] : claim ? 'NO SIGN-IN. JUST A NAME.' : 'ONE NAME CHANGE PER DAY');
  return (
    <form className={`lb2-rename${claim ? ' is-claim' : ''}`} onSubmit={save} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onDone(null); } }}>
      <label className="lb2-rename-l" htmlFor="lb2-rename-input">{claim ? 'CLAIM YOUR NAME' : 'NEW NAME'}</label>
      <div className="lb2-rename-row">
        <input
          id="lb2-rename-input"
          ref={inputRef}
          className="lb2-rename-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 16))}
          placeholder={claim ? 'YOUR_NAME' : current}
          autoComplete="off"
          spellCheck="false"
          maxLength={16}
        />
        <button type="submit" className="lb2-rename-save" disabled={busy || verdict !== 'ok'}>{busy ? '…' : claim ? 'CLAIM' : 'SAVE'}</button>
        <button type="button" className="lb2-rename-x" onClick={() => onDone(null)} aria-label="Cancel">✕</button>
      </div>
      <p className={`lb2-rename-msg${err || verdict === 'blocked' || verdict === 'taken' || verdict === 'shape' ? ' is-bad' : verdict === 'ok' ? ' is-ok' : ''}`} aria-live="polite">{msg}</p>
    </form>
  );
}

/** The closest board band above a rank: past #50 → TOP 50, #26–50 → TOP 25, #11–25 → TOP 10. */
const nearestBand = (rank) => (rank > 50 ? 50 : rank > 25 ? 25 : 10);

export default function LeaderboardV2({ onBack }) {
  useMomentHold(true); // no queued moment starts under the board
  const rootRef = useRef(null);
  const scrollRef = useRef(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const narrow = useStageScale(rootRef);
  const [profile, setProfile] = useState(() => getMyProfile());
  // CHANGE NAME lives ON this board (Andy oct8: "why does changing name show the old leaderboard? there shouldn't be
  // 2 separate leaderboards") — an inline name box under YOU, not a hop to the season-1 screen.
  // no name yet → the YOU · NO NAME · CLAIM chip is the prompt; the box opens only when tapped (Andy oct18: the box
  // opening on arrival dropped over the podium heroes — "don't auto-open the CLAIM box; the chip is enough")
  const [renaming, setRenaming] = useState(false);
  const [caps, setCaps] = useState({ weekly: false });
  const [tab, setTab] = useState('all');
  const [peek, setPeek] = useState(null); // the row whose profile card is open
  const [heroes, setHeroes] = useState({}); // 053: { profile_id: equipped hero id } for the podium
  const peekRef = useRef(null);
  peekRef.current = peek;
  const [all, setAll] = useState({ rows: [], me: null, loaded: false, error: false, moves: {} });
  const [week, setWeek] = useState({ rows: [], me: null, loaded: false, error: false, moves: {}, gains: true });

  const loadAll = useCallback(async () => {
    try {
      await submitStats();
      const [b, total] = await Promise.all([fetchBoard(), fetchBoardCount()]);
      const moves = boardMoves([...b.rows, ...(b.me ? [b.me] : [])], readSeen().all);
      writeSeen('all', boardSnapshot(b.rows, b.me));
      setAll({ ...b, total, loaded: true, error: false, moves });
      // reading the board is reading the news (as the live board): clear the badge, keep this rank as the baseline
      const mine = getMyProfile();
      const meNow = mine && (b.rows.find((r) => r.id === mine.id) || b.me);
      setRankNews(false);
      clearRankFrom();
      if (meNow) setLastRank(Number(meNow.rank));
    } catch {
      setAll((s) => ({ ...s, loaded: true, error: true }));
    }
  }, []);
  const loadWeekTab = useCallback(async () => {
    try {
      const w = await loadWeek();
      const moves = boardMoves([...w.rows, ...(w.me ? [w.me] : [])], readSeen().week);
      writeSeen('week', boardSnapshot(w.rows, w.me));
      setWeek({ ...w, loaded: true, error: false, moves });
    } catch {
      setWeek((s) => ({ ...s, loaded: true, error: true }));
    }
  }, []);

  useEffect(() => {
    markBoardSeen();
    let live = true;
    boardCaps().then((c) => { if (live) setCaps(c); });
    loadAll();
    rootRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { if (peekRef.current) setPeek(null); else onBackRef.current(); } // the card closes first
    };
    window.addEventListener('keydown', onKey);
    return () => {
      live = false;
      window.removeEventListener('keydown', onKey);
    };
  }, [loadAll]);

  const pick = (t) => {
    if (t === tab) return;
    setTab(t);
    if (t === 'week' && !week.loaded) loadWeekTab();
  };

  const data = tab === 'week' ? week : all;
  const gains = tab === 'week' ? week.gains : true;
  const myId = profile && profile.id;
  const rows = data.rows;
  const meRow = myId ? rows.find((r) => r.id === myId) || data.me : null;
  const meOnBoard = !!(meRow && rows.some((r) => r.id === myId));
  const podium = [rows[0], rows[1], rows[2]];
  const podIds = podium.map((p) => (p ? p.id : '')).join(',');
  // HEROES (053, Andy oct17 "make sure the heros shown on the leaderboard correspond to what the user actually equips"):
  // a podium player who has sent their equipped hero shows THAT hero (duplicates allowed — it's their pick). Only a player
  // with no hero on file (053 not run / an old client) falls back to three DIFFERENT id-hashed members.
  const podCast = (() => {
    const out = [null, null, null];
    const used = new Set();
    const mineAt = podium.findIndex((p) => p && myId && p.id === myId);
    if (mineAt >= 0) { out[mineAt] = castFor(myId, true); used.add(out[mineAt].id); }
    for (let i = 0; i < 3; i++) {
      const picked = !out[i] && podium[i] && heroById(heroes[podium[i].id]);
      if (picked) { out[i] = picked; used.add(picked.id); }
    }
    for (let i = 0; i < 3; i++) {
      if (out[i]) continue;
      let c = castFor(podium[i] ? podium[i].id : `open-${i + 1}`);
      for (let k = 0; used.has(c.id) && k < CAST.length; k++) c = CAST[(CAST.indexOf(c) + 1) % CAST.length];
      out[i] = c;
      used.add(c.id);
    }
    return out;
  })();
  useEffect(() => {
    const ids = podIds.split(',').filter(Boolean);
    if (!ids.length) return undefined;
    let live = true;
    import('../leaderboard/showcase.js').then((m) => m.fetchPodium(ids)).then((h) => { if (live && h) { setHeroes(h.heroes); } }).catch(() => {});
    return () => { live = false; };
  }, [podIds]);
  // ranks 4 … 50 (Andy oct14 "make the leaderboard top 50"; was 20 oct13); past #50 your own row takes the last place, with your
  // real rank. The list SCROLLS inside its panel (7 rows show, the stage is a fixed 1280×720) and opens on your row.
  let list = rows.slice(3, BOARD_SIZE);
  if (meRow && !meOnBoard) list = [...rows.slice(3, BOARD_SIZE - 1), meRow];
  const wk = tab === 'week';
  const hR = wk ? (gains ? '+REBIRTHS' : 'REBIRTHS') : 'REBIRTHS';
  const hL = wk ? (gains ? '+LEVELS' : 'WORDS') : 'LEVELS';
  // TOP n% (Andy oct17) rides the PLAYER column head, not YOUR row (Andy oct19: in the row it sat on your REBIRTHS — the
  // name line has no width to spare at any size, and on a phone the chase line is already cut)
  const myPct = !wk && meRow ? topPercent(meRow.rank, data.total) : null;
  // THE CLIMB INTO A TIER since your last look on this tab (a first look is not a climb)
  const myMove = meRow ? Number(data.moves[meRow.id] || 0) : 0;
  const newTier = meRow && myMove > 0 ? enteredTier(Number(meRow.rank) + myMove, meRow.rank) : null;


  // ARRIVAL: the podium rises, the list + panels slide in, the bars fill, the crown wobbles once, ▲ / ▼ bob once and
  // YOUR row pulses (twice — finite). Re-played when the tab's data lands. No layout reads; nodes are the pool.
  const shown = `${tab}:${data.loaded ? 1 : 0}:${rows.length}`;
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !data.loaded) return;
    root.querySelectorAll('.lb2-slide').forEach((el, i) => kitPlay(el, SLIDE, { duration: 350, delay: i * 100, easing: 'ease-out', fill: 'backwards' }));
    root.querySelectorAll('.lb2-fill').forEach((el) => kitPlay(el, FILL, { duration: 800, delay: 200, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' }));
    // THE PODIUM ENTRANCE: per column, keyed off its block's landing
    root.querySelectorAll('.lb2-col').forEach((col) => {
      const place = Number(col.dataset.place) || 0;
      const rise = BLOCK_AT[place] || 0;
      const land = rise + 420;
      const q = (s) => col.querySelector(s);
      const bf = { fill: 'backwards' };
      kitPlay(q('.lb2-blockwrap'), BLOCK_RISE, { ...bf, duration: 420, delay: rise, easing: 'cubic-bezier(.2,1.1,.4,1)' });
      kitPlay(q('.lb2-place'), POPN, { ...bf, duration: 340, delay: land - 40, easing: 'cubic-bezier(.2,1.4,.4,1)' });
      kitPlay(q('.lb2-buddy'), DROP, { ...bf, duration: 620, delay: land + 160, easing: 'ease-in' });
      kitPlay(q('.lb2-pod-name'), POPN, { ...bf, duration: 300, delay: land + 640, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    });
    root.querySelectorAll('.lb2-mv.is-up .lb2-mv-ico').forEach((el) => kitPlay(el, BOB, { duration: 900, delay: 400, easing: 'ease-in-out' }));
    root.querySelectorAll('.lb2-mv.is-down .lb2-mv-ico').forEach((el) => kitPlay(el, SINK, { duration: 1300, delay: 400, easing: 'ease-in-out' }));
    root.querySelectorAll('.lb2-row.is-me').forEach((el) => kitPlay(el, pulse('rotate(-1deg)'), { duration: 750, iterations: 2, delay: 500, easing: 'ease-in-out' }));
    root.querySelectorAll('.lb2-col.is-me .lb2-who').forEach((el) => kitPlay(el, pulse(''), { duration: 750, iterations: 2, delay: 600, easing: 'ease-in-out' }));
    root.querySelectorAll('.lb2-row .lb2-seal').forEach((el, i) => kitPlay(el, STAMP, { duration: 300, delay: 380 + Math.min(i, 9) * 55, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' }));
    root.querySelectorAll('.lb2-col').forEach((col) => {
      const land = (BLOCK_AT[Number(col.dataset.place) || 0] || 0) + 420;
      kitPlay(col.querySelector('.lb2-pod-seal'), STAMP, { duration: 340, delay: land + 760, easing: 'cubic-bezier(.3,1.3,.5,1)', fill: 'backwards' });
    });
    if (newTier) {
      const mySeal = root.querySelector('.lb2-row.is-me .lb2-seal, .lb2-col.is-me .lb2-pod-seal');
      const at = 1700 + 120 * Math.min(myMove, 8);
      kitPlay(mySeal, SLAM, { duration: 620, delay: at, easing: 'cubic-bezier(.25,1.2,.4,1)', fill: 'backwards' });
      kitPlay(root.querySelector('.lb2-new-tier'), TAG_IN, { duration: 320, delay: at + 300, easing: 'cubic-bezier(.2,1.4,.4,1)', fill: 'backwards' });
    }
    // TOP 20: open the scroll list on YOUR row (one layout read when the data lands — never per frame)
    const sc = scrollRef.current;
    const meEl = sc && sc.querySelector('.lb2-row.is-me');
    if (sc && meEl) sc.scrollTop = Math.max(0, meEl.offsetTop - (sc.clientHeight - meEl.offsetHeight) / 2);
    // THE CLIMB (Andy oct14 "climb animation when passing someone"): you moved up N since your last look → your row
    // starts where you WERE (N rows lower) and slides up past the players you overtook, who each drop one slot. One
    // finite transform one-shot after the list lands; rows measured once here (not per frame). Podium climbs keep
    // the podium's own celebration.
    const myRow = meEl && meEl.dataset.id;
    const up = myRow ? Number(data.moves[myRow] || 0) : 0;
    if (meEl && up > 0) {
      const rowsEls = [...sc.querySelectorAll('.lb2-row')];
      const at = rowsEls.indexOf(meEl);
      const passed = rowsEls.slice(at + 1, at + 1 + up); // they were above you; now just below
      const step = passed.length ? passed[0].offsetHeight : meEl.offsetHeight;
      if (passed.length) {
        const dy = step * passed.length;
        kitPlay(meEl, [
          { transform: `translateY(${dy}px) rotate(-1deg) scale(1)` },
          { transform: `translateY(${dy}px) rotate(-1deg) scale(1.06)`, offset: 0.15 },
          { transform: 'translateY(-6px) rotate(-1deg) scale(1.06)', offset: 0.75 },
          { transform: 'translateY(0) rotate(-1deg) scale(1)' },
        ], { duration: 900 + 120 * passed.length, delay: 650, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
        passed.forEach((el, i) => kitPlay(el, [
          { transform: `translateY(${-meEl.offsetHeight}px)`, opacity: 1 },
          { transform: `translateY(${-meEl.offsetHeight}px)`, opacity: 1, offset: 0.2 + (0.5 * (passed.length - 1 - i)) / Math.max(1, passed.length) },
          { transform: 'translateY(0)', opacity: 0.55, offset: 0.8 },
          { transform: 'translateY(0)', opacity: 1 },
        ], { duration: 900 + 120 * passed.length, delay: 650, easing: 'ease-in-out', fill: 'backwards' }));
      }
    }
    // shown is the trigger; data.loaded guards it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  // (TOP 3 IDLE breath removed oct18 — Andy: the bounce idle is "horrendous (and unsmooth)"; the podium heroes stand still)

  const tabs = [
    { key: 'all', label: 'ALL TIME', sub: '★ → R → LV' },
    ...(caps.weekly ? [{ key: 'week', label: 'THIS WEEK', sub: formatResetIn(weekResetInMs()) }] : []),
  ];

  return (
    <div className={`lb2${narrow ? ' lb2--narrow' : ''}`} role="dialog" aria-modal="true" aria-label="Leaderboard" tabIndex={-1} ref={rootRef}>
      <div className="lb2-stripes" aria-hidden="true" />
      <div className="lb2-stage">
        <header className="lb2-head">
          <div className="lb2-left">
            <button type="button" className="lb2-back" onClick={onBack} aria-label="Back to menu">← MENU</button>
            {profile && (
              <button type="button" className="lb2-me-btn" onClick={() => setRenaming((v) => !v)} aria-expanded={renaming} aria-label={`Your name is ${profile.username}. Change name`}>
                <span className="lb2-me-k">YOU</span>
                <FitText className="lb2-me-v" min={0.5}>{profile.username}</FitText>
                <span className="lb2-me-a">CHANGE</span>
              </button>
            )}
            {!profile && (
              <button type="button" className="lb2-me-btn is-claim" onClick={() => setRenaming((v) => !v)} aria-expanded={renaming} aria-label="You have no name on the board yet. Claim a name">
                <span className="lb2-me-k">YOU</span>
                <FitText className="lb2-me-v" min={0.5}>NO NAME</FitText>
                <span className="lb2-me-a">CLAIM</span>
              </button>
            )}
            {renaming && (
              <RenameBox
                current={profile ? profile.username : ''}
                claim={!profile}
                cjk={!!caps.cjk}
                onDone={(row) => {
                  setRenaming(false);
                  if (row) { setProfile({ id: row.id, username: row.username }); loadAll(); }
                }}
              />
            )}
          </div>
          <h2 className="lb2-title">LEADERBOARD</h2>
          <div className="lb2-tabs" role="tablist" aria-label="Board">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} data-tab={t.key} className={`lb2-tab${tab === t.key ? ' is-on' : ''}`} onClick={() => pick(t.key)}>
                <span className="lb2-tab-l">{t.key === 'week' ? <KitIcon name="gems" size={22} shadow={1} extras={false} className="lb2-tab-gem" /> : null}{t.label}</span>
                <span className="lb2-tab-s">{t.sub}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="lb2-podium" aria-label="Top three">
          <div className="lb2-floor" aria-hidden="true" />
          {[2, 1, 3].map((place) => {
            const p = podium[place - 1];
            const mine = !!(p && myId && p.id === myId);
            const n = p ? nums(p, tab, gains) : null;
            const who = podCast[place - 1];
            const name = p ? p.username : 'YOUR NAME HERE?';
            return (
              <div key={place} className={`lb2-col lb2-col--${place}${mine ? ' is-me' : ''}${p ? ' is-peek' : ' is-open'}`} data-place={place} data-tier={p ? nameTier(place).key : undefined} data-id={p ? p.id : ''} data-cast={who.id} {...peekProps(p, setPeek)}>
                <div className="lb2-who">
                  {/* SIMPLE (Andy oct16: the emblem + ribbon read as poorly cut AI slop, "quality but with simplicity"): the
                      cast member alone (no crown — oct17), the name in plain type under it, then the plate + numbers */}
                  <span className="lb2-stand" aria-hidden="true">
                    <span className="lb2-buddy-wrap">
                      <CastArt className="lb2-buddy" id={who.id} live={!!p} />
                    </span>
                  </span>
                  <span className="lb2-pod-name">
                    {p ? <RankSeal rank={place} className="lb2-pod-seal" /> : null}
                    {mine && <span className="lb2-you">YOU</span>}
                    <FitText className="lb2-pod-name-t" min={0.5} style={{ '--nl': nameEms(name) }}>{name}</FitText>
                  </span>
                  {mine && newTier ? <span className="lb2-new-tier is-pod">NEW · {newTier.label}</span> : null}
                  {p ? <Plate row={p} mine={mine} className="lb2-pod-plate" /> : <span className="lb2-plate lb2-pod-plate is-empty"><span>OPEN</span></span>}
                  <span className="lb2-pod-stats">
                    <span className="lb2-pod-r">{n ? n.r : '—'}</span>
                    {n ? <span className="lb2-pod-lv">{n.lv} <span className="lb2-pod-lvk">{wk && !gains ? 'WORDS' : 'LV'}</span></span> : null}
                  </span>
                  {wk ? <Prize rank={place} pod /> : null}
                </div>
                <div className="lb2-blockwrap">
                  <img className="lb2-block" src={`/stage/podium-${place}.webp`} width={[0, 296, 308, 309][place]} height={[0, 431, 349, 278][place]} alt="" aria-hidden="true" draggable="false" />
                  <span className="lb2-place">{place}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lb2-cols" aria-hidden="true">
          <span>#</span><span className="lb2-cols-who"><span className={myPct ? 'lb2-cols-pl has-pct' : 'lb2-cols-pl'}>PLAYER</span>{wk ? <span className="lb2-cols-prize"> · TOP 10 WIN GEMS</span> : myPct ? <span className="lb2-pct" data-testid="lb2-pct">YOU: TOP {myPct}%</span> : null}</span><span /><span className="lb2-num">{hR}</span><span className="lb2-num">{hL}</span>
        </div>
        <div className="lb2-list lb2-slide"><div className="lb2-scroll" ref={scrollRef}>
          {!data.loaded && <p className="lb2-note">LOADING THE BOARD…</p>}
          {data.loaded && data.error && (
            <p className="lb2-note">COULDN’T LOAD THE BOARD. <button type="button" className="lb2-retry" onClick={tab === 'week' ? loadWeekTab : loadAll}>RETRY</button></p>
          )}
          {data.loaded && !data.error && rows.length === 0 && <p className="lb2-note">{wk ? 'NOBODY HAS CLIMBED THIS WEEK YET. BE FIRST.' : 'NOBODY IS ON THE BOARD YET.'}</p>}
          {data.loaded && !data.error && list.map((r, k) => {
            const mine = !!(myId && r.id === myId);
            // RIVAL + CHASE (Andy oct15 night "ways for people on leaderboard to feel even more addicted"; research: the
            // player right above you is the strongest pull a board has — a near, beatable target beats a distant top 10)
            const meK = myId ? list.findIndex((x) => x.id === myId) : -1;
            const rival = meK > 0 && list[meK - 1].rank === list[meK].rank - 1 ? list[meK - 1] : null;
            const isRival = !!(rival && r.id === rival.id);
            const n = nums(r, tab, gains);
            // BANDS (Andy oct14): a divider where a band starts — TOP 10 (the list opens on it), TOP 25, TOP 50 — and
            // past the board, the pinned YOU row gets its own. The rank number wears its band's colour.
            const band = rankBand(r.rank);
            const tier = nameTier(r.rank);
            const prevBand = k > 0 ? rankBand(list[k - 1].rank) : null;
            const sep = band ? (band !== prevBand ? `TOP ${band.top}` : null) : k > 0 && prevBand ? 'YOUR RANK' : null;
            return (
              <Fragment key={r.id}>
              {sep && <div className="lb2-sep" data-band={band ? band.tone : 'you'} aria-hidden="true"><span>{sep}</span></div>}
              <div className={`lb2-row is-peek${mine ? ' is-me' : ''}${isRival ? ' is-rival' : ''}${k % 2 ? ' is-odd' : ''}`} data-rank={r.rank} data-band={band ? band.tone : undefined} data-tier={tier ? tier.key : undefined} data-id={r.id} {...peekProps(r, setPeek)}>
                <span className={`lb2-rk${tier ? ' has-seal' : ''}`}>{tier ? <RankSeal rank={r.rank} className="lb2-seal" /> : fmt(r.rank)}</span>
                <span className="lb2-who-cell">
                  <span className="lb2-name-line">
                    {mine && <span className="lb2-you">YOU</span>}
                    <FitText className="lb2-name" min={0.5} style={{ '--nl': nameEms(r.username) }}>{r.username}</FitText>
                    {isRival && <span className="lb2-rival">RIVAL</span>}
                    {wk ? <Prize rank={r.rank} /> : null}
                  </span>
                  {/* the visit you climbed INTO a tier, that news owns the second line (the chase is back next look) */}
                  {mine && newTier ? <span className="lb2-chase"><span className="lb2-new-tier">NEW · {newTier.label}</span></span> : null}
                  {mine && !newTier && (rival || r.rank > 10) ? (
                    <span className={`lb2-chase${rival ? ' has-rival' : ''}`}>
                      {/* YOUR distance to the NEAREST band rides INSIDE this line's FitText, after the rival — never beside your
                          name, where a long or shrunk name ran under it (Andy oct26 "overlap with my username and '15 TO TOP
                          10'"): the two scale as one, so they can never cross */}
                      {rival ? <FitText className="lb2-chase-fit" min={0.55}>PASS <b>{rival.username}</b> FOR #{fmt(rival.rank)}{r.rank > 10 ? <span className="lb2-band-tag"><b>{fmt(r.rank - nearestBand(r.rank))}</b> TO TOP {nearestBand(r.rank)}</span> : null}</FitText> : null}
                      {/* the NEAREST band, not always TOP 10 (Andy oct15: winnability motivates — a goal you can reach); on a
                          small stage with a rival it steps aside so neither is cut */}
                      {r.rank > 10 && !rival ? <span className="lb2-chase-band"><b>{fmt(r.rank - nearestBand(r.rank))}</b> TO TOP {nearestBand(r.rank)}</span> : null}
                    </span>
                  ) : null}
                  {/* Andy oct8: only the TOP 3 wear name plates (the podium) — rows 4+ give that room to the FULL name */}
                </span>
                <Move n={data.moves[r.id] || 0} />
                <span className="lb2-r">{n.r}</span>
                <span className="lb2-lv">{n.lv}</span>
              </div>
              </Fragment>
            );
          })}
        </div></div>

      </div>
      {peek ? <Suspense fallback={null}><ProfileCard row={peek} mine={!!(myId && peek.id === myId)} onClose={() => setPeek(null)} /></Suspense> : null}
    </div>
  );
}
