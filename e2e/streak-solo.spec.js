// e2e/streak-solo.spec.js — THE STREAK, ON SCREEN in CHAIN (nov12, the Word Bomb pass, Andy: "addiction corresponding to aggression
// (they need to feel benefits of playing)"). A real run of accepted words: the streak count rides the hero ring and its tier colours
// the card (data-heat), it sits inside the window and off the field, and the run-over card names the run's BEST STREAK as a NEW RECORD.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';

const WORDS = fs.readFileSync('src/solo/words.accept.txt', 'utf8').split(/\s+/).filter((w) => /^[a-z]{4,9}$/.test(w)).slice(0, 20000);

for (const [w, h] of [[390, 844], [1366, 768]]) {
  test(`CHAIN ${w}x${h}: the streak climbs beside the ring, heats the card, and the run-over names BEST STREAK`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: w, height: h });
    await page.addInitScript(() => { for (const [k, v] of Object.entries({ 'taw.chain.runs': '5', 'taw.seenMenuSpotlight': '1', 'taw.seenGameSpotlight': '1', 'taw.seenMenu': '1' })) localStorage.setItem(k, v); });
    await installBackendMock(page);
    await page.goto('/?chain=1&portal=1&soloms=6000');
    const input = page.locator('.solo-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });
    await expect(page.locator('.solo-streak .combo-badge')).toHaveCount(0); // quiet at 0
    const used = new Set();
    for (let i = 0; i < 4; i++) {
      const raw = await page.evaluate(() => (document.querySelector('.solo-center .solo-cl') || {}).textContent || '');
      const need = raw.trim().toLowerCase().slice(0, 1);
      const pick = WORDS.find((x) => !used.has(x) && x.startsWith(need));
      used.add(pick);
      await input.fill(pick);
      await input.press('Enter');
      await expect(page.locator('.solo-streak .combo-count')).toHaveText(String(i + 1), { timeout: 5000 }).catch(() => {});
    }
    await expect(page.locator('.solo-streak .combo-count')).toHaveText('4');
    await expect(page.locator('.solo-root')).toHaveAttribute('data-heat', '2');
    const m = await page.evaluate(() => {
      const b = document.querySelector('.solo-streak .combo-badge').getBoundingClientRect();
      const f = document.querySelector('.solo-input').getBoundingClientRect();
      const hit = !(b.right <= f.left || b.left >= f.right || b.bottom <= f.top || b.top >= f.bottom);
      return { inside: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight, hit };
    });
    expect(m.inside, 'the streak is inside the window').toBe(true);
    expect(m.hit, 'the streak never sits on the field').toBe(false);
    await page.locator('.solo-deathcard').waitFor({ timeout: 30000 });
    await expect(page.getByTestId('solo-peak')).toContainText('4 BEST STREAK');
    await expect(page.getByTestId('solo-peak')).toContainText('NEW RECORD');
    await expect(page.getByTestId('solo-peak')).toHaveAttribute('data-heat', '2');
  });
}
