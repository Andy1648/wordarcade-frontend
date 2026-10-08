// e2e/v2-rebirth.spec.js — THE v2 REBIRTH SCREEN (P3; claude/mockups/v2/Rebirth.dc.html) behind ?season2=1, on the
// season-2 board mock (boardMock `season2` — 029's real write rule + lb_rebirth / lb_ascend season 2, PROGRESSION FINAL v2).
//   1. a hold released before 1 s sends NOTHING; a full 1 s hold sends ONE lb_rebirth; while it is pending the
//      button is disabled (a second full hold does nothing); the server's answer lands R1 once — back to LV 1, KEY kept,
//      no gems;
//   2. the server's stored level is below the gate (LV 15 at R0) → refused with "LV 10 / 15", nothing applied;
//   3. at R10 there is no ASCEND (hidden in v2); the AUTO REBIRTH toggle (R2+) persists;
//   4. the phone (390×844) gets the same screen and the same hold.
// With the flag OFF the live REBIRTH view is untouched (server-rebirth.spec.js / rr-ready.spec.js cover it).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

const SECRET = 'e'.repeat(48);

async function boot(page, { row, local, delayMs = 0 }) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  const board = await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs }, season2: true });
  await page.addInitScript(({ secret, id, local }) => {
    if (sessionStorage.getItem('rb2.seeded')) return;
    sessionStorage.setItem('rb2.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Holder' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: local.level, f: 0, rc: local.rebirths, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', String(local.rebirths));
    if (local.stars) localStorage.setItem('taw.s2.stars', String(local.stars));
  }, { secret: SECRET, id: row.id, local });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'rebirth').click();
  const screen = page.locator('.rb2');
  await screen.waitFor({ state: 'visible' });
  return { board, shared, screen };
}
const s2 = (page) => page.evaluate(() => ({
  level: window.__tawXp ? window.__tawXp().level : (JSON.parse(localStorage.getItem('taw.s2.xp') || '{}').lv ?? null),
  rebirths: Number(localStorage.getItem('taw.s2.rebirths') || 0),
  stars: Number(localStorage.getItem('taw.s2.stars') || 0),
  gems: (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0,
  pending: localStorage.getItem('taw.lb.rbreq'),
}));
/** Press and hold the button for `ms`, then let go (a real pointer: down → wait → up). */
async function hold(page, loc, ms) {
  const b = await loc.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

test('hold < 1 s sends nothing; a full hold sends ONE lb_rebirth; disabled while pending; a 2nd hold does nothing', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const row = { id: 'me-rb2', username: 'Holder', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  const { board, shared, screen } = await boot(page, { row, local: { level: 60, rebirths: 0 }, delayMs: 1500 });
  const btn = screen.locator('.rb2-hold .kb');
  await expect(screen.locator('[data-testid="rb2-now"]')).toHaveText('R0');
  await expect(screen.locator('.rb2-r-after')).toHaveText('R1');
  await expect(btn).toContainText('HOLD TO REBIRTH');
  // YOU GET (FINAL v2): ×3 per rebirth, KEY kept, LEVELS → LV 1 (BACK TO LV 1 · KEY KEPT), no gems
  await expect(screen.locator('.rb2-get')).toContainText('×1 → ×3');
  await expect(screen.locator('.rb2-get')).toContainText('KEPT');
  await expect(screen.locator('.rb2-get')).toContainText('→ LV 1');
  await expect(screen.locator('.rb2-get')).not.toContainText('GEMS');
  await expect(screen.locator('[data-testid="rb2-cost"]')).toHaveText('BACK TO LV 1 · KEY KEPT');
  await expect(btn).toContainText('LV 60 → 1');
  // the UNLOCKS track (v3/unlocks.js): five diamonds (no ASCEND in v2); ROLL + INDEX is lit from the start
  await expect(screen.locator('.rb2-ms')).toHaveCount(5);
  await expect(screen.locator('.rb2-ms.is-got')).toHaveCount(1);
  await expect(screen.locator('.rb2-ms[data-unlock="rollScreen"]')).toHaveClass(/is-got/);
  await expect(screen.locator('[data-testid="rb2-auto"]'), 'AUTO REBIRTH opens at R2').toHaveCount(0);

  // 1) an early release is a cancel: nothing is sent
  await hold(page, btn, 500);
  await page.waitForTimeout(300);
  expect(board.calls.rebirth || 0, 'a 0.5 s hold sends nothing').toBe(0);
  expect((await s2(page)).rebirths).toBe(0);

  // 2) the full hold: ONE request; the button is disabled until the server answers
  await hold(page, btn, 1150);
  await expect(btn).toHaveAttribute('aria-disabled', 'true');
  await expect(btn).toContainText('REBIRTHING…');
  expect((await s2(page)).rebirths, 'nothing applied before the server answers').toBe(0);
  // 3) a second full hold on the disabled button does nothing
  await hold(page, btn, 1150);
  await expect(screen.locator('[data-testid="rb2-now"]')).toHaveText('R1', { timeout: 15_000 });
  expect(board.calls.rebirth, 'one hold → one lb_rebirth').toBe(1);
  expect(shared.rows[0].rebirths).toBe(1);
  const st = await s2(page);
  expect(st.rebirths).toBe(1);
  expect(st.gems, 'a rebirth pays no gems (FINAL)').toBe(0);
  expect(st.level, 'back to LV 1').toBe(1);
  expect(shared.rows[0].level, 'the server sent the row to LV 1 too').toBe(1);
  expect(st.pending, 'the answered request id is cleared').toBeNull();
  // R1 lit (AUTO ROLL); the next gate (LV 33) is out of reach → the button is locked
  await expect(screen.locator('.rb2-ms.is-got')).toHaveCount(2);
  await expect(screen.locator('.rb2-ms[data-unlock="autoRoll"]')).toHaveClass(/is-got/);
  await expect(btn).toContainText('NEED LEVELS');
  await page.waitForTimeout(400);
  expect(board.calls.rebirth).toBe(1);
  await screen.locator('.rb2-back').click();
  await expect(screen).toHaveCount(0);
});

test('stored level below the gate → refused "LV 10 / 15", nothing applied, the button comes back', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 657 });
  // the row's last submit is "in the future" → every push is throttled: the server keeps LV10
  const row = { id: 'me-rb2', username: 'Holder', level: 10, rebirths: 0, lifetime_words: 400, lifetime_letters: 2400, wins_per_word: 0, econ: 13, submitted_at: Date.now() + 10 * 60 * 1000 };
  const { board, shared, screen } = await boot(page, { row, local: { level: 120, rebirths: 0 } });
  const btn = screen.locator('.rb2-hold .kb');
  await hold(page, btn, 1150);
  await expect(screen.locator('.rb2-msg')).toHaveText('LV 10 / 15 — NOT THERE YET');
  await expect(btn).not.toHaveAttribute('aria-disabled', 'true');
  await expect(btn).toContainText('HOLD TO REBIRTH');
  expect(board.calls.rebirth).toBe(1);
  expect(shared.rows[0].rebirths).toBe(0);
  expect((await s2(page)).rebirths).toBe(0);
  await expect(screen.locator('[data-testid="rb2-now"]')).toHaveText('R0');
});

