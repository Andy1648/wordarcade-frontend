// blockedTerms.js — content-safety word lists + matchers for TYPE A WORD.
//
// WHY THIS EXISTS. The shipped acceptance dictionaries are sourced from public
// word lists (SCOWL / an-array-of-english-words / a public web-frequency list),
// which contain slurs, hate terms, profanity and explicit sexual vocabulary. The
// audience is high-school students, the game is submitted to CrazyGames (PEGI 12)
// and it spreads through school networks, so those terms must be kept out of what
// the game ACCEPTS/SCORES (slurs only) and what the game DISPLAYS (profanity+slurs).
//
// TWO TIERS, TWO POLICIES (see the fix/dict-safety report):
//   SLURS  — racial/ethnic/religious/homophobic/transphobic/ableist hate terms.
//            NEVER accepted, scored, generated OR displayed. Removed from EVERY
//            asset (acceptance lists AND generation/display assets).
//   PROFANITY — general swearing + explicit sexual terms. A player TYPING one is
//            not a crisis, so these STAY accepted, but the game must never DISPLAY
//            or GENERATE one, so they are removed from every generation/display
//            asset (bot words, recall/common-word supply, SAT words, fragment
//            reveals, and category answers the bot can surface).
//
// Basis: modelled on LDNOOBW's List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-
// Words (CC-BY 4.0) and supplemented. Two precision rules keep innocent
// vocabulary intact (the codebase's "fail toward keeping real words" principle,
// cf. wordFilter.js):
//   1. EXACT WHOLE-TOKEN MATCH, never substring — grass/assassin/cockpit/class/
//      shiitake all pass. Every inflected form we want blocked is listed
//      EXPLICITLY (no algorithmic stemming, which previously mis-generated
//      spicy←spic, spikes←spik, tardy←tard, poofy←poof, battery←batter).
//   2. AMBIGUOUS HOMOGRAPHS OMITTED — tokens whose dominant sense is innocent are
//      NOT listed even though a slur/vulgar sense exists: niger (country/seed),
//      buckwheat/kraut/cracker (food), jerry/nancy/guido (names), dike (levee),
//      mongol (Mongolian people), nip (a small drink), gringo/commie/honky/limey
//      (mild), queer (reclaimed/neutral), homo (homo sapiens), nut/nuts/balls/
//      knob/wang/hoe/spunk/sod/gimp (dominant innocent), damn/crap/bloody/fart/
//      poop (PEGI-12-mild), anus/anal/rectum/testicle/semen/pube (clinical
//      biology). See the report for the full omit rationale.
// For MULTIWORD category answers, matching is WHOLE-ANSWER equality (see
// isBlockedAnswer), so "maine coon", "homo sapiens", "dick van dyke" survive
// while a standalone slur answer does not.

// ---- SLURS / HATE TERMS (exact forms; removed from EVERYTHING) --------------
export const SLURS = [
  // racial / ethnic
  'nigger', 'niggers', 'nigga', 'niggas', 'niggaz', 'negro', 'negros', 'negroes',
  'coon', 'coons', 'darkie', 'darkies', 'darky', 'jigaboo', 'jigaboos', 'sambo',
  'sambos', 'spearchucker', 'spearchuckers', 'porchmonkey', 'tarbaby', 'pickaninny',
  'pickaninnies', 'piccaninny', 'gook', 'gooks', 'chink', 'chinks', 'chinky',
  'jap', 'japs',
  'paki', 'pakis', 'raghead', 'ragheads', 'towelhead', 'towelheads',
  'sandnigger', 'sandniggers', 'wetback', 'wetbacks', 'beaner', 'beaners',
  'spic', 'spics', 'spick', 'spicks', 'spik', 'spiks', 'wop', 'wops', 'dago',
  'dagos', 'dagoes', 'guido', 'kike', 'kikes', 'yid', 'yids', 'heeb', 'heebs',
  'hymie', 'shylock', 'pikey', 'pikeys', 'injun', 'injuns', 'redskin', 'redskins',
  'squaw', 'squaws', 'abo', 'abbo', 'boong', 'boongs', 'chinaman', 'chinamen',
  'golliwog', 'golliwogs', 'golliwogg', 'quadroon', 'quadroons', 'octoroon',
  'octoroons', 'mulatto', 'mulattos', 'mulattoes', 'polack', 'polacks', 'polak',
  // religion
  'kaffir', 'kaffirs', 'kafir', 'kafirs',
  // sexuality / gender identity
  'faggot', 'faggots', 'faggy', 'fag', 'fags', 'fagot', 'fagots', 'dyke', 'dykes',
  'poofter', 'poofters', 'shemale', 'shemales', 'tranny',
  'trannie', 'trannies', 'ladyboy', 'ladyboys', 'transvestite', 'transvestites',
  // disability / ableist
  'retard', 'retards', 'retarded', 'retardo', 'tard', 'tards', 'mongoloid',
  'mongoloids', 'spastic', 'spastics', 'spaz', 'spazz', 'spazzes',
];

