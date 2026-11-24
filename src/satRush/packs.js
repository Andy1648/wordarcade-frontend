// packs.js — the WORD PACKS a Rush run can be built from.
//
// A pack is data, not a fork: its word rows ({word,pos,tier,gloss,context,root,alts,costMs}, plus an
// optional `category` for packs that group words by topic) and the few labels the poster prints. The
// engine, the run builder (runSpec.js) and the screens read a pack; nothing in them names "SAT". A
// special edition (FRENCH RUSH: AP French vocab with categories like la famille) is one more entry
// here plus its words file — the same RunSpec { pack, mode, difficulty, length } drives it.
//
// Pure module: no React, no DOM, no storage — and no JSON import, so node:test can load it. The word
// rows are attached by packWords.js (bundled by Vite) under the same ids.
import { RUSH_LANGS, LANGUAGE_PACK_IDS } from './rushLang.js';

export const PACKS = {
  sat: {
    id: 'sat',
    title: 'SAT RUSH',
    lang: 'en',
    words: [], // filled by packWords.js
    tierMax: 5,
    // the case id's part of speech (full on wide screens, the dictionary short form on phones)
    posLabels: { adj: 'adjective', n: 'noun', v: 'verb', adv: 'adverb' },
    posShort: { adj: 'adj.', n: 'noun', v: 'verb', adv: 'adv.' },
    // topic groups a pack may offer (FRENCH RUSH: famille, maison, ...); SAT has none
    categories: [],
    // per-pack learning memory (lexicon.js) + recently-served list (recentWords.js)
    storageKey: 'wa_satrush_lexicon',
    recentKey: 'wa_satrush_recent',
    // the order clues print: SAT leads with the SENTENCE (the vocab is used in context);
    // a pack can lead with the MEANING instead (meaningFirst)
    meaningFirst: false,
    // fold accents when typing (é accepts e) — SAT's corpus is a-z, so off
    accentFold: false,
    // the poster's words
    ui: {
      wanted: 'WANTED',
      mostWanted: 'MOST WANTED',
      fields: { sentence: 'Last seen', gloss: 'Description', root: 'Known aliases', rootShort: 'aliases' },
    },
  },

  // FRENCH RUSH (oct18) — AP French Language & Culture vocab, built for students who are STRUGGLING:
  // the English MEANING prints first ("type the French for this"), the French example sentence is the
  // second clue, every example has an English translation on the study / review screens, accents are
  // forgiving to type (e → é; the slot still shows the real accent, so the spelling is learned), and
  // nouns show their gender. Words are grouped by the six AP themes + the essay connectors.
  fr: {
    id: 'fr',
    title: 'FRENCH RUSH',
    lang: 'fr',
    words: [], // filled by the French Rush entry (its own lazy chunk)
    tierMax: 5,
    posLabels: { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', conj: 'connector', prep: 'preposition', expr: 'expression' },
    posShort: { n: 'noun', v: 'verb', adj: 'adj.', adv: 'adv.', conj: 'conn.', prep: 'prep.', expr: 'expr.' },
    categories: [
      { id: 'familles', label: 'Families & communities' },
      { id: 'identites', label: 'Personal & public identities' },
      { id: 'esthetique', label: 'Beauty & aesthetics' },
      { id: 'sciences', label: 'Science & technology' },
      { id: 'vie', label: 'Contemporary life' },
      { id: 'defis', label: 'Global challenges' },
      { id: 'connecteurs', label: 'Essay connectors' },
      { id: 'examen', label: 'Exam & email words' },
    ],
    storageKey: 'wa_frenchrush_lexicon',
    recentKey: 'wa_frenchrush_recent',
    // nov24 (Andy: "give more answer choices" / silver tongue "remove for now as it's education setting"):
    // 8 suspects in QUIZ (8 → 5 → 2), 6 choices in STUDY FIRST, and no SILVER TONGUE. Every LANGUAGE pack
    // (languagePack below) inherits these; SAT keeps its 6 / 4 and its silver.
    lineupSize: 8,
    briefingChoices: 6,
    silverTongue: false,
    meaningFirst: true,
    accentFold: true,
    // TIMED by default (nov21, Andy: defaults TIMED + 20 words); NO TIMER is one tap away (HINT for the next
    // clue, CONTINUE after every word). The TIMED pace is slow — a stage is 7s (×1.4 with choices) and the
    // letters print every 1.8s
    defaultPace: 'timed',
    // STUDY FIRST deals only words an English speaker could not guess (`guessable: false`)
    studyNonGuessable: true,
    timing: { stageMs: 7000, lineupScale: 1.4, spellMs: 1800 },
    // the word family is a study aid, shown on the review card — not one more line mid-word
    playRoot: false,
    // plain words, no bounty-poster theme (Andy oct19: "the 'recherche' is SO STUPID")
    ui: {
      wanted: null, // no banner — the masthead is the theme + part of speech
      mostWanted: null,
      fields: { sentence: 'En français', gloss: 'Meaning', root: 'Word family', rootShort: 'family' },
      hud: { heat: false },
      reward: { caption: false },
      stamps: { got: 'BRAVO !', miss: 'RATÉ', streak: 'SÉRIE ×' },
      // the review card is LEAN (WordCard ReEncode): the verdict, the word, its meaning, CONTINUE
      review: { got: 'BRAVO !', weak: 'GOT IT — WITH HINTS', miss: 'MISSED', lean: true },
      lineup: { label: 'Choices', standing: 'left', cleared: 'NON' },
      // nov21 (Andy: "REMOVE THE BS … directions are too AI slop"): titles, choices and buttons only — no
      // pitch lines, no sub-heads, no counts.
      modeHead: 'PRACTICE',
      modes: {
        briefing: { title: 'STUDY FIRST', line: '' },
        lineup: { title: 'QUIZ', line: '' },
      },
      setupSub: 'set up your practice', // a flag for CASE SETUP's French Rush layout (never printed)
      compactSetup: true,
      pace: 'timed', // CASE SETUP offers a timer row, preselected to TIMED
      defaultLength: { lineup: 20, briefing: 10 }, // briefing tops out at 15 (LENGTHS.briefing)
      briefingTitle: 'STUDY',
      startLabel: 'Start',
      results: {
        done: 'TERMINÉ !',
        out: 'OUT OF LIVES',
        captured: 'correct',
        away: 'missed',
        file: 'your words',
        outcomes: { clean: 'GOT IT', recaptured: '2ND TRY', shaky: 'WITH HINTS', escaped: 'MISSED' },
        again: 'Practice again',
        replay: (n) => `Practice the ${n} I missed`,
        menu: 'French Rush home',
      },
    },
  },
};

// LANGUAGE RUSH (nov24): Spanish, Italian, Latin and Chinese are FRENCH RUSH with their own words, themes,
// storage and a few labels in that language (rushLang.js). Everything else — the slow TIMED pace, the
// study deck, the lean review card, the results — is the French pack's, so they behave the same.
function languagePack(lang) {
  const fr = PACKS.fr;
  const L = RUSH_LANGS[lang];
  const name = L.name;
  return {
    ...fr,
    id: L.pack,
    title: L.title,
    lang,
    words: [], // filled by that language's root (its own lazy chunk)
    categories: L.categories,
    storageKey: `wa_${name.toLowerCase()}rush_lexicon`,
    recentKey: `wa_${name.toLowerCase()}rush_recent`,
    timing: { ...fr.timing },
    ui: {
      ...fr.ui,
      fields: { ...fr.ui.fields, sentence: L.sentence, ...(L.glossLabel ? { gloss: L.glossLabel } : null) },
      stamps: { ...L.stamps },
      review: { ...fr.ui.review, got: L.stamps.got },
      lineup: { ...fr.ui.lineup, cleared: L.cleared },
      results: { ...fr.ui.results, done: L.press.over[0], menu: `${name} Rush home` },
    },
  };
}
for (const id of ['es', 'it', 'la', 'zh']) PACKS[id] = languagePack(id);

/** Is this pack one of the LANGUAGE RUSH packs (French and its siblings)? */
export function isLanguagePack(id) {
  return LANGUAGE_PACK_IDS.has(id);
}

/** "noun (f.)" — the case id's part of speech, with a noun's gender when the row has one. */
export function posLabelOf(pack, row, short = false) {
  const labels = (short ? pack.posShort : pack.posLabels) || {};
  const base = labels[row.pos] || row.pos;
  // (Latin nouns can be neuter: "noun (n.)")
  if (row.pos === 'n' && (row.gender === 'm' || row.gender === 'f' || row.gender === 'n')) return `${base} (${row.gender}.)`;
  return base;
}

export const DEFAULT_PACK = 'sat';

/** The pack for an id; an unknown id falls back to the default pack (never throws). */
export function getPack(id) {
  return PACKS[id] || PACKS[DEFAULT_PACK];
}

// Pure: the word family as the POSTER may print it mid-word. A family whose head IS the answer
// (FRENCH RUSH: école → "école — school · écolier · scolaire") or that lists the answer as a cousin
// would print the word being asked for; drop those parts (accent-insensitive). Nothing left → null.
// The study screens (briefing, re-encode, case file) still show the whole family.
export function playRoot(root, word) {
  if (!root) return null;
  const fold = (x) => String(x || '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const w = fold(word);
  const morpheme = fold(root.morpheme).replace(/-$/, '') === w ? null : root.morpheme;
  const cousins = (Array.isArray(root.cousins) ? root.cousins : []).filter((c) => fold(c) !== w);
  if (!morpheme && !cousins.length) return null;
  return { ...root, morpheme, cousins };
}
