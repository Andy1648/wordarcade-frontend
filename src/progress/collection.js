// collection.js — the WORD COLLECTION (Job 3). Rarity used to only multiply wins; now every DISTINCT
// word you accept is recorded (with its rarity tier, the first mode you found it in, and the first
// date) and accumulates into a permanent collection with milestone payouts. Build note: the spec
// referenced a records.js "distinct set" — that lived on an unmerged branch and is absent from main,
// so this is the from-scratch store (the substance of the job either way).
//
// localStorage-backed, every access guarded. Compact encoding: each word maps to a 4-int array
// [bandIdx, modeIdx, dayEpoch, recency] so 5,000 entries stay small (see collection.test.js MEASURE).
// The set is capped at 5,000 with LRU eviction (least-recently-SEEN word drops when a new word
// arrives at the cap). NEVER stores or shows a word the player hasn't personally typed.
import { grantWins } from './wins.js';
import { rebirthScaledWins } from './xp.js';

export const COLLECTION_KEY = 'taw.collection';
export const COLLECTION_CAP = 5000;
export const COLLECTION_VERSION = 1;

// Tier bands, index-encoded (matches rarity.js RARITY_BANDS + OBSCURE). Order = increasing rarity.
export const TIERS = ['COMMON', 'UNCOMMON', 'RARE', 'OBSCURE'];
export const TIER_COLORS = { COMMON: '#F0EAD9', UNCOMMON: '#2EFFE0', RARE: '#9A1AFF', OBSCURE: '#FFD54A' };
function bandIdx(band) {
  const i = TIERS.indexOf(band);
  return i < 0 ? 0 : i;
}
// Mode ids, index-encoded (the XP-style ids used at the accept sites).
export const COLLECTION_MODES = ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse'];
function modeIdx(mode) {
  const i = COLLECTION_MODES.indexOf(mode);
  return i < 0 ? 0 : i;
}

// Milestones: distinct-word thresholds → BASE wins, scaled by the live rebirth mult at grant time so
// they stay meaningful into late game (where a rebirth ×10+ makes flat grants trivial). Amounts ramp
// exponentially so the 5,000-word grant is a genuine late-game windfall, not pocket change.
export const COLLECTION_MILESTONES = [
  { n: 100, wins: 5000 },
  { n: 500, wins: 50000 },
  { n: 1000, wins: 250000 },
  { n: 2500, wins: 2000000 },
  { n: 5000, wins: 20000000 },
];

const DAY_MS = 86400000;
const today = () => Math.floor(Date.now() / DAY_MS);

function fresh() {
  return { v: COLLECTION_VERSION, seq: 0, w: {}, ms: [] };
}

// Session cache: the whole store can reach ~140KB at the 5,000-word cap, and a word is accepted
// often enough that re-parsing it on every accept would be wasteful. We cache the live object and
// invalidate it whenever the underlying localStorage OBJECT changes — which is exactly what the
// test harness does when it swaps in a fresh mock per test, so isolation is preserved while the
// browser (a single stable localStorage) keeps the cache warm across a whole session.
let _cache = null;
let _cacheLS = null;

export function loadCollection() {
  const ls = typeof localStorage !== 'undefined' ? localStorage : null;
  if (_cache && _cacheLS === ls) return _cache;
  let data = fresh();
  try {
    const raw = ls ? ls.getItem(COLLECTION_KEY) : null;
    if (raw != null) {
      const o = JSON.parse(raw);
      if (o && typeof o === 'object' && o.w && typeof o.w === 'object') {
        const seq = Number.isFinite(o.seq) && o.seq >= 0 ? Math.floor(o.seq) : 0;
        const ms = Array.isArray(o.ms) ? o.ms.filter((n) => Number.isFinite(n)) : [];
        const w = {};
        for (const [word, e] of Object.entries(o.w)) {
          if (Array.isArray(e) && e.length === 4 && e.every((x) => Number.isFinite(x))) w[word] = e;
        }
        data = { v: COLLECTION_VERSION, seq, w, ms };
      }
    }
  } catch {
    data = fresh();
  }
  _cache = data;
  _cacheLS = ls;
  return data;
}

