// quests.js — QUESTS (progression PHASE 1, nov13 — Andy: "addiction with progression", Brawl Stars quest ticks after
// every game). PURE: the pool, the day's deal, the weekly, the reroll, the event reducer, the end-of-game settle and the
// payout take their inputs and return values (quests.test.js). progress/questsLive.js owns storage, the clock and the
// grants; it is lazy (contracts/live.js forwards every game event to it), so none of this rides first paint.
//
//   THE DAY      3 DAILY quests (EASY / MEDIUM / HARD), three different modes (at most one ANY-mode quest), only modes
//                the player has open. Seeded by (local day, the save's own quest seed) — the same save sees the same
//                three all day, two players see different ones. At least ONE daily is for a mode the player has not
//                played recently (the least recently finished open mode), so the quests send people back into the
//                modes they forgot. Refresh at local midnight.
//   THE WEEK     1 WEEKLY quest, bigger and spread across games; it keeps its progress all week (Monday, local).
//   ONE REROLL   rerollSlot — one unfinished DAILY swaps for another of its tier, once a day, free.
//   STACKING     one event can tick every quest it fits (a good game can finish two), like Brawl Stars.
//   THE EVENTS   the DAILY CONTRACTS events (contracts/bus.js) — nothing new is measured:
//                  word  { mode, word, len, band }   every mode's accepted word
//                  run   { mode, n }                 the round's running accepted count
//                  game  { mode, won, rivals }       once per FINISHED game (gems.payGameResult; bus.gameOver for solo)
//                  sat   { stage }                   a SAT capture at engine stage 0 / 1 / 2
//                  combo { n } · lucky {}
//   PAY          settleGame, at the END of the game that finished the quest: +50% of the wins that game earned
//                (PAY_SHARE), capped at 2× the player's daily average (CAP_X — a jackpot game can't make a windfall),
//                plus XP: a share of the CURRENT level's bar (XP_FRAC — the bar visibly jumps at every level, and a
//                quest can never cross more than one level). NEVER gems.
import { MODES, MODE_NAME, MODE_GAME, modeOf, hashSeed, seededRng } from './contracts/pool.js';

export { MODES, MODE_NAME, MODE_GAME, modeOf };
export const QUESTS_KEY = 'taw.quests';
export const WEEK = 'week';
export const TIER_WORD = { 1: 'EASY', 2: 'MEDIUM', 3: 'HARD', [WEEK]: 'WEEKLY' };
export const PAY_SHARE = 0.5; // a quest pays +50% of the wins its game earned …
export const CAP_X = 2; // … capped at 2× the player's daily average
export const XP_FRAC = { 1: 0.1, 2: 0.15, 3: 0.25, [WEEK]: 0.5 }; // of the current level's bar
export const RECENT_DAYS = 3; // a mode last finished more than this many days ago is "not played recently"
export const HIST_DAYS = 7; // the daily average reads the last 7 played days (today excluded)

const RAREISH = new Set(['RARE', 'OBSCURE']);
const NOT_COMMON = new Set(['UNCOMMON', 'RARE', 'OBSCURE']);
const len = (e) => (Number.isFinite(e.len) ? e.len : String(e.word || '').length);
const word = (mode, test = () => true) => ({ on: 'word', when: (e) => (mode === 'any' || e.mode === mode) && test(e) });
const longer = (mode, n) => word(mode, (e) => len(e) >= n);
const run = (mode) => ({ on: 'run', when: (e) => e.mode === mode, best: (e) => e.n });
const win = (mode) => ({ on: 'game', when: (e) => e.mode === mode && e.won && e.rivals > 0 });
const games = () => ({ on: 'game', when: (e) => !!e.mode });
const modes = () => ({ on: 'game', when: (e) => !!e.mode, distinct: (e) => e.mode });
// `unit` = the counted thing (singular, plural) for the nudge ("1 MORE GAME FINISHES A QUEST"); `once` = the nudge for a
// target that is one thing or one best-in-a-game ("A CHAIN OF 10 FINISHES A QUEST").
const U = { word: ['WORD', 'WORDS'], game: ['GAME', 'GAMES'], mode: ['MODE', 'MODES'], cap: ['CAPTURE', 'CAPTURES'], link: ['LINK', 'LINKS'], letter: ['LETTER', 'LETTERS'] };

