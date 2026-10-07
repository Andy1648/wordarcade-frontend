// e2e/v2-fuse-hud.spec.js — P10 10b FUSE HUD (claude/mockups/v2/Fuse.dc.html, VERSION A; claude/SEASON2-QUEUE.md):
// "fuse line across the screen, 26-letter strip on the floor, ×5 FRENZY badge at the right edge, clutch = edge hazard
// bands, nothing in the centre."
//
//   * SEASON2: the solo card wears data-hud="v2"; the plate shows the live fragment; the fuse line burns down with the
//     clock; the strip is 26 tiles on the floor, lit by a solved word; the badge sits on the right edge and reads the
//     real FRENZY rule (LIGHT ALL 26 → ×5) or the live countdown; lives hug the left edge;
//   * CLUTCH: ≤ 2 s on the fuse → hazard bands on BOTH side edges; a word landed there pays the CLUTCH bonus as its
//     own credited line (toast row) and no centre burst mounts;
//   * the typed word is drawn big with the fragment lit inside it, over the real input;
//   * four sizes: no scrollbars, no text < 13 px, nothing loops;
//   * flag OFF: the live FUSE screen is untouched.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

async function fuse(page, { season2 = true, vp = { width: 1366, height: 657 }, query = '', frenzy = false, reduce = false, teach = false } = {}) {
  await page.setViewportSize(vp);
  await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
  await installBackendMock(page);
  await page.addInitScript(({ frenzy, reduce, teach }) => {
    if (sessionStorage.getItem('fz2.seeded')) return;
    sessionStorage.setItem('fz2.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    // the first-run teach strip shows a word that is valid for the fragment on screen — the tests' answer key
    if (!teach) localStorage.setItem('taw.seenTeach.fuse', '1');
    localStorage.setItem('taw.reduceMotion', reduce ? '1' : '0');
    if (frenzy) {
      const u = String(Date.now() + 200000);
      localStorage.setItem('taw.frenzyUntil', u);
      localStorage.setItem('taw.s2.frenzyUntil', u);
    }
  }, { frenzy, reduce, teach });
  await page.goto(`/?fuse=1&portal=1${season2 ? '&season2=1' : ''}${query}`);
  await page.locator('.solo-root:not(.is-loadstate)').waitFor({ state: 'visible' });
  return page.locator('.solo-root input').first();
}

test('SEASON2 FUSE: plate, fuse line, strip on the floor, ×5 badge on the right edge, lives on the left', async ({ page }) => {
  test.setTimeout(60_000);
  const input = await fuse(page);
  const root = page.locator('.solo-root');
  await expect(root).toHaveAttribute('data-hud', 'v2');
  const plate = page.locator('.fz2-plate');
  await expect(plate).toBeVisible();
  const frag = await plate.getAttribute('data-frag');
  expect(frag.length).toBeGreaterThanOrEqual(2);
  await expect(page.locator('.fz2-frag')).toHaveText(frag);
  // the strip: 26 tiles on the floor, the fragment's letters hinted
  await expect(page.locator('.fz2-tile')).toHaveCount(26);
  await expect(page.locator('.fz2-strip-n')).toContainText('0 / 26');
  const vp = page.viewportSize();
  const strip = await page.locator('.fz2-strip').boundingBox();
  expect(strip.y + strip.height).toBeGreaterThan(vp.height * 0.85);
  // the badge: right edge, the real rule
  const badge = page.locator('.fz2-badge');
  await expect(badge).toContainText('LIGHT ALL 26');
  await expect(badge).toContainText('26 LEFT');
  await expect(badge).toContainText('×5');
  const bb = await badge.boundingBox();
  const rb = await root.boundingBox();
  expect(rb.x + rb.width - (bb.x + bb.width)).toBeLessThan(12);
  const lb = await page.locator('.fz2-lives').boundingBox();
  expect(lb.x - rb.x).toBeLessThan(12);
  await expect(page.locator('.fz2-heart.is-full')).toHaveCount(2); // FUSE starts on 2 lives (cap 3)
  // the fuse line spans the card and burns down once armed
  const wick = await page.locator('.fz2-wick-track').boundingBox();
  expect(wick.width).toBeGreaterThan(rb.width * 0.8);
  await input.focus();
  await page.keyboard.type('q');
  await page.waitForTimeout(900);
  const sx = await page.locator('.fz2-wick-fill').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  expect(sx).toBeLessThan(1);
  expect(sx).toBeGreaterThan(0.5);
  // the typed word, drawn big, the fragment lit inside it
  await page.keyboard.press('Backspace');
  await page.keyboard.type(`x${frag.toLowerCase()}y`);
  await expect(page.locator('.sv2-typed')).toHaveText(`X${frag}Y`);
  await expect(page.locator('.sv2-typed b')).toHaveText(frag);
  // nothing old: no hero ring, no cords deck
  await expect(page.locator('.solo-hero')).toHaveCount(0);
  await expect(page.locator('.solo-fusedeck')).toHaveCount(0);
});

test('SEASON2 FUSE: a solved word lights its letters on the strip', async ({ page }) => {
  test.setTimeout(60_000);
  const input = await fuse(page, { teach: true });
  await page.locator('.teach-strip-eg-word').waitFor();
  const word = (await page.locator('.teach-strip-eg-word').innerText()).trim().toLowerCase();
  await input.fill(word);
  await input.press('Enter');
  const distinct = new Set(word.replace(/[^a-z]/g, '')).size;
  await expect(page.locator('.fz2-tile.is-lit')).toHaveCount(distinct);
  await expect(page.locator('.fz2-strip-n')).toContainText(`${distinct} / 26`);
  await expect(page.locator('.fz2-badge')).toContainText(`${26 - distinct} LEFT`);
  await expect(page.locator('.fz2-words b')).toHaveText('1');
});

test('SEASON2 FUSE CLUTCH: hazard bands on both edges; a clutch word pays its own line and nothing bursts in the centre', async ({ page }) => {
  test.setTimeout(60_000);
  const input = await fuse(page, { query: '&soloms=2600', teach: true });
  await page.locator('.teach-strip-eg-word').waitFor();
  const word = (await page.locator('.teach-strip-eg-word').innerText()).trim().toLowerCase();
  await expect(page.locator('.fz2-haz')).toHaveCount(0);
  await input.fill(word.slice(0, 1)); // arms the 2.6 s fuse
  await expect(page.locator('.fz2.is-clutch')).toBeVisible({ timeout: 2500 });
  const bands = page.locator('.fz2-haz');
  await expect(bands).toHaveCount(2);
  const vp = page.viewportSize();
  const [l, r] = [await bands.nth(0).boundingBox(), await bands.nth(1).boundingBox()];
  const rb = await page.locator('.solo-root').boundingBox();
  expect(l.x - rb.x).toBeLessThan(8);
  expect(rb.x + rb.width - (r.x + r.width)).toBeLessThan(8);
  expect(l.width).toBeLessThan(vp.width * 0.05);
  await input.fill(word);
  await input.press('Enter');
  // the bonus is said on the LEFT EDGE (S2 purges the toasts), as its own credited line
  const gain = page.locator('.fz2-gain--clutch');
  await expect(gain).toBeVisible({ timeout: 3000 });
  await expect(gain).toContainText(/CLUTCH! \d\.\dS LEFT/);
  await expect(gain).toContainText(/\+\d[\d.,KM]* WINS/);
  const gb = await gain.boundingBox();
  expect(gb.x + gb.width / 2).toBeLessThan(vp.width * 0.45);
  await expect(page.locator('.clutch-burst')).toHaveCount(0);
});

test('SEASON2 FUSE FRENZY: the badge turns gold with the live countdown — no centre burst', async ({ page }) => {
  test.setTimeout(60_000);
  await fuse(page, { frenzy: true });
  const badge = page.locator('.fz2-badge');
  await expect(badge).toHaveClass(/is-frenzy/);
  await expect(badge).toContainText('FRENZY');
  await expect(badge).toContainText('EVERY WORD ×5');
  await expect(badge.locator('.fz2-badge-big')).toHaveText(/^[0-4]:\d\d$/);
  await expect(page.locator('.fz2.is-frenzy')).toHaveCount(1);
  await expect(page.locator('.frenzy-burst')).toHaveCount(0);
});

test('SEASON2 FUSE under REDUCE MOTION: the HUD renders, nothing in it animates', async ({ page }) => {
  test.setTimeout(60_000);
  const input = await fuse(page, { reduce: true });
  await input.focus();
  await page.keyboard.type('q');
  await page.waitForTimeout(400);
  const n = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.fz2')).length);
  expect(n).toBe(0);
});

for (const vp of [{ width: 1280, height: 551 }, { width: 1366, height: 657 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`SEASON2 FUSE @${vp.width}x${vp.height}: no scrollbars, no text < 13 px, nothing loops, the floor fits`, async ({ page }) => {
    test.setTimeout(60_000);
    const input = await fuse(page, { vp });
    await input.focus();
    await page.keyboard.type('q');
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const vis = (el) => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 1 && r.height > 1; };
      const small = [...document.querySelectorAll('.fz2 *')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && /[a-z0-9]/i.test(x.textContent)))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => `${el.className}`);
      const infinite = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest('.fz2')).length;
      const root = document.querySelector('.solo-root').getBoundingClientRect();
      const out = [...document.querySelectorAll('.fz2-tile, .fz2-badge, .fz2-lives, .fz2-plate, .solo-input')].filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > root.bottom + 1 || r.right > root.right + 1 || r.left < root.left - 1 || r.top < root.top - 1; }).map((el) => el.className);
      return { h: de.scrollWidth > de.clientWidth, v: de.scrollHeight > de.clientHeight, small, infinite, out };
    });
    expect(m.h).toBe(false);
    expect(m.v).toBe(false);
    expect(m.small).toEqual([]);
    expect(m.infinite).toBe(0);
    expect(m.out).toEqual([]);
  });
}

test('flag OFF: the live FUSE screen is untouched', async ({ page }) => {
  test.setTimeout(60_000);
  await fuse(page, { season2: false });
  await expect(page.locator('.solo-root')).not.toHaveAttribute('data-hud', /.+/);
  await expect(page.locator('.fz2')).toHaveCount(0);
  await expect(page.locator('.solo-hero')).toBeVisible();
  await expect(page.locator('.solo-fusedeck')).toBeVisible();
});
