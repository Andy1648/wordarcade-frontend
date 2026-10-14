// e2e/wb-fit.spec.js — Andy oct14 "numbers and words get cut off": in Word Bomb the +N WINS number
// must never wrap mid-number and a 12-letter used word (BREATHTAKING) must fit its chip. An R4
// season-2 save makes the per-word wins 4+ digits. Gate: every text box in the WINS pill and the
// USED WORDS chips is ONE line and its text is not clipped (scrollWidth <= clientWidth).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player';
const PLAYERS = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }];
const WORDS = ['RINGING', 'SINGING', 'KINGDOM', 'THINGS', 'BREATHTAKING'];

async function enter(page, vp) {
  await page.setViewportSize(vp);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.s2.rebirths', '4');
      localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 80, f: 0.2, rc: 4, v: 10 }));
    } catch { /* storage blocked */ }
  });
  const mock = await installBackendMock(page);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'hard', players: PLAYERS } });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: PLAYERS, combo: 'ing', usedWords: [], timerSeconds: 20, maxLives: 3 } });
  await page.locator('.game-stage').waitFor({ state: 'visible' });
  await page.waitForTimeout(4700); // the intro countdown
  return mock;
}

async function play(page, mock, word, used) {
  const input = page.locator('.game-input');
  await input.fill(word);
  await input.press('Enter');
  mock.pushToClient({ type: 'word_result', payload: { playerId: ME, word, valid: true, accepted: true } });
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: PLAYERS, combo: 'ing', usedWords: used, timerSeconds: 20, maxLives: 3 } });
  await page.waitForTimeout(200);
}

// every listed box: one line, nothing clipped
async function fits(page, sel) {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => {
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
    return { text: el.textContent, lines: Math.round(el.getBoundingClientRect().height / lh), clipped: el.scrollWidth > el.clientWidth + 1 };
  }), sel);
}

for (const vp of [{ width: 1080, height: 1016 }, { width: 1366, height: 768 }]) {
  test(`@${vp.width}x${vp.height}: R4 wins number never wraps, BREATHTAKING fits its chip`, async ({ page }) => {
    const mock = await enter(page, vp);
    const used = [];
    const receipts = [];
    for (const w of WORDS) {
      used.push(w);
      await play(page, mock, w, [...used]);
      // the docked receipt's figure: one line, inside its box (it used to wrap "+9,62" / "0.5")
      const r = await page.evaluate(() => {
        const box = document.querySelector('.payout--compact');
        const host = box && box.querySelector('.payout-headline-wins');
        if (!host) return null;
        // the figure's own text node (whatever wraps it), measured by its line boxes
        const walk = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
        let t; while ((t = walk.nextNode()) && !/\d/.test(t.textContent)) { /* skip */ }
        if (!t) return null;
        const range = document.createRange(); range.selectNodeContents(t);
        const rects = [...range.getClientRects()].filter((q) => q.width > 0);
        const tops = new Set(rects.map((q) => Math.round(q.top)));
        const br = box.getBoundingClientRect();
        return { text: t.textContent, oneLine: tops.size === 1, inside: rects.every((q) => q.right <= br.right + 1) };
      });
      if (r && process.env.SHOT_DIR && !receipts.length) await page.screenshot({ path: `${process.env.SHOT_DIR}/wb-receipt-${vp.width}x${vp.height}.png` });
      if (r) receipts.push(r);
    }
    expect(receipts.length, 'the docked receipt showed').toBeGreaterThan(0);
    expect(receipts.some((r) => /\d,\d/.test(r.text)), `a 4-digit figure was checked: ${receipts.map((r) => r.text)}`).toBe(true);
    for (const r of receipts) {
      expect(r.oneLine, `receipt "${r.text}" wrapped`).toBe(true);
      expect(r.inside, `receipt "${r.text}" spills out of its box`).toBe(true);
    }
    await page.waitForTimeout(2600); // the wins count-up settles
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/wb-fit-${vp.width}x${vp.height}.png` });
    const plus = await fits(page, '.wins-hud-plus');
    expect(plus.length).toBe(1);
    const m = ((await page.locator('.wins-hud').getAttribute('aria-label')) || '').replace(/,/g, '').match(/([\d.]+)\s*([KMB]?)/i);
    const amount = m ? Number(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[m[2].toUpperCase()] || 1) : 0;
    expect(amount, 'R4 wins total is 4+ digits').toBeGreaterThanOrEqual(1000);
    expect(plus[0].lines, `wins number "${plus[0].text}" wrapped`).toBe(1);
    expect(plus[0].clipped, `wins number "${plus[0].text}" clipped`).toBe(false);
    const chips = await fits(page, '.game-used-chip');
    const bt = chips.find((c) => c.text === 'BREATHTAKING');
    expect(bt, 'BREATHTAKING chip is shown').toBeTruthy();
    for (const c of chips) {
      expect(c.lines, `chip "${c.text}" wrapped`).toBe(1);
      expect(c.clipped, `chip "${c.text}" clipped`).toBe(false);
    }
  });
}
