// RollShowcase.jsx — the ROLL screen's empty band, filled with DESIGN not mechanics (Andy oct15 night "a good amount of
// empty space there ... not saying i need mechanics but like some design"). Research (Genshin / Pet Sim / TCG Pocket
// pull screens): show what you're CHASING and how far your COLLECTION has come.
//   THE CHASE — the rarest gear you don't own yet (SECRET / MYTHIC / LEGENDARY), as real MarkCards fanned like a hand
//               just dealt (the patch-notes composition), each with its rarity glow (GearFx, sanctioned on this screen).
//   COLLECTION — per-tier FOUND n/m chips in the tier colours.
// Pure view of state the screen already holds; nothing here rolls, charges or saves. Shown only where the stage has
// room (RollScreen.css hides each part on short / narrow screens).
import { useMemo } from 'react';
import MarkCard from '../markCard/MarkCard';
import { CARD_RAR } from '../markCard/palette.js';
import { ROLL_MARKS } from '../../progress/markRollsCore';

const CHASE_TIERS = ['legendary', 'secret', 'mythic']; // left → right; the SECRET sits in the middle, on top
const TIERS = ['rare', 'epic', 'legendary', 'mythic', 'secret'];

function owns(view, id) {
  return !!(view && view.marks && view.marks[id]);
}

export function ChaseFan({ view }) {
  const chase = useMemo(() => CHASE_TIERS.map((t) => {
    const all = ROLL_MARKS.filter((m) => m.tier === t);
    return all.find((m) => !owns(view, m.id)) || all[0] || null;
  }).filter(Boolean), [view]);
  if (!chase.length) return null;
  return (
    <div className="rsx-chase" aria-hidden="true">
      <span className="rsx-chase-k">THE CHASE</span>
      <div className="rsx-fan">
        {chase.map((m, i) => (
          <div key={m.id} className={`rsx-fan-card is-${i}`}>
            <MarkCard id={m.id} tier={m.tier} name={m.name} state={view} fx className="rsx-card" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CollectionStrip({ view }) {
  const rows = useMemo(() => TIERS.map((t) => {
    const all = ROLL_MARKS.filter((m) => m.tier === t);
    return { t, n: all.filter((m) => owns(view, m.id)).length, of: all.length };
  }).filter((r) => r.of > 0), [view]);
  return (
    <div className="rsx-coll" aria-label="Collection">
      <span className="rsx-coll-k">FOUND</span>
      {rows.map((r) => (
        <span key={r.t} className={`rsx-chip${r.n === r.of ? ' is-done' : ''}`} style={{ '--t': CARD_RAR[r.t].line, '--te': CARD_RAR[r.t].edge }}>
          <span className="rsx-chip-t">{r.t.toUpperCase()}</span>
          <span className="rsx-chip-n">{r.n}<i>/{r.of}</i></span>
          <span className="rsx-chip-bar"><span style={{ transform: `scaleX(${r.of ? r.n / r.of : 0})` }} /></span>
        </span>
      ))}
    </div>
  );
}
