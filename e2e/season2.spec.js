// e2e/season2.spec.js — PROGRESSION FINAL behind ?season2=1 (claude/progression-FINAL.md).
// One claimed board player on the season-2 board (boardMock `season2` — 026's REAL write rule + lb_rebirth season 2 with
// the econ-13 guard), on a desktop and a phone:
//   * TYPES REAL WORDS on the menu and LEVELS (menu words ×0.2; need(40) = 400 × 1.06^39) — gibberish pays nothing;
//   * REBIRTHS on the v2 REBIRTH screen (HOLD TO REBIRTH) through the mocked lb_rebirth (season 2: LV > 25, SPENDS 25
//     levels, keeps the rest) — one request, no gems, R1, LV41 → LV16;
//   * BUYS POWER with wins (300 wins, ×2.5 XP / LETTER);
//   * sees the v3 RANKS (KEYMASH → TYPO — by rebirths, not by level);
//   * sees NO menu claim popup / REWARDS count, even with a season-1 claim waiting in storage;
//   * CLAIMS an ACHIEVEMENT for GEMS (TYPE WORDS I → +40) — gems come from games / achievements, never a rebirth.
// The season-1 save (taw.*) is never touched: season 2 lives under taw.s2.*.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl, isPhoneMenu } from './support/menu.js';

const SECRET = 'd'.repeat(48);

async function boot(page) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const row = { id: 'me-s2', username: 'Season2', level: 1, rebirths: 0, lifetime_words: 0, lifetime_letters: 0, wins_per_word: 0, econ: 12 };
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  const board = await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id }) => {
    if (sessionStorage.getItem('s2.seeded')) return;
    sessionStorage.setItem('s2.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Season2' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    // the SEASON-1 save: must stay exactly as it is
    localStorage.setItem('taw.wins', '999999');
    localStorage.setItem('taw.rebirths', '7');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, f: 0.5, rc: 7, v: 10 }));
    // a season-1 claim waiting in the inbox — season 2 must not pop it
    localStorage.setItem('taw.claims', JSON.stringify([{ id: 'ach-vol-1', kind: 'achievement', label: 'ACHIEVEMENT — FIRST BLOOD', amount: 50, detail: 'vol-1', ts: 1 }]));
    // the SEASON-2 save: LV40, almost through it; 500 wins; 150 season-2 words (TYPE WORDS I is ready). This browser
    // CONVERTED at an earlier boot (taw.s2.conv — v3/convertLocal.js), so the season-1 save above is not converted again.
    localStorage.setItem('taw.s2.conv', JSON.stringify({ v: 1, st: 'shown', had: true, srv: 1 }));
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 40, f: 0.985, rc: 0, v: 10 }));
    localStorage.setItem('taw.s2.wins', '500');
    localStorage.setItem('taw.s2.count', JSON.stringify({ words: 150 }));
  }, { secret: SECRET, id: row.id });
  await page.goto('/?portal=1&season2=1');
  return { board, shared };
}
const s2 = (page) => page.evaluate(() => ({
  level: window.__tawXp ? window.__tawXp().level : null,
  rebirths: localStorage.getItem('taw.s2.rebirths'),
  power: localStorage.getItem('taw.s2.keytier'),
  wins: localStorage.getItem('taw.s2.wins'),
  gems: (JSON.parse(localStorage.getItem('taw.s2.gems') || '{}').bal) || 0,
  // the season-1 keys, read RAW (named access — season 2 maps getItem('taw.wins') to taw.s2.wins at the storage layer)
  s1: { wins: localStorage['taw.wins'], rebirths: localStorage['taw.rebirths'], xp: localStorage['taw.xp'] },
}));
const noClaimPopups = async (page) => {
  await expect(page.locator('.claim-pop')).toHaveCount(0);
  await expect(page.locator('.homepage-claim-count, .hp-m-count')).toHaveCount(0);
};

