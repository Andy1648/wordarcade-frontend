import { chromium } from '@playwright/test';
const out = '/tmp/claude-0/-home-claude/dfeccb96-1985-5130-a2b7-72cc0d64d8d4/scratchpad/shots';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 657 } })).newPage();
const errs = []; p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); }); p.on('pageerror', (e) => errs.push('PAGEERROR ' + String(e).slice(0, 160)));
await p.goto('https://typeaword.com/?portal=1', { waitUntil: 'networkidle' }); await p.waitForTimeout(4000);
await p.screenshot({ path: `${out}/w1.png` });
const w = p.locator('#s2-welcome-root');
console.log('welcome text:', (await w.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300));
await w.locator('button').first().click({ force: true });
for (const t of [1500, 3000, 6000]) { await p.waitForTimeout(t); console.log(`+${t}ms mounted=${await w.count()} visible=${await w.isVisible().catch(() => false)} text=`, (await w.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)); await p.screenshot({ path: `${out}/w-${t}.png` }); }
console.log('ERRORS', errs);
await b.close();
