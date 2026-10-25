// e2e/nav-transitions.spec.js — the pooled nav transition on every MAJOR door (Andy oct24 "transition screens for
// all buttons (or at least major ones)"), in the GAME TRANSITION SCREEN's look (oct25: the painted swipe "doesnt
// cover edges, its too quick"). Pins the CLAUDE.md law: the screen is CORRECT IMMEDIATELY while the card is still
// mid-play (it never gates/delays the view), there is exactly ONE overlay node and it is the same node across every
// navigation (pooled, never re-created), it carries will-change only while playing, it COVERS EVERY EDGE mid-card
// at phone → 1440p, and REDUCE MOTION never plays it.
// Frame shots: SHOTS=1 writes per-ms frames + labelled contact sheets to claude/shots-navintro/.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, navControl } from './support/menu.js';

const SHOTS = !!process.env.SHOTS;
const OUT = 'claude/shots-navintro';
if (SHOTS) fs.mkdirSync(OUT, { recursive: true });
const FRAMES = [0, 40, 90, 140, 200, 260, 320, 400, 440, 480, 530, 580];
// mid-card, after the last white impact frame has cleared (heavy flash ends 400) and before the knife (430)
const HOLD_MS = 415;

async function openMenu(page, { reduce = false } = {}) {
  await installBackendMock(page, { seedReduceMotion: false });
  if (SHOTS) await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.continue());
  // a save past LV10 so every door (GEARS included) is open
  await page.addInitScript(() => {
    if (sessionStorage.getItem('nt.seeded')) return;
    sessionStorage.setItem('nt.seeded', '1');
    for (const [k, v] of Object.entries({
      'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.tut.markRolls': '1',
      'taw.xp': JSON.stringify({ lv: 20, into: 0 }),
    })) localStorage.setItem(k, v);
  });
  if (reduce) await page.addInitScript(() => localStorage.setItem('taw.reduceMotion', '1'));
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.waitForTimeout(900); // arrival card + first-paint pops settle; the coalesce window clears
  if (SHOTS) await page.evaluate(() => document.fonts.ready);
  // tag the pooled node so a re-created one would be caught
  await page.evaluate(() => { document.querySelector('.transition-overlay').dataset.e2ePool = 'original'; });
}

const overlayState = (page) => page.evaluate(() => {
  const all = document.querySelectorAll('.transition-overlay');
  const o = all[0];
  return {
    count: all.length,
    pooled: o?.dataset.e2ePool === 'original',
    state: o?.dataset.state,
    word: o?.dataset.word,
    willChange: [...(o?.querySelectorAll('*') || []), o].map((e) => e?.style.willChange || '').join(''),
  };
});

// Arm an observer that snapshots the page AT THE INSTANT the card starts playing.
const armWipeProbe = (page, freeze) => page.evaluate((freeze) => {
  const o = document.querySelector('.transition-overlay');
  window.__wipeAtStart = null;
  const mo = new MutationObserver(() => {
    if (o.dataset.state === 'play' && !window.__wipeAtStart) {
      window.__wipeAtStart = { menuStillUp: !!document.querySelector('.homepage-logo, .hp-m-title'), word: o.dataset.word };
      if (freeze) o.getAnimations({ subtree: true }).forEach((a) => a.pause()); // frame shots step it by hand
      mo.disconnect();
    }
  });
  mo.observe(o, { attributes: true, attributeFilter: ['data-state'] });
}, freeze);

const seek = (page, ms) => page.evaluate((ms) => document.querySelector('.transition-overlay')
  .getAnimations({ subtree: true }).forEach((a) => { a.currentTime = ms; }), ms);
const release = (page) => page.evaluate(() => document.querySelector('.transition-overlay')
  .getAnimations({ subtree: true }).forEach((a) => a.finish()));

// Sample the SCREENSHOT's pixels along every edge (corners + edge midpoints + quarter points): all must be the black
// field. Decoded in the page (a canvas), so no image library is needed.
async function edgesBlack(page) {
  const png = (await page.screenshot()).toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const W = c.width - 1; const H = c.height - 1;
    const pts = [];
    for (const f of [0, 0.25, 0.5, 0.75, 1]) {
      pts.push([Math.round(W * f), 0], [Math.round(W * f), H], [0, Math.round(H * f)], [W, Math.round(H * f)]);
    }
    const bad = [];
    for (const [x, y] of pts) {
      const [r, gr, b] = g.getImageData(x, y, 1, 1).data;
      if (Math.max(r, gr, b) > 12) bad.push(`${x},${y}=rgb(${r},${gr},${b})`);
    }
    return bad;
  }, png);
}

