# LANGUAGE RUSH vocab spec (Spanish / Italian / Latin / Chinese)

TYPE A WORD's French Rush is an AP French vocab trainer used by a real high-school class. The game shows a
clue (the English meaning), then an example sentence with a blank, and the student TYPES the answer into
fixed letter slots (accents are optional to type — `e` fills `é` — but the slot shows the real accent).
On a review card the student sees the word as a teacher writes it on the board, its meaning, and the example
+ its English translation. A TEACHER WILL READ EVERY ROW. Accuracy beats quantity: a wrong translation is a
bug; never invent a word, a form, or a sentence a native speaker / Latin teacher would wince at.

Reference: `src/data/frenchRush/words.json` (548 rows) — read 30+ rows of it first and mirror its style:
short glosses ("to share", "household, home"), simple natural example sentences a student can read, one
blank, an English translation of the whole sentence.

## Output
One JSON array file (2-space indent, UTF-8, real characters not \u escapes):
- Spanish  → `src/data/spanishRush/words.json`
- Italian  → `src/data/italianRush/words.json`
- Latin    → `src/data/latinRush/words.json`
- Chinese  → `src/data/chineseRush/words.json`

Validate with `node scripts/validate-rush-vocab.mjs <es|it|la|zh>` until it prints OK. Build it in pieces
(e.g. one theme at a time into a scratch file, then merge with a small node script) — do not try to emit 500
rows in a single tool call.

Size: 480–560 rows (Chinese: 420–520).

## Row fields (every row has every field)
| field | meaning |
|---|---|
| word | the TYPED answer: ONE lowercase token, 3–14 letters, no spaces/hyphens/apostrophes/capitals/proper nouns. Unique. Also unique once accents are stripped (no `papa` + `papá`). |
| pos | `n` `v` `adj` `adv` `conj` `prep` |
| gender | nouns: `m` / `f` / `mf` (Latin also `n`); every other pos: `null`. Chinese: always `null`. |
| display | the word as a teacher writes it on the board (see per-language rules). Must contain `word` (accent-insensitive), except Chinese. |
| gloss | the English meaning — short, specific, and UNIQUE across the whole file (case-insensitive). If two words share a meaning, disambiguate ("to know (a fact)" vs "to know (a person)"). Verbs start with "to ". |
| context | a sentence in the target language with exactly one `___` where `word` goes, EXACTLY in that form (so the filled sentence is grammatical). Simple, natural, about the row's theme when possible. |
| contextEn | the English translation of the full sentence (with the word filled in). |
| root | a word family `{ "morpheme": "...", "meaning": "...", "cousins": ["...", "..."] }` (real related words in the target language) or `null` when there is no useful one. ~80% of rows should have one. |
| alts | target-language synonyms of the same meaning (used to avoid unfair multiple-choice distractors); usually `[]`. |
| category | a theme id from the per-language list below. |
| tier | 1–5: how hard it is for an English-speaking high-schooler to LEARN (frequency + transparency). One step easier for a true cognate. Rough mix: tier1 ~32%, 2 ~28%, 3 ~22%, 4 ~13%, 5 ~5%. |
| ap | 1 = must-know for the AP exam, 2 = common on the exam, 3 = extra. Mix ~48% / 39% / 13%. |
| freqRank | integer, approximate rank in a frequency list of the language (or null if unknown). |
| cognate | true when it is a true cognate of an English word. |
| guessable | true when an English speaker would guess the meaning from the word alone (most cognates). |
| falseFriend | OPTIONAL `true` for a classic false friend (then guessable must be false). |

## Band rules (the validator enforces these per theme)
For EVERY theme: ≥40 rows; ≥12 rows with ap 1 AND tier ≤2 (EASY level); ≥12 rows with ap ≤2 AND tier ≤4 (MEDIUM);
≥12 rows with tier ≥3 (HARD); ≥18 rows with guessable false (the STUDY deck only deals non-guessable words).

## Themes
The six AP World Language themes + essay connectors + exam/email words. Per theme roughly 60–80 rows,
connectors ~40–50, exam ~45–55.

- Spanish ids: `familias` (Families & communities), `identidades` (Personal & public identities), `estetica`
  (Beauty & aesthetics), `ciencia` (Science & technology), `vida` (Contemporary life), `desafios` (Global
  challenges), `conectores` (Essay connectors, single-word only: además,
  aunque, porque, entonces, mientras, quizás, también, todavía, luego, pues, sino, ...), `examen` (Exam & email
  words: pregunta, correo, saludo, estimado, adjunto, ...).
- Italian ids: `famiglie`, `identita`, `estetica`, `scienza`, `vita`, `sfide`, `connettivi`, `esame` (same
  meanings as the Spanish list).
- Chinese ids: `jiating`, `shenfen`, `meixue`, `keji`, `shenghuo`, `tiaozhan`, `lianci` (connectors: 但是, 因为,
  所以, 虽然, 而且, 然后, 如果, 或者, 还是, 已经, 一定, ...), `kaoshi` (exam / school / email words).
