// e2e/gameover-coverage.spec.js — JOB 4: game-over screens were the same shape as the Stats
// crash (only reachable through real play, so never covered). Drive each to its game-over via
// the mock-WS harness (or local state for the solo modes) and assert it renders with ZERO real
// console/page errors.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const isNoise = (t) => /Failed to load resource|net::ERR|ERR_FAILED|the server responded with a status of|status of \d{3}|favicon/i.test(t);
function attach(page, errors) {
  page.on('console', (m) => { if (m.type() === 'error' && !isNoise(m.text())) errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
}
const assertClean = (errors) => expect(errors, `errors: ${errors.join(' | ')}`).toHaveLength(0);

const ME = 'e2e-player';
const wbPlayers = [
  { id: ME, name: 'YOU', lives: 3, isHost: true },
  { id: 'p2', name: 'RIVAL', lives: 0 },
];

test.describe('game-over screens render without console errors (JOB 4)', () => {
  test('WORD BOMB game-over (winner overlay)', async ({ page }) => {
    const errors = [];
    attach(page, errors);
    const mock = await installBackendMock(page);
    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 30 } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    await expect(page.locator('.game-over-title')).toBeVisible();
    await page.waitForTimeout(400); // let the stamp/stagger celebration run
    assertClean(errors);
  });

  test('CATEGORY BLITZ game-over (final scores)', async ({ page }) => {
    const errors = [];
    attach(page, errors);
    const mock = await installBackendMock(page);
    const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
    await page.goto('/?portal=1');
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } });
    await page.waitForTimeout(60);
    for (const a of ['APPLE', 'PEAR', 'PLUM']) { mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } }); await page.waitForTimeout(30); }
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME, finalScores: [{ id: ME, name: 'YOU', score: 30 }, { id: 'p2', name: 'RIVAL', score: 10 }] } });
    await expect(page.locator('.game-over-overlay')).toBeVisible();
    await expect(page.locator('.game-over-title')).toBeVisible();
    await expect(page.locator('.cb-scoreboard')).toBeVisible(); // final scoreboard rendered
    await page.waitForTimeout(400);
    assertClean(errors);
  });

  // CHAIN / FUSE run-over: driven by LOCAL state — enter the mode, arm the clock, and let the
  // per-turn timer burn down to run-over (CHAIN: always dead on timeout; FUSE: dead at 0 lives).
  // The real word-1 clock is ~18s, so the test uses the dev-only ?soloms= cap (useSoloGame) to
  // shorten it — the run-over screen then appears deterministically in well under a second, with
  // no flaky 18s rAF wait.
  async function enterSolo(page, id) {
    await page.addInitScript(() => { try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch { /* ignore */ } });
    await page.goto('/?portal=1&soloms=350'); // dev clock cap → fast, deterministic run-over
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    await page.locator(`.game-card-magnet[data-game="${id}"] .game-card`).click({ force: true });
    await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
    await page.locator('.mode-dialog-btn-create').click();
    await page.locator('.solo-root').waitFor({ state: 'visible' });
    // Arm the clock deterministically: fill the play field (arm-on-first-keystroke). fill()
    // targets the element and fires the change the game listens on, unlike keyboard.type which
    // depends on ambient focus (that was the flaky part).
    const input = page.locator('.solo-root input').first();
    await input.waitFor({ state: 'visible' });
    await input.fill('a');
  }

  test('CHAIN run-over (death card)', async ({ page }) => {
    test.setTimeout(30000);
    const errors = [];
    attach(page, errors);
    await installBackendMock(page);
    await enterSolo(page, 'chain');
    await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(300);
    assertClean(errors);
  });

  test('FUSE run-over (death card)', async ({ page }) => {
    test.setTimeout(30000);
    const errors = [];
    attach(page, errors);
    await installBackendMock(page);
    await enterSolo(page, 'fuse');
    await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(300);
    assertClean(errors);
  });
});
