// REBIRTH RUSH RE-PIN (PROGRESSION-FINAL, FROZEN formula): wins/word = BASE 10 x len/5 x MODE POWER x 5^R
// x MARK x BOOST — no combo, no rarity, no lucky, no difficulty. Blitz is POWER x1: a 3-letter answer pays 6,
// a 5-letter one 10, at R0. The notes below are history.
// RE-PINNED. These were 360/650 for a long time — round10(weight x 100), i.e. Blitz at the BASE
// rate x1 — and had been RED across several merges because a viewport-only gate never ran them.
// Blitz is x1.4 (per-word 140) after the round-4 re-fit, so the figures are 500 and 910.
// Recomputed from the live table, never nudged to match.
// e2e/wins.spec.js
//
// The WINS wiring (item 2): the app subscribes to round-end events that ALREADY fire and
// pays out from data it already has. Here the backend mock delivers a Category Blitz round
// (round_start → accepted answer_results → round_end) over the same intercepted socket the
// app listens on; the real App.jsx handlers count MY accepted answers and call recordRound.
import { test, expect } from '@playwright/test';
import { installBackendMock, gotoMenu } from './support/backendMock.js';

const readWins = (page) =>
  page.evaluate(() => {
    const num = (k) => Number(localStorage.getItem(k)) || 0;
    let blitz = 0;
    try {
      blitz = JSON.parse(localStorage.getItem('taw.rounds') || '{}').blitz || 0;
    } catch {
      blitz = 0;
    }
    return { wins: num('taw.wins'), lifetime: num('taw.winsLifetime'), carry: num('taw.winsCarry'), blitz };
  });

async function playBlitzRound(mock, page, answers) {
  mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'X', categoryId: 'x', rerollsRemaining: 1 } });
  await page.waitForTimeout(40);
  for (const a of answers) mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } });
  await page.waitForTimeout(80);
  mock.pushToClient({ type: 'round_end', payload: { playerResults: [] } });
  await page.waitForTimeout(150);
}

test.describe('wins wiring', () => {
  // Force the 1/40 lucky draw OFF so these exact-payout assertions stay deterministic. Combo IS live
  // (parity: +0.1 per consecutive accept), so Blitz payouts are the combo-weighted total.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__TAW_LUCKY = 'off';
      window.__TAW_RARE_POP = 'off'; // the 1-in-750 MIDAS pop lands ~100 wins inside a delta (seen: 165 vs 65)
    });
  });

  // ECONOMY v8: wins are the word's XP ÷ 10 and the base is the word's LETTERS at the key tier
  // (T0 = 10 XP/letter), so a 3-letter Blitz answer pays 10 × 3 × mode2 ÷ 10 = 6 and a 5-letter
  // one pays 10. The BANKING arithmetic each test is about — the 3-answer gate, the retroactive
  // release, the no-double-pay rule — is unchanged; only the rate it multiplies.
  // RE-PINNED for PR #59's carry: bankWordWins pays floor((word XP + carried tenths) / 10) and
  // carries the 0-9 leftover in taw.winsCarry. 3-letter Blitz = 60 XP/word; the gate releases
  // CAT+DOG+FOX at combo 1.1+1.2+1.3 = 3.6 → 216 XP → +21 wins, 6 tenths carried (the old
  // per-grant round(21.6) = 22). Blitz does not underpay: the 0.6 is held, not lost.
  // REBIRTH RUSH: a word is whole wins at R0 with no MARK/BOOST (3 letters = 60 XP = 6 wins), so a round
  // can no longer PRODUCE tenths here. The carry intent is kept by starting with 6 tenths already carried
  // (a previous MARK-boosted word's leftover): the gate releases 3 × 60 = 180 XP + 6 carried = 186 →
  // +18 wins, and the 6 tenths are held, not lost or rounded into a win.
  test('a Blitz round_end with 3 accepted answers pays 18 (6 carried tenths kept) and counts the round', async ({ page }) => {
    const mock = await installBackendMock(page);
    await page.addInitScript(() => {
      try { if (!sessionStorage.getItem('e2e.carrySeeded')) { localStorage.setItem('taw.winsCarry', '6'); sessionStorage.setItem('e2e.carrySeeded', '1'); } } catch { /* ignore */ }
    });
    await gotoMenu(page);
    const before = await readWins(page);
    expect(before.carry).toBe(6);
    await playBlitzRound(mock, page, ['CAT', 'DOG', 'FOX']); // 3 × 3-letter → 180 XP + 6 carried = 186 → 18 c6
    // Poll for the banked wins: bankWordWins writes to localStorage on the async React drain, so a
    // synchronous read here occasionally races the bank under full-suite load (an intermittent 0).
    await expect.poll(async () => (await readWins(page)).wins - before.wins, { timeout: 5000 }).toBe(18);
    const after = await readWins(page);
    expect(after.lifetime - before.lifetime).toBe(18);
    expect(after.carry).toBe(6);
    expect(after.blitz - before.blitz).toBe(1);
  });

  test('a Blitz round with <3 accepted answers pays nothing and does not count', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const before = await readWins(page);
    await playBlitzRound(mock, page, ['CAT', 'DOG']); // only 2 → no payout, no round counted
    const after = await readWins(page);
    expect(after.wins - before.wins).toBe(0);
    expect(after.blitz - before.blitz).toBe(0);
  });

  // §2: answers must BANK PER ACCEPTED ANSWER so leaving a Blitz round mid-way never forfeits
  // them, and the (removed) round_end payout must not double-pay when round_end does arrive.
  test('LEAVE MID-ROUND: 5 answers bank per-answer without round_end, and round_end does not double-pay', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const before = await readWins(page);
    mock.pushToClient({ type: 'round_start', payload: { round: 1, timerSeconds: 60, category: 'X', categoryId: 'x', rerollsRemaining: 1 } });
    await page.waitForTimeout(40);
    // Real COMMON words (not single letters — those fall OUTSIDE the recall corpus and read OBSCURE
    // ×4 under the unified economy, which is nonsense data for a scoring test). All five are COMMON
    // (recall rank ≤ 3000), so each carries rarity weight 1.0:
    //   WATER + TABLE + CHAIR + APPLE + HOUSE = 5 × COMMON ×1.0, combo 1.1..1.5. Five-letter
    //   answers, so perWordWins is 10: round(3.6×10)=36 at the gate, then 14 and 15 → 65.
    for (const a of ['WATER', 'TABLE', 'CHAIR', 'APPLE', 'HOUSE']) {
      mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } });
      await page.waitForTimeout(40);
    }
    // NO round_end — the player leaves. The 5 answers are already banked.
    // REBIRTH RUSH: 5 × 5-letter × 10 (10 × 5/5 × Blitz POWER 1 at R0) = 50 — 30 at the gate, then 10 and 10.
    await expect.poll(async () => (await readWins(page)).wins - before.wins, { timeout: 5000 }).toBe(50);
    expect((await readWins(page)).blitz - before.blitz).toBe(1);
    // The round ends for real — the removed end payout must add NOTHING (no double-pay).
    mock.pushToClient({ type: 'round_end', payload: { playerResults: [] } });
    await page.waitForTimeout(250);
    const after = await readWins(page);
    expect(after.wins - before.wins).toBe(50); // banked per answer, not re-paid at round_end
    expect(after.lifetime - before.lifetime).toBe(50);
    expect(after.carry).toBe(0); // 300 + 100 + 100 XP — whole wins, nothing carried
    expect(after.blitz - before.blitz).toBe(1);
  });
});
