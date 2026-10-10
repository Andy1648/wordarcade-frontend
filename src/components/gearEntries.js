// gearEntries.js — which gears exist and which the save OWNS, shared by the INDEX (MarksIndex.jsx — the catalogue:
// everything, owned and locked) and the EQUIP screen (EquipScreen.jsx — owned only). Pure reads of the roll state the
// caller snapshotted (viewState) + the owned legacy / EARNED ids; no storage of its own.
import { markById } from '../progress/marks';
import { ROLL_MARKS, PERMANENT_MARKS, RETIRED_MARK_IDS, markLevel, rollMarkById } from '../progress/markRolls';

/** Every gear the INDEX draws, in order: rollable (rare → secret) with the EARNED gears right after the LEGENDARY
 *  ones (Andy oct8: "put them with the normal rarity gears" — they pay the LEGENDARY ×3 and draw as legendary, locked
 *  = ACHIEVEMENT), then retired-but-owned. → [{ id, name, tier, kind: 'roll' | 'perm' | 'retired', from? }] */
export function buildEntries(unlocked) {
  const out = [];
  const perms = PERMANENT_MARKS.filter((p) => !p.retired || unlocked.has(p.id)).map((p) => ({ id: p.id, name: p.name, tier: 'legendary', kind: 'perm', from: p.from }));
  const lastLeg = ROLL_MARKS.map((m) => m.tier).lastIndexOf('legendary');
  ROLL_MARKS.forEach((m, i) => {
    out.push({ id: m.id, name: m.name, tier: m.tier, kind: 'roll' });
    if (i === lastLeg) out.push(...perms);
  });
  if (lastLeg < 0) out.push(...perms);
  for (const id of RETIRED_MARK_IDS) {
    const m = markById(id);
    if (m && unlocked.has(id)) out.push({ id, name: m.name, tier: m.tier, kind: 'retired' });
  }
  return out;
}

/** Does the save own this gear? (a rolled one: a copy in the roll state; EARNED: the achievement's mark; retired:
 *  the legacy owned list) */
export function ownsGear(e, { view, unlocked, permOwned }) {
  if (e.kind === 'roll') return markLevel(view, e.id).copies > 0 || unlocked.has(e.id);
  if (e.kind === 'perm') return permOwned.has(e.id) || unlocked.has(e.id);
  return unlocked.has(e.id);
}

/** The sheet's entry for any worn id: a rolled gear, an EARNED one (drawn LEGENDARY), or a retired legacy mark. */
export function gearEntry(id) {
  const r = rollMarkById(id);
  if (r) return { id, name: r.name, tier: r.tier, kind: 'roll' };
  const p = PERMANENT_MARKS.find((m) => m.id === id);
  if (p) return { id, name: p.name, tier: 'legendary', kind: 'perm' };
  const m = markById(id);
  return m ? { id, name: m.name, tier: m.tier, kind: 'retired' } : null;
}
