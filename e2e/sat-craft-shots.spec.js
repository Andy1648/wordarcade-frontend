// e2e/sat-craft-shots.spec.js — the SHOT RUN for feat/sat-craft. Not a gate: it
// exists so the craft pass is judged by looking at it. Every state x every
// viewport x both run styles into claude/sat-craft-shots/.
//
// Run with:  PW_PORT=4184 npx playwright test sat-craft-shots
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import fs from 'node:fs';

const OUT = 'claude/sat-craft-shots';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
];

// slow cadences so a shot lands on a stable frame rather than mid-reveal
const PLAY_QS = 'satRush=1&portal=1&satworst=1&stage=12000&spell=9000';

async function toPlay(page, mode, extra = '') {
  await installBackendMock(page);
  await page.goto(`/?${PLAY_QS}${extra}`);
  await page.locator('[data-game="sat-rush"] .game-card').click();
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('.sr-modeselect')).toBeVisible();
  await page.getByRole('button', { name: mode === 'lineup' ? /LINEUP/ : /BRIEFING/ }).click();
  if (mode !== 'lineup') {
    await expect(page.locator('.sr-brief-page')).toBeVisible();
    await page.getByRole('button', { name: 'Start the run' }).click();
  }
  await expect(page.locator('.sr-slots')).toBeVisible();
  await page.waitForTimeout(500);
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    for (const mode of ['briefing', 'lineup']) {
      test(`${mode} first sight + capture + escape`, async ({ page }) => {
        await toPlay(page, mode);
        await page.screenshot({ path: `${OUT}/${vp.name}-${mode}-1-first-sight.png` });

        // A CAPTURE. Mashing one wrong key reveals a letter every third press
        // (engine wrongKeystrokeRevealEvery), so enough presses spell the word out
        // and complete it — a real clear, with the real CAPTURED!! burst.
        const score = page.locator('.sr-hud .sr-hcell').first().locator('.sr-hval');
        for (let i = 0; i < 90; i++) {
          if (await page.locator('.sr-stamp').count()) break;
          await page.keyboard.press('q');
        }
        await page.screenshot({ path: `${OUT}/${vp.name}-${mode}-2-capture.png` });
        await expect(score).toBeVisible();

        // AN ESCAPE. Give up the word: the ESCAPED!! burst + the page tear.
        await page.waitForTimeout(1800);
        await page.keyboard.press('x'); // dismiss the re-encode teaching beat
        await page.waitForTimeout(600);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(120);
        await page.screenshot({ path: `${OUT}/${vp.name}-${mode}-3-escape.png` });
      });
    }

    // MID SPELL-ALONG: the final stage with four letters already stamped in.
    test('mid spell-along, slots partly stamped', async ({ page }) => {
      await installBackendMock(page);
      await page.goto('/?satrush=1&tune=1&satworst=1&freeze=1&scene=normal&lock=4');
      await expect(page.locator('.sr-slots')).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${vp.name}-spellalong.png` });
    });

    for (const scene of ['deep', 'revenant', 'silver', 'results']) {
      test(`scene ${scene}`, async ({ page }) => {
        await installBackendMock(page);
        await page.goto(`/?satrush=1&tune=1&satworst=1&freeze=1&scene=${scene}`);
        await expect(page.locator(scene === 'results' ? '.sr-respage' : '.sr-slots')).toBeVisible();
        // THE RESULTS PAGE ARRIVES IN STAGES. Its lower half (the cleared/missed strip, the run
        // film-strip, the hardest clear, the share bar and the actions) enters on a staggered
        // opacity transition and is opacity:0 for the first ~600ms. Shooting before that lands
        // photographs a half-empty page and hides everything below the fold.
        if (scene === 'results') await expect(page.locator('.sr-results-actions.in')).toBeVisible();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${OUT}/${vp.name}-scene-${scene}.png` });
      });
    }
  });
}

// A REAL LINEUP. Every other shot runs ?satworst=1, which serves the deck's longest prompt
// cloned under distinct keys — right for a layout gate, wrong for judging the look, because the
// six same-length "suspects" all come out as NEPOTISM396 / NEPOTISM528. This one is a normal
// draw, so the lineup is the six real words a player sees.
for (const vp of [{ name: '1366x768', width: 1366, height: 768 }, { name: '390x844', width: 390, height: 844 }]) {
  test(`${vp.name} real lineup (no satworst)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await installBackendMock(page);
    await page.goto('/?satRush=1&portal=1&stage=12000&spell=9000');
    await page.locator('[data-game="sat-rush"] .game-card').click();
    await page.getByRole('button', { name: 'Play' }).click();
    await page.getByRole('button', { name: /LINEUP/ }).click();
    await expect(page.locator('.sr-slots')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/${vp.name}-lineup-real.png` });
  });
}

// THE RARITY MOMENT, in this mode's own materials: ?rarityempty=1 forces every
// accepted word to score OBSCURE, which is the negative-reprint chip.
test('1366x768 obscure capture (rarity moment)', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await toPlay(page, 'briefing', '&rarityempty=1');
  for (let i = 0; i < 90; i++) {
    if (await page.locator('.sr-react').count()) break;
    await page.keyboard.press('q');
  }
  await page.screenshot({ path: `${OUT}/1366x768-obscure-capture.png` });
});
