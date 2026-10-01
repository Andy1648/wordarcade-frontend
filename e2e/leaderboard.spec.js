// e2e/leaderboard.spec.js — STEP 24 (Andy A13: no Google sign-in, username only, block bad names).
//
// The board's REST API is MOCKED here (the e2e build points VITE_SUPABASE_URL at lb.e2e.invalid —
// see playwright.config.js). The mock keeps a tiny in-memory board and applies the same name rules
// the DB does, by calling the CLIENT filter (the DB/client parity is pinned separately by
// claude/step24/db-parity.mjs against the live database).
//
// Asserted at 390x844, 1280x551 and 1920x1080: the trophy is in the menu (phone strip / desktop
// corner cluster), opens the board, a clean name claims and appears on the board as YOU with rank,
// level, rebirth stars, words and WINS/WORD; a leetspeak bad name is refused before it is sent; a
// taken name is refused by the server; nothing on the board renders under 13px; no horizontal scroll.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { isNameBlocked } from '../src/leaderboard/nameFilter.js';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 551 },
  { width: 1920, height: 1080 },
];

async function mockBoard(page, seed = []) {
  const rows = seed.map((r) => ({ ...r }));
  const secrets = new Map();
  const calls = { claim: 0, submit: 0 };
  const ranked = () => rows
    .slice()
    .sort((a, b) => b.rebirths - a.rebirths || b.level - a.level || b.lifetime_words - a.lifetime_words)
    .map((r, i) => ({ ...r, rank: i + 1 }));
  await page.route('https://lb.e2e.invalid/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let body = null;
    try { body = req.postDataJSON(); } catch { body = null; }
    if (url.pathname.endsWith('/rpc/lb_name_status')) {
      const n = body.p_username;
      if (isNameBlocked(n)) return json(200, 'blocked');
      return json(200, rows.some((r) => r.username.toLowerCase() === n.toLowerCase()) ? 'taken' : 'ok');
    }
    if (url.pathname.endsWith('/rpc/lb_claim')) {
      calls.claim += 1;
      const n = body.p_username;
      if (isNameBlocked(n)) return json(400, { message: 'username_blocked' });
      const mine = secrets.get(body.p_secret);
      if (rows.some((r) => r.username.toLowerCase() === n.toLowerCase() && r.id !== mine)) return json(409, { message: 'username_taken' });
      let row = rows.find((r) => r.id === mine);
      if (!row) {
        row = { id: `id-${rows.length + 1}`, username: n, level: 1, rebirths: 0, lifetime_words: 0, wins_per_word: 0 };
        rows.push(row);
        secrets.set(body.p_secret, row.id);
      } else {
        row.username = n;
      }
      return json(200, row);
    }
    if (url.pathname.endsWith('/rpc/lb_submit')) {
      calls.submit += 1;
      const row = rows.find((r) => r.id === secrets.get(body.p_secret));
      if (!row) return json(404, { message: 'no_profile' });
      Object.assign(row, {
        level: body.p_level,
        rebirths: body.p_rebirths,
        lifetime_words: body.p_lifetime_words,
        wins_per_word: body.p_wins_per_word,
      });
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.pathname.endsWith('/leaderboard')) {
      const id = url.searchParams.get('id');
      const all = ranked();
      return json(200, id ? all.filter((r) => `eq.${r.id}` === id) : all.slice(0, Number(url.searchParams.get('limit') || 100)));
    }
    return json(404, { message: 'not mocked' });
  });
  return { rows, calls, secrets };
}

const SEED = [
  { id: 'seed-1', username: 'WordWizard', level: 152, rebirths: 6, lifetime_words: 48210, wins_per_word: 912.4 },
  { id: 'seed-2', username: 'BombSquad', level: 88, rebirths: 2, lifetime_words: 20111, wins_per_word: 301.0 },
  { id: 'seed-3', username: 'LexiLoop', level: 40, rebirths: 0, lifetime_words: 5300, wins_per_word: 44.5 },
];

