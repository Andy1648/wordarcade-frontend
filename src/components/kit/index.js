// kit/index.js — THE V2 KIT (Andy's visual overhaul, step 1). Shared components built from
// claude/mockups/v2/Kit{Buttons,Currency,Bars,Icons}.dc.html. Tokens: ./tokens.css.
// Dev gallery (every component, every state): /?kit=1 on the dev server or a VITE_KIT_GALLERY build.
export { default as KitIcon, dropFor } from './KitIcon.jsx';
export { KIT_ICONS, KIT_ICON_NAMES } from './kitIconData.js';

export { KitButton, KitHoldButton, KitGhostButton, KitBackButton, KitIconButton, KitRailButton, KitCycleButton } from './KitButton.jsx';
export { KitSlabTabs, KitPlateTabs } from './KitTabs.jsx';
export { KitToggle } from './KitToggle.jsx';

export { KitPill, PILL_KINDS } from './KitPill.jsx';
export { KitPopStage, POP_MS } from './KitPops.jsx';
export { KitFlyLayer, useCachedCenter } from './KitFly.jsx';
export { KitStamp, KitStampCard, STAMP_KINDS } from './KitStamp.jsx';
export { KitBadge } from './KitBadge.jsx';
export { KitBannerHost, BANNER_TONES } from './KitBanner.jsx';
export { banners, pushBanner, closeBanner, createBannerStore } from './bannerStore.js';
// KitLevelUp.dc.html 02 RANK-UP BANNER (top edge) + 04 UNLOCK TOAST (right edge) — P7's minimal pieces; P9a extends them.
export { KitRankBannerHost, RANK_PLATE } from './KitRankBanner.jsx';
export { KitEdgeToastHost, TOAST_STEP } from './KitEdgeToast.jsx';
export { rankBanners, pushRankUp, edgeToasts, pushToast, RANK_BANNER_MS, TOAST_MS } from './edgeStores.js';

export { KitXpBar } from './KitXpBar.jsx';
export { KitPityBar } from './KitPityBar.jsx';
export { KitTimerRing, KitTimerBar, KitTimerChip, mmss } from './KitTimer.jsx';
export { KitGoalBar } from './KitGoalBar.jsx';

export { createHoldConfirm, HOLD_MS } from './holdConfirm.js';
export { createCountTween, COUNT_GAIN_MS, COUNT_SPEND_MS } from './countTween.js';
export { planClimb, createClimbPlayer, CLIMB_MAX_MS } from './climb.js';
export { kitPlay, fx, FX } from './motion.js';
