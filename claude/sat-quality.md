# SAT Rush Vocabulary Quality Audit

**Job 6 — REPORT ONLY.** No product code was changed. Audit branch: `audit/sat-quality` off
`origin/main` (`b2b70fb`). New-word branch audited: `data/sat-words` (`9de4d4d`).
Date: 2026-08-29.

## 1. Data location & counts (verified, not assumed)

The SAT Rush word list is a single JSON file:

    src/data/satRush/words.json

(Loaded by `src/satRush/wordSchema.test.js` and the engine; each row is
`{ word, pos, tier, gloss, context, root, alts }`. `gloss` = the definition,
`context` = the example sentence with the answer blanked as `___`.)

Parsed with `JSON.parse` (the file is minified single-line on `data/sat-words`, pretty-printed
on `main` — a raw `grep -c '"word"'` is misleading, so counts below are from `.length`):

| Branch | Entries |
|---|---|
| `main` (`b2b70fb`) | **612** |
| `data/sat-words` (`9de4d4d`) | **956** |
| Added by `data/sat-words` (unique new words) | **344** |
| Removed vs main | **0** |
| Overlap (identical word keys) | 612 |

So `data/sat-words` is a pure superset: all 612 main words are retained and **344 net-new words**
are added. (The task's "~956 / ~612 / 344" estimates are confirmed exactly.)

Tier spread — added words skew to the mid/hard tiers, which is where error risk is highest:

| Tier | main | new-unique (344) |
|---|---|---|
| 1 | 129 | 0 |
| 2 | 129 | 29 |
| 3 | 148 | 146 |
| 4 | 113 | 149 |
| 5 | 93  | 20 |

## 2. Methodology

- **Sampling.** 100 words total: **50 from the 344 new-unique words** and **50 from main**.
  Each sample is stratified across tiers proportionally to that set's tier distribution
  (deterministic mulberry32 RNG, seeds 67890 / 12345, shuffle-within-tier) so the sample is a
  spread, not just easy tier-1 words. The main sample spans tiers 1–5 (10/11/12/9/8); the
  new-word sample spans tiers 2–5 (4/21/22/3), matching where the new words actually live.
- **Verification.** Each word's `gloss` and `context` were checked for: (a) is the definition
  correct and the SAT-relevant sense? (b) does the example sentence use the word in that sense
  correctly? Every one of the 100 was assessed against standard dictionary definitions. The
  **highest-risk cases** — contronyms, verbs-that-are-also-adjectives, words with a
  literal-vs-figurative split, and rare tier-5 nouns — were additionally **verified live** via
  web search against Merriam-Webster / Collins / Dictionary.com / Cambridge. The 12 live-checked
  words were: *deprecate, anodyne, reprove, apotheosis, abecedarian, jejune, inimical, pellucid,
  sanction, morass, diffuse* (+ cross-checks). **All 12 corroborated the shipped gloss/context.**
- **Verdict codes.** OK / DEFINITION-WRONG / SENSE-OFF / EXAMPLE-WRONG.

### Verification limitation (read this)

Merriam-Webster returns HTTP 403 to direct `WebFetch`, so live checks used WebSearch result
snippets (which quote MW/Collins/Dictionary.com definitions) rather than fetched dictionary
pages. 12 of 100 were verified this way end-to-end; the remaining 88 were judged against standard
lexical knowledge without a per-word live fetch. No sampled word contradicted a dictionary on
either the live-checked subset or the knowledge pass, so the two methods agree where they overlap
— but the headline "0 errors" is strongest for the 12 live-checked words and should be read as
"no error surfaced" for the other 88, not "independently dictionary-confirmed."

## 3. Results — the 100 sampled words

### 3a. New words (unique to `data/sat-words`) — 50 sampled

| # | Word | POS/Tier | Verdict | Note |
|---|---|---|---|---|
| 1 | yield | v t2 | OK | "give way / surrender / produce"; ctx uses give-way sense (roof yields). |
| 2 | implore | v t2 | OK | beg desperately. |
| 3 | pinnacle | n t2 | OK | highest point. |
| 4 | jargon | n t2 | OK | specialized in-group language. |
| 5 | larceny | n t3 | OK | the crime of theft. |
| 6 | rebut | v t3 | OK | argue against / disprove. |
| 7 | confound | v t3 | OK | confuse or baffle. |
| 8 | putrid | adj t3 | OK | rotten, foul-smelling. |
| 9 | maxim | n t3 | OK | short rule-stating saying. |
| 10 | sporadic | adj t3 | OK | irregular, scattered in time. |
| 11 | evoke | v t3 | OK | call forth a feeling/memory. |
| 12 | denounce | v t3 | OK | condemn openly. |
| 13 | rectify | v t3 | OK | correct / set right. |
| 14 | libel | n t3 | OK | damaging false *written* statement (vs slander/spoken) — correct. |
| 15 | opportune | adj t3 | OK | well-timed. |
| 16 | diffuse | v t3 | OK | verb = spread/scatter; ctx "smell diffuse through house". Live-checked. |
| 17 | precipice | n t3 | OK | edge of a steep cliff. |
| 18 | incongruous | adj t3 | OK | out of place, not fitting. |
| 19 | insatiable | adj t3 | OK | impossible to satisfy. |
| 20 | tepid | adj t3 | OK | lukewarm; unenthusiastic. |
| 21 | precocious | adj t3 | OK | mature ability at an early age. |
| 22 | relent | v t3 | OK | give in after refusing. |
| 23 | sanction | v t3 | OK | approval sense; ctx "refuse to sanction the plan" uses it right. Live-checked (contronym). |
| 24 | laud | v t3 | OK | praise highly. |
| 25 | levity | n t3 | OK | lack of seriousness / light humor. |
| 26 | gaffe | n t4 | OK | embarrassing social blunder. |
| 27 | salient | adj t4 | OK | most noticeable/important. |
| 28 | protract | v t4 | OK | draw out / lengthen in time. |
| 29 | exhort | v t4 | OK | strongly urge. |
| 30 | demur | v t4 | OK | voice objection/hesitation. |
| 31 | grovel | v t4 | OK | behave servilely / cringe. |
| 32 | deprecate | v t4 | OK | "express disapproval / belittle"; MW lists both, incl. self-deprecating belittle sense. Live-checked. |
| 33 | gratuitous | adj t4 | OK | uncalled-for, without good reason. |
| 34 | acumen | n t4 | OK | keen judgment / sharp insight. |
| 35 | serendipity | n t4 | OK | happy accident / lucky find. |
| 36 | adulation | n t4 | OK | excessive flattery/worship. |
| 37 | repugnant | adj t4 | OK | causing strong disgust. |
| 38 | morass | n t4 | OK | confusing tangled situation (figurative sense); literal = marsh. Live-checked. |
| 39 | overwrought | adj t4 | OK | extremely agitated/overexcited. |
| 40 | propriety | n t4 | OK | correct/proper behavior. |
| 41 | xenophobia | n t4 | OK | fear/hatred of foreigners. |
| 42 | emanate | v t4 | OK | flow out / issue from a source. |
| 43 | eulogy | n t4 | OK | speech of high praise (often for the dead). |
| 44 | reprove | v t4 | OK | scold/correct *usually gently* — MW's own wording. Live-checked. |
| 45 | trepidation | n t4 | OK | fear/nervous dread before something. |
| 46 | extol | v t4 | OK | praise highly. |
| 47 | rife | adj t4 | OK | widespread; "rife with" = full of (usually bad). Ctx correct. |
| 48 | probity | n t5 | OK | complete honesty/integrity. |
| 49 | jingoism | n t5 | OK | aggressive boastful patriotism. |
| 50 | vaunt | v t5 | OK | boast about / show off. |

**New-word sample: 50/50 OK, 0 problems.**

### 3b. Main words — 50 sampled

| # | Word | POS/Tier | Verdict | Note |
|---|---|---|---|---|
| 1 | coarse | adj t1 | OK | rough in texture; crude. |
| 2 | taunt | v t1 | OK | provoke with mockery. |
| 3 | crave | v t1 | OK | want intensely. |
| 4 | conceal | v t1 | OK | hide from view. |
| 5 | abstain | v t1 | OK | hold off / refrain. |
| 6 | tenacious | adj t1 | OK | holds on, won't quit. |
| 7 | grim | adj t1 | OK | harsh/gloomy/forbidding. |
| 8 | pensive | adj t1 | OK | quietly lost in thought. |
| 9 | vigilant | adj t1 | OK | watching closely. |
| 10 | dormant | adj t1 | OK | inactive but not dead. |
| 11 | notorious | adj t2 | OK | famous for something bad. |
| 12 | decorum | n t2 | OK | occasion-appropriate behavior. |
| 13 | inundate | v t2 | OK | flood/overwhelm. |
| 14 | incite | v t2 | OK | stir up / provoke to action. |
| 15 | pungent | adj t2 | OK | sharply strong in smell/taste. |
| 16 | meander | v t2 | OK | wind slowly with no fixed goal. |
| 17 | endorse | v t2 | OK | publicly approve/back. |
| 18 | eminent | adj t2 | OK | famous and respected. |
| 19 | morose | adj t2 | OK | gloomy and bad-tempered. |
| 20 | magnanimous | adj t2 | OK | big-hearted, esp. toward a beaten rival. |
| 21 | exemplary | adj t2 | OK | outstandingly good; a model. |
| 22 | tacit | adj t3 | OK | understood without being said. |
| 23 | indolent | adj t3 | OK | comfortably lazy. |
| 24 | umbrage | n t3 | OK | offense taken (take umbrage). |
| 25 | incandescent | adj t3 | OK | glowing white-hot. |
| 26 | inimical | adj t3 | OK | harmful/adverse to; ctx "inimical to deep thinking". Live-checked. |
| 27 | culpable | adj t3 | OK | deserving blame. |
| 28 | clandestine | adj t3 | OK | secret, concealed. |
| 29 | expurgate | v t3 | OK | cut objectionable parts from a text. |
| 30 | flippant | adj t3 | OK | disrespectfully lighthearted. |
| 31 | invective | n t3 | OK | a flood of harsh insulting language. |
| 32 | intrepid | adj t3 | OK | fearless, bold. |
| 33 | coalesce | v t3 | OK | come together into one mass. |
| 34 | jettison | v t4 | OK | cast off / dump as excess. |
| 35 | pellucid | adj t4 | OK | transparent, clear. Live-checked. |
| 36 | apostate | n t4 | OK | one who forsakes former faith/loyalty. |
| 37 | parsimonious | adj t4 | OK | excessively unwilling to spend. |
| 38 | impecunious | adj t4 | OK | broke, penniless. |
| 39 | anodyne | adj t4 | OK | so bland/inoffensive nobody objects. Live-checked. |
| 40 | petulant | adj t4 | OK | childishly irritable/sulky. |
| 41 | assiduous | adj t4 | OK | diligent, works at it tirelessly. |
| 42 | ascetic | adj t4 | OK | severely self-denying. |
| 43 | tautological | adj t5 | OK | says the same thing twice / circular. |
| 44 | abecedarian | n t5 | OK | rank novice learning the rudiments. Live-checked. |
| 45 | grandiloquent | adj t5 | OK | pompous, inflated language. |
| 46 | recondite | adj t5 | OK | obscure; understood by few. |
| 47 | jejune | adj t5 | OK | dull/insipid AND naive/immature — both dict senses. Live-checked. |
| 48 | lugubrious | adj t5 | OK | exaggeratedly gloomy/mournful. |
| 49 | mendicant | n t5 | OK | a beggar living on handouts. |
| 50 | apotheosis | n t5 | OK | highest point / culmination. Live-checked. |

**Main sample: 50/50 OK, 0 problems.**

## 4. Error rates

| Set | Sampled | Problems | Error rate |
|---|---|---|---|
| `data/sat-words` new-unique words | 50 | 0 | **0.0%** |
| `main` words | 50 | 0 | **0.0%** |

**Statistical bound.** 0 errors in 50 samples is not proof of a flawless list. By the rule of
three, the 95% upper confidence bound on the true error rate is ≈ 3/50 = **~6%** for each set. So
the honest read is: *the new-word error rate is very likely under ~6%, and no error was found in a
tier-weighted sample of 50.* Extrapolated worst case that would still be consistent with this
sample: up to ~20 of the 344 new words could carry a subtle sense/example issue; the point
estimate is 0.

## 5. Worst offenders

None. No sampled word (new or main) was rated DEFINITION-WRONG, SENSE-OFF, or EXAMPLE-WRONG.

The words most *likely* to have been offenders — and the reason each was singled out for a live
dictionary check — were the contronym **sanction**, the belittle/disapprove split on
**deprecate**, the verb-vs-adjective **diffuse**, the literal-vs-figurative **morass**, and the
"gently"-qualified **reprove**. Every one of these held up: the shipped gloss picks the
SAT-relevant sense and the example sentence uses that exact sense. The list's authoring quality is
high — glosses are plain-English but precise, and each `context` is written to force the intended
sense (helped by the `wordSchema.test.js` contract that already blocks the word/synonyms from
leaking into its own sentence).

## 6. Recommendation

**The 344 new words are SAFE TO MERGE on vocabulary-quality grounds.** Measured new-word error
rate is 0% over a 50-word tier-spread sample, with a ~6% statistical ceiling; the highest-risk
nuance cases were live-verified against dictionaries and all passed. The new set is a clean
superset of main (0 words removed, all 612 retained), so merging adds words without disturbing
existing content, and the existing `wordSchema.test.js` structural contract still guards the
format.

Caveats for the merge owner (none blocking):
1. This is a **sample**, not a census — 50 of 344 new words were checked. If zero-defect vocab is
   required before shipping (this is learning content shown as fact), a full pass of all 344
   glosses/contexts is cheap insurance; the 0% sample rate says that pass would find few if any
   issues.
2. 12 of 100 were verified end-to-end against live dictionary snippets (MW blocks direct fetch);
   the other 88 rested on lexical knowledge. The two agreed everywhere they overlapped.
3. Standard pre-merge hygiene: run `npm test` so `wordSchema.test.js` validates all 956 rows
   (alt-length invariant, one-blank-per-context, no 5-char self-leak). That is a structural gate,
   not a semantic one — it does not check definition correctness, which is what this audit covers.

## Appendix — reproducibility

- Files compared: `git show origin/main:src/data/satRush/words.json` vs
  `git show data/sat-words:src/data/satRush/words.json`.
- Counts and set diff via `JSON.parse(...).length` and a `Set` of the `word` keys.
- Samples: stratified-by-tier, mulberry32 seeds 67890 (new) / 12345 (main), shuffle-within-tier,
  proportional allocation to 50. The exact 100 words are listed in §3.
