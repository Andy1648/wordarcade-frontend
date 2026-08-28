// themes.js — the MENU THEME system. A theme recolors the whole menu (background, wordmark fill,
// XP bar fill, card accents, keystroke pop colours) via CSS custom properties set on the root's
// data-theme. It is the trail/aura equivalent for a game with no avatar: the reward you see every
// session. PURE catalog + logic + a single DOM side effect (applyTheme). localStorage-backed,
// every access guarded.
//
// SINGLE SOURCE OF TRUTH: each theme's palette lives here (JS). applyTheme() stamps the id on
// <html data-theme> AND writes every --theme-* var inline from this catalog, so the CSS just reads
// var(--theme-*) and the JS pop code reads the same `pops` array — CSS and JS can never drift.
//
// Theme ids are STABLE SAVE KEYS — never rename. They are namespaced away from the pop-style shop
// ids (which also has 'inferno'/'prism') by living under their OWN owned key (taw.themesOwned) and
// equipped key (taw.theme).

// Build a theme record from a compact palette. `vars` is the CSS-custom-property map applied to
// the root; `swatch` is the flat colour strip the shop preview renders; `pops` feeds the
// per-keystroke menu pops (useXpCapture).
function mk(id, name, price, unlockLevel, p) {
  return {
    id,
    name,
    price,
    unlockLevel, // 0 = no level path; else the level that unlocks it free (still buyable earlier)
    vars: {
      '--theme-bg': p.bg,
      '--theme-panel': p.panel,
      '--theme-ink': p.ink, // wordmark fill + primary menu accent
      '--theme-xp-fill': p.xp, // XP bar fill
      '--theme-accent': p.accent, // secondary accent (labels, marker)
      '--theme-card-accent': p.cardAccent || p.ink, // menu card chrome accent
      '--theme-pop-1': p.pops[0],
      '--theme-pop-2': p.pops[1],
      '--theme-pop-3': p.pops[2],
      '--theme-pop-4': p.pops[3],
    },
    swatch: [p.bg, p.ink, p.xp, p.accent],
    pops: p.pops,
  };
}

// The five shipped themes — all inside the Newgrounds/Y2K language (bold, flat, thick outlines).
export const THEMES = [
  mk('default', 'DEFAULT', 0, 0, {
    bg: '#0d0618', panel: '#1a0b2e', ink: '#FF2EC4', xp: '#2EFFE0', accent: '#FFE94A',
    pops: ['#2EFFE0', '#FFE94A', '#FF6B3D', '#FF2EC4'],
  }),
  mk('midnight', 'MIDNIGHT', 600, 10, {
    bg: '#050a1a', panel: '#0c1730', ink: '#2ED0FF', xp: '#4CE0FF', accent: '#8FB8FF',
    cardAccent: '#2ED0FF',
    pops: ['#4CE0FF', '#8FB8FF', '#3D6BFF', '#00A3FF'],
  }),
  mk('inferno', 'INFERNO', 2500, 0, {
    bg: '#180402', panel: '#2c0a04', ink: '#FF6B3D', xp: '#FFB23D', accent: '#FFE94A',
    cardAccent: '#FF3D2E',
    pops: ['#FFB23D', '#FF6B3D', '#FF2E2E', '#FFE94A'],
  }),
  mk('toxic', 'TOXIC', 8000, 30, {
    bg: '#0a1405', panel: '#16260c', ink: '#9EFF2E', xp: '#C8FF3D', accent: '#B44CFF',
    cardAccent: '#9A1AFF',
    pops: ['#C8FF3D', '#9EFF2E', '#B44CFF', '#FF2EC4'],
  }),
  mk('prism', 'PRISM', 25000, 0, {
    bg: '#120a24', panel: '#231240', ink: '#FF2EC4', xp: '#00FFB3', accent: '#FFE94A',
    cardAccent: '#8A2EFF',
    pops: ['#FF2EC4', '#00E0FF', '#FFE94A', '#8A2EFF'],
  }),
];

export const DEFAULT_THEME_ID = 'default';
export const THEME_KEY = 'taw.theme'; // the EQUIPPED theme id
export const THEMES_OWNED_KEY = 'taw.themesOwned'; // ids the player has bought OR level-unlocked

