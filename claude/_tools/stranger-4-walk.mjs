// stranger-4-walk.mjs — re-run of the STRANGER WALK on the new on-ramp (fix/onramp).
//
// The previous stranger pass (chore/stranger-3) found the first 60 seconds read as
// "this needs friends I don't have, and most of it is locked": the flagship PLAY funneled
// a solo player into "SHARE THIS CODE WITH FRIENDS / NEED 2+ PLAYERS", and the hero RUN
// card was a grey padlock. fix/onramp claims to fix both:
//   (1) Word Bomb / Category Blitz PLAY now starts a SOLO game instantly (vs a bot for WB);
//       multiplayer is a secondary INVITE FRIENDS / JOIN WITH CODE row.
//   (2) THE RUN card is a FREE first run for a brand-new account (playable, not a LV8
//       padlock) — the gate engages only after the first run is played.
//
// This walk VERIFIES those two blockers are gone and screenshots the NEW first 60s.
//
// Deterministic + hermetic: it spins its own `vite preview`, installs the SAME WebSocket
// intercept + non-localhost HTTP block as e2e/support/backendMock.js (installBackendMock:
// waitForSent + pushToClient), so the flow never touches a real server. A brand-new LV1
// player (storage cleared before first paint) is walked at 390x844 and 1366x768, and every
// screen is screenshotted in order to claude/stranger-4-shots/<viewport>/NN-name.png.
//
// Usage: node claude/_tools/stranger-4-walk.mjs
import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
import http from 'http';

const ROOT = path.resolve(process.cwd());
const OUT_ROOT = path.join(ROOT, 'claude', 'stranger-4-shots');
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
  for (let i = 0; i < 60; i++) { if (await ping(BASE)) { console.log('preview is up'); return proc; } await wait(500); }
  throw new Error('preview did not come up');
}

// A tiny assertion log the report cites (printed to stdout + returned per-viewport).
function makeVerdicts() {
  const rows = [];
  const record = (label, pass, detail = '') => {
    rows.push({ label, pass, detail });
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
  };
  return { rows, record };
}

