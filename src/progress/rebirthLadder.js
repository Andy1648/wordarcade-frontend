// rebirthLadder.js — the REBIRTH LADDER chips on Stats (claude/specs/rebirth-ladder.md, simplest
// version, dormant behind ?ladder=1). Pure: BASE, NOW, NEXT as display strings. It READS the live
// rebirthMult / rebirthThreshold (never a copied table) so the chips always agree with the Shop's
// rebirth line. At R0 BASE is NOW, so there are two chips.
import { formatMult, formatNum } from '../format.js';
import { rebirthMult, rebirthThreshold } from './xp.js';

// A whole multiplier stays whole; above ×10 a fractional tail is noise (no "×27.98").
const mult = (m) => `×${formatMult(m >= 10 ? Math.round(m) : m)}`;

export function rebirthLadder(rebirths, { multOf = rebirthMult, gateOf = rebirthThreshold } = {}) {
  const rc = Number.isFinite(rebirths) && rebirths > 0 ? Math.floor(rebirths) : 0;
  const now = multOf(rc);
  const next = multOf(rc + 1);
  const gain = now > 0 ? Math.round((next / now - 1) * 100) : 0;
  const chips = [];
  if (rc > 0) chips.push({ id: 'base', state: 'past', name: 'BASE', mult: mult(multOf(0)) });
  chips.push({ id: 'now', state: 'now', name: rc > 0 ? `R${formatNum(rc)}` : 'BASE', mult: mult(now) });
  chips.push({
    id: 'next',
    state: 'next',
    name: `R${formatNum(rc + 1)}`,
    mult: mult(next),
    gate: `LV ${formatNum(gateOf(rc))}`,
    gain: `+${formatNum(gain)}%`,
  });
  return chips;
}
