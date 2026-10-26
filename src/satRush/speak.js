// speak.js — read a word aloud with the browser's own text-to-speech (FRENCH RUSH's 🔊). No audio
// files (house rule: no external audio); the browser's French voice does the work. Pure-ish: every
// call is guarded, so a browser without speechSynthesis (or without a French voice) just stays quiet.

let frVoice = null;
function pickVoice() {
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    frVoice =
      voices.find((v) => /^fr[-_]FR/i.test(v.lang)) || voices.find((v) => /^fr/i.test(v.lang)) || null;
  } catch {
    frVoice = null;
  }
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

/** Say `text` in French (cancels anything still speaking). Silent on any failure. */
export function speakFr(text) {
  if (!canSpeak() || !text) return;
  try {
    if (!frVoice) pickVoice();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = 'fr-FR';
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
    window.speechSynthesis.onvoiceschanged = pickVoice;
  } catch {
    /* ignore */
  }
}

/** "la famille" / "le pays" / "l'école" — a noun with its article, so the gender is learned with it. */
// a French teacher reads these on the board (oct26): an h ASPIRÉ never elides ("le héros", not "l'héros"),
// and a plural-only noun takes "les" ("les vacances", not "la vacances")
const H_ASPIRE = new Set(['héros', 'harcèlement', 'hasard', 'haine', 'handicap', 'honte', 'hauteur', 'hibou', 'homard', 'hockey']);
const PLURAL_ONLY = new Set(['vacances', 'gens', 'fiançailles', 'mathématiques', 'environs', 'frais']);
export function withArticle(word, pos, gender) {
  if (pos !== 'n' || !gender) return word;
  if (PLURAL_ONLY.has(word)) return `les ${word}`;
  if (!H_ASPIRE.has(word) && /^[aeiouyàâäéèêëîïôöùûüœh]/i.test(word)) return `l'${word}`;
  if (gender === 'f') return `la ${word}`;
  if (gender === 'm') return `le ${word}`;
  return `le/la ${word}`;
}
