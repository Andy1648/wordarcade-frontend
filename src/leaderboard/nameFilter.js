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
// STEP 51 (Andy oct2): Chinese names. A name with any CJK ideograph may be 2-12 chars of CJK + ASCII.
// Mirrors supabase/migrations/005_letters_cjk.sql; only offered once the DB reports it (lb_caps).
const CJK_CHAR = /[㐀-䶿一-鿿]/;
export const NAME_SHAPE_CJK = /^[A-Za-z0-9_㐀-䶿一-鿿]{2,12}$/;
// Chinese profanity / slurs, matched as SUBSTRINGS of the raw name (no leet applies to ideographs).
// The DB's private.blocked_terms kind 'cjk' is seeded with the same list (005_letters_cjk.sql).
export const CJK_TERMS = [
  '操你', '肏', '傻逼', '傻屄', '煞笔', '沙比', '妈的', '他妈', '你妈', '尼玛', '草泥马', '日你',
  '屌', '鸡巴', '几把', '屄', '逼', '婊子', '贱人', '贱货', '王八蛋', '狗日', '狗娘', '杂种',
  '混蛋', '滚蛋', '去死', '死全家', '脑残', '弱智', '妓女', '卖淫', '色情', '淫', '强奸', '轮奸',
  '阴茎', '阴道', '做爱', '性交', '黑鬼', '支那', '小日本', '鬼子', '棒子', '阿三', '基佬', '死基',
  '纳粹', '希特勒', '恐怖分子', '自杀', '毒品', '冰毒',
];
export function hasCjk(name) {
  return CJK_CHAR.test(String(name || ''));
}
const EXACT = new Set(ALL_TERMS.map((t) => String(t).toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean));

export function isNameBlocked(name) {
  const raw = String(name || '');
  if (CJK_TERMS.some((t) => raw.includes(t))) return true;
  const plain = String(name || '').toLowerCase().replace(/[^a-z]/g, '');
  const leet = nameLeet(name);
  const squash = nameSquash(name);
  if (EXACT.has(plain) || EXACT.has(leet)) return true;
  return ROOTS.some((r) => leet.includes(r) || squash.includes(r));
}

/** 'ok' | 'shape' | 'blocked' — the client's instant verdict (the DB adds 'taken'). */
export function nameVerdict(name, { cjk = false } = {}) {
  const n = String(name || '');
  const shapeOk = NAME_SHAPE.test(n) || (cjk && hasCjk(n) && NAME_SHAPE_CJK.test(n));
  if (!shapeOk) return 'shape';
  if (isNameBlocked(name)) return 'blocked';
  return 'ok';
}
