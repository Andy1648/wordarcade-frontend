// e2e/marks.spec.js — STEP 49 (Andy oct2): ONE marks system. Marks unlock at LV 10 with a NEW SYSTEM
// reveal; a new mark is CLAIMED (REWARDS badge until then); claiming reveals it and opens the picker;
// the worn mark is EQUIPPED (Andy oct9: EQUIP / UNEQUIP, never "MAIN") — its chip shows it, and the picker says it.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

test('E4: a new mark is owned at once (no inbox) → MARKS button says NEW → EQUIP it (desktop)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('mk.seeded')) return;
    sessionStorage.setItem('mk.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 12, into: 0 }));
    localStorage.setItem('taw.achievements', JSON.stringify(['m-sat-5'])); // SAVANT (RARE) — the COMMON BOMBER is retired (GEAR POOL v2)
    localStorage.setItem('taw.marksOwned', '[]');
    localStorage.setItem('taw.tut.markRolls', '1'); // MARK ROLLS are LIVE: their one-step tutorial would cover the panel
  });
  await page.goto('/?portal=1');
  await menuReady(page);
  // Andy oct2 evening E4: marks and the MARKS system never sit in the claim inbox.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('taw.marksOwned') || '[]'))).toContain('mk-scholar');
  const claims = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.claims') || '[]').map((c) => c.id));
  expect(claims.filter((id) => id.startsWith('mark-') || id.startsWith('layer-'))).toEqual([]);
  const btn = page.locator('.menu-mark');
  // feat/menu-perrow: nothing worn → the YOUR GEAR slot says NONE with a notification dot (it opens the ROLL screen)
  await expect(btn.locator('.menu-mark-name')).toHaveText('NONE');
  await expect(btn.locator('.hp-chip-dot')).toHaveCount(1);
  // Andy oct9 22:56: YOUR GEAR opens the EQUIP screen — the owned SAVANT is there, nothing EQUIPPED yet
  await btn.click();
  const equip = page.locator('[data-testid="equip-screen"]');
  await expect(equip.locator('.mx-tile', { hasText: 'SAVANT' })).toBeVisible();
  await expect(equip.locator('.mx-tile-main')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(equip).toHaveCount(0);
  // GEARS opens the full-screen ROLL screen; its INDEX button opens the MARKS INDEX (the catalogue)
  await page.locator('[data-nav="gears"]').click();
  await page.locator('.rs-overlay').waitFor();
  await expect(page.locator('.rs-roll')).toBeVisible();
  await page.locator('[data-testid="roll-index"]').click();
  // INDEX v2 (Andy oct5): card = name · rarity · 1 IN X · stat; tap → the detail sheet (flavour, owned, first roll)
  await page.locator('.mx-panel').waitFor();
  const tile = page.locator('.mx-tile', { hasText: 'SAVANT' });
  await expect(tile.locator('.mx-tile-tier')).toHaveText('RARE');
  // GEAR TILE v2 (Andy oct9): an OWNED tile's hero is its MAIN STAT; the odds moved to the detail sheet
  await expect(tile.locator('.mx-tile-odds')).toHaveCount(0);
  await expect(tile.locator('.mx-tile-sub')).toHaveText('×1.25 XP');
  await expect(tile.locator('.mark-pips')).toHaveCount(0); // NIGHT oct8 #4: no ★ row under a card
  await tile.click();
  const sheet = page.locator('.mx-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.mx-sheet-name')).toHaveText('SAVANT');
  await expect(sheet.locator('.mx-sheet-tier')).toContainText('RARE');
  await expect(sheet.locator('.mx-sheet-stat')).toHaveText('×1.25 XP');
  // GEAR SHEET v2 (Andy oct9): the MAIN STAT is the sheet's biggest line; the odds sit under it with the ★ progress
  await expect(sheet.getByTestId('mark-main')).toHaveText(/^×1\.25\s*XP$/);
  await expect(sheet.getByTestId('mark-odds')).toHaveText(/^1 IN \d+$/);
  const flavour = (await sheet.getByTestId('mark-flavour').innerText()).trim();
  expect(flavour.length).toBeGreaterThan(0);
  expect(flavour.length).toBeLessThanOrEqual(32);
  await expect(sheet.getByTestId('mark-owned')).toHaveText(/^OWNED ×\d/);
  // Andy oct9 22:56: EQUIP / UNEQUIP buttons — no "MAIN" anywhere, no crit explainer sentence
  await expect(sheet).not.toContainText('MAIN');
  await sheet.getByRole('button', { name: 'EQUIP', exact: true }).click();
  await expect(tile.locator('.mx-tile-main')).toHaveText('EQUIPPED');
  await expect(sheet.getByRole('button', { name: 'UNEQUIP', exact: true })).toBeVisible();
  await sheet.locator('.mx-sheet-close').click();
  await expect(sheet).toHaveCount(0);
  // a locked ROLLABLE mark (GEAR TILE v2 — a HIDDEN design): no name, a tier-coloured silhouette, its rarity, "1 IN X"
  // as the hero and NO stat value
  const locked = page.locator('.mx-tile.is-locked:not(.is-perm)').first();
  await expect(locked.locator('.mx-sil')).toHaveCount(1);
  await expect(locked.locator('.mx-tile-name')).toHaveCount(0);
  await expect(locked.locator('.mx-tile-odds')).toHaveText(/^1 IN [\d\s,K]+$/);
  await expect(locked.locator('.mx-tile-sub, .mc-kind')).toHaveCount(0);
  await expect(locked).not.toContainText(/[×+]\d/);
  await locked.click();
  await expect(sheet.locator('.mc-odds')).toContainText('1 IN '); // the sheet's card: the odds in its hero
  // a locked sheet: the odds + how to get it as the main line, the COUNT of hidden stats, never a value
  await expect(sheet.getByTestId('mark-main')).toContainText('ROLL TO UNLOCK');
  await expect(sheet.getByTestId('mark-crit')).toHaveCount(0);
  await expect(sheet).not.toContainText(/[×+]\d/);
  await expect(sheet.getByTestId('mark-flavour')).toHaveCount(0);
  await expect(page.locator('.mx-howto')).toHaveCount(0);
  await expect(sheet.getByTestId('gear-equip')).toHaveCount(0); // a locked gear: nothing to equip
  await page.keyboard.press('Escape'); // the sheet closes first, the INDEX stays
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.mx-panel')).toBeVisible();
  // a locked PERMANENT says the task that earns it — in the detail sheet only; the grid tile has no prose (Andy oct5).
  // GEAR TILE v2: like every locked card it hides its stat — a lock + ACHIEVEMENT in the hero
  await expect(page.locator('.mx-tile.is-locked.is-perm').first().locator('.mx-howto')).toHaveCount(0);
  await expect(page.locator('.mx-tile.is-locked.is-perm').first().locator('.mx-tile-sub')).toHaveCount(0);
  await expect(page.locator('.mx-tile.is-locked.is-perm').first().locator('.mx-tile-odds')).toHaveText('ACHIEVEMENT');
  await page.locator('.mx-tile.is-locked.is-perm').first().click();
  await expect(page.locator('.mx-howto')).not.toBeEmpty();
  await page.locator('.mx-sheet-close').click();
  // per-rarity completion is colour + numbers: five tier chips (GEAR POOL v2: no COMMON)
  await expect(page.locator('[data-testid="marks-collected"] .mx-tierchip')).toHaveCount(5);
  await page.locator('.mx-close').click(); // back to the ROLL screen
  await page.locator('.rs-close').click();
  // Andy oct5 (later): the menu chip shows ONLY the worn mark's name — no stat line
  await expect(page.locator('.menu-mark .menu-mark-mult')).toHaveCount(0);
  await expect(page.locator('.menu-mark .menu-mark-name')).not.toBeEmpty();
});

