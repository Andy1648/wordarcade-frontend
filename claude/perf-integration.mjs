// claude/perf-integration.mjs
//
// PERF MEASUREMENT for integration/run-stack (the whole run stack: PlayBackdrop behind
// every play screen, THE RUN mode, the ingame redesign, onboarding, endgame chrome).
//
// WHY A STANDALONE SCRIPT (not an e2e spec): the e2e config forces reducedMotion:'reduce'
// (playwright.config.js `use.reducedMotion`), which KILLS every idle/beat loop — exactly the
// motion a perf pass must measure. This script runs its own context with
// reducedMotion:'no-preference' so real animations run, and drives CPU throttling over CDP
// (Emulation.setCPUThrottlingRate) for 1x and 4x, sampling rAF frame deltas for ~4s per cell.
//
// It serves the already-built dist/ via `vite preview` (run `npx vite build` first) and reuses
// the e2e WebSocket mock so no bytes reach the live backend.
//
// Usage:  node claude/perf-integration.mjs            (writes claude/perf-integration.md + prints table)
//         node claude/perf-integration.mjs --ms=3000  (override sample window)

import { chromium } from 'playwright';
import { installBackendMock } from '../e2e/support/backendMock.js';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const PORT = 4178; // avoid clashing with a running e2e preview on 4173
const BASE = `http://localhost:${PORT}`;
const SAMPLE_MS = Number((process.argv.find((a) => a.startsWith('--ms=')) || '').split('=')[1]) || 4000;
const VIEWPORT = { width: 1440, height: 900 };
const THROTTLES = [1, 4];

// Common, high-frequency English words (from words.recall.txt head) — all in the solo
// accept set, all length>=3, used to clear the RUN wall and to type valid words.
const WORDS = ['the', 'and', 'for', 'that', 'this', 'with', 'you', 'are', 'from', 'your',
  'all', 'have', 'new', 'more', 'was', 'will', 'home', 'can', 'about', 'page', 'has',
  'search', 'free', 'but', 'our', 'one', 'other', 'time', 'they', 'site', 'may', 'what',
  'which', 'their', 'news', 'out', 'use', 'any', 'there', 'see', 'only', 'his', 'when',
  'contact', 'here', 'business', 'who', 'web', 'also', 'now', 'help', 'get', 'view',
  'online', 'first', 'been', 'would', 'how', 'were', 'some', 'these', 'like', 'than',
  'find', 'date', 'back', 'top', 'people', 'had', 'list', 'name', 'just', 'over', 'state',
  'year', 'day', 'work', 'last', 'most', 'make'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- the in-page frame sampler ----------
// Non-blocking form: arms a rAF loop that stores {median,p95,n} on window.__perf after `ms`,
// so Node can drive input (keyboard) concurrently. The first delta (warm-up) is dropped.
async function armSampler(page, ms) {
  await page.evaluate((ms) => {
    window.__perf = null;
    const d = [];
    let last = performance.now();
    const start = last;
    function tick(now) {
      d.push(now - last);
      last = now;
      if (now - start < ms) { requestAnimationFrame(tick); return; }
      d.shift(); // drop warm-up frame
      const s = d.slice().sort((a, b) => a - b);
      const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
      window.__perf = { median: q(0.5), p95: q(0.95), n: s.length };
    }
    requestAnimationFrame(tick);
  }, ms);
}
async function readSampler(page, ms) {
  await page.waitForFunction(() => window.__perf !== null, null, { timeout: ms + 8000 });
  return page.evaluate(() => window.__perf);
}
// idle measurement: arm + wait, no input
async function measureIdle(page, ms = SAMPLE_MS) {
  await armSampler(page, ms);
  return readSampler(page, ms);
}
// pressure measurement: arm, then run `driver(page)` (types/presses) for ~ms, then read
async function measurePressure(page, driver, ms = SAMPLE_MS) {
  await armSampler(page, ms);
  const end = Date.now() + ms;
  await driver(page, end);
  return readSampler(page, ms);
}

// ---------- runtime animation / will-change audits ----------
async function auditAnimations(page) {
  return page.evaluate(() => {
    const anims = document.getAnimations();
    let infinite = 0;
    const infNames = {};
    for (const a of anims) {
      const it = a.effect && a.effect.getTiming ? a.effect.getTiming().iterations : undefined;
      if (it === Infinity && a.playState === 'running') {
        infinite++;
        const nm = (a.animationName) || (a.effect && a.effect.target && a.effect.target.className) || '?';
        infNames[nm] = (infNames[nm] || 0) + 1;
      }
    }
    // will-change audit: any element whose computed will-change names a property outside
    // {auto,transform,opacity} is a compositor no-op / potential perf bug.
    const ALLOW = new Set(['auto', 'transform', 'opacity', 'inherit', 'initial', 'unset', 'revert']);
    const bad = [];
    for (const el of document.querySelectorAll('*')) {
      const wc = getComputedStyle(el).willChange;
      if (!wc || wc === 'auto') continue;
      const toks = wc.split(',').map((t) => t.trim().toLowerCase());
      if (toks.some((t) => !ALLOW.has(t))) {
        const cls = (el.className && typeof el.className === 'string') ? el.className.split(/\s+/).slice(0, 2).join('.') : el.tagName;
        bad.push(`${el.tagName.toLowerCase()}.${cls} => ${wc}`);
      }
    }
    return { total: anims.length, infinite, infNames, badWillChange: [...new Set(bad)] };
  });
}

// ---------- navigation helpers (mirror e2e/viewport-integrity + game-fill) ----------
const cardSel = (id) => `.game-card-magnet[data-game="${id}"] .game-card`;
const ME = 'e2e-player';
const wbPlayers = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 2 }];
const cbPlayers = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];