// ---- PROFANITY / EXPLICIT SEXUAL (exact forms; removed from GENERATION only) --
export const PROFANITY = [
  // strong profanity
  'fuck', 'fucks', 'fucker', 'fuckers', 'fucking', 'fucked', 'fuckin', 'fuckwit',
  'fuckhead', 'fuckface', 'clusterfuck', 'motherfucker', 'motherfuckers',
  'motherfucking', 'mofo', 'stfu', 'wtf',
  'shit', 'shits', 'shitty', 'shitting', 'shitted', 'shithead', 'shitheads',
  'shithole', 'shitholes', 'shithouse', 'shitbag', 'shitface', 'bullshit',
  'horseshit', 'dipshit', 'batshit', 'dogshit',
  'cunt', 'cunts', 'cunty', 'twat', 'twats',
  'bitch', 'bitches', 'bitchy', 'bitching', 'bitched',
  'bastard', 'bastards',
  'asshole', 'assholes', 'arsehole', 'arseholes', 'asshat', 'asshats', 'asswipe',
  'asswipes', 'jackass', 'jackasses', 'dumbass', 'dumbasses', 'smartass', 'fatass',
  'goddamn', 'goddamned', 'goddamnit',
  'douche', 'douches', 'douchebag', 'douchebags', 'wanker', 'wankers', 'wank',
  'tosser', 'tossers', 'prick', 'pricks', 'bollocks', 'bollock',
  'piss', 'pisses', 'pissed', 'pissing', 'pisser', 'pissflaps',
  // sexual anatomy / acts / vulgar
  'cock', 'cocks', 'cocksucker', 'cocksuckers', 'dick', 'dicks', 'dickhead',
  'dickheads', 'dickwad', 'dickface', 'dickwad', 'penis', 'penises', 'dildo',
  'dildos', 'dildoes', 'boner', 'boners', 'schlong', 'schlongs',
  'pussy', 'pussies', 'vagina', 'vaginas', 'vulva', 'vulvas', 'clit', 'clits',
  'clitoris', 'clitorises', 'tit', 'tits', 'titty', 'titties', 'tittie', 'tiddies',
  'boob', 'boobs', 'boobies', 'nipple', 'nipples', 'scrotum', 'nutsack', 'ballsack',
  'cum', 'cums', 'cumming', 'cumshot', 'cumshots', 'jizz', 'jizzed', 'jism', 'jizm',
  'sex', 'sexy', 'sexed', 'sexting', 'fornicate', 'fornication', 'masturbate',
  'masturbates', 'masturbation', 'masturbating', 'handjob', 'handjobs', 'blowjob',
  'blowjobs', 'rimjob', 'rimjobs', 'rimming', 'fellatio', 'cunnilingus',
  'buttfuck', 'buttfucker', 'buttplug', 'buttholes', 'butthole', 'fisting',
  'felch', 'felching', 'smegma', 'queef', 'queefs',
  'orgasm', 'orgasms', 'orgasmic', 'orgy', 'orgies', 'horny', 'erection',
  'erections', 'boinking',
  'porn', 'porno', 'pornos', 'pornography', 'hentai', 'nsfw', 'xxx',
  'whore', 'whores', 'whoring', 'slut', 'sluts', 'slutty', 'skank', 'skanks',
  'skanky', 'hooker', 'hookers', 'nympho', 'nymphos',
  'sodomy', 'sodomize', 'sodomise', 'bestiality', 'incest', 'molest', 'molests',
  'molested', 'molesting', 'molester', 'molesters', 'molestation', 'pedophile',
  'pedophiles', 'paedophile', 'paedophiles', 'pedo', 'rape', 'rapes', 'raped',
  'rapist', 'rapists', 'raping', 'turd', 'turds',
];

// Both tiers, exact forms.
export const ALL_TERMS = [...new Set([...SLURS, ...PROFANITY])];

const SLUR_SET = new Set(SLURS);
const ALL_SET = new Set(ALL_TERMS);

export function norm(token) {
  return String(token).trim().toLowerCase().replace(/[^a-z]/g, '');
}

/** Whole-token slur/hate match. Removed from EVERYTHING (accept + display). */
export function isSlur(token) {
  const t = norm(token);
  return t.length > 0 && SLUR_SET.has(t);
}

/** Whole-token match for ANY blocked term (slur OR profanity). Display gate. */
export function isBlockedForDisplay(token) {
  const t = norm(token);
  return t.length > 0 && ALL_SET.has(t);
}

/**
 * Category-answer gate (answers may be multiword). Blocks iff the WHOLE answer,
 * or the answer collapsed to one token, equals a blocked term — so multiword
 * innocents ("maine coon", "homo sapiens", "dick van dyke") survive while a
 * standalone slur/vulgar answer does not.
 *   scope: 'display' → any blocked term; 'accept' → slurs only.
 */
export function isBlockedAnswer(answer, scope = 'display') {
  const set = scope === 'accept' ? SLUR_SET : ALL_SET;
  const collapsed = norm(answer); // spaces + punctuation removed
  if (collapsed && set.has(collapsed)) return true;
  const words = String(answer).toLowerCase().split(/\s+/).map(norm).filter(Boolean);
  if (words.length === 1 && set.has(words[0])) return true;
  return false;
}

export const _internal = { SLUR_SET, ALL_SET, norm };
