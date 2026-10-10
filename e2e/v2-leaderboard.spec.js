// e2e/v2-leaderboard.spec.js — THE v2 LEADERBOARD (P8; claude/mockups/v2/Leaderboard.dc.html) behind ?season2=1, on
// the season-2 board mock (022 leaderboard_s2; 024 leaderboard_s2_weekly with `s2Weekly`):
//   1. ★ → R → level: a ★1 R0 player tops R9 players; the podium is the top 3, ranks 4 … 10 are rows; every name wears
//      its v3 RANK plate (VOIDTYPER, GLYPHLORD, CLACKER …);
//   2. YOU IN THE TOP 3: your podium place is the one marked YOU (once on the screen — never also a list row), and the
//      CHASE targets the place above (or says #1);
//   3. YOU PAST #10: your row is pinned as the last row with your real rank;
//   4. ▲▼ from the last look (a snapshot of the last visit), then the snapshot is rewritten;
//   5. THIS WEEK reads leaderboard_s2_weekly (★ / R / LV gained) — and falls back to the live weekly view's season-2
//      rows (words) while 024 is not run;
//   6. every arrival animation is FINITE (nothing loops); at the four sizes: no scrollbars, nothing off-screen, no text
//      under 13px, 44px targets; ← MENU closes.
// With the flag OFF the live board is untouched (every other leaderboard spec runs flag-off).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'b8'.repeat(24);
const FUTURE = Date.now() + 3_600_000; // the stored rows' last write: a submit from the board open is throttled (rows stay put)
const r = (id, username, o) => ({ id, username, level: 10, rebirths: 0, stars: 0, lifetime_words: 500, lifetime_letters: 2500, wins_per_word: 10, econ: 13, submitted_at: FUTURE, ...o });

// ★ → R → level: A (★1 R0) > B (R9 LV900) > C (R9 LV100) > D (R2 LV9999) > …
const BOARD = [
  r('d', 'DELTA', { rebirths: 2, level: 9999 }),
  r('b', 'BRAVO', { rebirths: 9, level: 900 }),
  r('a', 'ALPHA', { stars: 1, rebirths: 0, level: 5 }),
  r('c', 'CHARLIE', { rebirths: 9, level: 100 }),
  r('e', 'ECHO', { rebirths: 1, level: 50 }),
  r('f', 'FOXTROT', { rebirths: 1, level: 40 }),
  r('g', 'GOLF', { rebirths: 0, level: 300 }),
  r('h', 'HOTEL', { rebirths: 0, level: 200 }),
  r('i', 'INDIA', { rebirths: 0, level: 100 }),
  r('j', 'JULIET', { rebirths: 0, level: 90 }),
  r('k', 'KILO', { rebirths: 0, level: 80 }),
  r('l', 'LIMA', { rebirths: 0, level: 70 }),
  // a SEASON-1 row never shows on the season-2 board
  { ...r('s1', 'OLDTIMER', { rebirths: 99, level: 999 }), econ: 12 },
];

async function boot(page, { me, rows = BOARD, seen = null, s2Weekly = false, weekly = true, vp = { width: 1366, height: 657 }, named = true } = {}) {
  await page.setViewportSize(vp);
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const meRow = r('me', 'NOBUFF', me);
  // named: false = a FRESH player — no profile, no row, a secret the board has never seen
  const shared = { rows: [...rows.map((x) => ({ ...x })), ...(named ? [meRow] : [])], secrets: new Map(named ? [[SECRET, 'me']] : []), saves: new Map() };
  const board = await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, weekly, rebirth: { delayMs: 0 }, season2: true, s2Weekly });
  await page.addInitScript(({ secret, me, seen, named }) => {
    if (sessionStorage.getItem('lb2.seeded')) return;
    sessionStorage.setItem('lb2.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    if (named) localStorage.setItem('taw.lb.profile', JSON.stringify({ id: 'me', username: 'NOBUFF' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: me.level || 10, f: 0.1, rc: me.rebirths || 0, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', String(me.rebirths || 0));
    localStorage.setItem('taw.s2.stars', String(me.stars || 0));
    if (seen) localStorage.setItem('taw.s2.lbseen', JSON.stringify(seen));
  }, { secret: SECRET, me: { level: 10, rebirths: 0, stars: 0, ...me }, seen, named });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'leaderboard').waitFor({ state: 'visible' });
  await navControl(page, 'leaderboard').click();
  const lb = page.locator('.lb2');
  await lb.waitFor({ state: 'visible' });
  await expect(lb.locator('.lb2-col--1')).toHaveAttribute('data-id', /.+/, { timeout: 10_000 });
  return { lb, board, shared };
}
const podiumIds = (lb) => Promise.all([1, 2, 3].map((p) => lb.locator(`.lb2-col--${p}`).getAttribute('data-id')));
const rowIds = (lb) => lb.locator('.lb2-row').evaluateAll((els) => els.map((e) => e.dataset.id));

