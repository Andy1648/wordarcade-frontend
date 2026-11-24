// rushLang.js — LANGUAGE RUSH: one config per AP world language, so French Rush is a LANGUAGE-parameterised
// mode instead of five forks (nov24, Andy: "the same mode for the other AP world languages").
//
// French is the original and its values here are exactly what French Rush printed before the split; the
// other languages reuse every screen, the engine, the class room and the study flow, and differ only in:
//   - the word file (src/data/<name>Rush/words.json, its own lazy chunk) and the pack's themes
//   - how a word is written on the board: French builds "la famille" (speak.js withArticle); the others
//     carry a `display` per row ("el agua", "lo studente", "amō, amāre, amāvī, amātum")
//   - the 🔊 voice (a BCP-47 tag + preferred regions; Latin has none, so it has no 🔊)
//   - the press headlines, stamps and labels in that language, and one accent colour
//   - CHINESE flips the direction: the card shows 汉字 + pinyin and the student types the ENGLISH; the 🔊
//     reads the characters (the `say` map below), never the English answer
//
// Accents are optional to type in every language (input.js foldLetter: e fills é, n fills ñ, a fills ā).
//
// One language per page load (each has its own link and lazy chunk), so the current language is a module
// singleton set by that language's root before the first render — the same pattern as juice.setShakeTarget.
// Pure: no React, no DOM, no storage.

const PRESS = (start, mode, setup, briefing, playing, over, bank) => ({
  start: [start, 'home', 'back'],
  mode: [mode, 'your turn'],
  setup: [setup, 'set it up'],
  briefing: [briefing, 'study'],
  playing: [playing, 'here we go'],
  over: [over, 'done'],
  bank: [bank, 'word bank'],
  class: null, // ClassFlow presses its own
});

// the six AP World Language themes (the same for French, Spanish, Italian and Chinese) + connectors + exam words
const apThemes = (ids) => {
  const labels = ['Families & communities', 'Personal & public identities', 'Beauty & aesthetics', 'Science & technology', 'Contemporary life', 'Global challenges', 'Essay connectors', 'Exam & email words'];
  return ids.map((id, i) => ({ id, label: labels[i] }));
};

