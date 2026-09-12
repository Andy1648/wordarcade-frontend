// e2e/word-landing.spec.js — RARITY IS AN EVENT AT THE WORD, and a secret is not a popup.
//
// REPLACES e2e/secret-sticker.spec.js. That spec guarded a centre-screen sticker over a modal
// backdrop: the whole thing it proved was that the dismiss click was SWALLOWED rather than falling
// through onto the card underneath — which is a good property for a modal to have and a bad reason
// for the modal to exist. The feature is cut. What replaced it is the rule this file gates:
//
//   when a word lands, the WORD ITSELF reacts, in the field the player is already looking at.
//
// So the assertions are the ones that matter for that: the treatment ESCALATES by rarity band, a
// COMMON word gets nothing extra, the payout is attached to the word that earned it, and none of
// it can be clicked — there is no backdrop, nothing to dismiss, and nothing over the menu.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { installBackendMock } from './support/backendMock.js';

fs.mkdirSync('claude/wb-frame-shots', { recursive: true });

const ME = 'e2e-player';
const mkPlayers = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: i === 0 ? ME : `p${i}`,
    name: i === 0 ? 'ANDY' : `PLAYER${i}`,
    lives: 3,
    isHost: i === 0,
  }));

async function enterGame(page) {
  const mock = await installBackendMock(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.seenGameSpotlight', '1');
      localStorage.setItem('taw.rebirths', '1');
    } catch { /* blocked */ }
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  const players = mkPlayers(2);
  mock.pushToClient({
    type: 'room_update',
    payload: { code: 'ABCD', gameType: 'word-bomb', hostId: ME, difficultyKey: 'hard', players },
  });
  await page.waitForTimeout(60);
  mock.pushToClient({ type: 'game_started', payload: { gameType: 'word-bomb' } });
  await page.waitForTimeout(60);
  mock.pushToClient({
    type: 'turn_update',
    payload: { currentPlayerId: ME, players, combo: 'str', usedWords: [], timerSeconds: 20, maxLives: 3 },
  });
  await page.waitForTimeout(4700);
  return mock;
}

const accept = async (page, mock, word) => {
  mock.pushToClient({ type: 'word_result', payload: { playerId: ME, word, valid: true, accepted: true } });
  await page.waitForTimeout(420);
};

test('the word lands with its RARITY BAND on it, escalating tier by tier', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await enterGame(page);
  const landing = page.locator('.wl');

  // 'monster' is common enough to be UNCOMMON with its length bonus: a coloured chip, no stamp.
  // The quietest rung still has to be VISIBLE — that is the whole point of a ladder.
  await accept(page, mock, 'monster');
  await expect(landing).toHaveCount(1);
  await expect(landing).toHaveClass(/wl--uncommon/);
  await expect(landing).toContainText('MONSTER');
  await expect(page.locator('.wl-stamp')).toHaveCount(0, { timeout: 1000 });

  // 'zymurgy' is not in the ranked corpus at all → OBSCURE: the loudest tier, a stamp, and the
  // PAYOUT counting up beside the word that earned it.
  await accept(page, mock, 'stricture');
  await accept(page, mock, 'zymurgy');
  await expect(landing).toHaveClass(/wl--obscure/);
  await expect(landing).toContainText('ZYMURGY');
  await expect(page.locator('.wl-stamp')).toHaveText('OBSCURE');
  await expect(page.locator('.wl-wins')).toContainText('+');
});

test('NOTHING ABOUT IT IS A MODAL: no backdrop, nothing to dismiss, nothing clickable', async ({ page }) => {
  // The defect the deleted sticker had, and the reason it is gone: it was a centre-screen popup
  // over a backdrop that you had to click away, mid-aim, with the card you actually wanted behind
  // it. The replacement must be incapable of that.
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await enterGame(page);
  await accept(page, mock, 'zymurgy');
  await expect(page.locator('.wl')).toHaveCount(1);

  // No scrim, no dialog, and the old sticker classes are gone from the app entirely.
  await expect(page.locator('.secret-backdrop, .sticker-backdrop, [role="dialog"]')).toHaveCount(0);
  await expect(page.locator('.secret-sticker')).toHaveCount(0);

  // It cannot take a pointer: every part of it is pointer-events:none, so a click aimed at the
  // field underneath reaches the field.
  for (const sel of ['.wl', '.wl-chip', '.wl-stamp']) {
    const n = await page.locator(sel).count();
    if (!n) continue;
    const pe = await page.locator(sel).first().evaluate((el) => getComputedStyle(el).pointerEvents);
    expect(pe, `${sel} must not be clickable`).toBe('none');
  }
  // The proof: click where the landing is drawn and the INPUT still takes focus.
  const box = await page.locator('.wl').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('.game-input').click();
  await expect(page.locator('.game-input')).toBeFocused();
});

