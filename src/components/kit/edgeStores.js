// kit/edgeStores.js — the two EDGE queues of KitLevelUp.dc.html, apart from their art so a caller (a lazy moment, the
// shop, the tutorial host) can push without pulling the hosts' CSS in. Pure apart from the injected timers.
//   rankBanners — 02 RANK-UP BANNER: one at a time, 2.5 s (0.5 in · 1.6 hold · 0.4 out); a new one replaces it.
//   edgeToasts  — 04 UNLOCK TOAST: right edge, 2.4 s, up to 3 stacked downward; a 4th retires the oldest.
import { createBannerStore } from './bannerStore.js';

export const RANK_BANNER_MS = 2500;
export const TOAST_MS = 2400;

export const rankBanners = createBannerStore({ lifeMs: RANK_BANNER_MS, leaveMs: 0, max: 1 });
export const pushRankUp = (b) => rankBanners.push(b);

export const edgeToasts = createBannerStore({ lifeMs: TOAST_MS, leaveMs: 0, max: 3 });
export const pushToast = (t) => edgeToasts.push(t);