test('★ → R → level: the podium is the top 3, ranks 4 … 10 below; v3 rank plates; no season-1 rows', async ({ page }) => {
  const { lb } = await boot(page, { me: { rebirths: 0, level: 60 } });
  expect(await podiumIds(lb)).toEqual(['a', 'b', 'c']);
  // the list: D (R2), E, F (R1), then the R0s by level — ME (R0 LV60) is #13, so pinned last with the real rank
  expect(await rowIds(lb)).toEqual(['d', 'e', 'f', 'g', 'h', 'i', 'me']);
  await expect(lb.locator('.lb2-row[data-id="me"] .lb2-rk')).toHaveText('13');
  await expect(lb.locator('[data-id="s1"]')).toHaveCount(0);
  // v3 rank plates — by rebirths, then ★ (never the level)
  await expect(lb.locator('.lb2-col--1 .lb2-pod-plate')).toHaveAttribute('data-rank-title', 'VOIDTYPER');
  await expect(lb.locator('.lb2-col--2 .lb2-pod-plate')).toHaveAttribute('data-rank-title', 'GLYPHLORD');
  // Andy oct8: only the top 3 wear plates — the rows give that room to the full name
  await expect(lb.locator('.lb2-row .lb2-plate')).toHaveCount(0);
  await expect(lb.locator('.lb2-col--1 .lb2-pod-r')).toHaveText('★1 R0');
  await expect(lb.locator('.lb2-col--2 .lb2-pod-r')).toHaveText('R9');
  // one YOU on the screen, on your own row; it is lifted (is-me)
  await expect(lb.locator('.lb2-you')).toHaveCount(1);
  await expect(lb.locator('.lb2-row.is-me')).toHaveCount(1);
  // CHASE: the nearest loaded row above you is #10 (JULIET R0 LV90) → 31 LV → #10; CLIMB: R0 → 1 R to TYPO
  await expect(lb.locator('.lb2-chase .lb2-need')).toHaveText('31');
  await expect(lb.locator('.lb2-chase .lb2-unit')).toHaveAttribute('data-unit', 'LV');
  await expect(lb.locator('.lb2-chase .lb2-target')).toHaveText('#10');
  await expect(lb.locator('.lb2-climb .lb2-next')).toHaveAttribute('data-rank-title', 'TYPO');
});

test('YOU IN THE TOP 3: your podium place says YOU (once), no list row is yours, CHASE targets #1', async ({ page }) => {
  // R9 LV500: ALPHA (★1) #1, BRAVO (R9 LV900) #2, ME #3, CHARLIE (R9 LV100) #4
  const { lb } = await boot(page, { me: { rebirths: 9, level: 500 } });
  expect(await podiumIds(lb)).toEqual(['a', 'b', 'me']);
  await expect(lb.locator('.lb2-col--3')).toHaveClass(/is-me/);
  await expect(lb.locator('.lb2-col.is-me')).toHaveCount(1);
  await expect(lb.locator('.lb2-col--3 .lb2-you')).toHaveText('YOU');
  await expect(lb.locator('.lb2-you')).toHaveCount(1);
  await expect(lb.locator('.lb2-row.is-me')).toHaveCount(0);
  expect(await rowIds(lb)).toEqual(['c', 'd', 'e', 'f', 'g', 'h', 'i']);
  await expect(lb.locator('.lb2-col--3 .lb2-pod-plate')).toHaveAttribute('data-rank-title', 'GLYPHLORD');
  // CHASE: BRAVO (#2) is R9 LV900 → same ★ and R → 401 LV → #2
  await expect(lb.locator('.lb2-chase .lb2-unit')).toHaveAttribute('data-unit', 'LV');
  await expect(lb.locator('.lb2-chase .lb2-need')).toHaveText('401');
  await expect(lb.locator('.lb2-chase .lb2-target')).toHaveText('#2');
});

