// e2e/v2-results.spec.js — P9b RESULTS / K.O. (claude/mockups/v2/Results.dc.html; claude/SEASON2-QUEUE.md 9b):
// "one big placement, tally counts up line by line, the multiplier chain shown once, PLAY AGAIN big. Every win credited
// must appear as its own line (no unexplained wins). Replaces the old 'where your wins came from' breakdown."
//
// A real 6-player Word Bomb round on the backend mock: everyone plays, then seats go out one by one (the order the
// screen sees), so the placement is earned, not faked.
//   * WIN: #1 + WIN stamp; the tally reveals in order and COUNTS UP (the total reads +0 early, its real value at the
//     end); the chain chips sit on the WORDS line, once; WINNER BONUS is its own line; TOTAL = Σ lines = taw.wins Δ;
//     "WHERE YOUR WINS CAME FROM" is gone; PLAY AGAIN is the biggest button and restarts (rematch);
//   * LOSS: placement by elimination (#3 → TOP 3, #4 → KO'D), the PAUSE-TO-LEARN word, the K.O. line named;
//   * REDUCE MOTION: every line is final on the first frame; nothing animates;
//   * the four sizes: no card scroll, no text < 13 px, PLAY AGAIN on screen, nothing loops.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const ME = 'e2e-player';
const NAMES = ['YOU', 'RIVAL', 'KIMBERLY', 'SAMWISE', 'LEXI', 'ZZZAP'];
const WORDS = ['STRAND', 'INSTRUCT', 'STRONGEST', 'ASTRAY', 'DESTROY', 'STRIPE', 'CONSTRUCT', 'STRESS', 'STRAW', 'STREAM', 'MISTRUST', 'STRUT', 'STRIKE', 'STRING', 'STROLL', 'STRUCK', 'STRAIN', 'STRANGE'];

async function play(page, { outcome, place = 3, reduce = false, vp = { width: 1366, height: 657 }, season2 = false, seed = {} }) {
  await page.setViewportSize(vp);
  await page.emulateMedia({ reducedMotion: reduce ? 'reduce' : 'no-preference' });
  const mock = await installBackendMock(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
  await page.addInitScript(({ reduce, seed }) => {
    if (sessionStorage.getItem('rs.seeded')) return;
    sessionStorage.setItem('rs.seeded', '1');
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.seenGameSpotlight', '1');
    localStorage.setItem('taw.reduceMotion', reduce ? '1' : '0');
  }, { reduce, seed });
  await page.goto(`/?portal=1${season2 ? '&season2=1' : ''}`);
  await menuReady(page);
  const players = NAMES.map((name, i) => ({ id: i ? `p${i + 1}` : ME, name, lives: 3, isHost: i === 0 }));
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
  const before = await page.evaluate(() => Number(localStorage.getItem('taw.wins') || 0));
  let k = 0;
  for (let round = 0; round < 3; round += 1) {
    for (const p of players) {
      mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: p.id, players, combo: 'str', timerSeconds: 22, maxLives: 3, round: 1, difficultyKey: 'chill', usedWords: [], usedAnswers: [] } });
      await page.waitForTimeout(40);
      mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: WORDS[k % WORDS.length], playerId: p.id } });
      k += 1;
      await page.waitForTimeout(60);
    }
  }
  // seats go out p6, p5, …; on a loss I go out so that (place − 2) seats go out after me (RIVAL p2 wins)
  const others = ['p6', 'p5', 'p4', 'p3', 'p2'];
  const after = place - 2;
  const order = outcome === 'win' ? others : [...others.slice(0, 4 - after), ME, ...others.slice(4 - after, 4)];
  const winnerId = outcome === 'win' ? ME : 'p2';
  const dead = new Set();
  for (const id of order) {
    dead.add(id);
    const cur = players.map((p) => ({ ...p, lives: dead.has(p.id) ? 0 : p.lives }));
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: players.find((p) => !dead.has(p.id)).id, players: cur, combo: 'ing', timerSeconds: 22, usedWords: [] } });
    await page.waitForTimeout(120);
  }
  mock.pushToClient({ type: 'game_over', payload: { winnerId } });
  await page.locator('.game-over-overlay .rs2').waitFor();
  return { mock, before };
}

