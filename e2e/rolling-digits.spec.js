// e2e/rolling-digits.spec.js — ROLLING DIGITS (design research move 11) on the currency PILLS: a gain ROLLS the pill's
// figure into place (juice/rollDigits — odometer strips, transform only, landed inside ~700 ms) and the pill rests on its
// plain-text figure. A spend still counts down in plain text. ROLL_SHOTS=<folder> saves a mid-roll frame.
import { test, expect } from '@playwright/test';

const SHOTS = process.env.ROLL_SHOTS;

async function open(page, w = 1366, h = 900) {
  await page.setViewportSize({ width: w, height: h });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => { try { localStorage.setItem('taw.reduceMotion', '0'); } catch { /* blocked */ } });
  await page.goto('/?kit=1');
  await page.locator('.kg-sheet--icons').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

for (const [w, h] of [[1366, 900], [390, 844]]) {
  test(`@${w}: a pill gain rolls its digits and lands on the real figure`, async ({ page }) => {
    await open(page, w, h);
    const pill = page.locator('.kp').filter({ has: page.locator('.kp-name', { hasText: 'GEMS' }) }).first();
    await pill.scrollIntoViewIfNeeded();
    await page.getByTestId('kit-gain-gems').click();
    const num = pill.locator('.kp-num');
    await expect(num.locator('.rd-col').first()).toBeAttached({ timeout: 2_000 });
    // mid-roll: every column sits inside the pill box (nothing spills onto the coin or out of the pill)
    const spill = await pill.evaluate((p) => {
      const box = p.querySelector('.kp-box').getBoundingClientRect();
      return [...p.querySelectorAll('.rd-col')].filter((c) => { const r = c.getBoundingClientRect(); return r.left < box.left - 1 || r.right > box.right + 1; }).length;
    });
    expect(spill, 'a rolling column leaves the pill').toBe(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/pill-roll-${w}.png`, clip: await pill.boundingBox() });
    const t0 = Date.now();
    await expect(num.locator('.rd-col')).toHaveCount(0, { timeout: 2_000 });
    expect(Date.now() - t0, 'the roll lands quickly').toBeLessThan(1_500);
    const target = (await pill.getAttribute('aria-label')).replace(/^GEMS\s+/, '');
    await expect(num).toHaveText(target);
    const px = await num.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(px).toBeGreaterThanOrEqual(16);
  });
}

test('a spend while a gain still rolls counts down in plain text — the roll never writes over it', async ({ page }) => {
  await open(page);
  const pill = page.locator('.kp').filter({ has: page.locator('.kp-name', { hasText: 'WINS' }) }).first();
  await page.getByTestId('kit-gain-wins').click();
  await page.getByTestId('kit-spend-wins').click();
  await page.waitForTimeout(1_200);
  await expect(pill.locator('.rd-col')).toHaveCount(0);
  const target = (await pill.getAttribute('aria-label')).replace(/^WINS\s+/, '');
  await expect(pill.locator('.kp-num')).toHaveText(target);
});
