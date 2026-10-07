// e2e/season2-reset.spec.js — THE SEASON 2 RESET, client half (PROGRESSION v3 phase 4; 023_season2_reset.sql,
// claude/mockups/v2/Season2.dc.html), behind ?season2=1 with the board mock's `season2Reset` (lb_caps.season2_reset +
// lb_season2_grant / lb_season2_claim on the REAL rule, season2Rules.js):
//   * a season-1 local save is wiped (season-1 AND taw.s2.* keys) except the username / secret / settings;
//   * the SEASON 2 welcome shows ONCE with the mockup copy, the old R and the server's gems + rolls line;
//   * COLLECT credits the gems into the season-2 wallet (lb_season2_claim ok);
//   * a reload does not show it again;
//   * a mocked "already claimed" (another device got there first) credits nothing.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';

const SECRET = 'e'.repeat(48);

async function boot(page, { grant }) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  // the server AFTER 023: the row is reset (econ 13, LV1 R0) and holds the gift for old R7 → round5(300 + 280) = 580
  const row = { id: 'me-s2r', username: 'OldTimer', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 13 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map(), grants: new Map([[row.id, grant]]) };
  const board = await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true, season2Reset: true });
  await page.addInitScript(({ secret, id }) => {
    if (sessionStorage.getItem('s2r.seeded')) return;
    sessionStorage.setItem('s2r.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'OldTimer' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.reduceMotion', '1');
    // the SEASON-1 save
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.wins', '999999');
    localStorage.setItem('taw.rebirths', '7');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, f: 0.5, rc: 7, v: 10 }));
    localStorage.setItem('taw.gems', JSON.stringify({ bal: 900, mig: 1 }));
    localStorage.setItem('taw.owned', JSON.stringify(['pop-fire']));
    // pre-launch season-2 testing
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 99, f: 0.5, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.wins', '500');
    localStorage.setItem('taw.s2.stars', '3');
  }, { secret: SECRET, id: row.id });
  await page.goto('/?portal=1&season2=1');
  return { board, shared, id: row.id };
}
// every taw.* key, RAW (named access: season 2 maps getItem('taw.wins') to taw.s2.wins at the storage layer)
const store = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('taw.')).map((k) => [k, localStorage[k]])));
const s2Gems = async (page) => (JSON.parse((await store(page))['taw.s2.gems'] || '{}').bal) || 0;
/** The boot check has settled once a season-2 board push lands (submitStats waits on it). */
const settled = (board, after = 0) => expect.poll(() => board.calls.submitS2 || 0, { timeout: 15_000 }).toBeGreaterThan(after);

test('SEASON 2 RESET: a season-1 save is wiped (username kept), the welcome shows once, COLLECT credits the gems', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  const { board } = await boot(page, { grant: { gems: 580, rebirths: 7, claimed_at: null, claim_request: null } });

  const w = page.getByTestId('season2-welcome');
  await expect(w).toBeVisible({ timeout: 15_000 });
  await expect(w.locator('#s2w-title')).toHaveText("EDITOR'S NOTE");
  await expect(w).toContainText("SORRY FOR RESCALING THE PROGRESSION — HERE'S SOME GEMS");
  // the gem pill sits on the LEFT half (the gems fly there)
  const pb = await w.locator('.s2w-wallet').boundingBox();
  const vw = page.viewportSize().width;
  expect(pb.x + pb.width / 2, 'the gem pill is on the left').toBeLessThan(vw / 2);
  await expect(page.getByTestId('season2-old-run')).toHaveText('R7');
  await expect(page.getByTestId('season2-gems')).toHaveText('580');
  await expect(page.getByTestId('season2-rolls')).toHaveText('7 ROLLS');

  // the wipe: every progress key gone — season 1 AND taw.s2.* — except the identity + settings; econ 13
  const k = await store(page);
  for (const gone of ['taw.wins', 'taw.rebirths', 'taw.xp', 'taw.gems', 'taw.owned', 'taw.s2.xp', 'taw.s2.wins', 'taw.s2.stars']) {
    expect(k[gone], `${gone} wiped`).toBeUndefined();
  }
  expect(JSON.parse(k['taw.lb.profile']).username).toBe('OldTimer');
  expect(k['taw.lb.secret']).toBe(SECRET);
  expect(k['taw.reduceMotion']).toBe('1');
  expect(k['taw.econ']).toBe('13');
  expect(await s2Gems(page)).toBe(0);

  // COLLECT → lb_season2_claim ok → +580 in the season-2 wallet; the button turns into PLAY
  await page.getByTestId('season2-collect').click();
  await expect(w).toHaveAttribute('data-phase', 'done');
  await expect.poll(() => s2Gems(page)).toBe(580);
  await expect(w.locator('.s2w-wallet .kp-num'), 'the left pill counted up to the gift').toHaveText('580');
  expect(board.calls.season2Claim).toBe(1);
  await expect(page.getByTestId('season2-collect')).toContainText('PLAY');
  await page.getByTestId('season2-collect').click();
  await expect(w).toHaveCount(0);

  // a reload: no welcome again, no second claim, the gems stay
  const pushes = board.calls.submitS2 || 0;
  await page.reload();
  await settled(board, pushes);
  await expect(page.getByTestId('season2-welcome')).toHaveCount(0);
  expect(board.calls.season2Claim).toBe(1);
  expect(await s2Gems(page)).toBe(580);
  expect(JSON.parse((await store(page))['taw.lb.profile']).username).toBe('OldTimer');
});

test('SEASON 2 RESET: "already claimed" (another device got there first) credits nothing', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const { board, shared, id } = await boot(page, { grant: { gems: 580, rebirths: 7, claimed_at: null, claim_request: null } });
  const w = page.getByTestId('season2-welcome');
  await expect(w).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('season2-gems')).toHaveText('580');
  // the other device claims while this welcome is up
  shared.grants.set(id, { gems: 580, rebirths: 7, claimed_at: Date.now(), claim_request: '00000000-0000-4000-8000-000000000099' });
  await page.getByTestId('season2-collect').click();
  await expect(w).toHaveAttribute('data-phase', 'claimed');
  await expect(w).toContainText('ALREADY COLLECTED');
  expect(board.calls.season2Claim).toBe(1);
  expect(await s2Gems(page)).toBe(0);
  await page.getByTestId('season2-collect').click();
  await expect(w).toHaveCount(0);
  // and a reload: the server says claimed → no welcome
  const pushes = board.calls.submitS2 || 0;
  await page.reload();
  await settled(board, pushes);
  await expect(page.getByTestId('season2-welcome')).toHaveCount(0);
  expect(await s2Gems(page)).toBe(0);
});
