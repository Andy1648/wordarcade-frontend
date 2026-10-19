// S2Notify.jsx — P7 POPUP PURGE (SEASON2 only): the season's EDGE notification layer. LAZY — part of the v3 UI chunk
// (installUi.jsx), so the live game never downloads it.
//
// It mounts the two kit hosts that replace every centre-screen popup in season 2:
//   KitRankBannerHost — the TOP-edge RANK-UP banner (v3 rank names; rank-ups pay nothing) — also the board's #12 → #7
//   KitEdgeToastHost  — the RIGHT-edge toasts (unlocks, a bought item, a first-time tip, the dev-reset line)
// and, with `check`, reads the v3 news once per menu visit (v3/notify.js checkNews) after the arrival wipe settles.
// Rendered (as V3.Notify, lazily) by S2Trophy — the menu's ACHIEVEMENTS slab, so the menu needs no new eager code —
// and by ShopScreen.
// None of it takes a pointer, none of it is centred, and nothing here claims or pays.
// ACHIEVEMENT POP-UPS (Andy oct19): with `check`, a tier that just became claimable is toasted once (v3/notify.js
// checkAchNews) — on arrival (a tier reached in a game is said back on the menu) and live on every counter write
// (ACH_CHANGE — never per frame). `quiet` (the ACHIEVEMENTS screen is open) notes them without a toast. `news` = the
// rank-up banner + unlock toasts, still OFF under the one-notice rule (installUi.jsx SILENT).
import { useEffect, useRef } from 'react';
import { KitRankBannerHost, KitEdgeToastHost, pushRankUp, pushToast } from './kit/index.js'; // through the barrel: one shared kit chunk
import { checkNews, checkAchNews } from '../progress/v3/notify.js';
import { ACH_CHANGE } from '../progress/v3/store.js';

export { pushRankUp, pushToast }; // V3.rankUp / V3.toast (installUi.jsx) push through these

// The menu's arrival wipe (~600 ms) — news lands on a settled menu, never under the wipe.
export const NEWS_DELAY_MS = 700;

const sayAch = (quiet) => {
  try {
    for (const t of checkAchNews({ quiet })) pushToast(t);
  } catch {
    /* storage blocked: say nothing */
  }
};

export default function S2Notify({ check = false, news = true, quiet = false }) {
  const quietRef = useRef(quiet);
  quietRef.current = quiet;
  useEffect(() => {
    if (!check) return undefined;
    const t = setTimeout(() => {
      sayAch(quietRef.current);
      if (!news) return;
      let n = null;
      try {
        n = checkNews();
      } catch {
        return;
      }
      if (n.rank) pushRankUp(n.rank);
      for (const u of n.unlocks) pushToast(u);
    }, NEWS_DELAY_MS);
    const live = () => sayAch(quietRef.current);
    window.addEventListener(ACH_CHANGE, live);
    return () => {
      clearTimeout(t);
      window.removeEventListener(ACH_CHANGE, live);
    };
  }, [check, news]);
  return (
    <>
      <KitRankBannerHost />
      <KitEdgeToastHost />
    </>
  );
}