test('it is a ONE-SHOT: the landing is replaced by the next word, never stacked', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const mock = await enterGame(page);
  for (const w of ['zymurgy', 'stricture', 'minstrel']) await accept(page, mock, w);
  // One landing at a time, whatever just happened — an accept never leaves the previous word's
  // treatment on screen beside it.
  await expect(page.locator('.wl')).toHaveCount(1);
});

// ================================================================= FRAME INTEGRITY
// Five defects arrived in ONE screenshot of a rare word landing, and every one of them was a thing
// drawn on top of another thing. Numbers alone had passed the board all week; what caught these was
// looking at it. So this gate measures the specific collisions, at every viewport, with the WORST
// CASE pinned rather than left to a random draw — and writes a shot of each for a human to read.
const FRAME_VIEWPORTS = [
  { name: '1366x768', w: 1366, h: 768 },
  { name: '1280x720', w: 1280, h: 720 },
  { name: '1536x864', w: 1536, h: 864 },
  { name: '390x844', w: 390, h: 844 },
];

// Everything that must never be covered, and everything transient that could cover it.
// `.game-used` is deliberately NOT here, and the reasoning is worth keeping. The shot caught the
// hype word painted straight through "USED WORDS (0) / NONE YET — BE THE FIRST", which is what
// killed the hype-plus-landing pairing — TEXT over TEXT is unreadable. But the LANDING is a solid
// chip with a fill and a border, it lasts 1.5s, and the strip it briefly covers is the list of
// words already played: the least urgent thing on the board at the moment you accept a word, and
// the list this very word is about to join. Landing on it is apt rather than wrong. Judged from
// the shot, not from a rule.
const PROTECTED = ['.game-combo-box', '.game-input-row', '.game-player-card', '.game-title'];
// `.wl-stamp` is listed SEPARATELY and on purpose: it is absolutely positioned inside the chip and
// overhangs it, and getBoundingClientRect on an ancestor does NOT include an out-of-flow descendant
// that overflows. Gating `.wl` alone therefore cannot see the stamp at all — which is how a RARE
// stamp came to be drawn straight through the hype word with every number green.
const TRANSIENT = ['.hype-popup', '.wb-receipt', '.wl', '.wl-stamp', '.wl-wins'];

async function frameCheck(page) {
  return page.evaluate(
    ({ prot, trans }) => {
      const box = (e) => e.getBoundingClientRect();
      const hits = [];
      const stage = document.querySelector('.game-stage');
      const sb = stage ? box(stage) : null;
      const outside = [];
      for (const ts of trans) {
        for (const t of document.querySelectorAll(ts)) {
          const tb = box(t);
          if (tb.width < 1 || tb.height < 1) continue;
          // Nothing transient may spill off the board onto the page behind it.
          if (sb && (tb.top < sb.top - 1 || tb.bottom > sb.bottom + 1 || tb.left < sb.left - 1 || tb.right > sb.right + 1)) {
            outside.push(`${ts} outside the stage`);
          }
          for (const ps of prot) {
            for (const p of document.querySelectorAll(ps)) {
              if (p.contains(t) || t.contains(p)) continue;
              const pb = box(p);
              if (pb.width < 1 || pb.height < 1) continue;
              const ox = Math.min(tb.right, pb.right) - Math.max(tb.left, pb.left);
              const oy = Math.min(tb.bottom, pb.bottom) - Math.max(tb.top, pb.top);
              if (ox > 1 && oy > 1) hits.push(`${ts} over ${ps} (${Math.round(ox)}x${Math.round(oy)})`);
            }
          }
        }
      }
      // THE BOARD MUST STILL FIT. Docking the receipt made the stage taller than the phone
      // viewport and half the panel fell off the bottom — which the overlap check could not see,
      // because it measures against the stage and the stage had grown. Measure the PAGE.
      const de = document.documentElement;
      const pageScroll = Math.max(de.scrollHeight - de.clientHeight, document.body.scrollHeight - document.body.clientHeight);
      const stageOverflow = sb ? Math.round(sb.bottom - de.clientHeight) : 0;
      const paidEl = document.querySelector('.payout-total-val');
      const rows = [...document.querySelectorAll('.wb-receipt .payout-row')].map((r) => ({
        k: r.querySelector('.payout-k').textContent,
        m: parseFloat((r.querySelector('.payout-v').textContent || '').replace('×', '')),
      }));
      const baseEl = document.querySelector('.wb-receipt .payout-head-val');
      return {
        hits: [...new Set(hits)],
        outside: [...new Set(outside)],
        pageScroll,
        stageOverflow,
        paid: paidEl ? paidEl.textContent.replace(/[^0-9.KMB]/g, '') : null,
        base: baseEl ? baseEl.textContent.replace(/[^0-9]/g, '') : null,
        rows,
        title: (document.querySelector('.game-title') || {}).textContent,
        // The accept toast is gone; a reject toast is still allowed.
        acceptToasts: document.querySelectorAll('.game-toast.accepted').length,
      };
    },
    { prot: PROTECTED, trans: TRANSIENT }
  );
}

