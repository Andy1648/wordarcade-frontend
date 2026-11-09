// e2e/rooms-list-layout.spec.js — THE PUBLIC ROOMS LIST at its extremes (Andy nov9: "stupid indentations, when multiple
// public rooms eventually stack up etc"). Mocked socket. The JOIN ROOM list + the menu's OPEN ROOMS panel at 390 / 1366
// / 1920 with 0, 1 and 15 rooms (lobbies, live games, full, unwatchable, long names). Checks:
//   - lobbies and live games are two labelled groups (IN LOBBY first), each sorted (lobbies: starting soonest, then
//     fullest; live: watchable first),
//   - every row's columns line up: the mode / name / count / action columns share one left edge per column (no indents),
//   - a long host name wraps, never ellipsized, never spills its row; nothing under 12px; controls ≥ 44px tall,
//   - only the LIST scrolls (the page itself never does), and the list holds every room,
//   - a live room that can't be watched says why (FULL / NO SPECTATE) and is not a pressable SPECTATE,
//   - a lobby counting down says STARTS IN; a watched game says how many are watching.
import { test, expect } from '@playwright/test';
import { installBackendMock, freezeAnimations } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const SHOTS = process.env.RL_SHOTS || '';
const host = (i) => ['GLOWWORM', 'A VERY LONG HOST NAME INDEED', 'ZED', 'NOVA_KID', 'MR. SPELLING BEE CHAMPION', 'Q'][i % 6];
const HEROES = ['mecha', 'riot-elite', null];
const MODES = ['word-bomb', 'category-blitz', 'word-race', 'miner'];

function rooms15() {
  const out = [];
  for (let i = 0; i < 15; i += 1) {
    const live = i % 3 === 0;
    out.push({
      code: `R${String(i).padStart(4, '0')}`,
      gameType: MODES[i % 4],
      playerCount: live ? 8 : 1 + (i % 7),
      maxPlayers: 8,
      status: live ? 'playing' : 'waiting',
      hostName: host(i),
      ...(HEROES[i % 3] ? { hostHero: HEROES[i % 3] } : {}),
      spectators: live ? i % 4 : 0,
      ...(live ? { canSpectate: i !== 9, watch: i === 9 ? 'unsupported' : 'open' } : {}),
      ...(!live && i === 4 ? { startsInMs: 11000 } : {}),
    });
  }
  return out;
}
const ONE = [{ code: 'SOLO1', gameType: 'word-bomb', playerCount: 2, maxPlayers: 8, status: 'waiting', hostName: 'GLOWWORM', hostHero: 'mecha', startsInMs: 9000 }];

async function openBrowse(page, rooms) {
  const mock = await installBackendMock(page);
  await page.addInitScript(() => {
    try {
      for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems', 'taw.seenGameSpotlight']) localStorage.setItem(k, '1');
      localStorage.setItem('wa_playername', 'TESTER');
    } catch { /* blocked */ }
  });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await mock.waitForSent('list_public_rooms', 10000);
  mock.pushToClient({ type: 'public_rooms', payload: { rooms } });
  return mock;
}

const geometry = (page, rowSel) => page.evaluate((sel) => {
  const rows = [...document.querySelectorAll(sel)].map((row) => {
    const box = (q) => { const el = row.querySelector(q); if (!el) return null; const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width }; };
    const r = row.getBoundingClientRect();
    return { row: { l: r.left, r: r.right, t: r.top, b: r.bottom, h: r.height }, name: box('[data-col="name"]'), count: box('[data-col="count"]'), act: box('[data-col="action"]') };
  });
  const tiny = [...document.querySelectorAll(`${sel} *`)].filter((el) => el.childElementCount === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 12).map((el) => el.textContent.trim());
  const clipped = [...document.querySelectorAll(`${sel} [data-col="name"]`)].filter((el) => el.scrollWidth > el.clientWidth + 1 || getComputedStyle(el).textOverflow === 'ellipsis').map((el) => el.textContent);
  const doc = document.scrollingElement;
  return { rows, tiny, clipped, pageScrolls: doc.scrollHeight > window.innerHeight + 1 || doc.scrollWidth > window.innerWidth + 1 };
}, rowSel);