async function main() {
  const proc = await ensurePreview();
  const browser = await chromium.launch();
  const all = {};
  try {
    for (const vp of VIEWPORTS) {
      all[vp.name] = await walk(browser, vp);
    }
  } finally {
    await browser.close();
    if (proc) proc.kill();
  }
  console.log('\n=== VERDICT SUMMARY ===');
  for (const [vpName, v] of Object.entries(all)) {
    console.log(`\n[${vpName}]`);
    for (const r of v.rows) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.label}${r.detail ? ' — ' + r.detail : ''}`);
  }
  console.log('\nDONE. shots in', OUT_ROOT);
}

async function walk(browser, vp) {
  const dir = path.join(OUT_ROOT, vp.name);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`\n=== ${vp.name} ===`);
  const V = makeVerdicts();

  const ctx = await browser.newContext({
    viewport: { width: vp.w, height: vp.h },
    deviceScaleFactor: vp.dsf,
    hasTouch: vp.touch,
    isMobile: vp.touch,
    // A real stranger: default (no) reduced-motion, so we see the true first look.
  });
  const page = await ctx.newPage();
  // SAME boundary as e2e/support/backendMock.js: WS intercept (waitForSent/pushToClient)
  // + non-localhost HTTP block. Must be installed BEFORE goto so it's in place on mount.
  const mock = await installBackendMock(page);

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

  // Fresh LV1 stranger: clear all storage before first paint (no warp, no seed, no
  // runFreeUsed flag). This is the real brand-new-account state.
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* blocked */ } });

  // 1) COLD LOAD → splash → intro → menu.
  await step('cold-load', async () => {
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await wait(300);
    await shot('cold-load');
  });
  await step('splash', async () => {
    await page.locator('.splash-screen').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await page.getByText(/TO START/i).waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
    await wait(300);
    await shot('splash');
  });
  await step('intro', async () => {
    await page.locator('.splash-screen').click({ force: true });
    await wait(650);
    await shot('intro');
  });

  // 2) COLD MENU (fresh LV1). BLOCKER (b): is THE RUN card PLAYABLE (not a padlock)?
  await step('menu-cold', async () => {
    await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 15000 });
    await wait(1500); // let the READY? portal wipe / first-run spotlight settle
    await shot('menu-cold-spotlight');
    // Dismiss the first-run spotlight the way a stranger would (one keystroke ~1 XP, stays LV1).
    await page.keyboard.press('KeyA').catch(() => {});
    await wait(700);
    await shot('menu-cold-grid');
  });

  // BLOCKER (b) ASSERTION: THE RUN card is NOT locked (no padlock plaque inside it).
  await step('verify-run-playable', async () => {
    const runCard = page.locator('.game-card-magnet[data-game="run"] .game-card');
    const exists = await runCard.count();
    const lockCount = await page.locator('.game-card-magnet[data-game="run"] .game-card-lock').count();
    const hasLockedClass = await runCard.evaluate((el) => el.classList.contains('locked')).catch(() => null);
    V.record('RUN card present on cold menu', exists > 0, `count=${exists}`);
    V.record('RUN card is PLAYABLE (no padlock plaque)', lockCount === 0, `lockPlaque=${lockCount}, .locked=${hasLockedClass}`);
    // Screenshot just the RUN card for the report.
    await runCard.screenshot({ path: path.join(dir, '03b-run-card-closeup.png') }).catch(() => {});
  });

  const card = (id) => page.locator(`.game-card-magnet[data-game="${id}"] .game-card`);
  const toMenu = async () => {
    await page.keyboard.press('Escape').catch(() => {});
    await wait(300);
    const onMenu = await page.getByRole('img', { name: 'Type a Word' }).isVisible().catch(() => false);
    if (!onMenu) { await page.goto(BASE + '/?portal=1'); await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible', timeout: 8000 }); await wait(600); }
  };

  // 3) WORD BOMB dialog — BLOCKER (a): does PLAY lead, with INVITE/JOIN as a secondary row?
  await step('wordbomb-dialog', async () => {
    await card('word-bomb').scrollIntoViewIfNeeded();
    await card('word-bomb').click({ force: true });
    await page.locator('.mode-dialog-shell').waitFor({ state: 'visible', timeout: 6000 });
    await wait(500);
    await shot('wordbomb-dialog');
  });
  await step('verify-play-leads', async () => {
    const playVisible = await page.locator('.mode-dialog-btn-play').isVisible().catch(() => false);
    const playText = (await page.locator('.mode-dialog-btn-play').innerText().catch(() => '')).trim();
    const createText = (await page.locator('.mode-dialog-btn-create').innerText().catch(() => '')).trim();
    const joinText = (await page.locator('.mode-dialog-btn-join').innerText().catch(() => '')).trim();
    // Geometry: is PLAY above (leads) the INVITE/JOIN row, and bigger/full-width?
    let leadsBox = null;
    try {
      const p = await page.locator('.mode-dialog-btn-play').boundingBox();
      const c = await page.locator('.mode-dialog-btn-create').boundingBox();
      leadsBox = { playTop: Math.round(p.y), createTop: Math.round(c.y), playW: Math.round(p.width), createW: Math.round(c.width), playAbove: p.y < c.y, playWider: p.width > c.width + 5 };
    } catch { /* ignore */ }
    V.record('WORD BOMB: PLAY button present + leads', playVisible, `play="${playText}"`);
    V.record('WORD BOMB: INVITE FRIENDS + JOIN WITH CODE are the secondary row', !!createText && !!joinText, `create="${createText}" join="${joinText}"`);
    if (leadsBox) V.record('WORD BOMB: PLAY sits above + wider than the MP row', leadsBox.playAbove && leadsBox.playWider, JSON.stringify(leadsBox));
  });

  // 4) CLICK PLAY → the client provisions solo-vs-bot and lands IN A LIVE GAME (no lobby).
  await step('wordbomb-play-solo', async () => {
    await page.locator('.mode-dialog-btn-play').click({ force: true });
    // The app sends create_room → set_game_type → (set_difficulty) → add_bot → start_game.
    await mock.waitForSent('start_game', 8000);
    const types = mock.sentTypes();
    const need = ['create_room', 'set_game_type', 'add_bot', 'start_game'];
    const missing = need.filter((t) => !types.includes(t));
    const botBeforeStart = types.indexOf('add_bot') >= 0 && types.indexOf('add_bot') < types.indexOf('start_game');
    V.record('PLAY sends create_room→set_game_type→add_bot→start_game', missing.length === 0, `sent=[${types.join(', ')}]`);
    V.record('add_bot precedes start_game', botBeforeStart, `order ok=${botBeforeStart}`);

    // Server answers: room_update FIRST (must NOT flash the lobby), then game_started + turn_update.
    const players = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'bot', name: 'BOT', lives: 3 }];
    mock.pushToClient({ type: 'room_update', payload: { code: 'ZZZZ', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players } });
    await wait(120);
    // A room_update arriving during provisioning must NOT strand the player on the lobby.
    const flashedRoom = await page.locator('.room-wrap').count();
    V.record('room_update during provision does NOT flash the lobby', flashedRoom === 0, `.room-wrap=${flashedRoom}`);
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
    await wait(80);
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'str', usedWords: ['MONSTER'], timerSeconds: 22 } });

    await page.locator('.game-stage').waitFor({ state: 'visible', timeout: 8000 });
    await wait(4800); // let the 3-2-1-GO! countdown clear so the shot is the LIVE bright state
    await shot('wordbomb-ingame');
    const stage = await page.locator('.game-stage').count();
    const roomWrap = await page.locator('.room-wrap').count();
    const lobbyWrap = await page.locator('.lobby-wrap').count();
    V.record('PLAY lands IN A LIVE GAME (.game-stage)', stage > 0, `.game-stage=${stage}`);
    V.record('NEVER on the room/lobby (.room-wrap / .lobby-wrap = 0)', roomWrap === 0 && lobbyWrap === 0, `.room-wrap=${roomWrap} .lobby-wrap=${lobbyWrap}`);
  });

  await step('back-to-menu-1', toMenu);

  // 5) CATEGORY BLITZ dialog — same secondary-row check (PLAY leads, INVITE/JOIN secondary).
  await step('blitz-dialog', async () => {
    await card('category-blitz').scrollIntoViewIfNeeded();
    await card('category-blitz').click({ force: true });
    await page.locator('.mode-dialog-shell').waitFor({ state: 'visible', timeout: 6000 });
    await wait(500);
    await shot('blitz-dialog');
    const playVisible = await page.locator('.mode-dialog-btn-play').isVisible().catch(() => false);
    const createText = (await page.locator('.mode-dialog-btn-create').innerText().catch(() => '')).trim();
    const joinText = (await page.locator('.mode-dialog-btn-join').innerText().catch(() => '')).trim();
    V.record('CATEGORY BLITZ: PLAY leads + INVITE/JOIN secondary', playVisible && !!createText && !!joinText, `create="${createText}" join="${joinText}"`);
  });
  await step('back-to-menu-2', toMenu);

  // 6) THE RUN — click from the menu. BLOCKER (b): does it ENTER THE RUN (wall/round),
  //    not a locked read-only preview?
  await step('the-run', async () => {
    await card('run').scrollIntoViewIfNeeded();
    await card('run').click({ force: true });
    await wait(400);
    // A locked card would open LockedPreviewDialog; a playable one enters the run screen.
    const lockedPreview = await page.locator('.locked-preview, .locked-preview-dialog').count();
    // The run screen surfaces: wall preview (.run-wall) or the round (.run-round).
    await page.locator('.run-root, .run-wall, .run-round').first().waitFor({ state: 'visible', timeout: 12000 }).catch(() => {});
    await wait(700);
    await shot('the-run-entered');
    const wall = await page.locator('.run-wall').count();
    const round = await page.locator('.run-round').count();
    const anyRun = await page.locator('.run-root, .run-wall, .run-round').count();
    V.record('THE RUN enters the run (wall/round), not a locked preview', anyRun > 0 && lockedPreview === 0, `.run-wall=${wall} .run-round=${round} lockedPreview=${lockedPreview}`);
  });

  await ctx.close();
  return V;
}

main().catch((e) => { console.error(e); process.exit(1); });