const BY_ID = new Map(THEMES.map((t) => [t.id, t]));
export function themeById(id) {
  return BY_ID.get(id) || null;
}

// ---- ownership -------------------------------------------------------------------------------
// A theme is OWNED if it's the free default, OR it's in the persisted owned set (bought, or a
// level unlock that has been GRANTED — see syncThemeUnlocks). Level unlocks are granted once and
// then stored, so they survive rebirth (which drops the live level back to 1).
export function getOwnedThemes() {
  const set = new Set([DEFAULT_THEME_ID]);
  try {
    const raw = localStorage.getItem(THEMES_OWNED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) for (const id of arr) if (BY_ID.has(id)) set.add(id);
  } catch {
    /* storage blocked — just the default */
  }
  return set;
}
function saveOwnedThemes(set) {
  try {
    localStorage.setItem(THEMES_OWNED_KEY, JSON.stringify([...set]));
  } catch {
    /* storage blocked */
  }
}
export function isThemeOwned(id, owned = getOwnedThemes()) {
  return id === DEFAULT_THEME_ID || owned.has(id);
}

// Grant any theme whose free level gate the player has reached (idempotent). Returns the list of
// newly-granted ids (so a caller can celebrate a fresh unlock). Called on menu mount + level-up.
export function syncThemeUnlocks(level) {
  const lv = Number.isFinite(level) ? level : 0;
  const owned = getOwnedThemes();
  const granted = [];
  for (const t of THEMES) {
    if (t.unlockLevel > 0 && lv >= t.unlockLevel && !owned.has(t.id)) {
      owned.add(t.id);
      granted.push(t.id);
    }
  }
  if (granted.length) saveOwnedThemes(owned);
  return granted;
}

// Buy a theme with wins (deferred import to avoid a cycle with wins.js). Must exist, cost > 0,
// not already owned, affordable. Returns { ok, reason?, wins }.
export function buyTheme(id, winsApi) {
  const t = themeById(id);
  const { getWins, saveWins } = winsApi;
  if (!t) return { ok: false, reason: 'unknown', wins: getWins() };
  const owned = getOwnedThemes();
  if (isThemeOwned(id, owned)) return { ok: false, reason: 'owned', wins: getWins() };
  const wins = getWins();
  if (wins < t.price) return { ok: false, reason: 'unaffordable', wins };
  const next = wins - t.price;
  saveWins(next); // spendable balance only — never winsLifetime (matches shop.buy)
  owned.add(id);
  saveOwnedThemes(owned);
  return { ok: true, wins: next };
}

// ---- equipped + apply ------------------------------------------------------------------------
// The equipped theme id (falls back to default if the stored one isn't owned — e.g. a corrupted
// save, or a level unlock that hasn't been synced yet on this load).
export function getEquippedTheme() {
  try {
    const id = localStorage.getItem(THEME_KEY);
    if (id && BY_ID.has(id)) return id;
  } catch {
    /* storage blocked */
  }
  return DEFAULT_THEME_ID;
}

// Persist + APPLY a theme. Equipping is only allowed for an owned theme; an unowned id is ignored
// (returns false). applyTheme does the DOM write; this also writes taw.theme so it survives reload.
export function setEquippedTheme(id) {
  if (!isThemeOwned(id)) return false;
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    /* storage blocked — still apply for this session */
  }
  applyTheme(id);
  return true;
}

// The one DOM side effect: stamp <html data-theme> and write every --theme-* var inline from the
// catalog. Safe with no DOM (SSR/tests) — it simply no-ops. Falls back to default for an unknown id.
export function applyTheme(id) {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const t = themeById(id) || themeById(DEFAULT_THEME_ID);
  const root = document.documentElement;
  root.dataset.theme = t.id;
  for (const [k, v] of Object.entries(t.vars)) root.style.setProperty(k, v);
}

// The pop colours (per-keystroke menu pops) for the CURRENTLY equipped theme — read by
// useXpCapture. Pure lookup over the catalog; never touches the DOM.
export function equippedPopColors() {
  const t = themeById(getEquippedTheme()) || THEMES[0];
  return t.pops;
}

// Apply the persisted theme on boot. Call once as early as possible (main.jsx) so the menu paints
// in the right palette with no flash.
export function initTheme() {
  applyTheme(getEquippedTheme());
}