// id · mode · tier · text (the list) · goal (the parade row) · target · unit / once · check
export const POOL = [
  // ---- EASY
  { id: 'q-games3', mode: 'any', tier: 1, text: 'Finish 3 games', goal: 'FINISH 3 GAMES', target: 3, unit: U.game, ...games() },
  { id: 'q-words25', mode: 'any', tier: 1, text: 'Get 25 words accepted in any game', goal: '25 WORDS', target: 25, unit: U.word, ...word('any') },
  { id: 'q-unc5', mode: 'any', tier: 1, text: 'Play 5 UNCOMMON-or-rarer words', goal: '5 UNCOMMON WORDS', target: 5, unit: U.word, ...word('any', (e) => NOT_COMMON.has(e.band)) },
  { id: 'q-wb-words', mode: 'wb', tier: 1, text: 'Land 10 words in WORD BOMB', goal: '10 BOMB WORDS', target: 10, unit: U.word, ...word('wb') },
  { id: 'q-bl-words', mode: 'blitz', tier: 1, text: 'Land 12 answers in CATEGORY BLITZ', goal: '12 BLITZ ANSWERS', target: 12, unit: ['ANSWER', 'ANSWERS'], ...word('blitz') },
  { id: 'q-sat-caps', mode: 'sat', tier: 1, text: 'Capture 8 words in SAT RUSH', goal: '8 SAT CAPTURES', target: 8, unit: U.cap, ...word('sat') },
  { id: 'q-ch-links', mode: 'chain', tier: 1, text: 'Link 15 words in CHAIN', goal: '15 CHAIN LINKS', target: 15, unit: U.link, ...word('chain') },
  { id: 'q-fu-solve', mode: 'fuse', tier: 1, text: 'Solve 8 words in FUSE', goal: '8 FUSE SOLVES', target: 8, unit: ['SOLVE', 'SOLVES'], ...word('fuse') },
  { id: 'q-ra-words', mode: 'race', tier: 1, text: 'Type 15 words in WORD RACE', goal: '15 RACE WORDS', target: 15, unit: U.word, ...word('race') },
  // ---- MEDIUM
  { id: 'q-modes3', mode: 'any', tier: 2, text: 'Play 3 different modes today', goal: '3 MODES TODAY', target: 3, unit: U.mode, ...modes() },
  { id: 'q-long7x3', mode: 'any', tier: 2, text: 'Play 3 words of 7+ letters', goal: '3 WORDS OF 7+', target: 3, unit: U.word, ...longer('any', 7) },
  { id: 'q-rare', mode: 'any', tier: 2, text: 'Play a RARE word in any game', goal: 'A RARE WORD', target: 1, once: 'A RARE WORD', ...word('any', (e) => RAREISH.has(e.band)) },
  { id: 'q-wb-run5', mode: 'wb', tier: 2, text: 'Survive 5 turns in one WORD BOMB game', goal: '5 TURNS IN ONE GAME', target: 5, once: '5 TURNS IN ONE WORD BOMB', ...run('wb') },
  { id: 'q-bl-run6', mode: 'blitz', tier: 2, text: 'A 6-answer run in one BLITZ game', goal: '6 IN ONE BLITZ GAME', target: 6, once: '6 ANSWERS IN ONE BLITZ', ...run('blitz') },
  { id: 'q-sat-early', mode: 'sat', tier: 2, text: 'Capture 4 SAT words before the letters show', goal: '4 EARLY CAPTURES', target: 4, unit: ['EARLY CAPTURE', 'EARLY CAPTURES'], on: 'sat', when: (e) => e.stage <= 1 },
  { id: 'q-ch-run10', mode: 'chain', tier: 2, text: 'Build a CHAIN of 10', goal: 'A CHAIN OF 10', target: 10, once: 'A CHAIN OF 10', ...run('chain') },
  { id: 'q-fu-long7', mode: 'fuse', tier: 2, text: 'Fuse a 7+ letter word', goal: 'A 7+ LETTER FUSE', target: 1, once: 'ONE 7+ LETTER FUSE', ...longer('fuse', 7) },
  { id: 'q-ra-long8', mode: 'race', tier: 2, text: 'Race an 8+ letter word', goal: 'AN 8+ LETTER RACE WORD', target: 1, once: 'ONE 8+ LETTER RACE WORD', ...longer('race', 8) },
  // ---- HARD
  { id: 'q-games6', mode: 'any', tier: 3, text: 'Finish 6 games', goal: 'FINISH 6 GAMES', target: 6, unit: U.game, ...games() },
  { id: 'q-long10', mode: 'any', tier: 3, text: 'Play a 10+ letter word in any game', goal: 'A 10+ LETTER WORD', target: 1, once: 'ONE 10+ LETTER WORD', ...longer('any', 10) },
  { id: 'q-wb-win', mode: 'wb', tier: 3, text: 'Win a game of WORD BOMB', goal: 'WIN WORD BOMB', target: 1, once: 'A WORD BOMB WIN', ...win('wb') },
  { id: 'q-bl-win', mode: 'blitz', tier: 3, text: 'Win a game of CATEGORY BLITZ', goal: 'WIN BLITZ', target: 1, once: 'A BLITZ WIN', ...win('blitz') },
  { id: 'q-sat-first3', mode: 'sat', tier: 3, text: 'Capture 3 SAT words at the first clue', goal: '3 FIRST-CLUE CAPTURES', target: 3, unit: ['FIRST-CLUE CAPTURE', 'FIRST-CLUE CAPTURES'], on: 'sat', when: (e) => e.stage === 0 },
  { id: 'q-ch-run20', mode: 'chain', tier: 3, text: 'Build a CHAIN of 20', goal: 'A CHAIN OF 20', target: 20, once: 'A CHAIN OF 20', ...run('chain') },
  { id: 'q-fu-run12', mode: 'fuse', tier: 3, text: 'Solve 12 in one FUSE run', goal: '12 IN ONE FUSE RUN', target: 12, once: '12 IN ONE FUSE RUN', ...run('fuse') },
  { id: 'q-ra-win', mode: 'race', tier: 3, text: 'Win a WORD RACE', goal: 'WIN A RACE', target: 1, once: 'A RACE WIN', ...win('race') },
  // ---- WEEKLY (bigger, spread across games and modes)
  { id: 'w-long6', mode: 'any', tier: WEEK, text: 'Play 100 words of 6+ letters this week', goal: '100 WORDS OF 6+', target: 100, unit: U.word, ...longer('any', 6) },
  { id: 'w-games25', mode: 'any', tier: WEEK, text: 'Finish 25 games this week', goal: 'FINISH 25 GAMES', target: 25, unit: U.game, ...games() },
  { id: 'w-modes5', mode: 'any', tier: WEEK, text: 'Play 5 different modes this week', goal: '5 MODES THIS WEEK', target: 5, unit: U.mode, ...modes() },
  { id: 'w-letters', mode: 'any', tier: WEEK, text: 'Play 2,000 letters in accepted words this week', goal: '2,000 LETTERS', target: 2000, unit: U.letter, ...word('any'), add: len },
];
export const BY_ID = Object.fromEntries(POOL.map((q) => [q.id, q]));

