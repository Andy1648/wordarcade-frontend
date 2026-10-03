// e2e/marks.spec.js — STEP 49 (Andy oct2): ONE marks system. Marks unlock at LV 10 with a NEW SYSTEM
// reveal; a new mark is CLAIMED (REWARDS badge until then); claiming reveals it and opens the picker;
// the worn mark is the player's MAIN — its title chip shows the tier bonus, and the picker says it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

test('E4: a new mark is owned at once (no inbox) → MARKS button says NEW → wear it as MAIN (desktop)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('mk.seeded')) return;
    sessionStorage.setItem('mk.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 12, into: 0 }));
    localStorage.setItem('taw.achievements', JSON.stringify(['m-wb-5']));
    localStorage.setItem('taw.marksOwned', '[]');
    localStorage.setItem('taw.tut.markRolls', '1'); // the in-panel ROLL tutorial is covered by mark-rolls.spec
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  // Andy oct2 evening E4: marks and the MARKS system never sit in the claim inbox.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('taw.marksOwned') || '[]'))).toContain('mk-bomber');
  const claims = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.claims') || '[]').map((c) => c.id));
  expect(claims.filter((id) => id.startsWith('mark-') || id.startsWith('layer-'))).toEqual([]);
  const btn = page.locator('.menu-mark');
  await expect(btn).toContainText('NEW MARK');
  await btn.click();
  // E6: the MARKS INDEX — tap a mark, SET AS MAIN, and it becomes the hero at the top
  await page.locator('.mx-panel').waitFor();
  await expect(page.locator('.mx-hero')).toContainText('NO MAIN YET');
  const tile = page.locator('.mx-tile', { hasText: 'BOMBER' });
  await tile.click();
  const detail = page.locator('.mx-detail');
  await expect(detail.locator('.mx-detail-tier')).toContainText('COMMON');
  // U: one short tag — PERK while not worn, MAIN once worn (MARK ROLLS)
  await expect(detail.locator('.mx-detail-pct')).toHaveText('PERK +2%');
  await detail.getByRole('button', { name: 'SET AS MAIN' }).click();
  await expect(page.locator('.mx-hero .mx-hero-name')).toHaveText('BOMBER');
  await expect(page.locator('.mx-hero .mx-hero-pct')).toHaveText('MAIN ×2');
  await expect(tile.locator('.mx-tile-main')).toHaveText('MAIN');
  // a locked rollable mark says its odds
  await page.locator('.mx-tile.is-locked').first().click();
  await expect(page.locator('.mx-howto')).toContainText('ROLL · 1 IN');
  await page.locator('.mx-close').click();
  await expect(page.locator('.menu-mark .menu-mark-mult')).toHaveText('×2');
});

test('before LV 10 there is no marks layer at all', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 5, into: 0 }));
    localStorage.setItem('taw.achievements', JSON.stringify(['m-wb-5']));
    localStorage.setItem('taw.marksOwned', '[]');
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  const claims = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.claims') || '[]'));
  expect(claims.filter((c) => c.kind === 'mark' || c.id === 'layer-marks')).toEqual([]);
});

// Andy oct2 A3: "the MARKS button sometimes shows and sometimes doesn't" (1280x551, LV27). It rendered
// only while a mark was worn OR a new one was unseen — open the picker without wearing one and it was
// gone until the next unlock. Once MARKS is revealed it is ALWAYS there.
for (const [label, seed] of [
  ['owned, not worn, already seen', { 'taw.marksOwned': '["mk-bomber"]', 'taw.marksSeen': '["mk-bomber"]', 'taw.marksRevealed': '1' }],
  ['revealed, nothing owned yet', { 'taw.marksOwned': '[]', 'taw.marksRevealed': '1' }],
  ['old LV27 save with no marks keys', {}],
]) {
  test(`MARKS button is present at 1280x551, LV27 — ${label}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 551 });
    await installBackendMock(page);
    await page.addInitScript((seed) => {
      if (sessionStorage.getItem('mk3.seeded')) return;
      sessionStorage.setItem('mk3.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 27, into: 0 }));
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    }, seed);
    await page.goto('/?portal=1');
    await menuReady(page);
    const btn = page.locator('.menu-mark');
    await expect(btn).toBeVisible();
    await btn.click();
    await page.locator('.mx-panel').waitFor();
    await page.locator('.mx-close').click();
    // still there after the picker closes with nothing worn — the old disappearing act
    await expect(page.locator('.mx-panel')).toHaveCount(0);
    await expect(btn).toBeVisible();
  });
}

test('no MARKS button before the system is revealed (LV5)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 551 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('mk4.seeded')) return;
    sessionStorage.setItem('mk4.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 5, into: 0 }));
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  await expect(page.locator('.menu-mark')).toHaveCount(0);
});
