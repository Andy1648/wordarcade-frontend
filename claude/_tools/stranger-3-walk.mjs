// stranger-3-walk.mjs — honest first-5-minutes stranger walk (Playwright + Chromium).
//
// Walks a BRAND-NEW LV1 player (storage cleared, no progress, level NOT warped) through the
// natural newcomer path and screenshots EVERY screen in order, at two REAL viewports:
//   - 390x844  phone portrait (touch, retina)
//   - 1366x768 laptop
// Output: claude/stranger-3-shots/<viewport>/NN-name.png
//
// The app opens ONE hardcoded WebSocket to the live Render backend on mount. We intercept it
// (page.routeWebSocket) and act as the server ourselves, and block all non-localhost HTTP, so the
// walk is hermetic and deterministic — the same boundary e2e/support/backendMock.js uses. In-game
// screens are driven by pushing frames to the client (room_update / game_started / turn_update /
// round_start / word_result / game_over), exactly like e2e/game-fill.spec.js's enterMpGame.
//
// Usage: node claude/_tools/stranger-3-walk.mjs   (builds + previews itself if not already up)
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import http from 'http';

const ROOT = path.resolve(process.cwd());
const OUT_ROOT = path.join(ROOT, 'claude', 'stranger-3-shots');
const BASE = 'http://localhost:4173';
const ME = 'e2e-player';

const VIEWPORTS = [
  { name: 'phone-390x844', w: 390, h: 844, dsf: 2, touch: true },
  { name: 'laptop-1366x768', w: 1366, h: 768, dsf: 1, touch: false },
];

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

async function ensurePreview() {
  if (await ping(BASE)) { console.log('preview already up'); return null; }
  if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
    console.log('building (vite build)…');
    const b = spawnSync('npx', ['vite', 'build', '--logLevel', 'error'], { cwd: ROOT, stdio: 'inherit', shell: true });
    if (b.status !== 0) throw new Error('build failed');
  }
  console.log('starting vite preview…');
  const proc = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { cwd: ROOT, stdio: 'inherit', shell: true });
  for (let i = 0; i < 40; i++) { if (await ping(BASE)) { console.log('preview is up'); return proc; } await wait(500); }
  throw new Error('preview did not come up');
}

// Inline the backend mock (routeWebSocket + non-localhost HTTP block) so this standalone
// chromium script never touches production and can push frames to the client.
async function installMock(page) {
  const routes = [];
  await page.route('**/*', (route) => {
    let host = '';
    try { host = new URL(route.request().url()).hostname; } catch { host = ''; }
    if (host === 'localhost' || host === '127.0.0.1' || host === '') return route.continue();
    return route.abort();
  });
  await page.routeWebSocket(/onrender\.com/, async (ws) => {
    routes.push(ws);
    ws.onMessage(() => {});
    ws.send(JSON.stringify({ type: 'connected', payload: { id: ME } }));
  });
  return { push: (frame) => { for (const ws of routes) ws.send(JSON.stringify(frame)); } };
}

async function main() {
  const proc = await ensurePreview();
  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      await walk(browser, vp);
    }
  } finally {
    await browser.close();
    if (proc) proc.kill();
  }
  console.log('\nDONE. shots in', OUT_ROOT);
}