- Latin ids (AP Latin = Caesar's Bellum Gallicum + Vergil's Aeneid reading vocabulary, NOT AP themes):
  `bellum` (War & the army), `res` (Rome, power & politics), `di` (Gods, fate & duty), `natura` (Sea, sky &
  land), `animus` (Body, mind & feeling), `homines` (People & family), `parva` (Little words: conjunctions,
  adverbs, prepositions, pronoun-ish words of 3+ letters — sed, atque, enim, igitur, tamen, autem, quod, quia,
  postquam, iam, nunc, tum, inter, contra, propter, ...), `poesis` (Vergil's words: aequor, unda, lītus,
  ēnsis, pelagus, furor, ...). Words must be ones that really appear often in
  Caesar or Vergil (Dickinson College Commentaries "Latin Core Vocabulary" + the DCC AP Latin lists are the
  best guide; freqRank = DCC core rank when known).

## Per-language rules
### Spanish (`es`)
- Accents optional to type; ñ counts as an accent (n fills ñ). Keep real accents in `word`.
- `display`: nouns with the definite article as a teacher writes it — `la familia`, `el agua` (feminine
  stressed a- takes el), `el problema`, `la mano`, `los padres` only for plural-only words. Others = word.
- Infinitives for verbs, masculine singular for adjectives. Neutral Latin-American/Spain-shared vocabulary;
  if a word is region-specific say so in the gloss.
- False friends to include (marked): embarazada, librería, éxito, carpeta, asistir, ropa, ...
### Italian (`it`)
- Accents optional. `display`: nouns with the correct definite article: `il libro`, `lo studente`, `lo zio`,
  `l'amico`, `l'arte` (f.), `la casa`, `gli` only for plural-only. Watch lo before s+consonant / z / gn / ps.
- False friends: parenti, camera, libreria, fattoria, morbido, ...
### Latin (`la`)
- `word` = the dictionary headword WITH MACRONS (amō, puella, bonus, nūntius, iubeō). Use i for consonantal
  i (iam, iubeō), v for consonantal u (vir, videō) — AP style. Macrons are optional to type (a fills ā).
- `display`: the full dictionary entry: verbs four principal parts `amō, amāre, amāvī, amātum` (deponents
  `sequor, sequī, secūtus sum`; defective as in the dictionary), nouns nominative + genitive `puella, puellae`
  (`rēx, rēgis`, `corpus, corporis`), adjectives `bonus, bona, bonum` / `fortis, forte` / `ingēns, ingentis`.
  Indeclinables / adverbs / conjunctions = the word.
- gender: m / f / n / mf (common nouns like cīvis, dux, comes → mf).
- context: a short Latin sentence (macrons on) in which the HEADWORD FORM fits grammatically: verbs in 1st
  person singular present (`Ego patriam ___.` → amō), nouns as the nominative singular subject or predicate,
  adjectives masculine nominative singular agreeing with a masculine subject. Caesar/Vergil flavour welcome;
  keep it correct classical Latin. contextEn = its translation.
- guessable = an English derivative makes the meaning obvious (nāvis? no; exercitus? no; familia yes).
- tier from frequency (DCC core rank): top 150 → 1, 151–400 → 2, 401–700 → 3, 701–1000 → 4, rarer/poetic → 5.
  ap 1 = very frequent in BOTH Caesar and Vergil selections, 2 = frequent in one, 3 = extra.
### Chinese (`zh`) — the playful one, but every row must be correct Mandarin (simplified characters)
- The student sees 汉字 + pinyin and TYPES THE ENGLISH MEANING. So `word` = the English answer: one lowercase
  English word, 3–14 letters (water, family, however, computer, homework). It must be the most obvious
  English translation (the one a teacher's answer key would print), and unique in the file.
- Extra fields: `hanzi` (simplified characters, e.g. 水 / 电脑), `pinyin` (tone MARKS, spaces between
  syllables of different words but standard joined spelling inside a word: `diànnǎo`, `xǐhuan`, `péngyou`).
- `gloss` = exactly `"<hanzi> (<pinyin>)"`, e.g. `"电脑 (diànnǎo)"`. `display` = the hanzi.
- `context` = an ENGLISH sentence with `___` where the English word goes ("I want to drink some ___.");
  `contextEn` = the Chinese sentence with pinyin after it: `"我想喝水。 (Wǒ xiǎng hē shuǐ.)"`.
- `alts` = English synonyms (e.g. computer → ["pc"]). `root`: optionally the key character as a family:
  `{ "morpheme": "电", "meaning": "electric", "cousins": ["电视", "电话"] }`, else null.
- cognate/guessable/falseFriend all false. tier = HSK level (HSK1→1, HSK2→2, HSK3→3, HSK4→4, HSK5+→5).
  gender null. You may add a little meme energy ONLY in example sentences (e.g. "My ___ ate my homework" for
  狗 dog) — the vocabulary itself stays standard AP Chinese / HSK.

## Self-check before you finish
1. Validator prints OK.
2. Re-read every row once more as a strict teacher: is the gloss right? is the sentence grammatical with the
   word filled in? is the gender/article right? Fix anything doubtful or drop the row.
3. Report: total rows, the counts table, and a list of any rows you are less than sure about.
