// cardModel.js — what a ROLL v1 mark card says (Andy oct5 mockup, claude/mockups/roll-v1/MarkCard.dc.html), PURE:
// no DOM, no storage of its own (the caller passes the roll state it snapshotted). Every number goes through
// formatNum. NUMBERS FIRST: the stat is split into its number ("×1.5", "+2.5", "+30s") printed big, and what it
// touches ("WINS", "BASE WINS/WORD") printed small — the same text as markRolls.mainTag, so nothing new is claimed.
import { MARK_TIERS } from '../../progress/marks.js';
import { rollMarkById, oneInX, mainTag, markLevel } from '../../progress/markRolls.js';
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
/** "7/10 → ★3" (dupes toward the next ★); '' at ★5. */
export function pipNext(lv) {
  if (!lv || !lv.need) return '';
  return `${formatNum(lv.have)}/${formatNum(lv.need)} → ★${formatNum(lv.pips + 1)}`;
}
export function tierLabel(tier, kind = 'roll') {
  if (kind === 'perm' || tier === 'permanent') return 'PERMANENT';
  return MARK_TIERS[tier] ? MARK_TIERS[tier].name : String(tier || '').toUpperCase();
}
/**
 * The card for one mark. kind: 'roll' (rollable — odds + ★ pips), 'perm' (PERMANENT — earned), 'retired' (an old
 * mark the save still owns). locked: the stat at ★0, the name hidden, no pips. state: the roll state (pips + stat).
 */
export function cardModel({ id, kind = 'roll', tier, name = '', locked = false, state = null }) {
  const t = kind === 'perm' ? 'permanent' : tier || 'common';
  const { num, kind: statKind } = splitTag(mainTag(id, locked ? null : state));
  const lv = kind === 'roll' && !locked ? markLevel(state, id) : null;
  return {
    tier: t,
    rarityName: tierLabel(t, kind),
    odds: kind === 'roll' ? `1 IN ${formatNum(oneInX(id))}` : '',
    name: locked ? '???' : name,
    statNum: num,
    statKind,
    perk: perkText(id),
    pips: lv ? lv.pips : null,
    copies: lv ? lv.copies : 0, // NIGHT oct8 #4: dupes print as a small ×N (no ★ row under the card)
    next: pipNext(lv),
    hi: HI_TIERS.has(t),
  };
}
