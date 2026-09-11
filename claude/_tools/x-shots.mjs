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

const reachWb = (q, danger, tension) => async (p, mock) => {
  // --danger IS PINNED, NOT RACED. Two earlier attempts at photographing this off the
  // real clock both failed, and the reasons are worth keeping:
  //   1. maxTimer is read from the SAME turn_update as timerSeconds (GameScreen:
  //      `maxTimer = gameState.timerSeconds`), so a frame saying "4 seconds" also makes
  //      the turn 4 seconds long - ratio 1, full ring, --danger 0. The escalation got
  //      photographed at the one value where it does nothing.
  //   2. Starting a real 30s turn and waiting for the client's own countdown does not
  //      work either: against the mock the local tick does not advance, so the ring sat
  //      full through a 36s wait.
  // Pinning the eased value is also simply a better experiment - it photographs the
  // board at a KNOWN point on the curve instead of wherever a racing clock happened to
  // be, so the three shots are a controlled series. The shots are labelled with the
  // --danger value rather than a number of seconds, because that is what they show.
  await p.goto(`/?portal=1${q}`);
  await waitImg(p);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'str', usedWords: ['MONSTER', 'STRAP', 'STRIKE'], timerSeconds: 30 } });
  // Wait for the 3-2-1 to APPEAR before waiting for it to go. Waiting only for
  // `detached` resolves instantly, because at that moment the overlay has not mounted
  // yet - which put the camera back inside the countdown, where the board still reads
  // WAIT YOUR TURN and the bomb shows the intro numeral instead of the turn.
  await p.locator('.countdown-overlay').waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
  await p.locator('.countdown-overlay').waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
  // And wait for the board to actually be playable, which is the real signal that the
  // intro is over: the field stops saying WAIT YOUR TURN once the turn is ours.
  await p
    .waitForFunction(
      () => {
        const i = document.querySelector('.game-wrap input');
        return !!i && !/WAIT YOUR TURN/i.test(i.placeholder || '');
      },
      undefined,
      { timeout: 12000, polling: 200 }
    )
    .catch(() => {});
  await p.waitForTimeout(300);
  await p.evaluate(
    ({ d, t }) => {
      const el = document.querySelector('.game-wrap');
      if (!el) return;
      el.style.setProperty('--danger', String(d));
      el.setAttribute('data-tension', t);
    },
    { d: danger, t: tension }
  );
  await p.waitForTimeout(500);
};

// Reaching a mode dialog: click the card, wait for the shell. Used for the CTA variant.
const reachDialog = (q, mode) => async (p) => {
  await p.goto(`/?portal=1${q}`);
  await waitImg(p);
  await p.locator(`.game-card-magnet[data-game="${mode}"] .game-card`).click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor();
  await p.waitForTimeout(450);
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
  ['7a-wb-d00', ['TODAY (danger 0.0, calm)', reachWb('', 0, 'calm')], ['x7a ESCALATION (danger 0.0)', reachWb('&x7a=1', 0, 'calm')], [1366, 768]],
  ['7a-wb-d50', ['TODAY (danger 0.5, warn)', reachWb('', 0.5, 'warn')], ['x7a ESCALATION (danger 0.5)', reachWb('&x7a=1', 0.5, 'warn')], [1366, 768]],
  ['7a-wb-d100', ['TODAY (danger 1.0, crit)', reachWb('', 1, 'crit')], ['x7a ESCALATION (danger 1.0)', reachWb('&x7a=1', 1, 'crit')], [1366, 768]],
  ['7a-wb-d100-phone', ['TODAY (danger 1.0, crit)', reachWb('', 1, 'crit')], ['x7a ESCALATION (danger 1.0)', reachWb('&x7a=1', 1, 'crit')], [390, 844]],
  ['7b-menu', ['TODAY (flat pink)', reachMenu('')], ['x7b CHROMATIC LOCKUP', reachMenu('&x7b=1')], [1366, 768]],
  ['7b-menu-phone', ['TODAY (flat pink)', reachMenu('')], ['x7b CHROMATIC LOCKUP', reachMenu('&x7b=1')], [390, 844]],
  ['7c-wb', ['TODAY (no motif)', reachWb('', 0, 'calm')], ['x7c BLAST @ 8% (per brief)', reachWb('&x7c=1', 0, 'calm')], [1366, 768]],
  ['7c-wb-strong', ['x7c BLAST @ 8% (per brief)', reachWb('&x7c=1', 0, 'calm')], ['x7c BLAST @ 18% (judgeable)', reachWb('&x7c=2', 0, 'calm')], [1366, 768]],
  ['7c-blitz-strong', ['x7c GAVEL @ 8% (per brief)', reachBlitz('&x7c=1')], ['x7c GAVEL @ 18% (judgeable)', reachBlitz('&x7c=2')], [1366, 768]],
  ['7c-blitz', ['TODAY (no motif)', reachBlitz('')], ['x7c GAVEL MOTIF', reachBlitz('&x7c=1')], [1366, 768]],
  ['cta-wb', ['TODAY (white JOIN)', reachDialog('', 'word-bomb')], ['?dlgcta=demote', reachDialog('&dlgcta=demote', 'word-bomb')], [1366, 768]],
  ['cta-wb-phone', ['TODAY (white JOIN)', reachDialog('', 'word-bomb')], ['?dlgcta=demote', reachDialog('&dlgcta=demote', 'word-bomb')], [390, 844]],
  ['cta-blitz-phone', ['TODAY (white JOIN)', reachDialog('', 'category-blitz')], ['?dlgcta=demote', reachDialog('&dlgcta=demote', 'category-blitz')], [390, 844]],
  ['7c-wb-phone', ['TODAY (no motif)', reachWb('', 0, 'calm')], ['x7c BLAST MOTIF', reachWb('&x7c=1', 0, 'calm')], [390, 844]],
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
