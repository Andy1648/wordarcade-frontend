// e2e/game-xp.spec.js — GAME XP on the end cards (Andy oct21: "fine with games giving xp … it'd prob go under wins …
// it shouldnt look crazy (like the errors you did before with size and readability)").
// Season 2, a save at R3 · POWER T5 (864 XP a menu key). Real accepted words, then the end card at four sizes:
//   * Word Bomb — the results card's XP block shows a positive count and does not overlap the WINS block;
//   * Category Blitz — the "+N XP" pill sits in the earned row beside WINS + GEMS, one line, no clipped text;
//   * CHAIN — the "+N XP" pill sits directly under the WINS EARNED total;
//   * WORD RACE — the "+N XP" pill sits directly under the "YOU BANKED +N WINS" line.
// Every card: no horizontal page overflow, no XP text wider than its box.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, revealMode } from './support/menu.js';

const ME = 'e2e-player'; // the mock socket's own id (support/backendMock)
const SIZES = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x640', width: 360, height: 640 },
];
const SHOTS = process.env.GAME_XP_SHOTS || '';

async function seedS2(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('gx.seeded')) return;
    sessionStorage.setItem('gx.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.econ', '12');
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 80, f: 0.995, rc: 3, v: 10 }));
    localStorage.setItem('taw.s2.rebirths', '3');
    localStorage.setItem('taw.s2.keytier', '5');
    localStorage.setItem('taw.mastery', JSON.stringify({ 'word-bomb': 30 }));
  });
}

async function bootRoomS2(page, gameType, players) {
  const mock = await installBackendMock(page);
  await seedS2(page);
  await page.goto('/?portal=1&season2=1'); // the URL wins over backendMock's season-2 off switch
  await menuReady(page);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType, hostId: ME, difficultyKey: 'chill', players } });
  return mock;
}

/** No horizontal page overflow; every XP text box fits its own width. */
async function assertClean(page, label) {
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const xp = [...document.querySelectorAll('[data-testid="xp-earned"], .rs2-xp')];
    const clipped = xp.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.className);
    return { overflow: doc.scrollWidth - doc.clientWidth, clipped };
  });
  expect(r.overflow, `${label}: page scrolls sideways`).toBeLessThanOrEqual(1);
  expect(r.clipped, `${label}: XP text wider than its box`).toEqual([]);
}
const box = (page, sel) => page.locator(sel).first().boundingBox();
const overlaps = (a, b) => a && b && a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

