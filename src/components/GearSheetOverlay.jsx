// GearSheetOverlay.jsx — YOUR GEAR → its stats (Andy oct9: "clicking the 'your gear' should show the gear stats not
// go to roll"). The worn gear's GEAR SHEET (GearSheet.jsx — the very sheet the INDEX opens on a tap, so every number
// matches) over the menu. LAZY (Homepage loads it on the tap): the menu payload carries none of the sheet / card code.
// It mounts in the MARKS overlay slot (Homepage `showMarks === 'gear'`), so the menu's overlay rules (pager blocked,
// moments held, claim popup + tutorials hidden) apply as they do for ROLL / INDEX. ✕, a tap outside and Esc close it.
// Storage is snapshotted on mount, as the INDEX does.
import { useEffect, useRef, useState } from 'react';
import { markById } from '../progress/marks';
import { viewState, rollMarkById, PERMANENT_MARKS } from '../progress/markRolls';
import { wearMark } from '../progress/markRollShop';
import GearSheet from './GearSheet';

/** The sheet's entry for any worn id: a rolled gear, an EARNED one (drawn LEGENDARY), or a retired legacy mark. */
export function gearEntry(id) {
  const r = rollMarkById(id);
  if (r) return { id, name: r.name, tier: r.tier, kind: 'roll' };
  const p = PERMANENT_MARKS.find((m) => m.id === id);
  if (p) return { id, name: p.name, tier: 'legendary', kind: 'perm' };
  const m = markById(id);
  return m ? { id, name: m.name, tier: m.tier, kind: 'retired' } : null;
}

// a full-screen layer: the menu beneath never reacts to the pointer (as the INDEX / ROLL screens)
const stopPointer = (e) => e.stopPropagation();

export default function GearSheetOverlay({ markId, unlockedIds = [], earned = [], onEquip, onClose }) {
  const [snap] = useState(() => ({ view: viewState(unlockedIds), e: gearEntry(markId) }));
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const onKey = (ev) => { if (ev.key === 'Escape' && onCloseRef.current) onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (!snap.e && onCloseRef.current) onCloseRef.current(); }, [snap.e]);
  if (!snap.e) return null;
  // TAKE OFF from here leaves nothing to show: the sheet closes with it
  const set = onEquip ? (id) => {
    const w = wearMark(id, earned);
    onEquip(w);
    if (w !== markId) onClose();
  } : null;
  return (
    <div className="gs-overlay" data-testid="gear-sheet" onPointerMove={stopPointer} onMouseMove={stopPointer}>
      <GearSheet e={snap.e} have on view={snap.view} howTo="" onSet={set} onClose={onClose} />
    </div>
  );
}
