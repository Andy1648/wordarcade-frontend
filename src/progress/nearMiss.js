// nearMiss.js — EXTENSION b (claude/finetune/extensions-spec.md): the end-screen NEAR-MISS line.
// PURE — no DOM, no storage — so node:test covers every branch. nearMissData.js gathers the inputs.
//
// ONE line, the closest REAL goal only ("38 LETTERS TO LV 41" · "1 LV TO #7" · "KEY TIER 5 IN 12
// WORDS"), and only when ONE MORE RUN plausibly gets it: each goal's distance is measured in words,
// divided by the player's average words per run, and the smallest share wins if it is
// ≤ NEAR_MISS_MAX_RUNS. Otherwise null — no line (Andy #4: no useless info). Ties break
// board > level > key tier. Every number goes through formatNum.
//
// NO REBIRTH CANDIDATE: the spec lists "REBIRTH IN 2 LV" but also orders level before rebirth on a
// tie, and the rebirth gate is always at or past the next level — so under "closest goal wins" it
// could never be picked. Dead code is left out rather than shipped (Andy #2).
import { formatNum } from '../format.js';

export const NEAR_MISS_MAX_RUNS = 1.0; // "one more run gets it"
export const LETTERS_PER_WORD = 5; // = wins.js WORD_LEN_REF — the reference word every rate is quoted for
const ORDER = ['board', 'level', 'key'];
const EPS = 1e-9;

const num = (x, d = 0) => (Number.isFinite(Number(x)) ? Number(x) : d);

/**
 * The share of level `lv` one reference word moves the bar: the word's XP over that level's need,
 * floored at the game-word bar floor (barFloor.js) when one is given. 0 when unknowable.
 */
export function wordShareAt(lv, { need, xpPerWord, floorFrac } = {}) {
  const n = typeof need === 'function' ? num(need(lv)) : num(need);
  const raw = n > 0 ? num(xpPerWord) / n : 0;
  const floor = typeof floorFrac === 'function' ? num(floorFrac(lv)) : 0;
  const s = Math.max(raw, floor);
  return s > 0 && Number.isFinite(s) ? s : 0;
}

/**
 * Words to climb `levels` levels from (level, frac). Infinity when a level can't be priced or the
 * total passes `cap` (an early out: past the cap the answer is "not this run" anyway).
 */
export function wordsToLevels({ level, frac = 0, levels = 1, cap = Infinity, ...share }) {
  const lv0 = Math.max(1, Math.floor(num(level, 1)));
  const f = Math.min(1, Math.max(0, num(frac)));
  const k = Math.floor(num(levels));
  if (!(k >= 1)) return 0;
  let words = 0;
  for (let i = 0; i < k; i++) {
    const s = wordShareAt(lv0 + i, share);
    if (!(s > 0)) return Infinity;
    words += (i === 0 ? 1 - f : 1) / s;
    if (words > cap) return Infinity;
  }
  return words;
}

/**
 * The one near-miss line, or null.
 * @param {object} p
 * @param {number} p.level        current level
 * @param {number} p.frac         0..1 into it
 * @param {(lv:number)=>number|number} p.need  XP to finish a level (fn of level, or one number)
 * @param {number} p.xpPerWord    XP one reference word pays in this mode
 * @param {(lv:number)=>number} [p.floorFrac]  the game-word bar floor, as a share of a level
 * @param {number} p.avgWords     average accepted words per run
 * @param {{rank:number, aboveRank:number, aboveLevel:number}} [p.board]  me + the row above, if known
 * @param {{tier:number, cost:number, balance:number, rate:number}} [p.key]  next KEY tier: wins cost,
 *        wins on hand, wins per word
 * @returns {{ kind:'board'|'level'|'key', text:string, words:number, runs:number } | null}
 */
export function nearMiss(p = {}) {
  const avgWords = num(p.avgWords);
  if (!(avgWords > 0)) return null;
  const level = Math.max(1, Math.floor(num(p.level, 1)));
  const frac = Math.min(1, Math.max(0, num(p.frac)));
  const share = { need: p.need, xpPerWord: p.xpPerWord, floorFrac: p.floorFrac };
  const cap = avgWords * NEAR_MISS_MAX_RUNS;
  const climb = (levels) => wordsToLevels({ level, frac, levels, cap, ...share });
  const out = [];

  // BOARD — the row directly above me (boardTarget.nextTarget's target). Level-tied = words decide,
  // which isn't a number we can promise, so it's skipped.
  const b = p.board;
  if (b && num(b.rank) > 1 && num(b.aboveRank) >= 1 && Number.isFinite(Number(b.aboveLevel))) {
    const levels = Math.floor(num(b.aboveLevel)) - level;
    if (levels >= 1) out.push({ kind: 'board', words: climb(levels), text: `${formatNum(levels)} LV TO #${formatNum(num(b.aboveRank))}` });
  }

  // LEVEL — quoted in LETTERS (XP is paid per letter; the menu hint says the same).
  const lvWords = climb(1);
  if (Number.isFinite(lvWords)) {
    const letters = Math.max(1, Math.ceil(lvWords * LETTERS_PER_WORD - EPS));
    out.push({ kind: 'level', words: lvWords, text: `${formatNum(letters)} LETTER${letters === 1 ? '' : 'S'} TO LV ${formatNum(level + 1)}` });
  }

  // KEY TIER — quoted in WORDS (wins are quoted per word). Already affordable isn't a near miss.
  const k = p.key;
  if (k) {
    const short = num(k.cost) - num(k.balance);
    const rate = num(k.rate);
    if (short > 0 && rate > 0) {
      const words = short / rate;
      const w = Math.max(1, Math.ceil(words - EPS));
      out.push({ kind: 'key', words, text: `KEY TIER ${formatNum(Math.max(0, Math.floor(num(k.tier))) + 1)} IN ${formatNum(w)} WORD${w === 1 ? '' : 'S'}` });
    }
  }

  let best = null;
  for (const c of out) {
    if (!Number.isFinite(c.words)) continue;
    c.runs = c.words / avgWords;
    if (c.runs > NEAR_MISS_MAX_RUNS + EPS) continue;
    if (!best || c.runs < best.runs - EPS || (Math.abs(c.runs - best.runs) <= EPS && ORDER.indexOf(c.kind) < ORDER.indexOf(best.kind))) best = c;
  }
  return best;
}

/** The running average of letters per run (a smoothed EMA, so one odd run doesn't swing it). */
export const AVG_WEIGHT = 0.3;
export function nextAvg(prevAvg, runLetters) {
  const run = num(runLetters);
  const prev = num(prevAvg);
  if (!(run > 0)) return prev > 0 ? prev : 0;
  if (!(prev > 0)) return run;
  return prev * (1 - AVG_WEIGHT) + run * AVG_WEIGHT;
}
