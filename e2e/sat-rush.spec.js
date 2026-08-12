// e2e/sat-rush.spec.js
//
// SAT RUSH end to end. The mode opens from its menu card, the cover's Play leads
// to the MODE SELECT (two cards: BRIEFING and LINEUP), and each mode plays:
//   - BRIEFING → the mandatory study screen (no skip) → a word can be CLEARED →
//     out of lives → the retro-print results PAGE.
//   - LINEUP → straight into the run with a SUSPECT LINEUP, no study screen.
// Solo mode (no WebSocket), but the shared backend mock is installed so the
// app-level socket never touches production.
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

// Cover → Play → the mode picker's chosen card. Returns once the choice is made.
async function pickMode(page, mode) {
  await page.getByRole('button', { name: 'Play' }).click();
  const picker = page.locator('.sr-modeselect');
  await expect(picker).toBeVisible();
  const name = mode === 'lineup' ? /LINEUP/ : /BRIEFING/;
  await page.getByRole('button', { name }).click();
}

test.describe('SAT Rush', () => {
  test('menu card → mode select → BRIEFING → play → clear → death → results', async ({ page }) => {
    await installBackendMock(page);
    await page.goto('/?satRush=1&portal=1');

    // The mode opens straight from its menu card (solo — no CREATE/JOIN dialog).
    const card = page.locator('[data-game="sat-rush"]');
    await expect(card).toBeVisible();
    await card.locator('.game-card').click();

    // Cover → Play → the mode picker, then choose BRIEFING.
    await pickMode(page, 'briefing');

    // THE BRIEFING is now MANDATORY: five study cards, one Start button, and NO
    // skip path anywhere on the screen.
    await expect(page.locator('.sr-brief-page')).toBeVisible();
    await expect(page.locator('.sr-brief-card')).toHaveCount(5);
    await expect(page.getByRole('button', { name: /skip/i })).toHaveCount(0);
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

    // Run it back returns to the MODE PICKER (always shown, preselected to the last
    // choice), not straight into a run.
    await runItBack.click();
    await expect(page.locator('.sr-modeselect')).toBeVisible();
    await page.getByRole('button', { name: /BRIEFING/ }).click();
    await expect(page.locator('.sr-brief-page')).toBeVisible();
    await page.getByRole('button', { name: 'Start the run' }).click();
    await expect(page.locator('.sr-slots')).toBeVisible();
  });

  test('LINEUP mode: no study screen, a suspect lineup is served with the word', async ({ page }) => {
    await installBackendMock(page);
    await page.goto('/?satRush=1&portal=1');
    await page.locator('[data-game="sat-rush"] .game-card').click();

    // Choose LINEUP — it drops straight into the run (no briefing screen).
    await pickMode(page, 'lineup');
    await expect(page.locator('.sr-brief-page')).toHaveCount(0);
    await expect(page.locator('.sr-slots')).toBeVisible();
    await expect(page.locator('.sr-mult')).toBeVisible();

    // The suspect lineup is up, with between 2 and 6 suspects (thin-pool words can
    // serve a reduced lineup), and no spell-along block.
    await expect(page.locator('.sr-lineup')).toBeVisible();
    const suspects = await page.locator('.sr-suspect').count();
    expect(suspects).toBeGreaterThanOrEqual(2);
    expect(suspects).toBeLessThanOrEqual(6);
    await expect(page.locator('.sr-spell')).toHaveCount(0);

    // Still typeable: a rejected key must not crash or strand the field.
    await page.keyboard.press('z');
    await expect(page.locator('.sr-mult')).toBeVisible();
  });

  test('the briefing studies 5 words and the first served word is one of them', async ({ page }) => {
    await installBackendMock(page);
    await page.goto('/?satRush=1&portal=1');
    await page.locator('[data-game="sat-rush"] .game-card').click();
    await pickMode(page, 'briefing');

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

    // And it's really playable from here (through the picker + briefing).
    await pickMode(page, 'briefing');
    await expect(page.locator('.sr-brief-page')).toBeVisible();
    await page.getByRole('button', { name: 'Start the run' }).click();
    await expect(page.locator('.sr-slots')).toBeVisible();
  });
});
