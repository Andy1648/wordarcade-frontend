// local-wb.mjs — BACKEND RULE pre-merge check for the BA1 Word Bomb backend PR: a local backend
// (PORT 3101) + a local frontend build pointed at it (VITE_BACKEND_WS_URL, served on 4300), driven by
// TWO Playwright contexts, each playing PLAY SOLO vs the MEDIUM bot through the real UI:
//   A = a returning player (→ HARD/'easy' preset after the frontend PR; 'medium' before it)
//   B = a first-timer (→ CHILL, which now starts at 15 s)
// It types real words containing the combo (from words.recall.txt), records every WS frame, and
// reports: the opening fuse, words accepted, bot turns (and any CONCEDE ≤ ~6 s), turns passing,
// console errors. Run: node claude/batch-a/ba1/local-wb.mjs [seconds=90]
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../..');
const URL = process.env.LOCAL_URL || 'http://localhost:4300';
const SECS = Number(process.argv[2] || 90);
const WORDS = readFileSync(join(ROOT, 'src/solo/words.recall.txt'), 'utf8').split(' ').filter((w) => w.length >= 4 && w.length <= 8).slice(0, 12000);

async function player(browser, label, returning) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const log = { label, frames: [], errors: [], typed: 0 };
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push(m.text().slice(0, 200)); });
  page.on('response', (r) => { if (r.status() === 404) log.errors.push('404 ' + r.url()); });
  page.on('pageerror', (e) => log.errors.push(String(e).slice(0, 200)));
  page.on('websocket', (ws) => {
    ws.on('framereceived', (f) => {
      try { const m = JSON.parse(f.payload); log.frames.push({ t: Date.now(), type: m.type, payload: m.payload }); } catch { /* binary */ }
    });
  });
  await page.addInitScript((ret) => {
    if (sessionStorage.getItem('lw.seeded')) return;
    sessionStorage.setItem('lw.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.seenGameSpotlight', '1');
    if (ret) localStorage.setItem('wa_has_played', '1');
  }, returning);
  await page.goto(`${URL}/?portal=1`);
  await page.locator('.game-card-magnet[data-game="word-bomb"] .game-card').first().click({ timeout: 20000 });
  await page.getByRole('button', { name: 'PLAY SOLO' }).click({ timeout: 10000 });
  return { page, log, ctx };
}

function myId(log) {
  const g = log.frames.find((f) => f.type === 'room_joined' || f.type === 'room_created' || f.type === 'joined');
  return g && (g.payload.playerId || g.payload.you || g.payload.id);
}

async function play(p, untilMs) {
  const { page, log } = p;
  const input = page.locator('.game-input-row input').first();
  const used = new Set();
  while (Date.now() < untilMs) {
    const tu = [...log.frames].reverse().find((f) => f.type === 'turn_update');
    if (log.frames.some((f) => f.type === 'game_over')) break;
    if (tu && (await input.isEnabled().catch(() => false))) {
      for (const w of tu.payload.usedWords || []) used.add(String(w).toLowerCase());
      const combo = String(tu.payload.combo || '').toLowerCase();
      const ru = [...log.frames].reverse().find((f) => f.type === 'room_update' && (f.payload.players || []).some((x) => x.isBot));
      const botId = ru && ru.payload.players.find((x) => x.isBot).id;
      const mine = tu.payload.currentPlayerId && tu.payload.currentPlayerId !== botId;
      if (mine && combo) {
        const w = WORDS.find((x) => x.includes(combo) && !used.has(x));
        if (w) {
          used.add(w);
          await input.fill(w).catch(() => {});
          await input.press('Enter').catch(() => {});
          log.typed += 1;
          await page.waitForTimeout(900);
          continue;
        }
      }
    }
    await page.waitForTimeout(250);
  }
}

function report(log) {
  const tus = log.frames.filter((f) => f.type === 'turn_update');
  const first = tus[0];
  const ticks = log.frames.filter((f) => f.type === 'timer_tick');
  const ru = [...log.frames].reverse().find((f) => f.type === 'room_update' && (f.payload.players || []).some((x) => x.isBot));
  const bot = ru ? ru.payload.players.find((x) => x.isBot) : null;
  const go = log.frames.find((f) => f.type === 'game_over');
  const accepted = log.frames.filter((f) => f.type === 'word_result' && f.payload.accepted).length;
  // bot turns: from a turn_update naming the bot to the next turn change
  const botTurns = [];
  let start = null;
  for (const f of log.frames) {
    if (f.type === 'turn_update') {
      if (start && f.payload.currentPlayerId !== bot?.id) { botTurns.push({ ms: f.t - start.t, how: start.how }); start = null; }
      if (!start && bot && f.payload.currentPlayerId === bot.id) start = { t: f.t, how: 'word' };
    }
    if (f.type === 'turn_timeout' && start) start.how = 'timeout';
  }
  const turnsChanged = new Set(tus.map((f) => f.payload.currentPlayerId)).size;
  return {
    label: log.label,
    difficultyKey: first && first.payload.difficultyKey,
    openingFuseS: first && first.payload.timerSeconds,
    maxTick: ticks.length ? Math.max(...ticks.map((f) => f.payload.secondsRemaining)) : null,
    wordsTypedByHarness: log.typed,
    wordsAccepted: accepted,
    botTurns: botTurns.length,
    botTimeouts: botTurns.filter((b) => b.how === 'timeout').map((b) => Math.round(b.ms / 100) / 10),
    distinctTurnHolders: turnsChanged,
    gameOver: !!go,
    winner: go ? (go.payload.winnerId === (bot && bot.id) ? 'BOT' : 'HUMAN') : null,
    difficultyKey: ru && ru.payload.difficultyKey,
    botFumbleTyping: log.frames.filter((f) => f.type === 'typing_update' && bot && f.payload.playerId === bot.id).length,
    consoleErrors: log.errors.filter((e) => !/favicon|posthog|umami|sentry|ERR_NAME|net::/i.test(e)),
  };
}

const browser = await chromium.launch();
try {
  const a = await player(browser, 'A returning', true);
  const b = await player(browser, 'B first-timer', false);
  const until = Date.now() + SECS * 1000;
  await Promise.all([play(a, until), play(b, until)]);
  const out = [report(a.log), report(b.log)];
  console.log(JSON.stringify(out, null, 2));
  writeFileSync(join(HERE, 'local-wb.json'), JSON.stringify(out, null, 2));
  await a.page.screenshot({ path: join(HERE, 'local-wb-A.png') });
} finally {
  await browser.close();
}
