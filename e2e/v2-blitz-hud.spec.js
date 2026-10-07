// e2e/v2-blitz-hud.spec.js — P10 10f CATEGORY BLITZ (claude/mockups/v2/BlitzImposter.dc.html, BLITZ tab;
// claude/SEASON2-QUEUE.md): "huge category, found/total, answers land as rarity tiles, AI BUILT ribbon, never claim AI
// judging. SKIP IMPOSTER."
//
//   * SEASON2: the round board shows the category HUGE with the AI BUILT ribbon (and nothing says AI judges), FOUND n
//     (+ "/total" only when the server sends one), ROUND n/3, the 30-segment timer, every accepted answer as a tile in
//     its rarity colour with the wins it banked; typing + ENTER still sends submit_answer;
//   * four sizes: no scrollbars, no text < 13 px, nothing loops, the field stays on screen;
//   * flag OFF: the live board is untouched.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'me';
const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];

async function blitz(page, { season2 = true, vp = { width: 1366, height: 657 }, round = {} } = {}) {
  await page.setViewportSize(vp);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const m = await installBackendMock(page);
  await page.addInitScript(() => {
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenGameSpotlight', '1');
  });
  await page.goto(`/?portal=1${season2 ? '&season2=1' : ''}`);
  await menuReady(page);
  m.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  m.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
  await page.waitForTimeout(80);
  m.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 30, category: 'Fruits', categoryId: 'fruits', rerollsRemaining: 1, ...round } });
  await page.locator('.game-wrap').waitFor({ state: 'visible' });
  await page.waitForTimeout(4600); // the 3-2-1-GO
  return m;
}

test('SEASON2 BLITZ: huge category + AI BUILT, FOUND, segmented timer, answers land as rarity tiles, submit still sends', async ({ page }) => {
  test.setTimeout(60_000);
  const m = await blitz(page);
  const stage = page.locator('.game-stage--blitz');
  await expect(stage).toHaveAttribute('data-hud', 'v2');
  await expect(page.locator('.bz2-cat')).toHaveText('FRUITS');
  const fs = await page.locator('.bz2-cat').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fs).toBeGreaterThanOrEqual(56);
  await expect(page.locator('.bz2-ribbon')).toHaveText('✦ AI BUILT');
  // never claim AI judging
  await expect(stage).not.toContainText(/AI (JUDG|CHECK|VERIF|DECID)/i);
  await expect(page.locator('.bz2-found-k')).toHaveText('FOUND');
  await expect(page.locator('.bz2-found-n')).toHaveText('0'); // no total from this server → no "/?"
  await expect(page.locator('.bz2-round')).toHaveText('ROUND 1/3');
  await expect(page.locator('.bz2-segs i')).toHaveCount(30);
  m.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: 15 } });
  await expect(page.locator('.bz2-timer')).toHaveAttribute('data-lit', '15');
  // answers land as tiles (newest first), each its own band + (after the 3-answer gate) its own +wins
  for (const a of ['apple', 'banana', 'dragonfruit', 'kiwi']) {
    m.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } });
    await page.waitForTimeout(150);
  }
  await expect(page.locator('.bz2-tile')).toHaveCount(4);
  await expect(page.locator('.bz2-tile').first().locator('.bz2-tile-a')).toHaveText('KIWI');
  await expect(page.locator('.bz2-found-n')).toHaveText('4');
  await expect.poll(async () => (await page.locator('.bz2-tile-w').allInnerTexts()).filter((t) => /^\+\d/.test(t)).length).toBeGreaterThanOrEqual(1);
  for (const t of await page.locator('.bz2-tile').all()) expect(await t.getAttribute('data-band')).toBeTruthy();
  // the field: typing + ENTER sends submit_answer
  await page.locator('.game-input').fill('mango');
  await page.locator('.game-input').press('Enter');
  const sent = await m.waitForSent('submit_answer');
  expect(sent.payload ? sent.payload.answer : sent.answer).toBe('mango');
});

test('SEASON2 BLITZ: FOUND shows n/total when the server sends a list size', async ({ page }) => {
  test.setTimeout(60_000);
  const m = await blitz(page, { round: { total: 50 } });
  m.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: 'apple' } });
  await expect(page.locator('.bz2-found-n')).toHaveText('1/50');
});

for (const vp of [{ width: 1280, height: 551 }, { width: 1366, height: 657 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`SEASON2 BLITZ @${vp.width}x${vp.height}: no scrollbars, no text < 13 px, nothing loops, the field on screen`, async ({ page }) => {
    test.setTimeout(60_000);
    const m = await blitz(page, { vp });
    for (const a of ['apple', 'banana', 'mango', 'kiwi', 'cherry', 'lemon', 'grape', 'peach', 'coconut', 'papaya', 'fig', 'dragonfruit']) {
      m.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } });
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const vis = (el) => { const cs = getComputedStyle(el); const b = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 1 && b.height > 1; };
      const small = [...document.querySelectorAll('.bz2 *')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && /[a-z0-9]/i.test(x.textContent)))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => `${el.className}`);
      const infinite = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest('.bz2')).length;
      const inp = document.querySelector('.bz2 .game-input').getBoundingClientRect();
      return { h: de.scrollWidth > de.clientWidth, v: de.scrollHeight > de.clientHeight, small, infinite, inputIn: inp.bottom <= innerHeight + 1 && inp.top >= 0 };
    });
    expect(r.h).toBe(false);
    expect(r.v).toBe(false);
    expect(r.small).toEqual([]);
    expect(r.infinite).toBe(0);
    expect(r.inputIn).toBe(true);
  });
}

test('flag OFF: the live Blitz board is untouched', async ({ page }) => {
  test.setTimeout(60_000);
  await blitz(page, { season2: false });
  await expect(page.locator('.game-stage--blitz')).not.toHaveAttribute('data-hud', /.+/);
  await expect(page.locator('.bz2-hero')).toHaveCount(0);
  await expect(page.locator('.cb-category-display')).toBeVisible();
  await expect(page.locator('.cb-my-answers')).toBeVisible();
});