test('YOU ARE #1: the gold place is yours, the CHASE says hold it', async ({ page }) => {
  const { lb } = await boot(page, { me: { stars: 3, rebirths: 1, level: 20 } });
  expect(await podiumIds(lb)).toEqual(['me', 'a', 'b']);
  await expect(lb.locator('.lb2-col--1')).toHaveClass(/is-me/);
  await expect(lb.locator('.lb2-you')).toHaveCount(1);
  await expect(lb.locator('.lb2-chase .lb2-panel-msg')).toHaveText('YOU’RE #1 — HOLD IT');
  await expect(lb.locator('.lb2-col--1 .lb2-pod-plate')).toHaveAttribute('data-rank-title', 'ASCENDANT');
  // CLIMB: ★3 → ★5 OMNIKEY
  await expect(lb.locator('.lb2-climb .lb2-next')).toHaveAttribute('data-rank-title', 'OMNIKEY');
  await expect(lb.locator('.lb2-climb .lb2-unit')).toHaveAttribute('data-unit', '★');
});

test('▲▼ from the last look; the look is remembered for next time', async ({ page }) => {
  // last look: DELTA was #6 (now #4 → ▲2), ECHO was #4 (now #5 → ▼1), FOXTROT #6 → #6 (flat)
  const { lb } = await boot(page, { me: { rebirths: 0, level: 60 }, seen: { all: { d: 6, e: 4, f: 6 } } });
  await expect(lb.locator('.lb2-row[data-id="d"] .lb2-mv')).toHaveClass(/is-up/);
  await expect(lb.locator('.lb2-row[data-id="d"] .lb2-mv')).toHaveText('2');
  await expect(lb.locator('.lb2-row[data-id="e"] .lb2-mv')).toHaveClass(/is-down/);
  await expect(lb.locator('.lb2-row[data-id="e"] .lb2-mv')).toHaveText('1');
  await expect(lb.locator('.lb2-row[data-id="f"] .lb2-mv')).toHaveClass(/is-flat/);
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.s2.lbseen')));
  expect(seen.all).toMatchObject({ a: 1, b: 2, c: 3, d: 4, e: 5, me: 13 });
  // nothing on the board loops; the arrival one-shots finish
  await page.waitForTimeout(2600);
  const loops = await page.evaluate(() => document.getAnimations()
    .filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.lb2'))
    .filter((a) => a.effect.getTiming().iterations === Infinity || a.playState === 'running').length);
  expect(loops, 'no looping / still-running animation on the board at rest').toBe(0);
});

