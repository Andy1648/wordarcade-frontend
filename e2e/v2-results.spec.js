// e2e/v2-results.spec.js — P9b RESULTS / K.O. (claude/mockups/v2/Results.dc.html; claude/SEASON2-QUEUE.md 9b):
// "one big placement, tally counts up line by line, the multiplier chain shown once, PLAY AGAIN big. Every win credited
// must appear as its own line (no unexplained wins). Replaces the old 'where your wins came from' breakdown."
//
// A real 6-player Word Bomb round on the backend mock: everyone plays, then seats go out one by one (the order the
// screen sees), so the placement is earned, not faked.
//   * WIN: #1 + WIN stamp; the tally reveals in order and COUNTS UP (the total reads +0 early, its real value at the
//     end); the chain chips sit on the WORDS line, once; WINNER BONUS is its own line; TOTAL = Σ lines = taw.wins Δ;
//     "WHERE YOUR WINS CAME FROM" is gone; PLAY AGAIN is the biggest button and restarts (rematch);
//   * LOSS: placement by elimination (#3, #4), NO stamp (the TOP 3 / KO'D stamps sat on the /N — Andy oct19), the
//     PAUSE-TO-LEARN word, the K.O. line named; at #2 of 2 nothing is drawn over the /2;
//   * REDUCE MOTION: every line is final on the first frame; nothing animates;
//   * the four sizes: no card scroll, no text < 13 px, PLAY AGAIN on screen, nothing loops.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { pinDay } from './support/fixedDay.js';
import { expectNoLayoutDefects, layoutDefects } from './support/overlap.js';

const ME = 'e2e-player';
const NAMES = ['YOU', 'RIVAL', 'KIMBERLY', 'SAMWISE', 'LEXI', 'ZZZAP'];
const WORDS = ['STRAND', 'INSTRUCT', 'STRONGEST', 'ASTRAY', 'DESTROY', 'STRIPE', 'CONSTRUCT', 'STRESS', 'STRAW', 'STREAM', 'MISTRUST', 'STRUT', 'STRIKE', 'STRING', 'STROLL', 'STRUCK', 'STRAIN', 'STRANGE'];

