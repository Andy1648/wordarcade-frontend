// scripts/gen-daily-blitz.mjs — builds src/dailyBlitz/data.json from the backend's Category Blitz lists.
//
//   node scripts/gen-daily-blitz.mjs [path/to/chain-reaction-backend/blitzLists.json]
//
// DAILY BLITZ judges on the client against the SAME curated lists the server's Category Blitz uses
// (list-only, STEP 9), so this copies them — only the lists named in src/dailyBlitz/pool.js — keyed by the
// server's answerKey. It FAILS if a pool name is missing from the lists (the pool can't drift).
//
// Each answer also gets a PRIOR rarity (20..80 points): how familiar the answer's words are in
// words.recall.txt (the repo's frequency-ordered corpus, the same one that ranks word rarity for WINS),
// as a percentile WITHIN its category — so "Texas" is common among US states and "Wyoming" is rare. A
// multi-word name scores at least as rare as an uncommon word (its parts being common words doesn't make
// "Great Sand Dunes" a common answer). The prior is only the day-one guess: once the day's tallies exist,
// the crowd's "X% said this" takes over (engine.js scoreAnswer).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { answerKey } from '../src/dailyBlitz/answerKey.js';
import { DAILY_POOL } from '../src/dailyBlitz/pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const listsPath = process.argv[2] || path.resolve(root, '../../chain-reaction-backend/blitzLists.json');
const lists = JSON.parse(readFileSync(listsPath, 'utf8'));
const recall = readFileSync(path.join(root, 'src/solo/words.recall.txt'), 'utf8').split(/\s+/).filter(Boolean);
const rank = new Map();
recall.forEach((w, i) => { if (!rank.has(w)) rank.set(w, i); });

// Spellings the generator can't tell from a typo on its own (neither is in any word list).
const PREFER = new Set(['charmander', 'fukushima', 'hiroshima', 'nagasaki', 'brussels', 'mauritius', 'bangladesh',
  'copenhagen', 'alakazam', 'montpelier', 'pennsylvania', 'reykjavik', 'tallinn', 'ljubljana', 'pristina', 'lisbon',
  'arcanine', 'blastoise', 'chikorita', 'cyndaquil', 'fennekin', 'mudkip', 'oshawott', 'popplio', 'heimdall',
  'dionysus', 'hephaestus', 'athena', 'apollo', 'baldur', 'cronus', 'iapetus', 'phoebe', 'terrence', 'elliott',
  'abigail', 'dhalsim', 'reinhardt', 'nihilanth', 'losail', 'arrietty', 'dolleymadison', 'jackieo', 'machupicchu',
  'yosemite', 'licencetokill', 'aviewtoakill', 'bowsersshell', 'yoshisegg', 'stonyshore', 'khajiit',
  'axolotl', 'tbilisi', 'clefairy', 'geodude', 'gyarados', 'jigglypuff', 'psyduck', 'rattata', 'squirtle',
  'venusaur', 'vulpix', 'magikarp', 'totodile', 'treecko', 'hawaiivolcanoes', 'cypher', 'septimiusseverus', 'colombia', 'brazil', 'mexico', 'lebanon', 'palestine', 'ratatouille', 'monstersinc', 'gefjon',
  'synchronizedswimming', 'esophagus', 'cheyenne', 'annapolis', 'tallahassee', 'connecticut', 'massachusetts',
  'mississippi', 'tennessee', 'kazakhstan', 'tajikistan', 'philippines', 'maldives', 'vietnam', 'bahrain',
  'azerbaijan', 'djibouti', 'eritrea', 'lesotho', 'mozambique', 'seychelles', 'equatorialguinea', 'bulbasaur',
  'charizard', 'wigglytuff', 'bucharest', 'hokkaido', 'fukuoka']);
// Distinct answers one letter apart (not typos of each other).
const DISTINCT = [['georgewbush', 'georgehwbush'], ['hwbush', 'gwbush'], ['nidorino', 'nidorina'], ['zombine', 'zombie']];
const KNOWN = new Set(['words.accept.txt', 'words.accept-ext.txt', 'words.common.txt', 'words.famous.txt']
  .flatMap((f) => readFileSync(path.join(root, 'src/solo', f), 'utf8').split(/\s+/)).filter(Boolean));
const AMBIG = [];

const STOP = new Set(['the', 'of', 'and', 'a', 'an', 'de', 'la', 'le', 'du', 'des', 'el', 'von', 'van']);
const MULTI_FLOOR = 6000; // a multi-word name is at least "uncommon"
const PRIOR_MIN = 20;
const PRIOR_SPAN = 60;

