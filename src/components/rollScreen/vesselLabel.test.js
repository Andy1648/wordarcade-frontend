// vesselLabel.test.js — the canister badge word sits INSIDE the plate's safe window (Andy oct25: "'legendary' is taking
// out borders"): its cap box and its fitted width never leave the window measured off the painted badge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitLabel } from './vesselLabel.js';

const off = (t) => JSON.parse(readFileSync(new URL(`../../../public/rolls/vessel-${t}.json`, import.meta.url), 'utf8'));

for (const [tier, text, stroke] of [['epic', 'EPIC+', 6], ['legendary', 'LEGENDARY+', 0]]) {
  test(`${text}: inside the ${tier} plate window, never squeezed past 14%`, () => {
    const { plate, badge } = off(tier);
    const px = (v) => (512 * v) / 100;
    const L = fitLabel(text, plate, stroke);
    const cap = L.size * 0.67;
    assert.ok(L.y - cap >= px(plate.y) - 0.01, 'cap top inside');
    assert.ok(L.y <= px(plate.y + plate.h) + 0.01, 'baseline inside');
    assert.ok(L.x - L.fit / 2 >= px(plate.x) - 0.1 && L.x + L.fit / 2 <= px(plate.x + plate.w) + 0.1, 'width inside');
    // the window itself is inside the painted badge, ≥ 8% in from its edges
    assert.ok(px(plate.x) >= px(badge.x) + px(badge.w) * 0.08);
    assert.ok(px(plate.x + plate.w) <= px(badge.x + badge.w) * 1 - px(badge.w) * 0.08);
    assert.ok(L.fit / L.size >= ({ 'EPIC+': 2.731, 'LEGENDARY+': 6.619 })[text] * 0.86 - 0.02, 'squeeze ≤ 14%');
  });
}
