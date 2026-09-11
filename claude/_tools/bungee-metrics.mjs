// bungee-metrics.mjs — do Bungee's layer fonts actually register on top of each other?
// A chromatic lockup only works if every layer has the SAME advance width. Measure it
// rather than assume it, after explicitly waiting for each face to load.
import { chromium } from '@playwright/test';

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto('http://localhost:4173/?portal=1');
const out = await page.evaluate(async () => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Bungee+Inline&family=Bungee+Outline&display=swap';
  const sheetReady = new Promise((res) => {
    link.onload = res;
    link.onerror = res;
    setTimeout(res, 8000);
  });
  document.head.appendChild(link);
  // The @font-face rules do not exist until the STYLESHEET lands. Calling
  // document.fonts.load() before that silently measures the fallback and makes every
  // layer font look identical - which is exactly the wrong answer, and the first one
  // this probe gave me.
  await sheetReady;

  const faces = ['Bungee Shade', 'Bungee', 'Bungee Inline', 'Bungee Outline'];
  // Force each face to actually download before measuring; otherwise every miss silently
  // measures the fallback and the whole comparison is of the wrong fonts.
  for (const f of faces) {
    try { await document.fonts.load(`96px "${f}"`, 'TYPE A WORD'); } catch { /* report below */ }
  }
  await document.fonts.ready;

  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;font-size:96px;line-height:1;white-space:pre;';
  probe.textContent = 'TYPE A WORD';
  document.body.appendChild(probe);

  const res = {};
  for (const f of faces) {
    probe.style.fontFamily = `"${f}"`;
    const withFace = probe.getBoundingClientRect();
    probe.style.fontFamily = `"__definitely_missing_${Math.random()}__"`;
    const fallback = probe.getBoundingClientRect();
    res[f] = {
      width: Number(withFace.width.toFixed(2)),
      height: Number(withFace.height.toFixed(2)),
      loaded: document.fonts.check(`96px "${f}"`),
      differsFromFallback: Math.abs(withFace.width - fallback.width) > 0.5,
    };
  }
  probe.remove();
  return res;
});
console.log(JSON.stringify(out, null, 1));
const w = Object.entries(out).map(([k, v]) => [k, v.width]);
const base = w[0][1];
console.log('\nadvance width vs Bungee Shade:');
for (const [k, v] of w) console.log(`  ${k.padEnd(16)} ${v}px  (${v === base ? 'same' : (v - base > 0 ? '+' : '') + (v - base).toFixed(2) + 'px'})`);
await browser.close();
