// e2e/keyboard-up.spec.js — Batch A (Andy oct2): phone gameplay WITH THE KEYBOARD UP — the input, the
// prompt and the timer are always on screen. index.html opts into interactive-widget=resizes-content,
// so on Android the on-screen keyboard SHRINKS the layout viewport (instead of covering the page);
// these cells are that shrunken viewport (a phone minus a ~340-420px keyboard). Every mode, every cell:
// each of the three elements has a box fully inside the viewport and the page does not scroll.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const CELLS = [
  { width: 390, height: 480 }, // 390x844 phone, keyboard up
  { width: 360, height: 400 }, // small Android, keyboard up
  { width: 412, height: 500 }, // Pixel-class, keyboard up
];

const SEED = () => {
  if (sessionStorage.getItem('kb.seeded')) return;
  sessionStorage.setItem('kb.seeded', '1');
  for (const [k, v] of Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seenGameSpotlight': '1', wa_has_played: '1', 'taw.chain.runs': '5', 'taw.fuse.runs': '5', 'taw.xp': JSON.stringify({ lv: 20, into: 0 }) })) localStorage.setItem(k, v);
};

async function onScreen(page, parts, shot) {
  if (shot && process.env.KB_SHOTS) await page.screenshot({ path: `claude/day-oct2/kb/${shot}.png` });
  return page.evaluate((parts) => {
    const H = window.innerHeight;
    const W = window.innerWidth;
    const out = {};
    for (const [name, sel] of Object.entries(parts)) {
      const el = [...document.querySelectorAll(sel)].find((n) => n.getClientRects().length);
      if (!el) { out[name] = 'missing'; continue; }
      const b = el.getBoundingClientRect();
      out[name] = b.top >= -1 && b.bottom <= H + 1 && b.left >= -1 && b.right <= W + 1 && b.height > 0 ? 'ok' : `off ${Math.round(b.top)}..${Math.round(b.bottom)} of ${H}`;
    }
    out.scroll = document.scrollingElement.scrollHeight <= H + 1 ? 'ok' : `scrolls ${document.scrollingElement.scrollHeight}`;
    return out;
  }, parts);
}

const allOk = (r) => Object.fromEntries(Object.keys(r).map((k) => [k, 'ok']));

for (const vp of CELLS) {
  const tag = `${vp.width}x${vp.height}`;

  for (const [mode, url] of [['CHAIN', '/?chain=1&portal=1'], ['FUSE', '/?fuse=1&portal=1']]) {
    test(`${mode} @ ${tag}: input, prompt and timer on screen with the keyboard up`, async ({ page }) => {
      await page.setViewportSize(vp);
      await installBackendMock(page);
      await page.addInitScript(SEED);
      await page.goto(url);
      await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
      await page.locator('.solo-input').focus();
      const r = await onScreen(page, { input: '.solo-input', prompt: '.solo-center', timer: '.solo-clock' }, `${mode}-${tag}`);
      expect(r, JSON.stringify(r)).toEqual(allOk(r));
    });
  }

  test(`SAT RUSH @ ${tag}: input, word card and the reward drain on screen with the keyboard up`, async ({ page }) => {
    await page.setViewportSize(vp);
    await installBackendMock(page);
    await page.addInitScript(SEED);
    await page.goto('/?satrush=1&ref=share');
    await page.locator('.sr-slots').waitFor({ state: 'visible', timeout: 20000 });
    const r = await onScreen(page, { input: '.sr-slots', prompt: '.sr-fields', choices: '.sr-lineup-grid li', timer: '.sr-mult' }, `SAT-${tag}`);
    expect(r, JSON.stringify(r)).toEqual(allOk(r));
  });

  test(`WORD BOMB @ ${tag}: input, fragment and timer on screen with the keyboard up`, async ({ page }) => {
    await page.setViewportSize(vp);
    const ME = 'e2e-player';
    const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }, { id: 'p3', name: 'THIRD', lives: 3 }];
    const mock = await installBackendMock(page);
    await page.addInitScript(SEED);
    await page.goto('/?portal=1');
    await menuReady(page);
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
    await page.waitForTimeout(60);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    await page.waitForTimeout(60);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: 22 } });
    await page.locator('.game-input').waitFor({ state: 'visible' });
    await page.waitForTimeout(4700); // the 3-2-1-GO intro
    await page.locator('.game-input').focus();
    const r = await onScreen(page, { input: '.game-input', prompt: '.game-combo-box', timer: '.wb-timer-value, .bomb-svg' }, `WB-${tag}`);
    expect(r, JSON.stringify(r)).toEqual(allOk(r));
  });

  test(`CATEGORY BLITZ @ ${tag}: input, category and timer on screen with the keyboard up`, async ({ page }) => {
    await page.setViewportSize(vp);
    const mock = await installBackendMock(page);
    await page.addInitScript(SEED);
    await page.goto('/?portal=1');
    await menuReady(page);
    const ME = 'e2e-player';
    const players = [{ id: ME, name: 'YOU', isHost: true, score: 0 }, { id: 'p2', name: 'RIVAL', score: 0 }];
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'easy', players } });
    await page.waitForTimeout(60);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
    await page.waitForTimeout(60);
    mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 30, category: 'NBA teams', categoryId: 'x', rerollsRemaining: 1 } });
    await page.locator('.game-input').waitFor({ state: 'visible' });
    await page.waitForTimeout(800);
    await page.locator('.game-input').focus();
    const r = await onScreen(page, { input: '.game-input', prompt: '.cb-category-display', timer: '.game-timer-row' }, `BLITZ-${tag}`);
    expect(r, JSON.stringify(r)).toEqual(allOk(r));
  });
}
