// heroWins.js — GAMES WON PER HERO (oct18, Andy: GOLD variants "like shinies", free, earned with ~100 wins with a hero).
// Every win (bots or online) counts for the hero you had equipped; a GOLD or ELITE version counts toward its crew member
// (riot-gold / riot-elite → riot). Stored at taw.s2.herowins = { riot: 37, … } — a season-2 progress key, so the save
// backup / cloud save carry it. Kept apart from cast.js (no cast data import) so the season-2 win hook in the main
// bundle never pulls the lazy cast chunk in; the equipped id is read straight from storage and only shape-checked.
export const HERO_WINS_KEY = 'taw.s2.herowins';
const MAIN_KEY = 'taw.main';
const ID = /^[a-z]{2,12}$/;

/** The crew id a hero's wins count toward ('riot-gold' → 'riot'). */
export const heroWinsBase = (id) => String(id || '').replace(/-(gold|elite)$/, '');

export function readHeroWins() {
  try {
    const v = JSON.parse(localStorage.getItem(HERO_WINS_KEY) || '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out = {};
    for (const [k, n] of Object.entries(v)) if (ID.test(k) && Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
    return out;
  } catch { return {}; }
}
export const heroWins = (id) => readHeroWins()[heroWinsBase(id)] || 0;

/** A win: +1 for the equipped hero (default RIOT, matching cast.js readMain). */
export function bumpHeroWin() {
  try {
    let id = 'riot';
    try { id = localStorage.getItem(MAIN_KEY) || 'riot'; } catch { /* blocked */ }
    const base = heroWinsBase(id);
    if (!ID.test(base)) return;
    const w = readHeroWins();
    w[base] = (w[base] || 0) + 1;
    localStorage.setItem(HERO_WINS_KEY, JSON.stringify(w));
  } catch { /* blocked storage: the win still pays, it just doesn't count toward GOLD */ }
}
