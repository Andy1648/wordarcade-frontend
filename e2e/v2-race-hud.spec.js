// e2e/v2-race-hud.spec.js — P10 10e WORD RACE (claude/mockups/v2/Race.dc.html, VERSION A; claude/SEASON2-QUEUE.md):
// "the RACE card's pink lanes + cars, current word huge with per-letter colour. Whole words only."
//
//   * SEASON2 (words variant): one pink lane per racer with a name plate + a car; a racer's car drives right as the
//     server's race_progress lands; mine is tagged YOU; the WORD tile shows the word I'm on, each letter coloured as I
//     type it (right = ok, wrong = bad, the rest still to type); typing the exact word still sends submit_word and
//     moves the tile to the next word; WPM + ACC + the NEXT queue are on screen;
//   * at race over (tall screen) the lanes carry the server's placings;
//   * four sizes: no scrollbars, no text < 13 px, nothing loops;
//   * flag OFF: the live race board is untouched.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player';
const racers = [
  { id: ME, name: 'ANDY' }, { id: 'p2', name: 'NOVA' }, { id: 'p3', name: 'KAIJU' }, { id: 'b1', name: 'PIXEL', isBot: true }, { id: 'p5', name: 'MOTH' },
];
const WORDS = 'rocket jump neon ghost pixel storm candy laser orbit fast dragon wave spark maze turbo comet blaze quest river flash zebra lucky night drift winner'.split(' ');

async function race(page, { season2 = true, vp = { width: 1366, height: 657 }, goIn = 50 } = {}) {
  await page.setViewportSize(vp);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const mock = await installBackendMock(page);
  await page.addInitScript(() => {
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.reduceMotion', '0');
  });
  await page.goto(`/?portal=1&race=1${season2 ? '&season2=1' : ''}`);
  await menuReady(page);
  mock.pushToClient({ type: 'room_update', payload: { code: 'RACE1', gameType: 'word-race', hostId: ME, difficultyKey: 'chill', players: racers.map((r, i) => ({ ...r, isHost: i === 0 })) } });
  await page.locator('.wr-lobby').waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-race' } });
  const now = Date.now();
  mock.pushToClient({ type: 'race_start', payload: { seed: 7, variant: 'words', words: WORDS, target: 25, capMs: 60000, racers, serverNow: now, goAt: now + goIn } });
  if (goIn <= 50) {
    mock.pushToClient({ type: 'race_go', payload: { serverNow: now, goAt: now + goIn, endsAt: now + 60000 } });
    await page.locator('.wr-root[data-race-status="racing"]').waitFor({ state: 'visible' });
  }
  return mock;
}

const runX = (page, id) => page.locator(`.rc2-lane[data-racer-id="${id}"] .rc2-run`).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);

test('SEASON2 RACE: pink lanes + cars, the car drives on race_progress, the word tile colours each letter', async ({ page }) => {
  test.setTimeout(60_000);
  const mock = await race(page);
  await expect(page.locator('.wr-root')).toHaveAttribute('data-hud', 'v2');
  await expect(page.locator('.rc2-lane')).toHaveCount(5);
  await expect(page.locator('.rc2-car-svg')).toHaveCount(5);
  await expect(page.locator(`.rc2-lane[data-racer-id="${ME}"] .rc2-you`)).toHaveText('YOU');
  await expect(page.locator('.rc2-lane[data-racer-id="p2"] .rc2-count')).toHaveText('0/25');
  const x0 = await runX(page, 'p2');
  mock.pushToClient({ type: 'race_progress', payload: { racerId: 'p2', index: 10, word: WORDS[9] } });
  await expect(page.locator('.rc2-lane[data-racer-id="p2"] .rc2-count')).toHaveText('10/25');
  await expect.poll(() => runX(page, 'p2')).toBeGreaterThan(x0 + 20);
  // the word tile: the word I'm on, huge, coloured as I type
  const word = page.locator('.rc2-word');
  await expect(word.locator('.rc2-l')).toHaveText(['R', 'O', 'C', 'K', 'E', 'T']);
  const fs = await word.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(fs).toBeGreaterThanOrEqual(56);
  const input = page.locator('.wr-input');
  await input.focus();
  await page.keyboard.type('rox');
  await expect(word.locator('.rc2-l.is-ok')).toHaveCount(2);
  await expect(word.locator('.rc2-l.is-bad')).toHaveCount(1);
  await expect(word.locator('.rc2-l.is-todo')).toHaveCount(3);
  await expect(page.locator('.rc2-acc')).toHaveText('67% ACC');
  // the exact word still sends itself and the tile moves on
  await page.keyboard.press('Backspace');
  await page.keyboard.type('cket');
  const sent = await mock.waitForSent('submit_word');
  expect(sent.payload ? sent.payload.word : sent.word).toBe('rocket');
  await expect(word.locator('.rc2-l')).toHaveText(['J', 'U', 'M', 'P']);
  await expect(page.locator('.rc2-prog')).toHaveText('2/25');
  await expect(page.locator('.rc2-next .wr-up').first()).toHaveText('NEON');
  await expect(page.locator('.rc2-wpm-k')).toHaveText('WPM');
  // no fragment hero, no mascot runners
  await expect(page.locator('.wr-runner')).toHaveCount(0);
});

