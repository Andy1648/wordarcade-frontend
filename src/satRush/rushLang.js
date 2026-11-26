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

export const RUSH_LANGS = {
  fr: {
    id: 'fr',
    pack: 'fr',
    // TEAM RACE + the solo BEST lane (nov26): team names (red / blue / green / yellow ink) and the race's words
    race: { names: ['ROUGE', 'BLEU', 'VERT', 'JAUNE'], win: (t) => `${t} GAGNE !`, tie: 'ÉGALITÉ !', yours: 'ton équipe', chain: 'chaîne', record: 'record', you: 'toi', ahead: 'DEVANT TON RECORD !', newBest: 'NOUVEAU RECORD !' },
    // the menus in the language (nov24 round 2, Andy: "STUDY" should simply be ÉTUDIER / ESTUDIAR / …)
    menu: {
      play: 'Jouer', create: 'Créer une salle', join: 'Rejoindre', bank: 'Les mots', language: 'langue', hello: 'Bonjour !',
      practice: 'ENTRAÎNEMENT', studyFirst: 'ÉTUDIER', quiz: 'QUIZ', exit: 'SORTIR',
      difficulty: 'niveau', theme: 'thème', timer: 'chrono', timed: 'CHRONO', noTimer: 'SANS CHRONO', words: 'mots',
      skipStudied: 'sauter les mots vus', start: 'Commencer', study: 'Étudier', back: 'RETOUR', copyLink: 'COPIER LE LIEN', copied: 'COPIÉ',
      allThemes: 'Tous les thèmes', levels: { easy: 'FACILE', standard: 'MOYEN', hard: 'DIFFICILE' },
      studyTitle: 'ÉTUDIER', startRun: 'Commencer', studyLine: (n) => `${n} mots à connaître`, replayLine: 'Les mots ratés — à revoir',
      bankTitle: 'LES MOTS', bankLine: (n, k) => `${n} mots · tu en connais ${k}`, show: 'afficher', search: 'chercher', searchHint: 'français ou anglais',
      filters: { all: 'Tous les mots', todo: 'À apprendre', known: 'Connus', studied: 'Étudiés', unstudied: 'Pas encore étudiés', study: 'Pas devinables', false: 'Faux amis' },
      status: { known: 'connu', learning: 'en cours', new: 'nouveau' }, studiedTag: 'étudié', falseTag: 'faux ami', none: 'Aucun mot.',
      results: { out: 'PLUS DE VIES', of: (n) => `sur ${n} justes`, away: 'ratés', file: 'tes mots', outcomes: { clean: 'ACQUIS', recaptured: '2E ESSAI', shaky: 'AVEC INDICES', escaped: 'RATÉ' }, again: 'Rejouer', replay: (n) => `Revoir les ${n} ratés`, menu: 'Accueil', copy: 'Copier mes résultats', classAgain: 'Retour en classe', classLeave: 'Quitter la classe' },
      review: { weak: 'AVEC INDICES', miss: 'RATÉ' },
    },
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
    accent: { ink: '#2349A4', on: '#f0ead9' }, // bleu (nov24 round 2: every language wears its own ink, French too)
    press: PRESS('FRENCH RUSH', 'À TOI !', 'RÉGLAGES', 'ÉTUDIE', "C'EST PARTI !", 'TERMINÉ !', 'LES MOTS'),
    categories: [{ id: 'familles', label: 'Familles & communautés' }, { id: 'identites', label: 'Identités' }, { id: 'esthetique', label: 'Beauté & esthétique' }, { id: 'sciences', label: 'Sciences & technologie' }, { id: 'vie', label: 'Vie contemporaine' }, { id: 'defis', label: 'Défis mondiaux' }, { id: 'connecteurs', label: 'Connecteurs' }, { id: 'examen', label: 'Examen & courriel' }],
    useDisplay: false, // speak.js withArticle builds the board form
    englishToggle: 'in English',
    unlisted: 'french',
  },
  es: {
    id: 'es',
    pack: 'es',
    // TEAM RACE + the solo BEST lane (nov26): team names (red / blue / green / yellow ink) and the race's words
    race: { names: ['ROJO', 'AZUL', 'VERDE', 'AMARILLO'], win: (t) => `¡GANA ${t}!`, tie: '¡EMPATE!', yours: 'tu equipo', chain: 'cadena', record: 'récord', you: 'tú', ahead: '¡SUPERAS TU RÉCORD!', newBest: '¡NUEVO RÉCORD!' },
    // the menus in the language (nov24 round 2, Andy: "STUDY" should simply be ÉTUDIER / ESTUDIAR / …)
    menu: {
      play: 'Jugar', create: 'Crear sala', join: 'Unirse', bank: 'Palabras', language: 'idioma', hello: '¡Hola!',
      practice: 'PRÁCTICA', studyFirst: 'ESTUDIAR', quiz: 'PRUEBA', exit: 'SALIR',
      difficulty: 'nivel', theme: 'tema', timer: 'tiempo', timed: 'CON TIEMPO', noTimer: 'SIN TIEMPO', words: 'palabras',
      skipStudied: 'omitir las estudiadas', start: 'Empezar', study: 'Estudiar', back: 'VOLVER', copyLink: 'COPIAR ENLACE', copied: 'COPIADO',
      allThemes: 'Todos los temas', levels: { easy: 'FÁCIL', standard: 'MEDIO', hard: 'DIFÍCIL' },
      studyTitle: 'ESTUDIAR', startRun: 'Empezar', studyLine: (n) => `${n} palabras que aprender`, replayLine: 'Las que fallaste — a repasar',
      bankTitle: 'PALABRAS', bankLine: (n, k) => `${n} palabras · conoces ${k}`, show: 'mostrar', search: 'buscar', searchHint: 'español o inglés',
      filters: { all: 'Todas', todo: 'Por aprender', known: 'Sabidas', studied: 'Estudiadas', unstudied: 'Sin estudiar', study: 'No se adivinan', false: 'Falsos amigos' },
      status: { known: 'sabida', learning: 'en curso', new: 'nueva' }, studiedTag: 'estudiada', falseTag: 'falso amigo', none: 'Ninguna palabra.',
      results: { out: 'SIN VIDAS', of: (n) => `de ${n} correctas`, away: 'falladas', file: 'tus palabras', outcomes: { clean: 'BIEN', recaptured: '2º INTENTO', shaky: 'CON PISTAS', escaped: 'FALLO' }, again: 'Otra vez', replay: (n) => `Repasar las ${n} falladas`, menu: 'Inicio', copy: 'Copiar mis resultados', classAgain: 'Volver a la clase', classLeave: 'Salir de la clase' },
      review: { weak: 'CON PISTAS', miss: 'FALLO' },
    },
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
    categories: [{ id: 'familias', label: 'Familias y comunidades' }, { id: 'identidades', label: 'Identidades' }, { id: 'estetica', label: 'Belleza y estética' }, { id: 'ciencia', label: 'Ciencia y tecnología' }, { id: 'vida', label: 'Vida contemporánea' }, { id: 'desafios', label: 'Desafíos mundiales' }, { id: 'conectores', label: 'Conectores' }, { id: 'examen', label: 'Examen y correo' }],
    useDisplay: true,
    englishToggle: 'in English',
    unlisted: 'spanish',
  },
  it: {
    id: 'it',
    pack: 'it',
    // TEAM RACE + the solo BEST lane (nov26): team names (red / blue / green / yellow ink) and the race's words
    race: { names: ['ROSSO', 'BLU', 'VERDE', 'GIALLO'], win: (t) => `VINCE IL ${t}!`, tie: 'PAREGGIO!', yours: 'la tua squadra', chain: 'catena', record: 'record', you: 'tu', ahead: 'SOPRA IL TUO RECORD!', newBest: 'NUOVO RECORD!' },
    // the menus in the language (nov24 round 2, Andy: "STUDY" should simply be ÉTUDIER / ESTUDIAR / …)
    menu: {
      play: 'Gioca', create: 'Crea aula', join: 'Entra', bank: 'Parole', language: 'lingua', hello: 'Ciao!',
      practice: 'ESERCIZIO', studyFirst: 'STUDIARE', quiz: 'QUIZ', exit: 'ESCI',
      difficulty: 'livello', theme: 'tema', timer: 'tempo', timed: 'A TEMPO', noTimer: 'SENZA TEMPO', words: 'parole',
      skipStudied: 'salta le studiate', start: 'Inizia', study: 'Studia', back: 'INDIETRO', copyLink: 'COPIA LINK', copied: 'COPIATO',
      allThemes: 'Tutti i temi', levels: { easy: 'FACILE', standard: 'MEDIO', hard: 'DIFFICILE' },
      studyTitle: 'STUDIARE', startRun: 'Inizia', studyLine: (n) => `${n} parole da imparare`, replayLine: 'Quelle sbagliate — da ripassare',
      bankTitle: 'PAROLE', bankLine: (n, k) => `${n} parole · ne conosci ${k}`, show: 'mostra', search: 'cerca', searchHint: 'italiano o inglese',
      filters: { all: 'Tutte', todo: 'Da imparare', known: 'Conosciute', studied: 'Studiate', unstudied: 'Non studiate', study: 'Non intuibili', false: 'Falsi amici' },
      status: { known: 'saputa', learning: 'in corso', new: 'nuova' }, studiedTag: 'studiata', falseTag: 'falso amico', none: 'Nessuna parola.',
      results: { out: 'NIENTE VITE', of: (n) => `su ${n} giuste`, away: 'sbagliate', file: 'le tue parole', outcomes: { clean: 'GIUSTO', recaptured: '2° TENTATIVO', shaky: 'CON AIUTI', escaped: 'SBAGLIATO' }, again: 'Ancora', replay: (n) => `Ripassa le ${n} sbagliate`, menu: 'Inizio', copy: 'Copia i risultati', classAgain: 'Torna in classe', classLeave: 'Esci dalla classe' },
      review: { weak: 'CON AIUTI', miss: 'SBAGLIATO' },
    },
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
    categories: [{ id: 'famiglie', label: 'Famiglie e comunità' }, { id: 'identita', label: 'Identità' }, { id: 'estetica', label: 'Bellezza ed estetica' }, { id: 'scienza', label: 'Scienza e tecnologia' }, { id: 'vita', label: 'Vita contemporanea' }, { id: 'sfide', label: 'Sfide globali' }, { id: 'connettivi', label: 'Connettivi' }, { id: 'esame', label: 'Esame ed email' }],
    useDisplay: true,
    englishToggle: 'in English',
    unlisted: 'italian',
  },
  la: {
    id: 'la',
    pack: 'la',
    // TEAM RACE + the solo BEST lane (nov26): team names (red / blue / green / yellow ink) and the race's words
    race: { names: ['RUBRĪ', 'CAERULEĪ', 'VIRIDĒS', 'FLĀVĪ'], win: (t) => `${t} VINCUNT!`, tie: 'PARĒS!', yours: 'tua turma', chain: 'catēna', record: 'optimum', you: 'tū', ahead: 'SUPRĀ OPTIMUM!', newBest: 'NOVUM OPTIMUM!' },
    // the menus in the language (nov24 round 2, Andy: "STUDY" should simply be ÉTUDIER / ESTUDIAR / …)
    menu: {
      play: 'Lūde', create: 'Aperī scholam', join: 'Intrā', bank: 'Verba', language: 'lingua', hello: 'Salvē!',
      practice: 'EXERCITĀTIŌ', studyFirst: 'DISCE', quiz: 'TEMPTĀ', exit: 'EXĪ',
      difficulty: 'gradus', theme: 'rēs', timer: 'tempus', timed: 'CUM TEMPORE', noTimer: 'SINE TEMPORE', words: 'verba',
      skipStudied: 'omitte cognita', start: 'Incipe', study: 'Disce', back: 'REDĪ', copyLink: 'EXSCRĪBE NEXUM', copied: 'EXSCRĪPTUM',
      allThemes: 'Omnēs rēs', levels: { easy: 'FACILE', standard: 'MEDIUM', hard: 'DIFFICILE' },
      studyTitle: 'DISCE', startRun: 'Incipe', studyLine: (n) => `${n} verba discenda`, replayLine: 'Quae errāvistī — iterum disce',
      bankTitle: 'VERBA', bankLine: (n, k) => `${n} verba · ${k} nōvistī`, show: 'ostende', search: 'quaere', searchHint: 'Latīnē aut Anglicē',
      filters: { all: 'Omnia', todo: 'Discenda', known: 'Cognita', studied: 'Lecta', unstudied: 'Nōndum lecta', study: 'Nōn coniectanda', false: 'Falsī amīcī' },
      status: { known: 'cognitum', learning: 'discitur', new: 'novum' }, studiedTag: 'lectum', falseTag: 'falsus amīcus', none: 'Nūllum verbum.',
      results: { out: 'NŪLLAE VĪTAE', of: (n) => `ex ${n} rēcta`, away: 'errāta', file: 'tua verba', outcomes: { clean: 'RĒCTĒ', recaptured: 'ITERUM', shaky: 'CUM AUXILIŌ', escaped: 'ERRĀTUM' }, again: 'Iterum', replay: (n) => `${n} errāta iterum`, menu: 'Domum', copy: 'Exscrībe ēventum', classAgain: 'Redī in scholam', classLeave: 'Exī ē scholā' },
      review: { weak: 'CUM AUXILIŌ', miss: 'ERRĀTUM' },
    },
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
    categories: [{ id: 'bellum', label: 'Bellum et mīlitia' }, { id: 'res', label: 'Rōma et rēs pūblica' }, { id: 'di', label: 'Dī, fātum, pietās' }, { id: 'natura', label: 'Mare, caelum, terra' }, { id: 'animus', label: 'Corpus et animus' }, { id: 'homines', label: 'Hominēs et familia' }, { id: 'parva', label: 'Verba parva' }, { id: 'poesis', label: 'Verba Vergiliī' }],
    useDisplay: true,
    englishToggle: 'in English',
    unlisted: 'latin',
  },
  zh: {
    id: 'zh',
    pack: 'zh',
    // TEAM RACE + the solo BEST lane (nov26): team names (red / blue / green / yellow ink) and the race's words
    race: { names: ['红队', '蓝队', '绿队', '黄队'], win: (t) => `${t}获胜！`, tie: '平局！', yours: '你的队', chain: '连击', record: '最佳', you: '你', ahead: '超过最佳纪录！', newBest: '新纪录！' },
    // the menus in the language (nov24 round 2, Andy: "STUDY" should simply be ÉTUDIER / ESTUDIAR / …)
    menu: {
      play: '开始玩', create: '创建房间', join: '加入房间', bank: '词汇表', language: '语言', hello: '你好！',
      practice: '练习', studyFirst: '学习', quiz: '测验', exit: '退出',
      difficulty: '难度', theme: '主题', timer: '计时', timed: '计时', noTimer: '不计时', words: '词数',
      skipStudied: '跳过已学', start: '开始', study: '学习', back: '返回', copyLink: '复制链接', copied: '已复制',
      allThemes: '全部主题', levels: { easy: '简单', standard: '中等', hard: '困难' },
      studyTitle: '学习', startRun: '开始', studyLine: (n) => `${n}个要学的词`, replayLine: '答错的词——再学一遍',
      bankTitle: '词汇表', bankLine: (n, k) => `共${n}个词 · 已掌握${k}个`, show: '显示', search: '搜索', searchHint: '英文、拼音或汉字',
      filters: { all: '全部', todo: '未掌握', known: '已掌握', studied: '学过的', unstudied: '还没学', study: '猜不出的', false: '易混词' },
      status: { known: '已掌握', learning: '学习中', new: '新词' }, studiedTag: '学过', falseTag: '易混', none: '没有这个词。',
      results: { out: '没命了', of: (n) => `/ ${n} 答对`, away: '答错', file: '你的词', outcomes: { clean: '答对', recaptured: '第二次', shaky: '有提示', escaped: '答错' }, again: '再练一次', replay: (n) => `复习答错的${n}个`, menu: '首页', copy: '复制成绩', classAgain: '回到教室', classLeave: '离开教室' },
      review: { weak: '有提示', miss: '答错' },
    },
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
    categories: [{ id: 'jiating', label: '家庭与社区' }, { id: 'shenfen', label: '个人与社会认同' }, { id: 'meixue', label: '美与美学' }, { id: 'keji', label: '科学与技术' }, { id: 'shenghuo', label: '当代生活' }, { id: 'tiaozhan', label: '全球挑战' }, { id: 'lianci', label: '关联词' }, { id: 'kaoshi', label: '考试与邮件' }],
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
