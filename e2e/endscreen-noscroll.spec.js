// e2e/endscreen-noscroll.spec.js — NO END SCREEN SCROLLS (Andy oct19: "fuse end screen requires
// scrolling — i had 4 clutches which made screen expand" → "i dont want any scroll screens on any end
// screen (ensure that doesnt happen)").
//
// WHY A SEPARATE GATE. viewport-integrity already lists gameover-fuse in NOSCROLL, and it passed the
// whole time FUSE scrolled — because its nav types one letter and dies on the FIRST-RUN tutorial card
// (0 words, no receipt, no score line, no try row). A no-scroll gate is only as good as the content it
// drives, so every screen here is driven to its WORST realistic case: real clutches, a long chain, a
// full 8-seat room, a run long enough to fill the case file.
//
// THE ASSERTION: nothing on the page scrolls. Not the document, and not any element that clips with
// overflow auto/scroll and has more content than box — that is a scrollbar, wherever it sits.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { menuReady, revealMode, satSetupGo } from './support/menu.js';

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1280, height: 551 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
];
const TOL = 2;
const ME = 'e2e-player';

// Words that the FUSE engine accepts: the recall list it draws from.
const RECALL = readFileSync(new URL('../src/solo/words.recall.txt', import.meta.url), 'utf8')
  .split(/\s+/).filter((w) => w.length >= 4 && /^[a-z]+$/.test(w));

const SEEN = { 'taw.seenMenu': '1', 'taw.seenMenuSpotlight': '1', 'taw.seenGameSpotlight': '1', 'wa_has_played': '1' };
async function seed(page, extra = {}) {
  await page.addInitScript((kv) => {
    try { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); } catch { /* blocked */ }
  }, { ...SEEN, ...extra });
}

/** The current hero fragment / letter, de-duplicated (the hero paints its text in stacked layers). */
async function heroText(page) {
  const raw = (await page.locator('.solo-center').first().innerText({ timeout: 2000 })).toLowerCase().replace(/[^a-z]/g, '');
  for (let L = 1; L <= raw.length; L++) {
    if (raw.length % L === 0 && raw.slice(0, L).repeat(raw.length / L) === raw) return raw.slice(0, L);
  }
  return raw;
}

async function solo(page, mode, soloms) {
  await installBackendMock(page);
  await seed(page, { 'taw.xp': JSON.stringify({ lv: 100, into: 0 }), [`taw.${mode}.runs`]: '5', [`taw.seenTeach.${mode}`]: '1' });
  await page.goto(`/${mode}/play?portal=1&soloms=${soloms}`);
  await page.locator('.solo-root:not(.is-loadstate)').waitFor({ state: 'visible', timeout: 30000 });
}

// CHAIN: openers that end in E, then E-words that end in E — a deterministic long chain.
const OPENER_WORD = {
  a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future', g: 'generate', h: 'handle',
  i: 'include', l: 'large', m: 'manage', n: 'notice', o: 'office', p: 'people', r: 'remove', s: 'service',
  t: 'there', w: 'where',
};
const E_WORDS = ['estate', 'elite', 'escape', 'expense', 'example', 'everyone', 'evidence', 'exchange', 'engage', 'empire', 'enforce', 'endure'];

async function wbRoom(page, gameType, n) {
  const mock = await installBackendMock(page);
  await seed(page);
  await page.goto('/?portal=1');
  await menuReady(page);
  const NAMES = ['YOU', 'RIVAL', 'KIMBERLY', 'SAMWISE', 'LEXICOGRAPHER', 'ZZZAP', 'MAXIMILIANA', 'OTTO'];
  const players = NAMES.slice(0, n).map((name, i) => ({ id: i ? `p${i + 1}` : ME, name, lives: 3, isHost: i === 0 }));
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType, hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType } });
  await page.waitForTimeout(80);
  return { mock, players };
}

const WB_WORDS = ['STRAND', 'INSTRUCT', 'STRONGEST', 'ASTRAY', 'DESTROY', 'STRIPE', 'CONSTRUCT', 'STRESS', 'STRAW', 'STREAM', 'MISTRUST', 'STRUT', 'STRIKE', 'STRING', 'STROLL', 'STRUCK', 'STRAIN', 'STRANGE'];

