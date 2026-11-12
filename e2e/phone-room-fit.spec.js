// e2e/phone-room-fit.spec.js — THE WAITING ROOM ON A PHONE (Andy nov9: "only scroll inside (such as for the game modes)"). LEAVE, the
// code, GAME MODE, DIFFICULTY and START hold still; the seats are the one list that scrolls. 2 and 8 seats, Word Bomb + Blitz,
// 360x640 and 390x844: the page and the card never scroll, nothing runs off the side, the code and START stay on screen.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player';
const many = (n) => [{ id: ME, name: 'YOU', lives: 3, isHost: true }, ...Array.from({ length: n - 1 }, (_, i) => ({ id: `p${i}`, name: ['xX_SPEEDDEMON_Xx', 'RIVAL', 'NOBUFFCOOKIES', 'ZED', 'LONGNAMEPLAYER20', 'BOT', 'Q'][i % 7] }))];
const probe = (page) => page.evaluate(() => {
  const out = [];
  const d = document.documentElement;
  if (d.scrollHeight > innerHeight + 2) out.push(`DOC +${d.scrollHeight - innerHeight}`);
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (el.matches('.room-players-list') || !/(auto|scroll)/.test(cs.overflowY) || el.scrollHeight <= el.clientHeight + 2 || el.getClientRects().length === 0 || cs.visibility === 'hidden') continue;
    out.push(`${String(el.className).split(' ').slice(0, 2).join('.')} +${el.scrollHeight - el.clientHeight} h${el.clientHeight}`);
  }
  const side = [...document.querySelectorAll('button, input, [class*="name"]')].filter((e) => e.getClientRects().length).map((e) => ({ n: String(e.className).split(' ')[0], r: e.getBoundingClientRect().right })).filter((x) => x.r > innerWidth + 1).map((x) => `SIDE ${x.n}`);
  return [...out, ...side];
});
const SC = {
  'wb-room-2': async (page, mock) => { await page.goto('/?portal=1'); await menuReady(page); mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: many(2) } }); await page.waitForTimeout(1200); },
  'wb-room-8': async (page, mock) => { await page.goto('/?portal=1'); await menuReady(page); mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: many(8) } }); await page.waitForTimeout(1200); },
  'cb-room-8': async (page, mock) => { await page.goto('/?portal=1'); await menuReady(page); mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players: many(8) } }); await page.waitForTimeout(1200); },
};
for (const [w, h] of [[360, 640], [390, 844]]) {
  for (const [name, go] of Object.entries(SC)) {
    test(`${name} ${w}`, async ({ browser }) => {
      test.setTimeout(60000);
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const mock = await installBackendMock(page);
      await page.addInitScript(() => { for (const [k, v] of Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seenGameSpotlight': '1' })) localStorage.setItem(k, v); });
      await go(page, mock);
      expect(await probe(page), 'only the seats scroll, nothing runs off the side').toEqual([]);
      for (const sel of ['.room-code', '.room-start-btn']) {
        const b = await page.locator(sel).first().boundingBox();
        expect(b && b.y >= 0 && b.y + b.height <= h + 1, `${sel} on screen`).toBe(true);
      }
      await ctx.close();
    });
  }
}
