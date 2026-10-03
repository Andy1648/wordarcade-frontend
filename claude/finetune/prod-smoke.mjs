// prod-smoke.mjs — loads typeaword.com with a fresh profile at phone + desktop sizes, opens the main
// overlays, and reports console errors / failed requests. node claude/finetune/prod-smoke.mjs
import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const out = [];
try {
  for (const [w, h] of [[1280, 551], [390, 844]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    // a returning visitor (the menu is the front door; first-run splash is covered by its own specs)
    await page.addInitScript(() => { try { localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); localStorage.setItem('wa_has_played', '1'); } catch { /* blocked */ } });
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 160)));
    page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('typeaword.com')) errs.push(`${r.status()} ${r.url()}`); });
    await page.goto('https://typeaword.com/?portal=1', { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000);
    const click = async (sel) => { const l = page.locator(sel).first(); if (await l.count()) { await l.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1200); await page.keyboard.press('Escape'); await page.waitForTimeout(600); return true; } return false; };
    const opened = {};
    for (const [name, sel] of [['stats', '.homepage-nav-btn.is-stats:visible, .hp-m-navbtn.is-stats:visible'], ['shop', '.homepage-nav-btn.is-shop:visible, .hp-m-navbtn.is-shop:visible'], ['board', '.homepage-nav-btn.is-board:visible, .hp-m-navbtn.is-board:visible']]) opened[name] = await click(sel);
    out.push({ size: `${w}x${h}`, opened, errors: errs });
    await ctx.close();
  }
} finally { await browser.close(); }
console.log(JSON.stringify(out, null, 2));
