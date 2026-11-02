// boostArt.js — THE PAINTED BOOST ART (ChatGPT oct29, gear quality; public/shop/*-v2.webp, immutable-cached). One
// picture per boost, shown EVERYWHERE that boost shows: its shop card, the BOOST dock, STATS → BOOSTS, the phone menu
// pill, the daily chest's OVERDRIVE prize. Keyed by the live boost's icon name (liveBoost.js activeBoosts) and by the
// shop stock id. A BOOST code / FRENZY has no painting: boostArt() is null and the surface keeps its kit glyph.
export const BOOST_ART = {
  levels: '/shop/xp-v2.webp',
  wins: '/shop/wins-v2.webp',
  luck: '/shop/luck-v2.webp',
  overdrive: '/shop/overdrive-v2.webp',
};
export const SHOP_ITEM_ART = {
  xp25: BOOST_ART.levels,
  wins25: BOOST_ART.wins,
  luck2: BOOST_ART.luck,
  overdrive: BOOST_ART.overdrive,
  extend: '/shop/everything-v2.webp',
};
export const CHEST_ART = '/shop/chest-v2.webp';

/** The painting for a live boost's icon name, or null (keep the glyph). */
export const boostArt = (icon) => BOOST_ART[icon] || null;
