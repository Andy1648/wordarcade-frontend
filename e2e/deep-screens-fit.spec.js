// e2e/deep-screens-fit.spec.js — THE DEEP SCREENS FIT (oct20 UI audit, season 2 — what visitors get). Screens Andy rarely
// reaches, each pinned at the size where it broke:
//   1. SETTINGS (the menu's cog sheet) has no scrollbar on a Chromebook — 1280x720 scrolled 47px, 1280x551 156px;
//   2. a PLAYER CARD (tap a leaderboard row) keeps its ✕ whole and never scrolls sideways — at 1280x720 the ✕ was cut
//      in half by the card's own scroll box;
//   3. YOUR PROFILE never scrolls sideways on a phone — FitText's scaled name left its unscaled width behind (94px);
//   4. PATCH NOTES at 1280x551: no note row runs under the CLOSE button, and the gem wallet never covers the panel;
//   5. the fixed corner cog is not drawn over the full-screen panels (UPGRADES / STATS / LEADERBOARD / CREDITS);
//   6. STATS fits a phone — its ALL TIME row ran 24px past a 390x844 screen, and at 360x640 the whole ALL TIME grid sat
//      below the fold (~800px of stats); short phones (≤ 760px) now get the compact layout and fit.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { menuReady, navControl, isPhoneMenu } from './support/menu.js';

const SECRET = 'c4'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
const row = (id, username, o) => ({ id, username, level: 10, rebirths: 0, stars: 0, lifetime_words: 500, lifetime_letters: 2500, wins_per_word: 10, econ: 13, submitted_at: FUTURE, ...o });

async function boot(page, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const rows = [row('a', 'ALPHA', { stars: 1, level: 5 }), row('b', 'BRAVO', { rebirths: 9, level: 900 }), row('c', 'CHARLIE', { rebirths: 9, level: 100 }), row('me', 'NOBUFFCOOKIES', { level: 60, rebirths: 3 })];
  await mockBoard(page, [], { caps: true, shared: { rows, secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, weekly: true, season2: true });
  await page.addInitScript((secret) => {
    if (sessionStorage.getItem('dsf.seeded')) return;
    sessionStorage.setItem('dsf.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'NOBUFFCOOKIES' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 60, f: 0.4, rc: 3, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '3');
  }, SECRET);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await page.waitForTimeout(300);
}
const box = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
const hit = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 2 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 2;

for (const [w, h] of [[1280, 720], [1280, 551], [1366, 768]]) {
  test(`SETTINGS has no scrollbar at ${w}x${h}`, async ({ page }) => {
    await boot(page, w, h);
    await page.locator('[data-nav="settings"]:visible').first().click();
    const sheet = page.locator('.sp-sheet');
    await sheet.waitFor({ state: 'visible' });
    await page.waitForTimeout(300);
    const m = await sheet.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, b: el.getBoundingClientRect().bottom }));
    expect(m.sh, 'the settings sheet fits without scrolling').toBeLessThanOrEqual(m.ch + 1);
    expect(m.b).toBeLessThanOrEqual(h);
    // the reset confirm grows the sheet: still no scrollbar, its buttons on screen
    await page.getByTestId('sp-reset-open').click();
    const yes = page.getByTestId('sp-reset-yes');
    await yes.waitFor({ state: 'visible' });
    const m2 = await sheet.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
    expect(m2.sh, 'the reset confirm fits too').toBeLessThanOrEqual(m2.ch + 1);
    expect((await box(yes)).b).toBeLessThanOrEqual(h);
  });
}

for (const [w, h] of [[1280, 720], [1280, 551], [360, 640]]) {
  test(`a PLAYER CARD keeps its ✕ whole and never scrolls sideways at ${w}x${h}`, async ({ page }) => {
    await boot(page, w, h);
    await navControl(page, 'leaderboard').click();
    await page.locator('.lb2').waitFor({ state: 'visible' });
    await expect(page.locator('.lb2-col--1')).toHaveAttribute('data-id', /.+/, { timeout: 10_000 });
    await page.locator('.lb2-col--1').click();
    const card = page.locator('.pc');
    await card.waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    const m = await card.evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(m.sw, 'the card never scrolls sideways').toBeLessThanOrEqual(m.cw + 1);
    const c = await box(card), x = await box(page.locator('.pc-x'));
    // the ✕ is drawn whole: inside the card's clip box when the card scrolls, and on screen either way
    expect(x.t).toBeGreaterThanOrEqual(Math.min(c.t, 0) - 1);
    expect(x.r).toBeLessThanOrEqual(w);
    const clipped = await card.evaluate((el) => getComputedStyle(el).overflowY !== 'visible');
    if (clipped) { expect(x.t).toBeGreaterThanOrEqual(c.t); expect(x.r).toBeLessThanOrEqual(c.r); }
  });
}