test('R10: no ASCEND (hidden in v2) — every unlock lit; AUTO REBIRTH toggles', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  // an established season-2 row (submitted a minute ago) — a first submit would clamp R to the word count
  const row = { id: 'me-rb2', username: 'Holder', level: 1, rebirths: 10, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 13, submitted_at: Date.now() - 60_000 };
  const { board, screen } = await boot(page, { row, local: { level: 1, rebirths: 10 } });
  await expect(screen.locator('.rb2-ms')).toHaveCount(5);
  await expect(screen.locator('.rb2-ms.is-got')).toHaveCount(5);
  await expect(screen.locator('.rb2-ms[data-unlock="ascend"]')).toHaveCount(0);
  await expect(screen.locator('.rb2-ascend')).toHaveCount(0);
  // AUTO REBIRTH (R2+): a toggle on this screen, kept in taw.s2.autoRebirth
  const auto = screen.locator('[data-testid="rb2-auto"]');
  await expect(auto).toHaveText('AUTO REBIRTH: OFF');
  await auto.click();
  await expect(auto).toHaveText('AUTO REBIRTH: ON');
  await expect(auto).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('taw.s2.autoRebirth'))).toBe('1');
  await auto.click();
  await expect(auto).toHaveText('AUTO REBIRTH: OFF');
  expect(board.calls.ascend || 0).toBe(0);
});

test('phone 390×844: the same screen, the same hold, no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const row = { id: 'me-rb2', username: 'Holder', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  const { board, screen } = await boot(page, { row, local: { level: 120, rebirths: 0 } });
  const overflow = await page.evaluate(() => document.querySelector('.rb2').scrollWidth - document.querySelector('.rb2').clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const btn = screen.locator('.rb2-hold .kb');
  await hold(page, btn, 1150);
  await expect(screen.locator('[data-testid="rb2-now"]')).toHaveText('R1', { timeout: 15_000 });
  expect(board.calls.rebirth).toBe(1);
});
