// e2e/roll-dupe-skip.spec.js — a RARE / EPIC DUPLICATE skips the ceremony: no cutscene, the short line path, and the
// result still lands with its × copies chip. Real motion; the roll's Math.random is pinned low so it lands EPIC.
import { test, expect } from '@playwright/test';
import { holdRoll } from './support/roll.js';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { ROLL_MARKS } from '../src/progress/markRollsCore.js';

test.describe.configure({ timeout: 60_000 });
test.use({ reducedMotion: 'no-preference' });

const gemsOf = (bal) => JSON.stringify({ v: 1, bal, peak: 12, streak: 0, mig: 1 });
const BASE = {
  'taw.rollsOn': '1', 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1',
  'taw.xp': JSON.stringify({ lv: 12, into: 0 }), 'taw.marksRevealed': '1', 'taw.marksSeen': '[]',
  'taw.wins': '50000000', 'taw.gems': gemsOf(1000),
};
const ids = (ROLL_MARKS || []).map((m) => m.id).filter(Boolean);

async function openRoll(page, marks) {
  await installBackendMock(page);
  const seed = {
    ...BASE,
    'taw.marksOwned': JSON.stringify(Object.keys(marks)),
    'taw.markRolls': JSON.stringify({ v: 3, rolls: 999, sinceEpic: 49, sinceLegendary: 30, everEpic: true, starter: true, marks, milestones: [], skipBelow: 'epic', done: [] }),
  };
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('fb.seeded')) return;
    sessionStorage.setItem('fb.seeded', '1');
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  }, seed);
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.locator('.hp-nav.is-gears:visible').first().click();
  await page.locator('.rs-overlay').waitFor();
}

test('an EPIC DUPLICATE skips the cutscene: the short line path, the result still lands', async ({ page }) => {
  expect(ids.length).toBeGreaterThan(20);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript(() => { const real = Math.random; Math.random = () => (window.__rollRng ? 0.001 : real()); });
  const marks = {};
  ids.forEach((id, i) => { marks[id] = { n: 99, first: 1 + i }; }); // everything owned, ★ maxed: every roll is a dupe, no pip step
  await openRoll(page, marks);
  await page.evaluate(() => { window.__rollRng = true; });
  await holdRoll(page);
  const result = page.locator('[data-testid="mark-roll-result"]');
  await expect(result).toHaveCount(1, { timeout: 15_000 });
  await page.evaluate(() => { window.__rollRng = false; });
  await expect(result.locator('.rs-chip.is-dupe')).toHaveCount(1); // the × copies chip says it is a dupe
  // no ceremony: the cutscene never opened for it
  await page.waitForTimeout(600);
  await expect(page.getByTestId('roll-cutscene')).not.toHaveClass(/is-on/);
});