export const RUSH_LANGS = {
  fr: {
    id: 'fr',
    pack: 'fr',
    // the class room's own press sheets (ClassRoom.jsx; French = what it always printed)
    classPress: { bye: 'AU REVOIR', newSet: 'NOUVEAU', open: 'OUVERT !', done: 'BRAVO !', go: "C'EST PARTI !", word: (n) => `MOT ${n}`, wait: 'EN ATTENTE', welcome: 'BIENVENUE', teacher: 'LE PROF', join: 'REJOINS', room: 'EN CLASSE' },
    slug: 'french-rush',
    name: 'French',
    native: 'Français',
    title: 'FRENCH RUSH',
    docTitle: 'French Rush — AP French vocab | Type A Word',
    htmlLang: 'fr',
    locale: 'fr',
    voice: { prefix: /^fr([-_]|$)/i, prefer: ['fr-FR'], tag: 'fr-FR' },
    accent: null, // the original: ink on paper, nothing else
    press: PRESS('FRENCH RUSH', 'À TOI !', 'RÉGLAGES', 'ÉTUDIE', "C'EST PARTI !", 'TERMINÉ !', 'LES MOTS'),
    useDisplay: false, // speak.js withArticle builds the board form
    englishToggle: 'in English',
    unlisted: 'french',
  },
  es: {
    id: 'es',
    pack: 'es',
    classPress: { bye: 'ADIÓS', newSet: 'NUEVO', open: '¡ABIERTO!', done: '¡HECHO!', go: '¡VAMOS!', word: (n) => `PALABRA ${n}`, wait: 'EN ESPERA', welcome: '¡HOLA!', teacher: 'EL PROFE', join: 'ÚNETE', room: 'EN CLASE' },
    slug: 'spanish-rush',
    name: 'Spanish',
    native: 'Español',
    title: 'SPANISH RUSH',
    docTitle: 'Spanish Rush — AP Spanish vocab | Type A Word',
    htmlLang: 'es',
    locale: 'es',
    voice: { prefix: /^es([-_]|$)/i, prefer: ['es-MX', 'es-US', 'es-ES'], tag: 'es-MX' },
    accent: { ink: '#D08A00', on: '#111' }, // saffron
    press: PRESS('SPANISH RUSH', '¡TE TOCA!', 'AJUSTES', 'ESTUDIA', '¡VAMOS!', '¡TERMINADO!', 'LAS PALABRAS'),
    stamps: { got: '¡BIEN!', miss: 'FALLO', streak: 'RACHA ×' },
    cleared: 'NO', // a ruled-out choice's stamp (French: NON)
    sentence: 'En español',
    categories: apThemes(['familias', 'identidades', 'estetica', 'ciencia', 'vida', 'desafios', 'conectores', 'examen']),
    useDisplay: true,
    englishToggle: 'in English',
    unlisted: 'spanish',
  },
  it: {
    id: 'it',
    pack: 'it',
    classPress: { bye: 'ARRIVEDERCI', newSet: 'NUOVO', open: 'APERTO!', done: 'BRAVI!', go: 'ANDIAMO!', word: (n) => `PAROLA ${n}`, wait: 'IN ATTESA', welcome: 'CIAO!', teacher: 'IL PROF', join: 'ENTRA', room: 'IN CLASSE' },
    slug: 'italian-rush',
    name: 'Italian',
    native: 'Italiano',
    title: 'ITALIAN RUSH',
    docTitle: 'Italian Rush — AP Italian vocab | Type A Word',
    htmlLang: 'it',
    locale: 'it',
    voice: { prefix: /^it([-_]|$)/i, prefer: ['it-IT'], tag: 'it-IT' },
    accent: { ink: '#1F7A45', on: '#f0ead9' }, // basil
    press: PRESS('ITALIAN RUSH', 'TOCCA A TE!', 'IMPOSTAZIONI', 'STUDIA', 'ANDIAMO!', 'FINITO!', 'LE PAROLE'),
    stamps: { got: 'BRAVO!', miss: 'ERRORE', streak: 'SERIE ×' },
    cleared: 'NO',
    sentence: 'In italiano',
    categories: apThemes(['famiglie', 'identita', 'estetica', 'scienza', 'vita', 'sfide', 'connettivi', 'esame']),
    useDisplay: true,
    englishToggle: 'in English',
    unlisted: 'italian',
  },
  la: {
    id: 'la',
    pack: 'la',
    classPress: { bye: 'VALĒTE', newSet: 'NOVUM', open: 'APERTUM!', done: 'OPTIMĒ!', go: 'INCIPE!', word: (n) => `VERBUM ${n}`, wait: 'EXSPECTĀ', welcome: 'SALVĒ!', teacher: 'MAGISTER', join: 'INTRĀ', room: 'IN SCHOLĀ' },
    slug: 'latin-rush',
    name: 'Latin',
    native: 'Latīna',
    title: 'LATIN RUSH',
    docTitle: 'Latin Rush — AP Latin vocab (Caesar + Vergil) | Type A Word',
    htmlLang: 'la',
    locale: 'la',
    voice: null, // no browser ships a Latin voice; a modern-Italian reading would teach the wrong sounds
    accent: { ink: '#6B2D8C', on: '#f0ead9' }, // Tyrian purple
    press: PRESS('LATIN RUSH', 'AGE!', 'PARĀ', 'DISCE', 'INCIPE!', 'FĪNIS', 'VERBA'),
    stamps: { got: 'OPTIMĒ!', miss: 'ERRĀSTĪ', streak: 'SERIĒS ×' },
    cleared: 'NŌN',
    sentence: 'Latīnē',
    // AP Latin is Caesar + Vergil, not the six AP themes: the reading's own word groups
    categories: [
      { id: 'bellum', label: 'War & the army' },
      { id: 'res', label: 'Rome, power & politics' },
      { id: 'di', label: 'Gods, fate & duty' },
      { id: 'natura', label: 'Sea, sky & land' },
      { id: 'animus', label: 'Body, mind & feeling' },
      { id: 'homines', label: 'People & family' },
      { id: 'parva', label: 'Little words' },
      { id: 'poesis', label: "Vergil's words" },
    ],
    useDisplay: true,
    englishToggle: 'in English',
    unlisted: 'latin',
  },
  zh: {
    id: 'zh',
    pack: 'zh',
    classPress: { bye: '再见', newSet: '新一组', open: '开课了！', done: '太棒了！', go: '开始！', word: (n) => `第${n}个词`, wait: '请稍等', welcome: '欢迎！', teacher: '老师', join: '加入', room: '教室' },
    slug: 'chinese-rush',
    name: 'Chinese',
    native: '中文',
    title: 'CHINESE RUSH',
    docTitle: 'Chinese Rush — AP Chinese vocab | Type A Word',
    htmlLang: 'en', // the typed answer is English; the characters carry their own lang="zh"
    locale: 'en',
    // Mandarin only: a Cantonese (zh-HK / yue) voice reads the same characters with different sounds
    voice: { prefix: /^(zh|cmn)([-_]|$)/i, exclude: /hk|yue|cantonese/i, prefer: ['zh-CN', 'cmn-CN', 'zh-TW'], tag: 'zh-CN' },
    accent: { ink: '#00796B', on: '#f0ead9' }, // jade
    press: PRESS('CHINESE RUSH', '轮到你了！', '设置', '学习', '开始！', '完成！', '词汇'),
    stamps: { got: '太棒了！', miss: '错了', streak: '连胜 ×' },
    cleared: 'NO', // the choices are English words
    sentence: 'In English',
    glossLabel: '中文',
    categories: apThemes(['jiating', 'shenfen', 'meixue', 'keji', 'shenghuo', 'tiaozhan', 'lianci', 'kaoshi']),
    useDisplay: false, // the big word on a card is the English answer; the characters are its clue
    englishToggle: 'in Chinese',
    unlisted: 'chinese',
    flipped: true, // the clue is the language, the answer is English
  },
};

