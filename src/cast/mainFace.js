// mainFace.js — the menu's PROFILE face without pulling the cast data into the homepage's first paint (payload
// ratchet): your MAIN's HERO image path from storage, shape-checked only. cast.js readMain() (ownership, fallbacks)
// stays the authority everywhere a hero is actually drawn big.
const ID = /^((riot|glitch|hype|brawl|hex)(-elite|-gold)?|dud|lexi|boo|shh|sizzle|mecha|quill|jinx|hollow|nova)$/;
export function mainFaceSrc(id) {
  let v = id;
  if (!v) { try { v = localStorage.getItem('taw.main'); } catch { v = null; } }
  return `/cast/${ID.test(v || '') ? v : 'riot'}-hero.webp`;
}
/** The TITLE's hero (splash + the fresh menu, feat/first-run-reveal): your MAIN, big. A fresh save's main is RIOT, whose
 *  title cut is a 384px webp (~29 KB, first-load payload) instead of the 512px cast art; any other main uses its hero art. */
export function titleHeroSrc(id) {
  const src = mainFaceSrc(id);
  return src === '/cast/riot-hero.webp' ? '/cast/riot-title.webp' : src;
}
