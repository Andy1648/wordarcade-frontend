// e2e/class-team-race.spec.js — the TEAM RACE, played for real (nov26): a teacher (laptop) opens a Spanish room with
// two teams, two students (phones) join from the room link and are dealt one to each team, and the class plays a
// 10-word set. Student A answers everything right; student B misses words 2 and 3. Every screen shows the race:
// the teacher's lanes, each phone's team strip with its own team outlined, a snapped chain, and at the end the
// winner stamped on the board and on both phones.
//
// It needs a REAL class server (the race lives in chain-reaction-backend classRoom.js), so it runs only when
// CLASS_RACE_URL points at a build wired to one, e.g.:
//   (backend)  PORT=3101 node server.js
//   (frontend) VITE_BACKEND_WS_URL=ws://localhost:3101 npx vite build --outDir dist-race && npx vite preview --outDir dist-race --port 4195
//   CLASS_RACE_URL=http://localhost:4195 npx playwright test class-team-race
// SHOT_DIR=… saves the screens.
import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { RUSH_LANGS, re } from './support/rushMenu.js';
import { noClip } from './support/noClip.js';

const BASE = process.env.CLASS_RACE_URL;
const SHOTS = process.env.SHOT_DIR || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const WORDS = JSON.parse(readFileSync(new URL('../src/data/spanishRush/words.json', import.meta.url), 'utf8'));
const M = RUSH_LANGS.es.menu;
const R = RUSH_LANGS.es.race;

test.skip(!BASE, 'needs a real class server (CLASS_RACE_URL)');

// every screen of the race is also held to the language rushes' fit rule (nothing cut off, nothing off screen)
async function shot(page, name) {
  await page.waitForTimeout(1700); // the page-turn sheet and the count-ups settle first
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
  await noClip(page, name, { soft: true });
}

// answer the word on a student's phone: right, or a wrong choice that is still standing
async function answer(page, right) {
  const gloss = page.locator('.sr-field--gloss.in .sr-gloss');
  await expect(gloss).toBeVisible({ timeout: 20_000 });
  const text = (await gloss.innerText()).trim();
  const row = WORDS.find((r) => r.gloss === text);
  expect(row, `a word meaning "${text}"`).toBeTruthy();
  await page.evaluate(
    ({ word, right }) => {
      const btns = [...document.querySelectorAll('.sr-suspect-btn:not(:disabled)')];
      const name = (b) => (b.getAttribute('aria-label') || '').replace(/^\d+: /, '');
      const b = right ? btns.find((x) => name(x) === word) : btns.find((x) => name(x) !== word);
      b.click();
    },
    { word: row.word, right }
  );
  await expect(page.locator('.sr-reencode')).toBeVisible();
}

test('TEAM RACE: two phones, two teams, the board and every phone run the same race to a winner', async ({ browser }) => {
  test.setTimeout(240_000);
  const tctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const teacher = await tctx.newPage();
  const errors = [];
  teacher.on('pageerror', (e) => errors.push(`teacher: ${e.message}`));
  await teacher.goto(`${BASE}/spanish-rush`);
  await teacher.getByRole('button', { name: re(M.create) }).click();
  await teacher.getByRole('radio', { name: /^PICK IT$/ }).click();
  await teacher.getByRole('radio', { name: /^10$/ }).click();
  await expect(teacher.getByRole('button', { name: /^teams/ })).toContainText('2 TEAMS'); // a race by default
  await shot(teacher, 'race-0-teacher-setup');
  await teacher.locator('.sr-btn.fr-go').click();
  const code = (await teacher.locator('.fr-class-code').innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  const phones = [];
  for (const [name, w, h] of [
    ['Ana', 390, 844],
    ['Ben', 360, 640],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    await p.goto(`${BASE}/spanish-rush?class=${code}&tap=1`);
    await p.locator('#fr-class-join input').nth(1).fill(name);
    await p.locator('button[form="fr-class-join"]').click();
    await expect(p.locator('.fr-race-yours')).toBeVisible({ timeout: 20_000 });
    phones.push({ name, p, ctx });
  }
  // dealt one to each team
  const teamOf = async (p) => (await p.locator('.fr-race-yours b').innerText()).trim();
  expect(await teamOf(phones[0].p)).toBe(R.names[0]);
  expect(await teamOf(phones[1].p)).toBe(R.names[1]);
  await expect(teacher.locator('.fr-race .fr-lane')).toHaveCount(2);
  await shot(teacher, 'race-1-teacher-lobby');
  await shot(phones[0].p, 'race-1-ana-wait-390');

  await teacher.getByRole('button', { name: /^Start/ }).click();
  for (let i = 0; i < 10; i += 1) {
    await answer(phones[0].p, true);
    await answer(phones[1].p, i !== 1 && i !== 2); // Ben misses words 2 and 3: his team's chain snaps
    // both answered → the server reveals on its own; the teacher moves on
    const next = teacher.getByRole('button', { name: /^(Next word|Finish)/ });
    await expect(next).toBeVisible({ timeout: 20_000 });
    if (i === 3) {
      await shot(teacher, 'race-2-teacher-board');
      await shot(phones[0].p, 'race-2-ana-run-390');
      await shot(phones[1].p, 'race-2-ben-run-360');
      // the strip: both teams, each phone's own outlined; Ana's team leads with a hot chain
      await expect(phones[0].p.locator('.fr-race.strip .fr-lane')).toHaveCount(2);
      await expect(phones[0].p.locator('.fr-race.strip .fr-lane.mine.t0')).toBeVisible();
      await expect(phones[1].p.locator('.fr-race.strip .fr-lane.mine.t1')).toBeVisible();
      await expect(teacher.locator('.fr-lane.t0.lead')).toBeVisible();
      await expect(teacher.locator('.fr-lane.t0 .fr-lane-chain.hot')).toHaveText('×2');
    }
    await next.click();
  }
  // the winner: stamped on the board and on both phones
  await expect(teacher.locator('.fr-race-win')).toHaveText(R.win(R.names[0]), { timeout: 20_000 });
  await shot(teacher, 'race-3-teacher-winner');
  for (const { name, p } of phones) {
    await expect(p.locator('.fr-race-win')).toHaveText(R.win(R.names[0]), { timeout: 20_000 });
    await shot(p, `race-3-${name.toLowerCase()}-winner`);
  }
  expect(errors).toEqual([]);
  for (const { ctx } of phones) await ctx.close();
  await tctx.close();
});
