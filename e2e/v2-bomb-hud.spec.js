// e2e/v2-bomb-hud.spec.js — P9c Word Bomb HUD (claude/mockups/v2/BombHUD.dc.html; claude/SEASON2-QUEUE.md 9c):
// "bomb + chunk centre, fuse ring, players on a ring (NEVER sideways/stretched cards), hearts, alphabet bonus row.
// PAUSE-TO-LEARN: when you blow up, show for ~2 s one valid word containing the chunk ('NEXT TIME: SING') before the
// bomb moves on."
//
//   * PAUSE TO LEARN (every season): MY turn blows up → an edge card "NEXT TIME: <a real word containing the fragment,
//     not one already played>" for the server's learnPauseMs (else ~2 s), then it goes; someone else blowing up shows
//     nothing; works with the CURRENT server (no learnPauseMs) and under REDUCE MOTION;
//   * SEASON2 HUD: the board wears data-hud="v2"; the fuse ring lights segments for the time left and drops as the
//     clock ticks; the alphabet row lights the letters MY accepted words used; seats are upright cards (wider than
//     tall, unrotated); the fragment is on the bomb; four sizes: no scrollbars, no text < 13 px, nothing loops;
//   * flag OFF: the live board is untouched (no v2 skin, no fuse ring, no alphabet row).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const ME = 'e2e-player';
const NAMES = ['ANDY', 'NOVA', 'KAIJU', 'PIXEL', 'MOTH', 'ZED'];

async function board(page, { season2 = false, reduce = false, vp = { width: 1366, height: 657 }, n = 6 } = {}) {
  await page.setViewportSize(vp);
  await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const mock = await installBackendMock(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
  await page.addInitScript((reduce) => {
    if (sessionStorage.getItem('wb.seeded')) return;
    sessionStorage.setItem('wb.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.seenGameSpotlight', '1');
    localStorage.setItem('taw.reduceMotion', reduce ? '1' : '0');
  }, reduce);
  await page.goto(`/?portal=1${season2 ? '&season2=1' : ''}`);
  await page.waitForTimeout(1200);
  const players = NAMES.slice(0, n).map((name, i) => ({ id: i ? `p${i + 1}` : ME, name, lives: 3, isHost: i === 0 }));
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  const used = ['SINGER', 'KINGDOM'];
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'ing', timerSeconds: 10, maxLives: 3, round: 2, usedWords: used } });
  await page.locator('.game-stage--wb').waitFor();
  await page.waitForTimeout(4600); // the 3-2-1-GO! overlay
  return { mock, players, used };
}

async function blowUp(mock, players, who, { pause = 2000 } = {}) {
  mock.pushToClient({ type: 'turn_timeout', payload: { eliminatedPlayerId: null } });
  const next = players.find((p) => p.id !== who);
  const cur = players.map((p) => (p.id === who ? { ...p, lives: p.lives - 1 } : p));
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: next.id, players: cur, combo: 'ing', timerSeconds: 10, maxLives: 3, round: 2, usedWords: ['SINGER', 'KINGDOM'], ...(pause ? { learnPauseMs: pause } : {}) } });
}

test('PAUSE TO LEARN: my turn blows up → "NEXT TIME: <real word containing ING>" on the edge for the hold, then gone', async ({ page }) => {
  test.setTimeout(60_000);
  const { mock, players } = await board(page);
  await expect(page.locator('.wb-learn')).toHaveCount(0);
  await blowUp(mock, players, ME, { pause: 2000 });
  const card = page.locator('.wb-learn');
  await expect(card).toBeVisible({ timeout: 3000 });
  await expect(card.locator('.wb-learn-k')).toHaveText('NEXT TIME:');
  const word = (await card.getAttribute('data-word')) || '';
  expect(word).toContain('ING');
  expect(word.length).toBeGreaterThanOrEqual(3);
  expect(['SINGER', 'KINGDOM']).not.toContain(word);
  await expect(card.locator('.wb-learn-w b')).toHaveText('ING'); // the fragment is lit inside the word
  // an EDGE card, not a centre popup: it hangs on the bottom cluster, left-aligned
  const b = await card.boundingBox();
  const vp = page.viewportSize();
  expect(b.y + b.height / 2, 'in the lower part of the board').toBeGreaterThan(vp.height * 0.55);
  expect(Math.min(...(await card.locator('*').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)))))).toBeGreaterThanOrEqual(13);
  // ~2 s, then gone
  await page.waitForTimeout(1400);
  await expect(card).toBeVisible();
  await expect(card).toHaveCount(0, { timeout: 2000 });
});