// ---- the calendar ----------------------------------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
/** The LOCAL calendar day ('YYYY-MM-DD'). */
export function dayKey(now = Date.now()) {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** The local MONDAY of `now`'s week, as a day key. */
export function weekKey(now = Date.now()) {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0); // noon: a DST shift can never land the subtraction on the wrong day
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d.getTime());
}
/** Whole days from day key `a` to day key `b` (b − a), by the calendar. */
export function daysBetween(a, b) {
  const t = (k) => { const [y, m, d] = String(k).split('-').map(Number); return Date.UTC(y, (m || 1) - 1, d || 1); };
  const n = Math.round((t(b) - t(a)) / 86400000);
  return Number.isFinite(n) ? n : Infinity;
}
/** ms to the next local midnight. */
export function msToReset(now = Date.now()) {
  const m = new Date(now);
  m.setHours(24, 0, 0, 0);
  return Math.max(0, m.getTime() - now);
}

// ---- the deal --------------------------------------------------------------------------------------------------------
/** A new save's quest seed (persisted in the quest state, so a save code carries the same quests to a new device). */
export function newSeed(rng = Math.random) {
  return Math.floor(rng() * 2 ** 32).toString(36);
}

/** PURE: the open mode the player finished LEAST recently (never-played first; ties by `rng`). */
export function staleMode(open, played = {}, rng = Math.random) {
  const list = (open && open.length ? open : MODES).slice();
  const at = (m) => (played && played[m]) || '';
  const oldest = list.reduce((a, m) => (at(m) < a ? at(m) : a), '￿');
  const tied = list.filter((m) => at(m) === oldest);
  return tied[Math.floor(rng() * tied.length)] || list[0];
}
/** True when `mode` was not finished within RECENT_DAYS of `day`. */
export function isStale(mode, played = {}, day) {
  const last = played && played[mode];
  return !last || daysBetween(last, day) > RECENT_DAYS;
}