export const RUSH_LANG_ORDER = ['fr', 'es', 'it', 'la', 'zh'];
export const LANGUAGE_PACK_IDS = new Set(RUSH_LANG_ORDER.map((id) => RUSH_LANGS[id].pack));

/** The language a path names (/spanish-rush → es), or null. */
export function langFromPath(path) {
  const m = /^\/([a-z]+-rush)\/?$/i.exec(String(path || ''));
  if (!m) return null;
  const slug = m[1].toLowerCase();
  return RUSH_LANG_ORDER.find((id) => RUSH_LANGS[id].slug === slug) || null;
}

let current = RUSH_LANGS.fr;
let display = new Map(); // word → how the board writes it (languages with useDisplay)
let say = new Map(); // word → what the 🔊 reads (Chinese: the characters)

/** Mount a language (its root calls this once, before the first render). */
export function setRushLang(id, words = []) {
  current = RUSH_LANGS[id] || RUSH_LANGS.fr;
  display = new Map();
  say = new Map();
  for (const r of words || []) {
    if (!r || !r.word) continue;
    if (current.useDisplay && r.display) display.set(r.word, r.display);
    if (r.hanzi) say.set(r.word, r.hanzi);
  }
  return current;
}

/** The language this page plays. */
export function rushLang() {
  return current;
}

/** How the board writes `word` in a language that carries a display form (null = build it / use the word). */
export function displayOf(word) {
  return display.get(word) || null;
}

/** What the 🔊 should read for `word` (Chinese reads the characters of an English answer). */
export function sayTextOf(word) {
  return say.get(word) || word;
}