const CB_CATS = ["THINGS IN A LIGHTHOUSE KEEPER'S POCKET", 'EXTINCT UNITS OF MEASUREMENT', 'FAMOUS SHIPWRECKS OF THE NORTH SEA'];
async function blitzRounds(page, mock, players) {
  for (let r = 1; r <= 3; r++) {
    mock.pushToClient({ type: 'round_start', payload: { round: r, timerSeconds: 60, category: CB_CATS[r - 1], categoryId: `cat${r}`, rerollsRemaining: 1 } });
    await page.waitForTimeout(80);
    mock.pushToClient({ type: 'round_end', payload: { round: r, category: CB_CATS[r - 1], sampleAnswers: ['SEXTANT', 'FATHOM'], playerResults: players.map((p, i) => ({ id: p.id, name: p.name, roundScore: 30 - i * 2, answers: [] })) } });
    await page.waitForTimeout(120);
  }
}

const racers = [
  { id: ME, name: 'YOU' }, { id: 'p2', name: 'RIVAL' }, { id: 'p3', name: 'KIMBERLY' }, { id: 'p4', name: 'SAMWISE' },
  { id: 'p5', name: 'LEXICOGRAPHER' }, { id: 'p6', name: 'ZZZAP' }, { id: 'p7', name: 'MAXIMILIANA' }, { id: 'b1', name: 'BOT', isBot: true },
];

