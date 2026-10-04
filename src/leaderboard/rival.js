// rival.js — extensions-spec a (RIVAL PINGS), the pure half. Dormant behind flagOn('rival').
// "XAVI PASSED YOU · #5 → #6 · 2 LV BEHIND": a named, catchable loss on the menu, shown as a variant of
// the rank-up card. No DOM, no storage, no fetch — node:test covers every decision here.
// The board ranks REBIRTHS first, then level, then words (PR #178, Andy oct3 19:55), so every gap here is
// { rebirths, levels } in that order — the same shape as nextTarget in boardTarget.js.
import { formatNum } from '../format.js';

/** Only a catchable gap pings (Andy: don't overdo it — a stranger 3,000 ranks away is noise). */
export const RIVAL_MAX_RANK = 50;
export const RIVAL_MAX_GAP = 5; // levels — applies only when the rebirths are equal
export const RIVAL_MAX_RB_GAP = 1; // a passer more than one rebirth ahead is not catchable
export const RIVAL_PER_DAY = 3;

/** 'rise' | 'drop' | null — the board move between the last rank this browser saw and now. */
export function rankChange(before, now) {
  const b = Number(before);
  const n = Number(now);
  if (!(b > 0) || !(n > 0) || b === n) return null;
  return n < b ? 'rise' : 'drop';
}

/**
 * True when MY OWN standing changed under me since the last check — a rebirth (count changed; rebirths
 * lead the board and the level resets to 1 in the same moment) or a reset (rebirths or level fell). A
 * rank move across either may be my own doing, not a pass: never ping.
 * A missing baseline is treated as "can't tell" → suppressed (fairness beats one ping).
 */
export function ownDropSince(prev, cur) {
  if (!prev || !cur) return true;
  const pr = Number(prev.rb);
  const pl = Number(prev.lv);
  if (!Number.isFinite(pr) || !Number.isFinite(pl)) return true;
  if ((Number(cur.rb) || 0) !== pr) return true;
  return (Number(cur.lv) || 0) < pl;
}

/** How many levels the passer is ahead (0 = level-tied, words decide). */
export function levelGap(passerLevel, myLevel) {
  return Math.max(0, Math.floor((Number(passerLevel) || 0) - (Number(myLevel) || 0)));
}

/**
 * How far ahead the passer is, in the board's order: { rebirths, levels }. rebirths > 0 → levels is 0
 * (a level gap means nothing until the rebirths match), exactly like nextTarget in boardTarget.js.
 * @param {{rebirths?:number, level?:number}|null} passer  the board row above me
 * @param {{rb?:number, lv?:number}|null} me               my rebirths/level now
 */
export function rivalGap(passer, me) {
  const p = passer || {};
  const m = me || {};
  const rebirths = Math.max(0, Math.floor((Number(p.rebirths) || 0) - (Number(m.rb) || 0)));
  const levels = rebirths > 0 ? 0 : levelGap(p.level, m.lv);
  return { rebirths, levels };
}

/**
 * Should this menu visit show a rival ping? Pure.
 * @param {object} a
 * @param {number} a.before   last rank this browser saw
 * @param {number} a.now      live rank
 * @param {{rb:number, lv:number}|null} a.prev  my rebirths/level at the last check
 * @param {{rb:number, lv:number}} a.cur        my rebirths/level now
 * @param {{username:string, level:number, rebirths?:number}|null} a.passer  the row just above me now
 * @param {{day?:string, n?:number, last?:string}|null} a.log  pings shown (per day) + the last passer
 * @param {string} a.today  YYYY-MM-DD
 * @returns {{ name:string, from:number, to:number, rebirths:number, levels:number } | null}
 */
export function rivalPing({ before, now, prev, cur, passer, log, today }) {
  if (rankChange(before, now) !== 'drop') return null;
  if (ownDropSince(prev, cur)) return null;
  if (Number(now) > RIVAL_MAX_RANK) return null;
  const name = passer && typeof passer.username === 'string' ? passer.username.trim() : '';
  if (!name) return null;
  const { rebirths, levels } = rivalGap(passer, cur);
  if (rebirths > RIVAL_MAX_RB_GAP) return null;
  if (rebirths === 0 && levels > RIVAL_MAX_GAP) return null; // the level rule counts only at equal rebirths
  const l = log || {};
  if (l.last && l.last.toLowerCase() === name.toLowerCase()) return null; // never the same passer twice in a row
  if (l.day === today && (Number(l.n) || 0) >= RIVAL_PER_DAY) return null;
  return { name, from: Number(before), to: Number(now), rebirths, levels };
}

/** The log after showing a ping for `name` today. */
export function nextRivalLog(log, name, today) {
  const l = log || {};
  const n = l.day === today ? (Number(l.n) || 0) + 1 : 1;
  return { day: today, n, last: name };
}

/**
 * The gap half of the line, rebirths first (the board's order): '1 RB BEHIND' (the short "RB" of
 * targetLine's phone strip), else '2 LV BEHIND', else the board's level-tied wording (boardTarget.js).
 */
export function rivalGapLine(levels, rebirths = 0) {
  const rb = Math.max(0, Math.floor(Number(rebirths) || 0));
  if (rb > 0) return `${formatNum(rb)} RB BEHIND`;
  const n = Number(levels) || 0;
  return n === 0 ? 'LEVEL-TIED · MORE WORDS TAKE IT' : `${formatNum(n)} LV BEHIND`;
}

/** The same gap for the screen-reader status line, with "RB" / "LV" spelled out. */
export function rivalGapSpoken(levels, rebirths = 0) {
  const rb = Math.max(0, Math.floor(Number(rebirths) || 0));
  if (rb > 0) return `${formatNum(rb)} rebirth${rb === 1 ? '' : 's'} behind`;
  const n = Math.max(0, Math.floor(Number(levels) || 0));
  return n === 0 ? 'level-tied, more words take it' : `${formatNum(n)} level${n === 1 ? '' : 's'} behind`;
}

/** The card's copy: { title: 'XAVI PASSED YOU', sub: '#5 → #6 · 2 LV BEHIND' }. Every number via formatNum. */
export function rivalCopy({ name, from, to, levels, rebirths = 0 }) {
  const gap = rivalGapLine(levels, rebirths);
  return {
    title: `${String(name).toUpperCase()} PASSED YOU`,
    sub: `#${formatNum(from)} → #${formatNum(to)} · ${gap}`,
  };
}