async function openMenu(page, { level = 12, rebirths = 2 } = {}) {
  await installBackendMock(page);
  await page.addInitScript(({ lv, rb }) => {
    try {
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.xp', JSON.stringify({ lv, into: 0 }));
      localStorage.setItem('taw.rebirths', String(rb));
    } catch { /* blocked */ }
  }, { lv: level, rb: rebirths });
}

for (const vp of VIEWPORTS) {
  test(`${vp.width}x${vp.height}: trophy -> board, claim a name, refuse bad + taken names`, async ({ page }) => {
    await page.setViewportSize(vp);
    await openMenu(page);
    const board = await mockBoard(page, SEED);
    await page.goto('/?portal=1');
    await menuReady(page);

    const trophy = page.getByRole('button', { name: 'Open leaderboard' });
    await expect(trophy).toBeVisible();
    const tb = await trophy.boundingBox();
    expect(tb.width).toBeGreaterThanOrEqual(44);
    expect(tb.height).toBeGreaterThanOrEqual(44);
    await trophy.click();

    await expect(page.locator('.lb-panel')).toBeVisible();
    await expect(page.locator('.lb-row')).toHaveCount(3);
    await expect(page.locator('.lb-row').first()).toContainText('WordWizard');
    await expect(page.locator('.lb-row').first().locator('.lb-stars')).toHaveText(/★×6/);

    // Leetspeak bad name: refused on the client, never sent.
    const input = page.locator('.lb-claim-input');
    await input.fill('sh1tl0rd');
    await expect(page.locator('.lb-verdict')).toHaveText('NOT THAT ONE. PICK ANOTHER NAME.');
    await expect(page.locator('.lb-claim-btn')).toBeDisabled();
    // Taken (case-insensitive): the server says so.
    await input.fill('bombsquad');
    await expect(page.locator('.lb-verdict')).toHaveText('TAKEN. TRY ANOTHER.');
    await expect(page.locator('.lb-claim-btn')).toBeDisabled();
    expect(board.calls.claim, 'no claim sent for a refused name').toBe(0);

    // A clean name claims, then shows on the board as YOU with my stats pushed.
    await input.fill('Typer_99');
    await expect(page.locator('.lb-verdict')).toHaveText(/FREE/);
    await page.locator('.lb-claim-btn').click();
    await expect(page.locator('.lb-you-name')).toHaveText('Typer_99');
    const me = page.locator('.lb-row.is-me');
    await expect(me).toContainText('Typer_99 (YOU)');
    await expect(me).toContainText('LV 12');
    await expect(me.locator('.lb-stars')).toHaveText(/★★/);
    expect(board.calls.submit).toBeGreaterThanOrEqual(1);

    const m = await page.evaluate(() => {
      const panel = document.querySelector('.lb-panel');
      const small = [...panel.querySelectorAll('*')]
        .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && /[\p{L}\p{N}]/u.test(n.textContent)))
        .map((el) => `${el.className}:${parseFloat(getComputedStyle(el).fontSize)}`)
        .filter((s) => parseFloat(s.split(':').pop()) < 13);
      return { small, hScroll: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    expect(m.small, 'no text under 13px on the board').toEqual([]);
    expect(m.hScroll).toBe(false);

    // Closing returns to the menu with focus on the trophy.
    await page.locator('.lb-close').click();
    await expect(page.getByRole('button', { name: 'Open leaderboard' })).toBeFocused();
  });
}

test('a claimed name survives a reload and pushes stats from the menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openMenu(page);
  const board = await mockBoard(page, SEED);
  await page.goto('/?portal=1');
  await menuReady(page);
  await page.getByRole('button', { name: 'Open leaderboard' }).click();
  await page.locator('.lb-claim-input').fill('Reloader');
  await expect(page.locator('.lb-verdict')).toHaveText(/FREE/);
  await page.locator('.lb-claim-btn').click();
  await expect(page.locator('.lb-you-name')).toHaveText('Reloader');
  const before = board.calls.submit;
  await page.reload();
  await menuReady(page);
  await expect.poll(() => board.calls.submit).toBeGreaterThan(before);
  await page.getByRole('button', { name: 'Open leaderboard' }).click();
  await expect(page.locator('.lb-you-name')).toHaveText('Reloader');
  await expect(page.locator('.lb-claim')).toHaveCount(0);
});