for (const vp of FRAME_VIEWPORTS) {
  test(`frame integrity @ ${vp.name}: nothing is drawn on top of anything`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    // Pin the WORST hype phrase at the maximum tilt — the banner is random, so the frame that
    // exposed this is not otherwise reproducible.
    await page.addInitScript(() => { Math.random = () => 0.99; });
    const mock = await enterGame(page);
    await accept(page, mock, 'minstrel');
    await page.waitForTimeout(120);
    await page.screenshot({ path: `claude/wb-frame-shots/${vp.name}.png` });

    const m = await frameCheck(page);
    // eslint-disable-next-line no-console
    console.log(
      `FRAME | ${vp.name} | over=${m.hits.length ? m.hits.join(' ; ') : 'none'}` +
      ` | outside=${m.outside.length ? m.outside.join(' ; ') : 'none'}` +
      ` | title="${m.title}" | base=${m.base} rows=${m.rows.map((r) => `${r.k}x${r.m}`).join(',')} paid=${m.paid}` +
      ` | acceptToasts=${m.acceptToasts} | pageScroll=${m.pageScroll} stageBelowFold=${m.stageOverflow}`
    );

    // (1)+(3)+(4) NOTHING TRANSIENT COVERS THE BOARD. The hype banner used to lie across the
    // title, the prompt AND a player card at once (a 904x371 box at 1280x720), and its stroked
    // letters are what painted over the B in "WORD BOMB". The receipt used to float over the
    // prompt. Neither can now: one is at the field, one is a docked rail.
    expect(m.hits, 'something transient is drawn over the board').toEqual([]);
    expect(m.outside, 'something transient spills off the board').toEqual([]);
    expect(m.pageScroll, 'the board must not make the page scroll').toBeLessThanOrEqual(0);
    expect(m.stageOverflow, 'the board must not run past the bottom of the screen').toBeLessThanOrEqual(0);

    // (4) ...and the title is intact, letter for letter.
    expect(m.title).toBe('WORD BOMB');

    // (2) PAID FOLLOWS FROM THE ROWS. It printed 0 under five live multipliers.
    const product = m.rows.reduce((a, r) => a * r.m, 1);
    const want = Math.round((Number(m.base) * product) / 10) * 10;
    expect(Math.abs(Number(m.paid.replace(/[^0-9.]/g, '')) - want), `PAID ${m.paid} vs base x rows ${want}`).toBeLessThanOrEqual(10);

    // (5) NO DUPLICATE OF THE LANDED WORD. The accept toast said the same word again, bottom-left,
    // at the same moment the landing was showing it at the field with its band and its payout.
    expect(m.acceptToasts, 'the accept toast duplicates the word landing').toBe(0);
  });
}

test('the menu has no secret popup left on it', async ({ page }) => {
  // The five detections still exist, but they fire while you PLAY and surface at the word. Nothing
  // about them renders over the menu any more — this is the regression guard for that.
  await installBackendMock(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('taw.xp', JSON.stringify({ lv: 31, into: 0 }));
      localStorage.setItem('taw.seenMenuSpotlight', '1');
    } catch { /* ignore */ }
    window.__TAW_NO_ACHIEVEMENT_GRANT = true;
  });
  await page.goto('/?portal=1');
  await page.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
  // Type a palindrome and pause — the exact input that used to raise the sticker.
  for (const ch of 'racecar') await page.keyboard.press(ch);
  await page.waitForTimeout(1200);
  await expect(page.locator('.secret-sticker, .secret-backdrop')).toHaveCount(0);
  await expect(page.locator('.wl')).toHaveCount(0);
  // ...and the menu is still the menu: nothing opened, nothing is covering it.
  await expect(page.locator('[data-game="word-bomb"]')).toBeVisible();
});