test('PAUSE TO LEARN: the CURRENT server (no learnPauseMs) still teaches for ~2 s; someone else blowing up shows nothing', async ({ page }) => {
  test.setTimeout(60_000);
  const { mock, players } = await board(page);
  await blowUp(mock, players, 'p2', { pause: 0 }); // not me
  await page.waitForTimeout(500);
  await expect(page.locator('.wb-learn')).toHaveCount(0);
  await blowUp(mock, players, ME, { pause: 0 });
  await expect(page.locator('.wb-learn')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.wb-learn')).toHaveCount(0, { timeout: 3500 });
});

test('PAUSE TO LEARN under REDUCE MOTION: shown, nothing animates', async ({ page }) => {
  test.setTimeout(60_000);
  const { mock, players } = await board(page, { reduce: true });
  await blowUp(mock, players, ME);
  const card = page.locator('.wb-learn');
  await expect(card).toBeVisible({ timeout: 3000 });
  expect(await card.evaluate((el) => el.getAnimations().length)).toBe(0);
});

test('SEASON2 HUD: fuse ring tracks the clock, alphabet row lights my letters, seats are upright cards, fragment on the bomb', async ({ page }) => {
  test.setTimeout(60_000);
  const { mock, players } = await board(page, { season2: true });
  const stage = page.locator('.game-stage--wb');
  await expect(stage).toHaveAttribute('data-hud', 'v2');
  const fuse = page.locator('.wb-v2-fuse');
  await expect(fuse).toBeVisible();
  const lit0 = Number(await fuse.getAttribute('data-lit'));
  mock.pushToClient({ type: 'timer_tick', payload: { secondsRemaining: 4 } });
  await expect.poll(async () => Number(await fuse.getAttribute('data-lit'))).toBeLessThan(lit0);
  expect(Number(await fuse.getAttribute('data-lit'))).toBe(16); // 4/10 of 40
  await expect(fuse.locator('.wb-v2-secs')).toHaveText('4');
  // the fragment sits on the bomb; the old plaque is gone from view but kept for a screen reader
  await expect(page.locator('.wb-belly')).toBeVisible();
  expect(await page.locator('.wb-top').evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
  // alphabet row: two accepted words of mine light their letters
  const abc = page.locator('.wb-v2-abc');
  await expect(abc).toContainText('0/26');
  for (const word of ['SING', 'TOPAZ']) {
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word, playerId: ME } });
    await page.waitForTimeout(150);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'ing', timerSeconds: 10, maxLives: 3, usedWords: [] } });
    await page.waitForTimeout(150);
  }
  await expect(abc).toContainText('9/26'); // S I N G T O P A Z
  await expect(abc.locator('.wb-v2-abc-l.is-on')).toHaveCount(9);
  // seats: upright, unrotated cards with an initial tile, name and hearts
  const seats = page.locator('.wb-seat .game-player-card');
  await expect(seats).toHaveCount(6);
  for (let i = 0; i < 6; i += 1) {
    const s = seats.nth(i);
    const box = await s.boundingBox();
    expect(box.width, 'a card is wider than tall').toBeGreaterThan(box.height * 1.8);
    expect(await s.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    await expect(s.locator('.wb-v2-init')).toHaveCount(1);
    await expect(s.locator('.game-player-name-text')).toBeVisible();
    await expect(s.locator('.game-player-hearts')).toBeVisible();
  }
  // cards never overlap one another or the fuse ring
  const hits = await page.evaluate(() => {
    const r = (e) => e.getBoundingClientRect();
    const cards = [...document.querySelectorAll('.wb-seat .game-player-card')].map(r);
    const fuse = r(document.querySelector('.wb-v2-fuse'));
    const x = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    let n = 0;
    cards.forEach((a, i) => { if (x(a, fuse)) n += 1; cards.slice(i + 1).forEach((b) => { if (x(a, b)) n += 1; }); });
    return n;
  });
  expect(hits, 'cards overlap each other / the fuse ring').toBe(0);
});

for (const vp of [{ width: 1280, height: 551 }, { width: 1366, height: 657 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`SEASON2 HUD @${vp.width}x${vp.height}: no scrollbars, no text < 13 px, nothing loops`, async ({ page }) => {
    test.setTimeout(60_000);
    await board(page, { season2: true, vp });
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
      const small = [...document.querySelectorAll('.game-stage--wb *')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => `${el.className}`);
      const infinite = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest('.wb-v2-fuse, .wb-v2-abc, .wb-learn')).length;
      return { h: de.scrollWidth > de.clientWidth, v: de.scrollHeight > de.clientHeight, small, infinite };
    });
    expect(m.h).toBe(false);
    expect(m.v).toBe(false);
    expect(m.small).toEqual([]);
    expect(m.infinite).toBe(0);
  });
}

test('flag OFF: the live board is untouched (no v2 skin, no fuse ring, no alphabet row)', async ({ page }) => {
  test.setTimeout(60_000);
  await board(page);
  await expect(page.locator('.game-stage--wb')).not.toHaveAttribute('data-hud', /.+/);
  await expect(page.locator('.wb-v2-fuse')).toHaveCount(0);
  await expect(page.locator('.wb-v2-abc')).toHaveCount(0);
  await expect(page.locator('.wb-seat .wb-v2-init')).toHaveCount(0);
});