async function play(page, { outcome, place = 3, reduce = false, vp = { width: 1366, height: 657 }, season2 = false, seed = {} }) {
  await page.setViewportSize(vp);
  // pin the calendar: the day's contracts are dealt from the local date, and on a day whose pick the round below finishes
  // (2026-10-27: wb-long9 ← CONSTRUCT) the card grows a CONTRACT DONE line — CI went red at UTC midnight. Pinned to
  // that day, every run measures the TALLER card (the worst case). PIN_DAY=<iso> tries another day.
  await pinDay(page, process.env.PIN_DAY || '2026-10-27T12:00:00');
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

for (const place of [3, 4]) {
  test(`LOSS #${place}: placement by elimination, no stamp, the PAUSE-TO-LEARN word, the K.O. line`, async ({ page }) => {
    test.setTimeout(90_000);
    await play(page, { outcome: 'loss', place });
    const card = page.locator('.rs2');
    await expect(card).toHaveAttribute('data-place', String(place));
    await expect(card.locator('.rs2-place-n')).toHaveText(`#${place}`);
    await expect(card.locator('.rs2-place-of')).toHaveText('/6');
    await expect(card.locator('.rs2-stamp')).toHaveCount(0);
    await expect(card.locator('.rs2-hero')).toHaveAttribute('aria-label', /Knocked out\. RIVAL WINS/);
    await expect(card.locator('.missed-hold-word')).toBeVisible();
    await expect(card.locator(`.rs2-prow.is-me`)).toHaveAttribute('data-place', String(place));
    await expect(card.locator('[data-wins-line="WINNER BONUS"]')).toHaveCount(0);
  });
}

// #2 OF 2 (Andy oct19: "no need for the top three on the finished screen for Word Bomb ... it doesn't logically make sense
// if there are only two players and it's overlapping with two out of two"). The old TOP 3 stamp sat across the "/2".
for (const vp of [{ width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`LOSS #2 of 2 @${vp.width}x${vp.height}: no TOP 3 (no stamp at all), nothing drawn over the /2`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(vp);
    const mock = await installBackendMock(page);
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
    await page.addInitScript(() => {
      for (const k of ['taw.seenMenu', 'taw.seenMenuSpotlight', 'taw.seenGameSpotlight']) localStorage.setItem(k, '1');
    });
    await page.goto('/?portal=1');
    await menuReady(page);
    const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }];
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', timerSeconds: 22, maxLives: 3, round: 1, usedWords: [] } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: 'STRAND', playerId: ME } });
    await page.waitForTimeout(120);
    const out = players.map((p) => ({ ...p, lives: p.id === ME ? 0 : p.lives }));
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: 'p2', players: out, combo: 'ing', timerSeconds: 22, usedWords: [] } });
    await page.waitForTimeout(120);
    mock.pushToClient({ type: 'game_over', payload: { winnerId: 'p2' } });
    const card = page.locator('.game-over-overlay .rs2');
    await card.waitFor();
    await expect(card).toHaveAttribute('data-place', '2');
    await expect(card.locator('.rs2-place-of')).toHaveText('/2');
    await expect(card.locator('.rs2-stamp')).toHaveCount(0);
    await expect(card).not.toContainText('TOP 3');
    await page.waitForTimeout(1200); // the hero's one-shot reveals land
    const hits = await page.evaluate(() => {
      const b = document.querySelector('.rs2-place-of').getBoundingClientRect();
      return [...document.querySelectorAll('.rs2-hero-in > *:not(.rs2-place):not(.rs2-icon)')].map((el) => {
        const a = el.getBoundingClientRect();
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return a.width && ox > 1 && oy > 1 ? `${el.className} ${Math.round(ox)}x${Math.round(oy)}` : null;
      }).filter(Boolean);
    });
    expect(hits, 'something is drawn over the /2').toEqual([]);
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
    if (process.env.SHOTS) await page.screenshot({ path: `claude/shots/results-fit/${vp.width}x${vp.height}.png` });
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

test('WIN with a WIN FX worn (kit.js): its burst; an old save with a SIDEKICK (removed oct26) shows nothing', async ({ page }) => {
  test.setTimeout(90_000);
  await play(page, { outcome: 'win', seed: { 'taw.main': 'hype', 'taw.s2.kit': JSON.stringify({ own: ['firework'], pet: 'pup', fx: 'firework' }) } });
  await expect(page.locator('.rs2-impact-burst.is-kit')).toHaveAttribute('src', '/fx/win/firework.webp');
  await expect(page.locator('[data-sidekick], .sk')).toHaveCount(0);
  await page.waitForTimeout(700);
  if (process.env.SHOTS) await page.screenshot({ path: 'claude/shots/hero-kit/results-win.png' });
});

test('K.O. with a painted K.O. flipbook (oct26): your hero acts out trying to get back up, frame 0 = the K.O. pose', async ({ page }) => {
  await play(page, { outcome: 'loss', place: 4, seed: { 'taw.main': 'brawl' } });
  const flip = page.locator('.rs2-char--ko .cast-flip');
  await expect(flip).toBeVisible();
  await expect(flip.locator('img.cast-frame.is-rest')).toHaveAttribute('src', '/cast/anim/brawl-ko-0.webp');
  await expect(flip.locator('img.cast-frame')).toHaveCount(6);
  await expect(page.locator('.rs2-dizzy'), 'the flipbook paints its own stars').toHaveCount(0);
  if (process.env.SHOTS) { await page.waitForTimeout(2500); await page.screenshot({ path: 'claude/shots/ko-results.png' }); }
});