async function walk(browser, vp) {
  const dir = path.join(OUT_ROOT, vp.name);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`\n=== ${vp.name} ===`);

  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.dsf,
    hasTouch: vp.touch,
    isMobile: vp.touch,
    // A real stranger: default (no) reduced-motion so we see the true first look.
  });
  const page = await ctx.newPage();
  const mock = await installMock(page);

  let n = 0;
  const shot = async (name, opts = {}) => {
    n += 1;
    const num = String(n).padStart(2, '0');
    const file = path.join(dir, `${num}-${name}.png`);
    try {
      await page.screenshot({ path: file, fullPage: !!opts.full });
      console.log(`  shot ${num}-${name}`);
    } catch (e) {
      console.log(`  !! shot ${num}-${name} FAILED: ${e.message}`);
    }
  };
  const step = async (label, fn) => {
    try { await fn(); } catch (e) { console.log(`  !! step "${label}" error: ${e.message}`); }
  };

  // Fresh LV1 stranger: clear all storage before first paint (no warp, no seed).
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* blocked */ } });

  // 1) COLD LOAD — the boot loading screen (dictionary load / bomb fuse), no ?portal skip.
  await step('cold-load', async () => {
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await wait(300);
    await shot('cold-load');
  });

  // 2) SPLASH — wait for the TAP/TYPE TO START CTA (also the audio-unlock gesture).
  await step('splash', async () => {
    await page.locator('.splash-screen').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    // The dictionary loads first ("Loading the dictionary…"); wait for the real CTA.
    await page.getByText(/TO START/i).waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await wait(300);
    await shot('splash');
  });

  // 3) INTRO fight-card (TYPE FAST / DIE SLOW) — best-effort, it's brief.
  await step('intro', async () => {
    await page.locator('.splash-screen').click({ force: true });
    await wait(650);
    await shot('intro');
  });

  // 4) MENU — first-run coach-mark spotlight over the XP bar.
  await step('menu-spotlight', async () => {
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 12000 });
    await wait(1400); // let the READY? portal wipe / intro clear
    await shot('menu-spotlight');
  });

  // 5) MENU grid — the whole card grid + XP bar (the homepage scales to fit one viewport).
  await step('menu-grid', async () => {
    // Dismiss the spotlight the way a stranger would: one keystroke (credits ~1 XP, stays LV1).
    await page.keyboard.press('KeyA').catch(() => {});
    await wait(600);
    await shot('menu-grid');
  });

  // Helper: from anywhere, get back to a clean menu (Escape any dialog).
  const toMenu = async () => {
    await page.keyboard.press('Escape').catch(() => {});
    await wait(300);
    const onMenu = await page.getByRole('img', { name: 'Type a Word' }).isVisible().catch(() => false);
    if (!onMenu) { await page.goto(BASE + '/?portal=1'); await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 8000 }); await wait(400); }
  };
  const card = (id) => page.locator(`.game-card-magnet[data-game="${id}"] .game-card`);

  // 6) WORD BOMB dialog — the first playable a newcomer opens (CREATE / JOIN).
  await step('wordbomb-dialog', async () => {
    await card('word-bomb').scrollIntoViewIfNeeded();
    await card('word-bomb').click({ force: true });
    await page.locator('.mode-dialog-shell').waitFor({ state: 'visible', timeout: 6000 });
    await wait(400);
    await shot('wordbomb-dialog');
  });

  // 7) CREATE → the room / lobby (empty; WAITING FOR PLAYERS; ADD BOT; START disabled).
  await step('wordbomb-lobby', async () => {
    await page.locator('.mode-dialog-btn-create').click({ force: true });
    await wait(300);
    mock.push({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: [{ id: ME, name: 'YOU', lives: 3, isHost: true }] } });
    await page.locator('.room-wrap').waitFor({ state: 'visible', timeout: 6000 });
    await wait(500);
    await shot('wordbomb-lobby-empty');
  });

  // 7b) With a bot added (START enabled) — the realistic solo/bot path.
  await step('wordbomb-lobby-bot', async () => {
    mock.push({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'bot1', name: 'BOT', lives: 3, isBot: true }] } });
    await wait(500);
    await shot('wordbomb-lobby-bot');
  });

  // 8) IN-GAME Word Bomb (new ingame look + graffiti backdrop).
  await step('wordbomb-ingame', async () => {
    const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'bot1', name: 'BOT', lives: 3, isBot: true }];
    mock.push({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    await wait(80);
    mock.push({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: ['MONSTER'], timerSeconds: 22 } });
    await page.locator('.game-stage').waitFor({ state: 'visible', timeout: 8000 });
    await wait(4800); // let the 3-2-1-GO! countdown clear
    await shot('wordbomb-ingame');
  });

  // 9) TYPING + accept/reject feel.
  await step('wordbomb-typing', async () => {
    const input = page.locator('.game-stage input, .wb-input, input[type="text"]').first();
    await input.fill('STRING').catch(() => {});
    await wait(200);
    await shot('wordbomb-typed');
    // Local too-short reject (fully client-side): buzz/shake.
    await input.fill('xy').catch(() => {});
    await input.press('Enter').catch(() => {});
    await wait(150);
    await shot('wordbomb-reject');
    // Simulate a server ACCEPT so we see the accept feel.
    await input.fill('STRING').catch(() => {});
    await input.press('Enter').catch(() => {});
    await wait(120);
    mock.push({ type: 'word_result', payload: { word: 'STRING', accepted: true, playerId: ME } });
    await wait(350);
    await shot('wordbomb-accept');
  });

  // 10) GAME OVER (word-bomb: winnerId).
  await step('wordbomb-gameover', async () => {
    mock.push({ type: 'game_over', payload: { winnerId: ME } });
    await wait(1200);
    await shot('wordbomb-gameover');
  });

  await step('back-to-menu-1', toMenu);

  // 11) CATEGORY BLITZ dialog (pack picker + AI JUDGED).
  await step('blitz-dialog', async () => {
    await card('category-blitz').scrollIntoViewIfNeeded();
    await card('category-blitz').click({ force: true });
    await page.locator('.mode-dialog-shell').waitFor({ state: 'visible', timeout: 6000 });
    await wait(400);
    await shot('blitz-dialog');
  });

  // 12) CATEGORY BLITZ in-game.
  await step('blitz-ingame', async () => {
    await page.locator('.mode-dialog-btn-create').click({ force: true });
    await wait(300);
    const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'bot1', name: 'BOT', isBot: true }];
    mock.push({ type: 'room_update', payload: { code: 'WXYZ', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players } });
    await wait(120);
    mock.push({ type: 'game_started', payload: { gameType: 'category-blitz' } });
    await wait(80);
    mock.push({ type: 'round_start', payload: { round: 1, timerSeconds: 45, category: 'CRYPTIDS & FOLKLORE MONSTERS', categoryId: 'cryptids', rerollsRemaining: 1 } });
    await page.locator('.game-stage').waitFor({ state: 'visible', timeout: 8000 });
    await wait(4800);
    await shot('blitz-ingame');
  });

  await step('back-to-menu-2', toMenu);

  // 13) SAT RUSH — solo, skips the CREATE/JOIN dialog: Play → Briefing → Run.
  await step('sat-play', async () => {
    await card('sat-rush').scrollIntoViewIfNeeded();
    await card('sat-rush').click({ force: true });
    await wait(700);
    await shot('sat-play');
  });
  await step('sat-briefing', async () => {
    const brief = page.getByRole('button', { name: /BRIEFING/ });
    if (await brief.isVisible().catch(() => false)) {
      await brief.click();
      await page.locator('.sr-brief-page').waitFor({ state: 'visible', timeout: 6000 });
      await wait(500);
      await shot('sat-briefing');
      await page.getByRole('button', { name: 'Start the run' }).click();
    } else {
      const play = page.getByRole('button', { name: 'Play' });
      if (await play.isVisible().catch(() => false)) await play.click();
    }
  });
  await step('sat-run', async () => {
    await page.locator('.sr-slots, .sr-app').first().waitFor({ state: 'visible', timeout: 8000 });
    await wait(700);
    await shot('sat-run');
  });

  await step('back-to-menu-3', toMenu);

  // 14) LOCKED cards for a stranger: RUN (LV8), CHAIN (LV20), FUSE (LV25) → read-only preview.
  for (const [id, label] of [['run', 'run'], ['chain', 'chain'], ['fuse', 'fuse']]) {
    await step(`locked-${label}`, async () => {
      await card(id).scrollIntoViewIfNeeded();
      await card(id).click({ force: true });
      await wait(600);
      await shot(`locked-${label}`);
      await page.keyboard.press('Escape').catch(() => {});
      await wait(300);
    });
  }

  await ctx.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
