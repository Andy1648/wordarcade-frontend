// squint.mjs — PHASE 7d: the value-grouping gate, made real.
//
// Squint at a screen and one thing should still be there. That is the whole of the
// "exactly ONE element carries --v-accent" rule, and it is the one design rule in this
// project that can be MEASURED instead of argued about: render the screen, blur it hard
// enough that every glyph and edge is gone, and count how many regions still pull away
// from the page's own ground. One region = the eye has an entry point. Three regions =
// the player's eye has to choose, which is the failure Phase 1 was written to fix.
//
// METHOD (and why each choice, because the threshold IS the test):
//  * CIE L*, not linear luminance. Relative luminance crushes everything dark into the
//    bottom 1% of its range, so on a #0d0618 page a hot pink accent (Y=0.30) and a mid
//    panel (Y=0.005) look almost equally "not white" and the test only ever flags white
//    text. L* is perceptually even, so #FF4FA3 lands at 62/100 and #1a0b2e at 7/100 —
//    which is what an eye actually reports.
//  * Deviation from the page's MODAL lightness, not absolute brightness. SAT Rush is a
//    cream page where the hot thing is near-black ink; every other screen is dark where
//    the hot thing is bright. |L* - L*_mode| is the one measure that reads both.
//  * RELATIVE dominance, not an absolute cut. This is the part I got wrong first and
//    had to measure my way out of. I set an absolute "hot" line at L* deviation 0.45 and
//    the menu came back FLAT - no hot region at all - which is plainly false, since its
//    cream SAT card is the loudest thing on that screen by a mile. Sampling the actual
//    histogram showed why: the brightest cell ANYWHERE on the blurred menu reaches L*
//    0.442. A 12px blur mixes every bright shape with its own black outline and the dark
//    ground around it, so nothing on a Newgrounds-dark page survives an absolute 0.45,
//    while on the cream SAT page nearly everything would. So the line is drawn at a
//    FRACTION of each screen's own peak: hot = within 40% of the loudest thing present.
//    That asks the question the squint test is actually for - "is there ONE winner, or
//    several things equally loud?" - and it asks it identically on cream and on black.
//  * Connected components on the blurred cell grid, so a heading and its caption two
//    lines apart count as ONE region when they merge under the blur — which is exactly
//    what the eye does.
//
// Usage: node squint.mjs <outDir> [ratioOfPeak] [minAreaCells]
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { installBackendMock } from '../../e2e/support/backendMock.js';

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
// RATIO mode ("0.6") measures each screen against its OWN peak, which is the right question
// for "does THIS screen have one entry point". It is the WRONG question for comparing two
// variants of the same screen, and that bit me: demoting the dialog's white JOIN button
// dropped wb-dialog's peak from 0.954 to 0.597, which dropped the relative cut with it,
// which let dimmer things qualify as hot - so the region COUNT went up while the screen
// plainly got calmer. ABS mode ("abs:0.572") pins the cut to a fixed L* deviation so two
// variants are scored on the same bar and the numbers actually compare.
const ARG3 = String(process.argv[3] || '0.6');
const ABS = ARG3.startsWith('abs:') ? Number(ARG3.slice(4)) : null;
const RATIO = ABS == null ? Number(ARG3) : 0; // hot = within (1-RATIO) of the screen's peak
const MIN_AREA = Number(process.argv[4] || 6); // cells; smaller blobs are specks, not regions
// A screen whose loudest thing barely pulls away from its own ground has no entry point
// at all. That is its own failure and must not be reported as a clean pass.
const MIN_PEAK = 0.15;
const Q = process.argv[5] || ''; // extra query string, e.g. '&dlgcta=demote'
const CELL = 12;
const BLUR = 12; // px, per the brief
const BASE = 'http://localhost:4173';
const ME = 'e2e-player';
const waitImg = (p) => p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
const wbPlayers = [
  { id: ME, name: 'YOU', lives: 3, isHost: true },
  { id: 'p2', name: 'RIVAL', lives: 2 },
];

// ---------------------------------------------------------------- surfaces
const S = [];
const add = (name, reach) => S.push({ name, reach });

