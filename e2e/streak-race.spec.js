// e2e/streak-race.spec.js — THE PERFECT STREAK in Word Race (nov12, the Word Bomb pass, Andy: "they need to feel benefits of
// playing"). Clean words climb the count beside the word and heat the panel; one wrong letter breaks it; the race-over names the
// best run as a NEW RECORD.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player';
const WORDS = ['planet', 'rocket', 'galaxy', 'meteor', 'comet', 'orbit', 'saturn', 'nebula', 'quasar', 'pulsar', 'cosmos', 'lunar'];

for (const [w, h] of [[390, 844], [1366, 768]]) {
  test(`WORD RACE ${w}x${h}: clean words climb the streak, a typo breaks it, the race-over names the best`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const mock = await installBackendMock(page);
    await page.addInitScript(() => { for (const [k, v] of Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seenGameSpotlight': '1' })) localStorage.setItem(k, v); });
    await page.goto('/?portal=1');
    await menuReady(page);
    const racers = [{ id: ME, name: 'YOU' }, { id: 'b1', name: 'RIVAL', isBot: true }];
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-race', hostId: ME, difficultyKey: 'chill', players: racers.map((r, i) => ({ ...r, isHost: i === 0 })) } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-race' } });
    await page.waitForTimeout(80);
    const now = Date.now();
    mock.pushToClient({ type: 'race_start', payload: { seed: 7, variant: 'words', words: WORDS, target: WORDS.length, capMs: 60000, racers, serverNow: now, goAt: now + 50 } });
    mock.pushToClient({ type: 'race_go', payload: { serverNow: now, goAt: now + 50, endsAt: now + 60000 } });
    await page.locator('.wr-root[data-race-status="racing"]').waitFor({ timeout: 15000 });
    const input = page.locator('.wr-input');
    await expect(page.locator('.wr-streak .combo-badge')).toHaveCount(0);
    for (let i = 0; i < 4; i++) await input.pressSequentially(WORDS[i], { delay: 5 });
    await expect(page.locator('.wr-streak .combo-count')).toHaveText('4');
    await expect(page.locator('.wr-root')).toHaveAttribute('data-heat', '2');
    const m = await page.evaluate(() => {
      const b = document.querySelector('.wr-streak .combo-badge').getBoundingClientRect();
      const words = [...document.querySelectorAll('.wr-typeword, .wr-input')].map((e) => e.getBoundingClientRect());
      const hit = words.some((f) => !(b.right <= f.left || b.left >= f.right || b.bottom <= f.top || b.top >= f.bottom));
      return { inside: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight, hit };
    });
    expect(m.inside, 'the streak is inside the window').toBe(true);
    expect(m.hit, 'the streak never sits on the word or the field').toBe(false);
    // a wrong letter breaks it at once (fixing it does not mend it)
    await input.pressSequentially('x', { delay: 5 });
    await expect(page.locator('.wr-streak .combo-badge')).toHaveCount(0);
    await input.fill('');
    mock.pushToClient({ type: 'race_over', payload: { winnerId: ME, reason: 'finish', standings: [{ id: ME, name: 'YOU', place: 1, words: 4 }, { id: 'b1', name: 'RIVAL', place: 2, words: 2, isBot: true }] } });
    await expect(page.getByTestId('race-peak')).toContainText('4 PERFECT IN A ROW');
    await expect(page.getByTestId('race-peak')).toContainText('NEW RECORD');
  });
}
