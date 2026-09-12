// e2e/blitz-craft-shots.spec.js — the SCREENSHOT pass for Category Blitz (feat/blitz-craft).
//
// Not a gate: this exists so the screens can be LOOKED AT. Every state x every viewport x
// 2 and 4 players lands in claude/blitz-craft-shots/ (override the folder with SHOT_DIR to
// keep a before/after pair). The gates live in e2e/blitz-craft.spec.js.
import { test } from '@playwright/test';
import { startBlitz, fillAnswers, VIEWPORTS, LONG_CATEGORY, SAMPLE_ANSWERS } from './support/blitz.js';

const DIR = process.env.SHOT_DIR || 'claude/blitz-craft-shots';
const shot = (page, name) => page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false });

for (const vp of VIEWPORTS) {
  for (const players of [2, 4]) {
    const tag = `${vp.name}-${players}p`;

    test(`blitz shots ${tag}`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const api = await startBlitz(page, { players, category: LONG_CATEGORY, timerSeconds: 60 });

      // 1. round start — full clock, no answers, the LONG category (the hard case).
      await api.tick(60);
      await shot(page, `${tag}-01-round-start`);

      // 2. mid-round with answers in.
      await fillAnswers(api, SAMPLE_ANSWERS.slice(0, 4));
      for (const s of api.seats.slice(1)) await api.progress(s.id, 3);
      await api.tick(42);
      await shot(page, `${tag}-02-mid-round`);

      // 3. the 50% timer step.
      await api.tick(30);
      await shot(page, `${tag}-03-timer-50`);

      // 4. the 20% timer step.
      await api.tick(12);
      await shot(page, `${tag}-04-timer-20`);

      // 5. a verdict — accepted.
      await api.accept('HORSESHOE CRAB');
      await shot(page, `${tag}-05-verdict-accepted`);

      // 6. a verdict — rejected.
      await api.reject('BICYCLE');
      await shot(page, `${tag}-06-verdict-rejected`);

      // 7. between-rounds results.
      await api.roundEnd();
      await shot(page, `${tag}-07-round-results`);
    });
  }
}
