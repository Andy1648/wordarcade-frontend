// e2e/french-rush-fit.spec.js — FRENCH RUSH fits every screen a class uses (nov21: a teacher now runs her
// whole class on it). At laptop, projector, Chromebook and phone sizes, every French Rush screen —
// cover, modes, setup, play, CREATE ROOM, the teacher's board — must:
//   - never scroll (the page or any element), except a real list;
//   - print nothing under 11px;
//   - and a first visit's setup is TIMED + 20 words (solo QUIZ and CREATE ROOM alike).
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { RUSH_LANGS, re } from './support/rushMenu.js';
// the menus speak the language (nov24 round 2): match them by the language's own words
const M = RUSH_LANGS.fr.menu;

const SIZES = [
  [1920, 1080],
  [1536, 750],
  [1366, 768],
  [1280, 600],
  [1093, 515],
  [390, 844],
  [360, 640],
];
// real lists may scroll inside their own box
const LISTS = ['.sr-bank-list', '.sr-brief-list', '.sr-lineup', '.fr-class-chips', '.fr-class-summary', '.fr-pick-list'];

async function audit(page, where) {
  const bad = await page.evaluate((lists) => {
    const out = [];
    const se = document.scrollingElement;
    if (se.scrollHeight > window.innerHeight + 1 || se.scrollWidth > window.innerWidth + 1) {
      out.push(`page scrolls ${se.scrollWidth}x${se.scrollHeight}`);
    }
    for (const el of document.querySelectorAll('#root *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const scrollY = /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
      const scrollX = /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
      if ((scrollY || scrollX) && !lists.some((s) => el.closest(s))) {
        out.push(`scrolls: ${el.className || el.tagName} (${el.scrollHeight} > ${el.clientHeight})`);
      }
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (ownText && parseFloat(cs.fontSize) < 11) out.push(`${parseFloat(cs.fontSize)}px text: "${el.textContent.trim().slice(0, 30)}"`);
    }
    return out;
  }, LISTS);
  expect(bad, `${where}`).toEqual([]);
}

for (const [w, h] of SIZES) {
  test(`French Rush fits ${w}x${h}: cover, modes, setup (TIMED + 20), play`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await installBackendMock(page);
    await page.goto('/french-rush');
    await expect(page.locator('.sr-cover')).toBeVisible();
    // the cover is the title and the ways in — no blurbs, no word counts
    await expect(page.locator('.sr-cover')).not.toContainText(/WORDS|THEMES|TIMER|ACCENTS/);
    await expect(page.getByRole('button', { name: re(M.create) })).toBeVisible();
    await audit(page, 'cover');

    await page.getByRole('button', { name: re(M.play) }).click();
    await expect(page.locator('.sr-modecard').first()).toBeVisible();
    await audit(page, 'modes');

    await page.getByRole('button', { name: re(M.quiz) }).click();
    await expect(page.locator('.sr-setup')).toBeVisible();
    await expect(page.getByRole('radio', { name: re(M.timed) })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: /^20$/ })).toHaveAttribute('aria-checked', 'true');
    for (const level of Object.values(M.levels)) await expect(page.getByRole('radio', { name: re(level, false) })).toBeVisible();
    await audit(page, 'setup');

    await page.getByRole('button', { name: re(M.start) }).click();
    await expect(page.locator('.sr-field--gloss.in')).toBeVisible();
    await expect(page.locator('.sr-hud')).toContainText(/\/20/);
    await expect(page.locator('.fr-progress')).toBeVisible();
    await audit(page, 'play');
  });

  test(`French Rush fits ${w}x${h}: CREATE ROOM (20 words) and the teacher's board shows the prompt`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const mock = await installBackendMock(page);
    await page.goto('/french-rush');
    await page.getByRole('button', { name: re(M.create) }).click();
    await expect(page.locator('.fr-class-setup')).toBeVisible();
    await expect(page.getByRole('radio', { name: /^20$/ })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: /^HARD/ })).toBeVisible();
    await audit(page, 'room setup');

    await page.locator('.fr-class-foot').getByRole('button', { name: /^Create room$/i }).click();
    const sent = await mock.waitForSent('class_create');
    const rows = sent.payload.rows;
    expect(rows).toHaveLength(20);
    const base = { code: 'K7QM', round: 1, role: 'host', total: rows.length, set: { ...sent.payload.set, voice: 'off' }, hostName: 'Teacher', hostAway: false };
    const roster = Array.from({ length: 23 }, (_, i) => ({ id: `s${i}`, name: `Student ${i + 1}`, away: false }));
    mock.pushToClient({ type: 'class_created', payload: { code: 'K7QM', hostToken: 'tok' } });
    mock.pushToClient({ type: 'class_state', payload: { ...base, phase: 'lobby', index: 0, rows, roster, studentCount: 23 } });
    await expect(page.locator('.fr-class-code')).toHaveText('K7QM');
    await audit(page, 'lobby');

    const who = { clean: [], hinted: [], miss: [], waiting: [] };
    mock.pushToClient({ type: 'class_state', payload: { ...base, phase: 'word', index: 3, roster, studentCount: 23, tally: { index: 3, answered: 14, clean: 9, hinted: 3, miss: 2, total: 23, away: 0, who } } });
    // the board shows the CURRENT prompt, big, and one box per letter of the French
    const row = rows[3];
    await expect(page.locator('.fr-class-gloss')).toHaveText(row.gloss);
    await expect(page.locator('.fr-class-answer')).toHaveCount(0);
    await expect(page.locator('.fr-class-boxword i')).toHaveCount(row.word.replace(/\s+/g, '').length);
    const fs = await page.locator('.fr-class-gloss').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fs).toBeGreaterThanOrEqual(w > 520 ? 30 : 24);
    await audit(page, 'board: word');

    mock.pushToClient({ type: 'class_state', payload: { ...base, phase: 'review', index: 3, roster, studentCount: 23, tally: { index: 3, answered: 23, clean: 15, hinted: 4, miss: 4, total: 23, away: 0, who } } });
    await expect(page.locator('.fr-class-answer')).toContainText(row.word);
    await audit(page, 'board: reveal');
  });
}