async function setXp(page, lv) {
  await page.addInitScript((v) => {
    try {
      localStorage.setItem('taw.xp', JSON.stringify({ lv: v, into: 0 }));
      localStorage.setItem('taw.wins', '999999');
    } catch { /* ignore */ }
  }, lv);
}

async function bootMenu(page, lv = 40, query = '?portal=1') {
  await setXp(page, lv);
  await installBackendMock(page);
  await page.goto(`${BASE}/${query}`);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await sleep(500);
}
async function bootMpGame(page, gameType) {
  const players = gameType === 'word-bomb' ? wbPlayers : cbPlayers;
  const mock = await installBackendMock(page);
  await page.goto(`${BASE}/?portal=1`);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType, hostId: ME, difficultyKey: 'chill', players } });
  await sleep(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType } });
  await sleep(80);
  if (gameType === 'word-bomb') {
    mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players, combo: 'at', usedWords: [], timerSeconds: 30 } });
  } else {
    mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } });
  }
  await page.locator('.game-stage').waitFor({ state: 'visible' });
  await sleep(4200); // let the 3-2-1-GO! countdown clear
  return mock;
}
async function bootSolo(page, id) {
  await setXp(page, 40);
  await installBackendMock(page);
  await page.goto(`${BASE}/?portal=1&soloms=20000`);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await sleep(400);
  await page.locator(cardSel(id)).click({ force: true });
  await page.locator('.mode-dialog-shell').waitFor({ state: 'visible' });
  await page.locator('.mode-dialog-btn-create').click();
  await page.locator('.solo-root').waitFor({ state: 'visible' });
  await sleep(300);
}
async function bootSat(page, extra = '') {
  await setXp(page, 40);
  await installBackendMock(page);
  await page.goto(`${BASE}/?satRush=1&portal=1${extra}`);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await sleep(400);
  await page.locator(cardSel('sat-rush')).click({ force: true });
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /BRIEFING/i }).click();
  await page.locator('.sr-brief-page').waitFor({ state: 'visible', timeout: 8000 });
  await page.getByRole('button', { name: 'Start the run' }).click();
  await page.locator('.sr-slots').waitFor({ state: 'visible', timeout: 10000 });
  await sleep(500);
}
async function bootRun(page, extra = '') {
  await setXp(page, 12);
  await installBackendMock(page);
  await page.goto(`${BASE}/?portal=1${extra}`);
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  await sleep(400);
  await page.locator(cardSel('run')).click({ force: true });
  await page.locator('.run-root').waitFor({ state: 'visible', timeout: 8000 });
  await sleep(300);
}