const canUse = (q, open, taken) => (q.mode === 'any' ? !taken.has('any') : open.includes(q.mode) && !taken.has(q.mode));

/**
 * PURE: the day's three ids — EASY, MEDIUM, HARD in that order, three different modes (ANY counts as one), only `open`
 * modes, and one of them for the least-recently-played open mode (`played` = { mode: last day finished }).
 * Deterministic for (day, seed, open, played).
 */
export function pickDaily(day, seed = '', open = MODES, played = {}) {
  const rng = seededRng(hashSeed(`quests:${day}:${seed}`));
  const fresh = staleMode(open, played, rng);
  const freshTiers = [1, 2, 3].filter((t) => POOL.some((q) => q.tier === t && q.mode === fresh));
  const freshTier = freshTiers.length ? freshTiers[Math.floor(rng() * freshTiers.length)] : 0;
  const taken = new Set();
  const picks = [];
  for (const tier of [1, 2, 3]) {
    const list = tier === freshTier
      ? POOL.filter((q) => q.tier === tier && q.mode === fresh)
      : POOL.filter((q) => q.tier === tier && q.mode !== fresh && canUse(q, open, taken));
    if (!list.length) continue;
    const q = list[Math.floor(rng() * list.length)];
    taken.add(q.mode);
    picks.push(q.id);
  }
  return picks;
}

/** PURE: the week's one id. */
export function pickWeekly(week, seed = '') {
  const list = POOL.filter((q) => q.tier === WEEK);
  const rng = seededRng(hashSeed(`quests:week:${week}:${seed}`));
  return list[Math.floor(rng() * list.length)].id;
}

const valid = (s) => !!s && s.v === 1 && Array.isArray(s.picks) && Array.isArray(s.done) && !!s.prog && typeof s.prog === 'object' && typeof s.seed === 'string';
const pick = (obj, ids) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => ids.includes(k)));
const trimHist = (hist, day) => Object.fromEntries(Object.entries(hist || {}).filter(([k]) => daysBetween(k, day) >= 0 && daysBetween(k, day) <= HIST_DAYS));

/**
 * PURE: the state for `now` — `state` itself when it is already today's, else a new day dealt on top of it (the seed, the
 * modes played, the wins history and an unpaid finish carry; a quest finished but not yet paid is never lost). The weekly
 * (id, progress, done, paid) carries while the week is the same. `rng` makes a missing seed.
 */
export function deal(state, now = Date.now(), open = MODES, rng = Math.random) {
  const day = dayKey(now);
  const week = weekKey(now);
  if (valid(state) && state.day === day && state.week === week) return state;
  const old = valid(state) ? state : null;
  const seed = old ? old.seed : newSeed(rng);
  const played = (old && old.played) || {};
  const sameWeek = !!old && old.week === week && !!BY_ID[old.wpick];
  const wpick = sameWeek ? old.wpick : pickWeekly(week, seed);
  const keepW = sameWeek ? [wpick] : [];
  const pendingCarry = old ? (old.pending || []).filter((id) => !(old.paid && old.paid[id])) : [];
  return {
    v: 1,
    seed,
    day,
    week,
    picks: pickDaily(day, seed, open, played),
    wpick,
    prog: pick(old && old.prog, keepW),
    seen: pick(old && old.seen, keepW),
    done: (old ? old.done : []).filter((id) => keepW.includes(id)),
    paid: pick(old && old.paid, keepW),
    pending: [],
    carry: pendingCarry.length ? pendingCarry : (old && old.carry) || [],
    rerolled: false,
    played,
    hist: trimHist(old && old.hist, day),
  };
}