add('menu', async (p) => {
  await p.goto(`/?portal=1${Q}`);
  await waitImg(p);
});
add('shop', async (p) => {
  await p.goto(`/?portal=1${Q}`);
  await waitImg(p);
  await p.locator('.homepage-nav-btn.is-shop').click();
  await p.locator('.shop-panel').waitFor();
});
add('stats', async (p) => {
  await p.goto(`/?portal=1${Q}`);
  await waitImg(p);
  await p.locator('.homepage-nav-btn.is-stats').click();
  await p.locator('.stats-panel').waitFor();
});
add('collection', async (p) => {
  await p.goto(`/?portal=1${Q}`);
  await waitImg(p);
  await p.locator('.homepage-nav-btn.is-stats').click();
  await p.locator('.stats-overlay').waitFor();
  await p.getByRole('tab', { name: 'COLLECTION' }).click();
  await p.waitForTimeout(300);
});
add('wb-dialog', async (p) => {
  await p.goto(`/?portal=1${Q}`);
  await waitImg(p);
  await p.locator('.game-card-magnet[data-game="word-bomb"] .game-card').click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor();
});
add('blitz-dialog', async (p) => {
  await p.goto(`/?portal=1${Q}`);
  await waitImg(p);
  await p.locator('.game-card-magnet[data-game="category-blitz"] .game-card').click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor();
  await p.waitForTimeout(300);
});
add('lobby', async (p) => {
  await p.goto(`/?portal=1${Q}`);
  await waitImg(p);
  await p.locator('.game-card-magnet[data-game="word-bomb"] .game-card').click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor();
  await p.locator('.mode-dialog-btn-create').click();
  await p.locator('.lobby-wrap').waitFor();
});
add('rooms-browser', async (p) => {
  await p.goto(`/?portal=1${Q}`);
  await waitImg(p);
  await p.locator('.homepage-btn-join').click();
  await p.locator('.browser-wrap').waitFor();
});

add('wb-play', async (p, mock) => {
  await p.goto(`/?portal=1${Q}`);
  await waitImg(p);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: wbPlayers } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: wbPlayers, combo: 'str', usedWords: ['MONSTER', 'STRAP'], timerSeconds: 22 } });
  await p.waitForTimeout(1800);
});
add('blitz-play', async (p, mock) => {
  const players = [{ id: ME, name: 'YOU', isHost: true }, { id: 'p2', name: 'RIVAL' }];
  await p.goto(`/?portal=1${Q}`);
  await waitImg(p);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'category-blitz', hostId: ME, difficultyKey: 'chill', players } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'category-blitz' } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 45, category: 'CRYPTIDS & FOLKLORE MONSTERS', categoryId: 'cryptids', rerollsRemaining: 1 } });
  await p.waitForTimeout(300);
  mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: 'MOTHMAN' } });
  await p.waitForTimeout(1500);
});
const solo = (id) => async (p) => {
  await p.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch { /* private mode */ }
  });
  await p.goto(`/?portal=1&soloms=20000${Q}`);
  await waitImg(p);
  await p.waitForTimeout(300);
  await p.locator(`.game-card-magnet[data-game="${id}"] .game-card`).click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor();
  await p.locator('.mode-dialog-btn-create').click();
  await p.locator('.solo-root').waitFor();
  const i = p.locator('.solo-root input').first();
  await i.waitFor();
  await i.fill('e');
  await p.waitForTimeout(800);
};
add('chain-play', solo('chain'));
add('fuse-play', solo('fuse'));
add('sat-play', async (p) => {
  await p.goto(`/?satRush=1&portal=1${Q}`);
  await waitImg(p);
  await p.waitForTimeout(300);
  await p.locator('[data-game="sat-rush"]').click({ force: true });
  await p.waitForTimeout(500);
  const dlg = p.locator('.mode-dialog-btn-create');
  if (await dlg.count()) { await dlg.first().click().catch(() => {}); await p.waitForTimeout(400); }
  const ms = p.locator('.sr-modeselect .sr-mode, .sr-modeselect button');
  if (await ms.count()) { await ms.first().click().catch(() => {}); await p.waitForTimeout(400); }
  const go = p.getByRole('button', { name: /START|BEGIN|GO|PLAY|READY/i });
  if (await go.count()) { await go.first().click().catch(() => {}); }
  await p.waitForTimeout(1600);
});
add('wb-gameover', async (p, mock) => {
  const dead = [{ id: ME, name: 'YOU', lives: 3, isHost: true }, { id: 'p2', name: 'RIVAL', lives: 0 }];
  await p.goto(`/?portal=1${Q}`);
  await waitImg(p);
  mock.pushToClient({ type: 'room_update', payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'chill', players: dead } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'turn_update', payload: { currentPlayerId: ME, players: dead, combo: 'at', usedWords: ['CAT', 'BAT', 'RAT'], timerSeconds: 30 } });
  await p.waitForTimeout(80);
  mock.pushToClient({ type: 'game_over', payload: { winnerId: ME } });
  await p.locator('.game-over-overlay').waitFor();
  await p.waitForTimeout(900);
});
add('chain-death', async (p) => {
  await p.addInitScript(() => {
    try { localStorage.setItem('taw.xp', JSON.stringify({ lv: 30, into: 0 })); } catch { /* private mode */ }
  });
  await p.goto(`/?portal=1&soloms=350${Q}`);
  await waitImg(p);
  await p.waitForTimeout(300);
  await p.locator('.game-card-magnet[data-game="chain"] .game-card').click({ force: true });
  await p.locator('.mode-dialog-shell').waitFor();
  await p.locator('.mode-dialog-btn-create').click();
  await p.locator('.solo-root').waitFor();
  const i = p.locator('.solo-root input').first();
  await i.waitFor();
  await i.fill('a');
  await p.locator('.solo-deathcard').waitFor({ timeout: 9000 });
  await p.waitForTimeout(600);
});

