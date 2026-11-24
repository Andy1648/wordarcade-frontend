// e2e/language-rush.spec.js — LANGUAGE RUSH (nov24): Spanish, Italian, Latin and Chinese Rush are French Rush
// with their own words, at their own links. In each language, at a laptop (1366x768) and a small phone
// (360x640): the cover names the language, a round plays end to end (the meaning first, typed WITHOUT accents
// or macrons — Chinese types the English), the answer card lands, and NO text is clipped anywhere on the way:
// nothing cut off by its box, nothing off the screen, no page scroll. A teacher's CREATE ROOM sends that
// language's words and hands out that language's link.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installBackendMock } from './support/backendMock.js';

const LANGS = [
  { id: 'es', slug: 'spanish-rush', dir: 'spanishRush', title: 'SPANISH', theme: /Families/i },
  { id: 'it', slug: 'italian-rush', dir: 'italianRush', title: 'ITALIAN', theme: /Families/i },
  { id: 'la', slug: 'latin-rush', dir: 'latinRush', title: 'LATIN', theme: /People & family/i },
  { id: 'zh', slug: 'chinese-rush', dir: 'chineseRush', title: 'CHINESE', theme: /Families/i },
];
const SIZES = [
  [1366, 768],
  [360, 640],
];
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const LISTS = ['.sr-bank-list', '.sr-brief-list', '.sr-lineup', '.fr-class-chips', '.fr-class-summary', '.fr-pick-list'];