for (const vp of [{ width: 390, height: 844 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`@${vp.width}: JOIN ROOM list — 0 / 1 / 15 rooms, grouped, aligned, nothing clipped, only the list scrolls`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize(vp);
    const mock = await openBrowse(page, rooms15());
    // the menu's way in: the phone chip, or the panel's +N MORE
    const chip = page.getByTestId('menu-rooms-chip');
    const more = page.getByTestId('menu-rooms-more');
    await expect(chip.or(more)).toBeVisible({ timeout: 15000 });
    if (await chip.isVisible()) await chip.click();
    else await more.click();
    await expect(page.locator('.browser-wrap')).toBeVisible();
    mock.pushToClient({ type: 'public_rooms', payload: { rooms: rooms15() } });
    const rows = page.getByTestId('browser-room-row');
    await expect(rows).toHaveCount(15);
    await freezeAnimations(page);
    await page.evaluate(() => document.fonts && document.fonts.ready);

    // two labelled groups, lobbies first
    const groups = page.getByTestId('browser-group');
    await expect(groups).toHaveCount(2);
    await expect(groups.nth(0)).toContainText('IN LOBBY');
    await expect(groups.nth(1)).toContainText('PLAYING');
    const order = await rows.evaluateAll((els) => els.map((e) => [e.dataset.status, e.dataset.code]));
    const firstLive = order.findIndex(([s]) => s === 'playing');
    expect(order.slice(firstLive).every(([s]) => s === 'playing'), 'every lobby before every live game').toBe(true);
    expect(order[0][1], 'the lobby starting soonest leads').toBe('R0004');
    // a live room that can't be watched says why, and isn't pressable
    const noWatch = page.locator('[data-testid="browser-room-row"][data-code="R0009"]');
    await expect(noWatch).toBeDisabled();
    await expect(noWatch.locator('[data-col="action"]')).toHaveText(/NO SPECTATE/);
    await expect(page.locator('[data-testid="browser-room-row"][data-code="R0004"] [data-col="action"]')).toContainText(/STARTS IN/);
    await expect(page.locator('[data-testid="browser-room-row"][data-code="R0003"]')).toContainText('3 WATCHING');

    if (SHOTS) await page.screenshot({ path: `${SHOTS}/browse-15-${vp.width}.png` });
    const g = await geometry(page, '[data-testid="browser-room-row"]');
    expect(g.tiny, 'no text under 12px').toEqual([]);
    expect(g.clipped, 'host names never clipped / ellipsized').toEqual([]);
    expect(g.pageScrolls, 'the page never scrolls — only the list').toBe(false);
    const visible = g.rows.filter((r) => r.row.b > 0 && r.row.t < vp.height);
    for (const r of g.rows) {
      expect(r.row.h, 'rows ≥ 44px').toBeGreaterThanOrEqual(44);
      for (const k of ['name', 'count', 'act']) {
        expect(r[k].l, `${k} inside its row`).toBeGreaterThanOrEqual(r.row.l - 0.5);
        expect(r[k].r, `${k} inside its row`).toBeLessThanOrEqual(r.row.r + 0.5);
      }
    }
    // NO INDENTS: every column starts at one x across the rows
    for (const k of ['name', 'count', 'act']) {
      const xs = [...new Set(visible.map((r) => Math.round(r[k].l)))];
      expect(xs.length, `${k} column shares one left edge (${xs})`).toBe(1);
    }
    // the list (not the page) scrolls to the last room
    const last = rows.last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/browse-15-end-${vp.width}.png` });

    // ONE room, then ZERO rooms
    mock.pushToClient({ type: 'public_rooms', payload: { rooms: ONE } });
    await expect(rows).toHaveCount(1);
    await expect(groups).toHaveCount(1);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/browse-1-${vp.width}.png` });
    mock.pushToClient({ type: 'public_rooms', payload: { rooms: [] } });
    await expect(rows).toHaveCount(0);
    await expect(page.getByRole('button', { name: /CREATE PUBLIC ROOM/ })).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/browse-0-${vp.width}.png` });
  });
}

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
  test(`@${vp.width}: menu OPEN ROOMS panel — 15 rooms, aligned columns, live rows say why they can't be watched`, async ({ page }) => {
    await page.setViewportSize(vp);
    await openBrowse(page, rooms15());
    const rows = page.getByTestId('menu-room-row');
    await expect(rows.first()).toBeVisible();
    await freezeAnimations(page);
    await page.evaluate(() => document.fonts && document.fonts.ready);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/menu-15-${vp.width}.png` });
    const g = await geometry(page, '[data-testid="menu-room-row"]');
    expect(g.tiny).toEqual([]);
    expect(g.clipped).toEqual([]);
    for (const k of ['name', 'act']) {
      const xs = [...new Set(g.rows.map((r) => Math.round(r[k].l)))];
      expect(xs.length, `${k} column shares one left edge (${xs})`).toBe(1);
    }
  });
}