// ---------------------------------------------------------------- analysis
// Runs inside a scratch page: no image library, no native deps, and the blur is the
// browser's own, so it matches the thing a player's eye is being simulated against.
const ANALYSE = ({ b64, cell, blur, ratio, minArea, minPeak, absCut }) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error('decode'));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      // Paint the ground first. blur() pulls in transparent black past the edges
      // otherwise, which invents a dark frame and with it a fake region on every
      // light-grounded screen (SAT Rush's cream page).
      ctx.filter = 'none';
      ctx.drawImage(img, 0, 0);
      const edge = ctx.getImageData(0, 0, 1, 1).data;
      ctx.fillStyle = `rgb(${edge[0]},${edge[1]},${edge[2]})`;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;

      const srgb = (v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const Lstar = (Y) => (Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y) / 100;

      const cols = Math.floor(c.width / cell);
      const rows = Math.floor(c.height / cell);
      const L = new Float64Array(cols * rows);
      for (let ry = 0; ry < rows; ry++) {
        for (let rx = 0; rx < cols; rx++) {
          let s = 0;
          let n = 0;
          for (let y = ry * cell; y < (ry + 1) * cell; y++) {
            for (let x = rx * cell; x < (rx + 1) * cell; x++) {
              const i = (y * c.width + x) * 4;
              s += 0.2126 * srgb(d[i]) + 0.7152 * srgb(d[i + 1]) + 0.0722 * srgb(d[i + 2]);
              n++;
            }
          }
          L[ry * cols + rx] = Lstar(s / n);
        }
      }
      // The page's own ground = the modal L* bucket. Not the mean: one big bright panel
      // drags a mean upward and then nothing reads as hot against it.
      const BINS = 40;
      const hist = new Array(BINS).fill(0);
      for (let i = 0; i < L.length; i++) {
        hist[Math.min(BINS - 1, Math.max(0, Math.floor(L[i] * BINS)))]++;
      }
      let mode = 0;
      for (let b = 1; b < BINS; b++) if (hist[b] > hist[mode]) mode = b;
      const ground = (mode + 0.5) / BINS;

      // The screen's own peak deviation sets the bar; "hot" is anything close to it.
      let peak = 0;
      for (let i = 0; i < L.length; i++) {
        const dv = Math.abs(L[i] - ground);
        if (dv > peak) peak = dv;
      }
      const cut = absCut != null ? absCut : peak * ratio;
      const hot = new Uint8Array(cols * rows);
      for (let i = 0; i < L.length; i++) hot[i] = Math.abs(L[i] - ground) >= cut ? 1 : 0;

      // 4-neighbour connected components over the hot cells.
      const lab = new Int32Array(cols * rows).fill(-1);
      const regions = [];
      for (let i = 0; i < hot.length; i++) {
        if (!hot[i] || lab[i] >= 0) continue;
        const id = regions.length;
        const stack = [i];
        lab[i] = id;
        let area = 0;
        let x0 = cols;
        let x1 = 0;
        let y0 = rows;
        let y1 = 0;
        let peak = 0;
        while (stack.length) {
          const j = stack.pop();
          area++;
          const jx = j % cols;
          const jy = (j - jx) / cols;
          if (jx < x0) x0 = jx;
          if (jx > x1) x1 = jx;
          if (jy < y0) y0 = jy;
          if (jy > y1) y1 = jy;
          const dv = Math.abs(L[j] - ground);
          if (dv > peak) peak = dv;
          const nb = [
            jx > 0 ? j - 1 : -1,
            jx < cols - 1 ? j + 1 : -1,
            jy > 0 ? j - cols : -1,
            jy < rows - 1 ? j + cols : -1,
          ];
          for (const k of nb) {
            if (k >= 0 && hot[k] && lab[k] < 0) {
              lab[k] = id;
              stack.push(k);
            }
          }
        }
        regions.push({ area, peak, box: [x0 * cell, y0 * cell, (x1 - x0 + 1) * cell, (y1 - y0 + 1) * cell] });
      }
      const big = regions.filter((r) => r.area >= minArea).sort((a, b) => b.area - a.area);
      let hotCells = 0;
      for (let i = 0; i < hot.length; i++) hotCells += hot[i];
      resolve({
        ground,
        peak: Number(peak.toFixed(3)),
        cut: Number(cut.toFixed(3)),
        flatPage: peak < minPeak,
        cols,
        rows,
        total: regions.length,
        regions: big.map((r) => ({ area: r.area, peak: Number(r.peak.toFixed(3)), box: r.box })),
        hotFraction: Number((hotCells / hot.length).toFixed(4)),
        blurred: c.toDataURL('image/png'),
      });
    };
    img.src = 'data:image/png;base64,' + b64;
  });

