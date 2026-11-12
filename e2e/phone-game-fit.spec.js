// e2e/phone-game-fit.spec.js — A GAME ON A PHONE IS ONE SCREEN (Andy nov9: "the screen requires scrolling - only scroll inside (such as for
// the game modes)"). Word Bomb + Category Blitz, in play and at game over, at 360x640 and 390x844: the page never scrolls, nothing
// runs off the side, and the only box allowed to scroll is the Blitz answers + race rail (a list that a big lobby can outgrow).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const OUT = process.env.TREE_OUT;
const ME = 'e2e-player';
const SEED = { 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.xp': JSON.stringify({ lv: 30, into: 0 }), 'taw.seenGameSpotlight': '1' };
async function room(page, mock, type, players) {
  await page.goto('/?portal=1');
  await menuReady(page);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: type, hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: type } });
  await page.waitForTimeout(80);
}
const wbP = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p1', name: 'xX_SPEEDDEMON_Xx', lives: 3 }, { id: 'p2', name: 'RIVAL', lives: 2 }];
const cbP = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p1', name: 'xX_SPEEDDEMON_Xx' }, { id: 'p2', name: 'RIVAL' }];
const SC = {
  'wb-play': async (page, mock) => { await room(page, mock, 'word-bomb', wbP); mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbP, combo: 'str', usedWords: ['strong', 'string'], timerSeconds: 22 } }); await page.waitForTimeout(5500); },
  'cb-play': async (page, mock) => { await room(page, mock, 'category-blitz', cbP); mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 30, category: 'THINGS A PIRATE WOULD REFUSE TO EAT', categoryId: 'x', rerollsRemaining: 1 } }); await page.waitForTimeout(5500); for (const a of ['APPLE', 'PEAR', 'PLUM', 'KIWI', 'MANGO']) { mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } }); await page.waitForTimeout(30); } await page.waitForTimeout(600); },
  'wb-over': async (page, mock) => { await room(page, mock, 'word-bomb', wbP); mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbP, combo: 'at', usedWords: [], timerSeconds: 30 } }); await page.waitForTimeout(100); mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } }); await page.locator('.game-over-overlay').waitFor(); await page.waitForTimeout(2500); },
  'cb-over': async (page, mock) => { await room(page, mock, 'category-blitz', cbP); mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } }); await page.waitForTimeout(100); mock.pushToClient({ type: 'game_over', payload: { winnerId: ME, finalScores: [{ id: ME, name: 'YOU', score: 30 }, { id: 'p1', name: 'xX_SPEEDDEMON_Xx', score: 20 }, { id: 'p2', name: 'RIVAL', score: 10 }] } }); await page.locator('.game-over-overlay').waitFor(); await page.waitForTimeout(2500); },
};
for (const [w, h] of [[360, 640], [390, 844]]) for (const [name, go] of Object.entries(SC)) {
  test(`${name} ${w}`, async ({ browser }) => {
    test.setTimeout(60000);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const mock = await installBackendMock(page);
    await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
    await go(page, mock);
    if (OUT) await page.screenshot({ path: `${OUT}/${name}-${w}.png` });
    const r = await page.evaluate(() => {
      const out = [];
      const d = document.documentElement;
      if (d.scrollHeight > innerHeight + 2) out.push(`DOC +${d.scrollHeight - innerHeight}`);
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if (el.matches('.cb-round-side, .cb-answers-list') || !/(auto|scroll)/.test(cs.overflowY) || el.scrollHeight <= el.clientHeight + 4 || el.getClientRects().length === 0 || cs.visibility === 'hidden') continue;
        out.push(`${String(el.className).split(' ').slice(0, 2).join('.')} +${el.scrollHeight - el.clientHeight} h${el.clientHeight}`);
      }
      return out;
    });
    expect(r, 'only the Blitz answers + race rail may scroll').toEqual([]);
    const side = await page.evaluate(() => [...document.querySelectorAll('.game-stage button, .game-stage input')].filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => { const b = e.getBoundingClientRect(); return { n: e.className.split(' ')[0], r: b.right }; }).filter((x) => x.r > innerWidth + 1).map((x) => x.n));
    expect(side, 'nothing runs off the right edge').toEqual([]);
    await ctx.close();
  });
}
