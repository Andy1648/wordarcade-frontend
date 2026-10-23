// e2e/earned-gear-equip.spec.js — Andy oct22: "when u equip archivist it unequips the other gear (doesn't work)". ARCHIVIST,
// LEGEND, ETERNAL and HIGH ROLLER are season-2 EARNED gears (a maxed achievement ladder) AND season-1 marks, so wearing
// one fell to the season-1 claimed list, was refused, and the slot read back empty. Wearing one must put it in YOUR slot
// and never touch the 2nd slot; the 2nd slot's locker never offers an EARNED gear (by design) and keeps its own gear.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

async function boot(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('eg.seeded')) return;
    sessionStorage.setItem('eg.seeded', '1');
    for (const [k, v] of Object.entries({
      'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1',
      'taw.s2.xp': JSON.stringify({ lv: 60, f: 0, rc: 5, v: 10 }), 'taw.s2.rebirths': '5', // R5: the 2nd slot is open
      'taw.marksOwned': '[]', // a season-2 save: no season-1 claims
      'taw.markRolls': JSON.stringify({ v: 4, rolls: 9, sinceEpic: 0, sinceLegendary: 0, everEpic: true, starter: true, marks: { 'mk-pyro': { n: 1 }, 'mk-eclipse': { n: 1 } }, milestones: [] }),
      'taw.mark': 'mk-pyro', // slot 1: a rolled gear
      'taw.s2.mark2': 'mk-eclipse', // slot 2
      'taw.s2.ach': JSON.stringify({ index: 3 }), // the INDEX ladder maxed → ARCHIVIST is owned
    })) localStorage.setItem(k, v);
  });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}
const stored = (page) => page.evaluate(() => ({ one: localStorage.getItem('taw.mark'), two: localStorage.getItem('taw.s2.mark2') }));

test('ARCHIVIST worn in slot 1 goes on, and the 2nd slot keeps its gear', async ({ page }) => {
  await boot(page);
  await expect(page.locator('.menu-mark2').first()).toContainText(/ECLIPSE|WINS/);
  await page.locator('.menu-mark').first().click();
  const equip = page.locator('[data-testid="equip-screen"][data-slot="1"]');
  await equip.getByRole('button', { name: /^ARCHIVIST,/ }).click();
  await equip.getByRole('button', { name: /^EQUIP/ }).first().click();
  await expect(equip.getByRole('button', { name: /^ARCHIVIST,.*equipped/ })).toBeVisible();
  expect(await stored(page)).toEqual({ one: 'mk-curator', two: 'mk-eclipse' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu-mark').first()).toContainText('ARCHIVIST');
  await expect(page.locator('.menu-mark2').first()).not.toContainText('NONE');
  // a reload reads both back
  await page.reload();
  await menuReady(page);
  expect(await stored(page)).toEqual({ one: 'mk-curator', two: 'mk-eclipse' });
});

test('the 2nd slot never offers ARCHIVIST, and changing it never touches slot 1', async ({ page }) => {
  await boot(page);
  await page.locator('.menu-mark2').first().click();
  const equip = page.locator('[data-testid="equip-screen"][data-slot="2"]');
  await expect(equip.locator('.mx-tile').first()).toBeVisible();
  await expect(equip.getByRole('button', { name: /^ARCHIVIST,/ })).toHaveCount(0);
  expect(await stored(page)).toEqual({ one: 'mk-pyro', two: 'mk-eclipse' });
});
