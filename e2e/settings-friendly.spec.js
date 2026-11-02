// e2e/settings-friendly.spec.js — SETTINGS, friendly (Andy oct28: "make settings a bit more user friendly (tf why is it
// at the corner....) too ai tell"):
//   1. the menu's SETTINGS is a labelled button in the menu's own rail (beside the WINS / GEMS pills), not a lone cog
//      in the bottom-right corner;
//   2. the sheet is grouped (SOUND · GAMEPLAY · SAVE CODE · DANGER ZONE) and FITS the viewport — no scroll on desktop;
//   3. none of its controls overlap each other;
//   4. on a phone every control is ≥ 44 px and every line of text ≥ 16 px.
// SHOTS=1 also saves the menu + open-sheet screenshots (SHOTS_DIR, default claude/shots-settings/after).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = !!process.env.SHOTS;
const DIR = process.env.SHOTS_DIR || 'claude/shots-settings/after';
const SECRET = 'd7'.repeat(24);

async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const rows = [{ id: 'me', username: 'NOBUFFCOOKIES', level: 40, rebirths: 2, stars: 0, lifetime_words: 500, lifetime_letters: 2500, wins_per_word: 10, econ: 13, submitted_at: Date.now() + 3_600_000 }];
  await mockBoard(page, [], { caps: true, shared: { rows, secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, season2: true });
  await page.addInitScript((secret) => {
    if (sessionStorage.getItem('sf.seeded')) return;
    sessionStorage.setItem('sf.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'NOBUFFCOOKIES' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0.4, rc: 2, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '2');
    for (const k of ['gems', 'power', 'gears', 'markRolls', 'rebirth', 'board', 'keyTier', 'init']) localStorage.setItem(`taw.tut.${k}`, '1');
  }, SECRET);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  if (SHOTS) await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(SHOTS ? 600 : 300);
}

const settled = (page) => page.waitForFunction(() => document.getAnimations().every((a) => {
  const t = a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming();
  return a.playState !== 'running' || !t || t.iterations === Infinity;
}));

const SIZES = [
  { w: 1920, h: 1080, phone: false },
  { w: 1366, h: 768, phone: false },
  { w: 1280, h: 720, phone: false },
  { w: 390, h: 844, phone: true },
  { w: 360, h: 640, phone: true },
];

for (const { w, h, phone } of SIZES) {
  test(`@${w}x${h}: SETTINGS is a labelled menu button; the sheet fits, nothing overlaps${phone ? ', 16px text / 44px targets' : ''}`, async ({ page }) => {
    await boot(page, w, h);
    const btn = page.locator('[data-nav="settings"]:visible').first();
    await expect(btn).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${DIR}/menu-${w}x${h}.png` });
    // it lives IN the menu's rail (with UPGRADES / GEARS / REBIRTH / STATS), never the bottom-right corner cluster; on
    // desktop it is a NAMED button that says SETTINGS (the phone rail keeps its 44px cog beside the WINS / GEMS pills)
    await expect(page.locator('.hp-extras [data-nav="settings"]')).toHaveCount(0);
    if (phone) await expect(page.locator('.hp-m-rail [data-nav="settings"]')).toBeVisible();
    else {
      await expect(page.locator('.hp-rail [data-nav="settings"]')).toBeVisible();
      await expect(btn).toContainText('SETTINGS');
    }
    await btn.click();
    const sheet = page.locator('.sp-sheet');
    await sheet.waitFor({ state: 'visible' });
    await settled(page);
    if (SHOTS) await page.screenshot({ path: `${DIR}/settings-${w}x${h}.png` });

    // the four groups, in order
    await expect(sheet.locator('.sp-group-title')).toHaveText(['SOUND', 'GAMEPLAY', 'SAVE CODE', 'DANGER ZONE']);

    const m = await sheet.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const vis = (n) => { const cs = getComputedStyle(n); const b = n.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && b.width > 1 && b.height > 1; };
      // EVERY control on its own — each volume bar too (the oct28 audit: at 360x640 CLOSE sat on the bars, and the bars
      // were 13–17 px wide touch targets)
      const ctl = [...el.querySelectorAll('button, input, [role="switch"], [role="radio"], .sp-short')].filter(vis);
      const boxes = ctl.map((n) => { const b = n.getBoundingClientRect(); return { k: `${n.tagName}.${String(n.className).split(' ')[0]}:${(n.textContent || n.getAttribute('aria-label') || '').trim().slice(0, 14)}`, l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; });
      const overlaps = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]; const c = boxes[j];
        if (Math.min(a.r, c.r) - Math.max(a.l, c.l) > 1 && Math.min(a.b, c.b) - Math.max(a.t, c.t) > 1) overlaps.push(`${a.k} × ${c.k}`);
      }
      const texts = [...el.querySelectorAll('*')].filter((n) => vis(n) && [...n.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()));
      const small = texts.map((n) => ({ n, px: parseFloat(getComputedStyle(n).fontSize) * (n.currentCSSZoom || 1) }))
        .filter((x) => x.px < 16).map((x) => `${x.n.className}:${x.n.textContent.trim().slice(0, 14)}:${x.px.toFixed(1)}`);
      const tiny = boxes.filter((b) => b.h < 43.5 || b.w < 43.5).map((b) => `${b.k}:${Math.round(b.w)}x${Math.round(b.h)}`);
      const out = boxes.filter((b) => b.l < r.left - 1 || b.r > r.right + 1 || b.t < r.top - 1 || b.b > r.bottom + 1).map((b) => b.k);
      return { l: r.left, t: r.top, r: r.right, b: r.bottom, sh: el.scrollHeight, ch: el.clientHeight, overlaps, small, tiny, out };
    });
    expect(m.l, 'sheet inside the viewport (left)').toBeGreaterThanOrEqual(0);
    expect(m.t, 'sheet inside the viewport (top)').toBeGreaterThanOrEqual(0);
    expect(m.r, 'sheet inside the viewport (right)').toBeLessThanOrEqual(w);
    expect(m.b, 'sheet inside the viewport (bottom)').toBeLessThanOrEqual(h);
    if (!phone) expect(m.sh, 'no scroll on desktop').toBeLessThanOrEqual(m.ch + 1);
    expect(m.overlaps, 'no control overlaps another').toEqual([]);
    expect(m.out, 'no control spills out of the sheet').toEqual([]);
    if (phone) {
      expect(m.small, 'phone text ≥ 16px').toEqual([]);
      expect(m.tiny, 'phone targets ≥ 44px').toEqual([]);
    }
    if (phone) {
      // the phone's volume: − / + step it (no 13px bars to aim at); MUTE still silences
      const up = sheet.getByRole('button', { name: 'Volume up' });
      await up.click();
      await up.click();
      await expect(sheet.locator('.sp-seg.is-on')).toHaveCount(2);
      await sheet.getByRole('button', { name: 'Volume down' }).click();
      await expect(sheet.locator('.sp-seg.is-on')).toHaveCount(1);
      await expect(sheet.locator('[role="radio"]')).toHaveCount(10); // still in the DOM for the desktop…
      await expect(sheet.locator('[role="radio"]').first()).toBeHidden(); // …but not a phone target
    }
    // the reset confirm grows the DANGER ZONE: still inside the screen, still no desktop scroll
    await page.getByTestId('sp-reset-open').click();
    const yes = page.getByTestId('sp-reset-yes');
    await yes.scrollIntoViewIfNeeded();
    await expect(yes).toBeVisible();
    const m2 = await sheet.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
    if (!phone) expect(m2.sh, 'the reset confirm fits too').toBeLessThanOrEqual(m2.ch + 1);
    const yb = await yes.boundingBox();
    expect(yb.y + yb.height).toBeLessThanOrEqual(h);
  });
}
