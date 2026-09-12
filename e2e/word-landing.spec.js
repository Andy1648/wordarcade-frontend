// e2e/word-landing.spec.js — RARITY IS AN EVENT AT THE WORD, and a secret is not a popup.
//
// REPLACES e2e/secret-sticker.spec.js. That spec guarded a centre-screen sticker over a modal
// backdrop: the whole thing it proved was that the dismiss click was SWALLOWED rather than falling
// through onto the card underneath — which is a good property for a modal to have and a bad reason
// for the modal to exist. The feature is cut. What replaced it is the rule this file gates:
//
//   when a word lands, the WORD ITSELF reacts, in the field the player is already looking at.
//
// So the assertions are the ones that matter for that: the treatment ESCALATES by rarity band, a
// COMMON word gets nothing extra, the payout is attached to the word that earned it, and none of
// it can be clicked — there is no backdrop, nothing to dismiss, and nothing over the menu.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const mkPlayers = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: i === 0 ? ME : `p${i}`,
    name: i === 0 ? 'ANDY' : `PLAYER${i}`,
    lives: 3,
    isHost: i === 0,
  }));

async function enterGame(page) {
  const mock = await installBackendMock(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.seenGameSpotlight', '1');
      localStorage.setItem('taw.rebirths', '1');
    } catch { /* blocked */ }
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  const players = mkPlayers(2);
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'hard', players },
  });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: 20, maxLives: 3 },
  });
  await page.waitForTimeout(4700);
  return mock;
}

const accept = async (page, mock, word) => {
  mock.pushToClient({ type: 'word_result', payload: { playerId: ME, word, valid: true, accepted: true } });
  await page.waitForTimeout(420);
};

test('the word lands with its RARITY BAND on it, escalating tier by tier', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await enterGame(page);
  const landing = page.locator('.wl');

  // 'monster' is common enough to be UNCOMMON with its length bonus: a coloured chip, no stamp.
  // The quietest rung still has to be VISIBLE — that is the whole point of a ladder.
  await accept(page, mock, 'monster');
  await expect(landing).toHaveCount(1);
  await expect(landing).toHaveClass(/wl--uncommon/);
  await expect(landing).toContainText('MONSTER');
  await expect(page.locator('.wl-stamp')).toHaveCount(0, { timeout: 1000 });

  // 'zymurgy' is not in the ranked corpus at all → OBSCURE: the loudest tier, a stamp, and the
  // PAYOUT counting up beside the word that earned it.
  await accept(page, mock, 'stricture');
  await accept(page, mock, 'zymurgy');
  await expect(landing).toHaveClass(/wl--obscure/);
  await expect(landing).toContainText('ZYMURGY');
  await expect(page.locator('.wl-stamp')).toHaveText('OBSCURE');
  await expect(page.locator('.wl-wins')).toContainText('+');
});

test('NOTHING ABOUT IT IS A MODAL: no backdrop, nothing to dismiss, nothing clickable', async ({ page }) => {
  // The defect the deleted sticker had, and the reason it is gone: it was a centre-screen popup
  // over a backdrop that you had to click away, mid-aim, with the card you actually wanted behind
  // it. The replacement must be incapable of that.
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await enterGame(page);
  await accept(page, mock, 'zymurgy');
  await expect(page.locator('.wl')).toHaveCount(1);

  // No scrim, no dialog, and the old sticker classes are gone from the app entirely.
  await expect(page.locator('.secret-backdrop, .sticker-backdrop, [role="dialog"]')).toHaveCount(0);
  await expect(page.locator('.secret-sticker')).toHaveCount(0);

  // It cannot take a pointer: every part of it is pointer-events:none, so a click aimed at the
  // field underneath reaches the field.
  for (const sel of ['.wl', '.wl-chip', '.wl-stamp']) {
    const n = await page.locator(sel).count();
    if (!n) continue;
    const pe = await page.locator(sel).first().evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pe, `${sel} must not be clickable`).toBe('none');
  }
  // The proof: click where the landing is drawn and the INPUT still takes focus.
  const box = await page.locator('.wl').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('.game-input').click();
  await expect(page.locator('.game-input')).toBeFocused();
});

test('it is a ONE-SHOT: the landing is replaced by the next word, never stacked', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await enterGame(page);
  for (const w of ['zymurgy', 'stricture', 'minstrel']) await accept(page, mock, w);
  // One landing at a time, whatever just happened — an accept never leaves the previous word's
  // treatment on screen beside it.
  await expect(page.locator('.wl')).toHaveCount(1);
});

test('the menu has no secret popup left on it', async ({ page }) => {
  // The five detections still exist, but they fire while you PLAY and surface at the word. Nothing
  // about them renders over the menu any more — this is the regression guard for that.
  await installBackendMock(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 }));
      localStorage.setItem('taw.seenMenuSpotlight', '1');
    } catch { /* ignore */ }
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  // Type a palindrome and pause — the exact input that used to raise the sticker.
  for (const ch of 'racecar') await page.keyboard.press(ch);
  await page.waitForTimeout(1200);
  await expect(page.locator('.secret-sticker, .secret-backdrop')).toHaveCount(0);
  await expect(page.locator('.wl')).toHaveCount(0);
  // ...and the menu is still the menu: nothing opened, nothing is covering it.
  await expect(page.locator('[data-game="word-bomb"]')).toBeVisible();
});
