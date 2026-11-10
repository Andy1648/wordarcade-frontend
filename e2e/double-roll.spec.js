// e2e/double-roll.spec.js — DOUBLE ROLLS (Andy oct22: "roll twice should roll twice when perk (show two rolled gear or
// something)"). With SINGULARITY worn, one paid roll spins the reel TWICE: the lesser gear first ("DOUBLE ROLL 1/2"), then
// the rarest ("2/2") — each with its own reveal — and both are saved to the INDEX. Nothing scrolls at laptop, Chromebook
// or phone size while either reveal is up.
import { test, expect } from '@playwright/test';
import { holdRoll } from './support/roll.js';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SIZES = [[1366, 768], [1280, 720], [390, 844]];

async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('dr.seeded')) return;
    sessionStorage.setItem('dr.seeded', '1');
    for (const [k, v] of Object.entries({
      'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.marksRevealed': '1', 'taw.tut.markRolls': '1',
      'taw.marksOwned': '[]', 'taw.marksSeen': '[]',
      'taw.gems': JSON.stringify({ v: 1, bal: 1000, peak: 12, streak: 0, mig: 1 }),
      // SINGULARITY worn (DOUBLE ROLLS); every other gear unseen, so both results are NEW → both get the full reveal
      'taw.markRolls': JSON.stringify({ v: 4, rolls: 20, sinceEpic: 1, sinceLegendary: 1, everEpic: true, starter: true, marks: { 'mk-singularity': { n: 1 } }, milestones: [], skipBelow: 'rare' }),
      'taw.mark': 'mk-singularity',
    })) localStorage.setItem(k, v);
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.locator('.hp-nav.is-gears:visible').first().click();
  await page.locator('.rs-overlay').waitFor();
}
const noScroll = (page) => page.evaluate(() => {
  const se = document.scrollingElement;
  return se.scrollHeight <= se.clientHeight + 1 && se.scrollWidth <= se.clientWidth + 1;
});

for (const [w, h] of SIZES) {
  test(`one paid roll with SINGULARITY spins twice and keeps both gears @ ${w}x${h}`, async ({ page }) => {
    await boot(page, w, h);
    // THE TWO PICKS MUST BE TWO GEARS (the CI flake, nov10): the double roll draws its parts from Math.random, and now and
    // then both landed on the SAME RARE / EPIC gear — the second is then a duplicate, and a duplicate rightly skips the
    // ceremony (reelPlan.revealKind → 'line'), so "DOUBLE ROLL 2/2" never showed. Each part takes two draws (its pick,
    // then its shiny), so on a three-value cycle part 2's pick is always the value two steps after part 1's — ≥ 0.35 of
    // the table away, a different gear whatever the draws before the roll consumed. No value is under SHINY_CHANCE.
    await page.evaluate(() => {
      const seq = [0.1, 0.45, 0.8];
      let i = 0;
      Math.random = () => seq[(i += 1) % seq.length];
    });
    await holdRoll(page);
    const cut = page.getByTestId('roll-cutscene');
    for (const n of [1, 2]) {
      await expect(page.getByTestId('roll-double')).toHaveText(`DOUBLE ROLL ${n}/2`, { timeout: 9000 });
      await expect(cut).toHaveClass(/is-on/);
      await page.waitForTimeout(1500);
      expect(await noScroll(page), `no page scroll on reveal ${n}`).toBe(true);
      await cut.click();
      await expect(cut).not.toHaveClass(/is-on/, { timeout: 3000 });
    }
    await expect(page.getByTestId('mark-roll-double')).toHaveCount(0); // the last line says it with its "+EXTRA" chip
    await expect(page.getByTestId('mark-roll-extra')).toBeVisible();
    const st = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.markRolls')));
    expect(st.rolls).toBe(22);
    expect(Object.keys(st.marks).sort(), 'SINGULARITY + the two NEW gears this roll paid out').toHaveLength(3);
  });
}
