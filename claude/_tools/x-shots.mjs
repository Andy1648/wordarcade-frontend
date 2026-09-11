// x-shots.mjs — PHASE 7: capture each experiment's two variants and stitch them into
// ONE side-by-side image per comparison.
//
// Both variants come out of the same build and the same browser, differing only by the
// URL flag, so anything visible in the pair is the experiment and not drift. The pair is
// composed into a single PNG with labels because two separate files invite comparing
// them at different zoom levels on different days, which is how a look decision gets
// made on the wrong evidence.
//
// Usage: node x-shots.mjs <outDir>
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
const wbPlayers = [
  { id: ME, name: 'YOU', lives: 3, isHost: true },
  { id: 'p2', name: 'RIVAL', lives: 2 },
];

// Reach helpers take a query-string suffix so the SAME reach runs with and without a flag.
const reachMenu = (q) => async (p) => {
  await p.goto(`/?portal=1${q}`);
  await waitImg(p);
  await p.waitForTimeout(700); // let the wordmark's webfont land before judging the paint
};

const reachWb = (q, seconds) => async (p, mock) => {
  await p.goto(`/?portal=1${q}`);
  await waitImg(p);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'str', usedWords: ['MONSTER', 'STRAP', 'STRIKE'], timerSeconds: seconds } });
  // Long enough for the turn-start splash to clear AND for --danger to ease to its
  // resting value for this many seconds; short enough that the clock has not moved on.
  await p.waitForTimeout(1800);
};

const reachBlitz = (q) => async (p, mock) => {
  const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
  await p.goto(`/?portal=1${q}`);
  await waitImg(p);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 45, category: 'CRYPTIDS & FOLKLORE MONSTERS', categoryId: 'cryptids', rerollsRemaining: 1 } });
  await p.waitForTimeout(300);
  mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: 'MOTHMAN' } });
  await p.waitForTimeout(1500);
};

// name, [leftLabel, leftReach], [rightLabel, rightReach], viewport
const PAIRS = [
  ['7a-wb-22s', ['TODAY (22s left)', reachWb('', 22)], ['x7a ESCALATION (22s left)', reachWb('&x7a=1', 22)], [1366, 768]],
  ['7a-wb-10s', ['TODAY (10s left)', reachWb('', 10)], ['x7a ESCALATION (10s left)', reachWb('&x7a=1', 10)], [1366, 768]],
  ['7a-wb-4s', ['TODAY (4s left)', reachWb('', 4)], ['x7a ESCALATION (4s left)', reachWb('&x7a=1', 4)], [1366, 768]],
  ['7a-wb-4s-phone', ['TODAY (4s left)', reachWb('', 4)], ['x7a ESCALATION (4s left)', reachWb('&x7a=1', 4)], [390, 844]],
  ['7b-menu', ['TODAY (flat pink)', reachMenu('')], ['x7b CHROMATIC LOCKUP', reachMenu('&x7b=1')], [1366, 768]],
  ['7b-menu-phone', ['TODAY (flat pink)', reachMenu('')], ['x7b CHROMATIC LOCKUP', reachMenu('&x7b=1')], [390, 844]],
  ['7c-wb', ['TODAY (no motif)', reachWb('', 22)], ['x7c BLAST MOTIF', reachWb('&x7c=1', 22)], [1366, 768]],
  ['7c-blitz', ['TODAY (no motif)', reachBlitz('')], ['x7c GAVEL MOTIF', reachBlitz('&x7c=1')], [1366, 768]],
  ['7c-wb-phone', ['TODAY (no motif)', reachWb('', 22)], ['x7c BLAST MOTIF', reachWb('&x7c=1', 22)], [390, 844]],
];

// Stitch two PNGs into one labelled strip, in the browser so there is no image library.
const STITCH = ({ a, b, la, lb }) =>
  new Promise((resolve, reject) => {
    let done = 0;
    const ia = new Image();
    const ib = new Image();
    const go = () => {
      if (++done < 2) return;
      const GAP = 16;
      const BAR = 34;
      const c = document.createElement('canvas');
      c.width = ia.width + ib.width + GAP * 3;
      c.height = Math.max(ia.height, ib.height) + BAR + GAP * 2;
      const x = c.getContext('2d');
      x.fillStyle = '#191622';
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(ia, GAP, GAP + BAR);
      x.drawImage(ib, GAP * 2 + ia.width, GAP + BAR);
      x.fillStyle = '#fff';
      x.font = 'bold 20px ui-monospace, Menlo, Consolas, monospace';
      x.textBaseline = 'middle';
      x.fillText(la, GAP, GAP + BAR / 2);
      x.fillText(lb, GAP * 2 + ia.width, GAP + BAR / 2);
      // A hairline between the two so the eye does not read them as one wide image.
      x.fillStyle = '#4a4160';
      x.fillRect(GAP + ia.width + GAP / 2 - 1, GAP + BAR, 2, Math.max(ia.height, ib.height));
      resolve(c.toDataURL('image/png'));
    };
    ia.onerror = ib.onerror = () => reject(new Error('decode'));
    ia.onload = go;
    ib.onload = go;
    ia.src = 'data:image/png;base64,' + a;
    ib.src = 'data:image/png;base64,' + b;
  });

const browser = await chromium.launch();
const stitcher = await (await browser.newContext()).newPage();
await stitcher.goto('about:blank');

async function shoot(reach, w, h) {
  const ctx = await browser.newContext({
    baseURL: BASE,
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  let err = null;
  try {
    const mock = await installBackendMock(page);
    await reach(page, mock);
  } catch (e) {
    err = String(e).split('\n')[0].slice(0, 90);
  }
  await page.waitForTimeout(220);
  const buf = await page.screenshot();
  await ctx.close();
  return { buf, err };
}

for (const [name, [la, ra], [lb, rb], [w, h]] of PAIRS) {
  const A = await shoot(ra, w, h);
  const B = await shoot(rb, w, h);
  fs.writeFileSync(path.join(OUT, `${name}-A.png`), A.buf);
  fs.writeFileSync(path.join(OUT, `${name}-B.png`), B.buf);
  const url = await stitcher.evaluate(STITCH, {
    a: A.buf.toString('base64'),
    b: B.buf.toString('base64'),
    la,
    lb,
  });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${name.padEnd(18)} ${A.err || 'ok'} | ${B.err || 'ok'}`);
}
await browser.close();
console.log('->', OUT);
