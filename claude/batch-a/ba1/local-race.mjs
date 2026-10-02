// local-race.mjs — BACKEND RULE pre-merge check for the BA1 RACE backend PR: local backend (:3101) +
// local frontend build (:4300). TWO Playwright contexts quick-match into a whole-word race (?race=1)
// together with the server's bots and type the race's words at WPM (default 50: per-char delay =
// 12000/WPM ms). Reports each human's finishing place, words, and the bots' words.
// Run: node local-race.mjs [wpm=50]
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const URL = process.env.LOCAL_URL || 'http://localhost:4300';
const WPM = Number(process.argv[2] || 50);
const PER_CHAR = Math.round(12000 / WPM);

async function racer(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const log = { label, frames: [], errors: [], me: null };
  page.on('pageerror', (e) => log.errors.push(String(e).slice(0, 200)));
  page.on('websocket', (ws) => ws.on('framereceived', (f) => {
    try { const m = JSON.parse(f.payload); log.frames.push({ t: Date.now(), type: m.type, payload: m.payload }); if (m.type === 'connected') log.me = m.payload.id; } catch { /* binary */ }
  }));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('lr.seeded')) return;
    sessionStorage.setItem('lr.seeded', '1');
    for (const k of ['taw.seenMenu', 'taw.seenMenuSpotlight', 'taw.seenGameSpotlight', 'wa_has_played']) localStorage.setItem(k, '1');
  });
  await page.goto(`${URL}/?race=1&portal=1`);
  await page.locator('.game-card-magnet[data-game="word-race"] .game-card').first().click({ timeout: 20000 });
  await page.locator('.mode-dialog-actions button').first().click({ timeout: 10000 });
  return { page, log };
}

async function race({ page, log }) {
  const start = await (async () => {
    for (let i = 0; i < 200; i++) {
      const s = log.frames.find((f) => f.type === 'race_start');
      if (s) return s;
      await page.waitForTimeout(250);
    }
    return null;
  })();
  if (!start) return;
  const words = start.payload.words || [];
  const input = page.locator('.wr-input').first();
  await input.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  for (let i = 0; i < 400 && !(await input.isEnabled().catch(() => false)); i++) await page.waitForTimeout(100);
  for (const w of words) {
    if (log.frames.some((f) => f.type === 'race_over')) break;
    await input.pressSequentially(`${w} `, { delay: PER_CHAR }).catch(() => {});
  }
  for (let i = 0; i < 120 && !log.frames.some((f) => f.type === 'race_over'); i++) await page.waitForTimeout(500);
}

function report(log) {
  const over = log.frames.find((f) => f.type === 'race_over');
  const st = over ? over.payload.standings || [] : [];
  const meIdx = st.findIndex((s) => s.id === log.me);
  return {
    label: log.label,
    wpm: WPM,
    racers: st.length,
    place: meIdx >= 0 ? meIdx + 1 : null,
    myWords: meIdx >= 0 ? st[meIdx].words : null,
    standings: st.map((s) => ({ id: s.id === log.me ? 'ME' : (s.isBot ? 'BOT' : s.name || s.id.slice(0, 6)), words: s.words })),
    accepted: log.frames.filter((f) => f.type === 'race_word_result' && f.payload.accepted).length,
    errors: log.errors,
  };
}

const browser = await chromium.launch();
try {
  // SOLO=1: one human vs the server's bots (two humans quick-match each other and need no bots)
  const ps = process.env.SOLO ? [await racer(browser, 'solo')] : [await racer(browser, 'A'), await racer(browser, 'B')];
  await Promise.all(ps.map(race));
  const out = ps.map((p) => report(p.log));
  console.log(JSON.stringify(out, null, 2));
  writeFileSync(join(HERE, `local-race-${WPM}.json`), JSON.stringify(out, null, 2));
} finally {
  await browser.close();
}
