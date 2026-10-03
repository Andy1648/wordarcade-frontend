// rival.js — extensions-spec a (RIVAL PINGS), the pure half. Dormant behind flagOn('rival').
// "XAVI PASSED YOU · #5 → #6 · 2 LV BEHIND": a named, catchable loss on the menu, shown as a variant of
// the rank-up card. No DOM, no storage, no fetch — node:test covers every decision here.
import { formatNum } from '../format.js';

/** Only a catchable gap pings (Andy: don't overdo it — a stranger 3,000 ranks away is noise). */
export const RIVAL_MAX_RANK = 50;
export const RIVAL_MAX_GAP = 5;
export const RIVAL_PER_DAY = 3;

/** 'rise' | 'drop' | null — the board move between the last rank this browser saw and now. */
export function rankChange(before, now) {
  const b = Number(before);
  const n = Number(now);
  if (!(b > 0) || !(n > 0) || b === n) return null;
  return n < b ? 'rise' : 'drop';
}

/**
 * True when MY OWN progress went backwards since the last check — a rebirth (count changed) or a reset
 * (level fell). The board ranks by level only, so either looks exactly like being passed: never ping.
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
 * Should this menu visit show a rival ping? Pure.
 * @param {object} a
 * @param {number} a.before   last rank this browser saw
 * @param {number} a.now      live rank
 * @param {{rb:number, lv:number}|null} a.prev  my rebirths/level at the last check
 * @param {{rb:number, lv:number}} a.cur        my rebirths/level now
 * @param {{username:string, level:number}|null} a.passer  the row just above me now
 * @param {{day?:string, n?:number, last?:string}|null} a.log  pings shown (per day) + the last passer
 * @param {string} a.today  YYYY-MM-DD
 * @returns {{ name:string, from:number, to:number, levels:number } | null}
 */
export function rivalPing({ before, now, prev, cur, passer, log, today }) {
  if (rankChange(before, now) !== 'drop') return null;
  if (ownDropSince(prev, cur)) return null;
  if (Number(now) > RIVAL_MAX_RANK) return null;
  const name = passer && typeof passer.username === 'string' ? passer.username.trim() : '';
  if (!name) return null;
  const levels = levelGap(passer.level, cur.lv);
  if (levels > RIVAL_MAX_GAP) return null;
  const l = log || {};
  if (l.last && l.last.toLowerCase() === name.toLowerCase()) return null; // never the same passer twice in a row
  if (l.day === today && (Number(l.n) || 0) >= RIVAL_PER_DAY) return null;
  return { name, from: Number(before), to: Number(now), levels };
}

/** The log after showing a ping for `name` today. */
export function nextRivalLog(log, name, today) {
  const l = log || {};
  const n = l.day === today ? (Number(l.n) || 0) + 1 : 1;
  return { day: today, n, last: name };
}

/** The gap half of the line: '2 LV BEHIND', or the board's level-tied wording (boardTarget.js). */
export function rivalGapLine(levels) {
  const n = Number(levels) || 0;
  return n === 0 ? 'LEVEL-TIED · MORE WORDS TAKE IT' : `${formatNum(n)} LV BEHIND`;
}

/** The card's copy: { title: 'XAVI PASSED YOU', sub: '#5 → #6 · 2 LV BEHIND' }. Every number via formatNum. */
export function rivalCopy({ name, from, to, levels }) {
  const gap = rivalGapLine(levels);
  return {
    title: `${String(name).toUpperCase()} PASSED YOU`,
    sub: `#${formatNum(from)} → #${formatNum(to)} · ${gap}`,
  };
}
