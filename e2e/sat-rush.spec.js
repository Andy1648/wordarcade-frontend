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
import { modeEntry } from './support/menu.js';

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

    // Out of lives: give up words (Escape) until the results PAGE appears. STATE-DRIVEN, not fixed
    // waits — the engine owns REAL-TIME pauses (the between-word + re-encode-beat timers), so under
    // full-suite parallel load those run in wall-clock while the page is starved, and a fixed delay
    // can land an Escape mid-pause where it's swallowed (the old `waitForTimeout(1900)×3` flake,
    // diagnosed on fix/flake-pair — test timing, not a component bug). So we retry Escape + a
    // beat-skip keypress against the observable end state, exactly as a real player responds to what
    // they see rather than a clock.
    await expect
      .poll(
        async () => {
          if (await page.locator('.sr-respage').isVisible()) return true;
          await page.keyboard.press('Escape'); // give up the current word → costs a life
          await page.waitForTimeout(250);
          await page.keyboard.press('x'); // a keypress skips the re-encode teaching beat
          await page.waitForTimeout(250);
          return page.locator('.sr-respage').isVisible();
        },
        { timeout: 25000, intervals: [400] }
      )
      .toBe(true);

    // Results: the retro-print PAGE, the DEAD stamp, the AVG ANTE hero, the words
    // mastered line, and the paper actions.
    // The SHARE button assertion is GONE with the share pipeline itself — Andy: "no one in the
    // history uses that". This was the only place in e2e/ that reached it by ROLE rather than by
    // class, which is why the class-name sweep over the deletion missed it.
    await expect(page.locator('.sr-respage')).toBeVisible();
    await expect(page.locator('.sr-dead')).toBeVisible();
    await expect(page.locator('.sr-ante-value')).toBeVisible();
    await expect(page.locator('.sr-mastered')).toBeVisible();
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
    await modeEntry(page, 'sat-rush').click();

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
    await modeEntry(page, 'sat-rush').click();
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

  test('?satrush=1 launch link opens a PLAYABLE SAT run (skips the intro, menu AND cover)', async ({ page }) => {
    await installBackendMock(page);
    // The shareable deep link (satRushLink() -> /sat-rush/play?ref=share; the legacy ?satrush=1
    // query still works and is what this asserts). No ?portal= and no menu-card click.
    await page.goto('/?satrush=1&ref=share');

    // It used to land on the COVER, from which a stranger needed four more taps — Play, a mode,
    // five briefing cards, "Start the run" — before a single word appeared. On the one link
    // acquisition traffic is pointed at, that was four chances to leave. It now starts the run.
    await expect(page.locator('.sr-slots')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.sr-cover')).toHaveCount(0);
    await expect(page.locator('.sr-modeselect')).toHaveCount(0);
    // The mode-menu card grid is NOT what we're looking at.
    await expect(page.locator('[data-game="sat-rush"]')).toHaveCount(0);
    // A live run: the HUD is up and the way out is the labelled one.
    await expect(page.locator('.sr-hud')).toBeVisible();
    await expect(page.locator('.sr-hud-exit')).toContainText('MENU');
  });

  test('the COVER and the mode picker are still reachable from the menu card', async ({ page }) => {
    // The deep link auto-starts, but that must not cost the menu route its mode choice (and with
    // it the BRIEFING mode). `?satRush=1` enables the mode WITHOUT being a launch intent — the
    // launch intent is the lowercase `satrush` — so this is the ordinary menu entry.
    await installBackendMock(page);
    await page.goto('/?satRush=1&portal=1');
    const card = page.locator('[data-game="sat-rush"]');
    await expect(card).toBeVisible();
    await card.locator('.game-card').click();
    await expect(page.locator('.sr-cover')).toBeVisible();
    await pickMode(page, 'briefing');
    await expect(page.locator('.sr-brief-page')).toBeVisible();
    await page.getByRole('button', { name: 'Start the run' }).click();
    await expect(page.locator('.sr-slots')).toBeVisible();
  });
});
