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
    return { wins: num('taw.wins'), lifetime: num('taw.winsLifetime'), blitz };
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
    });
  });

  test('a Blitz round_end with 3 accepted answers pays 70 and counts the round', async ({ page }) => {
    const mock = await installBackendMock(page);
    await gotoMenu(page);
    const before = await readWins(page);
    await playBlitzRound(mock, page, ['CAT', 'DOG', 'FOX']); // 3 COMMON, combo 1.1/1.2/1.3 → 3.6 × 20 = round10(72) = 70
    // Poll for the banked wins: bankWordWins writes to localStorage on the async React drain, so a
    // synchronous read here occasionally races the bank under full-suite load (an intermittent 0).
    await expect.poll(async () => (await readWins(page)).wins - before.wins, { timeout: 5000 }).toBe(70);
    const after = await readWins(page);
    expect(after.lifetime - before.lifetime).toBe(70);
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
    //   WATER + TABLE + CHAIR + APPLE + HOUSE = 5 × COMMON ×1.0, combo 1.1..1.5 =
    //   1.1+1.2+1.3+1.4+1.5 = 6.5 weight × 20 perWordWins = round10(130) = 130 (lucky forced off)
    for (const a of ['WATER', 'TABLE', 'CHAIR', 'APPLE', 'HOUSE']) {
      mock.pushToClient({ type: 'answer_result', payload: { accepted: true, answer: a } });
      await page.waitForTimeout(40);
    }
    // NO round_end — the player leaves. The 5 answers (combo-weighted 6.5 = 130) are already banked.
    await expect.poll(async () => (await readWins(page)).wins - before.wins, { timeout: 5000 }).toBe(130);
    expect((await readWins(page)).blitz - before.blitz).toBe(1);
    // The round ends for real — the removed end payout must add NOTHING (no double-pay).
    mock.pushToClient({ type: 'round_end', payload: { playerResults: [] } });
    await page.waitForTimeout(250);
    const after = await readWins(page);
    expect(after.wins - before.wins).toBe(130); // still 130, not 260
    expect(after.lifetime - before.lifetime).toBe(130);
    expect(after.blitz - before.blitz).toBe(1);
  });
});
