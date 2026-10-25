// ads/rewarded.js — the REWARDED-AD adapter (claude notes ads-platform-decision.md: Google H5 Games Ads first,
// Playgama / AppLixir as fallbacks — swapping networks is a change to THIS file only).
//
//   rewardedReady()        an ad is preloaded and the player may watch one (always false until a network is wired)
//   showRewarded(name)     → Promise<'viewed' | 'dismissed' | 'unavailable'>
//
// NOT WIRED: AdSense H5 is not approved yet, so there is no ad script and this always answers 'unavailable'. The
// DAILY WHEEL's extra spin is also gated by WHEEL_AD_ON (progress/wheel.js) and the server's private.wheel_config.ad_on,
// and the server caps it at one a day. Rules when it is wired: rewarded only, opt-in behind a button, muted, the
// child-directed tag on for every request, never in class rooms or mid-round.
export const ADS_WIRED = false;

export function rewardedReady() {
  return ADS_WIRED;
}

export async function showRewarded(/* name */) {
  return 'unavailable';
}
