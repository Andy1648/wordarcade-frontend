// e2e/power-popup-lb.spec.js — Andy oct26, four asks in one pass:
//   1. THE POWER LADDER popup: a tap on the UPGRADES plate lists every POWER form as its painted icon — the reached ones
//      whole, yours lifted, the ones ahead blacked out + padlocked (no name); ✕ / Esc / outside tap close it; finite motion.
//      The menu's UPGRADES tile wears the form you hold.
//   2. the menu's top-right icons sit TIGHT against the right edge (no spread across the column).
//   3. YOUR leaderboard row: "N TO TOP 10" never covers your name — any name length, FitText-shrunk or not.
//   4. someone else's profile card shows no achievement badges; your own still does.
// SHOTS=1 saves screenshots to claude/shots-power-lb/spec-*.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { menuReady, navControl } from './support/menu.js';
import { PATCH_ID } from '../src/components/patchNotes/patchSeen.js';

const OUT = 'claude/shots-power-lb';
const shot = async (page, name) => { if (process.env.SHOTS) { fs.mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}/spec-${name}.png` }); } };
const SECRET = 'e9'.repeat(24);
const FUTURE = Date.now() + 3_600_000;
const row = (id, username, o) => ({ id, username, level: 10, rebirths: 0, stars: 0, lifetime_words: 500, lifetime_letters: 2500, wins_per_word: 10, econ: 13, submitted_at: FUTURE, ...o });

async function menu(page, vp, tier = 9) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript(({ p, tier }) => {
    if (sessionStorage.getItem('pp.seeded')) return;
    sessionStorage.setItem('pp.seeded', '1');
    Object.entries({ 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seen.patch': p, 'taw.s2.keytier': String(tier), 'taw.s2.wins': '5000' }).forEach(([k, v]) => localStorage.setItem(k, v));
  }, { p: PATCH_ID, tier });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
}

for (const vp of [{ width: 1366, height: 768 }, { width: 1280, height: 600 }, { width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test(`@${vp.width}x${vp.height} POWER LADDER: the plate opens every form — reached whole, yours lifted, the rest hidden`, async ({ page }) => {
    await menu(page, vp, 9); // POWER 9 → form 5 GENERATOR
    // the menu's UPGRADES tile wears the form
    await expect(page.locator('[data-nav="shop"]:visible .kb-rart image').first()).toHaveAttribute('href', '/shop/power/t5.webp');
    await page.locator('[data-nav="shop"]:visible').first().click();
    const plate = page.locator('button.sp2-plate');
    await expect(plate).toBeVisible();
    await plate.click();
    const pop = page.getByTestId('power-ladder');
    await expect(pop).toBeVisible();
    await expect(pop.locator('.pl-form')).toHaveCount(10);
    await expect(pop.locator('.pl-form.is-got')).toHaveCount(4);
    await expect(pop.locator('.pl-form.is-now')).toHaveCount(1);
    await expect(pop.locator('.pl-form.is-now')).toHaveAttribute('data-form', '5');
    await expect(pop.locator('.pl-form.is-now .pl-name')).toHaveText('GENERATOR');
    await expect(pop.locator('.pl-form.is-locked')).toHaveCount(5);
    await expect(pop.locator('.pl-form.is-locked .pl-name')).toHaveCount(0); // the names ahead stay secret
    await expect(pop.locator('.pl-form.is-locked .pl-lock')).toHaveCount(5);
    expect(await pop.locator('.pl-form.is-locked .pl-art').first().evaluate((i) => getComputedStyle(i).filter)).toContain('brightness(0)');
    await page.waitForTimeout(700); // the pop-in + stagger land
    const m = await pop.evaluate((el) => {
      const panel = el.querySelector('.pl-in').getBoundingClientRect();
      const inf = document.getAnimations().filter((a) => a.effect && a.effect.getTiming().iterations === Infinity && a.effect.target && a.effect.target.closest && a.effect.target.closest('.pl-pop')).length;
      const forms = [...el.querySelectorAll('.pl-form')].map((f) => f.getBoundingClientRect());
      let hit = 0; // no two forms (plate + caption) cross
      const caps = [...el.querySelectorAll('.pl-cap, .pl-plate')].map((n) => n.getBoundingClientRect());
      for (let i = 0; i < caps.length; i++) for (let j = i + 1; j < caps.length; j++) {
        const a = caps[i]; const b = caps[j];
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) {
          const sameForm = a.top < b.bottom && forms.some((f) => f.left <= a.left + 1 && f.right >= a.right - 1 && f.left <= b.left + 1 && f.right >= b.right - 1 && f.top <= Math.min(a.top, b.top) + 1 && f.bottom >= Math.max(a.bottom, b.bottom) - 1);
          if (!sameForm) hit++;
        }
      }
      const names = [...el.querySelectorAll('.pl-name')].map((n) => parseFloat(getComputedStyle(n).fontSize));
      return { top: panel.top, bottom: panel.bottom, left: panel.left, right: panel.right, vw: innerWidth, vh: innerHeight, inf, hit, minFont: Math.min(...names) };
    });
    expect(m.inf, 'nothing loops').toBe(0);
    expect(m.top).toBeGreaterThanOrEqual(0);
    expect(m.bottom, 'the ladder fits — no scroll').toBeLessThanOrEqual(m.vh);
    expect(m.left).toBeGreaterThanOrEqual(0);
    expect(m.right).toBeLessThanOrEqual(m.vw);
    expect(m.hit, 'no two forms overlap').toBe(0);
    expect(m.minFont).toBeGreaterThanOrEqual(14);
    const x = await pop.locator('.sp2-pop-x').boundingBox();
    expect(Math.min(x.width, x.height)).toBeGreaterThanOrEqual(44);
    await shot(page, `ladder-${vp.width}x${vp.height}`);
    // ✕ closes; Esc closes it (and only it — UPGRADES stays); an outside tap closes it
    await pop.locator('.sp2-pop-x').click();
    await expect(pop).toHaveCount(0);
    await plate.click();
    await expect(pop).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(pop).toHaveCount(0);
    await expect(page.locator('.sp2')).toBeVisible();
    await plate.click();
    await expect(pop).toBeVisible();
    await page.mouse.click(4, vp.height - 4);
    await expect(pop).toHaveCount(0);
    await expect(page.locator('.sp2')).toBeVisible();
  });
}

test('POWER LADDER at the top form: every form whole, the BLACK HOLE is yours, nothing locked', async ({ page }) => {
  await menu(page, { width: 1366, height: 768 }, 25);
  await page.locator('[data-nav="shop"]:visible').first().click();
  await page.locator('button.sp2-plate').click();
  const pop = page.getByTestId('power-ladder');
  await expect(pop.locator('.pl-form.is-locked')).toHaveCount(0);
  await expect(pop.locator('.pl-form.is-now .pl-name')).toHaveText('BLACK HOLE');
});

for (const vp of [{ width: 1536, height: 864 }, { width: 1366, height: 768 }, { width: 1280, height: 600 }]) {
  test(`@${vp.width}x${vp.height} the top-right icons sit tight against the right edge`, async ({ page }) => {
    await menu(page, vp);
    await page.waitForTimeout(400);
    const g = await page.evaluate(() => {
      const box = document.querySelector('.hp-icons');
      const tiles = [...box.querySelectorAll(':scope > .kb--icon, :scope > * > .kb--icon')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => e.getBoundingClientRect());
      tiles.sort((a, b) => a.left - b.left);
      const gaps = tiles.slice(1).map((t, i) => t.left - tiles[i].right);
      return { n: tiles.length, gaps, right: tiles.length ? tiles[tiles.length - 1].right : 0, edge: box.getBoundingClientRect().right };
    });
    expect(g.n).toBeGreaterThanOrEqual(3);
    for (const gap of g.gaps) expect(gap, 'one small, even gap').toBeLessThanOrEqual(12);
    expect(Math.max(...g.gaps) - Math.min(...g.gaps)).toBeLessThanOrEqual(1);
    expect(Math.abs(g.edge - g.right), 'flush with the column edge').toBeLessThanOrEqual(14);
    await shot(page, `menu-${vp.width}x${vp.height}`);
  });
}

// YOUR row with a RIVAL above you at #24 and the TOP 10 band 15 away: the band tag rides the chase line, never the name
const LB_VPS = [[2560, 1440], [1536, 864], [1366, 768], [1280, 600], [390, 844], [360, 640]];
for (const [w, h] of LB_VPS) {
  for (const name of ['WWMMWWMMWWMMWWMM', 'NOBUFFCOOKIES', 'ZED']) {
    test(`@${w}x${h} LB: "${name}" at #25 — the TO TOP tag never covers the name, the chase never reaches REBIRTHS`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await installBackendMock(page);
      await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
      const rank = 25;
      const rows = [];
      for (let i = 1; i < rank; i++) rows.push(row(`p${i}`, i === rank - 1 ? 'MMMMWWWWMMMMWWWW' : `PLAYER${i}`, { level: 1000 - i * 10 }));
      for (let i = rank + 1; i < rank + 4; i++) rows.push(row(`p${i}`, `LOW${i}`, { level: 50 - i }));
      rows.push(row('me', name, { level: 1000 - rank * 10 + 5 }));
      await mockBoard(page, [], { caps: true, shared: { rows, secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, weekly: true, season2: true });
      await page.addInitScript(({ secret, me, lv }) => {
        if (sessionStorage.getItem('pl.seeded')) return;
        sessionStorage.setItem('pl.seeded', '1');
        localStorage.setItem('taw.seenMenu', '1');
        localStorage.setItem('taw.seenMenuSpotlight', '1');
        localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: me }));
        localStorage.setItem('taw.lb.secret', secret);
        localStorage.setItem('taw.econ', '12');
        localStorage.setItem('taw.s2.xp', JSON.stringify({ lv, f: 0.1, rc: 0, v: 10 }));
      }, { secret: SECRET, me: name, lv: 1000 - rank * 10 + 5 });
      await page.goto('/?portal=1&season2=1');
      await navControl(page, 'leaderboard').click();
      const me = page.locator('.lb2-row.is-me');
      await expect(me).toBeVisible({ timeout: 10_000 });
      await me.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1300); // the list slide lands; FitText re-measures once the font is in
      const r = await me.evaluate((el) => {
        const vis = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return b.width && b.height && getComputedStyle(e).display !== 'none' ? b : null; };
        const R = {
          name: vis(el.querySelector('.lb2-name .fit-in')), you: vis(el.querySelector('.lb2-you')), tag: vis(el.querySelector('.lb2-band-tag')),
          chase: vis(el.querySelector('.lb2-chase-fit .fit-in')), r: vis(el.querySelector('.lb2-r')), lv: vis(el.querySelector('.lb2-lv')),
        };
        const bad = [];
        for (const [a, b] of [['name', 'tag'], ['name', 'chase'], ['you', 'name'], ['name', 'r'], ['tag', 'r'], ['chase', 'r'], ['tag', 'lv']]) {
          const A = R[a]; const B = R[b];
          if (!A || !B) continue;
          const x = Math.min(A.right, B.right) - Math.max(A.left, B.left);
          const y = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
          if (x > 2 && y > 2) bad.push(`${a}×${b} ${Math.round(x)}x${Math.round(y)}`);
        }
        return { bad, tagOnNameLine: !!el.querySelector('.lb2-name-line .lb2-band-tag'), chase: !!R.chase };
      });
      expect(r.chase, 'the PASS <rival> line shows').toBe(true);
      expect(r.tagOnNameLine, 'the band tag never shares the name line').toBe(false);
      expect(r.bad, 'nothing crosses on YOUR row').toEqual([]);
      if (name.length === 16 || name === 'NOBUFFCOOKIES') await shot(page, `lb-${w}x${h}-${name.length}`);
    });
  }
}

