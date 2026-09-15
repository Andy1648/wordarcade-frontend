// e2e/sat-field-variants.spec.js — SHOT RUN for the mode-select field taste call.
// Not a gate. Captures the current screen and both treatments at every viewport,
// and measures each so "fills 55-70% of the shorter dimension" is a number.
// Run: PW_PORT=4186 npx playwright test sat-field-variants --workers=1 --reporter=line
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import fs from 'node:fs';

const OUT = 'claude/sat-field';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: '1536x864', width: 1536, height: 864 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x640', width: 320, height: 640 },
];
const VARIANTS = [
  { key: 'BEFORE', qs: '' },
  { key: 'A-panel', qs: '&satfield=a' },
  { key: 'B-field', qs: '&satfield=b' },
];

const BASE_QS = 'satRush=1&portal=1&satworst=1&stage=12000&spell=9000';
const rows = [];

test.describe.configure({ mode: 'serial' });

for (const vp of VIEWPORTS) {
  for (const v of VARIANTS) {
    test(`${vp.name} ${v.key}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await installBackendMock(page);
      await page.goto(`/?${BASE_QS}${v.qs}`);
      await page.locator('[data-game="sat-rush"] .game-card').click();
      await page.getByRole('button', { name: 'Play' }).click();
      const panel = page.locator('.sr-modeselect');
      await expect(panel).toBeVisible();
      // Settle HARD before the shutter. At 250ms the menu's outgoing transition layer
      // was still painting over the panel and every shot carried stray marks that
      // looked like a texture defect (they are not — the settled card is clean).
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${OUT}/${vp.name}-${v.key}.png` });

      const box = await panel.boundingBox();
      const shorter = Math.min(vp.width, vp.height);
      rows.push({
        vp: vp.name, variant: v.key,
        w: Math.round(box.width), h: Math.round(box.height),
        hPctShorter: +((box.height / shorter) * 100).toFixed(1),
        wPctWidth: +((box.width / vp.width) * 100).toFixed(1),
        pctArea: +(((box.width * box.height) / (vp.width * vp.height)) * 100).toFixed(1),
      });

      // A panel that now overflows its own screen would be a worse defect than the
      // one being fixed, so every variant is checked for scroll at every size.
      const overflow = await panel.evaluate((el) => ({
        v: el.scrollHeight - el.clientHeight,
        h: el.scrollWidth - el.clientWidth,
      }));
      rows[rows.length - 1].scrollY = overflow.v > 1 ? `SCROLLS +${overflow.v}` : 'fits';
      rows[rows.length - 1].scrollX = overflow.h > 1 ? `XSCROLL +${overflow.h}` : 'ok';
    });
  }
}

test.afterAll(() => {
  const lines = [
    '| viewport | variant | w x h | height % of shorter | width % of vw | % screen area | vscroll | xscroll |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.vp} | ${r.variant} | ${r.w}x${r.h} | ${r.hPctShorter}% | ${r.wPctWidth}% | ${r.pctArea}% | ${r.scrollY} | ${r.scrollX} |`),
  ];
  const md = lines.join('\n');
  fs.writeFileSync(`${OUT}/variants.md`, md + '\n');
  console.log('\n' + md + '\n');
});
