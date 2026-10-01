// claude/step47/prod-verify.mjs — STEP 47 on typeaword.com, no mocks. Uses a throwaway name; the
// caller deletes it afterwards. Phases: (1) CHAIN round → prompt → claim; (2) board shows me;
// (3) after GHOST_SQL removal, the next menu visit shows the rank-up + trophy dot.
import { chromium } from '@playwright/test';
const NAME = process.argv[2];
const phase = process.argv[3] || 'claim';
const SITE = 'https://typeaword.com';
const OPENER = { a: 'above', b: 'before', c: 'change', d: 'double', e: 'engine', f: 'future', g: 'generate', h: 'handle', i: 'include', l: 'large', m: 'manage', n: 'notice', o: 'office', p: 'people', r: 'remove', s: 'service', t: 'there', w: 'where' };
const EW = ['estate', 'elite', 'escape', 'expense'];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, storageState: phase === 'claim' ? undefined : 'claude/step47/prod/state.json' });
const p = await ctx.newPage();
const out = {};
if (phase === 'claim') {
  await p.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); localStorage.setItem('taw.chain.runs', '5'); localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('taw.seenGameSpotlight', '1'); localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('wa_has_played', '1'); });
  await p.goto(`${SITE}/?chain=1`);
  await p.locator('.solo-input').waitFor({ state: 'visible', timeout: 30000 });
  const pool = [...EW];
  for (let i = 0; i < 4; i++) {
    const letter = (await p.locator('.solo-center').first().innerText()).trim().toLowerCase()[0];
    const input = p.locator('.solo-input');
    await input.fill(i === 0 ? OPENER[letter] : pool.shift()); await input.press('Enter');
    await p.waitForTimeout(400);
  }
  await p.locator('.solo-over').waitFor({ state: 'visible', timeout: 60000 });
  const prompt = p.locator('.lb-cp');
  await prompt.waitFor({ state: 'visible', timeout: 15000 });
  await prompt.scrollIntoViewIfNeeded(); await p.waitForTimeout(900);
  out.prompt = (await prompt.innerText()).replace(/\s+/g, ' ');
  await p.screenshot({ path: 'claude/step47/prod/1-prompt.png' });
  await prompt.getByRole('button', { name: 'CLAIM YOUR NAME' }).click();
  await p.locator('#lb-cp-input').fill(NAME);
  await p.waitForFunction(() => /FREE/.test(document.querySelector('.lb-cp-verdict')?.textContent || ''), null, { timeout: 10000 });
  await prompt.getByRole('button', { name: 'CLAIM' }).click();
  await p.locator('.lb-cp-done').waitFor({ timeout: 15000 });
  out.done = (await p.locator('.lb-cp-done').innerText()).replace(/\s+/g, ' ');
  await p.screenshot({ path: 'claude/step47/prod/2-claimed.png' });
  await p.goto(`${SITE}/`);
  await p.locator('.homepage-logo, .hp-m-title').first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(1500);
  await p.getByRole('button', { name: /Open leaderboard/ }).click();
  await p.locator('.lb-row.is-me').waitFor({ timeout: 15000 });
  out.board = await p.locator('.lb-row.is-me').getAttribute('data-rank');
  out.slots = await p.locator('.lb-slot').count();
  await p.screenshot({ path: 'claude/step47/prod/3-board.png' });
  await ctx.storageState({ path: 'claude/step47/prod/state.json' });
} else {
  await p.goto(`${SITE}/`);
  await p.locator('.homepage-logo, .hp-m-title').first().waitFor({ timeout: 30000 });
  const moment = p.locator('.lb-rankup');
  await moment.waitFor({ state: 'visible', timeout: 15000 });
  await p.waitForTimeout(900);
  out.rankup = (await moment.innerText()).replace(/\s+/g, ' ');
  out.trophy = await p.getByRole('button', { name: /Open leaderboard/ }).getAttribute('aria-label');
  await p.screenshot({ path: 'claude/step47/prod/4-rankup.png' });
}
console.log(JSON.stringify(out));
await b.close();
