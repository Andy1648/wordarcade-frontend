// e2e/sat-rush.spec.js
//
// SAT RUSH end to end: the mode opens from its menu card, THE BRIEFING study
// screen shows before the run, a word can be CLEARED, and running out of lives
// lands on the retro-print results PAGE. Solo mode (no WebSocket), but the shared
// backend mock is installed so the app-level socket never touches production.
//
// `?satRush=1` enables the mode flag so the third card renders; `?portal=1` skips
// the intro straight to the menu.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

// The text of an element with its blank / filled word removed, whitespace
// collapsed — so a briefing card sentence (word filled in) and the in-game
// sentence (word blanked out) reduce to the SAME surrounding context.
function contextOf(locator, innerSelector) {
  return locator.evaluate((el, sel) => {
    const inner = el.querySelector(sel);
    const t = el.textContent.replace(inner ? inner.textContent : '', '');
    return t.replace(/\s+/g, ' ').trim();
  }, innerSelector);
}

test.describe('SAT Rush', () => {
  test('menu card → briefing → play → clear a word → death → results page', async ({ page }) => {
    await installBackendMock(page);
    await page.goto('/?satRush=1&portal=1');

    // The mode opens straight from its menu card (solo — no CREATE/JOIN dialog).
    const card = page.locator('[data-game="sat-rush"]');
    await expect(card).toBeVisible();
    await card.locator('.game-card').click();

    // Start screen → Play.
    const play = page.getByRole('button', { name: 'Play' });
    await expect(play).toBeVisible();
    await play.click();

    // THE BRIEFING shows before the run: five study cards, then Start the run.
    await expect(page.locator('.sr-brief-page')).toBeVisible();
    await expect(page.locator('.sr-brief-card')).toHaveCount(5);
    await page.getByRole('button', { name: 'Start the run' }).click();

    // Playing: the ante multiplier and the letter slots are up.
    await expect(page.locator('.sr-mult')).toBeVisible();
    await expect(page.locator('.sr-slots')).toBeVisible();

    // A rejected key must not crash or strand the field.
    await page.keyboard.press('z');
    await expect(page.locator('.sr-mult')).toBeVisible();

    // A word can be CLEARED without knowing the answer: mashing a wrong key reveals
    // one letter every 3rd press (engine wrongKeystrokeRevealEvery), so enough
    // presses reveal the whole word and complete it — a full-credit clear.
    const scoreCell = page.locator('.sr-hud .sr-hcell').first().locator('.sr-hval');
    await expect(scoreCell).toHaveText('000000');
    for (let i = 0; i < 72; i++) await page.keyboard.press('q');
    await expect(scoreCell).not.toHaveText('000000'); // a clear banked points

    // Let the between-word pause settle onto a fresh, idle word.
    await page.waitForTimeout(1200);

    // Out of lives: give up three words (Escape). Each miss now shows the re-encode
    // teaching beat; a keypress skips it, so press Escape then a key to advance,
    // waiting out each pause so the next Escape isn't swallowed.
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1900);
    }

    // Results: the retro-print PAGE, the DEAD stamp, the AVG ANTE hero, the words
    // mastered line, the share bar, and the paper actions.
    await expect(page.locator('.sr-respage')).toBeVisible();
    await expect(page.locator('.sr-dead')).toBeVisible();
    await expect(page.locator('.sr-ante-value')).toBeVisible();
    await expect(page.locator('.sr-mastered')).toBeVisible();
    await expect(page.getByRole('button', { name: /SHARE/ })).toBeVisible();
    const runItBack = page.getByRole('button', { name: 'Run it back' });
    await expect(runItBack).toBeVisible();

    // Run it back returns through the briefing to a fresh run.
    await runItBack.click();
    await expect(page.locator('.sr-brief-page')).toBeVisible();
    await page.getByRole('button', { name: 'Start the run' }).click();
    await expect(page.locator('.sr-slots')).toBeVisible();
  });

  test('the briefing studies 5 words and the first served word is one of them', async ({ page }) => {
    await installBackendMock(page);
    await page.goto('/?satRush=1&portal=1');
    await page.locator('[data-game="sat-rush"] .game-card').click();
    await page.getByRole('button', { name: 'Play' }).click();

    // Five cards; capture each word's surrounding sentence context.
    const cards = page.locator('.sr-brief-card');
    await expect(cards).toHaveCount(5);
    const briefedContexts = [];
    for (let i = 0; i < 5; i++) {
      const sentence = cards.nth(i).locator('.sr-brief-sentence');
      briefedContexts.push(await contextOf(sentence, '.sr-brief-fill'));
    }

    await page.getByRole('button', { name: 'Start the run' }).click();
    await expect(page.locator('.sr-slots')).toBeVisible();

    // The first served word's sentence context must match one of the five briefed
    // words — proving the briefed words are served first.
    const served = await contextOf(page.locator('.sr-sentence'), '.sr-blank');
    expect(briefedContexts).toContain(served);
  });

  test('?satrush=1 launch link opens SAT Rush directly (skips the intro + menu)', async ({ page }) => {
    await installBackendMock(page);
    // The shareable deep link (satRushLink() -> /?satrush=1&ref=share). No
    // ?portal= and no menu-card click: the launch intent must skip the intro AND
    // route straight into the mode on mount.
    await page.goto('/?satrush=1&ref=share');

    // Landed on the SAT Rush start cover with its Play button — not the menu.
    await expect(page.locator('.sr-cover')).toBeVisible();
    const play = page.getByRole('button', { name: 'Play' });
    await expect(play).toBeVisible();
    // The mode-menu card grid is NOT what we're looking at.
    await expect(page.locator('[data-game="sat-rush"]')).toHaveCount(0);

    // And it's really playable from here (through the briefing, not a dead render).
    await play.click();
    await expect(page.locator('.sr-brief-page')).toBeVisible();
    await page.getByRole('button', { name: 'Start the run' }).click();
    await expect(page.locator('.sr-slots')).toBeVisible();
  });
});