for (const vp of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`SEASON2 @${vp.width}: type → level, rebirth through lb_rebirth, POWER, v3 ranks, no claim popups, ACHIEVEMENTS pay gems`, async ({ page }) => {
    test.setTimeout(90_000); // a whole season-2 loop: type, rebirth (server), POWER, ACHIEVEMENTS
    await page.setViewportSize(vp);
    const { board, shared } = await boot(page);
    const phone = isPhoneMenu(page);
    await navControl(page, 'stats').waitFor({ state: 'visible' });
    await noClaimPopups(page);
    if (!phone) await expect(page.locator('.menu-xp-rank').first()).toHaveText('KEYMASH');

    // TYPE → LEVEL. Gibberish pays nothing (FINAL: real dictionary words only) …
    await page.keyboard.type('qwrtzxpv ', { delay: 130 });
    await page.waitForTimeout(400);
    expect((await s2(page)).level).toBe(40);
    // … real words do: LV40 → LV41 (need(40) = 400 × 1.06^39 ≈ 3,874 XP, 1.5% left ≈ 58 XP; a menu word letter pays
    // 10 × 0.2 = 2 XP at P0 R0), typed under 12 letters a second, each closed by a space
    await expect.poll(async () => {
      await page.keyboard.type('house garden window little ', { delay: 130 });
      await page.keyboard.type('simple yellow market planet ', { delay: 130 });
      return (await s2(page)).level;
    }, { timeout: 30_000 }).toBeGreaterThanOrEqual(41);
    const lvBefore = (await s2(page)).level;

    // REBIRTH (season 2) through the mocked lb_rebirth: LV > 25 on the stored row, 25 levels SPENT — the v2 REBIRTH
    // screen (P3): HOLD TO REBIRTH (1 s), one request, R0 → R1 in place
    await navControl(page, 'rebirth').click();
    const rb = page.locator('.rb2');
    await rb.waitFor({ state: 'visible' });
    await expect(rb.locator('.rb2-get')).toContainText('×1 → ×2');
    await expect(rb.locator('[data-testid="rb2-cost"]')).toHaveText('COSTS 25 LEVELS · KEEP THE REST');
    await expect(rb.locator('[data-testid="rb2-auto"]'), 'AUTO REBIRTH opens at R2').toHaveCount(0);
    const holdBtn = await rb.locator('.rb2-hold .kb').boundingBox();
    await page.mouse.move(holdBtn.x + holdBtn.width / 2, holdBtn.y + holdBtn.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1150);
    await page.mouse.up();
    await expect(rb.locator('[data-testid="rb2-now"]')).toHaveText('R1', { timeout: 15_000 });
    expect(board.calls.rebirth).toBe(1);
    expect(board.calls.submitS2 || 0).toBeGreaterThanOrEqual(1);
    expect(shared.rows[0].econ, 'the row moved onto the season-2 board').toBe(13);
    expect(shared.rows[0].rebirths).toBe(1);
    let st = await s2(page);
    expect(st.rebirths).toBe('1');
    expect(st.level, 'the rebirth spent 25 levels and kept the rest').toBe(lvBefore - 25);
    expect(shared.rows[0].level, 'the server spent the gate too (026)').toBeGreaterThanOrEqual(1);
    expect(st.gems, 'a rebirth pays no gems (FINAL)').toBe(0);
    await rb.locator('.rb2-back').click();
    await expect(rb).toHaveCount(0);
    await noClaimPopups(page);
    if (!phone) await expect(page.locator('.menu-xp-rank').first()).toHaveText('TYPO');

    // POWER: wins buy only POWER (300 × 8^0 = 300 wins) — the v2 SHOP (P3): HOLD TO BUY, 1 s
    await navControl(page, 'shop').click();
    const sp = page.locator('.sp2');
    await sp.waitFor({ state: 'visible' });
    const buyBtn = await sp.locator('.sp2-buy .kb').boundingBox();
    await page.mouse.move(buyBtn.x + buyBtn.width / 2, buyBtn.y + buyBtn.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1150);
    await page.mouse.up();
    await expect.poll(async () => (await s2(page)).power).toBe('1');
    expect((await s2(page)).wins).toBe('200');
    await page.keyboard.press('Escape');
    await expect(sp).toHaveCount(0);

    // ACHIEVEMENTS (the v2 screen, P3 — the only claim place): the trophy in the nav cluster; TYPE WORDS I pays 40 gems
    await page.locator(phone ? '.hp-m-navbtn.is-ach' : '.homepage-nav-btn.is-ach').click();
    const ach = page.locator('.av3-overlay');
    await ach.waitFor({ state: 'visible' });
    await expect(ach.locator('.av3-gems .kp-num')).toHaveText('0');
    const type = ach.locator('[data-ach="type"]');
    await expect(type.locator('.av3-strip')).toContainText('READY!');
    await type.locator('.av3-claim').click();
    await expect(ach.locator('.av3-gems .kp-num')).toHaveText('40'); // the gems fly in, then the pill lands
    st = await s2(page);
    expect(st.gems).toBe(40);
    expect(await page.evaluate(() => localStorage.getItem('taw.s2.ach'))).toBe('{"type":1}');
    await ach.locator('.av3-back').click();
    await expect(ach).toHaveCount(0);
    await noClaimPopups(page);

    // the season-1 save is untouched
    expect(st.s1).toEqual({ wins: '999999', rebirths: '7', xp: JSON.stringify({ lv: 30, f: 0.5, rc: 7, v: 10 }) });
    expect(await page.evaluate(() => JSON.parse(localStorage['taw.claims']).length)).toBe(1);
  });
}
