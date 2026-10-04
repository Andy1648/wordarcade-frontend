// local-challenge-2ctx.mjs — TIER-1 pre-merge check for PR #180 (challenge link), Andy oct3 rule: no preview
// deploys exist, so two Playwright contexts against a LOCAL backend (origin/main, :3101) + a LOCAL build of the
// PR (:4300, built with VITE_BACKEND_WS_URL=ws://localhost:3101).
//   A: COLD /race/play?vs=XAVI&t=41200&n=25 → must land in a word race (race_quick_match sent, race_start
//      received), show the chip "BEAT XAVI: 41.2s", and end on the verdict line.
//   B: the normal path — menu → WORD RACE card → the dialog's first button → a race (unchanged behaviour).
// Reports per context: frames sent/received, chip/verdict text, page errors. Exit 1 on any failed check.
//   node claude/finetune/local-challenge-2ctx.mjs
import { chromium } from '@playwright/test';

const URL = process.env.LOCAL_URL || 'http://localhost:4300';
const SEED = ['taw.seenMenu', 'taw.seenMenuSpotlight', 'taw.seenGameSpotlight', 'wa_has_played'];

async function open(browser, label, path) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const log = { label, sent: [], recv: [], errors: [] };
  page.on('pageerror', (e) => log.errors.push(String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push('console: ' + m.text().slice(0, 160)); });
  page.on('websocket', (ws) => {
    ws.on('framesent', (f) => { try { log.sent.push(JSON.parse(f.payload).type); } catch { /* binary */ } });
    ws.on('framereceived', (f) => { try { const m = JSON.parse(f.payload); log.recv.push({ type: m.type, payload: m.payload }); } catch { /* binary */ } });
  });
  await page.addInitScript((keys) => {
    if (sessionStorage.getItem('lc.seeded')) return;
    sessionStorage.setItem('lc.seeded', '1');
    for (const k of keys) localStorage.setItem(k, '1');
  }, SEED);
  await page.goto(`${URL}${path}`);
  return { page, log };
}

async function waitFor(fn, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function play({ page, log }) {
  const ok = await waitFor(() => log.recv.some((m) => m.type === 'race_start'), 90000);
  if (!ok) return false;
  const words = (log.recv.find((m) => m.type === 'race_start').payload.words) || [];
  const input = page.locator('.wr-input').first();
  await input.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
  await waitFor(() => input.isEnabled().catch(() => false), 40000);
  for (const w of words) {
    if (log.recv.some((m) => m.type === 'race_over')) break;
    await input.pressSequentially(`${w} `, { delay: 120 }).catch(() => {});
  }
  await waitFor(() => log.recv.some((m) => m.type === 'race_over'), 60000);
  await page.waitForTimeout(1500);
  return true;
}

const browser = await chromium.launch();
const checks = [];
const check = (name, pass, detail = '') => { checks.push({ name, pass, detail }); };
try {
  const A = await open(browser, 'A challenge link', '/race/play?vs=XAVI&t=41200&n=25');
  const B = await open(browser, 'B normal race', '/?portal=1');
  // B takes the normal path into a race
  await B.page.locator('.game-card-magnet[data-game="word-race"] .game-card').first().click({ timeout: 30000 });
  await B.page.locator('.mode-dialog-actions button').first().click({ timeout: 15000 });

  // A: the chip while racing
  const chipSeen = await waitFor(async () => /BEAT XAVI: 41\.2s/.test(await A.page.locator('body').innerText().catch(() => '')), 90000);
  check('A: chip "BEAT XAVI: 41.2s" shown', chipSeen);
  await Promise.all([play(A), play(B)]);

  check('A: sent race_quick_match exactly once', A.log.sent.filter((t) => t === 'race_quick_match').length === 1, JSON.stringify(A.log.sent.filter((t) => /race/.test(t))));
  check('A: got race_start + race_over', ['race_start', 'race_over'].every((t) => A.log.recv.some((m) => m.type === t)));
  const aText = await A.page.locator('body').innerText().catch(() => '');
  check('A: verdict line names XAVI', /(YOU BEAT XAVI|XAVI WINS|XAVI WAS FASTER|YOU WERE FASTER|DEAD HEAT WITH XAVI)/.test(aText), (aText.match(/[^\n]*XAVI[^\n]*/g) || []).slice(0, 3).join(' | '));
  check('A: SEND IT BACK button', /SEND IT BACK/.test(aText));
  check('B: normal RACE sent race_quick_match once', B.log.sent.filter((t) => t === 'race_quick_match').length === 1, JSON.stringify(B.log.sent.filter((t) => /race/.test(t))));
  check('B: normal RACE got race_start + race_over', ['race_start', 'race_over'].every((t) => B.log.recv.some((m) => m.type === t)));
  const bText = await B.page.locator('body').innerText().catch(() => '');
  check('B: no challenge chip / verdict on a normal race', !/BEAT XAVI|XAVI/.test(bText));
  check('A: no page errors', A.log.errors.length === 0, A.log.errors.join(' | '));
  check('B: no page errors', B.log.errors.length === 0, B.log.errors.join(' | '));
  await A.page.screenshot({ path: 'claude/finetune/local-challenge-A.png' });
  await B.page.screenshot({ path: 'claude/finetune/local-challenge-B.png' });
} finally {
  await browser.close();
}
for (const c of checks) console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  — ${c.detail}` : ''}`);
const failed = checks.filter((c) => !c.pass).length;
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