function save(data) {
  _cache = data;
  _cacheLS = typeof localStorage !== 'undefined' ? localStorage : null;
  try {
    localStorage.setItem(COLLECTION_KEY, JSON.stringify(data));
  } catch {
    /* storage blocked / full — the in-memory cache still keeps the session consistent */
  }
}

// Normalise a candidate word exactly like the rarity/used-word paths (trim + lowercase). Empty → null.
function norm(word) {
  const w = typeof word === 'string' ? word.trim().toLowerCase() : '';
  return w || null;
}

// Record one ACCEPTED word. Adds it (or refreshes its recency if already collected), evicts the
// least-recently-seen word past the cap, and pays any newly-crossed milestone (× rebirth). Returns
// { isNew, count, milestone } where milestone = { n, wins } (wins already granted) or null.
export function recordAcceptedWord(word, { mode, band } = {}) {
  const w = norm(word);
  if (!w) return { isNew: false, count: countOf(), milestone: null };
  const data = loadCollection();
  data.seq += 1;
  const existing = data.w[w];
  if (existing) {
    existing[3] = data.seq; // refresh recency (LRU: most-recently-seen)
    save(data);
    return { isNew: false, count: Object.keys(data.w).length, milestone: null };
  }
  // New word. Evict LRU if at the cap.
  const keys = Object.keys(data.w);
  if (keys.length >= COLLECTION_CAP) {
    let lruWord = null;
    let lruSeq = Infinity;
    for (const k of keys) {
      const r = data.w[k][3];
      if (r < lruSeq) {
        lruSeq = r;
        lruWord = k;
      }
    }
    if (lruWord != null) delete data.w[lruWord];
  }
  data.w[w] = [bandIdx(band), modeIdx(mode), today(), data.seq];
  const count = Object.keys(data.w).length;
  // Milestone: the highest threshold now satisfied that hasn't been claimed. (Count only rises by 1
  // per new word, but guarding on "not yet claimed" is robust to an imported/edited save.)
  let milestone = null;
  for (const m of COLLECTION_MILESTONES) {
    if (count >= m.n && !data.ms.includes(m.n)) {
      data.ms.push(m.n);
      const granted = rebirthScaledWins(m.wins);
      grantWins(granted);
      milestone = { n: m.n, wins: granted };
      break; // one milestone per word (count rose by 1)
    }
  }
  save(data);
  return { isNew: true, count, milestone };
}

export function countOf() {
  return Object.keys(loadCollection().w).length;
}

// A summary for the Collection screen: total, per-tier counts, next milestone, and the rarest finds
// (RARE/OBSCURE words the player actually typed, newest first), each with tier/mode/date.
export function collectionSummary(rarestLimit = 40) {
  const data = loadCollection();
  const entries = Object.entries(data.w); // [word, [band, mode, day, recency]]
  const total = entries.length;
  const byTier = { COMMON: 0, UNCOMMON: 0, RARE: 0, OBSCURE: 0 };
  for (const [, e] of entries) byTier[TIERS[e[0]] || 'COMMON'] += 1;
  // Rarest finds: OBSCURE then RARE, most-recent first within a tier.
  const rarest = entries
    .filter((e) => e[1][0] >= 2) // RARE (2) or OBSCURE (3)
    .sort((a, b) => b[1][0] - a[1][0] || b[1][3] - a[1][3])
    .slice(0, rarestLimit)
    .map(([word, e]) => ({ word, tier: TIERS[e[0]], mode: COLLECTION_MODES[e[1]] || 'word-bomb', day: e[2] }));
  const nextMilestone = COLLECTION_MILESTONES.find((m) => total < m.n) || null;
  const claimed = data.ms.slice();
  return { total, byTier, rarest, nextMilestone, milestones: COLLECTION_MILESTONES, claimed, cap: COLLECTION_CAP };
}

// Test/dev hook: wipe the collection (and the session cache).
export function __resetCollectionForTest() {
  _cache = null;
  _cacheLS = null;
  save(fresh());
}
