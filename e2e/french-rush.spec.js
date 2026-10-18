// e2e/french-rush.spec.js
//
// FRENCH RUSH (oct18): AP French vocab on the SAT RUSH engine, at its own link. Not an arcade mode:
// /french-rush mounts its own root, so the arcade at '/' must never download the French chunk.
// A struggling student's flow: cover → LINEUP → CASE SETUP (theme) → the MEANING is the first clue →
// type the French WITHOUT accents → the slot shows the accented word → captured.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installBackendMock } from './support/backendMock.js';

const WORDS = JSON.parse(readFileSync(new URL('../src/data/frenchRush/words.json', import.meta.url), 'utf8'));
const fold = (s) => s.replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '');

test('French Rush: theme setup, meaning first, accent-free typing captures the accented word', async ({ page }) => {
  await installBackendMock(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/french-rush');
  await expect(page.locator('.sr-cover')).toContainText('FRENCH');
  await page.getByRole('button', { name: 'Play' }).click();
  await page.getByRole('button', { name: /LINEUP/ }).click();
  await expect(page.locator('.sr-setup')).toBeVisible();
  // the theme choice: radio cards on a wide screen
  await page.getByRole('radio', { name: /Families/i }).click();
  await page.getByRole('button', { name: /Open the case/ }).click();

  // stage 0: the English MEANING prints first; the French example has not
  await expect(page.locator('.sr-field--gloss.in')).toBeVisible();
  await expect(page.locator('.sr-field--sentence.in')).toHaveCount(0);
  const gloss = (await page.locator('.sr-gloss').innerText()).trim();
  const row = WORDS.find((r) => r.category === 'familles' && r.gloss === gloss);
  expect(row, `a Families word with the meaning "${gloss}"`).toBeTruthy();
  await expect(page.locator('.sr-hud')).toContainText('0/10');

  await page.keyboard.type(fold(row.word));
  await expect(page.locator('.sr-stamp')).toBeVisible();
  await expect(page.locator('.sr-hud')).toContainText(/1\/10|0\/10/); // a shaky clear may come back
  expect(errors).toEqual([]);
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
