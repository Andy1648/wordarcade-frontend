// e2e/rebirth-shards.spec.js — the REBIRTH moment's burst is the PAINTED blade shards (fx/shards): violet on a rebirth,
// gold on a JACKPOT rebirth, ONE burst (the jackpot used to stack a second spray from screen centre), every blade a
// finite transform/opacity one-shot that reads (not a speck), gone at rest, no loop left behind. Real motion.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { mockBoard } from './support/boardMock.js';
import { navControl } from './support/menu.js';

test.describe.configure({ timeout: 60_000 });
test.use({ reducedMotion: 'no-preference' });

const SHOTS = process.env.SHARD_SHOTS || '';
const SECRET = 'e'.repeat(48);

async function boot(page, { row, local }) {
  await installBackendMock(page);
  await page.addInitScript(() => { window.__TAW_NO_ACHIEVEMENT_GRANT = true; });
  const shared = { rows: [row], secrets: new Map([[SECRET, row.id]]), saves: new Map() };
  await mockBoard(page, [], { caps: true, shared, econ: true, boardEcon: true, rebirth: { delayMs: 0 }, season2: true });
  await page.addInitScript(({ secret, id, local }) => {
    if (sessionStorage.getItem('rbs.seeded')) return;
    sessionStorage.setItem('rbs.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.lb.profile', JSON.stringify({ id, username: 'Holder' }));
    localStorage.setItem('taw.lb.secret', secret);
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: local.level, f: 0, rc: local.rebirths, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', String(local.rebirths));
    localStorage.setItem('taw.mastery', JSON.stringify({ 'word-bomb': 30 }));
  }, { secret: SECRET, id: row.id, local });
  await page.goto('/?portal=1&season2=1');
  await navControl(page, 'rebirth').click();
  const screen = page.locator('.rb2');
  await screen.waitFor({ state: 'visible' });
  return screen;
}

const state = (page) => page.evaluate(() => {
  const parts = [...document.querySelectorAll('.gsb-s')];
  const live = (a) => (a.playState === 'running' || a.playState === 'paused') && a.effect && (a.currentTime || 0) >= a.effect.getTiming().delay;
  const playing = parts.filter((p) => p.getAnimations().some(live));
  return {
    srcs: playing.map((p) => p.getAttribute('src')),
    playing: playing.length,
    inf: parts.some((p) => p.getAnimations().some((a) => a.effect && a.effect.getTiming().iterations === Infinity)),
    big: playing.map((p) => { const r = p.getBoundingClientRect(); return Math.max(r.width, r.height); }).sort((a, b) => a - b),
    visible: parts.filter((p) => Number(getComputedStyle(p).opacity) > 0.01).length,
    total: parts.length,
  };
});

const CASES = [
  { name: 'rebirth 1366', w: 1366, h: 768, rebirths: 0, level: 60, set: 'violet' },
  { name: 'rebirth 390', w: 390, h: 844, rebirths: 0, level: 60, set: 'violet' },
  { name: 'jackpot 1366', w: 1366, h: 768, rebirths: 4, level: 120, set: 'gold' },
];

for (const c of CASES) {
  test(`${c.name}: ONE painted ${c.set} blade burst, finite, gone at rest`, async ({ page }) => {
    await page.setViewportSize({ width: c.w, height: c.h });
    const row = { id: `me-${c.name.replace(/\W/g, '')}`, username: 'Holder', level: c.level, rebirths: c.rebirths, lifetime_words: 2000, lifetime_letters: 9000, wins_per_word: 0, econ: 13, submitted_at: Date.now() - 60_000 };
    const screen = await boot(page, { row, local: { level: c.level, rebirths: c.rebirths } });
    const btn = screen.locator('.rb2-hold .kb');
    const b = await btn.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect.poll(async () => (await state(page)).playing, { timeout: 8000, intervals: [20] }).toBeGreaterThan(5);
    await page.mouse.up();
    await page.evaluate(() => { window.__fz = document.getAnimations().map((a) => { a.pause(); return [a, a.currentTime || 0]; }); });
    let mid = null;
    for (const ms of [80, 200, 420]) {
      await page.evaluate((t) => { for (const [a, t0] of window.__fz) a.currentTime = t0 + t; }, ms);
      if (ms === 200) mid = await state(page);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/rebirth-${c.name.replace(/\s/g, '-')}-${ms}.png` });
    }
    await page.evaluate(() => { for (const [a] of window.__fz) a.play(); });
    // ONE burst: the whole pool flies once, never a second spray on top
    expect(mid.playing).toBe(mid.total);
    for (const s of mid.srcs) expect(s).toMatch(new RegExp(`/fx/shards/${c.set}-[0-3]\\.webp$`));
    expect(mid.inf).toBe(false);
    expect(mid.big[Math.floor(mid.big.length / 2)]).toBeGreaterThan(30);
    await expect.poll(async () => (await state(page)).visible, { timeout: 4000 }).toBe(0);
  });
}
