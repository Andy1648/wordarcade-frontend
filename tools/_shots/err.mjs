import { chromium } from '@playwright/test';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1366, height: 657 } })).newPage();
p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 600)); });
p.on('pageerror', (e) => console.log('PAGEERROR', String(e).slice(0, 600)));
await p.goto('http://localhost:4173/?season2=1&portal=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
await b.close();
