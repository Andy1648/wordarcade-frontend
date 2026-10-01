// wordHook.js — the pure half of the phone menu's TYPE A WORD hook (components/WordHook.jsx),
// split out so node --test can cover it without a JSX loader.

// Long enough for any word someone types for fun; short enough that the slammed letterform can
// stay at or above --fs-panel (the Bungee floor) beside the mascot on a 320px phone. The input's
// maxLength is this same number, so a word is never silently cut off after it was typed.
export const HOOK_MAX_LEN = 12;

export function hookPromptFor(lang) {
  return typeof lang === 'string' && lang.toLowerCase().startsWith('de')
    ? { text: 'TIPP EIN WORT 👇', lang: 'de' }
    : { text: 'TYPE A WORD 👇', lang: 'en' };
}

// Letters only (any script Bungee may or may not carry — the stack falls back cleanly), upper-
// cased, capped. Digits/punctuation/emoji are dropped rather than rejected: the point is a
// satisfying reaction to whatever they typed, not a validator.
export function cleanHookWord(raw) {
  return String(raw || '')
    .replace(/[^\p{L}]/gu, '')
    .toUpperCase()
    .slice(0, HOOK_MAX_LEN);
}
