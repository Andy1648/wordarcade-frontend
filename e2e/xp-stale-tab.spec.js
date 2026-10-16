// e2e/xp-stale-tab.spec.js — NO LOST LEVELS (Andy oct16: "someone at lvl 178 can't rebirth to 10 bc it says they're
// lvl 160 /178"). A menu tab credited keys onto its own cached level and saved that, so a tab left open at LV160 while
// another tab climbed to 178 wrote 160 back over 178 on its next key. The fix reconciles with the save before every
// credit — and must never UNDO a rebirth made in the other tab.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';
import { menuReady } from './support/menu.js';

const save = (p, o) => p.evaluate((o) => {
  const v = JSON.stringify({ lv: o.lv, f: o.f ?? 0.1, rc: o.rc, v: 10 });
  localStorage.setItem('taw.xp', v); localStorage.setItem('taw.xpv10', v); localStorage.setItem('taw.rebirths', String(o.rc));
}, o);
const saved = (p) => p.evaluate(() => ({ lv: JSON.parse(localStorage.getItem('taw.xp')).lv, rc: Number(localStorage.getItem('taw.rebirths')) }));

async function openMenu(context, seed) {
  const p = await context.newPage();
  await installBackendMock(p);
  await p.addInitScript(() => { localStorage.setItem('taw.seenMenu', '1'); localStorage.setItem('taw.seenMenuSpotlight', '1'); });
  await p.goto('/?portal=1&season2=1');
  await menuReady(p);
  if (seed) { await save(p, seed); await p.reload(); await menuReady(p); }
  return p;
}
// localStorage reaches another tab a few ms later (Chromium syncs it between renderers), and a person switches tabs
// in seconds — so wait until the stale tab SEES the other tab's write before its key (CI pressed inside that window)
async function seen(p, o) {
  await expect.poll(() => p.evaluate(() => ({ lv: JSON.parse(localStorage.getItem('taw.xp')).lv, rc: Number(localStorage.getItem('taw.rebirths')) })), { timeout: 5000 }).toEqual(o);
}
async function key(p) {
  await p.bringToFront();
  await p.keyboard.press('k');
  await p.waitForTimeout(300);
}

test('a stale menu tab never writes a LOWER level over the save (160 vs 178)', async ({ context }) => {
  const a = await openMenu(context, { lv: 160, rc: 9 });
  const b = await openMenu(context);
  await save(b, { lv: 178, f: 0.2, rc: 9 }); // the other tab climbed
  await seen(a, { lv: 178, rc: 9 });
  await key(a);
  const s = await saved(a);
  expect(s.rc).toBe(9);
  expect(s.lv, 'one key on the stale tab must not lose the levels').toBeGreaterThanOrEqual(178);
});

test('a rebirth in the other tab is never undone by the stale tab', async ({ context }) => {
  const a = await openMenu(context, { lv: 178, f: 0.5, rc: 9 });
  const b = await openMenu(context);
  await save(b, { lv: 1, f: 0, rc: 10 }); // the other tab rebirthed
  await seen(a, { lv: 1, rc: 10 });
  await key(a);
  const s = await saved(a);
  expect(s.rc).toBe(10);
  // one key at LV1 on an R10 multiplier can climb a few dozen levels — but never back to the old climb's 178
  expect(s.lv, 'the stale tab must not write LV178 back over the rebirth').toBeLessThan(178);
});
