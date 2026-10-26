// e2e/hero-kit.spec.js — HERO COMPONENTS (kit.js): FRAMES + WIN FX. PROFILE → CUSTOMIZE opens the picker: your hero with the
// piece you're looking at on it, painted tiles, and how you get it. An earned one shows its WINS bar, HOLD TO BUY spends
// gems and wears it, and the profile showcase then shows it. (The SIDEKICK slot was removed oct26.)
// Screenshots land in claude/shots/hero-kit when SHOTS=1.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const OUT = 'claude/shots/hero-kit';
const shot = async (page, name) => { if (process.env.SHOTS) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}/${name}.png` }); } };
const seed = (gems, main = 'riot') => ({
  'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': PATCH_ID, 'taw.main': main, 'taw.s2.heroes.gf': '1',
  'taw.s2.gems': JSON.stringify({ bal: gems }), 'taw.s2.count': JSON.stringify({ bots: 20 }),
  'taw.s2.road': JSON.stringify({ chain: [0, 1, 2, 3, 4, 5, 6] }), // the CHAIN road's frame node claimed
});
async function openKit(page, vp, gems, main) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript((s) => { if (sessionStorage.getItem('sk.seeded')) return; sessionStorage.setItem('sk.seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed(gems, main));
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.locator('[data-nav="profile"]:visible').first().click();
  await page.getByTestId('profile-kit').click();
  await expect(page.getByTestId('kit-picker')).toBeVisible();
}

// the SIDEKICK slot was removed (oct26): a save that still wears / owns one opens CUSTOMIZE on FRAME, with no ghost tab
for (const [vn, vp] of [['cb', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  test(`no sidekicks ${vn}: an old save with a pet loads clean — two tabs, no sidekick anywhere`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => { localStorage.setItem('taw.s2.kit', JSON.stringify({ own: ['pixel', 'lucky'], pet: 'pixel', frame: null, fx: null })); });
    await openKit(page, vp, 1000);
    const pk = page.getByTestId('kit-picker');
    await expect(pk.getByRole('tab')).toHaveCount(2);
    await expect(pk.getByRole('tab', { name: 'FRAME' })).toHaveAttribute('aria-selected', 'true');
    await expect(pk.getByRole('tab', { name: /SIDEKICK/ })).toHaveCount(0);
    await expect(page.locator('[data-sidekick], .sk')).toHaveCount(0);
    await page.locator('.pf-back').click();
    await expect(page.locator('.pf-left .hs')).toBeVisible();
    await expect(page.locator('[data-sidekick], .sk')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const [vn, vp] of [['cb', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  test(`frames ${vn}: try one on, a road frame is earned, wear it, the profile hero becomes a card`, async ({ page }) => {
    await openKit(page, vp, 700);
    const pk = page.getByTestId('kit-picker');
    // FRAME is the first tab now (no SIDEKICK)
    await expect(pk.getByRole('tab', { name: 'FRAME' })).toHaveAttribute('aria-selected', 'true');
    // FROST: 40 wins (20 seeded) → its bar + HOLD TO BUY (700 ≥ 600); the try-on shows it
    await expect(pk.locator('.skp-name')).toHaveText('FROST');
    await expect(pk.locator('.skp-stage [data-frame="frost"]')).toBeVisible();
    await expect(pk.locator('.skp-prog-n')).toContainText('20 / 40 WINS');
    await page.waitForTimeout(500);
    await shot(page, `${vn}-4-frame-frost`);
    // BOMB SQUAD: a road frame not claimed → its road, no buy
    await pk.getByRole('radio', { name: /BOMB SQUAD/ }).click();
    await expect(pk.locator('.skp-locked')).toContainText('MASTERY ROAD');
    await expect(pk.getByRole('button', { name: /Hold to buy/ })).toHaveCount(0);
    // CHAIN: claimed on the CHAIN road → WEAR
    await pk.getByRole('radio', { name: 'CHAIN' }).click();
    await pk.getByRole('button', { name: 'WEAR CHAIN' }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.kit')).frame)).toBe('chain');
    await page.locator('.pf-back').click();
    await expect(page.locator('.pf-left [data-frame="chain"]')).toBeVisible();
    await expect(page.locator('.pf-left .fc-name')).toHaveText('RIOT');
    await page.waitForTimeout(600);
    await shot(page, `${vn}-5-profile-card`);
  });
}

test('WIN FX: try one on (the burst replays behind the WIN pose), buy it, it is worn', async ({ page }) => {
  await openKit(page, { width: 1366, height: 768 }, 600);
  const pk = page.getByTestId('kit-picker');
  await pk.getByRole('tab', { name: 'WIN FX' }).click();
  await expect(pk.locator('.skp-fx[data-fx="firework"]')).toBeVisible();
  await expect(pk.locator('.skp-prog-n')).toContainText('20 / 25 WINS');
  await page.waitForTimeout(700);
  await shot(page, 'cb-6-winfx');
  const hold = pk.getByRole('button', { name: /Hold to buy FIREWORKS/ });
  const box = await hold.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(pk.getByRole('button', { name: 'TAKE OFF' })).toBeVisible({ timeout: 5000 });
  await page.mouse.up();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.kit')).fx)).toBe('firework');
  await pk.getByRole('radio', { name: /INK SPLAT/ }).click();
  await expect(pk.locator('.skp-fx[data-fx="splat"]')).toBeVisible();
});