test('THIS WEEK reads leaderboard_s2_weekly: ★ / R / LV gained, in that order', async ({ page }) => {
  const rows = [
    r('w1', 'GRINDER', { rebirths: 3, level: 900, s2_week_stars0: 0, s2_week_rb0: 3, s2_week_lv0: 100 }), // +800 LV
    r('w2', 'REBIRTHER', { rebirths: 4, level: 20, s2_week_stars0: 0, s2_week_rb0: 2, s2_week_lv0: 300 }), // +2 R
    r('w3', 'ASCENDER', { stars: 1, rebirths: 0, level: 5, s2_week_stars0: 0, s2_week_rb0: 10, s2_week_lv0: 1 }), // +★1
    r('w4', 'IDLE', { rebirths: 5, level: 50, s2_week_stars0: 0, s2_week_rb0: 5, s2_week_lv0: 50 }), // nothing
  ];
  const { lb, board } = await boot(page, { me: { rebirths: 1, level: 30, s2_week_stars0: 0, s2_week_rb0: 0, s2_week_lv0: 10 }, rows, s2Weekly: true });
  await lb.locator('.lb2-tab[data-tab="week"]').click();
  await expect(lb.locator('.lb2-tab[data-tab="week"]')).toHaveAttribute('aria-selected', 'true');
  await expect(lb.locator('.lb2-col--1')).toHaveAttribute('data-id', 'w3');
  expect(board.calls.s2Weekly).toBeGreaterThanOrEqual(1);
  // ★ gained first, then R gained (REBIRTHER +2, ME +1), then LV gained (GRINDER)
  expect(await podiumIds(lb)).toEqual(['w3', 'w2', 'me']);
  expect(await rowIds(lb)).toEqual(['w1']);
  await expect(lb.locator('.lb2-col--1 .lb2-pod-r')).toHaveText('+★1 +R0');
  await expect(lb.locator('.lb2-row[data-id="w1"] .lb2-lv')).toHaveText('+800');
  await expect(lb.locator('.lb2-cols')).toContainText('+REBIRTHS');
  await expect(lb.locator('.lb2-cols')).toContainText('+LEVELS');
  await expect(lb.locator('[data-id="w4"]')).toHaveCount(0);
  // you are on the podium this week — once
  await expect(lb.locator('.lb2-col--3')).toHaveClass(/is-me/);
  await expect(lb.locator('.lb2-you')).toHaveCount(1);
  // and back to ALL TIME
  await lb.locator('.lb2-tab[data-tab="all"]').click();
  await expect(lb.locator('.lb2-cols')).toContainText('LEVELS');
  await expect(lb.locator('.lb2-cols')).not.toContainText('+');
});

test('THIS WEEK before 024 runs: the live weekly view, season-2 rows only, words', async ({ page }) => {
  const rows = [
    r('x1', 'TYPIST', { rebirths: 1, level: 40, week_words: 300 }),
    r('x2', 'CASUAL', { rebirths: 0, level: 20, week_words: 50 }),
    { ...r('x3', 'SEASONONE', { rebirths: 9, level: 99, week_words: 9000 }), econ: 12 },
  ];
  const { lb } = await boot(page, { me: { rebirths: 0, level: 15, week_words: 120 }, rows });
  await lb.locator('.lb2-tab[data-tab="week"]').click();
  await expect(lb.locator('.lb2-col--1')).toHaveAttribute('data-id', 'x1');
  expect(await podiumIds(lb)).toEqual(['x1', 'me', 'x2']);
  await expect(lb.locator('[data-id="x3"]')).toHaveCount(0);
  await expect(lb.locator('.lb2-cols')).toContainText('WORDS');
  await expect(lb.locator('.lb2-col--1 .lb2-pod-lv')).toContainText('300');
});

for (const vp of [{ width: 1280, height: 551 }, { width: 1366, height: 657 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`@${vp.width}×${vp.height}: no scrollbars, nothing off-screen, no text under 13px; ← MENU closes`, async ({ page }) => {
    const { lb } = await boot(page, { me: { rebirths: 9, level: 500 }, vp });
    await expect(lb.locator('.lb2-row')).toHaveCount(7);
    await page.waitForTimeout(900); // the podium rise / list slide land
    const m = await page.evaluate(() => {
      const root = document.querySelector('.lb2');
      const W = window.innerWidth;
      const H = window.innerHeight;
      const small = [];
      const off = [];
      for (const el of root.querySelectorAll('*')) {
        const rc = el.getBoundingClientRect();
        if (rc.width === 0 || rc.height === 0) continue;
        if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
        if (rc.left < -1 || rc.top < -1 || rc.right > W + 1 || rc.bottom > H + 1) off.push(String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className));
        const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (hasText && parseFloat(getComputedStyle(el).fontSize) < 12.99) small.push(`${el.className}:${getComputedStyle(el).fontSize}`);
      }
      return {
        scrollX: root.scrollWidth - root.clientWidth,
        scrollY: root.scrollHeight - root.clientHeight,
        docX: document.documentElement.scrollWidth - W,
        small,
        off: off.filter((c) => !/lb2-stripes/.test(c)),
      };
    });
    expect(m.scrollX).toBeLessThanOrEqual(0);
    expect(m.scrollY).toBeLessThanOrEqual(0);
    expect(m.docX).toBeLessThanOrEqual(0);
    expect(m.small, 'no text under 13px').toEqual([]);
    expect(m.off, 'nothing off-screen').toEqual([]);
    for (const sel of ['.lb2-back', '.lb2-tab[data-tab="all"]', '.lb2-tab[data-tab="week"]']) {
      const b = await lb.locator(sel).boundingBox();
      expect(Math.min(b.width, b.height), `${sel} ≥ 44px`).toBeGreaterThanOrEqual(44);
    }
    await lb.locator('.lb2-back').click();
    await expect(lb).toHaveCount(0);
  });
}

