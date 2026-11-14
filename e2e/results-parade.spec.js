// e2e/results-parade.spec.js — the RESULTS PROGRESS PARADE + QUESTS (progression phase 1, nov13).
// A real Word Bomb round on the backend mock (3 seats; I land 5 words and win), with today's quests SEEDED so the game
// moves known quests: FINISH 3 GAMES (1/3 → 2/3), SURVIVE 5 TURNS IN ONE GAME (finishes), WIN WORD BOMB (finishes), and the
// weekly 100 WORDS OF 6+. Asserts:
//   * the rows appear ONE BY ONE in parade order (XP → quest → quest) and the NUDGE comes last, naming the closest quest;
//   * the first tap anywhere skips to the end state (every row shown, the counts final);
//   * PLAY AGAIN is live at t = 0 (it sends the rematch before the parade has shown anything);
//   * quest progress carries across two games (the save moves 1 → 2 → 3, the parade's row says so, the payout lands once);
//   * the fit: no page / card scroll at 360×640 · 390×844 · 1366×768, the parade inside the card and clear of the
//     PLAY AGAIN footer, nothing under 13 px (the card's floor), nothing loops; the quest list opens from the nudge and fits.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';
import { pinDay } from './support/fixedDay.js';

const ME = 'e2e-player';
const NAMES = ['YOU', 'RIVAL', 'KIMBERLY'];
const WORDS = ['STRAND', 'INSTRUCT', 'STRONGEST', 'ASTRAY', 'DESTROY', 'STRIPE', 'CONSTRUCT', 'STRESS', 'STRAW', 'STREAM', 'MISTRUST', 'STRUT', 'STRIKE', 'STRING', 'STROLL'];
const DAY = '2026-11-11';
const QUESTS = (prog = {}) => JSON.stringify({
  v: 1, seed: 'e2e', day: DAY, week: '2026-11-09',
  picks: ['q-games3', 'q-wb-run5', 'q-wb-win'], wpick: 'w-long6',
  prog: { 'q-games3': 1, 'w-long6': 40, ...prog }, seen: {}, done: [], paid: {}, pending: [], carry: [], rerolled: false, played: {}, hist: {},
});

async function boot(page, { vp = { width: 1366, height: 768 }, motion = false, quests = QUESTS() } = {}) {
  await page.setViewportSize(vp);
  await pinDay(page, `${DAY}T15:00:00`);
  await page.emulateMedia({ reducedMotion: motion ? 'no-preference' : 'reduce' });
  const mock = await installBackendMock(page, { quests: true }); // QUESTS are off in the suite unless a spec opts in
  page.on('pageerror', (e) => { console.log(`PAGEERROR ${e.message}`); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
  await page.addInitScript(({ quests, motion }) => {
    for (const k of ['taw.seenMenu', 'taw.seenMenuSpotlight', 'taw.seenGameSpotlight']) localStorage.setItem(k, '1');
    localStorage.setItem('taw.reduceMotion', motion ? '0' : '1');
    window.__TAW_NO_CONTRACTS = true; // today's random contracts can't add a row this spec does not expect
    if (sessionStorage.getItem('rp.seeded')) return;
    sessionStorage.setItem('rp.seeded', '1');
    localStorage.setItem('taw.quests', quests);
  }, { quests, motion });
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  return mock;
}

const players = NAMES.map((name, i) => ({ id: i ? `p${i + 1}` : ME, name, lives: 3, isHost: i === 0 }));
async function playGame(page, mock, { first = true } = {}) {
  if (first) {
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
    await page.waitForTimeout(80);
  }
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(120);
  let k = 0;
  for (let round = 0; round < 5; round += 1) {
    for (const p of players) {
      mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: p.id, players, combo: 'str', timerSeconds: 22, maxLives: 3, round: 1, difficultyKey: 'chill', usedWords: [], usedAnswers: [] } });
      await page.waitForTimeout(40);
      mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: WORDS[k % WORDS.length], playerId: p.id } });
      k += 1;
      await page.waitForTimeout(50);
    }
  }
  const dead = new Set();
  for (const id of ['p3', 'p2']) {
    dead.add(id);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: players.map((p) => ({ ...p, lives: dead.has(p.id) ? 0 : 3 })), combo: 'ing', timerSeconds: 22, usedWords: [] } });
    await page.waitForTimeout(100);
  }
  mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
  await page.locator('.game-over-overlay .rs2').waitFor();
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('taw.quests')));

