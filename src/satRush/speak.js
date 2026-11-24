// speak.js — read a word aloud with the browser's own text-to-speech (FRENCH RUSH's 🔊). No audio
// files (house rule: no external audio); the browser's French voice does the work. (LANGUAGE RUSH: the page's
// language — rushLang.js — picks the voice; "Fr" in the names below is historical.) Pure-ish: every
// call is guarded, so a browser without speechSynthesis (or without a French voice) just stays quiet.

// THE VOICE (feat/french-rush-sound): the best French voice this device has, picked once and re-picked
// whenever the browser's voice list changes (Chrome loads it async — getVoices() is [] on first call).
// No French voice at all = no 🔊 anywhere (useFrVoice) and speakFr stays quiet: an English voice
// reading "la famille" teaches the wrong sound, which is worse than silence.

import { RUSH_LANGS, rushLang, displayOf, sayTextOf } from './rushLang.js';

// Higher = better. A natural/neural/premium voice beats a robotic default; fr-FR beats fr-CA/-BE/-CH
// (AP French is taught in metropolitan French); an on-device voice beats a network one (no lag, works
// on a school Chromebook's filtered wifi). Pure — unit-tested.
//
// LANGUAGE RUSH (nov24): the same ranking for every language, from its rushLang.js `voice` config — the
// language subtag it must match, the regions it prefers (first = +8, each next one 2 less), and any locale it
// must never use (Chinese: a Cantonese voice reads the same characters with other sounds). A language with
// no voice config (Latin) has no voice, so no 🔊.
export function rankVoice(v, cfg) {
  if (!cfg || !v || typeof v.lang !== 'string' || !cfg.prefix.test(v.lang)) return -1;
  const name = String(v.name || '');
  if (cfg.exclude && (cfg.exclude.test(v.lang) || cfg.exclude.test(name))) return -1;
  let score = 1;
  const tag = v.lang.replace('_', '-').toLowerCase();
  const at = (cfg.prefer || []).findIndex((p) => p.toLowerCase() === tag);
  if (at >= 0) score += Math.max(1, 8 - 2 * at);
  if (/natural|neural|premium|enhanced|wavenet/i.test(name)) score += 6;
  else if (/google/i.test(name)) score += 4;
  if (v.localService) score += 1;
  return score;
}

/** The best voice in `voices` for a language's voice config, or null when there is none. Pure. */
export function pickVoiceFor(voices, cfg) {
  let best = null;
  let bestScore = -1;
  for (const v of voices || []) {
    const r = rankVoice(v, cfg);
    if (r > bestScore) {
      best = v;
      bestScore = r;
    }
  }
  return bestScore >= 0 ? best : null;
}

/** French's ranking (the original API; the tests read it). */
export function rankFrVoice(v) {
  return rankVoice(v, RUSH_LANGS.fr.voice);
}

/** The best French voice in `voices`, or null when there is none. Pure. */
export function pickFrVoice(voices) {
  return pickVoiceFor(voices, RUSH_LANGS.fr.voice);
}

let frVoice = null;
let voicesKnown = false; // the browser has reported a non-empty voice list at least once
const listeners = new Set();
function pickVoice() {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    if (voices.length) voicesKnown = true;
    frVoice = pickVoiceFor(voices, rushLang().voice);
  } catch {
    frVoice = null;
  }
}
// the browser's voiceschanged: re-pick, then tell the 🔊 controls (never called during a render)
function voicesChanged() {
  pickVoice();
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* a listener never breaks the others */
    }
  }
}

/** True when this device has a French voice to read words with. */
export function hasFrVoice() {
  if (!canSpeak() || !rushLang().voice) return false;
  if (!frVoice) pickVoice();
  return !!frVoice;
}

/** Subscribe to voice-list changes (useFrVoice). Returns the unsubscribe function. */
export function onVoicesChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// AUTO-SAY: the review card reads its word aloud as it lands. A CLASS ROOM teacher can switch that
// off for the students' phones (thirty phones talking at once) — the 🔊 button still works.
let autoSpeak = true;
/** Turn the review card's automatic read-aloud on / off (the 🔊 button is unaffected). */
export function setAutoSpeak(on) {
  autoSpeak = !!on;
}
/** Is the automatic read-aloud on? */
export function autoSpeakOn() {
  return autoSpeak;
}

/** True when this browser can read text aloud at all. */
export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Say `text` in French (cancels anything still speaking). Silent on any failure, and silent when the
 * device has reported its voices and none of them is French. */
export function speakFr(text) {
  const cfg = rushLang().voice;
  if (!canSpeak() || !text || !cfg) return;
  try {
    if (!frVoice) pickVoice();
    if (!frVoice && voicesKnown) return; // no French voice on this device
    const u = new SpeechSynthesisUtterance(String(sayTextOf(text)));
    u.lang = cfg.tag;
    if (frVoice) u.voice = frVoice;
    u.rate = 0.9; // a touch slower than default — learners
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* no voice / blocked — stay quiet */
  }
}

if (canSpeak()) {
  try {
    const ss = window.speechSynthesis;
    if (typeof ss.addEventListener === 'function') ss.addEventListener('voiceschanged', voicesChanged);
    else ss.onvoiceschanged = voicesChanged;
  } catch {
    /* ignore */
  }
}

/** "la famille" / "le pays" / "l'école" — a noun with its article, so the gender is learned with it. */
// a French teacher reads these on the board (oct26): an h ASPIRÉ never elides ("le héros", not "l'héros"),
// and a plural-only noun takes "les" ("les vacances", not "la vacances")
const H_ASPIRE = new Set(['héros', 'harcèlement', 'hasard', 'haine', 'handicap', 'honte', 'hauteur', 'hibou', 'homard', 'hockey']);
const PLURAL_ONLY = new Set(['vacances', 'gens', 'fiançailles', 'mathématiques', 'environs', 'frais']);
// LANGUAGE RUSH: every other language carries its board form per row (rushLang displayOf: "el agua",
// "lo studente", "amō, amāre, amāvī, amātum"); French builds it here, exactly as before.
export function withArticle(word, pos, gender) {
  if (rushLang().id !== 'fr') return displayOf(word) || word;
  if (pos !== 'n' || !gender) return word;
  if (PLURAL_ONLY.has(word)) return `les ${word}`;
  if (!H_ASPIRE.has(word) && /^[aeiouyàâäéèêëîïôöùûüœh]/i.test(word)) return `l'${word}`;
  if (gender === 'f') return `la ${word}`;
  if (gender === 'm') return `le ${word}`;
  return `le/la ${word}`;
}