// ---------- input drivers ----------
// ~30 keys/sec keydown burst on the document (menu key-power effect).
async function keyburstDoc(page, end) {
  const keys = 'abcdefghijklmnopqrstuvwxyz'.split('');
  let i = 0;
  while (Date.now() < end) {
    await page.keyboard.press(keys[i++ % keys.length]);
    await sleep(33);
  }
}
// type valid words into an input, submitting with Enter (drives per-keystroke + accept effects)
function typeWords(selector) {
  return async (page, end) => {
    const input = page.locator(selector).first();
    try { await input.focus({ timeout: 2000 }); } catch { /* keep going */ }
    let w = 0;
    while (Date.now() < end) {
      const word = WORDS[w++ % WORDS.length];
      for (const ch of word) {
        if (Date.now() >= end) break;
        await page.keyboard.press(ch);
        await sleep(33);
      }
      await page.keyboard.press('Enter');
      await sleep(60);
    }
  };
}

// clear RUN round 1 by typing common words until the draft phase appears
async function clearRunRound(page) {
  await page.locator('.run-btn-go').click(); // START ROUND
  await page.locator('.run-round').waitFor({ state: 'visible', timeout: 5000 });
  const input = page.locator('.run-input');
  await input.focus();
  for (let i = 0; i < WORDS.length; i++) {
    if (await page.locator('.run-draft').count()) break;
    await input.fill(WORDS[i]);
    await page.keyboard.press('Enter');
    await sleep(40);
  }
}

// ---------- server ----------
function startPreview() {
  return new Promise((res, rej) => {
    const isWin = process.platform === 'win32';
    const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
      cwd: ROOT, shell: isWin, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let done = false;
    const onData = (b) => {
      const s = b.toString();
      if (!done && /localhost:\d+/.test(s)) { done = true; res(proc); }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    setTimeout(() => { if (!done) { done = true; res(proc); } }, 8000);
    proc.on('error', rej);
  });
}

// ---------- scenario runner ----------
// Each scenario: { name, nav(page), driver?(page,end) }. driver present => pressure; else idle.
const SCENARIOS = [
  { name: 'a. menu idle', nav: (p) => bootMenu(p, 40) },
  { name: 'b. menu keyburst ~30/s', nav: (p) => bootMenu(p, 40), driver: keyburstDoc },
  { name: 'c. WORD BOMB calm', nav: (p) => bootMpGame(p, 'word-bomb') },
  { name: 'c. WORD BOMB max (low timer + type)', nav: (p) => bootMpGame(p, 'word-bomb'), pre: async (p, mock) => { mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'at', usedWords: [], timerSeconds: 3 } }); await sleep(200); }, driver: typeWords('.game-stage input') },
  { name: 'c. CATEGORY BLITZ calm', nav: (p) => bootMpGame(p, 'category-blitz') },
  { name: 'c. CATEGORY BLITZ max (low timer + type)', nav: (p) => bootMpGame(p, 'category-blitz'), pre: async (p, mock) => { mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 3, category: 'FRUITS', categoryId: 'fruits', rerollsRemaining: 1 } }); await sleep(200); }, driver: typeWords('.game-stage input') },
  { name: 'c. CHAIN calm', nav: (p) => bootSolo(p, 'chain') },
  { name: 'c. CHAIN max (mid-combo typing)', nav: (p) => bootSolo(p, 'chain'), driver: typeWords('.solo-root input') },
  { name: 'c. FUSE calm', nav: (p) => bootSolo(p, 'fuse') },
  { name: 'c. FUSE max (mid-combo typing)', nav: (p) => bootSolo(p, 'fuse'), driver: typeWords('.solo-root input') },
  { name: 'c. SAT RUSH calm', nav: (p) => bootSat(p) },
  { name: 'c. SAT RUSH max (endgame speed-lines)', nav: (p) => bootSat(p, '&stage=320&spell=320'), settle: 3000 },
  { name: 'd. RUN draft screen', nav: (p) => bootRun(p, '&seed=1&rs=60'), reach: 'draft' },
  { name: 'e. RUN round (typing)', nav: (p) => bootRun(p, '&seed=1&rs=60'), reach: 'round', driver: typeWords('.run-input') },
];

