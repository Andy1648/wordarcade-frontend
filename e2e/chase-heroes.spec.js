// e2e/chase-heroes.spec.js — the rarest heroes: DRAKE + MAGMA (MYTHIC) and FACET (SECRET). They dropped from gear rolls
// until nov12 (Andy: "dont make any hero avatars rollable its confusing - just make them cost gems"): now they close the
// hero grid with their GEM PRICE like every other hero, the preview sells them (HOLD TO BUY), and a gear roll — even the
// luckiest one — only ever pays gear. SHOTS=1 saves screenshots to claude/shots/chase/.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { holdRoll } from './support/roll.js';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const OUT = 'claude/shots/chase';
const shot = async (page, name) => { if (process.env.SHOTS) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}/${name}.png` }); } };
const PRICE = { drake: '30,000', magma: '30,000', facet: '40,000' };
const seed = (extra = {}) => ({
  'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': PATCH_ID, 'taw.main': 'riot', 'taw.s2.heroes.gf': '1',
  'taw.marksRevealed': '1', 'taw.tut.markRolls': '1', 'taw.marksOwned': '[]', 'taw.marksSeen': '[]',
  'taw.gems': JSON.stringify({ v: 1, bal: 1000, peak: 12, streak: 0, mig: 1 }),
  ...extra,
});
async function boot(page, vp, extra) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript((s) => { if (sessionStorage.getItem('ch.seeded')) return; sessionStorage.setItem('ch.seeded', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed(extra));
  await page.goto('/?portal=1');
  await menuReady(page);
}
async function openHeroes(page) {
  await page.locator('[data-nav="profile"]:visible').first().click();
  await page.getByTestId('profile-kit').click(); // CUSTOMIZE opens on its HERO tab (oct28)
  await expect(page.locator('.hp2-coll')).toBeVisible();
}

for (const [vn, vp] of [['cb', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  test(`top heroes ${vn}: at the end of the grid with their gem price, no odds; the preview sells them`, async ({ page }) => {
    await boot(page, vp);
    await openHeroes(page);
    for (const id of Object.keys(PRICE)) {
      const c = page.locator(`.hc[data-hero="${id}"]`);
      await expect(c.locator('.hp2-act.is-price')).toContainText(PRICE[id].replace(',000', 'K')); // the pill prints 30K / 40K
      await expect(c).not.toContainText(/1 IN/);
    }
    await page.locator('.hc[data-hero="drake"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await shot(page, `${vn}-1-grid`);
    await page.locator('.hc[data-hero="facet"]').click();
    const pv = page.getByTestId('hero-preview');
    await expect(pv).toHaveAttribute('data-hero', 'facet');
    await expect(pv.locator('.hpv-tier')).toHaveText('SECRET');
    await expect(pv).not.toContainText(/GEAR ROLL|1 IN/);
    await expect(pv).toContainText('NOT ENOUGH GEMS'); // 1,000 gems vs 40,000: the buy is there, just short
    await page.waitForTimeout(700);
    await shot(page, `${vn}-2-preview-facet`);
    await pv.getByRole('button', { name: 'Previous hero' }).click();
    await expect(pv).toHaveAttribute('data-hero', 'magma');
    await expect(pv.locator('.hpv-tier')).toHaveText('MYTHIC');
  });
}

test('HOLD TO BUY: 30,000 gems buys DRAKE — MYTHIC HERO! plays, it is equipped, the gems are spent', async ({ page }) => {
  await boot(page, { width: 1366, height: 768 }, { 'taw.gems': JSON.stringify({ v: 1, bal: 30500, peak: 12, streak: 0, mig: 1 }) });
  await openHeroes(page);
  await page.locator('.hc[data-hero="drake"]').click();
  const pv = page.getByTestId('hero-preview');
  const hold = pv.getByRole('button', { name: /Hold to buy DRAKE/ });
  const box = await hold.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(1400); await page.mouse.up();
  const hu = page.getByTestId('hero-unlock');
  await expect(hu).toHaveAttribute('data-hero', 'drake');
  await expect(hu.locator('.hu-title')).toHaveText('MYTHIC HERO!');
  await page.waitForTimeout(2200);
  await shot(page, 'bought-drake');
  expect(await page.evaluate(() => localStorage.getItem('taw.main'))).toBe('drake');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('taw.gems')).bal)).toBe(500);
});

test('a gear roll never gives a hero — not even the luckiest draw there is', async ({ page }) => {
  await boot(page, { width: 1366, height: 768 }, { 'taw.markRolls': JSON.stringify({ v: 4, rolls: 20, sinceEpic: 1, sinceLegendary: 1, everEpic: true, starter: true, marks: {}, milestones: [], skipBelow: 'rare' }) });
  await page.locator('.hp-nav.is-gears:visible').first().click();
  await page.locator('.rs-overlay').waitFor();
  await page.evaluate(() => { Math.random = () => 0.0001; }); // the draw that used to drop DRAKE
  await holdRoll(page);
  const cut = page.getByTestId('roll-cutscene');
  await expect(cut).toHaveClass(/is-on/, { timeout: 9000 });
  await page.waitForTimeout(800);
  await cut.click();
  await expect(cut).not.toHaveClass(/is-on/, { timeout: 3000 });
  await page.waitForTimeout(600);
  await expect(page.getByTestId('hero-unlock')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('taw.s2.heroes'))).toBeNull();
});
