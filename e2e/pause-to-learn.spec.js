// e2e/pause-to-learn.spec.js — the run ends on the word you didn't get. Prove it is held.
//
// SAT Rush already did this. CHAIN, FUSE, Word Bomb and Blitz ended on a PROMPT and cut straight
// to a score. The word shown now is one the player COULD have played, derived from the final
// prompt (or, for Blitz, taken from the server's own sample of missed answers).
//
// WHAT THESE ASSERT, and why each matters:
//   - the hold appears at run end, IN the card (not as a modal/overlay);
//   - the word is REAL and actually satisfies the prompt that killed the run — a canned word
//     would pass a "is it visible" check and fail this;
//   - no definition is INVENTED. Coverage is ~1% of the acceptance set, so most words have no
//     gloss; the panel must then say something true rather than a filled-in blank.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'me';

async function soloDeath(page, mode) {
  await installBackendMock(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 })); } catch { /* blocked */ }
    // Past the first-run card: a tutorial card replaces the score card under 3 words, and the
    // hold lives on the score card.
    try { localStorage.setItem('taw.runs.chain', '9'); localStorage.setItem('taw.runs.fuse', '9'); } catch { /* blocked */ }
  });
  await page.goto('/?portal=1&soloms=350');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  await page.locator(`.game-card-magnet[data-game="${mode}"] .game-card`).click({ force: true });
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor({ state: 'visible' });
  // ARM THE CLOCK FIRST. A solo run's timer only starts once the player types — a run where
  // nobody touches the keyboard never ends, so waiting for a death card without typing waits
  // forever. One junk character arms it; the clock then runs out on its own.
  const input = page.locator('.solo-input');
  await input.waitFor({ state: 'visible' });
  await input.fill('a');
  await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 45000 });
}

for (const mode of ['chain', 'fuse']) {
  test(`${mode}: the run-end hold shows a REAL word that satisfies the prompt`, async ({ page }) => {
    test.setTimeout(90000);
    await soloDeath(page, mode);
    // The hold renders on BOTH the tutorial card and the score card, so a 0-word run still
    // teaches — no skip, no conditional assertion.
    const hold = page.locator('.missed-hold');
    await expect(hold).toBeVisible();
    const word = (await hold.locator('.missed-hold-word').innerText()).trim();
    const prompt = (await hold.locator('.missed-hold-prompt b').innerText()).trim();
    expect(word.length, 'the held word must be a real word').toBeGreaterThanOrEqual(3);
    if (mode === 'chain') {
      expect(word[0], `${word} does not start with ${prompt}`).toBe(prompt[0]);
    } else {
      expect(word, `${word} does not contain ${prompt}`).toContain(prompt);
    }
    // Either a real gloss OR the honest no-gloss line — never an empty definition slot.
    const hasGloss = await hold.locator('.missed-hold-gloss').count();
    const hasNoGloss = await hold.locator('.missed-hold-nogloss').count();
    expect(hasGloss + hasNoGloss, 'the panel must say something true about the word').toBe(1);
  });
}

test('word bomb: the hold shows a word containing the fragment that killed the run', async ({ page }) => {
  test.setTimeout(60000);
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill',
      players: [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }] },
  });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME,
    players: [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }],
    combo: 'str', usedWords: [], timerSeconds: 30 } });
  await page.locator('.game-wrap').waitFor({ state: 'visible' });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_over', payload: { winnerId: 'p2' } });
  await page.locator('.game-over-overlay').waitFor({ state: 'visible' });

  const hold = page.locator('.missed-hold');
  // The solo word list is fetched lazily AT game over, so give the chunk a moment.
  await expect(hold).toBeVisible({ timeout: 15000 });
  const word = (await hold.locator('.missed-hold-word').innerText()).trim();
  expect(word.toLowerCase(), `${word} does not contain STR`).toContain('str');
  const hasGloss = await hold.locator('.missed-hold-gloss').count();
  const hasNoGloss = await hold.locator('.missed-hold-nogloss').count();
  expect(hasGloss + hasNoGloss).toBe(1);
});

test('the hold is IN the card, not a modal over it', async ({ page }) => {
  test.setTimeout(90000);
  await soloDeath(page, 'fuse');
  const hold = page.locator('.missed-hold');
  await expect(hold).toBeVisible();
  const pos = await hold.evaluate((el) => getComputedStyle(el).position);
  expect(pos, 'a run-end teach must not be a fixed overlay').not.toBe('fixed');
  // And it must live inside the death card it belongs to.
  const inCard = await hold.evaluate((el) => !!el.closest('.solo-deathcard'));
  expect(inCard, 'the hold belongs inside the card, not floating beside it').toBe(true);
});
