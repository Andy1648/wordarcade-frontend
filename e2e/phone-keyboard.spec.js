// e2e/phone-keyboard.spec.js — THE PHONE KEYBOARD (Andy nov9: "the game is very not mobile friendly bc of the keyboard on mobile").
// Every typing mode, with the keyboard up, keeps the field, the prompt and the timer inside what the player can see, nothing sits on
// the field, and the page never scrolls. Two platforms:
//   android  the page itself shrinks (index.html: interactive-widget=resizes-content), emulated by shrinking the viewport
//   ios      the page keeps its height and only window.visualViewport shrinks, emulated by a stand-in visualViewport
// Keyboard heights: 336px on a 390x844 phone, 280px on a 360x640 one.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

test.describe.configure({ timeout: 60_000 });
const OUT = process.env.KB_SHOTS || '';
const ME = 'e2e-player';
const SEED = { 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.xp': JSON.stringify({ lv: 30, into: 0 }), 'taw.seenGameSpotlight': '1' };
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

async function room(page, mock, type, players, after) {
  await page.goto('/?portal=1');
  await menuReady(page);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: type, hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: type } });
  await page.waitForTimeout(80);
  after();
}

const MODES = {
  'word bomb': { input: '.game-input', keep: ['.game-combo', '.wb-timer-value'], settle: 5500, go: async (page, mock) => {
    const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p1', name: 'xX_SPEEDDEMON_Xx', lives: 3 }];
    await room(page, mock, 'word-bomb', players, () => mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: ['strong', 'string', 'street', 'stream'], timerSeconds: 22 } }));
    await page.locator('.game-input').waitFor({ state: 'visible', timeout: 15000 });
  } },
  blitz: { input: '.game-input', keep: ['.cb-category-display', '.game-timer-row'], settle: 5500, go: async (page, mock) => {
    const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p1', name: 'xX_SPEEDDEMON_Xx' }];
    await room(page, mock, 'category-blitz', players, () => mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 30, category: 'THINGS A PIRATE WOULD REFUSE TO EAT', categoryId: 'x', rerollsRemaining: 1 } }));
    await page.locator('.game-input').waitFor({ state: 'visible', timeout: 15000 });
  } },
  'word race': { input: '.wr-input', keep: ['.wr-typeword', '.wr-clock'], settle: 800, go: async (page, mock) => {
    const racers = [{ id: ME, name: 'YOU' }, { id: 'b1', name: 'BOT', isBot: true }];
    await room(page, mock, 'word-race', racers.map((r, i) => ({ ...r, isHost: i === 0 })), () => {
      const now = Date.now();
      const words = Array.from({ length: 25 }, (_, i) => `word${String.fromCharCode(97 + i)}`);
      mock.pushToClient({ type: 'race_start', payload: { seed: 11, variant: 'words', words, target: 25, capMs: 60000, racers, serverNow: now, goAt: now + 50 } });
      mock.pushToClient({ type: 'race_go', payload: { serverNow: now, goAt: now + 50, endsAt: now + 60000 } });
    });
    await page.locator('.wr-root[data-race-status="racing"]').waitFor({ state: 'visible', timeout: 15000 });
  } },
  chain: { input: '.solo-input', keep: ['.solo-hero'], settle: 1500, go: async (page) => {
    await page.goto('/?chain=1&portal=1');
    await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
  } },
  fuse: { input: '.solo-input', keep: ['.solo-hero'], settle: 1500, go: async (page) => {
    await page.goto('/?fuse=1&portal=1');
    await page.locator('.solo-input').waitFor({ state: 'visible', timeout: 20000 });
  } },
};

for (const plat of ['android', 'ios']) {
  for (const [w, h, kb] of [[390, 844, 336], [360, 640, 280]]) {
    for (const [name, m] of Object.entries(MODES)) {
      test(`${plat} ${w}x${h} ${name}: keyboard up, the field + prompt + timer stay in view, nothing on the field`, async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: w, height: h }, userAgent: UA, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        if (plat === 'ios') {
          await page.addInitScript(() => {
            const et = new EventTarget();
            window.__vvEt = et;
            const vv = { get height() { return window.__vvh || window.innerHeight; }, get width() { return window.innerWidth; }, addEventListener: (...a) => et.addEventListener(...a), removeEventListener: (...a) => et.removeEventListener(...a) };
            Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
          });
        }
        const mock = await installBackendMock(page);
        await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
        await m.go(page, mock);
        await page.waitForTimeout(m.settle);
        await page.locator(m.input).first().focus();
        if (plat === 'ios') await page.evaluate((v) => { window.__vvh = v; window.__vvEt.dispatchEvent(new Event('resize')); }, h - kb);
        else await page.setViewportSize({ width: w, height: h - kb });
        await expect(page.locator('html')).toHaveAttribute('data-kb', /.*/);
        await page.waitForTimeout(400);
        if (OUT) await page.screenshot({ path: `${OUT}/${plat}-${name.replace(' ', '-')}-${w}.png`, clip: { x: 0, y: 0, width: w, height: h - kb } });
        const r = await page.evaluate(({ input, keep }) => {
          const vis = window.__vvh || window.innerHeight;
          const box = (sel) => { const el = [...document.querySelectorAll(sel)].find((e) => e.getBoundingClientRect().height > 0); return el ? el.getBoundingClientRect() : null; };
          const f = box(input);
          const hits = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
          // anything fixed / absolute painted over the field's centre that is not the field's own row
          const cx = f ? f.left + f.width / 2 : 0;
          const cy = f ? f.top + f.height / 2 : 0;
          const top = f ? document.elementFromPoint(cx, cy) : null;
          const own = top && [...document.querySelectorAll(input)].some((el) => el === top || el.contains(top) || top.contains(el));
          return {
            vis,
            field: f && { top: f.top, bottom: f.bottom },
            keep: keep.map((s) => { const b = box(s); return { s, ok: !!b && b.top >= -1 && b.bottom <= vis + 1, onField: hits(b, f) }; }),
            covered: own ? null : (top ? `${top.tagName}.${String(top.className).slice(0, 40)}` : 'nothing'),
            scrollY: Math.round(window.scrollY),
          };
        }, { input: m.input, keep: m.keep });
        expect(r.field, 'the field is on screen').not.toBeNull();
        expect(r.field.top).toBeGreaterThanOrEqual(-1);
        expect(r.field.bottom, 'the field sits above the keyboard').toBeLessThanOrEqual(r.vis + 1);
        for (const k of r.keep) {
          expect(k.ok, `${k.s} in view`).toBe(true);
          expect(k.onField, `${k.s} is not on the field`).toBe(false);
        }
        expect(r.covered, 'nothing is painted over the field').toBeNull();
        expect(r.scrollY, 'the page never scrolls').toBe(0);
        await ctx.close();
      });
    }
  }
}
