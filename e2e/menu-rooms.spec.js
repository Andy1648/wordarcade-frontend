// e2e/menu-rooms.spec.js — OPEN ROOMS on the menu (Andy nov2). Mocked socket (support/backendMock.js), so it runs in the
// normal suite. Checks:
//  - the menu asks for the list on the ONE socket (list_public_rooms) and renders the reply in the right column,
//  - 4 rows (5 on a ≥900px-tall screen) + "+N MORE", the empty line, host name / hero face / mode-icon fallback,
//  - OVERLAP + SIZE at 1366x768 / 1920x1080 / 1280x720: the panel stays inside its column and the viewport, touches none
//    of CONTRACTS / the boost dock / the bottom-right extras / the cards / the icons, and every control is ≥ 44px tall,
//  - JOIN sends the existing join_room frame (App owns the view change),
//  - polling stops while the tab is hidden,
//  - the phone chip: hidden at zero rooms, "N OPEN" with rooms, opens the JOIN ROOM screen.
import { test, expect } from '@playwright/test';
import { installBackendMock, freezeAnimations } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

// the live (season 2) menu — the URL wins over the suite's season-1 storage switch
async function menuReadyAndFrozen(page) {
  // past the first-run coach marks, so the shots show the menu as a returning player sees it
  await page.addInitScript(() => {
    try { for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems', 'taw.seenGameSpotlight']) localStorage.setItem(k, '1'); } catch { /* blocked */ }
  });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  await freezeAnimations(page);
}

const SHOTS = process.env.MR_SHOT_DIR || '';
const ROOMS7 = [
  { code: 'AAAA1', gameType: 'word-bomb', playerCount: 3, maxPlayers: 8, status: 'waiting', hostName: 'GLOWWORM', hostHero: 'mecha' },
  { code: 'AAAA2', gameType: 'category-blitz', playerCount: 1, maxPlayers: 8, status: 'waiting', hostName: 'A VERY LONG HOSTNAME' }, // 20 chars: the name cap
  { code: 'AAAA3', gameType: 'word-race', playerCount: 2, maxPlayers: 8, status: 'waiting', hostName: 'ZED', hostHero: 'riot-elite' },
  { code: 'AAAA4', gameType: 'word-bomb', playerCount: 5, maxPlayers: 8, status: 'waiting' }, // old backend: no host
  { code: 'AAAA5', gameType: 'word-bomb', playerCount: 1, maxPlayers: 8, status: 'waiting', hostName: 'P5' },
  { code: 'AAAA6', gameType: 'category-blitz', playerCount: 1, maxPlayers: 8, status: 'waiting', hostName: 'P6' },
  { code: 'AAAA7', gameType: 'word-bomb', playerCount: 1, maxPlayers: 8, status: 'waiting', hostName: 'P7' },
];

const boxOf = (page, sel) => page.evaluate((s) => {
  const out = [];
  for (const el of document.querySelectorAll(s)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width && r.height) out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
  return out;
}, sel);
const meets = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 1280, height: 720 }, { width: 1536, height: 864 }, { width: 1440, height: 900 }]) {
  test(`@${vp.width}x${vp.height}: OPEN ROOMS panel — list, rows cap, no overlaps, sizes, JOIN frame`, async ({ page }) => {
    await page.setViewportSize(vp);
    const mock = await installBackendMock(page);
    await menuReadyAndFrozen(page);
    await mock.waitForSent('list_public_rooms', 10000);

    // empty reply → the one compact line
    mock.pushToClient({ type: 'public_rooms', payload: { rooms: [] } });
    const panel = page.getByTestId('menu-rooms');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('menu-rooms-empty')).toContainText('no open rooms');
    await expect(page.getByRole('button', { name: 'CREATE ONE' })).toBeEnabled();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-empty-${vp.width}.png` });

    mock.pushToClient({ type: 'public_rooms', payload: { rooms: ROOMS7 } });
    const rows = page.getByTestId('menu-room-row');
    const cap = vp.height >= 880 ? 4 : 3; // Homepage.jsx roomsRows (two-line rows)
    await expect(rows).toHaveCount(cap);
    await expect(page.getByTestId('menu-rooms-more')).toHaveText(`+${ROOMS7.length - cap} MORE →`);
    // fullest first; host name, hero face, mode-icon fallback for a host-less (old backend) row
    await expect(rows.first()).toHaveAttribute('data-code', 'AAAA4');
    await expect(rows.first().locator('.mr-host')).toHaveText('WORD BOMB');
    await expect(rows.first().locator('.mr-face img')).toHaveAttribute('src', /\/cards\/wb-hero\.webp$/);
    await expect(page.locator('.mr-row[data-code="AAAA1"] .mr-face img')).toHaveAttribute('src', /\/cast\/mecha-hero\.webp$/);
    await expect(page.locator('.mr-row[data-code="AAAA1"] .mr-count')).toHaveText('3/8');
    await page.evaluate(() => document.fonts && document.fonts.ready);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-${vp.width}.png` });

    // OVERLAP: inside the viewport + clear of every neighbour in the column / page
    const [p] = await boxOf(page, '[data-testid="menu-rooms"]');
    expect(p.l).toBeGreaterThanOrEqual(0);
    expect(p.r).toBeLessThanOrEqual(vp.width);
    expect(p.b).toBeLessThanOrEqual(vp.height);
    for (const sel of ['.hp-main', '.hp-dock--grid .bd-tile', '.hp-extras > *', '.homepage-cards-region', '.hp-icons', '.homepage-logo', '.menu-xp-bar']) {
      for (const o of await boxOf(page, sel)) expect(meets(p, o), `${sel} overlaps the OPEN ROOMS panel`).toBe(false);
    }
    // the rows stay inside the panel (nothing spills)
    for (const r of await boxOf(page, '.mr-row, .mr-more')) {
      expect(r.l).toBeGreaterThanOrEqual(p.l - 0.5);
      expect(r.r).toBeLessThanOrEqual(p.r + 0.5);
      expect(r.b).toBeLessThanOrEqual(p.b + 0.5);
    }
    // SIZE: every control ≥ 44px tall, text not tiny
    for (const b of await boxOf(page, '.mr-join, .mr-more')) expect(b.b - b.t).toBeGreaterThanOrEqual(44);
    // readable mode + count (coordinator nov2: the mode line had shrunk to ~9px): the RENDERED size — font-size × any
    // FitText scale on the way up — is ≥ 13px for the host, the mode name and the x/max, on every row shown
    const rendered = await page.evaluate(() => [...document.querySelectorAll('.mr-host, .mr-mode, .mr-count')].map((el) => {
      let k = 1;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const t = getComputedStyle(n).transform;
        if (t && t !== 'none') k *= new DOMMatrixReadOnly(t).a;
        const inner = n.firstElementChild;
        if (n === el && inner && getComputedStyle(inner).transform !== 'none') k *= new DOMMatrixReadOnly(getComputedStyle(inner).transform).a;
      }
      return { cls: el.className, text: el.textContent, px: parseFloat(getComputedStyle(el).fontSize) * k };
    }));
    for (const r of rendered) expect(r.px, `${r.cls} "${r.text}"`).toBeGreaterThanOrEqual(13);
    // the mode name is never clipped: its box holds its text
    for (const o of await page.$$eval('.mr-mode, .mr-host, .mr-count', (els) => els.map((e) => e.scrollWidth - e.clientWidth))) expect(o).toBeLessThanOrEqual(1);

    // JOIN → the existing join_room frame with the room code + the player's name; rows lock while it is in flight
    await page.locator('.mr-row[data-code="AAAA1"] .mr-join').click();
    const join = await mock.waitForSent('join_room', 5000);
    expect(join.payload.code).toBe('AAAA1');
    expect(String(join.payload.name || '').length).toBeGreaterThan(0);
    await expect(page.locator('.mr-join').first()).toBeDisabled();
  });
}