for (const [w, h] of [[360, 640], [390, 844]]) {
  test(`YOUR PROFILE never scrolls sideways at ${w}x${h}`, async ({ page }) => {
    await boot(page, w, h);
    await page.locator('[data-nav="profile"]:visible').first().click();
    await page.getByTestId('profile-kit').waitFor({ state: 'visible' });
    await page.waitForTimeout(500);
    const m = await page.locator('.pf').evaluate((el) => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(m.sw, 'the profile panel has no sideways scroll').toBeLessThanOrEqual(m.cw + 1);
  });
}

for (const [w, h] of [[1280, 551], [1280, 720], [1366, 768]]) {
  test(`PATCH NOTES: no row under the button, the wallet clear of the panel at ${w}x${h}`, async ({ page }) => {
    await boot(page, w, h);
    await page.locator('[data-nav="news"]').click();
    const pn = page.getByTestId('patch-notes');
    await pn.waitFor({ state: 'visible' });
    await page.waitForTimeout(600);
    const btn = await box(page.getByTestId('patch-notes-collect'));
    const rows = page.locator('.pn-item, .pn-gift');
    for (let i = 0; i < await rows.count(); i += 1) {
      expect(hit(await box(rows.nth(i)), btn), `note row ${i} is not under the button`).toBe(false);
      expect((await box(rows.nth(i))).b, `note row ${i} is on screen`).toBeLessThanOrEqual(h);
    }
    expect(btn.b).toBeLessThanOrEqual(h);
    expect(hit(await box(page.locator('.pn-wallet')), await box(page.locator('.pn-panel'))), 'the wallet does not cover the panel').toBe(false);
  });
}

for (const [w, h] of [[1366, 768], [390, 844]]) {
  test(`no fixed corner cog over the full-screen panels at ${w}x${h}`, async ({ page }) => {
    await boot(page, w, h);
    const views = [
      ['shop', '.sp2'],
      ['stats', '.st2'],
      ['leaderboard', '.lb2'],
    ];
    for (const [nav, root] of views) {
      await navControl(page, nav).click();
      await page.locator(root).first().waitFor({ state: 'visible' });
      await expect(page.locator('.audio-ctrl:not(.audio-ctrl--inline)').filter({ visible: true }), `${nav}: no stray cog`).toHaveCount(0);
      await page.locator(`${root} [aria-label="Back to menu"]`).first().click();
      await page.locator(isPhoneMenu(page) ? '.hp-m-title' : '.homepage-logo').first().waitFor({ state: 'visible' });
    }
  });
}

for (const [w, h] of [[390, 844], [412, 915], [360, 740], [375, 667], [360, 640]]) {
  test(`STATS fits a phone without scrolling at ${w}x${h} (both tabs)`, async ({ page }) => {
    await boot(page, w, h);
    await navControl(page, 'stats').click();
    const st = page.locator('.st2');
    await st.waitFor({ state: 'visible' });
    for (const tab of ['wins', 'xp']) {
      await st.locator(`.st2-tab[data-tab="${tab}"]`).click();
      await page.waitForTimeout(700);
      await page.evaluate(() => document.fonts.ready); // measure the real Bungee widths, not the fallback's
      const m = await st.evaluate((el) => ({ sy: el.scrollHeight - el.clientHeight, sx: el.scrollWidth - el.clientWidth }));
      expect(m.sy, `${tab}: no vertical scroll`).toBeLessThanOrEqual(0);
      expect(m.sx, `${tab}: no sideways scroll`).toBeLessThanOrEqual(0);
      const life = await box(st.locator('.st2-life'));
      expect(life.b, `${tab}: the ALL TIME grid is on screen`).toBeLessThanOrEqual(h);
    }
  });
}
