// wordsData.js — the raw solo word assets, pulled in as ?raw strings.
//
// This module is imported DYNAMICALLY (see words.js → loadSoloWords), so Vite emits
// it as its own chunk. The ~357KB gzip of recall+accept therefore rides a lazy chunk
// that only downloads when a solo mode starts — it never touches the menu's first
// paint, and it's shared between CHAIN and FUSE.
import recallRaw from './words.recall.txt?raw';
import acceptExtraRaw from './words.accept.txt?raw';
// THE FAMOUS LONG WORDS — a small HAND-CURATED list (one per line), bundled with the base lists
// so it is accepted from the very first run. It is NOT written into the generated lists: those
// come from word-list ∩ the frequency corpus (scripts/build-words.mjs), and none of these ten is
// in word-list, so a regeneration would silently drop them. Every entry was checked against
// Wiktionary (en.wiktionary.org) before it went in; see the file's history for the check.
import famousRaw from './words.famous.txt?raw';
// STEP 55 — COMMON PROPER-NOUN WORDS + MILD INSULTS (one per line, hand-curated): months, days,
// countries, major cities, US states, nationalities/languages, holidays, planets, a few modern
// words, and mild idiot-class insults. word-list is lowercase-only, so none of these can come from
// the generated lists — like the famous list, a regeneration would drop them if they lived there.
// Source + safety filter (slur / profanity / leaderboard-name blocklists):
// claude/wordlists/build-common.mjs; measured by claude/wordlists/measure.mjs (before/after.json). ACCEPTANCE ONLY —
// never generated or displayed (CHAIN's top-3000 and the reveal words read RECALL, not this).
import commonRaw from './words.common.txt?raw';

export { recallRaw, acceptExtraRaw, famousRaw, commonRaw };
