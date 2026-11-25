// e2e/language-rush-sweep.spec.js — nov24 round 2 (Andy: "nothing may be cut off or overlap the borders"): every
// screen of every LANGUAGE RUSH — the cover, the word bank, the modes, the setup (with the language's LONGEST
// theme name picked), the study page, a word in play, the answer card and the results — at a small phone (360x640),
// a phone (390x844), a laptop (1366x768) and a big screen (1920x1080), held to the noClip rule. It walks the screens
// by their places, not their words, so it never depends on the menu's language. SHOT_DIR=… also saves each screen.
import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { noClip } from './support/noClip.js';

const LANGS = [
  { id: 'fr', slug: 'french-rush', dir: 'frenchRush' },
  { id: 'es', slug: 'spanish-rush', dir: 'spanishRush' },
  { id: 'it', slug: 'italian-rush', dir: 'italianRush' },
  { id: 'la', slug: 'latin-rush', dir: 'latinRush' },
  { id: 'zh', slug: 'chinese-rush', dir: 'chineseRush' },
];
const SIZES = [
  [360, 640, true],
  [390, 844, true],
  [1366, 768, false],
  [1920, 1080, false],
];
const SHOTS = process.env.SHOT_DIR || '';
const TAG = process.env.SHOT_TAG || 'shot';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

for (const L of LANGS) {
  const WORDS = JSON.parse(readFileSync(new URL(`../src/data/${L.dir}/words.json`, import.meta.url), 'utf8'));
  for (const [w, h, touch] of SIZES) {
    test(`${L.id} at ${w}x${h}: every screen fits`, async ({ browser }) => {
      test.setTimeout(120_000);
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
      const page = await ctx.newPage();
      await installBackendMock(page);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const check = async (where) => {
        await page.waitForTimeout(1500); // let the press sheet + landing settle
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/${TAG}-${L.id}-${w}-${where}.png` });
        await noClip(page, `${L.id} ${w}x${h} ${where}`, { soft: true });
      };
      const url = `/${L.slug}${touch ? '?tap=1' : ''}`;

      await page.goto(url);
      await expect(page.locator('.sr-cover')).toBeVisible();
      await check('1-cover');

      // the word bank (the button beside the language picker)
      await page.locator('.fr-cover-pair').nth(1).locator('.sr-btn').click();
      await expect(page.locator('.sr-bank')).toBeVisible();
      await check('2-bank');
      await page.locator('.sr-bank .sr-setup-exits .sr-exit-chip').click();

      // the modes → STUDY FIRST → its setup, with the longest theme name picked
      await page.locator('.fr-cover-actions .fr-go').click();
      await expect(page.locator('.sr-modecard').first()).toBeVisible();
      await check('3-modes');
      await page.locator('.sr-modecard').first().click();
      await expect(page.locator('.sr-setup')).toBeVisible();
      await page.locator('.fr-setup-theme button').first().click();
      const opts = page.getByRole('option');
      const labels = await opts.allInnerTexts();
      let longest = 0;
      labels.forEach((t, i) => {
        if (t.length > labels[longest].length) longest = i;
      });
      await opts.nth(longest).click();
      await page.locator('.sr-setup-row.duo [role="radio"]').nth(1).click(); // no timer
      await page.locator('.sr-setup-opt', { hasText: /^5$/ }).click();
      await check('4-setup');
      await page.locator('.fr-setup-foot .fr-go').click();

      // the study page, then the words
      await expect(page.locator('.sr-brief-page')).toBeVisible();
      await check('5-study');
      await page.locator('.sr-brief-actions .sr-btn').click();
      let shotPlay = true;
      for (let i = 0; i < 12; i++) {
        const over = page.locator('.sr-respage');
        const gloss = page.locator('.sr-field--gloss.in .sr-gloss');
        await expect(over.or(gloss)).toBeVisible({ timeout: 15_000 });
        if (await over.isVisible()) break;
        if (shotPlay) await check('6-play');
        const text = (await gloss.innerText()).trim();
        const row = WORDS.find((r) => r.gloss === text);
        expect(row, `a word meaning "${text}"`).toBeTruthy();
        await page.evaluate((word) => {
          const b = [...document.querySelectorAll('.sr-suspect-btn')].find((x) => (x.getAttribute('aria-label') || '').replace(/^\d+: /, '') === word);
          if (b) b.click();
        }, row.word);
        await expect(page.locator('.sr-reencode')).toBeVisible();
        if (shotPlay) await check('7-answer');
        shotPlay = false;
        await page.locator('.sr-reencode .sr-continue').click();
      }
      await expect(page.locator('.sr-respage')).toBeVisible();
      await check('8-results');
      expect(errors).toEqual([]);
      await ctx.close();
    });
  }
}
