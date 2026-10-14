// e2e/pity-sync.spec.js — 047 (Andy oct14 "it said epic+ in 1 ... but i got no epic"): the server picks every season-2
// roll with ITS OWN pity counters, so the ROLL screen's EPIC+ / LEGENDARY+ countdown must be the server's. A save whose
// local counter says EPIC+ IN 1 while the server is 3 rolls past its last EPIC shows EPIC+ IN 7 — and after a RARE
// lands, IN 6 (counted from the server's number, not the stale local one). Pre-047 (lb_pity 404) the local one stays.
import { test, expect } from '@playwright/test';
import { holdRoll } from './support/roll.js';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { menuReady } from './support/menu.js';

const SECRET = 'c4'.repeat(24);
async function boot(page, { pity047 = true } = {}) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installBackendMock(page);
  const me = { id: 'me', username: 'PITYME', level: 30, rebirths: 0, stars: 0, lifetime_words: 100 };
  await mockBoard(page, [], { caps: true, econ: true, boardEcon: true, season2: true, shared: { rows: [me], secrets: new Map([[SECRET, 'me']]), saves: new Map() } }).catch(() => {});
  const calls = { pity: 0, roll: 0 };
  await page.route('**/rpc/lb_pity', (route) => {
    calls.pity += 1;
    if (!pity047) return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST202', message: 'Could not find the function public.lb_pity' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, since_epic: 3, since_leg: 20, rolls: 40 }) });
  });
  await page.route('**/rpc/lb_roll', (route) => {
    calls.roll += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, seq: calls.roll, picks: [{ mark: 'mk-ember', tier: 'rare', shiny: false }], since_epic: 3, since_leg: 20 }) });
  });
  await page.route('**/rpc/lb_roll_claim', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await page.addInitScript(({ secret }) => {
    if (sessionStorage.getItem('ps.seeded')) return;
    sessionStorage.setItem('ps.seeded', '1');
    for (const k of ['init', 'gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier']) localStorage.setItem('taw.tut.' + k, '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'PITYME' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 30, f: 0.2, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 5000, mig: 1 }));
    localStorage.setItem('taw.marksRevealed', '1');
    localStorage.setItem('taw.markRolls', JSON.stringify({ v: 3, rolls: 40, sinceEpic: 9, sinceLegendary: 20, everEpic: true, starter: true, marks: {}, milestones: [] }));
  }, { secret: SECRET });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.locator('.hp-nav.is-gears:visible').first().click();
  await page.locator('.rs-overlay').waitFor();
  return calls;
}
const pity = (page) => page.getByTestId('roll-pity');

test('the countdown is the server\'s: local EPIC+ IN 1, server 3 since → EPIC+ IN 7, then IN 6 after a RARE', async ({ page }) => {
  const calls = await boot(page);
  await expect(pity(page)).toContainText('EPIC+ IN 7', { timeout: 5000 });
  expect(calls.pity).toBeGreaterThan(0);
  await holdRoll(page);
  await expect(page.locator('[data-testid="mark-roll-result"]')).toHaveCount(1, { timeout: 6000 });
  await expect(pity(page)).toContainText('EPIC+ IN 6');
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.markRolls')).sinceEpic);
  expect(local).toBe(4);
});

test('pre-047 (no lb_pity): the local countdown stays', async ({ page }) => {
  await boot(page, { pity047: false });
  await page.waitForTimeout(800);
  await expect(pity(page)).toContainText('EPIC+ IN 1');
});