for (const vp of SIZES) {
  test.describe(`game XP @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Word Bomb: the results card shows the game XP, clear of the WINS block', async ({ page }) => {
      const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 3 }];
      const mock = await bootRoomS2(page, 'word-bomb', players);
      mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
      await page.waitForTimeout(80);
      mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'an', usedWords: [], timerSeconds: 30, maxLives: 3 } });
      await page.waitForTimeout(4700); // the intro countdown
      // type + submit the way a player does (the "this result is mine" gate), then confirm it from the "server"
      const input = page.locator('.game-input');
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/wb-ingame-${vp.name}.png` });
      for (const word of ['planet', 'banana', 'canyon', 'lantern', 'meaning', 'pianist']) {
        await input.fill(word);
        await input.press('Enter');
        mock.pushToClient({ type: 'word_result', payload: { playerId: ME, word, valid: true, accepted: true } });
        await page.waitForTimeout(160);
      }
      mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: 'p2', players: [players[0], { ...players[1], lives: 0 }], combo: 'an', usedWords: [], timerSeconds: 30, maxLives: 3 } });
      await page.waitForTimeout(120);
      mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
      const xp = page.locator('.rs2-xp');
      await expect(xp).toBeVisible({ timeout: 8000 });
      await page.waitForTimeout(3600); // the tally's count-up lands
      const n = await page.locator('.rs2-xp-n').first().textContent();
      expect(n, 'a positive XP count').toMatch(/^\+[1-9]/);
      expect(overlaps(await box(page, '.rs2-xp'), await box(page, '.rs2-wins')), 'XP block overlaps the WINS block').toBeFalsy();
      await assertClean(page, 'word bomb');
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/wb-${vp.name}.png` });
    });

    test('Category Blitz: "+N XP" rides the earned row beside WINS and GEMS', async ({ page }) => {
      const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
      const mock = await bootRoomS2(page, 'category-blitz', players);
      mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
      await page.waitForTimeout(80);
      mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } });
      await page.locator('.game-wrap').waitFor({ state: 'visible' });
      await page.waitForTimeout(4700); // the intro countdown — a real answer can't land before the game screen is up
      for (const answer of ['APPLE', 'PEAR', 'PLUM', 'MANGO', 'GUAVA']) {
        mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer } });
        await page.waitForTimeout(60);
      }
      mock.pushToClient({ type: 'game_over', payload: { winnerId: ME, finalScores: [{ id: ME, name: 'YOU', score: 50 }, { id: 'p2', name: 'RIVAL', score: 10 }] } });
      await expect(page.locator('.game-over-overlay')).toBeVisible();
      await page.waitForTimeout(2500); // the RESULTS wipe + the card's arrival settle before anything is measured
      const line = page.locator('.go-earned-row [data-testid="xp-earned"]');
      await expect(line).toBeVisible();
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/blitz-${vp.name}.png` });
      expect(Number(await line.getAttribute('data-xp-total')), 'a positive XP total').toBeGreaterThan(0);
      // nothing in the earned row sits on anything else, and the row stays clear of the scoreboard below it
      // LAYOUT boxes (offsetLeft/Top summed up to the overlay), not getBoundingClientRect: the card is tilted a couple of
      // degrees, and a tilted box's bounding rect grows enough to make two pills 6px apart read as overlapping
      const kids = await page.locator('.go-earned-row > *, .go-earned-side > *').evaluateAll((els) => els.map((e) => {
        let x = 0, y = 0, n = e;
        while (n && !n.classList.contains('game-over-overlay')) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
        return { x, y, width: e.offsetWidth, height: e.offsetHeight };
      }));
      const side = kids.length; // .go-earned-side holds two of them, so compare only leaf boxes
      for (let i = 0; i < side; i++) for (let j = i + 1; j < side; j++) {
        const a = kids[i], b = kids[j];
        const nested = a.x <= b.x && a.y <= b.y && a.x + a.width >= b.x + b.width && a.y + a.height >= b.y + b.height
          || b.x <= a.x && b.y <= a.y && b.x + b.width >= a.x + a.width && b.y + b.height >= a.y + a.height;
        if (!nested) expect(overlaps(a, b), `earned-row items ${i} and ${j} overlap`).toBeFalsy();
      }
      const [row, next] = await page.locator('.go-earned-row').evaluate((el) => {
        const lay = (e) => { let x = 0, y = 0, n = e; while (n && !n.classList.contains('game-over-overlay')) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; } return { x, y, width: e.offsetWidth, height: e.offsetHeight }; };
        let n = el.nextElementSibling;
        while (n && !n.offsetHeight) n = n.nextElementSibling;
        return [lay(el), n ? lay(n) : null];
      });
      expect(overlaps(row, next), `the earned row runs into the block below it (${JSON.stringify([row, next])})`).toBeFalsy();
      await assertClean(page, 'blitz');
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/blitz-${vp.name}.png` });
    });

    test('CHAIN: "+N XP" sits directly under the WINS EARNED total', async ({ page }) => {
      test.setTimeout(60_000);
      await installBackendMock(page);
      await seedS2(page);
      await page.addInitScript(() => { try { localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 80, f: 0.995, rc: 3, v: 10 })); } catch { /* */ } });
      await page.goto('/?portal=1&season2=1&soloms=350');
      await menuReady(page);
      await page.waitForTimeout(400);
      await (await revealMode(page, 'chain')).click({ force: true });
      await page.locator('.mode-dialog-btn-create').click();
      await page.locator('.solo-root:not(.is-loadstate)').waitFor({ state: 'visible' });
      const got = page.getByRole('button', { name: 'GOT IT' });
      if (await got.count()) await got.first().click().catch(() => {});
      const input = page.locator('.solo-root input').first();
      const WORDS = { a: 'anchor', b: 'basket', c: 'candle', d: 'dragon', e: 'eagle', f: 'forest', g: 'garden', h: 'hammer', i: 'island', j: 'jacket', k: 'kettle', l: 'ladder', m: 'market', n: 'needle', o: 'orange', p: 'pepper', q: 'quiet', r: 'rabbit', s: 'silver', t: 'tiger', u: 'uncle', v: 'velvet', w: 'window', x: 'xenon', y: 'yellow', z: 'zebra' };
      const ALT = { a: 'arrow', b: 'bottle', c: 'carpet', d: 'donkey', e: 'engine', f: 'falcon', g: 'guitar', h: 'harbor', i: 'insect', j: 'jungle', k: 'kitten', l: 'lemon', m: 'meadow', n: 'napkin', o: 'oyster', p: 'pillow', q: 'queen', r: 'river', s: 'spider', t: 'tunnel', u: 'upper', v: 'valley', w: 'walrus', x: 'xylem', y: 'yogurt', z: 'zipper' };
      const used = new Set();
      for (let i = 0; i < 5; i++) {
        if (await page.locator('.solo-deathcard').isVisible()) break;
        const letter = await page.evaluate(() => { const m = document.body.innerText.match(/\n([A-Z])\n\1\n\1\n/); return m ? m[1].toLowerCase() : null; });
        if (!letter) break;
        const word = used.has(WORDS[letter]) ? ALT[letter] : WORDS[letter];
        used.add(word);
        const ok = await input.fill(word, { timeout: 2000 }).then(() => input.press('Enter', { timeout: 2000 })).then(() => true, () => false);
        if (!ok) break;
        await page.waitForTimeout(250);
      }
      await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 30_000 });
      await page.waitForTimeout(600);
      const line = page.locator('.solo-deathcard [data-testid="xp-earned"]');
      await expect(line).toBeVisible();
      expect(Number(await line.getAttribute('data-xp-total')), 'a positive XP total').toBeGreaterThan(0);
      // directly under the wins total: when the run banked wins, the XP pill is the next element after .wins-earned
      const order = await page.evaluate(() => {
        const x = document.querySelector('.solo-deathcard [data-testid="xp-earned"]');
        const prev = x && x.previousElementSibling;
        return { prev: prev ? prev.className : '', wins: !!document.querySelector('.solo-deathcard .wins-earned') };
      });
      if (order.wins) {
        expect(order.prev, 'the XP line follows the WINS EARNED total').toContain('wins-earned');
        expect(overlaps(await box(page, '.solo-deathcard [data-testid="xp-earned"]'), await box(page, '.solo-deathcard .wins-earned')), 'XP pill overlaps the wins total').toBeFalsy();
      }
      await assertClean(page, 'chain');
      if (SHOTS) {
        await line.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${SHOTS}/chain-${vp.name}.png` });
      }
    });

    test('WORD RACE: "+N XP" sits directly under the banked-wins line', async ({ page }) => {
      const mock = await installBackendMock(page);
      await seedS2(page);
      await page.goto('/?portal=1&race=1&season2=1');
      await menuReady(page);
      const racers = [{ id: ME, name: 'YOU' }, { id: 'b1', name: 'BOT', isBot: true }];
      mock.pushToClient({ type: 'room_update', payload: { code: 'RACE1', gameType: 'word-race', hostId: ME, difficultyKey: 'chill', players: racers.map((r, i) => ({ ...r, isHost: i === 0 })) } });
      await page.locator('.wr-lobby').waitFor({ state: 'visible' });
      const words = ['planet', 'rocket', 'silver', 'garden', 'window', 'pepper', 'meadow', 'harbor', 'jungle', 'kitten', 'ladder', 'walrus'];
      mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-race' } });
      const now = Date.now();
      mock.pushToClient({ type: 'race_start', payload: { seed: 11, variant: 'words', words, target: words.length, capMs: 60000, racers, serverNow: now, goAt: now + 50 } });
      mock.pushToClient({ type: 'race_go', payload: { serverNow: now, goAt: now + 50, endsAt: now + 60000 } });
      await page.locator('.wr-root[data-race-status="racing"]').waitFor({ state: 'visible' });
      for (const word of words.slice(0, 6)) {
        mock.pushToClient({ type: 'race_word_result', payload: { playerId: ME, word, accepted: true } });
        await page.waitForTimeout(80);
      }
      mock.pushToClient({ type: 'race_over', payload: { winnerId: 'b1', reason: 'finish', standings: [
        { id: ME, name: 'YOU', words: 6, reachedAt: 40000, place: 2 },
        { id: 'b1', name: 'BOT', isBot: true, words: 12, reachedAt: 38000, place: 1 },
      ] } });
      await expect(page.locator('.wr-over')).toBeVisible();
      await page.waitForTimeout(800);
      const line = page.locator('.wr-over [data-testid="xp-earned"]');
      await expect(line).toBeVisible();
      if (SHOTS) { await line.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${SHOTS}/race-${vp.name}.png` }); }
      expect(Number(await line.getAttribute('data-xp-total')), 'a positive XP total').toBeGreaterThan(0);
      const prev = await line.evaluate((el) => (el.previousElementSibling ? el.previousElementSibling.className : ''));
      expect(prev, 'the XP line follows the banked-wins line').toContain('wr-earn-final');
      expect(overlaps(await box(page, '.wr-over [data-testid="xp-earned"]'), await box(page, '.wr-earn-final')), 'XP pill overlaps the wins line').toBeFalsy();
      await assertClean(page, 'race');
    });
  });
}
