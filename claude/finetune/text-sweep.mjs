// text-sweep.mjs — fresh LV1 profile on typeaword.com at the loop's four viewports: lists every VISIBLE
// text element under 13 px on the menu and each main overlay. node claude/finetune/text-sweep.mjs [url]
import { chromium } from '@playwright/test';
const URL = process.argv[2] || 'https://typeaword.com/?portal=1';
const browser = await chromium.launch();
const out = [];
const small = (page) => page.evaluate(() => {
  const bad = [];
  for (const el of document.querySelectorAll('#root *')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const fs = parseFloat(cs.fontSize);
    if (fs < 13) bad.push(`${fs}px .${String(el.className).split(' ')[0]} "${el.textContent.trim().slice(0, 30)}"`);
  }
  return [...new Set(bad)];
});
try {
  for (const [w, h] of [[1280, 551], [1366, 625], [390, 844], [1920, 1080]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); } catch { /* blocked */ } });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    const res = { size: `${w}x${h}`, menu: await small(page) };
    for (const [name, sel] of [['stats', '.homepage-nav-btn.is-stats:visible, .hp-m-navbtn.is-stats:visible'], ['shop', '.homepage-nav-btn.is-shop:visible, .hp-m-navbtn.is-shop:visible'], ['board', '.homepage-nav-btn.is-board:visible, .hp-m-navbtn.is-board:visible']]) {
      const l = page.locator(sel).first();
      if (!(await l.count())) { res[name] = 'absent'; continue; }
      await l.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1500);
      res[name] = await small(page);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(700);
    }
    out.push(res);
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(out, null, 2));
