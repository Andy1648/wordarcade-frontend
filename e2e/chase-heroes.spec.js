// e2e/chase-heroes.spec.js — the CHASE heroes (oct28, Andy: "a few SUPER-RARE chase heroes with that rare addicting
// feeling"): DRAKE + MAGMA (MYTHIC) and FACET (SECRET) close the hero grid LOCKED with their odds ("1 IN 500"), the preview
// never offers a buy, and a lucky GEAR ROLL drops one — the gear's reveal closes, then MYTHIC DROP! plays and EQUIP NOW
// wears it. SHOTS=1 saves screenshots to claude/shots/chase/.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { holdRoll } from './support/roll.js';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const OUT = 'claude/shots/chase';
const shot = async (page, name) => { if (process.env.SHOTS) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}/${name}.png` }); } };
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

for (const [vn, vp] of [['cb', { width: 1366, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  test(`chase heroes ${vn}: locked at the end of the grid with their odds; the preview never sells them`, async ({ page }) => {
    await boot(page, vp);
    await page.locator('[data-nav="profile"]:visible').first().click();
    await page.locator('.pf-change').click();
    await expect(page.locator('.hp2-coll')).toBeVisible();
    for (const [id, odds] of [['drake', '1 IN 500'], ['magma', '1 IN 500'], ['facet', '1 IN 2500']]) {
      const c = page.locator(`.hc[data-hero="${id}"]`);
      await expect(c).toContainText(odds);
      await expect(c.locator('.hp2-act')).toHaveCount(0); // no price pill
    }
    await page.locator('.hc[data-hero="drake"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await shot(page, `${vn}-1-grid`);
    await page.locator('.hc[data-hero="facet"]').click();
    const pv = page.getByTestId('hero-preview');
    await expect(pv).toHaveAttribute('data-hero', 'facet');
    await expect(pv.locator('.hpv-tier')).toHaveText('SECRET');
    await expect(pv.getByTestId('hero-drop-odds')).toHaveText('1 IN 2500 GEAR ROLLS');
    await expect(pv.getByRole('button', { name: /Hold to buy/ })).toHaveCount(0);
    await page.waitForTimeout(700);
    await shot(page, `${vn}-2-preview-facet`);
    await pv.getByRole('button', { name: 'Previous hero' }).click();
    await expect(pv).toHaveAttribute('data-hero', 'magma');
    await expect(pv.locator('.hpv-tier')).toHaveText('MYTHIC');
    await page.waitForTimeout(700);
    await shot(page, `${vn}-3-preview-magma`);
  });
}

test('THE DROP: a lucky gear roll drops DRAKE — the gear reveal closes, MYTHIC DROP! plays, EQUIP NOW wears it', async ({ page }) => {
  await boot(page, { width: 1366, height: 768 }, { 'taw.markRolls': JSON.stringify({ v: 4, rolls: 20, sinceEpic: 1, sinceLegendary: 1, everEpic: true, starter: true, marks: {}, milestones: [], skipBelow: 'rare' }) });
  await page.locator('.hp-nav.is-gears:visible').first().click();
  await page.locator('.rs-overlay').waitFor();
  await page.evaluate(() => { Math.random = () => 0.0001; }); // the luckiest roll there is
  await holdRoll(page);
  const cut = page.getByTestId('roll-cutscene');
  await expect(cut).toHaveClass(/is-on/, { timeout: 9000 });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.heroes') || '[]')), 'kept the moment the roll lands').toContain('drake');
  await expect(page.getByTestId('hero-unlock')).toHaveCount(0); // the gear's own reveal goes first
  await cut.click();
  const hu = page.getByTestId('hero-unlock');
  await expect(hu).toHaveAttribute('data-hero', 'drake', { timeout: 5000 });
  await expect(hu.locator('.hu-title')).toHaveText('MYTHIC DROP!');
  await page.waitForTimeout(2200);
  await shot(page, 'drop-drake');
  await hu.getByRole('button', { name: 'EQUIP NOW' }).click();
  await expect(hu).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('taw.main'))).toBe('drake');
});

test('no drop on an ordinary roll: the reveal closes straight back to the roll screen', async ({ page }) => {
  await boot(page, { width: 1366, height: 768 }, { 'taw.markRolls': JSON.stringify({ v: 4, rolls: 20, sinceEpic: 1, sinceLegendary: 1, everEpic: true, starter: true, marks: {}, milestones: [], skipBelow: 'rare' }) });
  await page.locator('.hp-nav.is-gears:visible').first().click();
  await page.locator('.rs-overlay').waitFor();
  await page.evaluate(() => { Math.random = () => 0.6; });
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
