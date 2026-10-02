// local-blitz.mjs — BACKEND RULE pre-merge check for the BA1 Blitz backend PR: local backend (:3101)
// + a local frontend build pointed at it (:4300), TWO Playwright contexts each playing PLAY SOLO
// Category Blitz vs the MEDIUM bot through the real UI. Each types real answers from the curated list
// (BLITZ_JSON = the backend's blitzLists.json). Reports: categories served, the bot's first-answer
// time per round, answers accepted, and console errors. Run: node local-blitz.mjs [seconds=110]
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const URL = process.env.LOCAL_URL || 'http://localhost:4300';
const SECS = Number(process.argv[2] || 110);
const LISTS = JSON.parse(readFileSync(process.env.BLITZ_JSON, 'utf8'));
const byName = new Map((Array.isArray(LISTS) ? LISTS : LISTS.lists || Object.values(LISTS)).map((c) => [c.name, c]));

async function player(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const log = { label, frames: [], errors: [], typed: 0 };
  page.on('pageerror', (e) => log.errors.push(String(e).slice(0, 200)));
  page.on('response', (r) => { if (r.status() >= 400 && !/_vercel|favicon/.test(r.url())) log.errors.push(`${r.status()} ${r.url()}`); });
  page.on('websocket', (ws) => ws.on('framereceived', (f) => {
    try { const m = JSON.parse(f.payload); log.frames.push({ t: Date.now(), type: m.type, payload: m.payload }); } catch { /* binary */ }
  }));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('lb.seeded')) return;
    sessionStorage.setItem('lb.seeded', '1');
    for (const k of ['taw.seenMenu', 'taw.seenMenuSpotlight', 'taw.seenGameSpotlight', 'wa_has_played']) localStorage.setItem(k, '1');
  });
  await page.goto(`${URL}/category-blitz/play`); // the deep link launches a round vs a bot
  return { page, log };
}

const catOf = (p) => p.category || p.categoryName || (p.round && p.round.category) || null;

async function play({ page, log }, until) {
  const given = new Set();
  let lastCat = null;
  while (Date.now() < until) {
    if (log.frames.some((f) => f.type === 'game_over')) break;
    const rs = [...log.frames].reverse().find((f) => catOf(f.payload || {}) && /round|turn|game_started|category/.test(f.type));
    const cat = rs && catOf(rs.payload);
    if (cat && cat !== lastCat) { lastCat = cat; given.clear(); }
    const list = cat && byName.get(cat);
    const input = page.locator('input[type="text"], input:not([type])').first();
    if (list && (await input.isEnabled().catch(() => false))) {
      const next = list.answers.find((a) => !given.has(a) && a.length >= 3);
      if (next) {
        given.add(next);
        await input.fill(next).catch(() => {});
        await input.press('Enter').catch(() => {});
        log.typed += 1;
        await page.waitForTimeout(2500);
        continue;
      }
    }
    await page.waitForTimeout(300);
  }
}

function report(log) {
  const cats = [];
  for (const f of log.frames) { const c = catOf(f.payload || {}); if (c && cats[cats.length - 1] !== c) cats.push(c); }
  const ru = [...log.frames].reverse().find((f) => f.type === 'room_update' && (f.payload.players || []).some((x) => x.isBot));
  const botId = ru && ru.payload.players.find((x) => x.isBot).id;
  // bot first answer per round: time from the round's first category frame to the bot's first accepted answer
  const firsts = [];
  let roundStart = null;
  let seenBot = false;
  let cur = null;
  for (const f of log.frames) {
    const c = catOf(f.payload || {});
    if (c && c !== cur) { cur = c; roundStart = f.t; seenBot = false; }
    const pid = f.payload && (f.payload.playerId || f.payload.by);
    const prog = f.type === 'player_progress' && JSON.stringify(f.payload).includes(botId || '__none__');
    if (!seenBot && roundStart && botId && (prog || (pid === botId && /answer|result/.test(f.type)))) { firsts.push(Math.round((f.t - roundStart) / 100) / 10); seenBot = true; }
  }
  return {
    label: log.label,
    categories: cats,
    botFirstAnswerS: firsts,
    typed: log.typed,
    acceptedMine: log.frames.filter((f) => /answer_result|word_result/.test(f.type) && f.payload.accepted && (!botId || (f.payload.playerId || f.payload.by) !== botId)).length,
    gameOver: log.frames.some((f) => f.type === 'game_over'),
    frameTypes: [...new Set(log.frames.map((f) => f.type))],
    errors: log.errors,
    botAnswers: log.frames.filter((f) => f.type === 'round_end').map((f) => {
      const ps = f.payload.playerResults || f.payload.players || [];
      const b = (Array.isArray(ps) ? ps : Object.values(ps)).find((x) => x && (x.id === botId || x.playerId === botId));
      return b ? (b.answers || b.words || []).map((a) => (typeof a === 'string' ? a : a.answer || a.text)) : Object.keys(f.payload);
    }),
  };
}

const browser = await chromium.launch();
try {
  const a = await player(browser, 'A');
  const b = await player(browser, 'B');
  const until = Date.now() + SECS * 1000;
  await Promise.all([play(a, until), play(b, until)]);
  const out = [report(a.log), report(b.log)];
  console.log(JSON.stringify(out, null, 2));
  writeFileSync(join(HERE, 'local-blitz.json'), JSON.stringify(out, null, 2));
  await a.page.screenshot({ path: join(HERE, 'local-blitz-A.png') });
} finally {
  await browser.close();
}
