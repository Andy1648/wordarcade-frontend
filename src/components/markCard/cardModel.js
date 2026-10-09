// cardModel.js — what a ROLL v1 mark card says (Andy oct5 mockup, claude/mockups/roll-v1/MarkCard.dc.html), PURE:
// no DOM, no storage of its own (the caller passes the roll state it snapshotted). Every number goes through
// formatNum. NUMBERS FIRST: the stat is split into its number ("×1.5", "+2.5", "+30s") printed big, and what it
// touches ("WINS", "BASE WINS/WORD") printed small — the same text as markRolls.mainTag, so nothing new is claimed.
import { MARK_TIERS } from '../../progress/marks.js';
import { rollMarkById, oneInX, mainTag, markLevel, critStatsOf } from '../../progress/markRolls.js';
import { critLines } from '../../progress/critText.js';
import { PERKS } from '../../progress/markPerks.js';
import { formatNum } from '../../format.js';

const PERK_TIERS = new Set(['legendary', 'mythic', 'secret']);
/** EPIC and up (and PERMANENT) earn the glow, the shine sweep and the cog spin. */
export const HI_TIERS = new Set(['epic', 'legendary', 'mythic', 'secret', 'permanent']);

/** "×1.5 WINS" → { num: '×1.5', kind: 'WINS' }; "+2.5 BASE WINS/WORD" → { num: '+2.5', kind: 'BASE WINS/WORD' }. */
export function splitTag(tag) {
  const s = String(tag || '').trim();
  const i = s.indexOf(' ');
  return i < 0 ? { num: s, kind: '' } : { num: s.slice(0, i), kind: s.slice(i + 1) };
}
/** The card's perk chip: one perk → its line ("LETTERS COUNT ×2"); several → their names ("WILDFIRE + HEIRLOOM"). */
export function perkText(id) {
  const m = rollMarkById(id);
  const ps = m ? m.perks : [];
  if (!ps.length || !PERK_TIERS.has(m.tier)) return '';
  if (ps.length === 1) return PERKS[ps[0]] ? PERKS[ps[0]].line : ps[0];
  return ps.map((p) => (PERKS[p] ? PERKS[p].name : p)).join(' + ');
}
/** Each perk's full line, one per perk (the detail sheet's PERK panel): ["FRENZY IN EVERY MODE", …]. */
export function perkLines(id) {
  const m = rollMarkById(id);
  return m ? m.perks.map((p) => (PERKS[p] ? PERKS[p].line : p)) : [];
}
/** How many perks the card shows (LEGENDARY+ only, as perkText). */
export function perkCount(id) {
  const m = rollMarkById(id);
  return m && m.perks.length && PERK_TIERS.has(m.tier) ? m.perks.length : 0;
}
/** "7/10 → ★3" (dupes toward the next ★); '' at ★5. */
export function pipNext(lv) {
  if (!lv || !lv.need) return '';
  return `${formatNum(lv.have)}/${formatNum(lv.need)} → ★${formatNum(lv.pips + 1)}`;
}
export function tierLabel(tier, kind = 'roll') {
  if (kind === 'perm' || tier === 'permanent') return 'EARNED'; // the LABEL only (Andy oct8: "PERMANENT sounds awful"); the tier id 'permanent' stays in data + save keys
  return MARK_TIERS[tier] ? MARK_TIERS[tier].name : String(tier || '').toUpperCase();
}
/**
 * The card for one mark. kind: 'roll' (rollable — odds + ★ pips), 'perm' (EARNED), 'retired' (an old mark the save
 * still owns). state: the roll state (pips + stat).
 *
 * GEAR TILE v2 (Andy oct9): the tile shows the MAIN STAT as its hero and a quiet pip row (a dot per extra stat, ✦ for
 * a perk, ★ per dupe pip); the crit / perk lines and the odds live in the detail sheet. LOCKED is a HIDDEN design
 * ("including stats"): no stat value anywhere — the hero slot says the ODDS ("1 IN 90") and the pip row a "?" per
 * hidden extra stat. A locked card's model carries no stat numbers at all, so no screen can print one.
 */
export function cardModel({ id, kind = 'roll', tier, name = '', locked = false, state = null }) {
  // EARNED gears (Andy oct8): they sit WITH the normal rarities — drawn as the LEGENDARY they pay (MAIN ×3), not a
  // tier of their own; a locked one says ACHIEVEMENT where a rolled card says its odds
  const t = kind === 'perm' ? 'legendary' : tier || 'common';
  const { num, kind: statKind } = locked ? { num: '', kind: '' } : splitTag(mainTag(id, state));
  const lv = kind === 'roll' && !locked ? markLevel(state, id) : null;
  // CRIT (Andy oct8): the gear's EXTRA stats. A locked card knows only HOW MANY it has (at ★0), never their values.
  const crit = kind === 'retired' ? { rate: 0, power: 0 } : critStatsOf(id, locked ? null : state);
  const extras = (crit.rate > 0 ? 1 : 0) + (crit.power > 0 ? 1 : 0);
  return {
    crit: !locked && extras ? crit : null,
    critLines: locked ? [] : critLines(crit), // the full lines (detail sheet): "+6% CRIT RATE" · "+0.5× CRIT POWER"
    extras, // how many extra stats the gear has (a pip each on the tile — a "?" when locked)
    tier: t,
    rarityName: kind === 'perm' ? tierLabel('legendary') : tierLabel(t, kind),
    odds: kind === 'roll' ? `1 IN ${formatNum(oneInX(id))}` : kind === 'perm' ? (locked ? 'ACHIEVEMENT' : 'EARNED') : '',
    oddsNum: kind === 'roll' ? formatNum(oneInX(id)) : '', // a LOCKED rollable tile's hero: "1 IN" small + this big
    earned: kind === 'perm',
    locked,
    name: locked && kind !== 'perm' ? '???' : name, // an EARNED gear is not a mystery roll: its name shows
    statNum: num,
    statKind,
    perk: perkText(id),
    perks: perkCount(id), // ✦ per perk on the tile ("1 PERK" / "2 PERKS" in a locked sheet)
    pips: lv ? lv.pips : null,
    copies: lv ? lv.copies : 0, // dupes print as a small ×N on the art
    next: pipNext(lv),
    hi: HI_TIERS.has(t),
  };
}
/**
 * The tile's quiet pip row, in order: a dot per extra stat, ✦ for a perk, then a ★ per dupe pip. LOCKED: a "?" per
 * hidden extra stat and the ✦ (that a perk EXISTS is part of the rarity, like the counts in the sheet) — no ★.
 * → [{ k: 'stat' | 'hidden' | 'perk' | 'star' }]
 */
export function tilePips(c) {
  const out = [];
  for (let i = 0; i < c.extras; i += 1) out.push({ k: c.locked ? 'hidden' : 'stat' });
  for (let i = 0; i < (c.perks || 0); i += 1) out.push({ k: 'perk' });
  if (!c.locked) for (let i = 0; i < (c.pips || 0); i += 1) out.push({ k: 'star' });
  return out;
}
/** "2 EXTRA STATS · 1 PERK · ★3" — the pip row read aloud (stars: false → the counts only, the locked sheet's line). */
export function pipsLabel(c, { stars = true } = {}) {
  const parts = [];
  if (c.extras) parts.push(`${formatNum(c.extras)} EXTRA STAT${c.extras > 1 ? 'S' : ''}`);
  if (c.perks) parts.push(`${formatNum(c.perks)} PERK${c.perks > 1 ? 'S' : ''}`);
  if (stars && !c.locked && c.pips) parts.push(`★${formatNum(c.pips)}`);
  return parts.join(' · ');
}
