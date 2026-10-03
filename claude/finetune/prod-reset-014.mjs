// prod-reset-014.mjs — R5 (Andy oct3): Andy ran 014_self_reset.sql; prove on PRODUCTION that Stats → RESET ALL
// PROGRESS now resets the player's BOARD ROW (not just the browser). Fresh profile → claim a test name at LV77
// → read the row from the live board → Stats → RESET → read the row again. Leaves one LV1 test row
// (ZZRESET…) for Andy to delete. Run: node claude/finetune/prod-reset-014.mjs
import { chromium } from '@playwright/test';

const SITE = 'https://typeaword.com';
const SB = 'https://oajvvwptwifspmwiohlt.supabase.co/rest/v1';
const KEY = 'sb_publishable_ULwW-DgPY3FuQ91earkHEA_DKLqVM89';
const NAME = `ZZRESET${Date.now().toString(36).slice(-5).toUpperCase()}`;

async function row() {
  const r = await fetch(`${SB}/leaderboard?username=eq.${NAME}&select=username,level,rebirths,lifetime_words,lifetime_letters`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const j = await r.json();
  return Array.isArray(j) ? j[0] || null : j;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('sr.seeded')) return;
    sessionStorage.setItem('sr.seeded', '1');
    localStorage.setItem('taw.seenMenu', '1');
    localStorage.setItem('taw.seenMenuSpotlight', '1');
    localStorage.setItem('taw.tut.init', '1');
    for (const t of ['marks', 'frenzy', 'boost', 'weekly', 'rebirth', 'chain', 'fuse', 'wall']) localStorage.setItem('taw.tut.' + t, '1');
    localStorage.setItem('taw.xp', JSON.stringify({ lv: 77, into: 0 }));
    localStorage.setItem('taw.rebirths', '2');
    localStorage.setItem('taw.letters', '9000');
  });
  await page.goto(`${SITE}/?portal=1`, { waitUntil: 'networkidle' });
  await page.locator('.homepage-nav-btn.is-board').click();
  await page.locator('.lb-claim-input').fill(NAME);
  await page.locator('.lb-verdict').filter({ hasText: /FREE/ }).waitFor({ timeout: 15000 });
  await page.locator('.lb-claim-btn').click();
  await page.locator('.lb-you-name, .lb-hero-name').filter({ hasText: NAME }).first().waitFor({ timeout: 15000 });
  let before = null;
  for (let i = 0; i < 10 && !(before && before.level === 77); i++) { await wait(1500); before = await row(); }
  console.log('BEFORE reset:', JSON.stringify(before));
  await page.keyboard.press('Escape');
  await wait(6000); // the DB throttles submits at 5 s

  await page.locator('.homepage-nav-btn.is-stats').click();
  await page.locator('.stats-panel, .claims-panel').first().waitFor({ state: 'visible' });
  if (await page.locator('.claims-panel').count()) await page.locator('.claims-to-stats').click();
  await page.locator('.stats-panel').waitFor({ state: 'visible' });
  await page.locator('.stats-reset').click();
  console.log('warning:', (await page.locator('.stats-danger-warn').textContent()).trim());
  await Promise.all([page.waitForEvent('load'), page.locator('.stats-reset-confirm').click()]);
  await wait(4000);
  let after = null;
  for (let i = 0; i < 10 && !(after && after.level === 1); i++) { await wait(1500); after = await row(); }
  console.log('AFTER reset:', JSON.stringify(after));
  const kept = await page.evaluate(() => ({ lv: JSON.parse(localStorage.getItem('taw.xp') || '{"lv":1}').lv, profile: localStorage.getItem('taw.lb.profile') }));
  console.log('browser after:', JSON.stringify(kept));
  const pass = before && before.level === 77 && after && after.level === 1 && after.rebirths === 0 && after.username === NAME;
  console.log(pass ? 'PASS: the board row went LV77 → LV1 and kept its name' : 'FAIL');
  console.log('console/page errors:', errors.length, errors.slice(0, 5));
} finally {
  await browser.close();
}
