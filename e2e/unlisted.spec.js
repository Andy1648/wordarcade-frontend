// e2e/unlisted.spec.js — THE UNLISTED (oct17): the found-never-rolled gear tier, end to end on the built app.
//   1. INDEX: the UNLISTED strip is "?/?" + riddles only (no name / art / odds), and the SECRET card never prints its odds
//   2. a find: the stamp lands on the word you typed IN A GAME (Word Bomb, mock WS), the gear is owned, the serial is
//      asked from the server (lb_unlisted_claim) and shown "#0042"
//   3. show-off: the PROFILE popup shelf + the leaderboard ProfileCard (server rows from public.unlisted_finds)
// UL_SHOT_DIR=<dir> saves the review screenshots (Chromebook 1366x768 + phone 390x844).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { mockBoard } from './support/boardMock.js';

const SHOTS = process.env.UL_SHOT_DIR || '';
const shot = (page, name) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png` }) : null);
const VPS = [{ w: 1366, h: 768, tag: '1366x768' }, { w: 390, h: 844, tag: '390x844' }];
const SECRET = 'c7'.repeat(24);
const OWNED = { owned: { 'mk-ul-og': { at: 1760000000000, serial: 42, word: 'NEWGROUNDS' }, 'mk-ul-mirror': { at: 1760100000000, serial: 7, word: 'RACECAR' } } };

async function seed(page, { unlisted = null, extra = {} } = {}) {
  await page.addInitScript(({ unlisted, extra }) => {
    if (sessionStorage.getItem('ul.seeded')) return;
    sessionStorage.setItem('ul.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.tut.markRolls', '1');
    localStorage.setItem('taw.rollsOn', '1');
    localStorage.setItem('taw.marksRevealed', '1');
    localStorage.setItem('taw.gems', JSON.stringify({ v: 1, bal: 1000, peak: 12, streak: 0, mig: 1 }));
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 40, into: 0 }));
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0.1, rc: 0, v: 10 }));
    if (unlisted) localStorage.setItem('taw.unlisted', JSON.stringify(unlisted));
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  }, { unlisted, extra });
}
async function openIndex(page) {
  await page.locator('.hp-nav.is-gears:visible').first().click();
  await page.locator('.rs-overlay').waitFor();
  await page.locator('[data-testid="roll-index"]').click();
  await page.locator('.mx-panel').waitFor();
}

for (const vp of VPS) {
  test(`@${vp.tag} INDEX: UNLISTED is "?/?" + riddles; SECRET shows no odds`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await installBackendMock(page);
    await seed(page);
    await page.goto('/?portal=1');
    await menuReady(page);
    await openIndex(page);
    const strip = page.getByTestId('unlisted-strip');
    await strip.scrollIntoViewIfNeeded();
    await expect(page.getByTestId('unlisted-count')).toHaveText('?/?');
    await expect(strip.locator('.ulc.is-masked')).toHaveCount(6);
    await expect(strip.locator('.ulc-art')).toHaveCount(0); // no art leaks
    await expect(strip).not.toContainText(/1 IN|%/); // no odds, anywhere in the tier
    await expect(strip.locator('.ulc-riddle').first()).not.toBeEmpty();
    // ORIGIN (SECRET, rolled): its locked card says "???" — never "1 IN 15K"
    const origin = page.locator('.mx-tile[data-mark="mk-origin"]');
    await expect(origin.locator('.mc-odds')).toHaveText('???');
    await expect(origin).not.toHaveAttribute('aria-label', /1 IN/);
    await page.waitForTimeout(400);
    await shot(page, `index-masked-${vp.tag}`);
  });

  test(`@${vp.tag} INDEX + SHEET: found gears show their serial; EQUIP wears one`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await installBackendMock(page);
    await seed(page, { unlisted: OWNED });
    await page.goto('/?portal=1');
    await menuReady(page);
    await openIndex(page);
    const strip = page.getByTestId('unlisted-strip');
    await strip.scrollIntoViewIfNeeded();
    await expect(page.getByTestId('unlisted-count')).toHaveText('2/6');
    await expect(strip.locator('.ulc.is-owned')).toHaveCount(2);
    await expect(strip.locator('.ulc.is-owned .ulc-serial').first()).toHaveText('#0042');
    await page.waitForTimeout(400);
    await shot(page, `index-found-${vp.tag}`);
    await strip.locator('.ul-strip-btn', { hasText: 'O.G.' }).click();
    const sheet = page.locator('.ul-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('unlisted-serial')).toHaveText('FINDER #0042');
    await expect(sheet.getByTestId('mark-main')).toContainText('WINS + XP');
    await page.waitForTimeout(400);
    await shot(page, `sheet-${vp.tag}`);
    await sheet.getByTestId('gear-equip').click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('taw.mark'))).toBe('mk-ul-og');
    await expect(sheet.getByTestId('gear-equip')).toHaveText('UNEQUIP');
  });

  test(`@${vp.tag} PROFILE popup: the UNLISTED shelf with serials`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await installBackendMock(page);
    await seed(page, { unlisted: OWNED });
    await page.goto('/?portal=1');
    await menuReady(page);
    const open = page.locator('[data-nav="profile"]:visible').first();
    await open.click();
    const pf = page.getByTestId('profile-popup');
    await expect(pf).toBeVisible();
    const shelf = pf.getByTestId('unlisted-shelf');
    await shelf.scrollIntoViewIfNeeded();
    await expect(shelf).toContainText('2 FOUND');
    await expect(shelf.locator('.ulc-serial')).toHaveText(['#0042', '#0007']);
    await page.waitForTimeout(500);
    await shot(page, `profile-${vp.tag}`);
  });

  test(`@${vp.tag} LEADERBOARD card: another player's UNLISTED from the server`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await installBackendMock(page);
    const r = (id, username, o) => ({ id, username, level: 10, rebirths: 0, stars: 0, lifetime_words: 500, lifetime_letters: 2500, wins_per_word: 10, econ: 13, submitted_at: Date.now() + 3_600_000, ...o });
    const rows = [r('a', 'ALPHA', { stars: 1 }), r('b', 'BRAVO', { rebirths: 9, level: 900 }), r('c', 'CHARLIE', { rebirths: 9, level: 100 }), r('me', 'NOBUFF', { level: 40 })];
    await mockBoard(page, [], { caps: true, shared: { rows, secrets: new Map([[SECRET, 'me']]), saves: new Map() }, econ: true, boardEcon: true, weekly: true, rebirth: { delayMs: 0 }, season2: true });
    await seed(page, { extra: { 'taw.lb.profile': JSON.stringify({ id: 'me', username: 'NOBUFF' }), 'taw.lb.secret': SECRET, 'taw.econ': '12' } });
    await page.route('**/rest/v1/profile_showcase*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ gear1: 'mk-ul-mirror', gear2: 'mk-kraken', base_wins: 190, wins_per_word: 5130, gears_found: 9, gears_total: 28, power: 6 }]) }));
    await page.route('**/rest/v1/unlisted_finds*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ gear_id: 'mk-ul-mirror', serial: 3 }, { gear_id: 'mk-ul-typewriter', serial: 118 }, { gear_id: 'mk-fake', serial: 1 }]) }));
    await page.goto('/?portal=1&season2=1');
    await page.locator('[data-nav="leaderboard"]').click();
    const lb = page.locator('.lb2');
    await expect(lb.locator('.lb2-col--2')).toHaveAttribute('data-id', /.+/, { timeout: 10_000 });
    await lb.locator('.lb2-col--2').click();
    const pc = page.getByTestId('profile-card');
    await expect(pc).toBeVisible();
    await expect(pc.locator('.pc-gear[data-slot="1"]')).toHaveAttribute('data-tier', 'unlisted');
    await expect(pc.locator('.pc-gear[data-slot="1"] .pc-gear-name')).toHaveText('MIRROR');
    const shelf = pc.getByTestId('unlisted-shelf');
    await expect(shelf).toContainText('2 FOUND'); // the unknown id is dropped
    await expect(shelf.locator('.ulc-serial')).toHaveText(['#0118', '#0003']);
    await shelf.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await shot(page, `leaderboard-card-${vp.tag}`);
  });

  test(`@${vp.tag} THE FIND: typing NEWGROUNDS in Word Bomb stamps the word, grants the gear, claims serial #0042`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const mock = await installBackendMock(page);
    await seed(page, { extra: { 'taw.lb.secret': SECRET, 'taw.lb.profile': JSON.stringify({ id: 'me', username: 'NOBUFF' }) } });
    const claims = [];
    await page.route('**/rest/v1/rpc/lb_unlisted_claim', async (route) => {
      claims.push(JSON.parse(route.request().postData() || '{}'));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, serial: 42, v: 52 }) });
    });
    await page.goto('/?portal=1');
    await menuReady(page);
    const ME = 'e2e-player';
    const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }];
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'gro', usedWords: [], timerSeconds: 30 } });
    await expect(page.locator('.game-wrap')).toBeVisible();
    const input = page.locator('.game-input-row input').first();
    await input.waitFor({ state: 'visible' });
    await input.click();
    await page.keyboard.type('newgrounds', { delay: 40 });
    const stamp = page.getByTestId('unlisted-stamp');
    await expect(stamp).toBeVisible({ timeout: 8000 }); // the stamp + the grant load lazily on the find
    await expect(stamp.locator('.uls-word-text')).toHaveText('NEWGROUNDS');
    await expect(stamp.locator('.uls-name')).toHaveText('O.G.');
    await expect(stamp.locator('.uls-serial')).toHaveText('#0042', { timeout: 6000 });
    expect(claims[0]).toEqual({ p_secret: SECRET, p_gear: 'mk-ul-og' });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('taw.unlisted')));
    expect(saved.owned['mk-ul-og']).toMatchObject({ serial: 42, word: 'NEWGROUNDS' });
    await page.waitForTimeout(450); // past the slam
    await shot(page, `stamp-${vp.tag}`);
    await expect(stamp).toHaveCount(0, { timeout: 5000 }); // one-shot: it leaves on its own
    // a second NEWGROUNDS is not a second find
    await page.keyboard.type(' newgrounds', { delay: 30 });
    await page.waitForTimeout(400);
    await expect(stamp).toHaveCount(0);
    expect(claims.length).toBe(1);
  });
}