test('the rows appear one by one in parade order, the NUDGE last; the quests finish and pay once', async ({ page }) => {
  test.setTimeout(90_000);
  const mock = await boot(page, { motion: true });
  // watch the reveal order from the first frame (a row is shown when it loses .rp-wait)
  await page.evaluate(() => {
    window.__rpOrder = [];
    const seen = new Set();
    const tick = () => {
      for (const n of document.querySelectorAll('.rp-row, .rp-nudge')) {
        const k = n.dataset.kind || (n.classList.contains('rp-nudge') ? 'nudge' : '?');
        const id = `${k}:${n.dataset.quest || ''}`;
        if (!n.classList.contains('rp-wait') && !seen.has(id)) { seen.add(id); window.__rpOrder.push({ id, t: performance.now() }); }
      }
      if (window.__rpOrder.length < 8) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await playGame(page, mock);
  const parade = page.getByTestId('results-parade');
  await expect(parade).toHaveAttribute('data-phase', 'run', { timeout: 5000 });
  await expect(parade).toHaveAttribute('data-rows', 'xp,quest,quest');
  // mid-parade: something is still waiting
  expect(await page.locator('.rp .rp-wait').count()).toBeGreaterThan(0);
  await expect(parade).toHaveAttribute('data-phase', 'done', { timeout: 8000 });
  await expect(page.locator('.rp .rp-wait')).toHaveCount(0);
  const order = await page.evaluate(() => window.__rpOrder);
  expect(order.map((o) => o.id)).toEqual(['xp:', 'quest:q-wb-run5', 'quest:q-wb-win', 'nudge:']);
  for (let i = 1; i < order.length; i++) expect(order[i].t - order[i - 1].t, `${order[i].id} after ${order[i - 1].id}`).toBeGreaterThan(120);
  // the last row lands within the storyboard's ~4.5 s of the card
  await expect(page.getByTestId('parade-nudge')).toHaveText(/1 MORE GAME FINISHES A QUEST/);
  await expect(page.locator('.rp-row[data-quest="q-wb-run5"]')).toHaveClass(/is-done/);
  // the save: both finished, paid once, 1 → 2 games; the payout is ONE named tally line (no hidden wins)
  const s = await stored(page);
  expect(s.prog['q-games3']).toBe(2);
  expect(s.done.sort()).toEqual(['q-wb-run5', 'q-wb-win']);
  expect(Object.keys(s.paid).sort()).toEqual(['q-wb-run5', 'q-wb-win']);
  expect(s.paid['q-wb-run5'].wins).toBeGreaterThan(0);
  expect(s.played.wb).toBe(DAY);
  await expect(page.locator('.rs2 [data-wins-line="2 QUESTS DONE"]')).toHaveCount(1);
  const line = Number(await page.locator('.rs2 [data-wins-line="2 QUESTS DONE"]').getAttribute('data-wins-amount'));
  expect(line).toBe(s.paid['q-wb-run5'].wins + s.paid['q-wb-win'].wins);
  // nothing loops after the parade
  const infinite = await page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity && a.playState === 'running').length);
  expect(infinite).toBe(0);
});

test('the first tap anywhere skips the parade to its end state', async ({ page }) => {
  test.setTimeout(90_000);
  const mock = await boot(page, { motion: true });
  await playGame(page, mock);
  const parade = page.getByTestId('results-parade');
  await expect(parade).toHaveAttribute('data-phase', 'run', { timeout: 5000 });
  await page.waitForTimeout(200);
  await page.locator('.rs2-hero').click({ position: { x: 30, y: 30 } });
  await expect(parade).toHaveAttribute('data-phase', 'done', { timeout: 600 });
  await expect(page.locator('.rp .rp-wait')).toHaveCount(0);
  await expect(page.locator('.rs2')).toHaveAttribute('data-tally', 'done');
  await expect(page.getByTestId('parade-nudge')).toBeVisible();
  // a second tap does what you tapped: the quest row opens the quest list
  await page.locator('.rp-row[data-quest="q-wb-win"]').click();
  await expect(page.getByTestId('quests-sheet')).toBeVisible();
  await expect(page.locator('.qs-card')).toHaveCount(4);
});

test('PLAY AGAIN is live at t = 0 (same game, no waiting on the parade)', async ({ page }) => {
  test.setTimeout(90_000);
  const mock = await boot(page, { motion: true });
  await playGame(page, mock);
  const again = page.locator('.rs2 .game-over-rematch');
  await expect(again).toBeEnabled();
  // force: the press goes in now, mid-reveal (the actionability wait would sit out the card's one-shot animations)
  await again.click({ force: true });
  await mock.waitForSent('rematch');
  // the parade had not finished when PLAY AGAIN went (it never gates the button)
  expect(await page.getByTestId('results-parade').getAttribute('data-phase')).not.toBe('done');
});

test('quest progress carries across two games: 1 → 2 → 3 FINISH 3 GAMES, paid once, then the nudge moves on', async ({ page }) => {
  test.setTimeout(120_000);
  const mock = await boot(page, { quests: QUESTS() });
  await playGame(page, mock);
  await expect(page.getByTestId('results-parade')).toHaveAttribute('data-phase', 'done', { timeout: 5000 });
  let s = await stored(page);
  expect(s.prog['q-games3']).toBe(2);
  const weekly1 = s.prog['w-long6'];
  expect(weekly1).toBeGreaterThan(40); // 6+ letter words count toward the weekly
  // game two (PLAY AGAIN → the server restarts the room)
  await page.locator('.rs2 .game-over-rematch').click();
  await mock.waitForSent('rematch');
  await playGame(page, mock, { first: false });
  const parade = page.getByTestId('results-parade');
  await expect(parade).toHaveAttribute('data-phase', 'done', { timeout: 5000 });
  s = await stored(page);
  expect(s.prog['q-games3']).toBe(3);
  expect(s.done).toContain('q-games3');
  expect(s.prog['w-long6']).toBeGreaterThan(weekly1);
  // the run-5 / win quests were already paid in game one — never twice
  expect(Object.keys(s.paid).sort()).toEqual(['q-games3', 'q-wb-run5', 'q-wb-win']);
  await expect(page.locator('.rp-row[data-quest="q-games3"]')).toHaveClass(/is-done/);
  await expect(page.locator('.rs2 [data-wins-line="QUEST DONE"]')).toHaveCount(1);
  // every daily is done: the nudge points at the weekly
  await expect(page.getByTestId('parade-nudge')).toHaveText(/MORE WORDS FINISH A QUEST/);
});

for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  test(`@${vp.width}x${vp.height}: no scroll, the parade fits its column, nothing under 13 px; the quest list fits`, async ({ page }) => {
    test.setTimeout(90_000);
    const mock = await boot(page, { vp });
    await playGame(page, mock);
    const parade = page.getByTestId('results-parade');
    await expect(parade).toHaveAttribute('data-phase', 'done', { timeout: 5000 });
    await page.evaluate(() => document.fonts.ready);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/end-${vp.width}x${vp.height}.png` });
    const m = await page.evaluate(() => {
      const c = document.querySelector('.rs2');
      const rp = document.querySelector('.rp');
      const vis = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().width > 0; };
      const small = [...rp.querySelectorAll('*')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => el.className || el.tagName);
      const r = rp.getBoundingClientRect();
      const card = c.getBoundingClientRect();
      const again = document.querySelector('.rs2 .game-over-rematch').getBoundingClientRect();
      const foot = document.querySelector('.rs2-foot').getBoundingClientRect();
      const kids = [...rp.querySelectorAll('.rp-row, .rp-nudge')].map((n) => n.getBoundingClientRect());
      // NOTHING HALF-COVERED: no visible tally line / podium row / summary box shares pixels with the parade
      const hit = (a, z) => Math.min(a.right, z.right) - Math.max(a.left, z.left) > 1 && Math.min(a.bottom, z.bottom) - Math.max(a.top, z.top) > 1;
      const others = [...c.querySelectorAll('.rs2-tally > *:not(.rp), .rs2-sum > *, .rs2-prow, .rs2-foot > *')].filter(vis);
      const covered = others.filter((o) => kids.some((k) => hit(o.getBoundingClientRect(), k))).map((o) => o.className);
      return {
        docScroll: document.documentElement.scrollHeight - innerHeight,
        docScrollX: document.documentElement.scrollWidth - innerWidth,
        cardScroll: c.scrollHeight - c.clientHeight,
        inCard: r.top >= card.top - 1 && r.bottom <= card.bottom + 1 && r.left >= card.left - 1 && r.right <= card.right + 1,
        clearOfFoot: kids.every((k) => k.bottom <= foot.top + 1),
        kidsInside: kids.every((k) => k.top >= r.top - 1 && k.bottom <= r.bottom + 1),
        rows: kids.length,
        covered,
        allSmall: [...c.querySelectorAll('*')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()))
          .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 11).map((el) => el.className || el.tagName),
        small,
        play: again.top >= 0 && again.bottom <= innerHeight,
      };
    });
    expect(m.docScroll, 'no page scroll').toBeLessThanOrEqual(0);
    expect(m.docScrollX, 'no sideways scroll').toBeLessThanOrEqual(0);
    expect(m.cardScroll, 'the card does not scroll').toBe(0);
    expect(m.inCard, 'the parade sits inside the card').toBe(true);
    expect(m.clearOfFoot, 'no parade row runs into the PLAY AGAIN footer').toBe(true);
    expect(m.kidsInside, 'no row spills out of the parade').toBe(true);
    expect(m.rows, 'at least the quests show').toBeGreaterThanOrEqual(2);
    expect(m.small, 'no parade text under 13 px').toEqual([]);
    expect(m.covered, 'nothing on the card is half-covered by the parade').toEqual([]);
    expect(m.allSmall, 'nothing on the card under 11 px').toEqual([]);
    expect(m.play, 'PLAY AGAIN on screen').toBe(true);
    // the quest list, from the nudge (or a quest row when the nudge did not fit)
    const nudge = page.getByTestId('parade-nudge');
    if (await nudge.count()) await nudge.click(); else await page.locator('.rp-row--quest').first().click();
    const sheet = page.getByTestId('quests-sheet');
    await expect(sheet).toBeVisible();
    await page.waitForTimeout(700); // the cards' one-shot rise
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/list-${vp.width}x${vp.height}.png` });
    const q = await page.evaluate(() => {
      const o = document.querySelector('[data-testid="quests-sheet"]');
      const vis = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().width > 0; };
      const small = [...o.querySelectorAll('*')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()))
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13).map((el) => el.className || el.tagName);
      const cards = [...o.querySelectorAll('.qs-card')].map((n) => n.getBoundingClientRect());
      const taps = [...o.querySelectorAll('button')].filter(vis).map((b) => b.getBoundingClientRect()).filter((b) => b.height < 44 || b.width < 44).length;
      return {
        scroll: o.scrollHeight - o.clientHeight,
        onScreen: cards.every((c) => c.top >= 0 && c.bottom <= innerHeight + 1 && c.left >= 0 && c.right <= innerWidth + 1),
        overflow: [...o.querySelectorAll('.qs-card')].filter((n) => n.scrollHeight > n.clientHeight + 1).length,
        small,
        taps,
      };
    });
    expect(q.scroll, 'the quest list does not scroll').toBeLessThanOrEqual(0);
    expect(q.onScreen, 'all four quest cards on screen').toBe(true);
    expect(q.overflow, 'no quest card overflows').toBe(0);
    expect(q.small, 'no quest-list text under 13 px').toEqual([]);
    expect(q.taps, 'every button at least 44 px').toBe(0);
  });
}

