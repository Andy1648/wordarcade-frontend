// s2results.mjs — screenshot the RESULTS / K.O. card after a real 6-seat Word Bomb round on the backend mock (the
// e2e/v2-results.spec.js drive), season 2 on. Env: OUT, TAG, SIZES ("1366x657 390x844"), OUTCOME win|loss, PLACE (loss),
// JPG=1, SEEDJSON ('{"taw.s2.wins":"500"}'), REB (season-2 rebirths, default 0), KEYT (key tier, default 0).
// Reduced motion → every line is final on the first frame. Prints an overflow / <14px audit for the card.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import { menuReady } from '../../e2e/support/menu.js';

const out = process.env.OUT || 'shots';
fs.mkdirSync(out, { recursive: true });
const sizes = (process.env.SIZES || '1366x657 390x844').split(' ').map((s) => s.split('x').map(Number));
const outcome = process.env.OUTCOME || 'win';
const place = Number(process.env.PLACE || 3);
const ME = 'e2e-player';
const NAMES = ['YOU', 'RIVAL', 'KIMBERLY', 'SAMWISE', 'LEXI', 'ZZZAP'];
const WORDS = ['STRAND', 'INSTRUCT', 'STRONGEST', 'ASTRAY', 'DESTROY', 'STRIPE', 'CONSTRUCT', 'STRESS', 'STRAW', 'STREAM', 'MISTRUST', 'STRUT', 'STRIKE', 'STRING', 'STROLL', 'STRUCK', 'STRAIN', 'STRANGE'];
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ baseURL: process.env.BASE || 'http://localhost:4173', viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const mock = await installBackendMock(page);
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.continue());
  const seed = { reb: process.env.REB || '0', keyt: process.env.KEYT || '0', extra: process.env.SEEDJSON ? JSON.parse(process.env.SEEDJSON) : {} };
  await page.addInitScript((s) => {
    if (sessionStorage.getItem('rs.seeded')) return;
    sessionStorage.setItem('rs.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.seenGameSpotlight', '1');
    localStorage.setItem('taw.reduceMotion', '1');
    localStorage.setItem('taw.s2.wins', '500');
    localStorage.setItem('taw.s2.rebirths', s.reb);
    localStorage.setItem('taw.s2.xp', JSON.stringify({ lv: 6, f: 0.4, rc: Number(s.reb), v: 10 }));
    localStorage.setItem('taw.s2.keytier', s.keyt);
    localStorage.setItem('taw.s2.gems', JSON.stringify({ bal: 40 }));
    for (const [k, v] of Object.entries(s.extra || {})) localStorage.setItem(k, v);
  }, seed);
  await page.goto('/?portal=1&season2=1');
  await menuReady(page);
  const players = NAMES.map((name, i) => ({ id: i ? `p${i + 1}` : ME, name, lives: 3, isHost: i === 0 }));
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(80);
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
  // the K.O. slam (GameScreen) sits over the card under reduced motion — not the card's, hidden for the shot
  await page.addStyleTag({ content: '.ko-burst, .ko-text { display: none !important; }' });
  await page.waitForTimeout(Number(process.env.WAIT || 1500));
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const jpg = !!process.env.JPG;
  const name = `${process.env.TAG || 'results'}-${outcome}-${w}x${h}.${jpg ? 'jpg' : 'png'}`;
  await page.screenshot({ path: `${out}/${name}`, ...(jpg ? { type: 'jpeg', quality: 80 } : {}) });
  const audit = await page.evaluate(() => {
    const r = document.querySelector('.game-over-card.rs2');
    if (!r) return ['no card'];
    const rb = r.getBoundingClientRect();
    const out = [];
    if (r.scrollHeight > r.clientHeight + 2) out.push(`CARD SCROLLS ${r.scrollHeight}>${r.clientHeight}`);
    for (const el of r.querySelectorAll('*')) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height || getComputedStyle(el).opacity === '0') continue;
      if (b.right > rb.right + 1 || b.left < rb.left - 1) out.push(`${el.className || el.tagName} x ${Math.round(b.left)}..${Math.round(b.right)} (card ${Math.round(rb.left)}..${Math.round(rb.right)})`);
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible' && el !== r) out.push(`${el.className} clipped ${el.scrollWidth}>${el.clientWidth}`);
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (hasText) { const fs = parseFloat(getComputedStyle(el).fontSize); if (fs < 14) out.push(`SMALL ${el.className || el.tagName} ${fs}px "${el.textContent.trim().slice(0, 20)}"`); }
    }
    return out;
  });
  console.log('wrote', name, 'audit:', audit.length ? audit : 'clean');
  await ctx.close();
}
await browser.close();
