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

async function enterGame(page, playerCount = 2) {
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
  const players = mkPlayers(playerCount);
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
// UPDATED (integration/board-v2): the board now LIFTS the reaction clear of the strip whenever
// there is an empty band above it — which is every rails board and the 390x844 phone. It stays
// only where lifting would put the chip on a SEAT instead, which is 320x640. So this exemption is
// now the fallback of last resort rather than the normal case, and the 8-player stacked test at
// the bottom of this file is what holds the line on which of the two overlaps is chosen.
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
    // THE BOARD BEFORE THE WORD. A transient must not RESIZE the board — the check below is the
    // one that would have caught integration/board-v2's real defect instead of its symptom:
    // chain A's payout receipt matched no grid area on the ring board, fell into the implicit grid
    // as a full-width row, and the first accepted word added 158px of board height. wbRingSize
    // gave the height back the only way it can, and the ring went from 322px to 58px at 1280x720.
    // Everything downstream of that read as a 27px overlap. The board gate never sees it because
    // the board gate never accepts a word.
    const ringBefore = await page.evaluate(() => {
      const el = document.querySelector('.wb-ring');
      return el ? Math.round(el.getBoundingClientRect().width) : 0;
    });
    await accept(page, mock, 'minstrel');
    await page.waitForTimeout(120);
    await page.screenshot({ path: `claude/wb-frame-shots/${vp.name}.png` });
    const ringAfter = await page.evaluate(() => {
      const el = document.querySelector('.wb-ring');
      return el ? Math.round(el.getBoundingClientRect().width) : 0;
    });
    expect(ringBefore, 'the ring must exist before the word').toBeGreaterThan(100);
    // 2% or 4px, whichever is larger. Not zero, and the reason is worth stating: on the STACKED
    // phone board the used-words strip gains a real chip when the word is accepted, which is
    // content changing, not a transient taking space — measured, that is a 3px adjustment on a
    // 247px ring (1.2%). The failure this guards against was -82%.
    const ringTol = Math.max(4, ringBefore * 0.02);
    expect(
      Math.abs(ringAfter - ringBefore),
      `an accepted word resized the ring: ${ringBefore}px -> ${ringAfter}px (tol ${ringTol.toFixed(1)}px)`
    ).toBeLessThanOrEqual(ringTol);

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

// THE BAND BETWEEN THE PHONE AND THE DESKTOP. The receipt is hidden below 900px and every frame
// test above runs at 1280 or wider, so the whole 900-1279px range — every small laptop, every
// tablet in landscape — went untested, and the docked receipt sat on the SKIP button through all
// of it: measured 59px at 900, 63px at 1024, 42px at 1100, 24px at 1200, clear only from 1260.
// "The input row is capped at 760px and centred, so they cannot meet" was a claim about a gutter
// nobody had measured. The board now MAKES that gutter (the input row gives up width until the
// receipt's column fits beside it) and this is what holds it.
for (const w of [900, 1024, 1100, 1200]) {
  test(`the receipt clears the input row @ ${w}px`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 800 });
    const mock = await enterGame(page);
    await accept(page, mock, 'zymurgy');
    await page.waitForTimeout(150);
    // SHOT, not just numbers — this whole band shipped broken precisely because nobody had
    // looked at it.
    await page.screenshot({ path: `claude/wb-frame-shots/band-${w}.png` });
    const m = await page.evaluate(() => {
      const R = (sel) => {
        const e = document.querySelector(sel);
        return e ? e.getBoundingClientRect() : null;
      };
      const px = (a, b) => {
        if (!a || !b) return 0;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return ox > 0 && oy > 0 ? Math.round(Math.min(ox, oy)) : 0;
      };
      const rec = R('.wb-receipt');
      const row = R('.game-input-row');
      const inp = document.querySelector('.game-input');
      let phOver = 0;
      if (inp) {
        const cs = getComputedStyle(inp);
        const ps = getComputedStyle(inp, '::placeholder');
        const c = document.createElement('canvas').getContext('2d');
        c.font = `${ps.fontWeight} ${ps.fontSize} ${ps.fontFamily}`;
        const inner = inp.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        phOver = Math.round(Math.max(
          c.measureText('TYPE A WORD…').width,
          c.measureText('WAIT YOUR TURN…').width
        ) - inner);
      }
      // ...and the LANDING, which shares this band, must not be drawn through a seat. At 900px the
      // OBSCURE chip overflowed its "max-width" and covered the 6 o'clock avatar and its name.
      const wl = R('.wl');
      let seat = 0;
      for (const sel of ['.game-player-card', '.game-player-name-text']) {
        for (const e of document.querySelectorAll(sel)) {
          seat = Math.max(seat, px(wl, e.getBoundingClientRect()));
        }
      }
      return {
        seat,
        wlRight: wl ? Math.round(wl.right) : 0,
        present: !!rec,
        skip: px(rec, R('.game-skip-btn')),
        send: px(rec, R('.game-send-btn')),
        row: px(rec, row),
        used: px(rec, R('.game-stage--wb .game-used')),
        status: px(rec, R('.wb-status')),
        // the row must not overflow its own cap either — that is how SKIP escaped it the first time
        rowOverflow: row ? Math.round(R('.game-skip-btn').right - row.right) : 0,
        phOver,
      };
    });
    // eslint-disable-next-line no-console
    console.log(`RECEIPT | ${w}px | present=${m.present} skip=${m.skip} send=${m.send} row=${m.row}` +
      ` used=${m.used} status=${m.status} rowOverflow=${m.rowOverflow} placeholderOver=${m.phOver} seat=${m.seat}`);
    expect(m.seat, 'the word landing is drawn through a seat').toBe(0);
    expect(m.present, 'the receipt should be shown at this width').toBe(true);
    expect(m.skip, 'the receipt covers SKIP').toBe(0);
    expect(m.send, 'the receipt covers SEND').toBe(0);
    expect(m.row, 'the receipt covers the input row').toBe(0);
    expect(m.used, 'the receipt covers the used-words card').toBe(0);
    expect(m.status, 'the receipt covers the MATCH readout').toBe(0);
    // 1px of tolerance: the row's width is fractional and both edges are rounded independently.
    expect(m.rowOverflow, 'SKIP hangs outside the input row').toBeLessThanOrEqual(1);
    expect(m.phOver, 'the placeholder does not fit the narrowed field').toBeLessThanOrEqual(0);
  });
}