// ===== EVERY OTHER MODE (nov14): the same parade on each end screen, in the card's own column ===================
// A shared end-state check: the parade is up with its rows (+ the nudge), neither the card nor the page scrolls, nothing in
// the parade is under 11 px, it sits inside the card, the PLAY AGAIN of that mode is on screen, and the first tap skips.
async function paradeEndState(page, { card, again, w, h, tag }) {
  const rp = page.getByTestId('results-parade');
  await expect(rp).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(400);
  await page.locator(card).first().dispatchEvent('pointerdown'); // the first tap anywhere skips to the end state (a WINNER popup may sit over it)
  await expect(rp).toHaveAttribute('data-phase', 'done', { timeout: 6000 });
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${tag}-${w}x${h}.png` });
  const m = await page.evaluate(({ card, again }) => {
    const c = document.querySelector(card);
    const rp = document.querySelector('[data-testid="results-parade"]');
    const vis = (el) => { const cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && el.getBoundingClientRect().width > 0; };
    const de = document.scrollingElement;
    const cr = c.getBoundingClientRect();
    const pr = rp.getBoundingClientRect();
    const a = document.querySelector(again);
    const ar = a && a.getBoundingClientRect();
    const small = [...rp.querySelectorAll('*')].filter((el) => vis(el) && [...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()))
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 11).map((el) => el.className || el.tagName);
    const scrollers = [...document.querySelectorAll('body *')].filter((el) => {
      const cs = getComputedStyle(el);
      return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight - el.clientHeight > 2 && vis(el) && !el.matches('.sr-casefile, .sr-casefile *, .wr-standings, .mn-standings, .cb-scoreboard');
    }).map((el) => String(el.className).split(' ')[0]);
    return {
      doc: de.scrollHeight - innerHeight,
      scrollers,
      rows: rp.querySelectorAll('.rp-row').length,
      inCard: pr.top >= cr.top - 1 && pr.bottom <= cr.bottom + 1 && pr.left >= cr.left - 1 && pr.right <= cr.right + 1,
      small,
      again: !!ar && ar.top >= 0 && ar.bottom <= innerHeight + 1,
    };
  }, { card, again });
  expect(m.doc, `${tag}: no page scroll`).toBeLessThanOrEqual(1);
  expect(m.scrollers, `${tag}: nothing scrolls but a real list`).toEqual([]);
  expect(m.rows, `${tag}: the quest rows show`).toBeGreaterThanOrEqual(1);
  expect(m.inCard, `${tag}: the parade sits inside the end card`).toBe(true);
  expect(m.small, `${tag}: nothing in the parade under 11 px`).toEqual([]);
  expect(m.again, `${tag}: PLAY AGAIN on screen`).toBe(true);
}

const BL_QUESTS = JSON.stringify({
  v: 1, seed: 'e2e', day: DAY, week: '2026-11-09',
  picks: ['q-games3', 'q-bl-words', 'q-bl-win'], wpick: 'w-games25',
  prog: { 'q-games3': 1, 'q-bl-words': 4, 'w-games25': 7 }, seen: {}, done: [], paid: {}, pending: [], carry: [], rerolled: false, played: {}, hist: {},
});
const BL_ANSWERS = ['APPLE', 'PEAR', 'PLUM', 'KIWI', 'MANGO', 'LIME', 'FIG'];
for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  test(`CATEGORY BLITZ @${vp.width}x${vp.height}: the parade on the game-over card, the first tap skips, nothing scrolls`, async ({ page }) => {
    test.setTimeout(60_000);
    const mock = await boot(page, { vp, quests: BL_QUESTS });
    const ps = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
    mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players: ps } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } });
    await page.locator('.game-input').waitFor({ state: 'visible', timeout: 15000 });
    for (const a of BL_ANSWERS) { mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } }); await page.waitForTimeout(120); }
    mock.pushToClient({ type: 'game_over', payload: { winnerId: ME, finalScores: [{ id: ME, name: 'YOU', score: 70 }, { id: 'p2', name: 'RIVAL', score: 20 }] } });
    await paradeEndState(page, { card: '.game-over-overlay .game-over-card', again: '.game-over-rematch', w: vp.width, h: vp.height, tag: 'blitz' });
  });
}

const CH_QUESTS = JSON.stringify({
  v: 1, seed: 'e2e', day: DAY, week: '2026-11-09',
  picks: ['q-games3', 'q-ch-links', 'q-ch-run10'], wpick: 'w-games25',
  prog: { 'q-games3': 1, 'q-ch-links': 10, 'w-games25': 7 }, seen: {}, done: [], paid: {}, pending: [], carry: [], rerolled: false, played: {}, hist: {},
});
const CH_WORDS = fs.readFileSync('src/solo/words.accept.txt', 'utf8').split(/\s+/).filter((x) => /^[a-z]{4,9}$/.test(x)).slice(0, 20000);
for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  test(`CHAIN @${vp.width}x${vp.height}: the parade on the run-over card, the first tap skips, nothing scrolls`, async ({ page }) => {
    test.setTimeout(90_000);
    await boot(page, { vp, quests: CH_QUESTS });
    await page.addInitScript(() => { localStorage.setItem('taw.chain.runs', '5'); });
    await page.goto('/?chain=1&portal=1&season2=1&soloms=5000');
    const input = page.locator('.solo-input');
    await input.waitFor({ state: 'visible', timeout: 20000 });
    const used = new Set();
    for (let i = 0; i < 6; i++) {
      const raw = await page.evaluate(() => (document.querySelector('.solo-center .solo-cl') || {}).textContent || '');
      const need = raw.trim().toLowerCase().slice(0, 1);
      const pick = CH_WORDS.find((x) => !used.has(x) && x.startsWith(need));
      if (!pick) break;
      used.add(pick);
      await input.fill(pick);
      await input.press('Enter');
      await page.waitForTimeout(250);
    }
    await page.locator('.solo-deathcard').waitFor({ timeout: 30000 });
    await paradeEndState(page, { card: '.solo-deathcard', again: '.solo-restart', w: vp.width, h: vp.height, tag: 'chain' });
  });
}
