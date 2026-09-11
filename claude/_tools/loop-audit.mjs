// loop-audit.mjs — does anything LOOP once a screen has settled?
//
// The animation budget's first rule is "ZERO new infinite animations - nothing loops at
// rest", and Phase 6 asks specifically that the end screens' entry juice be a one-shot with
// "nothing loops after". There is a spec asserting the infinite count on the menu and one
// asserting an accept adds none - but nothing covers the END SCREENS, which are exactly
// where a celebratory loop is most tempting to write. So: reach each screen, wait well past
// any entry animation, and count what is still running.
//
// Counts RUNNING animations whose effect is infinite, via getAnimations(), which sees CSS
// animations and WAAPI alike - a JS-driven loop is as much a loop as a keyframe one.
// Usage: node loop-audit.mjs
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });

const COUNT = () => {
  const out = [];
  for (const a of document.getAnimations()) {
    const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : {};
    if (t.iterations !== Infinity) continue;
    if (a.playState !== 'running') continue;
    const el = a.effect && a.effect.target;
    let name = '(unknown)';
    if (el) {
      const cls = String(el.className || '').trim().split(/\s+/)[0];
      name = cls ? `.${cls}` : el.tagName.toLowerCase();
    }
    out.push(`${name} :: ${a.animationName || '(waapi)'}`);
  }
  const tally = {};
  for (const n of out) tally[n] = (tally[n] || 0) + 1;
  return { total: out.length, tally };
};

const SCREENS = [
  {
    name: 'menu (baseline)',
    reach: async (p) => {
      await p.goto('/?portal=1');
      await waitImg(p);
    },
  },
  {
    name: 'wb-gameover',
    reach: async (p, mock) => {
      const dead = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
      await p.goto('/?portal=1');
      await waitImg(p);
      mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: dead } });
      await p.waitForTimeout(80);
      mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
      await p.waitForTimeout(80);
      mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: dead, combo: 'at', usedWords: ['CAT', 'BAT', 'RAT'], timerSeconds: 30 } });
      await p.waitForTimeout(80);
      mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
      await p.locator('.game-over-overlay').waitFor();
    },
  },
  {
    name: 'chain-death',
    reach: async (p) => {
      await p.addInitScript(() => {
        try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch { /* private mode */ }
      });
      await p.goto('/?portal=1&soloms=350');
      await waitImg(p);
      await p.waitForTimeout(300);
      await p.locator('.game-card-magnet[data-game="chain"] .game-card').click({ force: true });
      await p.locator('.mode-dialog-shell').waitFor();
      await p.locator('.mode-dialog-btn-create').click();
      await p.locator('.solo-root').waitFor();
      const i = p.locator('.solo-root input').first();
      await i.waitFor();
      await i.fill('a');
      await p.locator('.solo-deathcard').waitFor({ timeout: 9000 });
    },
  },
];

const browser = await chromium.launch();
console.log('\nLOOP AUDIT - infinite animations still RUNNING after the screen settles\n');
for (const s of SCREENS) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  let err = null;
  try {
    const mock = await installBackendMock(page);
    await s.reach(page, mock);
  } catch (e) {
    err = String(e).split('\n')[0].slice(0, 80);
  }
  // Two samples: right after arrival, and 4s later once every entry one-shot has finished.
  const early = err ? null : await page.evaluate(COUNT);
  await page.waitForTimeout(4000);
  const settled = err ? null : await page.evaluate(COUNT);
  console.log(`${s.name}`);
  if (err) {
    console.log(`  REACH FAIL: ${err}`);
  } else {
    console.log(`  on arrival : ${early.total}`);
    console.log(`  +4s settled: ${settled.total}`);
    for (const [k, v] of Object.entries(settled.tally)) console.log(`      ${v} x ${k}`);
  }
  console.log('');
  await ctx.close();
}
await browser.close();