test('WIN: #1 + WIN, line-by-line count-up, chain once, every credited win its own line, PLAY AGAIN restarts', async ({ page }) => {
  test.setTimeout(90_000);
  const { mock, before } = await play(page, { outcome: 'win' });
  const card = page.locator('.rs2');
  await expect(card).toHaveAttribute('data-place', '1');
  await expect(card.locator('.rs2-place-n')).toHaveText('#1');
  await expect(card.locator('.rs2-stamp')).toHaveText('WIN');
  // counting: early on the total still reads +0 and the later lines are not revealed yet
  await page.waitForTimeout(250);
  await expect(card).toHaveAttribute('data-tally', 'run');
  expect(await card.locator('.rs2-total-num').textContent()).toBe('+0');
  expect(await card.locator('.rs2-total').getAttribute('class')).toMatch(/rs2-pending/);
  // …and lands
  await expect(card).toHaveAttribute('data-tally', 'done', { timeout: 12_000 });
  await expect(card.locator('.rs2-pending')).toHaveCount(0);
  // the chain is shown ONCE (on the WORDS line)
  await expect(card.locator('.rs2-chain')).toHaveCount(1);
  expect(await card.locator('.rs2-chip').count()).toBeGreaterThanOrEqual(1);
  // the old receipt is gone
  await expect(page.getByText('WHERE YOUR WINS CAME FROM')).toHaveCount(0);
  await expect(page.locator('.payout--round')).toHaveCount(0);
  // every credited win = one line; total = Σ lines = what taw.wins moved by
  await expect(card.locator('[data-wins-line="WINNER BONUS"]')).toHaveCount(1);
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => Number(localStorage.getItem('taw.wins') || 0));
  const shown = await page.evaluate(() => ({
    total: Number(document.querySelector('[data-wins-total]').getAttribute('data-wins-total')),
    text: document.querySelector('.rs2-total-num').textContent,
    lines: [...document.querySelectorAll('.rs2 [data-wins-line]')].map((n) => ({ label: n.getAttribute('data-wins-line'), amount: Number(n.getAttribute('data-wins-amount')) })),
  }));
  const sum = shown.lines.reduce((a, l) => a + l.amount, 0);
  expect(shown.total).toBe(sum);
  expect(sum, `lines ${JSON.stringify(shown.lines)}`).toBe(after - before);
  expect(sum).toBeGreaterThan(0);
  expect(shown.text, 'the total counted up to its value').not.toBe('+0');
  // PLAY AGAIN is the big one, and it is the rematch
  const again = card.locator('.game-over-rematch');
  const menu = card.locator('.game-over-leave');
  await expect(again).toHaveText('PLAY AGAIN');
  await expect(menu).toHaveText('MENU');
  const pb = await again.boundingBox();
  const mb = await menu.boundingBox();
  expect(pb.width * pb.height).toBeGreaterThan(2 * mb.width * mb.height);
  await again.click();
  await mock.waitForSent('rematch');
});

for (const [place, stamp] of [[3, 'TOP 3'], [4, "KO'D"]]) {
  test(`LOSS #${place}: placement by elimination, ${stamp}, the PAUSE-TO-LEARN word, the K.O. line`, async ({ page }) => {
    test.setTimeout(90_000);
    await play(page, { outcome: 'loss', place });
    const card = page.locator('.rs2');
    await expect(card).toHaveAttribute('data-place', String(place));
    await expect(card.locator('.rs2-place-n')).toHaveText(`#${place}`);
    await expect(card.locator('.rs2-place-of')).toHaveText('/6');
    await expect(card.locator('.rs2-stamp')).toHaveText(stamp);
    await expect(card.locator('.rs2-hero')).toHaveAttribute('aria-label', /Knocked out\. RIVAL WINS/);
    await expect(card.locator('.missed-hold-word')).toBeVisible();
    await expect(card.locator(`.rs2-prow.is-me`)).toHaveAttribute('data-place', String(place));
    await expect(card.locator('[data-wins-line="WINNER BONUS"]')).toHaveCount(0);
  });
}

