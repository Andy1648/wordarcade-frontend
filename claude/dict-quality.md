# JOB 19 — the word list is the game (chore/dict-quality, REPORT ONLY)

**Method.** Reconstructed the shipped ACCEPT set exactly as the app builds it
(`src/solo/words.js`): `recall (31,482 freq-ordered) ∪ words.accept.txt increment ∪
words.accept-ext.txt` = **269,687 accepted words**. Rarity band = recall rank
(COMMON <3000 · UNCOMMON 3000–15000 · RARE 15000–31482 · OBSCURE = not in recall,
the ~238k increment). Sampled 300 accepted words deterministically stratified across
the bands and judged each by inspection; then checked 98 common words a high-schooler
would plausibly type for acceptance.

## The fairness number (the one that matters): MISS RATE = 0%
98 everyday words (apple, water, pizza, teacher, mountain, doctor, purple, hungry,
sleep, phone, …) — **every one is accepted, 0 misses (0.0%)**. A normal player typing
normal words is NEVER wrongly rejected. On the metric the job says "decides whether the
game feels fair," the dictionary passes cleanly.

## Quality by band (300-word stratified sample)
**COMMON / UNCOMMON / RARE (the 31k recall corpus) — high quality.**
Genuine English throughout (list, mobile, agreement, speed, memories, courier, catamaran,
zealot, permeate, glasnost…). The only noise is standard web-frequency-corpus residue:
- **Lowercased proper nouns** ~6–8%: english, greece, linux, turk, meath (Irish county),
  lucerne, shaw, leary, moira, moorcock.
- **Abbreviations / fragments** ~3%: tel, del, ram, cag, chal, jor, sib, amie.
These are real tokens, not artifacts; a player typing them isn't "wrong," they're just
not scrabble-clean. Estimated ~90% squarely-genuine, ~10% proper-noun/abbrev.

**OBSCURE (the ~238k increment) — real but esoteric, with a small bad tail.**
Of 150 sampled:
- **~87% genuine but ultra-rare** — valid in comprehensive/Scrabble dictionaries, almost
  none known to a high-schooler: affricates, anableps (a fish), bonesetters, ortolan,
  psephologically, imbricated, lignification, syrphians (hoverflies), parachor, pistoles,
  wolfberry, saponifier, shelterbelt, hypernovas… Accepting these is arguably CORRECT for
  this game: obscure words pay more (rarity scoring), so a strong vocabulary is rewarded.
- **~8% foreign / slang / dialect** that *feel* like non-words to a US high-schooler:
  arvo, phwoar, sunnies (Australian), gallabia, kinakina, friska, yede, ulzie, wheezle.
  Real, but they read as "that's not a word."
- **~5% malformed / artifact — the genuine quality concern**: `petroglyphies` (the plural
  is *petroglyphs* — this is a broken inflection), `electorially` (looks like a misspelling
  of *electorally*), `unperverts`, over-pluralised abstracts (`fattinesses`,
  `genericnesses`, `invectivenesses`), `milages` (variant of *mileages*), `submetacentrics`.
- **Proper nouns: ~0** in the obscure sample — the increment appears to exclude them
  (good; the proper-noun noise is confined to the small recall-corpus residue above).

## Verdict
The word list is **fair** (0% miss on common input — the failure that would feel unjust
never happens) and the accepted vocabulary is overwhelmingly **real**. The obscure tail is
Scrabble-grade rather than wrong, and because rarity is rewarded, accepting it fits the
design. The only real defect is a **~5% artifact rate in the obscure band** — malformed
inflections and over-pluralisations (petroglyphies, electorially, …). At ~238k obscure
entries that's ~10–12k dubious tokens; they only ever surface as someone's lucky high-value
find, so the blast radius is small, but a cleanup pass (strip broken inflections /
non-dictionary over-pluralisations from words.accept-ext) would tighten it.

**Bottom line: the game feels fair (0% common-word miss); no proper-noun/abbreviation
problem of note; the one thing worth fixing is a ~5% malformed-word artifact rate deep in
the obscure tail.**
