// contracts/pool.js — DAILY CONTRACTS (prototype, Andy oct21 "progression through new, noticeable CONTENT"): three small
// tasks a day that send the player into different modes. PURE — the pool, the day's pick, the event reducer and the
// reroll take their inputs and return values (pool.test.js); contracts/live.js owns storage, the clock and the grants.
//
//   THE DAY      pickDay(day, open) — one EASY + one MEDIUM + one HARD, three DIFFERENT modes (at most one ANY-mode
//                task), only modes the player has open. Seeded by the local date, so the same save sees the same three
//                all day; the pick is stored on first sight, so a mode unlocking mid-day never reshuffles it.
//   ONE REROLL   rerollSlot(state, slot, open) — one unfinished task swaps for another of its tier in a mode not
//                already on the board. Once a day.
//   THE EVENTS   every task is checked from an event the game already emits (contracts/bus.js — see EVENTS below);
//                nothing new is measured.
//   PAY          gems only (T1 20 · T2 30 · T3 50, + SWEEP 50 for all three — a day's best is 150, two rolls).
//                Never wins or XP multipliers. Well under 036's gem budget (DAILY_MAX 3150 a day).
//
// EVENTS (contracts/bus.js contractEvent — the hook each is fired from):
//   word   { mode, word, len, band, gems }  wins.awardWordXp — every mode's accepted word (band = rarity.js rarityOf)
//   run    { mode, n }                      wins.bankWordWins — the round's running accepted count (a CHAIN's length)
//   game   { mode, won, rivals }            gems.payGameResult — once per finished WORD BOMB / BLITZ / WORD RACE game
//   sat    { stage }                        SatRushGame — a capture, at engine stage 0 (5×, first clue) / 1 / 2
//   combo  { n }                            records.noteCombo — the WORD BOMB / BLITZ answer combo
//   lucky  {}                               records.noteLucky — a LUCKY-WORD hit (WB, BLITZ, CHAIN, FUSE)

export const TIER_GEMS = { 1: 20, 2: 30, 3: 50 }; // Andy oct21: doubled ("I can make more than like 50 gems in one word race session")
export const SWEEP_GEMS = 50;
export const MODES = ['wb', 'blitz', 'sat', 'chain', 'fuse', 'race'];
/** The menu's game id for each contract mode (gameData.js) — the sheet's GO opens that mode's dialog. */
export const MODE_GAME = { wb: 'word-bomb', blitz: 'category-blitz', sat: 'sat-rush', chain: 'chain', fuse: 'fuse', race: 'word-race' };
export const MODE_NAME = { wb: 'WORD BOMB', blitz: 'BLITZ', sat: 'SAT RUSH', chain: 'CHAIN', fuse: 'FUSE', race: 'WORD RACE', any: 'ANY GAME' };

/** Any spelling the codebase uses for a mode → the contract key (null = not a contract mode, e.g. menu typing). */
export function modeOf(m) {
  switch (m) {
    case 'wb': case 'word-bomb': case 'wordBomb': return 'wb';
    case 'blitz': case 'category-blitz': case 'categoryBlitz': return 'blitz';
    case 'sat': case 'sat-rush': case 'satRush': return 'sat';
    case 'chain': return 'chain';
    case 'fuse': return 'fuse';
    case 'race': case 'word-race': case 'wordRace': return 'race';
    default: return null;
  }
}

const RAREISH = new Set(['RARE', 'OBSCURE']);
const len = (e) => (Number.isFinite(e.len) ? e.len : String(e.word || '').length);
const word = (mode, test = () => true) => ({ on: 'word', when: (e) => (mode === 'any' || e.mode === mode) && test(e) });
const longer = (mode, n) => word(mode, (e) => len(e) >= n);
const rare = (mode) => word(mode, (e) => RAREISH.has(e.band));
const run = (mode) => ({ on: 'run', when: (e) => e.mode === mode, best: (e) => e.n });
const win = (mode) => ({ on: 'game', when: (e) => e.mode === mode && e.won && e.rivals > 0 });

