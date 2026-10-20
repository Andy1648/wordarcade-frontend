// winsGroup.js — the end-card receipt's rows: one per bonus KIND, capped (see WinsEarnedTotal).
const BONUS_ROWS = 3;
export function groupBonusLines(lines = []) {
  const groups = [];
  const byLabel = new Map();
  for (const l of lines) {
    if (!l || l.kind !== 'bonus' || !(l.amount > 0)) continue;
    const g = byLabel.get(l.label);
    if (g) { g.amount += l.amount; g.count += 1; continue; }
    const fresh = { id: l.id, label: l.label, amount: l.amount, count: 1 };
    byLabel.set(l.label, fresh);
    groups.push(fresh);
  }
  if (groups.length <= BONUS_ROWS) return groups;
  const kept = groups.slice(0, BONUS_ROWS - 1);
  const rest = groups.slice(BONUS_ROWS - 1);
  kept.push({
    id: 'other-bonuses',
    label: 'OTHER BONUSES',
    amount: rest.reduce((a, g) => a + g.amount, 0),
    count: rest.reduce((a, g) => a + g.count, 0),
  });
  return kept;
}
