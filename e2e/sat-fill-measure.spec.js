// e2e/sat-fill-measure.spec.js — MEASUREMENT ONLY (not a gate).
// "How much of the screen does each SAT panel actually occupy?" The mode-select
// panel was reported as a small card floating in a black void at 1366x768; this
// measures every SAT screen the same way so the problem is sized, not guessed.
// Run: PW_PORT=4186 npx playwright test sat-fill-measure --reporter=line
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import fs from 'node:fs';

const OUT = 'claude/sat-fill';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1536x864', width: 1536, height: 864 },
  { name: '390x844', width: 390, height: 844 },
];

const PLAY_QS = 'satRush=1&portal=1&satworst=1&stage=12000&spell=9000';
const rows = [];

async function measure(page, label, selector, vp) {
  const el = page.locator(selector).first();
  if (!(await el.count())) { rows.push({ vp: vp.name, label, note: 'ABSENT' }); return; }
  const box = await el.boundingBox();
  if (!box) { rows.push({ vp: vp.name, label, note: 'NO BOX' }); return; }
  const shorter = Math.min(vp.width, vp.height);
  rows.push({
    vp: vp.name,
    label,
    w: Math.round(box.width),
    h: Math.round(box.height),
    // the user's framing: panel size against the SHORTER viewport dimension
    pctShorter: +((Math.max(box.width, box.height) / shorter) * 100).toFixed(1),
    // and how much of the screen's AREA it actually covers
    pctArea: +(((box.width * box.height) / (vp.width * vp.height)) * 100).toFixed(1),
  });
}

for (const vp of VIEWPORTS) {
  test(`SAT panel fill @ ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await installBackendMock(page);
    await page.goto(`/?${PLAY_QS}`);

    await page.locator('[data-game="sat-rush"] .game-card').click();
    // WAIT for the cover before measuring it — the first pass measured immediately
    // after the click and recorded ABSENT for a screen that is plainly there.
    await expect(page.locator('.sr-cover')).toBeVisible();
    await page.waitForTimeout(600);
    await measure(page, 'cover', '.sr-cover', vp);
    await page.screenshot({ path: `${OUT}/${vp.name}-cover-BEFORE.png` });

    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.locator('.sr-modeselect')).toBeVisible();
    await measure(page, 'modeselect', '.sr-modeselect', vp);
    await page.screenshot({ path: `${OUT}/${vp.name}-modeselect-BEFORE.png` });

    await page.getByRole('button', { name: /BRIEFING/ }).click();
    await expect(page.locator('.sr-brief-page')).toBeVisible();
    await measure(page, 'briefing', '.sr-brief-page', vp);
    await page.screenshot({ path: `${OUT}/${vp.name}-briefing-BEFORE.png` });

    await page.getByRole('button', { name: 'Start the run' }).click();
    await expect(page.locator('.sr-slots')).toBeVisible();
    await page.waitForTimeout(400);
    await measure(page, 'play(stage)', '.sr-stage', vp);
    await page.screenshot({ path: `${OUT}/${vp.name}-play-BEFORE.png` });
  });
}

test.afterAll(async () => {
  rows.sort((a, b) => a.label.localeCompare(b.label) || a.vp.localeCompare(b.vp));
  const lines = ['| screen | viewport | w x h | % of shorter dim | % of screen area |',
                 '|---|---|---|---|---|'];
  for (const r of rows) {
    lines.push(r.note
      ? `| ${r.label} | ${r.vp} | ${r.note} | — | — |`
      : `| ${r.label} | ${r.vp} | ${r.w}x${r.h} | ${r.pctShorter}% | ${r.pctArea}% |`);
  }
  const md = lines.join('\n');
  fs.writeFileSync(`${OUT}/measure.md`, md + '\n');
  console.log('\n' + md + '\n');
});