// id · mode · tier · text (the sheet) · goal (the toast) · target · check
export const POOL = [
  // WORD BOMB
  { id: 'wb-words', mode: 'wb', tier: 1, text: 'Get 10 words accepted in WORD BOMB', goal: 'WORD BOMB WORDS', target: 10, ...word('wb') },
  { id: 'wb-long7', mode: 'wb', tier: 2, text: 'Play a 7+ letter word in WORD BOMB', goal: '7+ LETTERS', target: 1, ...longer('wb', 7) },
  { id: 'wb-turns', mode: 'wb', tier: 2, text: 'Land 8 words in one WORD BOMB game', goal: '8 IN ONE GAME', target: 8, ...run('wb') },
  { id: 'wb-rare', mode: 'wb', tier: 2, text: 'Play a RARE word in WORD BOMB', goal: 'RARE BOMB WORD', target: 1, ...rare('wb') },
  { id: 'wb-long9', mode: 'wb', tier: 3, text: 'Play a 9+ letter word in WORD BOMB', goal: '9+ LETTERS', target: 1, ...longer('wb', 9) },
  { id: 'wb-win', mode: 'wb', tier: 3, text: 'Win a game of WORD BOMB', goal: 'WIN WORD BOMB', target: 1, ...win('wb') },
  // CATEGORY BLITZ
  { id: 'bl-words', mode: 'blitz', tier: 1, text: 'Land 12 answers in CATEGORY BLITZ', goal: 'BLITZ ANSWERS', target: 12, ...word('blitz') },
  { id: 'bl-round', mode: 'blitz', tier: 2, text: 'Land 6 answers in one BLITZ game', goal: '6 IN ONE GAME', target: 6, ...run('blitz') },
  { id: 'bl-long8', mode: 'blitz', tier: 2, text: 'Answer with an 8+ letter word in BLITZ', goal: '8+ LETTER ANSWER', target: 1, ...longer('blitz', 8) },
  { id: 'bl-rare', mode: 'blitz', tier: 2, text: 'Give a RARE answer in BLITZ', goal: 'RARE ANSWER', target: 1, ...rare('blitz') },
  { id: 'bl-win', mode: 'blitz', tier: 3, text: 'Win a game of CATEGORY BLITZ', goal: 'WIN BLITZ', target: 1, ...win('blitz') },
  // SAT RUSH
  { id: 'sat-words', mode: 'sat', tier: 1, text: 'Capture 8 words in SAT RUSH', goal: 'SAT CAPTURES', target: 8, ...word('sat') },
  { id: 'sat-first', mode: 'sat', tier: 2, text: 'Capture a SAT word at the first clue (5×)', goal: 'FIRST-CLUE CAPTURE', target: 1, on: 'sat', when: (e) => e.stage === 0 },
  { id: 'sat-early', mode: 'sat', tier: 2, text: 'Capture 5 SAT words before the letters show', goal: 'EARLY CAPTURES', target: 5, on: 'sat', when: (e) => e.stage <= 1 },
  { id: 'sat-case', mode: 'sat', tier: 2, text: 'Capture 10 in one SAT RUSH case', goal: '10 IN ONE CASE', target: 10, ...run('sat') },
  { id: 'sat-first3', mode: 'sat', tier: 3, text: 'Capture 3 SAT words at the first clue (5×)', goal: 'FIRST-CLUE CAPTURES', target: 3, on: 'sat', when: (e) => e.stage === 0 },
  // CHAIN
  { id: 'ch-links', mode: 'chain', tier: 1, text: 'Link 15 words in CHAIN', goal: 'CHAIN LINKS', target: 15, ...word('chain') },
  { id: 'ch-run10', mode: 'chain', tier: 2, text: 'Build a CHAIN of 10', goal: 'CHAIN OF 10', target: 10, ...run('chain') },
  { id: 'ch-long8', mode: 'chain', tier: 2, text: 'Link an 8+ letter word in CHAIN', goal: '8+ LETTER LINK', target: 1, ...longer('chain', 8) },
  { id: 'ch-run20', mode: 'chain', tier: 3, text: 'Build a CHAIN of 20', goal: 'CHAIN OF 20', target: 20, ...run('chain') },
  // FUSE
  { id: 'fu-words', mode: 'fuse', tier: 1, text: 'Solve 8 words in FUSE', goal: 'FUSE SOLVES', target: 8, ...word('fuse') },
  { id: 'fu-long7', mode: 'fuse', tier: 2, text: 'Fuse a 7+ letter word', goal: '7+ LETTER FUSE', target: 1, ...longer('fuse', 7) },
  { id: 'fu-run12', mode: 'fuse', tier: 3, text: 'Solve 12 in one FUSE run', goal: '12 IN ONE RUN', target: 12, ...run('fuse') },
  // WORD RACE
  { id: 'ra-words', mode: 'race', tier: 1, text: 'Type 15 words in WORD RACE', goal: 'RACE WORDS', target: 15, ...word('race') },
  { id: 'ra-long8', mode: 'race', tier: 2, text: 'Race an 8+ letter word', goal: '8+ LETTER RACE WORD', target: 1, ...longer('race', 8) },
  { id: 'ra-win', mode: 'race', tier: 3, text: 'Win a WORD RACE', goal: 'WIN A RACE', target: 1, ...win('race') },
  // ANY GAME (at most one a day)
  { id: 'any-words', mode: 'any', tier: 1, text: 'Get 25 words accepted in any game', goal: 'WORDS TODAY', target: 25, ...word('any') },
  { id: 'any-letters', mode: 'any', tier: 1, text: 'Play 150 letters in accepted words', goal: 'LETTERS TODAY', target: 150, ...word('any'), add: len },
  { id: 'any-two', mode: 'any', tier: 1, text: 'Get a word accepted in 2 different games', goal: 'GAMES PLAYED', target: 2, ...word('any'), distinct: (e) => e.mode },
  { id: 'any-three', mode: 'any', tier: 2, text: 'Get a word accepted in 3 different games', goal: 'GAMES PLAYED', target: 3, ...word('any'), distinct: (e) => e.mode },
  { id: 'any-rare3', mode: 'any', tier: 2, text: 'Play 3 RARE-or-better words', goal: 'RARE WORDS', target: 3, ...word('any', (e) => RAREISH.has(e.band)) },
  { id: 'any-qzxj', mode: 'any', tier: 2, text: 'Play a word with a Q, Z, X or J', goal: 'Q · Z · X · J', target: 1, ...word('any', (e) => /[qzxj]/i.test(e.word || '')) },
  { id: 'any-double', mode: 'any', tier: 1, text: 'Play 3 words with a double letter (LL, EE …)', goal: 'DOUBLE LETTERS', target: 3, ...word('any', (e) => /([a-z])\1/i.test(e.word || '')) },
  { id: 'any-gem', mode: 'any', tier: 2, text: 'Catch a gem drop off a word', goal: 'GEM DROP', target: 1, ...word('any', (e) => e.gems > 0) },
  { id: 'any-combo5', mode: 'any', tier: 2, text: 'Hit a 5-answer combo in WORD BOMB or BLITZ', goal: '5 COMBO', target: 5, on: 'combo', when: () => true, best: (e) => e.n },
  { id: 'any-lucky', mode: 'any', tier: 3, text: 'Hit a LUCKY word', goal: 'LUCKY WORD', target: 1, on: 'lucky', when: () => true },
  { id: 'any-obscure', mode: 'any', tier: 3, text: 'Find an OBSCURE word in any game', goal: 'OBSCURE FIND', target: 1, ...word('any', (e) => e.band === 'OBSCURE') },
  { id: 'any-long10', mode: 'any', tier: 3, text: 'Play a 10+ letter word in any game', goal: '10+ LETTERS', target: 1, ...longer('any', 10) },
  { id: 'any-vowels', mode: 'any', tier: 3, text: 'Play one word with all five vowels', goal: 'A · E · I · O · U', target: 1, ...word('any', (e) => ['a', 'e', 'i', 'o', 'u'].every((v) => String(e.word || '').toLowerCase().includes(v))) },
  { id: 'any-combo8', mode: 'any', tier: 3, text: 'Hit an 8-answer combo in WORD BOMB or BLITZ', goal: '8 COMBO', target: 8, on: 'combo', when: () => true, best: (e) => e.n },
];
export const BY_ID = Object.fromEntries(POOL.map((c) => [c.id, c]));

