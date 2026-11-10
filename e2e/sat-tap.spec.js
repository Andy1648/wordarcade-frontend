// e2e/sat-tap.spec.js — TAP-TO-ANSWER (feat/sat-tap).
//
// Andy: "i think SAT rush doesnt need typing just tapping the right answer is enough" — the phone
// keyboard covered half the poster. On a TOUCH device (coarse pointer, no hover) the card's choices
// are the input: no text field is mounted, so nothing can focus and no soft keyboard can open, and
// the whole poster fits the phone with no page scroll. A desktop still types (the choices are a
// clickable / 1-N shortcut beside the slots).
//
// The answer is known the way a player knows it: the BRIEFING studies five words, the served card's
// sentence matches one of them.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { revealMode, satSetupGo } from './support/menu.js';

const SHOTS = process.env.SAT_TAP_SHOTS || 'test-results/sat-tap';

function contextOf(locator, innerSelector) {
  return locator.evaluate((el, sel) => {
    const inner = el.querySelector(sel);
    const t = el.textContent.replace(inner ? inner.textContent : '', '');
    return t.replace(/\s+/g, ' ').trim();
  }, innerSelector);
}

// Menu → SAT dialog → BRIEFING → setup → study five cards → Start. Returns the studied words.
async function startBriefing(page) {
  await installBackendMock(page);
  await page.goto('/?satRush=1&portal=1');
  await (await revealMode(page, 'sat-rush')).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: /BRIEFING/ }).click();
  await satSetupGo(page);
  await expect(page.locator('.sr-brief-page')).toBeVisible();
  const cards = page.locator('.sr-brief-card');
  const n = await cards.count();
  const briefed = [];
  for (let i = 0; i < n; i++) {
    const sentence = cards.nth(i).locator('.sr-brief-sentence');
    briefed.push({
      word: (await sentence.locator('.sr-brief-fill').innerText()).trim().toLowerCase(),
      context: await contextOf(sentence, '.sr-brief-fill'),
    });
  }
  await page.getByRole('button', { name: 'Start the run' }).click();
  await expect(page.locator('.sr-mult')).toBeVisible();
  return briefed;
}

// The served word: the briefed word whose sentence matches the card's LAST SEEN clue.
async function servedWord(page, briefed) {
  const served = await contextOf(page.locator('.sr-sentence'), '.sr-blank');
  const hit = briefed.find((b) => b.context === served);
  expect(hit, 'the served word is one of the briefed words').toBeTruthy();
  return hit.word;
}

const livesLeft = (page) =>
  page.locator('.sr-lives .sr-life:not(.gone)').count();

