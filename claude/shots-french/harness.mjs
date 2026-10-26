// French Rush screenshot + class play harness (not shipped). BASE=http://localhost:4319 OUT=claude/shots-french/before node claude/shots-french/harness.mjs
import { chromium, devices } from 'playwright';
import fs from 'fs';
const BASE = process.env.BASE || 'http://localhost:4319';
const OUT = process.env.OUT || 'claude/shots-french/out';
const ONLY = process.env.ONLY || 'solo,class';
fs.mkdirSync(OUT, { recursive: true });
const words = JSON.parse(fs.readFileSync('src/data/frenchRush/words.json', 'utf8'));
const byGloss = new Map(words.map((w) => [w.gloss, w.word]));
const errs = [];
const log = (...a) => console.log(...a);
const b = await chromium.launch();
const LAPTOP = { viewport: { width: 1366, height: 768 } };
const PHONE = { ...devices['iPhone 13'] };
const PROJ = { viewport: { width: 1920, height: 1080 } };
async function mk(name, opts) {
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(`${name} pageerror ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource|google|adsbygoogle|supabase/i.test(m.text())) errs.push(`${name} console ${m.text()}`); });
  p.on('dialog', (d) => d.accept());
  return { ctx, p, name };
}
const settle = (x, ms = 900) => x.p.waitForTimeout(ms);
const shot = async (x, tag) => { await settle(x); await x.p.screenshot({ path: `${OUT}/${tag}-${x.name}.png` }); };
// overflow / tiny-text probe on the current screen
async function probe(x, tag) {
  const r = await x.p.evaluate(() => {
    const out = { scroll: [], tiny: 0, offscreen: 0 };
    const vw = innerWidth, vh = innerHeight;
    for (const el of document.querySelectorAll('.sr-app *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const rc = el.getBoundingClientRect();
      if (!rc.width || !rc.height) continue;
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2) out.scroll.push(el.className.toString().slice(0, 40));
      if (el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(cs.fontSize) < 13 && !el.closest('[aria-hidden="true"]')) out.tiny += 1;
      if (rc.right > vw + 1 || rc.bottom > vh + 1) if (!el.closest('.fr-press') && !el.closest('[aria-hidden="true"]')) out.offscreen += 1;
    }
    return out;
  });
  log(`probe ${tag}-${x.name}`, JSON.stringify(r));
}

async function solo(opts, name) {
  const x = await mk(name, opts);
  await x.p.goto(`${BASE}/french-rush`);
  await x.p.getByRole('button', { name: 'Play' }).waitFor({ timeout: 30000 });
  await shot(x, 's01-cover');
  await x.p.getByRole('button', { name: 'Play' }).click();
  await x.p.getByRole('button', { name: /QUIZ/ }).click();
  await shot(x, 's02-setup'); await probe(x, 's02-setup');
  const pick = x.p.locator('.fr-pick-btn').first();
  if (await pick.count() && await pick.isVisible()) { await pick.click(); await shot(x, 's03-setup-picker'); await x.p.keyboard.press('ArrowDown'); await x.p.keyboard.press('Enter'); }
  await x.p.getByRole('button', { name: /^Start/ }).click();
  await x.p.waitForTimeout(260); await x.p.screenshot({ path: `${OUT}/s03b-press-${x.name}.png` });
  for (let i = 0; i < 60; i++) {
    const home = x.p.getByRole('button', { name: /French Rush home/ });
    const sa = x.p.getByRole('button', { name: /Show answer/ });
    await Promise.race([home.waitFor({ timeout: 10000 }), sa.waitFor({ timeout: 10000 })]).catch(() => {});
    if (await home.count()) break;
    if (i === 0) await shot(x, 's04-word');
    await sa.click();
    const c = x.p.getByRole('button', { name: /Continue/ });
    await c.waitFor({ timeout: 10000 });
    if (i === 0) await shot(x, 's05-review');
    await c.click();
  }
  await x.p.waitForTimeout(1500);
  await shot(x, 's06-results'); await probe(x, 's06-results');
  await x.p.getByRole('button', { name: /French Rush home/ }).click();
  await x.p.getByRole('button', { name: 'Word bank' }).click();
  await shot(x, 's07-bank'); await probe(x, 's07-bank');
  const bp = x.p.locator('.fr-pick-btn').nth(1);
  if (await bp.count()) { await bp.click(); await shot(x, 's08-bank-picker'); await x.p.keyboard.press('Escape'); }
  await x.ctx.close();
}

async function cls() {
  const T = await mk('teacher', PROJ);
  await T.p.goto(`${BASE}/french-rush`);
  await T.p.getByRole('button', { name: 'Class room' }).click();
  await shot(T, 'c00-choose');
  await T.p.getByRole('button', { name: "I'm the teacher" }).click({ timeout: 60000 });
  await shot(T, 'c01-setup'); await probe(T, 'c01-setup');
  await T.p.getByRole('button', { name: /Open the class/ }).click();
  const codeEl = T.p.locator('.fr-class-code');
  await codeEl.waitFor({ timeout: 30000 });
  const code = (await codeEl.textContent()).trim();
  await shot(T, 'c02-lobby-empty');
  const S = [];
  const names = [['ana', LAPTOP], ['ben', PHONE], ['chloé', LAPTOP], ['dev', LAPTOP], ['emma', LAPTOP], ['farid', LAPTOP]];
  for (const [name, opts] of names) {
    const s = await mk(name, opts);
    if (name === 'ana') {
      await s.p.goto(`${BASE}/french-rush`);
      await s.p.getByRole('button', { name: 'Class room' }).click();
      await s.p.getByRole('button', { name: 'Join a class' }).click({ timeout: 60000 });
      await shot(s, 'c03-join');
      await s.p.getByLabel('class code').fill(code);
    } else await s.p.goto(`${BASE}/french-rush?class=${code}`);
    if (name === 'ben') await shot(s, 'c03-join');
    await s.p.getByLabel('your name').fill(name);
    await s.p.getByRole('button', { name: /^Join/ }).click();
    await s.p.locator('.fr-class-hi').waitFor({ timeout: 20000 });
    S.push(s);
  }
  await shot(S[0], 'c04-wait'); await shot(S[1], 'c04-wait');
  await shot(T, 'c05-lobby'); await probe(T, 'c05-lobby');
  await T.p.setViewportSize({ width: 1366, height: 768 }); await shot(T, 'c05-lobby-laptop'); await T.p.setViewportSize({ width: 1920, height: 1080 });
  await T.p.getByRole('button', { name: /Start/ }).click();
  await T.p.waitForTimeout(280); await T.p.screenshot({ path: `${OUT}/c05b-press-teacher.png` });
  const total = 10;
  for (let i = 0; i < total; i++) {
    await T.p.locator('.fr-class-gloss').waitFor({ timeout: 15000 });
    await T.p.waitForTimeout(700);
    const gloss = (await T.p.locator('.fr-class-gloss').textContent()).trim();
    const ans = byGloss.get(gloss);
    if (!ans) log('NO ANSWER for', gloss);
    if (i === 0) { await shot(T, 'c06-word'); await shot(S[1], 'c06-word'); await shot(S[0], 'c06-word'); }
    for (const [k, s] of S.entries()) {
      const miss = (k + i) % 4 === 3;
      if (miss) { await s.p.getByRole('button', { name: /Show answer/ }).first().click().catch(() => {}); continue; }
      if ((k + i) % 3 === 1) { const h = s.p.getByRole('button', { name: /hint/i }); if (await h.count()) await h.first().click().catch(() => {}); }
      await s.p.locator('.sr-body').click({ position: { x: 20, y: 20 } }).catch(() => {});
      await s.p.keyboard.type(ans || 'x', { delay: 15 });
    }
    await T.p.waitForTimeout(900);
    if (i === 0) { await shot(T, 'c07-answered'); await probe(T, 'c07-answered'); }
    const rv = T.p.getByRole('button', { name: /Reveal/ });
    if (await rv.count()) await rv.click();
    await T.p.waitForTimeout(400);
    if (i === 0) {
      await shot(T, 'c08-review'); await probe(T, 'c08-review'); await shot(S[1], 'c08-review'); await shot(S[0], 'c08-review');
      await T.p.keyboard.press('n'); await shot(T, 'c09-review-names'); await T.p.keyboard.press('n');
      await T.p.setViewportSize({ width: 1366, height: 768 }); await shot(T, 'c08-review-laptop'); await T.p.setViewportSize({ width: 1920, height: 1080 });
    }
    await T.p.getByRole('button', { name: i + 1 === total ? /Finish/ : /Next word/ }).click();
  }
  await T.p.locator('.fr-class-summary, .fr-class-done').first().waitFor({ timeout: 15000 });
  await shot(T, 'c10-done'); await probe(T, 'c10-done');
  await T.p.setViewportSize({ width: 1366, height: 768 }); await shot(T, 'c10-done-laptop'); await T.p.setViewportSize({ width: 1920, height: 1080 });
  await shot(S[0], 'c10-done'); await shot(S[1], 'c10-done');
  await T.ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await T.p.getByRole('button', { name: /report/i }).first().click();
  await T.p.waitForTimeout(500);
  log('REPORT:', (await T.p.evaluate(() => navigator.clipboard.readText()).catch((e) => 'clip fail ' + e.message)).slice(0, 400));
  for (const s of S) await s.ctx.close();
  await T.ctx.close();
}

try {
  if (ONLY.includes('solo')) { await solo(LAPTOP, 'laptop'); await solo(PHONE, 'phone'); }
  if (ONLY.includes('class')) await cls();
} catch (e) {
  log('HARNESS FAIL', e.message);
} finally {
  log('ERRORS', errs.length ? errs.join('\n') : 'none');
  await b.close();
}