test('@1366: polling stops while the tab is hidden and resumes when shown', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await installBackendMock(page);
  await menuReadyAndFrozen(page);
  await mock.waitForSent('list_public_rooms', 10000);
  const count = () => mock.sentTypes().filter((t) => t === 'list_public_rooms').length;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const hiddenAt = count();
  await page.waitForTimeout(9000); // > one 8s poll period
  expect(count()).toBe(hiddenAt);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(count, { timeout: 3000 }).toBeGreaterThan(hiddenAt);
});

test('@390x844 phone: the chip hides at zero rooms, shows N OPEN, opens JOIN ROOM', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mock = await installBackendMock(page);
  await menuReadyAndFrozen(page);
  await mock.waitForSent('list_public_rooms', 10000);
  await expect(page.getByTestId('menu-rooms')).toHaveCount(0); // no panel on a phone
  mock.pushToClient({ type: 'public_rooms', payload: { rooms: [] } });
  await page.waitForTimeout(300);
  await expect(page.getByTestId('menu-rooms-chip')).toHaveCount(0);
  mock.pushToClient({ type: 'public_rooms', payload: { rooms: ROOMS7.slice(0, 3) } });
  const chip = page.getByTestId('menu-rooms-chip');
  await expect(chip).toBeVisible();
  await expect(chip).toContainText('3');
  const b = (await boxOf(page, '[data-testid="menu-rooms-chip"]'))[0];
  expect(b.b - b.t).toBeGreaterThanOrEqual(44);
  expect(b.r).toBeLessThanOrEqual(390);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-phone-390.png` });
  await chip.click();
  await expect(page.locator('.browser-row, .browser-wrap, [class*="browser"]').first()).toBeVisible({ timeout: 10000 });
});