/** PURE: swap the DAILY in `slot` for another of its tier (one free reroll a day; never a finished quest). The swap keeps
 *  the "a mode you haven't played recently" promise: a fresh-mode slot is replaced by another stale mode when one fits.
 *  Returns the new state, or null when it can't. */
export function rerollSlot(state, slot, open = MODES) {
  if (!valid(state) || state.rerolled) return null;
  const id = state.picks[slot];
  const cur = BY_ID[id];
  if (!cur || state.done.includes(id)) return null;
  const others = state.picks.filter((p, i) => i !== slot);
  const taken = new Set(others.map((p) => BY_ID[p] && BY_ID[p].mode));
  const othersFresh = others.some((p) => BY_ID[p] && BY_ID[p].mode !== 'any' && isStale(BY_ID[p].mode, state.played, state.day));
  const fits = POOL.filter((q) => q.tier === cur.tier && q.id !== id && q.mode !== cur.mode && canUse(q, open, taken));
  const fresh = fits.filter((q) => q.mode !== 'any' && isStale(q.mode, state.played, state.day));
  const list = !othersFresh && fresh.length ? fresh : fits;
  if (!list.length) return null;
  const rng = seededRng(hashSeed(`quests:${state.day}:${state.seed}:reroll:${slot}`));
  const next = list[Math.floor(rng() * list.length)];
  const picks = state.picks.slice();
  picks[slot] = next.id;
  const prog = { ...state.prog };
  delete prog[id];
  const seen = { ...state.seen };
  delete seen[id];
  return { ...state, picks, prog, seen, rerolled: true };
}

/** Every quest on the board in order: the three dailies then the weekly. */
export const boardIds = (state) => (valid(state) ? [...state.picks, state.wpick].filter((id) => BY_ID[id]) : []);

/** A quest's progress number, clamped to its target. */
export function progressOf(state, id) {
  const q = BY_ID[id];
  if (!q || !state) return 0;
  return Math.min(q.target, Math.max(0, Number(state.prog && state.prog[id]) || 0));
}

/**
 * PURE: fold one event into the board. → { state, ticks } — ticks = [{ id, from, to, target, done }] for every quest on
 * the board the event moved (done = it just finished — STACKING: one event can finish several). `state` is the same
 * object when nothing moved. A finished quest joins `pending`: it is paid by the END of the game (settleGame).
 */
export function applyEvent(state, ev) {
  if (!valid(state) || !ev || !ev.type) return { state, ticks: [] };
  const e = { ...ev, mode: ev.mode != null ? modeOf(ev.mode) : ev.mode };
  let next = state;
  const ticks = [];
  for (const id of boardIds(state)) {
    const q = BY_ID[id];
    if (q.on !== e.type || next.done.includes(id)) continue;
    let ok = false;
    try { ok = !!q.when(e); } catch { ok = false; }
    if (!ok) continue;
    const from = progressOf(next, id);
    let to = from;
    let seen = null;
    if (q.distinct) {
      const k = String(q.distinct(e));
      const list = (next.seen && next.seen[id]) || [];
      if (list.includes(k)) continue;
      seen = [...list, k];
      to = Math.min(q.target, seen.length);
    } else if (q.best) {
      to = Math.min(q.target, Math.max(from, Math.floor(Number(q.best(e)) || 0)));
    } else {
      to = Math.min(q.target, from + Math.max(0, Math.floor(Number(q.add ? q.add(e) : 1) || 0)));
    }
    if (to <= from) continue;
    const done = to >= q.target;
    next = {
      ...next,
      prog: { ...next.prog, [id]: to },
      seen: seen ? { ...next.seen, [id]: seen } : next.seen,
      done: done ? [...next.done, id] : next.done,
      pending: done ? [...(next.pending || []), id] : next.pending || [],
    };
    ticks.push({ id, from, to, target: q.target, done });
  }
  return { state: next, ticks };
}

