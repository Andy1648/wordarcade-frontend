// e2e/power-ladder.spec.js — THE POWER LADDER (powerArt.js): the UPGRADES plate shows the FORM the POWER level has
// reached (a new painted icon every two levels, its own plate colour), the next form waits blacked out in the corner,
// and a buy that reaches a new form slams the new art in. Screenshots land in claude/shots/power-ladder when SHOTS=1.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const OUT = 'claude/shots/power-ladder';
const shot = async (page, name) => { if (process.env.SHOTS) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}/${name}.png` }); } };
async function openShop(page, vp, tier, wins = 0) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript(({ p, tier, wins }) => {
    if (sessionStorage.getItem('pl.seeded')) return;
    sessionStorage.setItem('pl.seeded', '1');
    Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': p, 'taw.s2.keytier': String(tier), 'taw.s2.wins': String(wins) }).forEach(([k, v]) => localStorage.setItem(k, v));
  }, { p: PATCH_ID, tier, wins });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.locator('[data-nav="shop"]:visible').first().click();
  await expect(page.locator('.sp2-plate')).toBeVisible();
}

for (const [tier, n, name] of [[0, 1, 'AA BATTERY'], [3, 2, 'POWER CELL'], [6, 4, 'TESLA COIL'], [11, 6, 'REACTOR']]) {
  test(`POWER ${tier}: form ${n} ${name}, its own painted icon`, async ({ page }) => {
    await openShop(page, { width: 1366, height: 768 }, tier);
    await expect(page.getByTestId('sp2-form')).toHaveText(`FORM ${n} · ${name}`);
    await expect(page.locator('.sp2-plate')).toHaveAttribute('data-form', String(n));
    await expect(page.locator('.sp2-plate-art')).toHaveAttribute('src', `/shop/power/t${n}.webp`);
    await expect(page.locator('.sp2-plate-art')).toHaveJSProperty('complete', true);
    expect(await page.locator('.sp2-plate-art').evaluate((i) => i.naturalWidth)).toBeGreaterThan(0);
    await page.waitForTimeout(400);
    await shot(page, `cb-p${tier}`);
  });
}

test('a buy that reaches a new form evolves the plate (finite, nothing loops)', async ({ page }) => {
  await openShop(page, { width: 1366, height: 768 }, 3, 1e15);
  await expect(page.locator('.sp2-plate')).toHaveAttribute('data-form', '2');
  await expect(page.locator('.sp2-next-at')).toHaveText('P4');
  const hold = page.getByRole('button', { name: /Hold to buy POWER 4/ });
  const box = await hold.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator('.sp2-plate')).toHaveAttribute('data-form', '3', { timeout: 4000 });
  await page.mouse.up();
  await expect(page.getByTestId('sp2-form')).toHaveText('FORM 3 · CAR BATTERY');
  await page.waitForTimeout(250);
  await shot(page, 'cb-evolve');
  const inf = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest('.sp2-power')).length);
  expect(inf).toBe(0);
});

test('phone 390x844: the plate, its form and the next-form badge fit', async ({ page }) => {
  await openShop(page, { width: 390, height: 844 }, 9);
  // the phone layout hides the FORM line (no height to spare); the plate itself still evolves
  await expect(page.locator('.sp2-plate')).toHaveAttribute('data-form', '5');
  await expect(page.locator('.sp2-plate-art')).toHaveAttribute('src', '/shop/power/t5.webp');
  const overX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overX).toBeLessThanOrEqual(0);
  await page.waitForTimeout(400);
  await shot(page, 'phone-p9');
});