// THE STACKED BOARD AT A FULL TABLE. Every frame test above enters at TWO players, and two
// players is the one seat count where the phone board has room to spare: the ring is small and the
// band above the used-words strip is empty. At eight the ring fills that band, and the reaction —
// which lifts itself over the strip when it can — has to decide between covering the strip and
// covering a SEAT. It must never pick the seat. (Measured before the fix: 16px of chip over a
// player card at 320x640, at four AND eight players.)
for (const vp of [{ name: '390x844', w: 390, h: 844 }, { name: '320x640', w: 320, h: 640 }]) {
  test(`stacked board @ ${vp.name} / 8p: the landing never covers a seat`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.addInitScript(() => { Math.random = () => 0.99; });
    const mock = await enterGame(page, 8);
    await accept(page, mock, 'zymurgy');
    await page.waitForTimeout(150);
    await page.screenshot({ path: `claude/wb-frame-shots/stacked-${vp.name}-8p.png` });
    const hits = await page.evaluate(() => {
      const R = (e) => e.getBoundingClientRect();
      const px = (a, b) => {
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return ox > 1 && oy > 1 ? Math.round(Math.min(ox, oy)) : 0;
      };
      const out = [];
      for (const t of document.querySelectorAll('.wl, .wl-stamp, .wl-wins, .hype-popup')) {
        for (const sel of ['.game-player-card', '.game-player-name-text', '.game-input-row', '.game-combo-box']) {
          for (const p of document.querySelectorAll(sel)) {
            const n = px(R(t), R(p));
            if (n) out.push(`${t.className.split(' ')[0]} over ${sel} ${n}px`);
          }
        }
      }
      return [...new Set(out)];
    });
    // eslint-disable-next-line no-console
    console.log(`STACKED | ${vp.name} | 8p | ${hits.length ? hits.join(' ; ') : 'clear'}`);
    expect(hits, 'the landing covers a seat or a control on the stacked board').toEqual([]);
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