function familiarity(answer) {
  const words = answer.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));
  if (!words.length) return Infinity;
  const r = Math.max(...words.map((w) => (rank.has(w) ? rank.get(w) : Infinity)));
  return words.length > 1 ? Math.max(r, MULTI_FLOOR) : r;
}

function titleCase(s) {
  return s.replace(/(^|[\s\-(/])([a-z])/g, (m, a, b) => a + b.toUpperCase());
}

function dist1(a, b) {
  if (a === b) return false;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

// key -> its canonical key. Plurals fold to the singular; a 6+ letter key one edit from another folds to
// the better-known spelling (in the corpus, else the longer one — typos usually drop a letter).
function canonicalize(keys, good) {
  const set = new Set(keys);
  const out = new Map(keys.map((k) => [k, k]));
  const better = (a, b) => {
    for (const ok of [(k) => PREFER.has(k), (k) => rank.has(k) || KNOWN.has(k), (k) => good.has(k)]) {
      if (ok(a) !== ok(b)) return ok(a) ? a : b;
    }
    AMBIG.push(`${a}/${b}`);
    if (a.length !== b.length) return a.length < b.length ? a : b;
    return a < b ? a : b;
  };
  const distinct = (a, b) => /\d/.test(a + b) || a[0] !== b[0] || DISTINCT.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  for (const k of keys) {
    if (PREFER.has(k)) continue;
    if (k.endsWith('es') && set.has(k.slice(0, -2))) out.set(k, k.slice(0, -2));
    else if (k.endsWith('s') && set.has(k.slice(0, -1))) out.set(k, k.slice(0, -1));
  }
  const sorted = keys.filter((k) => out.get(k) === k && k.length >= 6).sort();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (out.get(a) !== a || out.get(b) !== b || !dist1(a, b) || distinct(a, b)) continue;
      const w = better(a, b);
      out.set(w === a ? b : a, w);
    }
  }
  // resolve chains (a -> b -> c)
  for (const k of keys) {
    let c = out.get(k);
    while (out.get(c) !== c) c = out.get(c);
    out.set(k, c);
  }
  return out;
}

const byName = new Map(lists.map((c) => [c.name, c]));
const cats = {};
for (const [tier, names] of Object.entries(DAILY_POOL)) {
  for (const name of names) {
    const c = byName.get(name);
    if (!c) throw new Error(`pool.js names "${name}" but it is not in ${listsPath}`);
    const seen = new Map(); // key -> display (first spelling wins)
    for (const a of c.answers) {
      const k = answerKey(a);
      if (k && !seen.has(k)) seen.set(k, titleCase(a));
    }
    // VARIANTS of one answer (a plural, a one-letter typo the list accepts: "Zoglins", "Yosemity") are
    // still accepted, but tally under ONE canonical key so the crowd's % isn't split between spellings.
    const canon = canonicalize([...seen.keys()], new Set((c.good || []).map(answerKey)));
    const rows = [...seen].filter(([k]) => canon.get(k) === k).map(([k, d]) => ({ k, d, f: familiarity(d) }));
    rows.sort((a, b) => a.f - b.f || (a.k < b.k ? -1 : 1));
    // percentile within the category, ties share their group's average
    const n = rows.length;
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && rows[j + 1].f === rows[i].f) j++;
      const p = n > 1 ? (i + j) / 2 / (n - 1) : 0.5;
      for (let t = i; t <= j; t++) rows[t].p = Math.round(PRIOR_MIN + PRIOR_SPAN * p);
      i = j + 1;
    }
    rows.sort((a, b) => (a.k < b.k ? -1 : 1));
    const alias = {};
    for (const [k, c2] of canon) if (k !== c2) alias[k] = c2;
    cats[name] = { tier, pack: c.pack, a: rows.map((r) => [r.k, r.d, r.p]), alias };
  }
}

if (AMBIG.length) console.log(`tie-broken by length (add to PREFER if wrong): ${AMBIG.join(' ')}`);
const out = { v: 1, source: 'chain-reaction-backend/blitzLists.json', cats };
const dest = path.join(root, 'src/dailyBlitz/data.json');
writeFileSync(dest, JSON.stringify(out) + '\n');
console.log(`wrote ${dest}: ${Object.keys(cats).length} categories, ${Object.values(cats).reduce((s, c) => s + c.a.length, 0)} answers`);
