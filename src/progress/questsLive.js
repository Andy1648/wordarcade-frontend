// questsLive.js — QUESTS, the live half (LAZY: contracts/live.js forwards every game event here; the results parade and
// the quest list load it on demand). Storage, the local-midnight deal, the grants and the per-game RESULT the results
// parade reads — the rules are quests.js's.
//
// Store: taw.quests (quests.js deal's shape — PROGRESS: it rides the save code + cloud save, save/saveBackup.js).
// A game's quest ticks collect from the events in between two game ends; the 'game' event (once per finished game)
// settles them: every quest that game finished is paid from the wins the game earned (the session's wins ledger since
// the last game end, this mode's credits only) and the XP lands on the bar. Then RESULT = { at, mode, ticks, payouts,
// xp, nudge } is published on QUESTS_RESULT for the results parade. Wins go through wins.grantWins as ONE 'QUEST DONE' /
// '2 QUESTS DONE' credit (kind bonus), so every end card already lists it as a named line (no hidden wins). Never gems.
import { deal, rerollSlot, applyEvent, settleGame, nudge, board, BY_ID, MODES, QUESTS_KEY, modeOf, msToReset } from './quests.js';
import { winsLedgerSince, winsLedgerMark, grantWins } from './wins.js';
import { loadProgress, saveProgress, creditXp, need, progressOf as xpProgressOf } from './xp.js';
import { openModes } from './contracts/live.js';

export { QUESTS_KEY, msToReset, board, nudge, BY_ID };
/** Fired on window after every write — the quest list re-reads on it. */
export const QUESTS_CHANGE = 'taw:quests-change';
/** Fired on window when a finished game has been settled (detail = the RESULT). */
export const QUESTS_RESULT = 'taw:quests-result';
export const QUEST_LABEL = /^\d* ?QUESTS? DONE$/; // the one credit a settle makes: 'QUEST DONE' / '2 QUESTS DONE'

let mem = null; // the session copy when storage is blocked
function read() {
  try {
    const raw = localStorage.getItem(QUESTS_KEY);
    return raw ? JSON.parse(raw) : mem;
  } catch {
    return mem;
  }
}
function write(s) {
  mem = s;
  try { localStorage.setItem(QUESTS_KEY, JSON.stringify(s)); } catch { /* memory only */ }
  try { window.dispatchEvent(new CustomEvent(QUESTS_CHANGE)); } catch { /* node */ }
}
const open = () => {
  try { return openModes(); } catch { return MODES; }
};

/** Today's board (deals a new day / week on first sight after local midnight). */
export function today(now = Date.now()) {
  const s = read();
  const next = deal(s, now, open());
  if (next !== s) write(next);
  return next;
}

/** The one free daily reroll of `slot`. True when it swapped. */
export function reroll(slot) {
  const next = rerollSlot(today(), slot, open());
  if (!next) return false;
  write(next);
  return true;
}

// ---- the game in progress ------------------------------------------------------------------------------------------
let ticks = new Map(); // id → { id, from, to, target, done } since the last game end
let lastEndMark = 0; // wins-ledger id at the last game end
let lastResult = null;

/** The newest settled game's RESULT (null before any), for the parade. */
export function lastGameResult() {
  return lastResult;
}

function gameWinsFor(mode) {
  const m = modeOf(mode);
  return winsLedgerSince(lastEndMark)
    .filter((e) => e && modeOf(e.mode) === m && !QUEST_LABEL.test(String(e.label || '')))
    .reduce((a, e) => a + (Number(e.amount) || 0), 0);
}

function settle(state, ev) {
  const mode = modeOf(ev.mode);
  const gameWins = gameWinsFor(ev.mode);
  const xpFrom = xpProgressOf(loadProgress());
  const { state: next, payouts } = settleGame(state, { mode, gameWins, need: need(xpFrom.level) });
  // ONE named wins line per game (the end card itemises every credit — two quests are one '2 QUESTS DONE' line; the parade
  // shows each quest's share)
  const wins = payouts.reduce((a, p) => a + p.wins, 0);
  if (wins > 0) grantWins(wins, payouts.length > 1 ? `${payouts.length} QUESTS DONE` : 'QUEST DONE', { mode: ev.mode, detail: `quest-${payouts.map((p) => p.id).join('+')}` });
  for (const p of payouts) {
    if (p.xp > 0) {
      try { saveProgress(creditXp(loadProgress(), p.xp).state); } catch { /* the bar is never worth a throw */ }
    }
  }
  const xpTo = xpProgressOf(loadProgress());
  const xpGained = payouts.reduce((a, p) => a + p.xp, 0);
  lastEndMark = winsLedgerMark();
  lastResult = {
    at: Date.now(),
    mode,
    gameWins,
    ticks: [...ticks.values()],
    payouts,
    xp: xpGained > 0 ? { from: { level: xpFrom.level, frac: xpFrom.frac }, to: { level: xpTo.level, frac: xpTo.frac }, gained: xpGained } : null,
    nudge: nudge(next),
  };
  ticks = new Map();
  return next;
}

// e2e: quests are OFF in the suite unless a spec opts in (installBackendMock({ quests: true })) — a date-seeded quest that
// finished mid-spec would add its own QUEST DONE credit to a card a spec is measuring. The suite's storageState carries the
// key (playwright.config.js); production never has it.
function offForE2e() {
  if (typeof window === 'undefined') return false;
  if (window.__TAW_NO_QUESTS) return true;
  try { return localStorage.getItem('taw.e2e.noQuests') === '1'; } catch { return false; }
}

/** Handle one game event (contracts/bus.js shape). Never throws. */
export function handle(ev) {
  if (offForE2e()) return;
  if (!ev || !ev.type) return;
  try {
    const cur = today();
    const { state, ticks: moved } = applyEvent(cur, ev);
    for (const t of moved) {
      const prev = ticks.get(t.id);
      ticks.set(t.id, { ...t, from: prev ? prev.from : t.from });
    }
    let next = state;
    if (ev.type === 'game') next = settle(state, ev);
    if (next !== cur) write(next);
    if (ev.type === 'game') {
      try { window.dispatchEvent(new CustomEvent(QUESTS_RESULT, { detail: lastResult })); } catch { /* node */ }
    }
  } catch {
    /* a quest failure never reaches a game */
  }
}

/** Tests: a fresh session. */
export function __reset() {
  ticks = new Map();
  lastEndMark = 0;
  lastResult = null;
  mem = null;
}
