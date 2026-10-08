// WORD RACE screenshots through the e2e backend mock: lobby, mid-race (3 racers, progress), the finish, the results.
//   SIZES='1366x657 390x844' TAG=race node tools/_shots/race.mjs
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const out = process.env.OUT || 'claude/night-oct8-r3/_raw'; fs.mkdirSync(out, { recursive: true });
const tag = process.env.TAG || 'race';
const sizes = (process.env.SIZES || '1366x657 390x844').split(' ').map((s) => s.split('x').map(Number));
const ME = 'e2e-player';
const racers = [{ id: ME, name: 'YOU' }, { id: 'b1', name: 'XAVIER', isBot: true }, { id: 'b2', name: 'PRIYA_K' }];
const WORDS = 'station planet rocket silver copper magnet velvet marble tunnel basket candle button garden helmet jacket kettle ladder mirror needle orange pepper quartz ribbon saddle ticket'.split(' ');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: process.env.MOTION ? 'no-preference' : 'reduce' });
  const page = await ctx.newPage();
  const mock = await installBackendMock(page, { seedReduceMotion: !process.env.MOTION });
  await page.addInitScript(() => { try { localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.xp', JSON.stringify({ lv: 12, into: 0 })); } catch { /* */ } });
  await page.goto('http://localhost:4173/?portal=1&race=1&season2=1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  mock.pushToClient({ type: 'room_update', payload: { code: 'RACE1', gameType: 'word-race', hostId: ME, difficultyKey: 'chill', players: racers.map((r, i) => ({ ...r, isHost: i === 0 })) } });
  await page.locator('.wr-lobby').waitFor({ state: 'visible', timeout: 10000 }).catch(() => console.log('no lobby'));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${tag}-lobby-${w}x${h}.png` });
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-race' } });
  const now = Date.now(); const target = 25;
  mock.pushToClient({ type: 'race_start', payload: { seed: 11, variant: 'words', words: WORDS, target, capMs: 60000, racers, serverNow: now, goAt: now + 50 } });
  mock.pushToClient({ type: 'race_go', payload: { serverNow: now, goAt: now + 50, endsAt: now + 60000 } });
  await page.locator('.wr-root[data-race-status="racing"]').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  // mid race: I'm at 9, XAVIER 14, PRIYA 6; type a partial word
  for (let i = 1; i <= 9; i++) mock.pushToClient({ type: 'race_progress', payload: { racerId: ME, index: i, word: WORDS[i - 1] } });
  for (let i = 1; i <= 14; i++) mock.pushToClient({ type: 'race_progress', payload: { racerId: 'b1', index: i, word: WORDS[i - 1] } });
  for (let i = 1; i <= 6; i++) mock.pushToClient({ type: 'race_progress', payload: { racerId: 'b2', index: i, word: WORDS[i - 1] } });
  mock.pushToClient({ type: 'race_word_result', payload: { accepted: true, word: WORDS[8], index: 9, racerId: ME } });
  await page.waitForTimeout(400);
  const input = page.locator('.wr-input'); if (await input.count()) { await input.fill(WORDS[9].slice(0, 3)); }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${tag}-racing-${w}x${h}.png` });
  const audit = await page.evaluate(() => {
    const small = []; const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT); let el;
    while ((el = walker.nextNode())) { if (!el.checkVisibility || !el.checkVisibility()) continue; const t = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(''); if (!t) continue; const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 14) small.push(`${fs}px "${t.slice(0, 20)}" .${[...el.classList].slice(0, 2).join('.')}`); }
    const sz = (s) => { const e = document.querySelector(s); return e ? `${s}=${getComputedStyle(e).fontSize}` : `${s}=none`; };
    return { small: [...new Set(small)].slice(0, 15), sizes: ['.wr-clock', '.wr-lane-count', '.wr-lane-name-txt', '.wr-typeword', '.wr-hero-word', '.wr-up', '.wr-earn', '.wr-chip', '.wr-toast'].map(sz).join(' ') };
  });
  console.log(`${w}x${h}`, audit.sizes); if (audit.small.length) console.log('  SMALL:', audit.small.join(' | '));
  // finish
  for (let i = 10; i <= target; i++) mock.pushToClient({ type: 'race_progress', payload: { racerId: ME, index: i, word: WORDS[i - 1] } });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${tag}-finished-${w}x${h}.png` });
  mock.pushToClient({ type: 'race_over', payload: { winnerId: ME, reason: 'finish', standings: [
    { id: ME, name: 'YOU', words: 25, reachedAt: 38000, place: 1 }, { id: 'b1', name: 'XAVIER', isBot: true, words: 21, reachedAt: 50000, place: 2 }, { id: 'b2', name: 'PRIYA_K', words: 12, reachedAt: 60000, place: 3 } ] } });
  await page.locator('.wr-over').waitFor({ state: 'visible', timeout: 8000 }).catch(() => console.log('no over'));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${tag}-over-${w}x${h}.png` });
  await ctx.close();
}
await browser.close();
