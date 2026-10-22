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
    meaningFirst: true,
    accentFold: true,
    // the run is the student's: no clock by default (HINT for the next clue, CONTINUE after every word);
    // the TIMED pace is slow — a stage is 7s (×1.4 with choices) and the letters print every 1.8s
    defaultPace: 'self',
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
      review: { got: 'BRAVO !', weak: 'GOT IT — WITH HINTS', miss: 'THE ANSWER' },
      lineup: { label: 'Choices', standing: 'left', cleared: 'NON' },
      modeHead: 'HOW DO YOU WANT TO PRACTICE?',
      modes: {
        briefing: { title: 'STUDY FIRST', line: "learn the words you can't guess from English" },
        lineup: { title: 'QUIZ', line: 'every word — a few choices help you' },
      },
      setupSub: 'set up your practice',
      pace: 'self', // CASE SETUP offers a pace row, preselected to no timer
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

/** "noun (f.)" — the case id's part of speech, with a noun's gender when the row has one. */
export function posLabelOf(pack, row, short = false) {
  const labels = (short ? pack.posShort : pack.posLabels) || {};
  const base = labels[row.pos] || row.pos;
  if (row.pos === 'n' && (row.gender === 'm' || row.gender === 'f')) return `${base} (${row.gender}.)`;
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
