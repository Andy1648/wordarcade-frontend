// e2e/daily-contracts.spec.js — DAILY CONTRACTS (prototype): the DAILY tile JOINS the rail (never its own fixed spot),
// the sheet deals three tasks with 44px controls and one SWAP, and a real Word Bomb round on the backend mock ticks the
// contracts from the game's own events: a 9-letter word finishes "7+ letters" (the first of the day → STREAK KEPT), the
// win finishes "Win a game", and the K.O. card says "2 CONTRACTS DONE +40". Screenshots land in test-results/contracts.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = 'test-results/contracts';
const ME = 'e2e-player';
const NAMES = ['YOU', 'RIVAL', 'KIMBERLY'];
const WORDS = ['STRAND', 'INSTRUCT', 'ASTRAY', 'CONSTRUCTS', 'STRESS', 'STRAW', 'STRIKE', 'STRING', 'STROLL'];

async function seed(page, { picks = null, done = [], prog = {}, streak = 5, level = 40 } = {}) {
  await page.addInitScript(({ picks, done, prog, streak, level }) => {
    if (sessionStorage.getItem('cx.seeded')) return;
    sessionStorage.setItem('cx.seeded', '1');
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayIdx = Math.floor((Date.now() - d.getTimezoneOffset() * 60000) / 86400000);
    localStorage.setItem('taw.xp', JSON.stringify({ lv: level, into: 0 }));
    localStorage.setItem('taw.streak', JSON.stringify({ count: streak, lastDay: dayIdx - 1, freezes: 0 }));
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.seenGameSpotlight', '1');
    if (picks) localStorage.setItem('taw.contracts', JSON.stringify({ v: 1, day, picks, prog, seen: {}, done, rerolled: false, sweep: false, kept: done.length > 0 }));
  }, { picks, done, prog, streak, level });
}

for (const vp of [{ width: 1366, height: 768, tag: 'desktop' }, { width: 390, height: 844, tag: 'phone' }]) {
  test(`${vp.tag}: the DAILY tile joins the rail; the sheet deals 3 with 44px controls and one SWAP`, async ({ page }) => {
    await page.setViewportSize(vp);
    await installBackendMock(page);
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue()); // the real Bungee in the screenshots
    await seed(page, { picks: ['any-double', 'sat-first', 'ch-run20'], done: ['any-double'], prog: { 'any-double': 3, 'ch-run20': 7 } });
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    const tile = page.locator('[data-nav="contracts"]');
    await expect(tile).toBeVisible();
    // NO ORPHAN FIXED UI: it is a child of the rail cluster and not fixed itself
    expect(await tile.evaluate((el) => !!el.closest('nav.hp-rail') && getComputedStyle(el).position !== 'fixed')).toBe(true);
    await expect(tile).toContainText('1/3');
    const box = await tile.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await tile.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/${vp.tag}-menu.png` });

    await tile.click();
    const sheet = page.getByTestId('contracts-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.cx-row')).toHaveCount(3);
    await expect(sheet.locator('.cx-row.is-done')).toHaveCount(1);
    await page.waitForTimeout(500); // past the one-shot pop
    for (const b of await sheet.locator('button').all()) {
      const r = await b.boundingBox();
      expect(r.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: `${SHOTS}/${vp.tag}-sheet.png` });
    // ONE SWAP a day: the middle task changes, then every SWAP is gone
    const before = await sheet.locator('.cx-row').nth(1).getAttribute('data-contract');
    await sheet.locator('.cx-row').nth(1).getByRole('button', { name: /swap/i }).click();
    await expect(sheet.locator('.cx-row').nth(1)).not.toHaveAttribute('data-contract', before);
    await expect(sheet.getByRole('button', { name: /swap/i })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
  });
}

test('a Word Bomb round ticks the contracts from its own events: STREAK KEPT toast, then the K.O. card line', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const mock = await installBackendMock(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue()); // the real Bungee in the screenshots
  await seed(page, { picks: ['any-words', 'wb-long7', 'wb-win'] });
  await page.addInitScript(() => localStorage.setItem('taw.reduceMotion', '0'));
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  const players = NAMES.map((name, i) => ({ id: i ? `p${i + 1}` : ME, name, lives: 3, isHost: i === 0 }));
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  // words only land once the round runs: past the 3-2-1 (the round's gem mark is taken when the round mounts)
  await page.locator('.countdown-overlay').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  await page.locator('.countdown-overlay').waitFor({ state: 'detached', timeout: 15000 });
  await page.waitForTimeout(400);
  let k = 0;
  let shot = false;
  for (let round = 0; round < 3; round += 1) {
    for (const p of players) {
      mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: p.id, players, combo: 'str', timerSeconds: 22, maxLives: 3, round: 1, difficultyKey: 'chill', usedWords: [], usedAnswers: [] } });
      await page.waitForTimeout(40);
      mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: WORDS[k % WORDS.length], playerId: p.id } });
      k += 1;
      await page.waitForTimeout(60);
      if (!shot && p.id === ME && round === 1) {
        // my 2nd word is CONSTRUCTS (10 letters): "7+ letters" finishes — the day's first → the STREAK KEPT moment
        const kept = page.locator('.cxt[data-kind="kept"]');
        await expect(kept).toBeVisible();
        await expect(kept).toContainText('STREAK KEPT');
        await expect(kept).toContainText('DAY 6');
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${SHOTS}/desktop-streak-kept.png` });
        shot = true;
      }
    }
  }
  expect(shot).toBe(true);
  const dead = new Set();
  for (const id of ['p3', 'p2']) {
    dead.add(id);
    const cur = players.map((p) => ({ ...p, lives: dead.has(p.id) ? 0 : p.lives }));
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: cur, combo: 'ing', timerSeconds: 22, usedWords: [] } });
    await page.waitForTimeout(120);
  }
  mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
  await page.locator('.game-over-overlay .rs2').waitFor();
  const line = page.getByTestId('contract-done');
  await expect(line).toContainText('2 CONTRACTS DONE');
  await expect(line).toHaveAttribute('data-contract-gems', '40');
  await page.waitForTimeout(4500);
  await page.screenshot({ path: `${SHOTS}/desktop-results.png` });
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.contracts')));
  expect(st.done.sort()).toEqual(['wb-long7', 'wb-win']);
  // the card never scrolls with the extra line
  expect(await page.locator('.rs2').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
});
