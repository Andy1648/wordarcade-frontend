// e2e/teach-first-run.spec.js — the first-run teach, MEASURED TWO WAYS.
//
// Andy: "People aren't getting the gist of randomly typing." The old teach was one line in a
// Spotlight gated on ONE flag shared by every game surface, so the first mode a player opened was
// the only mode that ever explained itself. Copy alone cannot be tested; these two can:
//
//   1. A first run where the player types NOTHING for 10 seconds must still have been shown the
//      rule. (A teach that auto-hides on a timer fails here — and a player who has typed nothing
//      for ten seconds is exactly the one who still needs it.)
//   2. A first run where the player COPIES THE WORKED EXAMPLE must SUCCEED. This is the one that
//      makes the example honest: it is derived from the live prompt against the same word list
//      the mode judges with, so a canned example (a word for a different fragment) fails here.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, modeEntry } from './support/menu.js';

// Seed a genuinely fresh player ONCE, then let the app keep whatever it writes.
// NOT via addInitScript: that runs on EVERY navigation, so a localStorage.clear() in it wipes the
// very flag the "shown once" test is checking — the reload would reset the player to brand new and
// the teach would correctly show again. (It did, and the test caught my harness rather than the
// product.) Seed through one real page load instead.
async function seedFresh(page) {
  await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.evaluate(() => {
    try {
      localStorage.clear();
      // Skip the MENU spotlight only — the thing under test is the in-GAME teach.
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    } catch { /* storage blocked */ }
  });
}

async function enterSolo(page, mode) {
  await page.goto('/?portal=1&soloms=350');
  await menuReady(page);
  await page.waitForTimeout(400);
  await modeEntry(page, mode).click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor({ state: 'visible' });
  await page.locator('.solo-input').waitFor({ state: 'visible' });
}

async function firstRun(page, mode) {
  await seedFresh(page);
  await enterSolo(page, mode);
}

for (const mode of ['chain', 'fuse']) {
  test(`${mode}: a first-timer who types NOTHING for 10s has still been shown the rule`, async ({ page }) => {
    test.setTimeout(60000);
    await firstRun(page, mode);
    const strip = page.locator('.teach-strip');
    await expect(strip).toBeVisible();
    // Ten seconds of doing nothing. The strip must survive it.
    await page.waitForTimeout(10000);
    await expect(strip, 'the teach must not auto-hide on a timer').toBeVisible();
    // And it must carry all three things a first-timer needs.
    await expect(strip.locator('.teach-strip-act')).toHaveText(/TYPE A REAL WORD/);
    await expect(strip.locator('.teach-strip-rule')).not.toBeEmpty();
    await expect(strip.locator('.teach-strip-pay')).not.toBeEmpty();
  });

  test(`${mode}: copying the worked example SUCCEEDS`, async ({ page }) => {
    test.setTimeout(60000);
    await firstRun(page, mode);
    const strip = page.locator('.teach-strip');
    await expect(strip).toBeVisible();
    const example = (await strip.locator('.teach-strip-eg-word').innerText()).trim();
    expect(example, 'the teach must offer a worked example').toBeTruthy();

    // Type it exactly as shown and submit — the literal "copy what it says" path.
    const input = page.locator('.solo-input');
    await input.fill(example);
    await input.press('Enter');

    // Success is the run ACCEPTING it: the accepted-word count moves off zero. The teach also
    // clears itself on the first accepted word, which is the second half of the same proof.
    await expect(strip, 'the teach clears once the player has shown they have the gist')
      .toBeHidden({ timeout: 8000 });
    // And it must not have been rejected: a reject leaves a reason on screen.
    const reason = (await page.locator('.solo-reason').innerText()).trim();
    expect(reason, `copying the example was rejected: "${reason}"`).toBe('');
  });

  test(`${mode}: the teach is shown ONCE — a second run does not repeat it`, async ({ page }) => {
    test.setTimeout(60000);
    await firstRun(page, mode);
    await expect(page.locator('.teach-strip')).toBeVisible();
    await page.locator('.teach-strip-close').click();
    await expect(page.locator('.teach-strip')).toBeHidden();
    // Re-enter the mode WITHOUT re-seeding: the flag is per mode and already set.
    await enterSolo(page, mode);
    await page.waitForTimeout(600);
    await expect(page.locator('.teach-strip')).toHaveCount(0);
  });
}

test('the teach is PER MODE: learning CHAIN does not silence FUSE', async ({ page }) => {
  test.setTimeout(60000);
  // This is the actual defect: one flag for every game surface meant the first mode you opened
  // was the only mode that ever taught you.
  await firstRun(page, 'chain');
  await expect(page.locator('.teach-strip')).toBeVisible();
  await page.locator('.teach-strip-close').click();

  await enterSolo(page, 'fuse');
  await expect(page.locator('.teach-strip'), 'FUSE must still teach itself').toBeVisible();
});