// CLIPPING: any element that prints its own text must show all of it — not wider/taller than a box that hides
// overflow, and not past the screen edge. Plus the French Rush fit rules: no page scroll, no text under 11px.
async function noClip(page, where) {
  const bad = await page.evaluate((lists) => {
    const out = [];
    const se = document.scrollingElement;
    if (se.scrollHeight > window.innerHeight + 1 || se.scrollWidth > window.innerWidth + 1) out.push(`page scrolls ${se.scrollWidth}x${se.scrollHeight}`);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const el of document.querySelectorAll('#root *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
      if (el.closest('[aria-hidden="true"]')) continue; // decorative stamps (a ruled-out choice's NON band) are meant to overhang
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue; // empty, or a screen-reader-only label
      const inList = lists.some((s) => el.closest(s));
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!ownText) continue;
      const label = `"${el.textContent.trim().slice(0, 40)}" (${String(el.className).slice(0, 40)})`;
      if (parseFloat(cs.fontSize) < 11) out.push(`${parseFloat(cs.fontSize)}px text: ${label}`);
      const hidesX = /(hidden|clip)/.test(cs.overflowX) || cs.textOverflow === 'ellipsis';
      const hidesY = /(hidden|clip)/.test(cs.overflowY);
      if (hidesX && el.scrollWidth > el.clientWidth + 1) out.push(`cut off sideways: ${label} ${el.scrollWidth}>${el.clientWidth}`);
      if (hidesY && el.scrollHeight > el.clientHeight + 2) out.push(`cut off below: ${label} ${el.scrollHeight}>${el.clientHeight}`);
      if (!inList && (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1)) out.push(`off screen: ${label} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
      // an ancestor that hides overflow and cuts this text off
      for (let a = el.parentElement; a && a.id !== 'root'; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (!/(hidden|clip)/.test(acs.overflowX + acs.overflowY)) continue;
        if (lists.some((s) => a.matches(s))) break;
        const ar = a.getBoundingClientRect();
        if (r.left < ar.left - 1 || r.right > ar.right + 1 || r.bottom > ar.bottom + 2 || r.top < ar.top - 2) out.push(`cut off by ${String(a.className).slice(0, 30)}: ${label}`);
        break;
      }
    }
    // the cover title must sit inside its page (a longer language name must not run past the frame)
    const title = document.querySelector('.sr-cover .sr-title');
    if (title) {
      const range = document.createRange();
      range.selectNodeContents(title);
      const t = range.getBoundingClientRect(); // the printed letters, not the box
      const c = title.closest('.sr-cover').getBoundingClientRect();
      if (t.left < c.left - 1 || t.right > c.right + 1) out.push(`title runs past the page: ${Math.round(t.left)}..${Math.round(t.right)} vs ${Math.round(c.left)}..${Math.round(c.right)}`);
    }
    return out;
  }, LISTS);
  expect(bad, where).toEqual([]);
}

for (const L of LANGS) {
  const WORDS = JSON.parse(readFileSync(new URL(`../src/data/${L.dir}/words.json`, import.meta.url), 'utf8'));
  for (const [w, h] of SIZES) {
    test(`${L.title} RUSH at ${w}x${h}: one round plays, nothing clips`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await installBackendMock(page);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/${L.slug}`);
      await expect(page.locator('.sr-cover .sr-title')).toContainText(L.title);
      await expect(page.locator('.sr-cover')).not.toContainText(/FRENCH/);
      await noClip(page, 'cover');

      await page.getByRole('button', { name: /^Play$/ }).click();
      await page.getByRole('button', { name: /QUIZ/ }).click();
      await expect(page.locator('.sr-setup')).toBeVisible();
      await page.getByRole('button', { name: /^theme/ }).click();
      await page.getByRole('option', { name: L.theme }).click();
      await page.getByRole('radio', { name: /NO TIMER/ }).click();
      await noClip(page, 'setup');
      await page.getByRole('button', { name: /^Start$/ }).click();

      await expect(page.locator('.sr-field--gloss.in')).toBeVisible();
      await noClip(page, 'play: meaning');
      await page.getByRole('button', { name: /Hint/ }).click();
      await expect(page.locator('.sr-field--sentence.in')).toBeVisible();
      await noClip(page, 'play: example');

      const gloss = (await page.locator('.sr-gloss').innerText()).trim();
      const row = WORDS.find((r) => r.gloss === gloss);
      expect(row, `a word with the meaning "${gloss}"`).toBeTruthy();
      await page.locator('.sr-body').click({ position: { x: 4, y: 4 } }).catch(() => {});
      await page.keyboard.type(fold(row.word));

      const card = page.locator('.sr-reencode');
      await expect(card).toBeVisible();
      await expect(card).toContainText(L.id === 'zh' ? row.word : row.display);
      await page.waitForTimeout(450); // let the card's landing print settle
      await noClip(page, 'answer card');
      await page.getByRole('button', { name: /Continue/ }).click();
      await expect(card).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  test(`${L.title} RUSH: CREATE ROOM sends this language's words and this language's link`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const mock = await installBackendMock(page);
    await page.goto(`/${L.slug}`);
    await page.getByRole('button', { name: /^Create room$/i }).click();
    await page.locator('.fr-class-foot').getByRole('button', { name: /^Create room$/i }).click();
    const sent = await mock.waitForSent('class_create');
    const rows = sent.payload.rows;
    expect(rows).toHaveLength(20);
    const known = new Set(WORDS.map((r) => r.word));
    for (const r of rows) {
      expect(known.has(r.word), r.word).toBe(true);
      expect(r.lang).toBe(L.id);
    }
    mock.pushToClient({ type: 'class_created', payload: { code: 'K7QM', hostToken: 'tok' } });
    mock.pushToClient({
      type: 'class_state',
      payload: { code: 'K7QM', round: 1, role: 'host', total: rows.length, set: { ...sent.payload.set, voice: 'off' }, hostName: 'Teacher', hostAway: false, phase: 'lobby', index: 0, rows, roster: [], studentCount: 0 },
    });
    await expect(page.locator('.fr-class-code')).toHaveText('K7QM');
    await expect(page.locator('.fr-class-page')).toContainText(L.slug);
    await noClip(page, 'lobby');
  });
}

test('the cover picks the language: each one is its own link', async ({ page }) => {
  await installBackendMock(page);
  await page.goto('/french-rush');
  await page.getByRole('button', { name: /^language/ }).click();
  await page.getByRole('option', { name: 'Español' }).click();
  await page.waitForURL('**/spanish-rush');
  await expect(page.locator('.sr-cover .sr-title')).toContainText('SPANISH');
});