// OVERLAP AUDIT (oct29): the audited round — a season-2 Word Bomb win over two players (one a bot) that ends before
// anyone scores, so the gems box holds the gem, the figure and its WIN / STREAK source chips beside a +0 TOTAL. The
// box was half the tally column and the chips ran 9–23px out of it into the coin card at 1366, 1280x551 and 1024. At
// each of those sizes the chips are inside their box and nothing on the card overlaps or spills.
for (const vp of [{ width: 1366, height: 768 }, { width: 1280, height: 551 }, { width: 1024, height: 768 }]) {
  test(`@${vp.width}x${vp.height} overlap audit: the WIN / STREAK gem chips stay inside the gems box`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize(vp);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const mock = await installBackendMock(page);
    await page.addInitScript(() => {
      if (sessionStorage.getItem('rs.seeded')) return;
      sessionStorage.setItem('rs.seeded', '1');
      localStorage.setItem('taw.seenMenu', '1');
      localStorage.setItem('taw.seenMenuSpotlight', '1');
      localStorage.setItem('taw.seenGameSpotlight', '1');
      localStorage.setItem('taw.reduceMotion', '1');
      localStorage.setItem('taw.s2.gems', JSON.stringify({ v: 1, bal: 1840, peak: 60, streak: 3, mig: 1 }));
    });
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    const players = [{ id: ME, name: 'KEYFIEND', lives: 3, isHost: true }, { id: 'p2', name: 'xX_SPEEDDEMON_Xx', lives: 2 }, { id: 'p3', name: 'BOT LEXI', lives: 1, isBot: true }];
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'ing', usedWords: [], timerSeconds: 30 } });
    await page.waitForTimeout(400);
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
    const card = page.locator('.game-over-overlay .rs2');
    await expect(card).toHaveAttribute('data-tally', 'done', { timeout: 12_000 });
    await page.evaluate(() => document.fonts.ready);
    const srcs = card.locator('.rs2-gems .gems-earned-src');
    expect(await srcs.count(), 'the win names where its gems came from').toBeGreaterThan(0);
    const box = await card.locator('.rs2-gems').boundingBox();
    for (const r of await srcs.evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right }; }))) {
      expect(r.l).toBeGreaterThanOrEqual(box.x - 1);
      expect(r.r, 'a source chip inside the gems box').toBeLessThanOrEqual(box.x + box.width + 1);
    }
    await expectNoLayoutDefects(expect, page, `results ${vp.width}x${vp.height}`, { scope: '.rs2' });
    if (process.env.SHOTS) await page.screenshot({ path: `claude/shots/overlap-audit/results-${vp.width}x${vp.height}.png` });
  });
}

