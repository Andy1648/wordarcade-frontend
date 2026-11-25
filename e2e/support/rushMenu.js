// e2e/support/rushMenu.js — the LANGUAGE RUSH menus speak their language (nov24 round 2, rushLang.js `menu`), so
// specs find a button by the language's own word: re(M.play) matches "Jouer" exactly, re(M.theme, false) any name
// that starts with "thème".
export { RUSH_LANGS } from '../../src/satRush/rushLang.js';

export const re = (s, whole = true) => new RegExp(`^${String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${whole ? '$' : ''}`);
