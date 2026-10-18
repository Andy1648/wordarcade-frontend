// e2e/hero-preview.spec.js — THE HERO PREVIEW (oct18, Andy: "card previews … better hero menu presentation … larger
// proportions"). A card in CHOOSE YOUR MAIN opens the preview (never an instant equip): the hero big, its poses, how
// you get it, one button. ‹ › flip the roster; a locked ELITE is shown for real (the card keeps its silhouette); HOLD TO
// BUY buys + equips and returns to the profile. Screenshots land in claude/shots/hero-preview when SHOTS=1.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const OUT = 'claude/shots/hero-preview';
const shot = async (page, name) => { if (process.env.SHOTS) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}/${name}.png` }); } };
const seed = (gems) => ({
  'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': '2026-10-13', 'taw.main': 'riot', 'taw.s2.heroes.gf': '1',
  'taw.s2.gems': JSON.stringify({ bal: gems }),
});
async function openPicker(page, vp, gems) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript((s) => { if (sessionStorage.getItem('hp.seeded')) return; sessionStorage.setItem('hp.seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed(gems));
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.locator('[data-nav="profile"]:visible').first().click();
  await page.locator('.pf-change').click();
  await expect(page.locator('.hp2-coll')).toBeVisible();
}

for (const [vn, vp] of [['cb', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  test(`hero preview ${vn}: a card opens the preview, ‹ › flip the roster, the poses cycle`, async ({ page }) => {
    await openPicker(page, vp, 400);
    await shot(page, `${vn}-1-grid`);
    // tapping a card never equips — it previews
    await page.locator('.hc[data-hero="hype"]').click();
    const pv = page.getByTestId('hero-preview');
    await expect(pv).toHaveAttribute('data-hero', 'hype');
    await expect(pv.locator('.hpv-name')).toHaveText('HYPE');
    await expect(pv.getByRole('button', { name: 'EQUIP HYPE' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('taw.main'))).toBe('riot');
    await page.waitForTimeout(700);
    await shot(page, `${vn}-2-preview-crew`);
    // the WIN / KO tabs show the poses
    await pv.getByRole('tab', { name: 'WIN' }).click();
    await expect(pv.getByRole('tab', { name: 'WIN' })).toHaveAttribute('aria-selected', 'true');
    await page.waitForTimeout(500);
    await shot(page, `${vn}-3-preview-win`);
    // a locked ELITE is shown for real in the preview (the card is a silhouette) with its price
    await pv.getByRole('button', { name: '‹ ALL HEROES' }).click();
    await page.locator('.hc[data-hero="hex-elite"]').click();
    await expect(pv).toHaveAttribute('data-hero', 'hex-elite');
    await expect(pv.locator('.hpv-tier')).toHaveText('ELITE');
    await expect(pv.locator('.hpv-art, .hpv-art img').first()).toBeVisible();
    await expect(pv).toContainText('NOT ENOUGH GEMS');
    await page.waitForTimeout(700);
    await shot(page, `${vn}-4-preview-elite-locked`);
    // ‹ › step through the roster (wraps)
    await pv.getByRole('button', { name: 'Next hero' }).click();
    await expect(pv).not.toHaveAttribute('data-hero', 'hex-elite');
    await pv.getByRole('button', { name: 'Previous hero' }).click();
    await expect(pv).toHaveAttribute('data-hero', 'hex-elite');
    // an earnable crew member shows its progress bar to the requirement
    await pv.getByRole('button', { name: '‹ ALL HEROES' }).click();
    await page.locator('.hc[data-hero="mecha"]').click();
    await expect(pv.locator('.hpv-prog-n')).toHaveText('0 / 10');
    await page.waitForTimeout(700);
    await shot(page, `${vn}-5-preview-legend`);
  });
}

test('hero preview: HOLD TO BUY buys + equips the hero and returns to the profile', async ({ page }) => {
  await openPicker(page, { width: 1366, height: 768 }, 3000);
  await page.locator('.hc[data-hero="lexi"]').click();
  const pv = page.getByTestId('hero-preview');
  const hold = pv.getByRole('button', { name: /Hold to buy LEXI/ });
  const box = await hold.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(1400); await page.mouse.up();
  await expect(page.locator('.pf-change')).toBeVisible();
  await expect(page.locator('.pf-hero')).toHaveText('LEXI');
  expect(await page.evaluate(() => localStorage.getItem('taw.main'))).toBe('lexi');
});
