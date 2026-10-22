// e2e/solo-s2-fit.spec.js — the SEASON 2 CHAIN run-over card fits the screen (Andy: "no one should ever scroll unless
// actually a list"). viewport-integrity gates the death card in SEASON 1 only (backendMock sets taw.season2.off), and the
// season-2 card at the rebirth gate carries more rows: REBIRTH READY, the "you could have played" hold, the recent links,
// WINS EARNED and the XP + GEMS row. Measured Oct 21 on main it ran to 812 px at 1366x768 and 988 at 390x844.
// A save at the gate (R3 · LV80 at 99.5 %), a real CHAIN run of a few words, then at each size:
//   * the card's bottom (and right) edge is inside the viewport — nothing scrolls;
//   * REBIRTH READY, the wins total, the GEMS line and RESTART are all on screen, REBIRTH READY above RESTART.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, revealMode } from './support/menu.js';

const SIZES = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1163x501', width: 1163, height: 501 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x640', width: 360, height: 640 },
];
const SHOTS = process.env.SOLO_FIT_SHOTS || '';

const WORDS = { a: 'anchor', b: 'basket', c: 'candle', d: 'dragon', e: 'eagle', f: 'forest', g: 'garden', h: 'hammer', i: 'island', j: 'jacket', k: 'kettle', l: 'ladder', m: 'market', n: 'needle', o: 'orange', p: 'pepper', q: 'quiet', r: 'rabbit', s: 'silver', t: 'tiger', u: 'uncle', v: 'velvet', w: 'window', x: 'xenon', y: 'yellow', z: 'zebra' };
const ALT = { a: 'arrow', b: 'bottle', c: 'carpet', d: 'donkey', e: 'engine', f: 'falcon', g: 'guitar', h: 'harbor', i: 'insect', j: 'jungle', k: 'kitten', l: 'lemon', m: 'meadow', n: 'napkin', o: 'oyster', p: 'pillow', q: 'queen', r: 'river', s: 'spider', t: 'tunnel', u: 'upper', v: 'valley', w: 'walrus', x: 'xylem', y: 'yogurt', z: 'zipper' };

for (const vp of SIZES) {
  test(`season 2 CHAIN run-over card fits @ ${vp.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await installBackendMock(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('sf.seeded')) return;
      sessionStorage.setItem('sf.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.econ', '12');
      localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 80, f: 0.995, rc: 3, v: 10 }));
      localStorage.setItem('taw.s2.rebirths', '3');
      localStorage.setItem('taw.s2.keytier', '5');
      localStorage.setItem('taw.mastery', JSON.stringify({ 'word-bomb': 30 })); // 037: a rebirth needs 10 game words
    });
    await page.goto('/?portal=1&season2=1&soloms=4000'); // a 4 s turn: room to type, still a quick run-over
    await menuReady(page);
    await page.waitForTimeout(400);
    await (await revealMode(page, 'chain')).click({ force: true });
    await page.locator('.mode-dialog-btn-create').click();
    await page.locator('.solo-root:not(.is-loadstate)').waitFor({ state: 'visible' });
    const got = page.getByRole('button', { name: 'GOT IT' });
    if (await got.count()) await got.first().click().catch(() => {});
    const input = page.locator('.solo-root input').first();
    const used = new Set();
    for (let i = 0; i < 6; i++) {
      if (await page.locator('.solo-deathcard').isVisible()) break;
      const letter = await page.evaluate(() => { const m = document.body.innerText.match(/\n([A-Z])\n\1\n\1\n/); return m ? m[1].toLowerCase() : null; });
      if (!letter) break;
      const word = used.has(WORDS[letter]) ? ALT[letter] : WORDS[letter];
      used.add(word);
      const ok = await input.fill(word, { timeout: 2000 }).then(() => input.press('Enter', { timeout: 2000 })).then(() => true, () => false);
      if (!ok) break;
      await page.waitForTimeout(250);
    }
    await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 30_000 });
    await page.waitForTimeout(800);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/chain-s2-${vp.name}.png` });
    await expect(page.locator('.solo-deathcard .solo-rr-ready'), 'the save is at the rebirth gate').toBeVisible();

    const m = await page.evaluate(() => {
      const r = (sel) => { const el = document.querySelector(`.solo-deathcard ${sel}`); if (!el) return null; const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, right: b.right }; };
      const over = document.querySelector('.solo-over');
      return {
        card: r(''), rr: r('.solo-rr-ready'), restart: r('.solo-restart'), wins: r('.wins-earned'), gems: r('.solo-earned-row'),
        scroll: over.scrollHeight - over.clientHeight, h: innerHeight, w: innerWidth,
      };
    });
    m.card = await page.locator('.solo-deathcard').boundingBox().then((b) => ({ top: b.y, bottom: b.y + b.height, right: b.x + b.width }));
    expect(m.card.bottom, `the run-over card runs off the bottom (${Math.round(m.card.bottom)} > ${m.h})`).toBeLessThanOrEqual(m.h);
    expect(m.card.top, 'the run-over card runs off the top').toBeGreaterThanOrEqual(0);
    expect(m.card.right, 'the run-over card runs off the right').toBeLessThanOrEqual(m.w + 1);
    expect(m.scroll, 'the run-over scrim scrolls').toBeLessThanOrEqual(1);
    for (const k of ['rr', 'restart', 'gems']) {
      expect(m[k], `${k} is on the card`).not.toBeNull();
      expect(m[k].bottom, `${k} is below the fold`).toBeLessThanOrEqual(m.h);
    }
    if (m.wins) expect(m.wins.bottom, 'the wins total is below the fold').toBeLessThanOrEqual(m.h);
    expect(m.rr.top, 'REBIRTH READY comes before RESTART').toBeLessThanOrEqual(m.restart.top);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways, 'page scrolls sideways').toBeLessThanOrEqual(1);
  });
}