test('before LV 10 there is no marks layer at all', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installBackendMock(page);
  await page.addInitScript(() => {
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 5, into: 0 }));
    localStorage.setItem('taw.achievements', JSON.stringify(['m-sat-5'])); // SAVANT (RARE) — the COMMON BOMBER is retired (GEAR POOL v2)
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
  ['owned, not worn, already seen', { 'taw.marksOwned': '["mk-scholar"]', 'taw.marksSeen': '["mk-scholar"]', 'taw.marksRevealed': '1' }],
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
    // gear owned → the EQUIP screen; nothing owned yet → the ROLL screen
    await page.locator('.rs-overlay, [data-testid="equip-screen"]').first().waitFor();
    await page.keyboard.press('Escape');
    await expect(page.locator('.rs-overlay, [data-testid="equip-screen"]')).toHaveCount(0);
    // still there after MARKS closes with nothing worn — the old disappearing act
    await expect(page.locator('.rs-overlay')).toHaveCount(0);
    await expect(btn).toBeVisible();
  });
}

test('no MARKS chip before the system is revealed (LV5) — GEARS shows LOCKED at LV10', async ({ page }) => {
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
  // SEASON 2 #5: the rail shows GEARS (ROLL + INDEX, NIGHT oct8 #2) from the start, padlocked with its real gate (season 1: LV10)
  for (const id of ['gears']) {
    const b = page.locator(`.hp-nav.is-${id} > button`);
    await expect(b).toHaveAttribute('data-locked', '');
    await expect(b).toHaveAttribute('aria-disabled', 'true');
    await expect(b.locator('.kb-rval')).toHaveText('LV10');
    await expect(b.locator('svg[data-icon="lock"]')).toHaveCount(1);
  }
  // a locked tap opens nothing
  await page.locator('.hp-nav.is-gears > button').click({ force: true }); // aria-disabled
  await page.waitForTimeout(300);
  await expect(page.locator('.rs-overlay')).toHaveCount(0);
});