async function run() {
  const preview = await startPreview();
  const browser = await chromium.launch();
  const results = [];
  const audits = {};
  let menuBaselineInf = null;

  try {
    for (const sc of SCENARIOS) {
      const row = { name: sc.name };
      for (const rate of THROTTLES) {
        const context = await browser.newContext({ viewport: VIEWPORT, reducedMotion: 'no-preference' });
        const page = await context.newPage();
        const client = await context.newCDPSession(page);
        let m = { median: NaN, p95: NaN, n: 0 };
        try {
          const mock = await sc.nav(page);
          if (sc.reach === 'draft') await clearRunRound(page);
          if (sc.reach === 'round') {
            await page.locator('.run-btn-go').click();
            await page.locator('.run-round').waitFor({ state: 'visible', timeout: 5000 });
          }
          if (sc.pre) await sc.pre(page, mock);
          if (sc.settle) await sleep(sc.settle);
          // audit once (at 1x, fully settled) — counts/will-change are load-independent
          if (rate === 1) {
            audits[sc.name] = await auditAnimations(page);
            if (sc.name.startsWith('a. menu')) menuBaselineInf = audits[sc.name].infinite;
          }
          await client.send('Emulation.setCPUThrottlingRate', { rate });
          await sleep(300);
          m = sc.driver ? await measurePressure(page, sc.driver) : await measureIdle(page);
        } catch (e) {
          row[`err${rate}`] = String(e).split('\n')[0].slice(0, 120);
        } finally {
          await client.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
          await context.close();
        }
        row[`x${rate}`] = m;
      }
      results.push(row);
      const f = (v) => (Number.isFinite(v) ? v.toFixed(1) : 'ERR');
      console.log(`${row.name.padEnd(40)} | 1x med ${f(row.x1?.median)} p95 ${f(row.x1?.p95)} | 4x med ${f(row.x4?.median)} p95 ${f(row.x4?.p95)}${row.err1 || row.err4 ? ' | ERR: ' + (row.err1 || row.err4) : ''}`);
    }
  } finally {
    await browser.close();
    try { preview.kill(); } catch { /* ignore */ }
  }

  writeReport(results, audits, menuBaselineInf);
  console.log('\nWrote claude/perf-integration.md');
}

function writeReport(results, audits, menuBaselineInf) {
  const f = (v) => (Number.isFinite(v) ? v.toFixed(1) : 'ERR');
  let md = `# Perf report — integration/run-stack (perf/integration)\n\n`;
  md += `Measured with \`claude/perf-integration.mjs\` (playwright core, own \`vite preview\`, `;
  md += `reducedMotion:no-preference so real loops run, CDP \`Emulation.setCPUThrottlingRate\` 1x/4x, `;
  md += `rAF frame deltas sampled ${SAMPLE_MS}ms, first frame dropped, median + p95). Viewport ${VIEWPORT.width}x${VIEWPORT.height}. `;
  md += `60fps = 16.7ms/frame. Sandbox timing is load-sensitive (playbook §3) — read medians as ballpark, p95 as jank signal.\n\n`;
  md += `## Scenario × throttle (ms/frame)\n\n`;
  md += `| Scenario | 1x median | 1x p95 | 4x median | 4x p95 |\n|---|---|---|---|---|\n`;
  for (const r of results) {
    md += `| ${r.name} | ${f(r.x1?.median)} | ${f(r.x1?.p95)} | ${f(r.x4?.median)} | ${f(r.x4?.p95)} |`;
    if (r.err1 || r.err4) md += ` <!-- ${r.err1 || r.err4} -->`;
    md += `\n`;
  }
  md += `\n## Runtime animation + will-change audit (per screen, at 1x settled)\n\n`;
  md += `Menu baseline running infinite animations: **${menuBaselineInf}**.\n\n`;
  md += `| Scenario | total anims | infinite (running) | Δ vs menu | bad will-change |\n|---|---|---|---|---|\n`;
  for (const r of results) {
    const a = audits[r.name];
    if (!a) { md += `| ${r.name} | — | — | — | — |\n`; continue; }
    const d = menuBaselineInf == null ? '?' : (a.infinite - menuBaselineInf);
    md += `| ${r.name} | ${a.total} | ${a.infinite} | ${d >= 0 ? '+' + d : d} | ${a.badWillChange.length ? a.badWillChange.join('; ') : 'none'} |\n`;
  }
  md += `\n### Infinite-animation names per screen\n\n`;
  for (const r of results) {
    const a = audits[r.name];
    if (!a) continue;
    const names = Object.entries(a.infNames).map(([k, v]) => `${k}×${v}`).join(', ') || '(none)';
    md += `- **${r.name}**: ${names}\n`;
  }
  writeFileSync(resolve(__dirname, 'perf-integration.md'), md, 'utf8');
  // also dump raw json next to it for re-analysis
  writeFileSync(resolve(__dirname, 'perf-integration.json'), JSON.stringify({ results, audits, menuBaselineInf, SAMPLE_MS }, null, 2), 'utf8');
}

run().catch((e) => { console.error(e); process.exit(1); });