// HEAVY WIN (oct29, after the overlap audit): the tallest tally the card draws — a 6-player WIN on a day whose CONTRACT
// the round finishes (pinned), word drops on every few words (Math.random pinned low → a WORDS gem source beside WIN and
// STREAK), and rebirths behind it (×27: a 4-digit TOTAL). It ran 62–100px into the PLAY AGAIN row, its third gem chip
// hung out of the gems box, and at 1024 a 3+ digit TOTAL ran out of its own box. At each size: no tally / hero / player
// block reaches the footer, nothing overlaps or spills, the card does not scroll, no fit-check content is dropped
// (data-ko-tight), the gem sources are inside their box and the TOTAL's figure inside its own.
for (const vp of [{ width: 1366, height: 768 }, { width: 1280, height: 551 }, { width: 1024, height: 768 }, { width: 1366, height: 657 }, { width: 1920, height: 1080 }]) {
  test(`@${vp.width}x${vp.height} heavy win: the whole tally fits above the footer`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => { Math.random = () => 0.05; });
    await play(page, { outcome: 'win', vp, reduce: true, season2: true, seed: {
      'taw.s2.gems': JSON.stringify({ v: 1, bal: 1840, peak: 60, streak: 3, mig: 1 }),
      'taw.s2.rebirths': '3', 'taw.s2.xp': JSON.stringify({ lv: 5, f: 0.1, rc: 3, v: 10 }),
    } });
    const card = page.locator('.rs2');
    await expect(card).toHaveAttribute('data-tally', 'done', { timeout: 12_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await expect(card.locator('[data-testid="contract-done"]')).toBeVisible();
    expect(await card.locator('.rs2-gems .gems-earned-src').count(), 'three gem sources').toBeGreaterThanOrEqual(3);
    const m = await page.evaluate(() => {
      const c = document.querySelector('.rs2');
      const foot = document.querySelector('.rs2-foot').getBoundingClientRect();
      const vis = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().height > 0; };
      // the hero + players stay above the footer; the tally may run down BETWEEN the footer's edge controls (MENU + the
      // extras under the hero, PLAY AGAIN under the players) but never into one, nor past the card
      const ctrls = [...document.querySelectorAll('.rs2-foot button, .rs2-foot a, .rs2-extras > *')].filter(vis).map((e) => e.getBoundingClientRect());
      const cb = c.getBoundingClientRect();
      const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
      const intoFoot = [
        ...['.rs2-hero', '.rs2-players'].map((sel) => document.querySelector(sel)).filter((el) => el && vis(el))
          .filter((el) => [...el.querySelectorAll('*')].some((k) => vis(k) && k.getBoundingClientRect().bottom > foot.top + 1)).map((el) => el.className),
        ...[...document.querySelectorAll('.rs2-tally *')].filter(vis).filter((k) => { const r = k.getBoundingClientRect(); return r.bottom > cb.bottom - 4 || ctrls.some((q) => hit(r, q)); }).map((k) => `tally ${k.className}`).slice(0, 4),
      ];
      const inside = (sel, boxSel) => [...document.querySelectorAll(sel)].map((e) => {
        const r = e.getBoundingClientRect(); const b = e.closest(boxSel).getBoundingClientRect();
        return r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
      });
      const num = document.querySelector('.rs2-total-num');
      const rg = document.createRange(); rg.selectNodeContents(num); const nr = rg.getBoundingClientRect(); const tb = document.querySelector('.rs2-total').getBoundingClientRect();
      return {
        intoFoot, tight: c.dataset.koTight || '', over: c.scrollHeight - c.clientHeight, overX: c.scrollWidth - c.clientWidth,
        players: vis(document.querySelector('.rs2-players')),
        chipsInside: inside('.rs2-gems .gems-earned-src', '.rs2-gems').every(Boolean),
        totalInside: nr.left >= tb.left && nr.right <= tb.right, totalPx: parseFloat(getComputedStyle(num).fontSize), total: num.dataset.winsTotal,
      };
    });
    if (process.env.SHOTS) { await page.waitForTimeout(6000); await page.screenshot({ path: `claude/shots/overlap-audit/heavy-win-${vp.width}x${vp.height}.png` }); }
    expect(Number(m.total), 'a 4-digit TOTAL (rebirths ×27)').toBeGreaterThanOrEqual(1000);
    expect(m.intoFoot, 'nothing runs into a footer control or off the card').toEqual([]);
    expect(m.over, 'the card does not scroll').toBeLessThanOrEqual(0);
    expect(m.overX, 'the card does not scroll sideways').toBeLessThanOrEqual(0);
    expect(m.tight, 'nothing had to be dropped to fit').toBe('');
    expect(m.players, 'the player list is on the card').toBe(true);
    expect(m.chipsInside, 'every gem source inside the gems box').toBe(true);
    expect(m.totalInside, 'the TOTAL figure inside its box').toBe(true);
    expect(m.totalPx, 'the TOTAL still reads big').toBeGreaterThanOrEqual(20);
    const d = await layoutDefects(page, { scope: '.rs2' });
    expect(d.overlaps).toEqual([]);
    expect(d.spills).toEqual([]);
    expect(d.offscreen).toEqual([]);
  });
}