test('SEASON2 RACE countdown: the number pops in the word tile', async ({ page }) => {
  test.setTimeout(60_000);
  await race(page, { goIn: 3000 });
  await expect(page.locator('.rc2-tile .rc2-count-n')).toHaveText(/^[1-3]$/);
});

test('SEASON2 RACE over (tall screen): the lanes carry the server placings', async ({ page }) => {
  test.setTimeout(60_000);
  const mock = await race(page, { vp: { width: 1920, height: 1080 } });
  mock.pushToClient({ type: 'race_over', payload: { winnerId: 'p2', reason: 'cap', standings: [
    { id: 'p2', name: 'NOVA', place: 1, words: 25 }, { id: ME, name: 'ANDY', place: 2, words: 22 }, { id: 'p3', name: 'KAIJU', place: 3, words: 20 },
    { id: 'b1', name: 'PIXEL', isBot: true, place: 4, words: 18 }, { id: 'p5', name: 'MOTH', place: 5, words: 12 },
  ] } });
  await expect(page.locator('.rc2-lane[data-racer-id="p2"] .rc2-place')).toHaveText('1ST');
  await expect(page.locator(`.rc2-lane[data-racer-id="${ME}"] .rc2-place`)).toHaveText('2ND');
  await expect(page.locator('.wr-standings li')).toHaveCount(5);
});

for (const vp of [{ width: 1280, height: 551 }, { width: 1366, height: 657 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`SEASON2 RACE @${vp.width}x${vp.height}: no scrollbars, no text < 13 px, nothing loops, the tile + lanes fit`, async ({ page }) => {
    test.setTimeout(60_000);
    const mock = await race(page, { vp });
    mock.pushToClient({ type: 'race_progress', payload: { racerId: 'p3', index: 7, word: WORDS[6] } });
    await page.locator('.wr-input').focus();
    await page.keyboard.type('roc');
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
      const small = [...document.querySelectorAll('.wr-root *')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && /[a-z0-9]/i.test(x.textContent)))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => `${el.className}`);
      const infinite = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest('.wr-root')).length;
      const root = document.querySelector('.wr-root').getBoundingClientRect();
      const out = [...document.querySelectorAll('.rc2-lane, .rc2-tile, .rc2-wpm, .rc2-word')].filter(vis).filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > root.bottom + 1 || r.top < root.top - 1; }).map((el) => el.className);
      return { h: de.scrollWidth > de.clientWidth, v: de.scrollHeight > de.clientHeight, small, infinite, out };
    });
    expect(m.h).toBe(false);
    expect(m.v).toBe(false);
    expect(m.small).toEqual([]);
    expect(m.infinite).toBe(0);
    expect(m.out).toEqual([]);
  });
}

test('flag OFF: the live race board is untouched', async ({ page }) => {
  test.setTimeout(60_000);
  await race(page, { season2: false });
  await expect(page.locator('.wr-root')).not.toHaveAttribute('data-hud', /.+/);
  await expect(page.locator('.rc2-track')).toHaveCount(0);
  await expect(page.locator('.wr-runner').first()).toBeVisible();
  await expect(page.locator('.wr-typeword')).toBeVisible();
});