for (const vp of [
  { width: 360, height: 640 },
  { width: 390, height: 844 },
]) {
  test.describe(`SAT tap-to-answer on a touch phone ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: vp, hasTouch: true, isMobile: true });

    test('choices show, no field exists or is focused, no scroll; a right tap clears, a wrong tap costs a life', async ({ page }) => {
      test.setTimeout(60000);
      const briefed = await startBriefing(page);

      // THE CHOICES ARE THE INPUT: four tappable suspects, and no text field anywhere on the page
      const choices = page.locator('.sr-card.tap .sr-suspect-btn');
      await expect(choices).toHaveCount(4);
      await expect(page.locator('.sr-app input, .sr-app textarea')).toHaveCount(0);
      await expect(page.locator('.sr-slots')).toHaveCount(0);
      const focusedTag = await page.evaluate(() => (document.activeElement ? document.activeElement.tagName : ''));
      expect(['INPUT', 'TEXTAREA']).not.toContain(focusedTag);

      // ...each a >= 64px thumb target with >= 16px type, all on screen, and the page does not scroll
      const fit = await page.evaluate(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const box = (el) => el.getBoundingClientRect();
        const btns = [...document.querySelectorAll('.sr-card.tap .sr-suspect-btn')].map((b) => {
          const r = box(b);
          const w = b.querySelector('.sr-suspect-word');
          return { h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right, fs: parseFloat(getComputedStyle(w).fontSize) };
        });
        const se = document.scrollingElement;
        const inView = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const r = box(el);
          return r.top >= 0 && r.bottom <= vh + 0.5 && r.left >= 0 && r.right <= vw + 0.5;
        };
        return {
          btns,
          vw,
          vh,
          pageScrolls: se.scrollHeight > se.clientHeight + 1 || se.scrollWidth > se.clientWidth + 1,
          clue: inView('.sr-sentence'),
          mult: inView('.sr-mult'),
        };
      });
      expect(fit.pageScrolls, 'the page never scrolls').toBe(false);
      expect(fit.clue, 'the clue is on screen').toBe(true);
      expect(fit.mult, 'the multiplier is on screen').toBe(true);
      for (const b of fit.btns) {
        expect(b.h, 'a 64px thumb target').toBeGreaterThanOrEqual(64);
        expect(b.fs, 'choice text >= 16px').toBeGreaterThanOrEqual(16);
        expect(b.top).toBeGreaterThanOrEqual(0);
        expect(b.bottom).toBeLessThanOrEqual(fit.vh + 0.5);
        expect(b.left).toBeGreaterThanOrEqual(0);
        expect(b.right).toBeLessThanOrEqual(fit.vw + 0.5);
      }
      await page.screenshot({ path: `${SHOTS}/tap-${vp.width}x${vp.height}.png` });

      // A tap on the board must not summon a field either
      await page.locator('.sr-sentence').tap({ force: true });
      await expect(page.locator('.sr-app input')).toHaveCount(0);

      // THE RIGHT TAP CLEARS: points bank, no life is lost
      const scoreCell = page.locator('.sr-hud .sr-hcell').first().locator('.sr-hval');
      const before = await scoreCell.innerText();
      const lives0 = await livesLeft(page);
      const target = await servedWord(page, briefed);
      await page.locator('.sr-card.tap .sr-suspect-btn', { hasText: new RegExp(`^${target}$`, 'i') }).tap();
      await expect(scoreCell).not.toHaveText(before);
      expect(await livesLeft(page)).toBe(lives0);
      await page.screenshot({ path: `${SHOTS}/tap-${vp.width}x${vp.height}-clear.png` });

      // THE WRONG TAP IS A MISS: the next word, a choice that is not the answer, one life gone
      await expect(page.locator('.sr-card.tap .sr-suspect-btn:not([disabled])')).toHaveCount(4, { timeout: 10000 });
      const next = await servedWord(page, briefed);
      const labels = await page.locator('.sr-card.tap .sr-suspect-btn .sr-suspect-word').allInnerTexts();
      const wrong = labels.find((t) => t.trim().toLowerCase() !== next);
      expect(wrong).toBeTruthy();
      await page.locator('.sr-card.tap .sr-suspect-btn', { hasText: new RegExp(`^${wrong.trim()}$`, 'i') }).tap();
      await expect.poll(() => livesLeft(page)).toBe(lives0 - 1);
      await expect(page.locator('.sr-reencode.miss')).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/tap-${vp.width}x${vp.height}-miss.png` });
    });
  });
}

test.describe('SAT on a desktop 1366x768 still types', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('the field + slots are up, the choices show with key badges, typing the word clears', async ({ page }) => {
    test.setTimeout(60000);
    const briefed = await startBriefing(page);
    await expect(page.locator('.sr-app input.sr-keyinput')).toHaveCount(1);
    await expect(page.locator('.sr-slots')).toBeVisible();
    await expect(page.locator('.sr-card.tap')).toHaveCount(0);
    await expect(page.locator('.sr-suspect-btn')).toHaveCount(4);
    await expect(page.locator('.sr-suspect-key').first()).toHaveText('1');
    await page.screenshot({ path: `${SHOTS}/desktop-1366x768.png` });

    const scoreCell = page.locator('.sr-hud .sr-hcell').first().locator('.sr-hval');
    const before = await scoreCell.innerText();
    const target = await servedWord(page, briefed);
    await page.keyboard.type(target, { delay: 20 });
    await expect(scoreCell).not.toHaveText(before);

    // ...and on the next word a number key picks its choice (the desktop shortcut)
    await expect(page.locator('.sr-suspect-btn:not([disabled])')).toHaveCount(4, { timeout: 10000 });
    const next = await servedWord(page, briefed);
    const labels = (await page.locator('.sr-suspect-btn .sr-suspect-word').allInnerTexts()).map((t) => t.trim().toLowerCase());
    const idx = labels.indexOf(next);
    expect(idx).toBeGreaterThanOrEqual(0);
    const mid = await scoreCell.innerText();
    await page.keyboard.press(String(idx + 1));
    await expect(scoreCell).not.toHaveText(mid);
  });
});
