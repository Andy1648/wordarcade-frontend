// mainFace.js — the menu's PROFILE face without pulling the cast data into the homepage's first paint (payload
// ratchet): your MAIN's HERO image path from storage, shape-checked only. cast.js readMain() (ownership, fallbacks)
// stays the authority everywhere a hero is actually drawn big.
const ID = /^((riot|glitch|hype|brawl|hex)(-elite)?|dud|lexi|boo)$/;
export function mainFaceSrc(id) {
  let v = id;
  if (!v) { try { v = localStorage.getItem('taw.main'); } catch { v = null; } }
  return `/cast/${ID.test(v || '') ? v : 'riot'}-hero.webp`;
}
