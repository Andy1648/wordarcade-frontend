// e2e/mastery-road.spec.js — MODE MASTERY ROADS: the mode dialog's strip opens the road, a reached node CLAIMs once,
// Escape comes back to the dialog, and a CHAIN run that crosses a mastery level says MASTERY UP on its death card.
// Shots land in claude/mastery-road/shots (the design review), at 1366x768 and 390x844.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, revealMode } from './support/menu.js';

const SHOTS = 'claude/mastery-road/shots';
// cumulative words to REACH a mastery level (mastery.js masteryWordsToReach — round(30 + 1.2 × l²) a level)
const toReach = (lv) => { let s = 0; for (let l = 1; l < lv; l++) s += Math.round(30 + 1.2 * l * l); return s; };

async function seeded(page, mastery, road = {}) {
  await installBackendMock(page);
  await page.addInitScript(([m, r]) => {
    try {
      if (sessionStorage.getItem('mr.seeded')) return;
      sessionStorage.setItem('mr.seeded', '1');
      localStorage.setItem('taw.mastery', JSON.stringify(m));
      localStorage.setItem('taw.s2.road', JSON.stringify(r));
      for (const [k, v] of Object.entries({ 'taw.xp': JSON.stringify({ lv: 30, into: 0 }), 'taw.seenMenuSpotlight': '1', 'taw.seenGameSpotlight': '1', 'taw.seenMenu': '1', wa_has_played: '1', 'taw.chain.runs': '5' })) localStorage.setItem(k, v);
    } catch { /* ignore */ }
  }, [mastery, road]);
}

for (const vp of [{ width: 1366, height: 768, tag: 'desktop' }, { width: 390, height: 844, tag: 'phone' }]) {
  test(`road: strip → road → claim → back (${vp.tag})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    // CHAIN at M9: nodes M4 / M7 / M8 reached, the first already claimed → two READY
    await seeded(page, { chain: toReach(9) + 40, 'word-bomb': toReach(5) + 12 }, { chain: [0] });
    await page.goto('/?portal=1');
    await menuReady(page);
    await (await revealMode(page, 'chain')).click();
    const strip = page.getByTestId('road-strip');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText('2 REWARDS READY');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${vp.tag}-1-dialog.png` });
    await strip.click();
    await expect(page.getByTestId('road-view')).toBeVisible();
    await expect(page.getByTestId('road-node-0')).toHaveAttribute('data-state', 'claimed');
    await expect(page.getByTestId('road-node-3')).toHaveAttribute('data-state', 'locked');
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/${vp.tag}-2-road.png` });
    const gemsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.gems') || '{}').bal || 0);
    await page.getByTestId('road-claim-1').click(); // the 10-gem chest
    await expect(page.getByTestId('road-node-1')).toHaveAttribute('data-state', 'claimed');
    await expect(page.getByTestId('road-claim-1')).toHaveCount(0);
    const gemsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.gems') || '{}').bal || 0);
    expect(gemsAfter - gemsBefore).toBeGreaterThanOrEqual(10);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/${vp.tag}-3-claimed.png` });
    // the road scrolls; the page never does
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('road-view')).toHaveCount(0);
    await expect(page.getByTestId('road-strip')).toContainText('1 REWARD READY');
  });
}

const OPENER = { a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future', g: 'generate', h: 'handle', i: 'include', l: 'large', m: 'manage', n: 'notice', o: 'office', p: 'people', r: 'remove', s: 'service', t: 'there', w: 'where' };

for (const vp of [{ width: 1366, height: 768, tag: 'desktop' }, { width: 390, height: 844, tag: 'phone' }]) {
  test(`MASTERY UP on the CHAIN death card (${vp.tag})`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await seeded(page, { chain: toReach(7) - 1 }); // one word short of M7 — a road node
    await page.goto('/?chain=1&portal=1');
    const input = page.locator('.solo-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });
    const letter = ((await page.locator('.solo-center').first().innerText()).trim()).toLowerCase().slice(0, 1);
    await input.fill(OPENER[letter] || 'there');
    await input.press('Enter');
    await expect(input).toHaveValue('', { timeout: 5000 });
    await page.locator('.solo-over').waitFor({ state: 'visible', timeout: 60000 });
    const up = page.getByTestId('mastery-up');
    await expect(up).toBeVisible();
    await expect(up).toContainText('MASTERY UP');
    await expect(up).toContainText('READY');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/${vp.tag}-4-endcard.png` });
  });
}
