# Dict-safety audit — fix/dict-safety (both repos) — 2026-08-27

Child-safety pass for a PEGI-12 / school audience. Worst examples redacted (first
letter + length only). Branches: FE `fix/dict-safety` @37de7b7 off main; BE
`fix/dict-safety` @cdd2da0 off main. Both pushed. No prod deploy; no WS-protocol change.

## Blocklist
Authored `blockedTerms.js` (FE ESM canonical; BE CJS copy). Two tiers, LDNOOBW-modelled +
supplemented (the LDNOOBW raw fetch was refused by the WebFetch summarizer; an in-repo
deterministic list is required for a safety filter regardless).
- **SLURS: 127 forms** — racial/ethnic/religious/homophobic/transphobic/ableist. Policy: never
  accepted, scored, generated, or displayed → removed from EVERY asset.
- **PROFANITY/SEXUAL: 219 forms** — swearing + explicit anatomy/acts. Policy: a player may TYPE
  one (stays accepted) but the game never DISPLAYS/GENERATES one → removed from display assets.
Matching is EXACT whole-token (no stemming — avoids spicy←spic, spikes←spik, tardy←tard).
Ambiguous homographs deliberately omitted (niger=country, buckwheat/kraut=food, jerry/nancy=names,
dike=levee, mongol=people, nut/balls/hoe/knob=innocent, damn/crap/fart=PEGI-mild, anus/testicle=
clinical). Multiword category answers matched by WHOLE-ANSWER equality (protects "maine coon",
"homo sapiens", "sabo", "hooker"=rugby position).

## BEFORE (per asset; policy applied)
| Asset | Policy | Tokens | Slur hits | Profanity hits |
|---|---|---|---|---|
| FE words.accept.txt | accept (slurs only) | 56,349 | 27 | 17 (kept) |
| FE words.accept-ext.txt | accept (slurs only) | 181,897 | 25 | 4 (kept) |
| FE words.recall.txt (top-3k DISPLAY) | display | 31,500 | 7 | 11 |
| FE satRush/words.json (SAT DISPLAY) | display | 612 | 0 | 0 |
| FE fragmentPools.json (DISPLAY) | display | 1,026 | 0 | 1 (t\*\* len3) |
| BE botWords.txt (bot DISPLAY) | display | 14,543 | 8 | 58 |
| BE categoryAnswers (638 cats) | display | 44,673 | 0* | 0* |
| BE an-array-of-english-words (accept vocab) | accept (slurs only) | 274,937 | 102 | 403 (kept) |

\* after homograph correction; pre-correction false positives were hooker (rugby) and sabo (One Piece), both KEPT.

Redacted worst slur examples across assets: n\*\*\*\*\* (6), f\*\*\*\*\*\* (6), k\*\*\* (4),
s\*\*\*\* (5), c\*\*\*\* (5), w\*\* (3), r\*\*\*\*\*\* (8).

## AFTER — removed
- FE words.accept.txt: **27 slurs** removed; 11 recall-profanity **relocated in** (stays accepted, not shown).
- FE words.accept-ext.txt: **25 slurs** removed (asset stays sorted).
- FE words.recall.txt: **7 slurs + 11 profanity** removed (31,500 → 31,482).
- FE fragmentPools.json: **tit → ela** (replacement, equal difficulty: both 15 solutions). Sizes unchanged.
- BE botWords.txt: **8 slurs + 58 profanity** removed (14,543 → 14,477).
- BE acceptance gate (`dictionary.isValidWord`): now **rejects slurs before the cache** so the
  ~275k wordlist never accepts/scores a slur and `markAsValid()` can't bypass it. Profanity stays typeable.
- BE bot-pool cleaner (`wordFilter.filterWords`): now drops all blocked terms.

## Fragment pools re-validated
Every fragment across all four tiers has **≥4 solutions of length ≥4** in the cleaned top-6,000. ✓
No fragment depended solely on a removed word.

## Build-time guards added (job step 5)
- FE `src/moderation/generationAssets.test.js`: fails if recall / SAT / fragmentPools contain any
  blocked term, or if either accept list contains a slur.
- BE `dictSafety.test.js`: fails if botWords contains a blocked term; asserts the gate rejects slurs
  (incl. the markAsValid bypass) and that category accept-lists carry no slur.
- Build scripts (`build-words.mjs`, `build-accept-ext.mjs`) filter at generation for future hygiene.

Tests: FE 282 unit + build clean; BE 324. All green.
