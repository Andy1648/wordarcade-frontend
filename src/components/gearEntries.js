// gearEntries.js — which gears exist and which the save OWNS, shared by the INDEX (MarksIndex.jsx — the catalogue:
// everything, owned and locked) and the EQUIP screen (EquipScreen.jsx — owned only). Pure reads of the roll state the
// caller snapshotted (viewState) + the owned legacy / EARNED ids; no storage of its own.
import { markById } from '../progress/marks';
import { ROLL_MARKS, PERMANENT_MARKS, RETIRED_MARK_IDS, markLevel, rollMarkById, viewState, permanentOwnedIds } from '../progress/markRolls';
import { UNLISTED_GEARS, isFindable, unlistedById } from '../unlisted/unlisted.js';
import { ownsUnlistedId } from '../unlisted/unlistedIds.js';

/** Every gear the INDEX draws, in order: rollable (rare → secret) with the EARNED gears right after the LEGENDARY
 *  ones (Andy oct8: "put them with the normal rarity gears" — they pay the LEGENDARY ×3 and draw as legendary, locked
 *  = ACHIEVEMENT), then retired-but-owned. → [{ id, name, tier, kind: 'roll' | 'perm' | 'retired', from? }] */
export function buildEntries(unlocked) {
  const out = [];
  const perms = PERMANENT_MARKS.filter((p) => !p.retired || unlocked.has(p.id)).map((p) => ({ id: p.id, name: p.name, tier: 'legendary', kind: 'perm', from: p.from, ach: p.ach }));
  const lastLeg = ROLL_MARKS.map((m) => m.tier).lastIndexOf('legendary');
  ROLL_MARKS.forEach((m, i) => {
    out.push({ id: m.id, name: m.name, tier: m.tier, kind: 'roll' });
    if (i === lastLeg) out.push(...perms);
  });
  if (lastLeg < 0) out.push(...perms);
  // THE UNLISTED (Andy oct17: "a different rarity with just black … just add them"): after SECRET, as their own black
  // rarity. Found, never rolled — a locked one shows its art + name; HOW TO FIND is in the sheet. A season gear nobody
  // found in its season is gone (unless owned).
  for (const g of UNLISTED_GEARS) {
    if (isFindable(g) || ownsUnlistedId(g.id)) out.push({ id: g.id, name: g.name, tier: 'unlisted', kind: 'unlisted', riddle: g.riddle, season: g.season });
  }
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
  if (e.kind === 'unlisted') return ownsUnlistedId(e.id);
  return unlocked.has(e.id);
}

/** The sheet's entry for any worn id: a rolled gear, an EARNED one (drawn LEGENDARY), or a retired legacy mark. */
export function gearEntry(id) {
  const r = rollMarkById(id);
  if (r) return { id, name: r.name, tier: r.tier, kind: 'roll' };
  const p = PERMANENT_MARKS.find((m) => m.id === id);
  if (p) return { id, name: p.name, tier: 'legendary', kind: 'perm', from: p.from, ach: p.ach };
  const u = unlistedById(id);
  if (u) return { id, name: u.name, tier: 'unlisted', kind: 'unlisted', riddle: u.riddle, season: u.season };
  const m = markById(id);
  return m ? { id, name: m.name, tier: m.tier, kind: 'retired' } : null;
}

/** Does THIS save own `e`? — the INDEX's own test (ownsGear) against a fresh snapshot of the roll state, for a sheet
 *  opened from somewhere that has no snapshot of its own (someone else's leaderboard profile, PeekGearSheet). */
export function viewerOwnsGear(e) {
  if (!e || !e.id) return false;
  try {
    const permOwned = new Set(permanentOwnedIds());
    return ownsGear(e, { view: viewState(), unlocked: permOwned, permOwned });
  } catch {
    return false; // unreadable save → locked, never a leak
  }
}
