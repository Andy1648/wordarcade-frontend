// e2e/miner-stats-fit.spec.js — MINER'S NUMBERS ARE NEVER CUT OFF (Andy nov12: "5.02 m/word is cut off"). The per-word
// rate on the MINER card + its mode dialog, at rebirth counts that print 10 / 781K / 5.02M / B-scale rates, and the
// in-game lanes + results at extreme depths (99.99 → 10,000 m), at 360 / 390 / 1366 / 1920: every number is drawn
// whole inside its box (no clipped text, no ellipsis, nothing spilling out of its card).
import { test, expect } from '@playwright/test';
import { installBackendMock, freezeAnimations } from './support/backendMock.js';
import { menuReady, revealMode } from './support/menu.js';

const SHOTS = process.env.MS_SHOTS || '';
const VPS = [{ width: 360, height: 640 }, { width: 390, height: 844 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }];

/** Every text leaf under `sel`: drawn inside the box it belongs to (its parent `inside`), never clipped / ellipsized. */
const fit = (page, sel, inside) => page.evaluate(([s, ins]) => {
  const bad = [];
  for (const root of document.querySelectorAll(s)) {
    const cs = getComputedStyle(root);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const box = (ins && root.closest(ins)) || root;
    const b = box.getBoundingClientRect();
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      const e = getComputedStyle(el);
      const clipped = (e.overflow === 'hidden' || e.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1;
      const out = r.left < b.left - 1 || r.right > b.right + 1;
      if (clipped || out) bad.push(`${el.className || el.tagName}: "${el.textContent.trim()}" ${clipped ? 'clipped' : ''}${out ? ` spills ${Math.round(Math.max(b.left - r.left, r.right - b.right))}px` : ''}`);
    }
  }
  return bad;
}, [sel, inside]);

for (const vp of VPS) {
  for (const rebirths of [0, 7, 9, 14]) {
    test(`@${vp.width} R${rebirths}: the MINER card + dialog print their per-word rate whole`, async ({ page }) => {
      await page.setViewportSize(vp);
      await installBackendMock(page);
      await page.addInitScript((r) => {
        try {
          for (const k of ['taw.tut.pv10', 'taw.tut.keyTier', 'taw.tut.gems', 'taw.seenGameSpotlight', 'taw.seenMenu', 'taw.seenMenuSpotlight']) localStorage.setItem(k, '1');
          localStorage.setItem('taw.rebirths', String(r));
          localStorage.setItem('taw.s2.rebirths', String(r)); // season 2 keeps its own save
          localStorage.setItem('taw.reveal', 'all');
        } catch { /* blocked */ }
      }, rebirths);
      await page.goto('/?portal=1&season2=1');
      await menuReady(page);
      const card = await revealMode(page, 'miner');
      await freezeAnimations(page);
      const rate = page.locator('.game-card-magnet[data-game="miner"] .game-card-payout');
      if (await rate.count()) {
        const txt = (await rate.first().innerText()).replace(/\s+/g, ' ');
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/card-${vp.width}-R${rebirths}.png` });
        expect(await fit(page, '.game-card-magnet[data-game="miner"] .game-card-payout', '.game-card'), `card rate "${txt}"`).toEqual([]);
      }
      await card.click();
      const pay = page.locator('.mode-dialog-pay-n').first();
      await expect(pay).toBeVisible({ timeout: 10000 });
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/dialog-${vp.width}-R${rebirths}.png` });
      expect(await fit(page, '.mode-dialog-pay-n', '.mode-dialog-shell'), 'dialog rate').toEqual([]);
      expect(await fit(page, '.mode-dialog-pay-k', '.mode-dialog-shell'), 'dialog rate unit').toEqual([]);
    });
  }

  test(`@${vp.width}: MINER lanes + results at extreme depths keep every number whole`, async ({ page }) => {
    await page.setViewportSize(vp);
    const mock = await installBackendMock(page);
    await page.goto('/?portal=1&season2=1');
    await menuReady(page);
    const miners = [
      { id: 'e2e-player', name: 'ME', isBot: false, depth: 99.99, lives: 3 },
      { id: 'p2', name: 'CAFFEINATEDOWL68', isBot: true, depth: 1000, lives: 2 },
      { id: 'p3', name: 'MAXIMILIAN_THE_GREAT', isBot: true, depth: 10000, lives: 1 },
      { id: 'p4', name: 'Q', isBot: true, depth: 512.5, lives: 0, out: true },
    ];
    mock.pushToClient({ type: 'room_update', payload: { code: 'MINES', gameType: 'miner', hostId: 'e2e-player', players: miners.map((m) => ({ id: m.id, name: m.name })) } });
    mock.pushToClient({ type: 'game_started', payload: { gameType: 'miner' } });
    const now = Date.now();
    mock.pushToClient({ type: 'miner_start', payload: { miners, target: 500, lives: 3, serverNow: now, goAt: now } });
    mock.pushToClient({ type: 'miner_round', payload: { round: 12, prompt: 'Famous athletes', ask: 'FAMOUS ATHLETE', endsAt: now + 15000, roundMs: 15000, serverNow: now } });
    await page.locator('.mn-run').first().waitFor({ timeout: 15000 });
    await freezeAnimations(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/lanes-${vp.width}.png` });
    expect(await fit(page, '.mn-run-depth', '.mn-run'), 'lane depths').toEqual([]);
    expect(await fit(page, '.mn-core', '.mn-race'), 'the core line').toEqual([]);
    const standings = miners.map((m) => ({ ...m, best: { text: 'muhammad ali', ore: 'diamond', depth: 100 }, ores: { dirt: 1234, coal: 99, gold: 12, diamond: 1000 } }));
    mock.pushToClient({ type: 'miner_over', payload: { winnerIds: ['p3'], reason: 'core', standings, target: 500, rounds: 120, serverNow: Date.now() } });
    await page.getByTestId('miner-over').waitFor({ timeout: 15000 });
    await freezeAnimations(page);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/over-${vp.width}.png` });
    expect(await fit(page, '.mn-standings', '.mn-standings'), 'results standings').toEqual([]);
    expect(await fit(page, '.mn-over-pay', '.mn-over'), 'results pay lines').toEqual([]);
  });
}
