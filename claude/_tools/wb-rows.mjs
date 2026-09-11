// wb-rows.mjs — what actually consumes the WB stage's height, row by row.
// The ring is capped at a fraction of the VIEWPORT, but it has to fit the space left
// after the header, the fragment and the input. This prints both so the cap can be
// derived from the measurement instead of guessed at.
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const NAMES = ['YOU', 'RIVAL', 'MOTH', 'KESTREL', 'VANE', 'QUILL', 'ORRIS', 'BRAMBLE'];
const players = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: i === 0 ? ME : `p${i + 1}`, name: NAMES[i], lives: 3, isHost: i === 0 }));

const browser = await chromium.launch();
for (const [w, h] of [[1366, 768], [1280, 720], [1440, 900], [390, 844]]) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const mock = await installBackendMock(page);
  const ps = players(4);
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: ps } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: ps, combo: 'str', usedWords: ['MONSTER'], timerSeconds: 30 } });
  await page.locator('.countdown-overlay').waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
  await page.locator('.countdown-overlay').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  const m = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const box = (s) => {
      const e = q(s);
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), w: Math.round(r.width) };
    };
    const stage = q('.game-stage--wb') || q('.game-stage');
    const cs = stage ? getComputedStyle(stage) : null;
    const ring = q('.wb-ring');
    const ringCs = ring ? getComputedStyle(ring) : null;
    // the lowest painted thing inside the ring, including the names that float BELOW
    // each seat box - those hang outside the ring square by design
    let lowest = 0;
    let who = null;
    if (ring) {
      for (const e of ring.querySelectorAll('*')) {
        const r = e.getBoundingClientRect();
        if (r.height === 0) continue;
        if (r.bottom > lowest) { lowest = r.bottom; who = String(e.className).slice(0, 34); }
      }
    }
    return {
      vh: document.documentElement.clientHeight,
      stage: box('.game-stage--wb') || box('.game-stage'),
      header: box('.game-header'),
      prompt: box('.game-combo-box'),
      ring: box('.wb-ring'),
      input: box('.game-input-row'),
      used: box('.game-used'),
      panel: box('.game-panel'),
      wbSize: ringCs ? ringCs.getPropertyValue('--wb-size').trim() : null,
      gridRows: cs ? cs.gridTemplateRows : null,
      ringLowest: Math.round(lowest),
      ringLowestEl: who,
    };
  });
  console.log(`\n=== ${w}x${h} (4 players) ===`);
  console.log(JSON.stringify(m, null, 1));
  await ctx.close();
}
await browser.close();
