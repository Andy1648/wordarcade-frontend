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
    localStorage.setItem('taw.tut.markRolls', '1'); // MARK ROLLS are LIVE: their one-step tutorial would cover the panel
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
  // INDEX v2 (Andy oct5): card = name · rarity · 1 IN X · stat; tap → the detail sheet (flavour, owned, first roll)
  await page.locator('.mx-panel').waitFor();
  const tile = page.locator('.mx-tile', { hasText: 'BOMBER' });
  await expect(tile.locator('.mx-tile-tier')).toHaveText('COMMON');
  await expect(tile.locator('.mx-tile-odds')).toHaveText(/^1 IN [\d\s,]+$/);
  await expect(tile.locator('.mx-tile-sub')).toHaveText('+10% WINS');
  await expect(tile.locator('.mark-pips')).toHaveAttribute('data-pips', '0');
  await tile.click();
  const sheet = page.locator('.mx-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.mx-sheet-name')).toHaveText('BOMBER');
  await expect(sheet.locator('.mx-sheet-tier')).toContainText('COMMON');
  await expect(sheet.locator('.mx-sheet-stat')).toHaveText('+10% WINS');
  const flavour = (await sheet.getByTestId('mark-flavour').innerText()).trim();
  expect(flavour.length).toBeGreaterThan(0);
  expect(flavour.length).toBeLessThanOrEqual(32);
  await expect(sheet.getByTestId('mark-owned')).toHaveText(/^OWNED ×\d/);
  await sheet.getByRole('button', { name: 'SET AS MAIN' }).click();
  await expect(tile.locator('.mx-tile-main')).toHaveText('MAIN');
  await expect(sheet.getByRole('button', { name: 'YOUR MAIN — TAKE OFF' })).toBeVisible();
  await sheet.locator('.mx-sheet-close').click();
  await expect(sheet).toHaveCount(0);
  // a locked ROLLABLE mark: no name, a tier-coloured silhouette + its rarity + "1 IN X"
  const locked = page.locator('.mx-tile.is-locked:not(.is-perm)').first();
  await expect(locked.locator('.mx-sil')).toHaveCount(1);
  await expect(locked.locator('.mx-tile-name')).toHaveCount(0);
  await expect(locked.locator('.mx-tile-odds')).toHaveText(/^1 IN /);
  await locked.click();
  await expect(sheet.locator('.mx-sheet-tier')).toContainText('1 IN ');
  await expect(sheet.getByTestId('mark-flavour')).toHaveCount(0);
  await expect(page.locator('.mx-howto')).toHaveCount(0);
  await page.keyboard.press('Escape'); // the sheet closes first, the INDEX stays
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.mx-panel')).toBeVisible();
  // a locked PERMANENT says the task that earns it
  await page.locator('.mx-tile.is-locked.is-perm').first().click();
  await expect(page.locator('.mx-howto')).not.toBeEmpty();
  await page.locator('.mx-sheet-close').click();
  // per-rarity completion is colour + numbers: six tier chips
  await expect(page.locator('[data-testid="marks-collected"] .mx-tierchip')).toHaveCount(6);
  await page.locator('.mx-close').click();
  await expect(page.locator('.menu-mark .menu-mark-mult')).toHaveText('×1.1'); // the worn MAIN under Rebirth Rush (COMMON ×1.1)
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
      localStorage.setItem('taw.tut.markRolls', '1'); // MARK ROLLS are LIVE: keep their tutorial off this spec
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
