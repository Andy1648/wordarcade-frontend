// e2e/marks.spec.js — STEP 49 (Andy oct2): ONE marks system. Marks unlock at LV 10 with a NEW SYSTEM
// reveal; a new mark is CLAIMED (REWARDS badge until then); claiming reveals it and opens the picker;
// the worn mark is the player's MAIN — its title chip shows the tier bonus, and the picker says it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

test('reveal → claim a mark → wear it as MAIN (desktop)', async ({ page }) => {
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
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  const rewards = page.locator('.homepage-nav-btn.is-stats'); // claims ride STATS (Andy oct2 A4)
  await expect(rewards).toBeVisible();
  await rewards.click();
  await page.locator('.claims-panel').waitFor();
  // The NEW SYSTEM reveal.
  await page.locator('.claims-row', { hasText: 'MARKS' }).filter({ hasText: 'NEW SYSTEM' }).locator('.claims-btn').click();
  await expect(page.locator('.sticker')).toContainText('NEW SYSTEM');
  await page.locator('.sticker').click();
  // The mark itself, claimed → its reveal → the picker opens on dismiss.
  await rewards.click();
  await page.locator('.claims-row', { hasText: 'BOMBER' }).locator('.claims-btn').click();
  await expect(page.locator('.sticker')).toContainText('BOMBER');
  await expect(page.locator('.sticker')).toContainText('+100%');
  await page.locator('.sticker').click();
  await page.locator('.marks-overlay').waitFor();
  const card = page.locator('.mark-card', { hasText: 'BOMBER' });
  await expect(card.locator('.mark-tier')).toHaveText('COMMON');
  await expect(card.locator('.mark-main')).toContainText('+100% WINS');
  await card.click();
  await expect(card.locator('.mark-on')).toHaveText('MAIN');
  await page.locator('.marks-close').click();
  await expect(page.locator('.menu-mark .menu-mark-mult')).toHaveText('×2');
  // The mark claims are gone; what is left is the LETTER FORGE reveal (LV 12 ≥ 8).
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.claims') || '[]').map((c) => c.id));
  expect(left.filter((id) => id.startsWith('mark-') || id === 'layer-marks')).toEqual([]);
  expect(left).toContain('layer-forge');
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
    await page.locator('.marks-overlay').waitFor();
    await page.locator('.marks-close').click();
    // still there after the picker closes with nothing worn — the old disappearing act
    await expect(page.locator('.marks-overlay')).toHaveCount(0);
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
