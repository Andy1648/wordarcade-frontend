// v3/install.js — turns the v3 rules ON (PROGRESSION v3, SEASON2). Its own lazy chunk: main.jsx imports it (through
// installUi.jsx) before the first render only when the flag is on, so the live game never downloads it. Node-safe —
// the sims and the unit tests import it alone, after turning the flag on. It
//   1. maps the season's keys to taw.s2.* at the storage layer (hooks.patchStorage) — the season keeps its own save,
//   2. swaps the v3 versions into the live modules through their `__v3` setters (v3/hooks.js),
//   3. fills season.js's V3 holder (the few remaining one-line season-2 branches read it),
//   4. stamps the season's gem state (no starting grant — the reset's is phase 4).
import { V3 } from '../season.js';
import * as econ from './econ.js';
import * as curve from './curve.js';
import * as store from './store.js';
import * as unlocks from './unlocks.js';
import * as ranks from './ranks.js';
import * as hooks from './hooks.js';
import * as stock from './stock.js'; // the SHOP's STOCK (P3) — ShopV2 reads it as V3.stock
import * as drop from './dailyDrop.js'; // the DAILY FREE DROP — ShopV2 + the menu's UPGRADES dot read it as V3.drop
import { __v3 as xpV3, storedLevel } from '../xp.js';
import { __v3 as starsV3 } from '../stars.js';
import { __v3 as gemsV3, dropGemsForWord, gemsMigrated, stampGemsMigrated } from '../gemsCore.js';
import { __v3 as shopV3, buyKeyPower } from '../shop.js';
import { __v3 as claimsV3 } from '../claims.js';
import { __v3 as achV3 } from '../achievements.js';
import { __v3 as rankV3 } from '../rank.js';
import { __v3 as boostV3, codeBoostMult, startBoost } from '../boost.js';
import { __v3 as winsV3, bankWordWins } from '../wins.js';
import { __v3 as frenzyV3 } from '../frenzy.js';
import { __v3 as gemsResultV3, gameResultPayout, payGameResult } from '../gems.js';

if (!V3.ready) {
  hooks.patchStorage(typeof Storage !== 'undefined' ? null : globalThis.localStorage);
  xpV3(hooks.xpSwap);
  starsV3(hooks.starsSwap);
  gemsV3({ ...hooks.gemsSwap, e: hooks.countingDrop(dropGemsForWord) });
  shopV3({ ...hooks.shopSwap, b: hooks.countingPower(buyKeyPower), c: hooks.powerAffordable });
  claimsV3(hooks.claimsSwap);
  achV3(hooks.achSwap);
  rankV3(hooks.rankSwap);
  boostV3(hooks.boostSwap(codeBoostMult, startBoost));
  winsV3({ a: hooks.countingBank(bankWordWins), w: stock.stockWinsMult });
  frenzyV3(); // FUSE FRENZY = ×5 XP per key, no wins multiplier (Andy oct8)
  gemsResultV3({ a: hooks.flatStreak(gameResultPayout), b: hooks.countingResult(payGameResult) });
  Object.assign(V3, { econ, curve, store, unlocks, ranks, hooks, stock, drop, m: hooks.mark2Factor, c2: hooks.mark2For, ready: true });
  try {
    if (!gemsMigrated()) stampGemsMigrated({ peak: storedLevel() });
  } catch {
    /* blocked storage */
  }
}
export default V3;
