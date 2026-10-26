// e2e/french-rush.spec.js
//
// FRENCH RUSH: AP French vocab on the SAT RUSH engine, at its own link. Not an arcade mode:
// /french-rush mounts its own root, so the arcade at '/' must never download the French chunk.
// A struggling student's flow (oct19): cover → QUIZ → set up (theme, MY PACE) → the MEANING is the
// first clue and NOTHING moves on its own → type the French WITHOUT accents → a review card that waits
// for CONTINUE. Plus the teacher's link (a preselected set), the WORD BANK, and HOME staying inside
// French Rush.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installBackendMock } from './support/backendMock.js';

const WORDS = JSON.parse(readFileSync(new URL('../src/data/frenchRush/words.json', import.meta.url), 'utf8'));
const fold = (s) => s.replace(/œ/g, 'oe').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

test('French Rush: self-paced — no clock, accent-free typing, a review card that waits for CONTINUE', async ({ page }) => {
  await installBackendMock(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/french-rush');
  await expect(page.locator('.sr-cover')).toContainText('FRENCH');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /QUIZ/ }).click();
  await expect(page.locator('.sr-setup')).toBeVisible();
  await page.getByRole('radio', { name: /Families/i }).click();
  await expect(page.getByRole('radio', { name: /MY PACE/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /^Start$/ }).click();

  // the MEANING prints first — and with no clock, the French example does NOT appear by itself
  await expect(page.locator('.sr-field--gloss.in')).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(page.locator('.sr-field--sentence.in')).toHaveCount(0);
  // HINT shows the next clue
  await page.getByRole('button', { name: /Hint/ }).click();
  await expect(page.locator('.sr-field--sentence.in')).toBeVisible();

  const gloss = (await page.locator('.sr-gloss').innerText()).trim();
  const row = WORDS.find((r) => r.category === 'familles' && r.gloss === gloss);
  // (meanings are unique — frenchRush.test.js guards it — so the gloss names exactly one word)
  expect(row, `a Families word with the meaning "${gloss}"`).toBeTruthy();
  await page.keyboard.type(fold(row.word));

  // the review card holds until the student continues
  const card = page.locator('.sr-reencode');
  await expect(card).toBeVisible();
  await expect(card).toContainText(row.word);
  await page.waitForTimeout(2500);
  await expect(card).toBeVisible();
  await page.getByRole('button', { name: /Continue/ }).click();
  await expect(card).toHaveCount(0);
  await expect(page.locator('.sr-hud')).toContainText(/\/10/);

  // HOME stays inside French Rush
  await page.getByRole('button', { name: /Exit to menu/ }).click();
  await expect(page.locator('.sr-cover')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/french-rush');
  expect(errors).toEqual([]);
});

test("a teacher's link opens CASE SETUP with the set preselected", async ({ page }) => {
  await installBackendMock(page);
  await page.goto('/french-rush?mode=briefing&level=easy&n=5&theme=examen&pace=self');
  await expect(page.locator('.sr-setup')).toBeVisible();
  await expect(page.getByRole('radio', { name: /BASICS/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /^5$/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('radio', { name: /Exam & email/i })).toHaveAttribute('aria-checked', 'true');
});

test('the word bank lists every word and searches without accents', async ({ page }) => {
  await installBackendMock(page);
  await page.goto('/french-rush');
  await page.getByRole('button', { name: 'Word bank' }).click();
  await expect(page.locator('.sr-bank-row')).toHaveCount(WORDS.length);
  await page.getByRole('searchbox').fill('ecole');
  await expect(page.locator('.sr-bank-row').first()).toContainText('école');
});

// oct26: the word bank's filters are printed pickers (no native <select>), driven by mouse AND keyboard
test('the word bank filters are printed pickers — tap and keyboard both work', async ({ page }) => {
  await installBackendMock(page);
  await page.goto('/french-rush');
  await page.getByRole('button', { name: 'Word bank' }).click();
  await expect(page.locator('.sr-bank select')).toHaveCount(0);
  const show = page.getByRole('button', { name: /^show/i });
  await show.click();
  await page.getByRole('option', { name: 'False friends' }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  const ff = WORDS.filter((w) => w.falseFriend).length;
  await expect(page.locator('.sr-bank-row')).toHaveCount(ff);
  // keyboard: ↓ opens on the chosen row, Home → ALL WORDS, Enter picks it, focus returns to the button
  await show.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(page.locator('.sr-bank-row')).toHaveCount(WORDS.length);
  await expect(show).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('the arcade never downloads French Rush', async ({ page }) => {
  await installBackendMock(page);
  const french = [];
  page.on('request', (r) => {
    if (/FrenchRush|frenchRush/.test(r.url())) french.push(r.url());
  });
  await page.goto('/?portal=1');
  await page.waitForLoadState('networkidle');
  expect(french).toEqual([]);
});

test('STUDY FIRST only teaches words you cannot guess from English', async ({ page }) => {
  await installBackendMock(page);
  await page.goto('/french-rush?mode=briefing&level=standard&n=10&pace=self');
  await page.getByRole('button', { name: /Study the words/ }).click();
  await expect(page.locator('.sr-brief-card')).toHaveCount(10);
  const studied = (await page.locator('.sr-brief-word').allInnerTexts()).map((t) =>
    t.replace('🔊', '').trim().replace(/^(le\/la |le |la |l')/, '')
  );
  const byWord = new Map(WORDS.map((r) => [r.word, r]));
  for (const w of studied) expect(byWord.get(w) && byWord.get(w).guessable, `${w} is guessable`).toBe(false);
});