// 028 — AFTER THE RESET: everyone keeps their season-1 place (the snapshot's s1_rank) and shows "—" until they earn
// something in season 2; a row that has earned rises above every tie (order = season-2 stats desc, ties by s1_rank).
test('after the reset: unearned rows keep their season-1 order and show "—"; an earned row rises above them', async ({ page }) => {
  const z = { level: 1, rebirths: 0, stars: 0, lifetime_words: 0, lifetime_letters: 0 };
  const rows = [
    r('o3', 'OLDTHREE', { ...z, s1_rank: 3 }),
    r('o1', 'OLDONE', { ...z, s1_rank: 1 }),
    r('n', 'NEWCOMER', { level: 3, rebirths: 0, lifetime_words: 20 }), // no season-1 rank, but earned something
    r('o2', 'OLDTWO', { ...z, s1_rank: 2 }),
    r('o4', 'OLDFOUR', { ...z, s1_rank: 4 }),
  ];
  const { lb } = await boot(page, { me: { ...z, s1_rank: 5 }, rows });
  expect(await podiumIds(lb)).toEqual(['n', 'o1', 'o2']);
  expect(await rowIds(lb)).toEqual(['o3', 'o4', 'me']);
  // the earned row shows its numbers; every unearned stat is "—"
  await expect(lb.locator('.lb2-col--1 .lb2-pod-r')).toHaveText('R0');
  await expect(lb.locator('.lb2-col--2 .lb2-pod-r')).toHaveText('—');
  await expect(lb.locator('.lb2-row[data-id="o3"] .lb2-r')).toHaveText('—');
  await expect(lb.locator('.lb2-row[data-id="me"] .lb2-r')).toHaveText('—');
});

test('CHANGE NAME is inline on this board (Andy oct8: one leaderboard) — no hop to the season-1 screen', async ({ page }) => {
  const { lb } = await boot(page, { me: { rebirths: 0, level: 60 } });
  await lb.locator('.lb2-me-btn').click();
  const box = lb.locator('.lb2-rename');
  await expect(box).toBeVisible();
  await expect(page.locator('.lb-overlay')).toHaveCount(0); // the old live screen never opens
  await box.locator('#lb2-rename-input').fill('x');
  await expect(box.locator('.lb2-rename-msg')).toHaveText(/3–16 LETTERS/);
  await expect(box.locator('.lb2-rename-save')).toBeDisabled();
  await box.locator('.lb2-rename-x').click();
  await expect(box).toHaveCount(0);
  // a real rename: the free-name verdict, SAVE, and the YOU button wears the new name — still this board
  await lb.locator('.lb2-me-btn').click();
  await box.locator('#lb2-rename-input').fill('NEWNAME');
  await expect(box.locator('.lb2-rename-msg')).toHaveText(/FREE/);
  if (process.env.LB_SHOT) await page.screenshot({ path: process.env.LB_SHOT });
  await box.locator('.lb2-rename-save').click();
  await expect(lb.locator('.lb2-me-v')).toHaveText('NEWNAME');
  await expect(page.locator('.lb-overlay')).toHaveCount(0);
});