/** The player's average game wins per day over the last HIST_DAYS played days, today excluded (0 = no history). */
export function dailyAverage(hist = {}, day = dayKey()) {
  const vals = Object.entries(hist || {})
    .filter(([k, v]) => k !== day && daysBetween(k, day) > 0 && daysBetween(k, day) <= HIST_DAYS && Number(v) > 0)
    .map(([, v]) => Number(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

/**
 * PURE: what one finished quest pays. +PAY_SHARE of `gameWins` (the wins the game that finished it earned), capped at
 * CAP_X × the daily average (no history yet: × today's game wins so far, this game included — so a first day can never
 * out-pay itself). XP = XP_FRAC[tier] of the CURRENT level's bar (`need` = that level's cost). No gems — ever.
 */
export function questPayout({ tier, gameWins = 0, dailyAvg = 0, todayWins = 0, need = 0 } = {}) {
  const g = Math.max(0, Number(gameWins) || 0);
  const ref = Number(dailyAvg) > 0 ? Number(dailyAvg) : Math.max(g, Number(todayWins) || 0);
  const cap = Math.max(0, CAP_X * ref);
  const wins = Math.max(0, Math.floor(Math.min(PAY_SHARE * g, cap)));
  const xp = Math.max(0, Math.round((XP_FRAC[tier] || 0) * (Number(need) || 0)));
  return { wins, xp, capped: PAY_SHARE * g > cap };
}

/**
 * PURE: settle a finished game. Records the mode as played today and the game's wins into today's history, then pays
 * every quest finished since the last settle (`pending`, plus any `carry` from an unsettled yesterday) from THIS game's
 * wins. `need` = the current level's XP cost. → { state, payouts: [{ id, tier, wins, xp, capped }] }. The caller grants.
 */
export function settleGame(state, { mode, gameWins = 0, now = Date.now(), need = 0 } = {}) {
  if (!valid(state)) return { state, payouts: [] };
  const day = dayKey(now);
  const m = modeOf(mode);
  const g = Math.max(0, Math.floor(Number(gameWins) || 0));
  const hist = { ...trimHist(state.hist, day) };
  hist[day] = (Number(hist[day]) || 0) + g;
  const played = m ? { ...(state.played || {}), [m]: day } : state.played || {};
  const avg = dailyAverage(hist, day);
  const due = [...new Set([...(state.carry || []), ...(state.pending || [])])].filter((id) => BY_ID[id] && !(state.paid && state.paid[id]));
  const paid = { ...(state.paid || {}) };
  const payouts = [];
  for (const id of due) {
    const q = BY_ID[id];
    const p = questPayout({ tier: q.tier, gameWins: g, dailyAvg: avg, todayWins: hist[day], need });
    paid[id] = { wins: p.wins, xp: p.xp };
    payouts.push({ id, tier: q.tier, ...p });
  }
  return { state: { ...state, hist, played, paid, pending: [], carry: [] }, payouts };
}

/**
 * The NUDGE: the unfinished quest closest to done and what finishes it — { id, text, left } or null when every quest on
 * the board is done. Closest = the smallest share of the target left (a 1-thing quest counts as half done).
 */
export function nudge(state) {
  let best = null;
  for (const id of boardIds(state)) {
    if (state.done.includes(id)) continue;
    const q = BY_ID[id];
    const have = progressOf(state, id);
    const left = Math.max(1, q.target - have);
    const score = q.target === 1 ? 0.5 : left / q.target;
    const tie = q.tier === WEEK ? 1 : 0; // a daily beats the weekly on a tie (it resets first)
    if (!best || score < best.score || (score === best.score && tie < best.tie)) best = { id, q, left, score, tie };
  }
  if (!best) return null;
  const { q, left } = best;
  const text = q.once
    ? `${q.once} FINISHES A QUEST`
    : `${left} MORE ${left === 1 ? q.unit[0] : q.unit[1]} ${left === 1 ? 'FINISHES' : 'FINISH'} A QUEST`;
  return { id: best.id, text, left };
}

/** The board for a list: [{ id, q, slot, tier, have, done, paid }] — the three dailies, then the weekly (slot -1). */
export function board(state) {
  return boardIds(state).map((id) => {
    const q = BY_ID[id];
    return { id, q, slot: state.picks.indexOf(id), tier: q.tier, have: progressOf(state, id), done: state.done.includes(id), paid: (state.paid && state.paid[id]) || null };
  });
}
