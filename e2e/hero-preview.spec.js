// e2e/hero-preview.spec.js — THE HERO PREVIEW (oct18, Andy: "card previews … better hero menu presentation … larger
// proportions"). A card in CHOOSE YOUR MAIN opens the preview (never an instant equip): the hero big, its poses, how
// you get it, one button. ‹ › flip the roster; a locked ELITE is shown for real (the card keeps its silhouette); HOLD TO
// BUY buys + equips and returns to the profile. Screenshots land in claude/shots/hero-preview when SHOTS=1.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const OUT = 'claude/shots/hero-preview';
const shot = async (page, name) => { if (process.env.SHOTS) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}/${name}.png` }); } };
const seed = (gems) => ({
  'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': PATCH_ID, 'taw.main': 'riot', 'taw.s2.heroes.gf': '1',
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
    // one card per member (oct18): HEX's card → its ELITE tab previews ARCHMAGE HEX
    await expect(page.locator('.hc[data-hero="hex-elite"]')).toHaveCount(0);
    await page.locator('.hc[data-hero="hex"]').click();
    await pv.getByRole('tab', { name: /ELITE/ }).click();
    await expect(pv).toHaveAttribute('data-hero', 'hex-elite');
    await expect(pv.locator('.hpv-tier')).toHaveText('ELITE');
    await expect(pv.locator('.hpv-art, .hpv-art img').first()).toBeVisible();
    await expect(pv).toContainText('NOT ENOUGH GEMS');
    await page.waitForTimeout(700);
    await shot(page, `${vn}-4-preview-elite-locked`);
    // ‹ › step through the members (wraps)
    await pv.getByRole('button', { name: 'Next hero' }).click();
    await expect(pv).not.toHaveAttribute('data-hero', /^hex/);
    await pv.getByRole('button', { name: 'Previous hero' }).click();
    await expect(pv).toHaveAttribute('data-hero', 'hex');
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
  // NEW HERO! — the purchase plays the reveal (already equipped: LET'S GO)
  const hu = page.getByTestId('hero-unlock');
  await expect(hu).toHaveAttribute('data-hero', 'lexi');
  await page.waitForTimeout(2200);
  await shot(page, 'cb-6-unlock-bought');
  await hu.getByRole('button', { name: "LET'S GO" }).click();
  await expect(hu).toHaveCount(0);
  await expect(page.locator('.pf-change')).toBeVisible();
  await expect(page.locator('.pf-hero')).toHaveText('LEXI');
  expect(await page.evaluate(() => localStorage.getItem('taw.main'))).toBe('lexi');
});

for (const [vn, vp] of [['cb', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  test(`hero unlock ${vn}: a hero earned since the last look reveals on opening the profile, rarest last; once only`, async ({ page }) => {
    await page.setViewportSize(vp);
    await installBackendMock(page);
    // a save that has seen only the free crew, then earned GLITCH (rebirth 1) and BOO (rebirth 5)
    const s = { ...seed(0), 'taw.s2.rebirths': '5', 'taw.s2.heroes.seen': JSON.stringify(['riot', 'hype', 'brawl']) };
    await page.addInitScript((s) => { if (sessionStorage.getItem('hu.seeded')) return; sessionStorage.setItem('hu.seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, s);
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    await page.locator('[data-nav="profile"]:visible').first().click();
    const hu = page.getByTestId('hero-unlock');
    await expect(hu).toBeVisible();
    await expect(hu).toContainText('1 / 2');
    const first = await hu.getAttribute('data-hero');
    expect(first).toBe('glitch');
    await page.waitForTimeout(2200);
    await shot(page, `${vn}-7-unlock-earned`);
    await hu.getByRole('button', { name: 'NEXT' }).click();
    await expect(hu).toHaveAttribute('data-hero', 'boo');
    await expect(hu.locator('.hu-title')).toHaveText('LEGEND!');
    await page.waitForTimeout(2200);
    await shot(page, `${vn}-8-unlock-legend`);
    await hu.getByRole('button', { name: 'EQUIP NOW' }).click();
    await expect(hu).toHaveCount(0);
    await expect(page.locator('.pf-hero')).toHaveText('BOO');
    // once only: reopening the profile shows no reveal
    await page.locator('.pf-x').click();
    await page.locator('[data-nav="profile"]:visible').first().click();
    await expect(page.locator('.pf-change')).toBeVisible();
    await expect(hu).toHaveCount(0);
  });
}

test('YOUR HEROES (oct19, replaces NEXT HERO): the profile shows the heroes you own; tapping one wears it', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installBackendMock(page);
  await page.addInitScript((s) => { if (sessionStorage.getItem('hg.seeded')) return; sessionStorage.setItem('hg.seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed(0));
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.locator('[data-nav="profile"]:visible').first().click();
  await expect(page.locator('.pf-goal')).toHaveCount(0); // no "next hero" nag
  const crew = page.getByRole('region', { name: 'Your heroes' });
  await expect(crew.getByRole('button', { name: 'RIOT, equipped' })).toHaveAttribute('aria-pressed', 'true');
  await crew.getByRole('button', { name: 'Equip HYPE' }).click();
  await expect(page.locator('.pf-hero')).toHaveText('HYPE');
  expect(await page.evaluate(() => localStorage.getItem('taw.main'))).toBe('hype');
  await shot(page, 'cb-9-profile-crew');
});

test('menu chip says NEW HERO! while an earned hero waits to be revealed', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installBackendMock(page);
  const s = { ...seed(0), 'taw.s2.rebirths': '1', 'taw.s2.heroes.seen': JSON.stringify(['riot', 'hype', 'brawl']) };
  await page.addInitScript((s) => { if (sessionStorage.getItem('hc.seeded')) return; sessionStorage.setItem('hc.seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, s);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await expect(page.locator('.hp-profplate .hp-rankplate-k')).toHaveText('NEW HERO!'); // oct21: the profile is the XP bar's plate
  await shot(page, 'cb-10-menu-new-hero');
});
