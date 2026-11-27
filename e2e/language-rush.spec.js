// e2e/language-rush.spec.js — LANGUAGE RUSH (nov24): Spanish, Italian, Latin and Chinese Rush are French Rush
// with their own words, at their own links. In each language, at a laptop (1366x768) and a small phone
// (360x640): the cover names the language, a round plays end to end (the meaning first, typed WITHOUT accents
// or macrons — Chinese types the English), the answer card lands, and NO text is clipped anywhere on the way:
// nothing cut off by its box, nothing off the screen, no page scroll. A teacher's CREATE ROOM sends that
// language's words and hands out that language's link.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installBackendMock } from './support/backendMock.js';
import { noClip } from './support/noClip.js';
import { RUSH_LANGS, re } from './support/rushMenu.js';


const LANGS = [
  { id: 'es', slug: 'spanish-rush', dir: 'spanishRush', title: 'SPANISH', theme: /^Familias/ },
  { id: 'it', slug: 'italian-rush', dir: 'italianRush', title: 'ITALIAN', theme: /^Famiglie/ },
  { id: 'la', slug: 'latin-rush', dir: 'latinRush', title: 'LATIN', theme: /^Hominēs et familia/ },
  { id: 'zh', slug: 'chinese-rush', dir: 'chineseRush', title: 'CHINESE', theme: /^家庭与社区/ },
];
const SIZES = [
  [1366, 768],
  [360, 640],
];
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
for (const L of LANGS) {
  const WORDS = JSON.parse(readFileSync(new URL(`../src/data/${L.dir}/words.json`, import.meta.url), 'utf8'));
  for (const [w, h] of SIZES) {
    test(`${L.title} RUSH at ${w}x${h}: one round plays, nothing clips`, async ({ page }) => {
      const M = RUSH_LANGS[L.id].menu;
      await page.setViewportSize({ width: w, height: h });
      await installBackendMock(page);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/${L.slug}`);
      await expect(page.locator('.sr-cover .sr-title')).toContainText(L.title);
      await expect(page.locator('.sr-cover')).not.toContainText(/FRENCH/);
      await noClip(page, 'cover');

      await page.getByRole('button', { name: re(M.play) }).click();
      await page.getByRole('button', { name: re(M.quiz) }).click();
      await expect(page.locator('.sr-setup')).toBeVisible();
      await page.getByRole('button', { name: re(M.theme, false) }).click();
      await page.getByRole('option', { name: L.theme }).click();
      await page.getByRole('radio', { name: re(M.noTimer) }).click();
      await noClip(page, 'setup');
      await page.getByRole('button', { name: re(M.start) }).click();

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
    await page.getByRole('button', { name: re(RUSH_LANGS[L.id].menu.create) }).click();
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
  await page.getByRole('button', { name: re(RUSH_LANGS.fr.menu.language, false) }).click();
  await page.getByRole('option', { name: 'Español' }).click();
  await page.waitForURL('**/spanish-rush');
  await expect(page.locator('.sr-cover .sr-title')).toContainText('SPANISH');
});

// TEAM RACE (nov26) on the teacher's board, mocked: the lobby's teams, the lanes mid-class and the winner at the
// end fit at every size (the real two-phone race is e2e/class-team-race.spec.js, against a real class server).
for (const [w, h] of [
  [360, 640],
  [390, 844],
  [1366, 768],
  [1920, 1080],
]) {
  test(`TEAM RACE board fits at ${w}x${h}: lobby, a word, the winner`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const mock = await installBackendMock(page);
    await page.goto('/spanish-rush');
    await page.getByRole('button', { name: re(RUSH_LANGS.es.menu.create) }).click();
    await page.locator('.fr-class-foot').getByRole('button', { name: /^Create room$/i }).click();
    const sent = await mock.waitForSent('class_create');
    expect(sent.payload.set.teams).toBe(2); // a race by default
    const rows = sent.payload.rows;
    const roster = ['Ana', 'Ben', 'Cleo', 'Dev', 'Eli'].map((name, i) => ({ id: `s${i}`, name, away: false, team: i % 2 }));
    const race = (pts, chains, leaders) => ({
      teams: [0, 1].map((id) => ({ id, size: id ? 2 : 3, pts: pts[id], chain: chains[id], mult: chains[id] >= 6 ? 3 : chains[id] >= 3 ? 2 : 1, best: chains[id], score: Math.round((pts[id] / (id ? 2 : 3)) * 10) / 10 })),
      goal: rows.length * 4,
      leaders,
    });
    const base = { code: 'K7QMXZ', round: 1, role: 'host', total: rows.length, set: { ...sent.payload.set, voice: 'off' }, hostName: 'Teacher', hostAway: false, rows, roster, studentCount: 5 };
    mock.pushToClient({ type: 'class_created', payload: { code: 'K7QMXZ', hostToken: 'tok' } });
    mock.pushToClient({ type: 'class_state', payload: { ...base, phase: 'lobby', index: 0, race: race([0, 0], [0, 0], []) } });
    await expect(page.locator('.fr-race .fr-lane')).toHaveCount(2);
    await page.waitForTimeout(1500);
    await noClip(page, 'race lobby');
    const tally = { index: 3, answered: 4, clean: 3, hinted: 0, miss: 1, total: 5, away: 0, who: { clean: ['Ana', 'Cleo', 'Ben'], hinted: [], miss: ['Dev'], waiting: ['Eli'] } };
    mock.pushToClient({ type: 'class_state', payload: { ...base, phase: 'word', index: 3, tally, race: race([22, 9], [4, 0], [0]) } });
    await expect(page.locator('.fr-lane.t0 .fr-lane-chain.hot')).toHaveText('×2');
    await page.waitForTimeout(1500);
    await noClip(page, 'race word');
    const summary = rows.map((r, i) => ({ index: i, word: r.word, clean: 4, hinted: 0, miss: i % 3 === 0 ? 1 : 0 }));
    mock.pushToClient({ type: 'class_state', payload: { ...base, phase: 'done', index: rows.length - 1, summary, students: [], race: race([120, 70], [7, 2], [0]) } });
    await expect(page.locator('.fr-race-win')).toHaveText(RUSH_LANGS.es.race.win(RUSH_LANGS.es.race.names[0]));
    await page.waitForTimeout(1500);
    await noClip(page, 'race winner');
  });
}
