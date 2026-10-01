// nameFilter.js — leaderboard USERNAME filter (STEP 24, Andy A13: "block bad names").
//
// This is the CLIENT half; the DB enforces the identical rule (supabase/migrations/001_leaderboard.sql,
// public.username_is_clean, run by a BEFORE INSERT/UPDATE trigger and inside lb_claim). The client
// check only gives instant feedback; the DB is what actually refuses a name. The DB's term table is
// SEEDED FROM THIS FILE (scripts/gen-lb-blocklist.mjs → supabase/migrations/002_blocked_terms.sql),
// so the two can never drift; nameFilter.test.js pins the behaviour both sides share.
//
// A name is BLOCKED iff
//   (a) EXACT: its letters (plain, or leet-decoded) equal any term in the game's full content blocklist
//       (src/moderation/blockedTerms.js ALL_TERMS — slurs + profanity), or
//   (b) ROOT: one of ROOTS occurs ANYWHERE in its leet-decoded or run-squashed form, which catches
//       "xXfuckerXx", "sh1tlord", "fuuuuck".
// Leet map: 0→o 1→i 3→e 4→a 5→s 7→t 8→b @→a $→s !→i 9→g. Squash collapses letter runs, and is used
// for ROOTS only: applied to whole names it collides innocent names with blocked ones.
//
// ROOTS are deliberately few and unambiguous. Each one was checked against innocent words it would
// sit inside; these were LEFT OUT for that reason: cock (peacock, Hancock), dick (Dickens), anal
// (canal, analyst), sex (Essex, Sussex), cum (document), rape (grape, drape), spic (spicy), tit
// (title, petite), pedo (torpedo), ass (class, pass), hoe (shoe), nig (night). Their WHOLE-name forms
// are still blocked by (a).
import { ALL_TERMS } from '../moderation/blockedTerms.js';

export const ROOTS = [
  'fuck', 'fuk', 'shit', 'cunt', 'nigg', 'fagg', 'faggot', 'bitch', 'whore', 'slut', 'pussy',
  'porn', 'penis', 'vagina', 'dildo', 'rapist', 'nazi', 'hitler', 'retard', 'tranny', 'kike',
  'wank', 'twat', 'jizz', 'asshole', 'motherf', 'pedophile', 'molest', 'kkk', 'heilh',
];

const LEET_FROM = '0134578@$!9';
const LEET_TO = 'oieastbasig';

export function nameLeet(name) {
  let out = '';
  for (const ch of String(name || '').toLowerCase()) {
    const i = LEET_FROM.indexOf(ch);
    out += i >= 0 ? LEET_TO[i] : ch;
  }
  return out.replace(/[^a-z]/g, '');
}

export function nameSquash(name) {
  return nameLeet(name).replace(/(.)\1+/g, '$1');
}

export const NAME_SHAPE = /^[A-Za-z0-9_]{3,16}$/;
const EXACT = new Set(ALL_TERMS.map((t) => String(t).toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean));

export function isNameBlocked(name) {
  const plain = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
  const leet = nameLeet(name);
  const squash = nameSquash(name);
  if (EXACT.has(plain) || EXACT.has(leet)) return true;
  return ROOTS.some((r) => leet.includes(r) || squash.includes(r));
}

/** 'ok' | 'shape' | 'blocked' — the client's instant verdict (the DB adds 'taken'). */
export function nameVerdict(name) {
  if (!NAME_SHAPE.test(String(name || ''))) return 'shape';
  if (isNameBlocked(name)) return 'blocked';
  return 'ok';
}