// Andy oct9: "the leaderboard should show the new design style (new users still get old before creating a new
// username)". The gate in LeaderboardScreen.jsx required a claimed name; a FRESH player now gets this board too, and
// its claim prompt is the inline name box (CLAIM mode) — never the season-1 screen.
for (const vp of [{ width: 1366, height: 657 }, { width: 390, height: 844 }]) {
  test(`@${vp.width}: a FRESH player (no name) gets the v2 board, claims inline, and lands as YOU`, async ({ page }) => {
    const { lb } = await boot(page, { me: { rebirths: 0, level: 12 }, named: false, vp });
    await expect(page.locator('.lb-overlay')).toHaveCount(0); // the old live screen never opens
    const box = lb.locator('.lb2-rename.is-claim');
    await expect(box, 'the claim box is open on arrival').toBeVisible();
    await expect(box.locator('.lb2-rename-l')).toHaveText('CLAIM YOUR NAME');
    await expect(box.locator('.lb2-rename-msg')).toHaveText('NO SIGN-IN. JUST A NAME.');
    await expect(lb.locator('.lb2-me-btn.is-claim')).toContainText('CLAIM');
    await expect(lb.locator('.lb2-chase')).toContainText('CLAIM A NAME TO GET ON THE BOARD');
    await page.waitForTimeout(900);
    if (process.env.LB_SHOT_DIR) await page.screenshot({ path: `${process.env.LB_SHOT_DIR}/lb-fresh-${vp.width}x${vp.height}.png` });
    // nothing overflows the viewport, labels ≥ 14px, 44px targets
    const m = await page.evaluate(() => {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const off = [];
      for (const el of document.querySelectorAll('.lb2-rename *, .lb2-me-btn, .lb2-me-btn *')) {
        const rc = el.getBoundingClientRect();
        if (rc.width && (rc.left < -1 || rc.right > W + 1 || rc.top < -1 || rc.bottom > H + 1)) off.push(String(el.className));
      }
      const fs = (s) => parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
      return { off, docX: document.documentElement.scrollWidth - W, label: fs('.lb2-rename-l'), msg: fs('.lb2-rename-msg'), input: fs('.lb2-rename-input') };
    });
    expect(m.off).toEqual([]);
    expect(m.docX).toBeLessThanOrEqual(0);
    expect(m.label).toBeGreaterThanOrEqual(14);
    expect(m.msg).toBeGreaterThanOrEqual(14);
    expect(m.input, 'inputs ≥ 16px (no iOS zoom)').toBeGreaterThanOrEqual(16);
    for (const sel of ['.lb2-me-btn', '.lb2-rename-save', '.lb2-rename-x', '.lb2-rename-input']) {
      const b = await lb.locator(sel).boundingBox();
      expect(Math.min(b.width, b.height), `${sel} ≥ 44px`).toBeGreaterThanOrEqual(44);
    }
    // ✕ closes it; the CLAIM button reopens it
    await box.locator('.lb2-rename-x').click();
    await expect(box).toHaveCount(0);
    await lb.locator('.lb2-me-btn.is-claim').click();
    await box.locator('#lb2-rename-input').fill('FRESHIE');
    await expect(box.locator('.lb2-rename-msg')).toHaveText(/FREE/);
    await box.locator('.lb2-rename-save').click();
    await expect(lb.locator('.lb2-me-v')).toHaveText('FRESHIE');
    await expect(lb.locator('.lb2-me-btn.is-claim')).toHaveCount(0);
    await expect(page.locator('.lb-overlay')).toHaveCount(0);
  });
}

test('@390: a NAMED player keeps the v2 board with the YOU / CHANGE button, no claim box', async ({ page }) => {
  const { lb } = await boot(page, { me: { rebirths: 0, level: 60 }, vp: { width: 390, height: 844 } });
  await expect(lb.locator('.lb2-me-v')).toHaveText('NOBUFF');
  await expect(lb.locator('.lb2-rename')).toHaveCount(0);
  await page.waitForTimeout(900);
  if (process.env.LB_SHOT_DIR) await page.screenshot({ path: `${process.env.LB_SHOT_DIR}/lb-named-390x844.png` });
});

test('@1366: a NAMED player keeps the v2 board with the YOU / CHANGE button, no claim box', async ({ page }) => {
  const { lb } = await boot(page, { me: { rebirths: 0, level: 60 } });
  await expect(lb.locator('.lb2-me-v')).toHaveText('NOBUFF');
  await expect(lb.locator('.lb2-rename')).toHaveCount(0);
  await page.waitForTimeout(900);
  if (process.env.LB_SHOT_DIR) await page.screenshot({ path: `${process.env.LB_SHOT_DIR}/lb-named-1366x657.png` });
});