// ---- the seeded pick --------------------------------------------------------------------------------------------
/** FNV-1a → a 32-bit seed. */
export function hashSeed(s) {
  let h = 2166136261;
  for (const ch of String(s)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** mulberry32 — a small deterministic rng in [0, 1). */
export function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canUse = (c, open, taken) => (c.mode === 'any' || open.includes(c.mode)) && !taken.has(c.mode);

/**
 * PURE: the day's three ids — tier 1, 2, 3 in that order, three different modes (ANY counts as one), only `open`
 * modes. `open` defaults to every mode. Deterministic for (day, open).
 */
export function pickDay(day, open = MODES) {
  const rng = seededRng(hashSeed(`contracts:${day}`));
  const taken = new Set();
  const picks = [];
  for (const tier of [1, 2, 3]) {
    const list = POOL.filter((c) => c.tier === tier && canUse(c, open, taken));
    if (!list.length) continue;
    const c = list[Math.floor(rng() * list.length)];
    taken.add(c.mode);
    picks.push(c.id);
  }
  return picks;
}

/** A fresh day's state. */
export function freshDay(day, open = MODES) {
  return { v: 1, day, picks: pickDay(day, open), prog: {}, seen: {}, done: [], rerolled: false, sweep: false, kept: false };
}

/** PURE: swap the task in `slot` for another of its tier (one reroll a day; never a finished task). Returns the new
 *  state, or null when it can't (already rerolled, finished, nothing else fits). */
export function rerollSlot(state, slot, open = MODES) {
  if (!state || state.rerolled) return null;
  const id = state.picks[slot];
  const cur = BY_ID[id];
  if (!cur || state.done.includes(id)) return null;
  const taken = new Set(state.picks.filter((p, i) => i !== slot).map((p) => BY_ID[p] && BY_ID[p].mode));
  const list = POOL.filter((c) => c.tier === cur.tier && c.id !== id && c.mode !== cur.mode && canUse(c, open, taken));
  if (!list.length) return null;
  const rng = seededRng(hashSeed(`contracts:${state.day}:reroll:${slot}`));
  const next = list[Math.floor(rng() * list.length)];
  const picks = state.picks.slice();
  picks[slot] = next.id;
  const prog = { ...state.prog };
  delete prog[id];
  return { ...state, picks, prog, rerolled: true };
}

/** A contract's progress number, clamped to its target. */
export function progressOf(state, id) {
  const c = BY_ID[id];
  if (!c || !state) return 0;
  return Math.min(c.target, Math.max(0, Number(state.prog && state.prog[id]) || 0));
}

/**
 * PURE: fold one event into the day. Returns { state, ticks } — ticks = [{ id, from, to, target, done }] for every
 * picked, unfinished contract the event moved (done = it just finished). `state` is unchanged (same object) when
 * nothing moved.
 */
export function applyEvent(state, ev) {
  if (!state || !ev || !ev.type) return { state, ticks: [] };
  const e = { ...ev, mode: ev.mode != null ? modeOf(ev.mode) : ev.mode };
  let next = state;
  const ticks = [];
  for (const id of state.picks) {
    const c = BY_ID[id];
    if (!c || c.on !== e.type || next.done.includes(id)) continue;
    let ok = false;
    try { ok = !!c.when(e); } catch { ok = false; }
    if (!ok) continue;
    const from = progressOf(next, id);
    let to = from;
    let seen = null;
    if (c.distinct) {
      const k = String(c.distinct(e));
      const list = (next.seen && next.seen[id]) || [];
      if (list.includes(k)) continue;
      seen = [...list, k];
      to = Math.min(c.target, seen.length);
    } else if (c.best) {
      to = Math.min(c.target, Math.max(from, Math.floor(Number(c.best(e)) || 0)));
    } else {
      to = Math.min(c.target, from + Math.max(0, Math.floor(Number(c.add ? c.add(e) : 1) || 0)));
    }
    if (to <= from && !seen) continue;
    const done = to >= c.target;
    next = {
      ...next,
      prog: { ...next.prog, [id]: to },
      seen: seen ? { ...next.seen, [id]: seen } : next.seen,
      done: done ? [...next.done, id] : next.done,
    };
    if (to > from) ticks.push({ id, from, to, target: c.target, done });
  }
  return { state: next, ticks };
}

/** True once every picked contract is done. */
export function allDone(state) {
  return !!state && state.picks.length > 0 && state.picks.every((id) => state.done.includes(id));
}