async function boardWithProfiles(page, vp) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const rows = [row('a', 'ALPHA', { level: 900 }), row('b', 'BRAVO', { level: 800 }), row('c', 'CHARLIE', { level: 700 }), row('d', 'DELTA', { level: 600 }), row('me', 'NOBUFF', { level: 60 })];
  await mockBoard(page, [], { caps: true, shared: { rows, secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, weekly: true, season2: true });
  await page.addInitScript(({ secret }) => {
    if (sessionStorage.getItem('pf.seeded')) return;
    sessionStorage.setItem('pf.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'NOBUFF' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 60, f: 0.1, rc: 0, v: 10 }));
  }, { secret: SECRET });
  const SHOW = { gear1: 'mk-kraken', gear2: 'mk-hydra', base_wins: 190, wins_per_word: 5130, gears_found: 9, gears_total: 27, power: 6, badges: { type: 5, bots: 3, reb: 2, roll: 4, win: 1, chain: 2, index: 3, power: 5 }, bio: 'catch me in word bomb every night' };
  await page.goto('/?portal=1&season2=1');
  await page.route('**/rest/v1/profile_showcase*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SHOW]) }));
  await navControl(page, 'leaderboard').click();
  const lb = page.locator('.lb2');
  await lb.waitFor({ state: 'visible' });
  await expect(lb.locator('.lb2-col--1')).toHaveAttribute('data-id', /.+/, { timeout: 10_000 });
  return lb;
}

for (const vp of [{ width: 1366, height: 768 }, { width: 1280, height: 600 }, { width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test(`@${vp.width}x${vp.height} someone else's profile: no achievement badges, the card fits with no scroll`, async ({ page }) => {
    const lb = await boardWithProfiles(page, vp);
    await lb.locator('.lb2-row[data-id="d"]').click();
    const pc = page.getByTestId('profile-card');
    await expect(pc.locator('.pc-gear[data-slot="1"] .pc-gear-name')).toHaveText('KRAKEN');
    await expect(pc.getByTestId('profile-badges')).toHaveCount(0);
    await page.waitForTimeout(400);
    const m = await pc.evaluate((el) => ({ bottom: el.getBoundingClientRect().bottom, vh: innerHeight, over: el.scrollHeight - el.clientHeight }));
    expect(m.bottom).toBeLessThanOrEqual(m.vh);
    expect(m.over).toBeLessThanOrEqual(1);
    await shot(page, `profile-other-${vp.width}x${vp.height}`);
  });
}

test('your own profile card still shows your achievement badges', async ({ page }) => {
  const lb = await boardWithProfiles(page, { width: 1366, height: 768 });
  await lb.locator('.lb2-row[data-id="me"], .is-me').first().click();
  const pc = page.getByTestId('profile-card');
  await expect(pc).toBeVisible();
  await expect(pc.locator('.pc-badge')).toHaveCount(8);
});
