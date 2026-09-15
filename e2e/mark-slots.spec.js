// mark-slots.spec.js — THE MARK SLOTS VARIANT (`?markslots=2|3`), and the promise it makes.
//
// The promise is that WITHOUT the flag nothing changes. marks.test.js pins that for the model;
// this pins it for the PICKER, which is where it broke. The first cut computed
// `full = worn.length >= MARK_SLOTS` unconditionally, so at ONE slot — where a filled loadout is
// the normal state and equipping is supposed to REPLACE — every other mark went disabled and read
// SLOTS FULL. The picker could never change your mark again. All 557 unit tests passed (they
// exercise progress/marks.js, not this component) and it was visible only in the screenshot.
//
// WHAT THIS DOES NOT ASSERT: the payout arithmetic. A second mark actually being PAID rather than
// merely printed is pinned in src/progress/marks.test.js ("the extra slots are actually PAID"),
// because it is a pure function and belongs in a unit test, not behind a browser.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ALL_ACH = ['m-wb-5', 'm-blitz-5', 'm-sat-5', 'sec-dict', 'wpm-70', 'lv-15', 'dist-500', 'sec-eternal'];
const SEED = {
  'taw.keytier': '3', 'taw.wins': '5000', 'taw.winsLifetime': '9000',
  'taw.xp': JSON.stringify({ lv: 18, into: 40 }), 'taw.rebirths': '2', 'taw.letters': '1234',
  'taw.achievements': JSON.stringify(ALL_ACH),
  'taw.mark': 'mk-eternal',
  'taw.marks': JSON.stringify(['mk-eternal', 'mk-bomber']),
};

async function picker(page, slots) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await installBackendMock(page);
  await page.addInitScript((s) => {
    try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch { /* blocked */ }
  }, SEED);
  await page.goto(`/?portal=1${slots > 1 ? `&markslots=${slots}` : ''}`);
  await page.locator('.menu-xp-bar').waitFor({ state: 'visible' });
  await page.locator('.menu-mark').first().click();
  await page.locator('.marks-overlay').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
}

test('ONE SLOT (no flag): nothing is blocked, and equipping still REPLACES', async ({ page }) => {
  await picker(page, 1);

  // No slot row at all — it belongs to the variant.
  expect(await page.locator('.marks-slots').count(), 'the one-slot picker grew a slot row').toBe(0);
  expect(await page.locator('.mark-full').count(), 'a SLOTS FULL badge at one slot').toBe(0);

  // Every UNLOCKED mark stays clickable even though a mark is already worn. This is the assertion
  // the regression failed: it counted 7 disabled.
  const blocked = await page.locator('.mark-card.is-blocked').count();
  expect(blocked, `${blocked} marks were blocked at one slot`).toBe(0);
  const disabled = await page.locator('.mark-card:not(.is-locked)[disabled]').count();
  expect(disabled, `${disabled} unlocked marks were disabled at one slot`).toBe(0);

  // ETERNAL is worn and says so in the one-slot wording.
  await expect(page.locator('.mark-card.is-on .mark-on')).toHaveText('WORN');

  // …and clicking a different one REPLACES it rather than being refused.
  await page.locator('.mark-card', { hasText: 'SPRINTER' }).click();
  await page.waitForTimeout(250);
  const on = await page.locator('.mark-card.is-on .mark-name').allInnerTexts();
  expect(on, 'one slot must hold exactly one mark, and it must be the new one').toEqual(['SPRINTER']);
});

for (const slots of [2, 3]) {
  test(`${slots} SLOTS: the loadout is shown, and a full one refuses visibly`, async ({ page }) => {
    await picker(page, slots);

    const chips = page.locator('.marks-slot');
    expect(await chips.count(), 'one chip per slot').toBe(slots);

    // The seed wears two. At 2 slots that is full; at 3 there is room for one more.
    const on = await page.locator('.mark-card.is-on .mark-name').allInnerTexts();
    expect(on.sort()).toEqual(['BOMBER', 'ETERNAL']);
    await expect(page.locator('.mark-card.is-on .mark-on').first()).toHaveText(/SLOT [12]/);

    const blocked = await page.locator('.mark-card.is-blocked').count();
    if (slots === 2) {
      // Full: every other unlocked mark is refused, and SAYS it is refused rather than being an
      // inert button. Six of the eight are neither worn nor locked here.
      expect(blocked, 'a full loadout must refuse visibly').toBeGreaterThan(0);
      expect(await page.locator('.mark-full').first().innerText()).toBe('SLOTS FULL');
    } else {
      // Room to spare: nothing is refused, and a third mark can go on.
      expect(blocked, 'a loadout with a free slot must refuse nothing').toBe(0);
      await page.locator('.mark-card', { hasText: 'MAGPIE' }).click();
      await page.waitForTimeout(250);
      const after = await page.locator('.mark-card.is-on .mark-name').allInnerTexts();
      expect(after.sort()).toEqual(['BOMBER', 'ETERNAL', 'MAGPIE']);
    }
  });
}
