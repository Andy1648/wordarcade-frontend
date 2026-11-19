// e2e/streak-sat.spec.js — THE STREAK CLIMBS IN INK in SAT RUSH (nov12, the Word Bomb pass, Andy: "they need to feel benefits of
// playing"). Study 10, clear them in a row: the HUD's streak cell climbs the ladder (T2 at 4, red ink at 10), and the results page
// names the best streak as a NEW RECORD. STREAK_SHOTS=<dir> saves streak 0 / 5 / 10 / the results.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { revealMode } from './support/menu.js';

const SHOTS = process.env.STREAK_SHOTS || '';
const contextOf = (loc, sel) => loc.evaluate((el, s) => { const i = el.querySelector(s); return el.textContent.replace(i ? i.textContent : '', '').replace(/\s+/g, ' ').trim(); }, sel);

for (const [w, h] of [[390, 844], [1366, 768]]) {
  test(`SAT ${w}x${h}: ten clears in a row climb the streak cell to red ink; the results name a NEW RECORD`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.goto('/?satRush=1&portal=1');
    await (await revealMode(page, 'sat-rush')).click();
    await page.getByRole('button', { name: /BRIEFING/ }).click();
    await page.locator('.sr-setup').waitFor();
    await page.locator('.sr-setup-opt', { hasText: /^10$/ }).first().click();
    await page.locator('.sr-setup .sr-btn').click();
    await page.locator('.sr-brief-page').waitFor();
    const n = await page.locator('.sr-brief-card').count();
    const briefed = [];
    for (let i = 0; i < n; i++) {
      const s = page.locator('.sr-brief-card').nth(i).locator('.sr-brief-sentence');
      briefed.push({ word: (await s.locator('.sr-brief-fill').innerText()).trim().toLowerCase(), context: await contextOf(s, '.sr-brief-fill') });
    }
    expect(n).toBe(10);
    await page.getByRole('button', { name: 'Start the run' }).click();
    await page.locator('.sr-slots').waitFor();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/sat-${w}-s0.png` });
    const cell = page.locator('.sr-hcell-streak');
    let last = '';
    for (let k = 1; k <= 10; k++) {
      // the next word is served once the sentence changes (the cleared one lingers through the between-word beat)
      await expect.poll(async () => (await page.locator('.sr-sentence').isVisible()) && (await contextOf(page.locator('.sr-sentence'), '.sr-blank')) !== last, { timeout: 15000 }).toBe(true);
      const served = await contextOf(page.locator('.sr-sentence'), '.sr-blank');
      last = served;
      const t = briefed.find((b) => b.context === served);
      expect(t, `word ${k} is a briefed word`).toBeTruthy();
      await page.keyboard.type(t.word, { delay: 15 });
      await expect(cell.locator('.sr-hval')).toHaveText(String(k).padStart(2, '0'), { timeout: 10000 });
      if (k === 5) { await expect(cell).toHaveAttribute('data-tier', '2'); if (SHOTS) await page.screenshot({ path: `${SHOTS}/sat-${w}-s5.png` }); }
    }
    await expect(cell).toHaveAttribute('data-tier', '4');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/sat-${w}-s10.png` });
    await expect(page.locator('.sr-respage')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('sr-peak')).toContainText('best streak 10');
    await expect(page.getByTestId('sr-peak')).toContainText('new record');
    if (SHOTS) { await page.waitForTimeout(1500); await page.screenshot({ path: `${SHOTS}/sat-${w}-over.png` }); }
  });
}