// ---------------------------------------------------------------- run
const browser = await chromium.launch();
const analyser = await (await browser.newContext()).newPage();
await analyser.goto('about:blank');
const rows = [];

// SQUINT_VIEWPORTS=all widens from the two gate sizes to the full ladder the rest of the
// suite uses. Value grouping is a composition property, and composition changes with the
// shape of the box - a screen can have one entry point at 1366x768 and three at 2560x1440
// where the same elements stop merging under the blur.
const WIDE = process.env.SQUINT_VIEWPORTS === 'all';
const VIEWPORTS = WIDE
  ? [
      [2560, 1440, '2560x1440'],
      [1920, 1080, '1920x1080'],
      [1440, 900, '1440x900'],
      [1366, 768, '1366x768'],
      [1280, 720, '1280x720'],
      [1163, 501, '1163x501'],
      [390, 844, '390x844'],
      [360, 640, '360x640'],
    ]
  : [
      [1366, 768, 'desktop'],
      [390, 844, 'phone'],
    ];

for (const [w, h, tag] of VIEWPORTS) {
  for (const s of S) {
    const ctx = await browser.newContext({
      baseURL: BASE,
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    let status = 'OK';
    let res = null;
    try {
      const mock = await installBackendMock(page);
      await s.reach(page, mock);
    } catch (e) {
      status = 'REACH_FAIL ' + String(e).split('\n')[0].slice(0, 60);
    }
    await page.waitForTimeout(250);
    try {
      const buf = await page.screenshot();
      fs.writeFileSync(path.join(OUT, `${s.name}-${tag}.png`), buf);
      res = await analyser.evaluate(ANALYSE, {
        b64: buf.toString('base64'),
        cell: CELL,
        blur: BLUR,
        ratio: RATIO,
        minArea: MIN_AREA,
        minPeak: MIN_PEAK,
        absCut: ABS,
      });
      fs.writeFileSync(path.join(OUT, `${s.name}-${tag}-blur.png`), Buffer.from(res.blurred.split(',')[1], 'base64'));
      delete res.blurred;
      // WHICH ELEMENT IS EACH REGION? Counting regions is not enough, and finding that
      // out was the most useful thing this harness did. The lobby scored a clean
      // "1 region, PASS" on one variant - and the region was the white NAME FIELD, while
      // the CONTINUE button it exists to get pressed never reached the bar in ANY
      // variant. A screen with one entry point on the wrong element passes a region count
      // and fails the actual design rule. So each region is hit-tested back in the LIVE
      // page at its centre, and the report names what is actually there.
      res.regions = await page.evaluate((boxes) => {
        return boxes.map((b) => {
          const cx = b.box[0] + b.box[2] / 2;
          const cy = b.box[1] + b.box[3] / 2;
          const el = document.elementFromPoint(cx, cy);
          let name = '(nothing)';
          if (el) {
            // Walk up to the nearest element with a class, so the answer is a component
            // rather than an anonymous span or text wrapper.
            let n = el;
            while (n && !String(n.className || '').trim() && n.parentElement) n = n.parentElement;
            const cls = String(n.className || '').trim().split(/\s+/)[0];
            name = cls ? `.${cls}` : n.tagName.toLowerCase();
          }
          return { ...b, at: name };
        });
      }, res.regions);
    } catch (e) {
      if (status === 'OK') status = 'SHOT_FAIL ' + String(e).split('\n')[0].slice(0, 60);
    }
    rows.push({ surface: s.name, tag, status, ...(res || {}) });
    await ctx.close();
  }
}
await browser.close();

// DOMINANCE. A raw region COUNT over-reports, and the wide run showed how badly: the Word
// Bomb game-over screen scored 4 regions at 2560x1440 - but they were 175, 60, 9 and 7
// cells. One region 17-25x the size of the specks beside it is not a screen with four
// entry points; it is a screen with one entry point and some chips. What actually
// separates "one thing to look at" from "several things competing" is the ratio of the
// largest region to the next largest. Below 4x, the eye genuinely has to choose.
const DOMINANCE = 4;
const dominance = (r) => {
  const a = (r.regions || []).map((x) => x.area).sort((x, y) => y - x);
  if (a.length < 2) return Infinity;
  return a[0] / a[1];
};

const verdict = (r) => {
  if (r.status !== 'OK' || !r.regions) return 'SKIP';
  // In ABS mode a low peak is the POINT of the comparison, not a disqualifier.
  if (r.flatPage && ABS == null) return 'FLAT'; // nothing pops at all - no entry point either
  if (r.regions.length === 1) return 'PASS';
  if (r.regions.length === 0) return 'FLAT';
  // One region far larger than everything else still gives the eye a single entry point.
  return dominance(r) >= DOMINANCE ? 'DOMIN' : 'BUSY';
};
console.log(`\nSQUINT | blur ${BLUR}px, cell ${CELL}px, ${ABS != null ? `ABSOLUTE cut at L* deviation ${ABS}` : `hot = within ${((1 - RATIO) * 100).toFixed(0)}% of the screen's own peak`}, min region ${MIN_AREA} cells\n`);
console.log('surface              view     ground  peak   cut    hot%   regions dom    verdict  top areas');
for (const r of rows) {
  const areas = (r.regions || [])
    .slice(0, 5)
    .map((x) => `${x.area}${x.at ? ' ' + x.at : ''}`)
    .join(', ');
  const pct = ((r.hotFraction ?? 0) * 100).toFixed(1).padStart(4);
  console.log(
    `${r.surface.padEnd(20)} ${r.tag.padEnd(8)} ${(r.ground ?? 0).toFixed(3)}   ${(r.peak ?? 0).toFixed(3)}  ${(r.cut ?? 0).toFixed(3)}  ${pct}%  ${String((r.regions || []).length).padStart(5)}   ${(Number.isFinite(dominance(r)) ? dominance(r).toFixed(2) : '-').padStart(5)}  ${verdict(r).padEnd(7)}  ${areas}${r.status !== 'OK' ? '  ' + r.status : ''}`
  );
}
fs.writeFileSync(path.join(OUT, 'squint.json'), JSON.stringify({ blur: BLUR, cell: CELL, ratio: RATIO, minArea: MIN_AREA, minPeak: MIN_PEAK, rows }, null, 2));
const n = (v) => rows.filter((r) => verdict(r) === v).length;
console.log(`\n${n('PASS')} single-region / ${n('DOMIN')} one dominant (>=${DOMINANCE}x) / ${n('BUSY')} contested / ${n('FLAT')} flat / ${n('SKIP')} unreached`);
console.log('->', OUT);
