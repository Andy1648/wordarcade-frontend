// e2e/hero-kit.spec.js — HERO COMPONENTS (kit.js): SIDEKICKS + FRAMES. PROFILE → CUSTOMIZE opens the picker: your hero with the
// sidekick you're looking at beside it, six painted tiles, and how you get it. BOMB PUP is free (WEAR), an earned one
// shows its WINS bar, HOLD TO BUY spends gems and wears it, and the profile showcase then shows it at the hero's feet.
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

for (const [vn, vp] of [['cb', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  test(`sidekicks ${vn}: try on, wear the free pup, earned + bought ones, shown in the profile`, async ({ page }) => {
    await openKit(page, vp, 1000);
    const pk = page.getByTestId('kit-picker');
    // the free pup: try it on, wear it
    await expect(pk.locator('.skp-name')).toHaveText('BOMB PUP');
    await expect(pk.locator('.hs [data-sidekick="pup"]')).toBeVisible();
    await pk.getByRole('button', { name: 'WEAR BOMB PUP' }).click();
    await expect(pk.getByRole('button', { name: 'TAKE OFF' })).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.kit')).pet)).toBe('pup');
    await page.waitForTimeout(600);
    await shot(page, `${vn}-1-pup`);
    // INKY: earned at 15 wins (the seed has 20) → WEAR straight away
    await pk.getByRole('radio', { name: 'INKY' }).click();
    await expect(pk.getByRole('button', { name: 'WEAR INKY' })).toBeVisible();
    // PIXEL: 80 wins not reached → its bar + HOLD TO BUY (1000 gems ≥ 900)
    await pk.getByRole('radio', { name: /PIXEL/ }).click();
    await expect(pk.locator('.skp-prog-n')).toContainText('20 / 80 WINS');
    await page.waitForTimeout(500);
    await shot(page, `${vn}-2-pixel-locked`);
    const hold = pk.getByRole('button', { name: /Hold to buy PIXEL/ });
    const box = await hold.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(pk.getByRole('button', { name: 'TAKE OFF' })).toBeVisible({ timeout: 5000 });
    await page.mouse.up();
    const kit = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.kit')));
    expect(kit).toEqual({ own: ['pixel'], pet: 'pixel', frame: null });
    // TURBO is rebirth-gated: no buy button
    await pk.getByRole('radio', { name: /TURBO/ }).click();
    await expect(pk.locator('.skp-locked')).toContainText('REBIRTH 3');
    // back to the profile: the worn sidekick stands at the hero's feet
    await page.locator('.pf-back').click();
    await expect(page.locator('.pf-left [data-sidekick="pixel"]')).toBeVisible();
    await page.waitForTimeout(600);
    await shot(page, `${vn}-3-profile`);
  });
}

for (const [vn, vp] of [['cb', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  test(`frames ${vn}: try one on, a road frame is earned, wear it, the profile hero becomes a card`, async ({ page }) => {
    await openKit(page, vp, 700);
    const pk = page.getByTestId('kit-picker');
    await pk.getByRole('tab', { name: 'FRAME' }).click();
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

test('sidekicks: the hop is a finite one-shot (no infinite animation)', async ({ page }) => {
  await openKit(page, { width: 1366, height: 768 }, 0);
  await page.getByTestId('kit-picker').getByRole('button', { name: 'WEAR BOMB PUP' }).click();
  await page.waitForTimeout(3500);
  const inf = await page.evaluate(() => document.getAnimations().filter((a) => {
    const t = a.effect && a.effect.getTiming && a.effect.getTiming();
    return t && t.iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest('.sk');
  }).length);
  expect(inf).toBe(0);
});
