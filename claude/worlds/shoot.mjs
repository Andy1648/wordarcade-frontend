// shoot.mjs — screenshot a local HTML file: node claude/worlds/shoot.mjs <html> <png> [width]
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';
const [, , html, png, width = '1624'] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(width), height: 900 } });
await p.goto(pathToFileURL(html).href);
await p.waitForTimeout(500);
await p.screenshot({ path: png, fullPage: true });
await b.close();