// A labelled contact sheet of the frames (each tile captioned with its ms), rendered in a scratch page.
async function contactSheet(browser, label, files) {
  const tiles = files.map(([ms, f]) => [ms, fs.readFileSync(f).toString('base64')]);
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const p = await ctx.newPage();
  const cols = 4;
  await p.setContent(`<!doctype html><body style="margin:0;background:#1a0b2e;font:700 18px monospace;color:#ffe94a">
    <div style="padding:10px 14px">${label} — nav card (ms from the click)</div>
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px;padding:0 10px 10px">
    ${tiles.map(([ms, b]) => `<figure style="margin:0;position:relative;border:3px solid #9a1aff;border-radius:8px;overflow:hidden">
      <img src="data:image/png;base64,${b}" style="display:block;width:100%">
      <figcaption style="position:absolute;left:0;top:0;background:#ffe94a;color:#000;padding:2px 8px">${ms}ms</figcaption></figure>`).join('')}
    </div></body>`);
  await p.locator('img').last().evaluate((i) => i.decode());
  await p.screenshot({ path: `${OUT}/contact-${label}.png`, fullPage: true });
  await ctx.close();
}

async function door(page, which, screenSel, label, { sheet = false, browser } = {}) {
  await page.waitForTimeout(950); // outside the coalesce window
  const freeze = SHOTS && !!label && label !== 'edges';
  // a menu MOMENT (e.g. the phone's TAPED / NEW FRAME sticker) holds the menu's taps while it plays: re-tap until
  // the door opens (each try re-arms the probe)
  for (let i = 0; i < 8; i += 1) {
    await armWipeProbe(page, freeze || label === 'edges');
    await navControl(page, which).locator('visible=true').first().click();
    const opened = await page.waitForFunction(() => window.__wipeAtStart, null, { timeout: 900 }).then(() => true, () => false);
    if (opened) break;
  }
  await expect.poll(() => page.evaluate(() => window.__wipeAtStart), { timeout: 2000 }).not.toBeNull();
  const at = await page.evaluate(() => window.__wipeAtStart);
  // a VIEW door: the menu is already gone when the card starts — it never gates/delays the swap
  if (!sheet) expect(at.menuStillUp).toBe(false);
  let edges = null;
  if (label === 'edges') {
    await seek(page, HOLD_MS);
    edges = await edgesBlack(page);
    await release(page);
  } else if (freeze) {
    const files = [];
    for (const t of FRAMES) {
      await seek(page, t);
      const f = `${OUT}/${label}-${String(t).padStart(3, '0')}ms.png`;
      await page.screenshot({ path: f });
      files.push([t, f]);
    }
    await release(page);
    if (browser) await contactSheet(browser, label, files);
  }
  const mid = await overlayState(page);
  expect(mid.count).toBe(1);
  expect(mid.pooled).toBe(true);
  await expect(page.locator(screenSel).first()).toBeVisible({ timeout: 4000 });
  await page.waitForTimeout(700);
  const after = await overlayState(page);
  expect(after.state).toBe('idle');
  expect(after.willChange).toBe('');
  return { ...at, edges };
}

test('every major door plays the card over an already-correct screen, through ONE pooled node', async ({ page, browser }, info) => {
  await openMenu(page);
  const rest = await overlayState(page);
  expect(rest.count).toBe(1);
  expect(rest.state).toBe('idle');
  expect(rest.willChange).toBe(''); // never on an idle node

  const tag = info.project.name.replace(/\W+/g, '-');
  const shop = await door(page, 'shop', '.shop-panel', `${tag}-shop`, { browser });
  expect(shop.word).toBe(await page.locator('.shop-title').innerText()); // the word names the screen it lands on (UPGRADES)
  await page.keyboard.press('Escape');
  await menuReady(page);

  const board = await door(page, 'leaderboard', '.lb-panel', `${tag}-board`, { browser });
  expect(board.word).toBe(await page.locator('.lb-title').innerText()); // LEADERBOARD
  await page.keyboard.press('Escape');
  await menuReady(page);

  // a menu SHEET (not a view): GEARS opens the ROLL screen under the same node
  const gears = navControl(page, 'gears').first();
  if (await gears.isVisible()) {
    const g = await door(page, 'gears', '.marks-overlay', `${tag}-gears`, { sheet: true, browser });
    expect(g.word).toBe('ROLL'); // the ROLL screen's own title (.rs-title)
  }
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the card covers a tall screen', async ({ page, browser }) => {
    await openMenu(page);
    const s = await door(page, 'shop', '.shop-panel', 'phone-shop', { browser });
    expect(s.word).toBe(await page.locator('.shop-title').innerText());
  });
});

// Andy oct25 "it doesnt cover edges": sample every edge of the real screenshot mid-card, phone → 1440p.
for (const [w, h] of [[360, 640], [390, 844], [1366, 768], [1920, 1080], [2560, 1440]]) {
  test.describe(`edges ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });
    test(`the black field covers every edge mid-card at ${w}x${h}`, async ({ page }) => {
      await openMenu(page);
      const s = await door(page, 'shop', '.shop-panel', 'edges');
      expect(s.edges, `non-black edge pixels: ${s.edges.join(' ')}`).toEqual([]);
    });
  });
}

test('REDUCE MOTION: the card never plays, the screen still swaps', async ({ page }) => {
  await openMenu(page, { reduce: true });
  await page.waitForTimeout(950);
  await navControl(page, 'shop').first().click();
  await page.waitForTimeout(60);
  const s = await overlayState(page);
  expect(s.state).not.toBe('play');
  expect(await page.locator('.transition-overlay').evaluate((el) => getComputedStyle(el).display)).toBe('none');
});