const SCREENS = [
  {
    // FUSE with REAL clutches: a 1.5 s fuse means every accepted word lands with ≤ 2 s left (CLUTCH_MS).
    name: 'fuse-8-clutches',
    nav: async (page) => {
      // A 1.9 s fuse: under the 2 s CLUTCH_MS, so every accepted word is a clutch. Under a loaded
      // runner the fuse can still burn out before the words land — then the run is played again.
      for (let attempt = 0; attempt < 3; attempt++) {
        await solo(page, 'fuse', 1900);
        const used = new Set();
        for (let i = 0; i < 8; i++) {
          if (await page.locator('.solo-deathcard').isVisible()) break;
          const frag = await heroText(page).catch(() => '');
          const word = RECALL.find((x) => x.includes(frag) && x !== frag && !used.has(x));
          if (!word) break;
          used.add(word);
          await page.locator('.solo-input').fill(word, { timeout: 1000 }).catch(() => {});
          await page.keyboard.press('Enter');
          await page.waitForTimeout(100);
        }
        await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 20000 });
        if (await page.locator('[data-wins-line^="CLUTCH"]').count()) return;
      }
      throw new Error('FUSE: no run banked a CLUTCH line in 3 attempts');
    },
  },
  {
    name: 'chain-long',
    nav: async (page) => {
      await solo(page, 'chain', 4000);
      const first = await heroText(page);
      for (const word of [OPENER_WORD[first[0]], ...E_WORDS]) {
        await page.locator('.solo-input').fill(word);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
      }
      await page.locator('.solo-deathcard').waitFor({ state: 'visible', timeout: 20000 });
    },
  },
  {
    // A full 8-seat Word Bomb room, knocked out #3 (the loss card carries the missed word too).
    name: 'word-bomb-8',
    nav: async (page) => {
      const { mock, players } = await wbRoom(page, 'word-bomb', 8);
      let k = 0;
      for (let round = 0; round < 2; round += 1) {
        for (const p of players) {
          mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: p.id, players, combo: 'str', timerSeconds: 22, maxLives: 3, round: 1, difficultyKey: 'chill', usedWords: [], usedAnswers: [] } });
          await page.waitForTimeout(30);
          mock.pushToClient({ type: 'word_result', payload: { accepted: true, word: WB_WORDS[k % WB_WORDS.length], playerId: p.id } });
          k += 1;
          await page.waitForTimeout(40);
        }
      }
      const order = ['p8', 'p7', 'p6', 'p5', 'p4', ME, 'p3'];
      const dead = new Set();
      for (const id of order) {
        dead.add(id);
        const cur = players.map((p) => ({ ...p, lives: dead.has(p.id) ? 0 : p.lives }));
        mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: players.find((p) => !dead.has(p.id)).id, players: cur, combo: 'ing', timerSeconds: 22, usedWords: [] } });
        await page.waitForTimeout(100);
      }
      mock.pushToClient({ type: 'game_over', payload: { winnerId: 'p2' } });
      await page.locator('.game-over-overlay').waitFor({ state: 'visible' });
      await page.locator('.rs2[data-tally="done"]').waitFor({ timeout: 15000 }).catch(() => {});
    },
  },
  {
    name: 'category-blitz-8',
    nav: async (page) => {
      const { mock, players } = await wbRoom(page, 'category-blitz', 8);
      await blitzRounds(page, mock, players);
      mock.pushToClient({ type: 'game_over', payload: { winnerId: 'p2', finalScores: players.map((p, i) => ({ id: p.id, name: p.name, score: 90 - i * 7 })) } });
      await page.locator('.game-over-overlay .cb-go-card').waitFor({ state: 'visible' });
    },
  },
  {
    // SOLO Blitz (a room of one): the personal-best card with its per-round breakdown.
    name: 'category-blitz-solo',
    nav: async (page) => {
      const { mock, players } = await wbRoom(page, 'category-blitz', 1);
      await blitzRounds(page, mock, players);
      mock.pushToClient({ type: 'game_over', payload: { winnerId: ME, finalScores: [{ id: ME, name: 'YOU', score: 42 }] } });
      await page.locator('.game-over-overlay .solo-results-card').waitFor({ state: 'visible' });
      await page.waitForTimeout(2500); // the record celebration staggers its stat lines in
    },
  },
  {
    // SAT Rush LINEUP run to the end: every word given up, so the case file lists the whole run.
    name: 'sat-results',
    nav: async (page) => {
      await installBackendMock(page);
      await seed(page, { 'taw.xp': JSON.stringify({ lv: 40, into: 0 }) });
      await page.goto('/?satRush=1&portal=1');
      await menuReady(page);
      await (await revealMode(page, 'sat-rush')).click({ force: true });
      await page.getByRole('button', { name: /LINEUP/ }).click();
      await satSetupGo(page);
      await page.locator('.sr-lineup').waitFor({ state: 'visible', timeout: 20000 });
      await expect.poll(async () => {
        if (await page.locator('.sr-respage').isVisible()) return true;
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        await page.keyboard.press('x');
        await page.waitForTimeout(200);
        return page.locator('.sr-respage').isVisible();
      }, { timeout: 60000, intervals: [250] }).toBe(true);
    },
  },
  {
    // SAT Rush BRIEFING, 15 words, every one CAPTURED (typed from the study cards): a case file long
    // enough to fill a whole page of chips at every size, plus a pager.
    name: 'sat-results-15',
    nav: async (page) => {
      await installBackendMock(page);
      await seed(page, { 'taw.xp': JSON.stringify({ lv: 40, into: 0 }) });
      await page.goto('/?satRush=1&portal=1');
      await menuReady(page);
      await (await revealMode(page, 'sat-rush')).click({ force: true });
      await page.getByRole('button', { name: /BRIEFING/ }).click();
      await page.locator('.sr-setup').waitFor({ state: 'visible' });
      await page.getByRole('radio', { name: '15', exact: true }).click();
      await satSetupGo(page);
      await page.locator('.sr-brief-page').waitFor({ state: 'visible' });
      const ctx = (loc, inner) => loc.evaluate((el, sel) => {
        const i = el.querySelector(sel);
        return el.textContent.replace(i ? i.textContent : '', '').replace(/\s+/g, ' ').trim();
      }, inner);
      const briefed = [];
      const cards = page.locator('.sr-brief-card .sr-brief-sentence');
      for (let i = 0; i < await cards.count(); i++) {
        const sen = cards.nth(i);
        briefed.push({ word: (await sen.locator('.sr-brief-fill').innerText()).trim().toLowerCase(), context: await ctx(sen, '.sr-brief-fill') });
      }
      await page.getByRole('button', { name: 'Start the run' }).click();
      let last = '';
      await expect.poll(async () => {
        if (await page.locator('.sr-respage').isVisible()) return true;
        const sen = page.locator('.sr-sentence');
        if (await sen.isVisible()) {
          const c = await ctx(sen, '.sr-blank').catch(() => '');
          const hit = briefed.find((b) => b.context === c);
          if (hit && c !== last) { last = c; await page.keyboard.type(hit.word, { delay: 10 }); }
          else if (!hit) { await page.keyboard.press('Escape'); }
        }
        await page.keyboard.press('x'); // skips a teaching beat; never a letter of the next word (x-words are rare)
        await page.waitForTimeout(200);
        return page.locator('.sr-respage').isVisible();
      }, { timeout: 100000, intervals: [250] }).toBe(true);
      expect(await page.locator('.sr-casefile-chip').count()).toBeGreaterThanOrEqual(4);
    },
  },
  {
    // FRENCH RUSH (the same results component in its study-pack voice: no economy, COPY MY RESULTS,
    // say-it buttons in the case file). TIMED pace so a word can be given up.
    name: 'french-results',
    nav: async (page) => {
      await installBackendMock(page);
      await page.goto('/french-rush');
      await page.getByRole('button', { name: 'Play' }).click();
      await page.getByRole('button', { name: /QUIZ/ }).click();
      await page.locator('.sr-setup').waitFor({ state: 'visible' });
      await page.getByRole('radio', { name: /TIMED/ }).click();
      await page.getByRole('button', { name: /^Start$/ }).click();
      await expect.poll(async () => {
        if (await page.locator('.sr-respage').isVisible()) return true;
        const cont = page.getByRole('button', { name: /Continue/ });
        if (await cont.isVisible()) await cont.click();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
        return page.locator('.sr-respage').isVisible();
      }, { timeout: 90000, intervals: [250] }).toBe(true);
    },
  },
  {
    name: 'race-results-8',
    nav: async (page) => {
      const mock = await installBackendMock(page);
      await seed(page);
      await page.goto('/?portal=1&race=1');
      await menuReady(page);
      mock.pushToClient({ type: 'room_update', payload: { code: 'RACE1', gameType: 'word-race', hostId: ME, difficultyKey: 'chill', players: racers.map((r, i) => ({ ...r, isHost: i === 0 })) } });
      await page.locator('.wr-lobby').waitFor({ state: 'visible' });
      mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-race' } });
      const now = Date.now();
      mock.pushToClient({ type: 'race_start', payload: { seed: 7, fragments: ['str', 'ing', 'ion', 'ent', 'ter', 'and', 'ous', 'con', 'pre', 'est', 'ble', 'ate'], target: 12, capMs: 90000, racers, serverNow: now, goAt: now + 50 } });
      mock.pushToClient({ type: 'race_go', payload: { serverNow: now, goAt: now + 50, endsAt: now + 90000 } });
      await page.locator('.wr-root[data-race-status="racing"]').waitFor({ state: 'visible' });
      mock.pushToClient({ type: 'race_over', payload: { winnerId: 'p2', reason: 'target', standings: [racers[1], racers[0], ...racers.slice(2)].map((r, i) => ({ id: r.id, name: r.name, isBot: r.isBot, place: i + 1, words: 12 - i, ...(i === 0 ? { reachedAt: 41000 } : {}) })) } });
      await page.locator('.wr-over').waitFor({ state: 'visible' });
    },
  },
];