test('REDUCE MOTION: every line is final on the first frame, nothing animates', async ({ page }) => {
  test.setTimeout(90_000);
  await play(page, { outcome: 'win', reduce: true });
  const card = page.locator('.rs2');
  await expect(card).toHaveAttribute('data-tally', 'done');
  await expect(card.locator('.rs2-pending')).toHaveCount(0);
  const total = Number(await card.locator('[data-wins-total]').getAttribute('data-wins-total'));
  expect(total).toBeGreaterThan(0);
  expect(await card.locator('.rs2-total-num').textContent()).not.toBe('+0');
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.rs2')).length);
  expect(running).toBe(0);
});

for (const vp of [{ width: 1280, height: 551 }, { width: 1366, height: 657 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }, { width: 1163, height: 450 }]) {
  test(`@${vp.width}x${vp.height}: fits (no scroll), no text < 13 px, PLAY AGAIN on screen, nothing loops`, async ({ page }) => {
    test.setTimeout(90_000);
    await play(page, { outcome: 'loss', place: 3, vp });
    const card = page.locator('.rs2');
    await expect(card).toHaveAttribute('data-tally', 'done', { timeout: 12_000 });
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const c = document.querySelector('.rs2');
      const b = document.querySelector('.rs2 .game-over-rematch').getBoundingClientRect();
      const vis = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().width > 0; };
      const small = [...c.querySelectorAll('*')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => el.className || el.tagName);
      const infinite = document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity && a.playState === 'running').length;
      // no column runs into the footer (a column's own overflow is hidden from the card's scrollHeight)
      const foot = document.querySelector('.rs2-foot').getBoundingClientRect();
      const intoFoot = getComputedStyle(c).display === 'grid'
        ? ['.rs2-tally', '.rs2-hero', '.rs2-players'].map((sel) => document.querySelector(sel)).filter((el) => el && getComputedStyle(el).display !== 'none')
          .filter((el) => [...el.querySelectorAll('*')].some((k) => vis(k) && k.getBoundingClientRect().bottom > foot.top + 1)).map((el) => el.className)
        : [];
      return { intoFoot, over: c.scrollHeight - c.clientHeight, overX: c.scrollWidth - c.clientWidth, docV: document.documentElement.scrollHeight > innerHeight, small, infinite, play: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth };
    });
    expect(m.over, 'card does not scroll').toBe(0);
    expect(m.intoFoot, 'no column runs into the PLAY AGAIN footer').toEqual([]);
    expect(m.overX, 'card does not scroll sideways').toBe(0);
    expect(m.small, 'no text under 13px').toEqual([]);
    expect(m.infinite).toBe(0);
    expect(m.play, 'PLAY AGAIN on screen').toBe(true);
  });
}

test('SEASON 2 (PROGRESSION FINAL v2): the chain shows REBIRTH ×3^R and no ★ chip (ascension hidden); lines still sum', async ({ page }) => {
  test.setTimeout(90_000);
  await play(page, { outcome: 'win', season2: true, seed: { 'taw.s2.rebirths': '2', 'taw.s2.stars': '1', 'taw.s2.xp': JSON.stringify({ lv: 5, f: 0.1, rc: 2, v: 10 }) } });
  const card = page.locator('.rs2');
  await expect(card).toHaveAttribute('data-tally', 'done', { timeout: 12_000 });
  const chips = await card.locator('.rs2-chip').allTextContents();
  expect(chips.join(' | ')).toContain('×9REBIRTH');
  expect(chips.join(' | ')).not.toContain('★');
  const shown = await page.evaluate(() => ({
    total: Number(document.querySelector('[data-wins-total]').getAttribute('data-wins-total')),
    sum: [...document.querySelectorAll('.rs2 [data-wins-line]')].reduce((a, n) => a + Number(n.getAttribute('data-wins-amount')), 0),
  }));
  expect(shown.total).toBe(shown.sum);
  expect(shown.total).toBeGreaterThan(0);
});
