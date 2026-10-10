// EquipScreen.jsx — YOUR GEAR → the EQUIP screen (Andy oct9 22:56: "everything can be shown on the index page - the
// equip gear page will be separate in the 'your gear' icon"; "instead of the word 'main' we'll just equip and
// unequip"). The INDEX is the catalogue (everything, owned and locked); THIS is the locker: OWNED gears only, the
// equipped one pinned first wearing an EQUIPPED sticker. A tap opens the GEAR SHEET (GearSheet.jsx — the INDEX's
// sheet, one set of numbers) with one big EQUIP / UNEQUIP button. No sentences.
//
// LAZY (Homepage loads it on the tap): it mounts in the MARKS overlay slot (`showMarks === 'gear'`), so the menu's
// overlay rules apply as they do for ROLL / INDEX. ← MENU, Esc close it (Esc closes an open sheet first).
// Storage is snapshotted on mount (as the INDEX does); the worn id is local state so EQUIP re-pins at once.
// Motion: the INDEX's — tiles lift on hover / press, the sheet pops in once, EPIC+ tiles wear the GearFx glow.
import { useEffect, useMemo, useRef, useState } from 'react';
import { markProgress, markById } from '../progress/marks';
import { viewState, permanentOwnedIds } from '../progress/markRolls';
import { wearMark } from '../progress/markRollShop';
import { registerMarkGlyphs } from './MarkBadge';
import { ROLLED_GLYPHS, GLYPH_FINISH } from './markGlyphsRolled.jsx';
import MarkCard from './markCard/MarkCard';
import GearSheet from './GearSheet';
import GearFx from './GearFx';
import { GLOW_TIERS } from './markCard/idleSheen.js';
import { tierLabel } from './markCard/cardModel.js';
import { buildEntries, ownsGear } from './gearEntries.js';
import { formatNum } from '../format';
import './MarksIndex.css';
import './EquipScreen.css';

registerMarkGlyphs(ROLLED_GLYPHS, GLYPH_FINISH);

const TILE_PARTS = { tier: 'mx-tile-tier', name: 'mx-tile-name', stat: 'mx-tile-sub' };
const TIER_ORDER = { secret: 0, mythic: 1, legendary: 2, epic: 3, rare: 4, common: 5 };
const rankOf = (id) => (markById(id) ? markProgress(id).rank : 1);
// a full-screen layer: the menu beneath never reacts to the pointer (as the INDEX / ROLL screens)
const stopPointer = (e) => e.stopPropagation();

export default function EquipScreen({ equippedId = null, unlockedIds = [], earned = [], onEquip, onClose }) {
  const idsRef = useRef(unlockedIds);
  const [snap] = useState(() => {
    const ids = idsRef.current;
    const unlocked = new Set(ids);
    const view = viewState(ids);
    const permOwned = new Set(permanentOwnedIds());
    const ctx = { view, unlocked, permOwned };
    // the locker: OWNED only, rarest first (the INDEX keeps the catalogue order)
    const owned = buildEntries(unlocked).filter((e) => ownsGear(e, ctx));
    owned.sort((a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9));
    return { view, owned };
  });
  const { view, owned } = snap;
  const [worn, setWorn] = useState(equippedId);
  const [sel, setSel] = useState(null);
  // the equipped one PINNED first
  const list = useMemo(() => {
    const on = owned.find((e) => e.id === worn);
    return on ? [on, ...owned.filter((e) => e !== on)] : owned;
  }, [owned, worn]);
  const closeRef = useRef(null);
  const selRef = useRef(sel);
  selRef.current = sel;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (ev) => {
      if (ev.key !== 'Escape') return;
      if (selRef.current) setSel(null);
      else if (onCloseRef.current) onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const set = (id) => {
    const w = wearMark(id, earned);
    setWorn(w);
    if (onEquip) onEquip(w);
  };
  const selE = sel ? owned.find((e) => e.id === sel) : null;

  return (
    <div className="marks-overlay mx-overlay eq-overlay" data-testid="equip-screen" role="dialog" aria-modal="true" aria-label="Your gear" onPointerMove={stopPointer} onMouseMove={stopPointer}>
      <div className="mx-panel eq-panel">
        <div className="mx-head eq-head">
          <button type="button" className="mx-close marks-close mx-back" onClick={onClose} aria-label="Close" ref={closeRef}>← MENU</button>
          <div className="mx-titlewrap">
            <h2 className="mx-title eq-title">YOUR GEAR</h2>
            <span className="mx-count">{formatNum(owned.length)}</span>
            <span className="eq-count-k">OWNED</span>
          </div>
        </div>
        <div className="mx-grid eq-grid" role="list">
          {list.map((e) => {
            const on = worn === e.id;
            const shiny = !!(view && view.marks && view.marks[e.id] && view.marks[e.id].shiny);
            return (
              <div key={e.id} className="mx-cell" role="listitem">
                <button
                  type="button"
                  className={`mx-tile${on ? ' is-on' : ''}${e.kind === 'perm' ? ' is-perm' : ''}`}
                  aria-label={`${e.name}, ${tierLabel(e.tier, e.kind)}${on ? ', equipped' : ''}`}
                  aria-haspopup="dialog"
                  data-mark={e.id}
                  data-tier={e.tier}
                  onClick={() => setSel(e.id)}
                >
                  {GLOW_TIERS.has(e.tier) ? <GearFx tier={e.tier} scale={0.9} /> : null}
                  <MarkCard
                    id={e.id} kind={e.kind} tier={e.tier} name={e.name} state={view} rank={rankOf(e.id)}
                    shiny={shiny} parts={TILE_PARTS}
                  />
                  {on && <span className="mx-tile-main">EQUIPPED</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {selE ? (
        <GearSheet
          key={selE.id}
          e={selE}
          have
          on={worn === selE.id}
          view={view}
          howTo=""
          onSet={set}
          onClose={() => setSel(null)}
        />
      ) : null}
    </div>
  );
}
