// GearSlotCrit.jsx — YOUR GEAR's ONE extra line: the worn gear's CRIT RATE ("+6% CRIT"), printed by the SAME
// formatter the GEAR SHEET uses (critText.critLines over critStatsOf), so the slot and the sheet never disagree.
// LAZY (MenuNav): the crit WORDS stay out of the menu's eager chunk (payload ratchet); the slot holds the line's
// height until it lands. CRIT POWER is left to the sheet (one compact line only).
import { critStatsOf } from '../progress/markRollsCore';
import { critLines } from '../progress/critText';

export default function GearSlotCrit({ id }) {
  const line = critLines(critStatsOf(id)).find((l) => l.id === 'rate');
  if (!line) return null;
  return (
    <span className="hp-gear-crit" data-testid="gear-crit">
      <span className="hp-gear-crit-num">{line.num}</span> <span className="hp-gear-crit-k">CRIT</span>
    </span>
  );
}
