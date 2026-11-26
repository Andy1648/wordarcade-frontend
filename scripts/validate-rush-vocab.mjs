// validate-rush-vocab.mjs — checks a LANGUAGE RUSH word file (src/data/<lang>Rush/words.json) against the
// shape French Rush uses and the bands the run builder needs. Usage: node scripts/validate-rush-vocab.mjs es
// (es | it | la | zh | fr). Exit 1 + a list of problems when anything is off.
import { readFileSync } from 'node:fs';

const LANGS = {
  fr: { dir: 'frenchRush', word: /^[a-zàâäçéèêëîïôöùûüÿœæ]{3,14}$/, genders: ['m', 'f', 'mf'], cats: ['familles', 'identites', 'esthetique', 'sciences', 'vie', 'defis', 'connecteurs', 'examen'] },
  es: { dir: 'spanishRush', word: /^[a-záéíóúüñ]{3,14}$/, genders: ['m', 'f', 'mf'], cats: ['familias', 'identidades', 'estetica', 'ciencia', 'vida', 'desafios', 'conectores', 'examen'] },
  it: { dir: 'italianRush', word: /^[a-zàèéìíòóùú]{3,14}$/, genders: ['m', 'f', 'mf'], cats: ['famiglie', 'identita', 'estetica', 'scienza', 'vita', 'sfide', 'connettivi', 'esame'] },
  la: { dir: 'latinRush', word: /^[a-zāēīōūȳ]{3,14}$/, genders: ['m', 'f', 'n', 'mf'], cats: ['bellum', 'res', 'di', 'natura', 'animus', 'homines', 'parva', 'poesis'] },
  zh: { dir: 'chineseRush', word: /^[a-z]{3,14}$/, genders: [], cats: ['jiating', 'shenfen', 'meixue', 'keji', 'shenghuo', 'tiaozhan', 'lianci', 'kaoshi'] },
};

const lang = process.argv[2];
const L = LANGS[lang];
if (!L) {
  console.error('usage: node scripts/validate-rush-vocab.mjs es|it|la|zh|fr');
  process.exit(2);
}
const file = new URL(`../src/data/${L.dir}/words.json`, import.meta.url);
const W = JSON.parse(readFileSync(file, 'utf8'));
const bad = [];
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe');
const seenW = new Map();
const seenFold = new Map();
const seenG = new Map();
const POS = ['n', 'v', 'adj', 'adv', 'conj', 'prep'];
for (const r of W) {
  const id = r.word;
  if (!L.word.test(r.word || '')) bad.push(`${id}: word must match ${L.word}`);
  if (seenW.has(r.word)) bad.push(`${id}: duplicate word`);
  seenW.set(r.word, 1);
  const f = fold(r.word);
  if (seenFold.has(f)) bad.push(`${id}: same letters (without accents) as ${seenFold.get(f)}`);
  seenFold.set(f, r.word);
  if (!POS.includes(r.pos)) bad.push(`${id}: pos ${r.pos}`);
  if (lang !== 'zh' && r.pos === 'n' && !L.genders.includes(r.gender)) bad.push(`${id}: noun gender ${r.gender}`);
  if ((lang === 'zh' || r.pos !== 'n') && r.gender != null) bad.push(`${id}: gender must be null`);
  if (typeof r.context !== 'string' || r.context.split('___').length !== 2) bad.push(`${id}: context needs exactly one ___`);
  if (!r.gloss || !r.contextEn) bad.push(`${id}: gloss + contextEn required`);
  const g = String(r.gloss || '').toLowerCase().trim();
  if (seenG.has(g)) bad.push(`${id}: gloss "${r.gloss}" also used by ${seenG.get(g)}`);
  seenG.set(g, r.word);
  if (!L.cats.includes(r.category)) bad.push(`${id}: category ${r.category}`);
  if (![1, 2, 3, 4, 5].includes(r.tier)) bad.push(`${id}: tier`);
  if (![1, 2, 3].includes(r.ap)) bad.push(`${id}: ap`);
  if (r.freqRank != null && (!Number.isInteger(r.freqRank) || r.freqRank < 1)) bad.push(`${id}: freqRank (integer or null)`);
  if (typeof r.cognate !== 'boolean' || typeof r.guessable !== 'boolean') bad.push(`${id}: cognate/guessable booleans`);
  if (r.falseFriend && r.guessable) bad.push(`${id}: a false friend is never guessable`);
  if (!Array.isArray(r.alts)) bad.push(`${id}: alts array`);
  if (r.root != null) {
    if (typeof r.root !== 'object' || !r.root.morpheme || !r.root.meaning || !Array.isArray(r.root.cousins)) bad.push(`${id}: root shape`);
  }
  if (lang !== 'fr') {
    if (typeof r.display !== 'string' || !r.display) bad.push(`${id}: display required`);
    else if (lang !== 'zh' && !fold(r.display).includes(fold(r.word))) bad.push(`${id}: display "${r.display}" must contain the word`);
  }
  if (lang === 'zh') {
    if (!/^[㐀-鿿]+$/.test(r.hanzi || '')) bad.push(`${id}: hanzi`);
    if (!r.pinyin || /\d/.test(r.pinyin)) bad.push(`${id}: pinyin with tone marks (no digits)`);
    if (r.gloss !== `${r.hanzi} (${r.pinyin})`) bad.push(`${id}: gloss must be "hanzi (pinyin)"`);
    if (r.display !== r.hanzi) bad.push(`${id}: display must equal hanzi`);
    if (r.guessable || r.cognate) bad.push(`${id}: nothing is guessable in Chinese`);
  }
}
// the run builder's bands, per theme (with headroom over the unit test's 10 / 15)
const easy = (r) => r.ap === 1 && r.tier <= 2;
const std = (r) => r.ap <= 2 && r.tier <= 4;
const hard = (r) => r.tier >= 3;
const counts = {};
for (const c of L.cats) {
  const rows = W.filter((r) => r.category === c);
  const k = { total: rows.length, easy: rows.filter(easy).length, standard: rows.filter(std).length, hard: rows.filter(hard).length, study: rows.filter((r) => !r.guessable).length };
  counts[c] = k;
  for (const [band, n] of Object.entries(k)) {
    const min = band === 'total' ? 40 : band === 'study' ? 18 : 12;
    if (n < min) bad.push(`theme ${c}: only ${n} ${band} words (need ${min})`);
  }
}
console.table(counts);
const by = (k) => W.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});
console.log('total', W.length, 'tier', by('tier'), 'ap', by('ap'), 'pos', by('pos'));
if (bad.length) {
  console.log(`\n${bad.length} problem(s):`);
  for (const b of bad.slice(0, 200)) console.log(' -', b);
  process.exit(1);
}
console.log('OK');