/** Every way the page can scroll right now. Empty = nothing scrolls. */
async function scrollers(page) {
  return page.evaluate((TOL) => {
    const out = [];
    const de = document.documentElement;
    const se = document.scrollingElement || de;
    if (se.scrollHeight > se.clientHeight + TOL) out.push(`DOCUMENT ${se.scrollHeight}/${se.clientHeight}`);
    if (se.scrollWidth > se.clientWidth + TOL) out.push(`DOCUMENT-X ${se.scrollWidth}/${se.clientWidth}`);
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const y = /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + TOL;
      const x = /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + TOL;
      if (y || x) {
        const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
        out.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} ${y ? `y ${el.scrollHeight}/${el.clientHeight}` : ''}${x ? ` x ${el.scrollWidth}/${el.clientWidth}` : ''}`);
      }
    }
    return out;
  }, TOL);
}

for (const screen of SCREENS) {
  for (const vp of VIEWPORTS) {
    test(`${screen.name} @${vp.width}x${vp.height}: the end screen does not scroll`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(vp);
      await screen.nav(page);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(1200); // entrances + count-ups settle (the receipt grows as it reveals)
      const s = await scrollers(page);
      await page.screenshot({ path: test.info().outputPath(`${screen.name}-${vp.width}x${vp.height}.png`) });
      expect(s, `${screen.name} @${vp.width}x${vp.height} scrolls`).toEqual([]);
    });
  }
}
