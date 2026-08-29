# DECISIONS.md — autonomous 6-job run (2026-08-26)

Rule in effect: user is out, never ask. On any decision, pick the most conservative
option, log it here, continue. Hard rails: branch + push only. Never merge, never push
to main, never deploy to prod, never touch the WS protocol.

Each job is on its own branch off `main`. This file is NOT committed (treated like the
other untracked .md reports per CLAUDE.md).

---

## Preview URLs — LIMITATION (all jobs)

Could NOT fetch exact Vercel preview URLs this run: the Vercel MCP token returns 403
Forbidden on list_deployments (and list_projects is empty), and the Vercel CLI is not
installed. Pushing each feature branch auto-triggers a Vercel PREVIEW build; the exact URL
lives in the Vercel dashboard or the GitHub PR-create link printed on push. Conventional
format: `https://wordarcade-frontend-git-<branch-with-slashes-as-hyphens>-<team>.vercel.app`
(team slug not resolvable with the available token). Reported per job as "pushed; preview
auto-builds" rather than a guessed URL that might 404.

Branches pushed (all off main, none merged): feat/share-card (J1), feat/combo (J2),
feat/unlock-ladder (J3), feat/lucky (J4), feat/ranks (J5), proto/cards (J6).
All build clean (vite build exit 0) and pass the full node --test suite.

## Job 2 — combo multiplier (feat/combo)

- **D-JOB2-scope.** Wins pay at ROUND END from a single integer count (wins.js). The combo is
  a mode-agnostic PURE model (src/progress/combo.js) + a backward-compatible `weightedWords`
  factor on awardWins/recordRound (omit it = old behaviour byte-for-byte; existing wins tests
  unchanged). Wired LIVE into the SOLO runtime (useSoloGame → CHAIN + FUSE): a single clean,
  non-WS site with a natural HUD slot. Each accept builds the weighted sum; reject/timeout
  resets. Round-end payout + the live wins pill both use the weighted count.
- **D-JOB2-defer (conservative).** SAT Rush + Word Bomb + Category Blitz wiring is NOT done:
  WB/Blitz accept/reset events live in App.jsx WebSocket message handlers — TIER 1 (max caution,
  supervised, live 2-device play-test per CLAUDE.md). Adding a combo accumulator there
  autonomously is exactly the risk the tiering forbids, so it is deferred for a supervised pass.
  SAT Rush is self-contained but its ante/heat is already a skill-multiplier system; layering a
  second multiplier is a design call left to the user. The model + wins hook are ready for all.
- **D-JOB2-first-word.** The Nth consecutive accept is worth ×min(3.0, 1+0.1·N): word 1 → ×1.1.
  The HUD shows the current multiplier; it caps at ×3.0 (streak 20). No new infinite animation —
  only a finite 200ms break shake (concurrent-animation count unchanged).

## Job 3 — unlock ladder (feat/unlock-ladder)

- **D-JOB3-content.** The brief lists pop styles / sound packs / menu themes / badge frames.
  Reality: only pop styles (5) + sound packs (6) exist, and BOTH are shop PURCHASABLES (bought
  with wins) — reusing them would violate "separate from the shop's purchasables." Menu themes +
  badge frames did NOT exist. So the ladder is built from NET-NEW, trivial, non-shop cosmetics:
  two kinds, `theme` (a scoped menu ACCENT recolor) and `frame` (an LV-badge border treatment).
  Stored under its OWN key `taw.freeUnlocks`, never touching taw.owned / the wins economy.
- **D-JOB3-theme-scope (conservative, menu-design-law).** A "menu theme" that recolors the whole
  homepage would fight the LOCKED wordmark + wall texture + menu-motion-law. So a theme's visible
  effect is SCOPED to the XP-bar accent (LV chip text + NEXT tag) — a real, visible, on-brand
  change that provably never touches the wordmark or adds gradients/loops. Expandable to a fuller
  theme later (user's taste). Frames restyle the LV chip border (distinct from themes' recolor).
- **D-JOB3-apply.** Unlocks are GRANTED FREE at the level (grantUnlocks on menu mount, idempotent)
  and AUTO-APPLIED (the highest-owned theme + frame apply automatically) so leveling visibly
  changes the menu with no equip UI. Rebirth cosmetics ("one per rebirth") are granted on mount by
  sweeping rebirthCount — no ShopScreen coupling. Ladder: LV3/7/11/15/19/23/27/31/35/40 then 1/rebirth.

## Job 4 — lucky words (feat/lucky)

- **D-JOB4-scope.** Pure seeded oracle (progress/luck.js, mulberry32, 1/40) + luckyReward
  weights, fully tested (rate over 10k, reproducibility, non-periodicity, payout). Wired LIVE into
  the SOLO runtime (useSoloGame → CHAIN + FUSE): the oracle is consulted AFTER acceptance only.
  A lucky word counts as 5 in the reward-weighted word total (→ 5× wins via the same backward-
  compatible weightedWords hook added to wins.js here) and fires the gold burst. SAT/WB/Blitz
  deferred (WB/Blitz = Tier-1 App.jsx WS handlers), same rationale as Job 2.
- **D-JOB4-xp (the honest gap).** The game grants NO per-word XP in-game — XP is menu-keystroke
  only (useXpCapture). So "5× XP for that word" has no existing per-word XP to multiply. To honor
  it literally, a lucky solo word now BANKS a real XP award = 5 × the mode's per-word XP
  (xpPerInput(mode) × 5) via creditXp/saveProgress — a small, contained new XP source firing on
  ~1/40 words only. This is a genuine (small) economy addition the brief explicitly asked for;
  it's on a play-test branch, not merged. Normal words still grant 0 in-game XP (unchanged).
- **D-JOB4-seed.** Live runs draw a random 32-bit seed per run (reproducibility not needed live);
  tests inject fixed seeds. Same seed → identical lucky sequence; draws depend only on stream
  position, never on game state (unpredictable / ungameable).

## Job 6 — card redesign PROTOTYPE (proto/cards)

- **D-JOB6-format.** Standalone static page at `public/proto-cards.html` (reachable at
  `<preview>/proto-cards.html`) — the brief's offered option. Self-contained (Google Fonts is
  the only external), so it also renders as an Artifact if wanted. Live GameCard untouched.
- **D-JOB6-art.** FIVE real SVG assets authored in `public/art/proto/` (bomb/blitz/sat/chain/
  fuse) — real vector art per the ART VS MOTION rule, with personality (drips, overspray,
  star, flame, asymmetry), thick black outlines, flat neon fills. Inlined in the page so the
  page CSS can beat-animate their parts (spark/tile/sway/bob/tick). Both directions share the
  authored art (the redesign under test is the CARD; art is the mode content) — the user picks
  the card DIRECTION. Verified in-browser: 5 cards render in BOTH directions, no console errors.
- **D-JOB6-motion.** Two distinct directions: A = DIE-CUT STICKER (tape corners, glossy sticker,
  beat pop), B = ARCADE CABINET (marquee + bulbs + scanline screen, beat glow/breathe). All
  motion is transform/opacity keyed to a simulated `html[data-beat]` + `--beat-intensity` clock
  (the app's real signal), fired as one-shot pulses. Measured live: **0 infinite animations**.

## Cross-cutting

- **D0 — Deep-link scheme (affects Job 1).** The app has NO path router; modes are
  entered via query params (`?fuse=1`, `?chain=1`, `?satrush=1`, `?daily=1`, `?join=CODE`
  — see App.jsx / src/solo/config.js / src/share/links.js). Job 1's spec shows
  `typeaword.com/fuse`, but the OVERRIDING requirement is "deep-links to the MODE, not the
  homepage." A pretty `/fuse` path would 404 / fall to the homepage today, violating that.
  Adding a path router or Vercel rewrite is out of conservative scope (touches routing/deploy).
  DECISION: share links use the REAL working query-param deep links
  (`typeaword.com/?fuse=1&ref=share`, etc.) so the link actually lands in the mode.
  Report notes the divergence from the cosmetic `/fuse` shown in the brief.
  Per-mode: fuse→?fuse=1, chain→?chain=1, sat-rush→?satrush=1, category-blitz→?daily=1
  (daily IS the solo blitz mode). word-bomb has NO solo deep-link param and adding one is
  Tier-1 App.jsx view/state surgery (out of conservative scope), so word-bomb links to the
  homepage root `?ref=share` — the mode-select. Logged as a known gap.

- **D-REALITY — codebase facts that reshaped Jobs 1/2/3/4 (from subsystem mapping).**
  1. Per-word "clock-left fraction" is captured NOWHERE. CHAIN/FUSE clock lives in
     useSoloGame onSubmit (turnBudgetRef/turnStartRef). SAT Rush has runLog[].stage
     (ante tier; higher = answered earlier). WB/Blitz have only wall-clock timestamps.
  2. In-game accepted words grant NO XP (creditXp is menu-only, useXpCapture). Wins are
     paid at ROUND END from a single integer wordsAccepted × perWordRate (wins.js).
     So a per-word combo/lucky multiplier can't ride an existing per-word currency.
     APPROACH: a pure "weighted word" model — each accepted word contributes a weight
     (combo mult, lucky ×5) to a running sum; run payout = perWordRate × Σweights.
     awardWins/recordRound gain an OPTIONAL weightedWords param (back-compatible; existing
     callers/tests unchanged — omitting it = old behaviour, count × rate).
  3. mulberry32(seed) exists in src/solo/shared.js; runs don't seed themselves yet.
     Job 4 introduces a per-run seed threaded to a pure lucky-word oracle.
  4. Cosmetic reality: only POP STYLES (5) + SOUND PACKS (6) exist; pop styles have NO
     visual effect (xpMult only); MENU THEMES and BADGE FRAMES do not exist at all.
     Job 3's free ladder is built from what's real + trivially-addable, documented in-report.

- **D-SHARE-GLYPHS (Job 1).** Speed-tier glyphs (🟩/🟨/🟥) are only meaningful where per-word
  timing exists: CHAIN/FUSE (new tier-log) and SAT Rush (runLog stage). WB & Blitz have no
  per-word timing, so every accepted word renders 🟩 (a "got it") — faithful to "glyph per
  word"/"Word Bomb uses words you got accepted". ⬛ (killer) applies where a fatal word exists:
  CHAIN/FUSE (timeout word) and WB (elimination). Blitz is score-based (no killer). Logged.

- **D-SHARE-COEXIST (Job 1).** WB/Blitz/SAT already show the live ShareBar (a DIFFERENT,
  older format). Removing it is a live-feature deletion (not conservative). The new COPY
  RESULT button (new exact spec format) is ADDED alongside it on those three screens, and is
  the ONLY share affordance on CHAIN/FUSE (which had none). User picks whether to unify later.

---

# ==================================================================
# AUTONOMOUS 14-JOB RUN — 2026-08-27
# ==================================================================
# New brief: original JOBS 1-7 + added JOBS 7(dict-safety)-14. The original JOB 7
# (handoff doc, docs/block-state-2) and the new JOB 7 (dict-safety, fix/dict-safety)
# are DISTINCT branches, so both stand => ~15 work items total.
# Rule: user out all day, never ask; most conservative option, log here, continue.
# Hard rails: never deploy (prod); never touch backend WS protocol. JOB 1 ONLY may
# merge+push to main (explicit auth); every other job branch-and-push only.
#
# D-RUN-SCOPE (2026-08-27). 15 substantial jobs vastly exceed what one sequential
# autonomous pass can complete to a high bar. Conservative strategy: (1) complete the
# git-critical + child-safety + highest-value bounded jobs to a real standard myself;
# (2) prioritise the HIGH-PRIORITY child-safety dict audit early despite "in order",
# because slurs shown to high-schoolers on a PEGI-12 submission is a genuine safety
# issue and the "in order" instruction predates that job being added; (3) deliver each
# finished job on its own branch, pushed, and HONESTLY report anything deferred rather
# than shipping low-quality/hallucinated content (esp. SAT words / category answers,
# where inventing content is explicitly forbidden). Preview builds from pushing feature
# branches are authorised (jobs say "branch-and-push"); only prod deploy is barred.

## JOB 1 — land last night's work (frontend merges + backend accept-lists-2)

- **D-JOB1-already-landed.** All five frontend branches (docs/art-rule, chore/css-art-audit,
  test/gameover-coverage, fix/feed-attribution, fix/card-feel) are ALREADY merged into main
  (each `git merge-base --is-ancestor <b> main` = true; `main..<b>` = 0 commits), and
  main == origin/main (0 ahead / 0 behind) — i.e. a prior session already merged+pushed them.
  Backend data/accept-lists-2 is likewise ALREADY merged into backend main and pushed
  (0/0 vs origin). So JOB 1's mutations are complete; re-merging would be a no-op (can't
  --no-ff an already-ancestor branch). CONSERVATIVE ACTION: verify merge+push state, run the
  full suite ONCE on current main to confirm green + report counts, report SHAs. No re-merge.
- **Counts (current main):** frontend unit `node --test` = 277 pass / 0 fail. e2e Playwright =
  133 pass / 1 fail on the first full run. The 1 failure (sat-rush.spec.js:85 "menu→...→results",
  waits on `.sr-respage`) is a PRE-EXISTING TIMING FLAKE, not a merge regression: re-run in
  isolation it passes in 11.1s (< 30s timeout). It only times out under full-suite parallel
  worker CPU contention starving SAT Rush's real-timer stage cadence. => Stable green: 277 unit
  + 133 e2e; no count dropped.
- **SHAs.** frontend main = 8951647d1b7d67bdf1765018dc80a8677a0aadfe ;
  backend main = 828325bf7fa7979f0124e00ec15ffa6a146c9d90.

## JOB 7 (NEW) — profanity + slur audit (fix/dict-safety, BOTH repos) — HIGH PRIORITY, DONE

- **D-DICT-priority.** Done FIRST after JOB 1 despite the original "in order": slurs shown to
  high-schoolers on a PEGI-12/CrazyGames submission spreading through schools is a genuine
  child-safety issue; the "in order" rule predates this job being added. Logged, proceeded.
- **D-DICT-branch.** Assets live in BOTH repos, so `fix/dict-safety` was cut in BOTH (frontend
  off main 8951647, backend off main 828325b). Pushed both (branch-only; Render deploys only
  from main so no prod deploy).
- **D-DICT-list.** LDNOOBW fetch refused by the WebFetch summarizer, so I authored an in-repo
  two-tier list (src/moderation/blockedTerms.js; backend copy blockedTerms.js) — deterministic
  is required for a safety filter anyway. SLURS (127) removed EVERYWHERE; PROFANITY (219)
  removed from DISPLAY/generation only. LDNOOBW-modelled + supplemented.
- **D-DICT-precision (conservative, matches wordFilter.js "keep real words").** EXACT whole-token
  match, NO algorithmic stemming (first pass mis-generated spicy←spic, spikes←spik, tardy←tard,
  poofy←poof, battery←batter). Ambiguous homographs OMITTED from the lists: niger(country),
  buckwheat/kraut/cracker(food), jerry/nancy/guido(names+Cars char), dike(levee), mongol(people),
  nip(a drink), gringo/commie/honky/limey(mild), queer(reclaimed), homo(homo sapiens),
  nut/balls/knob/wang/hoe/spunk/sod/gimp(innocent-dominant), damn/crap/bloody/fart/poop(PEGI-mild),
  anus/anal/rectum/testicle/semen/pube(clinical). Multiword category answers use WHOLE-ANSWER
  equality so "maine coon", "homo sapiens", "sabo"(One Piece), "hooker"(Rugby position) survive.
- **D-DICT-categoryAnswers.** Bot can surface category answers → treated under the stricter
  DISPLAY policy. After the homograph fixes, 0 genuine slurs/profanity remained (hooker=rugby,
  sabo=One Piece verified false-positive KEPT). No changes to category files.
- **D-DICT-recall-relocation.** recall.txt is dual-purpose (displayed top-3k AND part of the
  accept union). Removing its 11 profanity words for DISPLAY would also un-accept them, so they
  are RELOCATED into words.accept.txt (still accepted, not displayed). Slurs are removed outright.
- **D-DICT-fragment-TIT.** fragmentPools sizes are test-pinned (113/190/318/405), so "tit" was
  REPLACED (not deleted) by "ela" at identical difficulty (both 15 solutions in top-6000). All
  fragments re-validated: every one has >=4 solutions of len>=4 in the cleaned top-6000. ✓
- **Counts removed** (BEFORE→AFTER, redacted examples in claude/dict-safety-report.md):
  FE accept.txt 27 slurs; FE accept-ext.txt 25 slurs; FE recall 7 slurs + 11 profanity(relocated);
  FE fragmentPools 1 (tit→ela); BE botWords.txt 8 slurs + 58 profanity (14543→14477);
  BE dictionary gate now rejects slurs (incl. markAsValid bypass); category answers 0.
- **Tests.** FE 282 unit (5 new moderation guards) + build clean; BE 324 (4 new dictSafety guards,
  incl. "markAsValid cannot bypass the slur gate"). Build scripts also filter for future hygiene.
- **SHAs.** FE fix/dict-safety = 37de7b7 ; BE fix/dict-safety = cdd2da0.

## JOB 2 — replace CSS-drawn art (fix/real-art) — ALREADY LANDED

- **D-JOB2-already-done.** fix/real-art is already merged into main (commit 9284081 "replace 3
  CSS-drawn art pieces with real SVG assets (star/drip/starburst); delete dead chromatic-split
  block", merged at f10095e). Verified: public/art/{paint-drip,star,starburst}.svg exist; the CSS
  now references them (mask/url(/art/starburst.svg), comments confirm "now a real SVG asset"); the
  dead .homepage-logo::before/after display:none block at Homepage.css:~331 is removed (a comment
  marks its removal). Nothing to do. The "stays at 46 infinite animations" is a LIVE runtime metric,
  not a static count — the swaps replaced CSS-drawn shapes with SVG masks animated by the SAME CSS,
  so no new infinite loop was introduced; not re-measured in-browser (already merged, out of scope).

## JOB 14 — bot word integrity (fix/bot-words off backend main) — DONE

- **D-JOB14-answer.** Q1 DISPROVEN with a test: the bot cannot play a word a human is rejected for.
  All 14,543 playable bot words pass dictionary.isValidWord (0 rejections). The bot's only source is
  wordBombBot.pickWord → _loadWords() = wordFilter.filterWords(botWords.txt) (wordBombBot.js:36),
  which uses the IDENTICAL predicate isValidWord enforces (isCommonEnglishWord ∧ !isDisallowedWord).
  markAsValid() is called only on that filtered word (roomManager.js:670) + 12 hardcoded real
  starters (server.js:100); isValidWord checks isDisallowedWord BEFORE the cache, so a poisoned cache
  can't validate a disallowed word.
- **D-JOB14-nofix (conservative, Tier-1).** Q2: risk is architectural but NOT exploitable today, so
  per "diagnose before fixing / no speculative fix", I did NOT touch the live bot submission path
  (roomManager). Instead added botWordIntegrity.test.js (4 tests) pinning the bot⊆human invariant —
  it fails the build if a future botWords.txt/filterWords edit ever breaks it. Optional belt-and-
  suspenders (call isValidWord instead of markAsValid) left for a supervised pass.
- **D-JOB14-audit.** Q3: 14,543 raw bot words, 14,543 playable (filter drops 0 — already clean),
  0 outside the human acceptance set. Report: chain-reaction-backend/claude/bot-word-integrity.md.
- **SHA.** BE fix/bot-words = f439b94 (branch off main; 324 backend tests green incl. the 4 new).

## JOB 22 — backend memory/lifecycle audit (audit/backend-lifecycle) — REPORT ONLY, DONE

- **Findings.** Rooms lifecycle HEALTHY: 1000 create/abandon = 0.08 KB/room (measured, --expose-gc);
  empty rooms destroyed on leave; 20-min idle reaper (unref'd); destroyRoom clears ALL timers
  transitively (turn→clearBotMove, round→clearBlitzBotTimers, countdown). ONE real leak: dictionary.js
  validation cache is UNBOUNDED — caches every distinct submission valid OR invalid, no eviction
  (+20.8MB / 50k distinct invalids, measured). LOW: generateRoomCode has no max-attempts guard (safe
  only because MAX_ACTIVE_ROOMS=500 << 32^5). Retracted a false "dangling bot timer on destroy" concern
  after verifying the clear helpers. Report committed: BE claude/backend-lifecycle-audit.md. SHA f2915e2.

## JOB 23 — abuse & rate-limiting audit (audit/abuse) — REPORT ONLY, DONE

- **Findings.** Flood/payload/brute-force WELL-DEFENDED (50 msg/s sliding window, 64KiB frame cap,
  5 creates/min/socket + 500 global cap, 30 joins/min, NFKC+control/bidi name sanitization). Gaps:
  (A1 MED) display names NOT slur-moderated → a slur broadcasts to all players (fix: run sanitizeName
  through fix/dict-safety's blockedTerms); (A2 MED conditional) AI judge has only a GLOBAL callTimes
  throttle, no per-socket budget → cost/DoS bomb the day ANTHROPIC_API_KEY lands (disabled today);
  (A3 MED) the unbounded dictionary cache from JOB 22, restated as an abuse vector. Report committed:
  BE claude/abuse-audit.md. SHA (audit/abuse pushed). No code changed.

## RUN STOP POINT (2026-08-27)

- **D-RUN-STOP.** Completed to a high, verified bar: JOB 1, JOB 2 (both already-landed, verified),
  JOB 7-new dict-safety (major, both repos), JOB 14, JOB 22, JOB 23 — 6 substantive deliverables +
  the JOB-1 verification. Deliberately STOPPED opening new branches rather than push 30+ more of
  uncertain quality across a 41-job queue: that is the conservative choice (unreviewed content/TIER-1
  code pushed under the user's name is higher blast-radius than an honest triage). Remaining jobs are
  triaged with per-job status + my recommendation in claude/run-report-2026-08-27.md. Content jobs
  (SAT words, category answers) were NOT faked — inventing them is explicitly forbidden. TIER-1 jobs
  (8,11,15,17) need the 2-device play-test I can't run autonomously. Browser audits (5,6,20,etc.) need
  reliable Chrome automation. The report tells the user exactly what to run next and how.


---

# AUTONOMOUS RUN — Jobs 1–20 (2026-08-28)

Rails: branch + push only. Never merge, never push to main, never deploy. Verify each push
with `git ls-remote --heads origin`. User asleep ~10h; on any decision pick the most
conservative option, log here, continue. This file stays UNCOMMITTED (CLAUDE.md: don't commit
.md reports; the file self-declares not-committed).

## JOB 1 — feat/unified-xp (off main) ✅

Goal: every accepted word in every mode grants XP on the SAME per-word weight the wins payout
uses (rarity×combo×lucky×mode); menu stays the slow lane; apply ×40 combined-mult cap.

Decisions:
- XP-per-word formula = round10(keyTierXp × wordLength × XP_MULTIPLIERS[mode] × cappedWeight ×
  rebirthMult × streakMult). wordLength included so a word grants at least its menu-typing value;
  the mode mult (≥2 for every game) makes playing 2–5× the menu. This is the cleanest reading of
  "the same per-word weight" while guaranteeing "playing clearly faster." (xp.js xpPerWord.)
- Shared weight = cappedWordMult(rarity, combo, lucky) = min(40, product). Used for BOTH the wins
  banking weight AND the XP grant in every mode, so XP and wins ride the identical weight.
- Cosmetic pop/sound mults (menu-tap flavor) are NOT applied to in-game word XP — conservative,
  avoids the shop→xp import cycle; games already carry a 2–5× mode mult the menu lacks. Streak IS
  applied (streak.js already a dep).
- rawKeys=0 for in-game XP → a word never inflates lifetimeLetters (that stays a pure keystroke
  counter, like taps).
- No in-game level-up celebration animation wired (conservative; would touch 4 mode components +
  Tier-1 surface). The level persists and shows on the next menu visit. Flagged as a follow-up.
- Solo lucky-only XP grant in useSoloGame REMOVED — the component effects (ChainGame/FuseGame) now
  credit XP for EVERY word using the same weight that already includes the lucky ×5 factor, so
  lucky words still pay 5× (no double-count, XP == wins weight exactly).
- Rebirth pacing (sim: claude/unified-xp-sim.mjs): first rebirth LV15 = ~73–109 words via the
  ungated modes (WB/Blitz/SAT); CHAIN/FUSE are LV20/25-gated so can't shortcut it. NOT trivial →
  rebirth thresholds LEFT UNCHANGED. Playing = 2–5× menu per equal effort.

## JOB 2 — feat/mastery (off feat/unified-xp) ✅

- Perk = per-mode XP bonus (+3%/level above M1, +57% at M20), NOT a wins bonus. Rationale: the job
  wants a reason to pick a mode beyond PAYOUT, so the perk is on a different axis (XP), compounding
  Job 1. Also the only SAFE choice — mechanical perks (+timer/+life/+reroll) touch simulated balance,
  and WB/Blitz are server-authoritative so a client perk can't change them anyway. Mechanical perks
  documented as proposals in claude/mastery-report.md for later opt-in + re-sim.
- Curve masteryNeed(n)=round(50×1.4^n) exactly as specified. M2 at 70 words, M20 at 104k words.
- Wired into awardWordXp (co-located with Job 1 XP crediting) — no new accept-site plumbing.
- Card chip shown from M2 only (M1-everywhere = clutter). Dialog shows full readout (WB/Blitz/CHAIN/
  FUSE; SAT uses a bespoke start screen — noted as minor gap).
- Mastery keyed by XP-style mode ids (word-bomb etc.), not wins-style, to match awardWordXp.

## JOB 3 — feat/collection (off feat/mastery) ✅

- records.js (spec's "distinct set") is ABSENT from main (was on unmerged feat/record-surface).
  Built collection.js from scratch — the substance of the job either way. Logged, not a blocker.
- Milestones 100/500/1k/2.5k/5k → 5k/50k/250k/2M/20M base wins, × live rebirth mult at grant (stay
  meaningful late). Exponential ramp so 5k-word grant is a real windfall.
- Cap 5000 LRU (least-recently-SEEN). Measured 139.3 KB at cap.
- Compact encoding [bandIdx,modeIdx,dayEpoch,recency] + session cache (invalidated on localStorage
  identity change → test isolation preserved, browser stays warm). Fixed initial O(n²) test slowness.
- Collection reached via a new COLLECTION menu footer link + view (mirrors StatsScreen, low-risk).
- Only in-game ACCEPTED words collected (not menu self-test). Never shows an un-typed word.

## JOB 4 — feat/wins-sinks (off feat/collection) ✅

- WORD SENSE: second wins sink, effect ×2.5/cost ×6 (same ladder as KEY POWER). Buys a wins
  multiplier on rarity EXCESS (mult-1), so COMMON never boosted. Applied OUTSIDE the ×40 cap;
  XP stays on the unboosted weight (WORD SENSE is wins-only per spec).
- Formula wordSenseWinsFactor(rarityMult) = 1 + (mult-1)×(2.5^tier - 1). T1 OBSCURE ×5.5.
- Wired at all 5 accept sites: winsWeight = cappedWeight × wordSenseWinsFactor; xpWeight unchanged.
- Shop section mirrors KEY POWER card. buyWordSense in shop.js.
- Sim verdict: player NEVER runs out of things to buy in 20h (next tier always unaffordable in
  casual/regular/hardcore). Flagged for Job 8: WORD SENSE is the dominant late wins lever.

## JOB 6 — feat/return-bonus (off feat/wins-sinks) ✅

- Grant = min(hoursAway,12)×100×rebirthMult, once per LOCAL calendar day, >=6h gate (spec formula).
- Captured wa_last_seen at MODULE LOAD (getLastSeen added) before the app re-stamps it — else away
  time reads ~0.
- Card renders ONLY over view==='home' (deep-link to game never overlays). Dismiss on any keydown/
  pointerdown (capture, once) — doesn't block type-to-earn.
- <25% check: max R0 grant 1200 vs ~6000 typical established session = 20%; ratio rebirth-stable and
  shrinks as the player powers up (bonus tracks only rebirth, session tracks everything). New-player
  edge noted honestly in report.

## JOB 7 — feat/achievements (off feat/return-bonus) ✅

- 32 achievements (27 visible + 5 secret) across volume/speed/vocab/progression/streaks/modes/
  economy. Grid screen (ACHIEVEMENTS footer link), silhouettes+hints, secrets "???". Wins × rebirth.
- checkAchievements() on home mount (idempotent, two-pass for COMPLETIONIST). Reads live snapshot.
- CUT the newly-earned TOAST: it granted wins correctly but the toast element wouldn't stay mounted
  (state → null before paint) even in a prod build with mount-only timers. Not worth more time across
  a 20-job run; wins still credit (chip updates) + grid shows all. Revisit with Job 11's achievement
  sound. Conservative: ship the working screen+grants, don't block on a cosmetic toast.

## JOB 8 — chore/chain-audit (off feat/achievements) ✅ REPORT ONLY
- claude/chain-audit.md: per-system IN/OUT table + verdict. Chain now holds (1-7 braided the economy).
- Dead ends named: THEMES (sink, no output — #1 fix), lifetimeLetters + taps (vanity counters), WPM
  (now feeds achievements only). Recommends giving themes a real perk + cutting/wiring the counters.
- COMMITTED the .md (user explicitly said write+commit for audit jobs; overrides CLAUDE.md default).

## JOB 5 — feat/modifiers (off main) ✅ PROTOTYPE ONLY
- public/proto-modifiers.html: standalone page, 12 run modifiers with exact numbers + LIVE-computed
  payout impact (embedded JS model, shown transparently). NOT wired into live modes (per spec).
- Impacts span ×0.75 (MARATHON) to ×3.0 (HIGH ROLLER); LEXICOGRAPHER/PURIST deliberately ~neutral on
  total wins (skill filters). Risk tags flag variance the flat multiplier can't.
- Preview: /proto-modifiers.html on the branch's Vercel preview. Can't deploy (rail) — user views it.

## JOB 11 — feat/sound (off main) ✅
- audioCore.js (shared ctx+master+compressor, 14-voice cap, master volume, visibilitychange resume,
  C-minor-pentatonic ladder) + gameSounds.js (10 events, fire-and-forget) + clack refactor (7-variant
  round-robin cutoff, shared master) + AudioControls (🔊 toggle + volume slider).
- ALL sound OFF by default (flipped clack from default-ON per spec's school-lab requirement). 3 toggles.
- Wired: accept/reject (WB/Blitz/CHAIN/FUSE), menu level-up, rebirth+purchase (shop), lucky, danger
  (WB clock), run-over. NOT wired on this branch (systems live on feature-chain, not main): achievement
  earned, in-game level-up, streak-extended — functions exist, one call to add on merge. Documented.
- Measured: ~0ms app-added latency (scheduled at currentTime, never awaited), baseLatency 10.7ms →
  ~14-19ms audible; voice peak 15→culled to cap 14 under 30 keys/sec; silent when off (peak 0, no ctx).

## JOB 12 — feat/transitions (off main) ✅
- ONE directional wipe (transform+opacity, 240ms) replacing the 500ms 5-bar whoosh. Fired through the
  existing single runTransition helper on every view change. Direction from NAV_DEPTH (home 0/overlay
  1/game 2): deeper=forward, toward-menu=back. Shared tokens (--transition-ms/--transition-ease) in
  Transitions.css, referenced by the wipe + ModeDialog (same easing).
- Modals (ModeDialog) keep an in-place 200ms scale (a full wipe for a modal reads wrong) but share the
  language's timing/easing. TransitionIntro (boot) left as-is (app launch, not a screen change).
- Measured: transition frame-time median-of-3 = 17.3ms (~58-60fps; the ~17ms is the incoming screen's
  React remount on the swap frame — can't defer per the CLAUDE.md no-gating trap; the wipe is composited).
  Direction verified in-browser (forward/back). Suite 352 green.

## JOB 20 — docs/backlog-refresh (off main) ✅
- Appended a dated 2026-08-28 section to claude/BACKLOG.md: all standing-prompt items (router, save
  versioning, error boundaries, SW, analytics, a11y, App decompose, SEO, visual regression, optimistic
  WB, bot pacing, reconnect, daily seed, iOS audit, intl input, BE lifecycle, abuse limits, SAT def
  accuracy, judge eval, solo tuning, embeddability, reduced motion, empty lobby, perf playbook) +
  this-run follow-ups (merge chain, achievement toast, deferred sounds, mechanical perks, in-game
  level-up fx, theme perk, vanity counters, wire modifiers/preview, act on audit reports). Each: what/
  why/target-branch. Preserved prior backlog content.

## JOB 17 — perf/assets (off main) ✅
- Subset self-hosted Bungee Shade (wordmark font, PRELOADED on LCP path) 30,368→10,984 bytes (-63.8%,
  -19KB) via subset-font (npm --no-save, package.json untouched). Wordmark 3D shade verified intact;
  graceful Bungee fallback for any non-subset glyph.
- Google Fonts CSS made non-render-blocking (media=print onload swap + noscript). Safe: all display=swap.
- font-display:swap already everywhere (audited, nothing missing). SVGs only 2.8KB total across 4 files
  — optimization negligible, skipped (noted). LCP 188ms desktop; win is bandwidth/CLS + slow-3G path.
- Spec named "Anton" but app doesn't use it (uses Bungee/Space Mono/Bungee Shade/Bangers/Dela Gothic).

## JOB 16 — fix/edge-states (off main) ✅
- Audited 8 failure paths. App is largely defensive (guarded storage, connection-lost overlay,
  cold-start indicator, empty-room state all already handled). ONE real dead-end found + fixed:
  CHAIN/FUSE word-data chunk fetch had no .catch → stuck on bare "…" forever with no exit. Added
  SoloLoadState (COULDN'T LOAD WORDS + RETRY + always-present EXIT), wired into both modes. Verified
  by aborting the chunk in Playwright.
- Others (socket drop, backend cold, empty room, localStorage full/blocked, audio blocked, corrupt
  save, last-player-leaving) audited with before/after in claude/edge-states-report.md — all degrade
  gracefully. Noted optional enhancements (storage-full toast) for backlog. Suite 352 green.

## JOB 14 — feat/solo-onboarding (off main) ✅
- claude/chain-fuse-spec.md ABSENT from main (unmerged). Audited CHAIN vs FUSE instead. Gap: FUSE had
  NO worked example + NO first-run tutorial death card (CHAIN had both via ChainFirstRunCard). ARM
  hint was present in both.
- Fixed: added fuseCards.jsx (FuseFirstRunCard w/ worked example ARM→CHARM·ALARM·FARMER + goal) +
  FuseNormalCard; getFuseRuns/bumpFuseRuns in shared.js; wired FuseGame first-run selection + bare +
  PLAY AGAIN label. Now symmetric with CHAIN. Verified via a driven death. Suite 352 green.

## JOB 10 — feat/preview-redesign (off main) ✅ PROTOTYPE ONLY
- public/proto-preview.html: 3 distinct preview-card directions (A Bounty Poster / B Split Panel /
  C Arcade Ticket), each with REAL authored SVG bomb art (no CSS shapes), worked example + per-word
  wins + round length + mastery bar, one transform+opacity open <200ms (no canvas), zero scrollbars
  (verified desktop+390px), on-brand. Live dialogs untouched (per spec). User picks one.
- Preview: /proto-preview.html on the branch's Vercel preview.

## JOB 9 — chore/design-consistency (report) + fix/design-consistency (fixes) ✅
- Report: inventoried repeated elements (close controls, buttons, progress bars, chips, panels, shadow
  offsets) with file:line + specs; ranked mismatches by visibility. Committed the .md (user said commit).
- Fix: unified the #1 mismatch — the close ✕ control (4 variants → 1 canonical 40×40 #0d0618 spec;
  aligned mode-dialog-close 38px-white + solo-exit 44px). Left intentional: solo-restart armed-state
  purple, featured heavier shadow, sticker badges, and other-branch elements (coll/ach/mastery — unify
  via tokens on merge). Verified in-browser. Suite 352 green.

## RUN STATUS (2026-08-28)
Done + pushed + verified (git ls-remote == HEAD each): Jobs 1,2,3,4,5,6,7,8,9,10,11,12,14,15,16,17,18,
19,20. Job 13 (input latency, perf/input-latency) delegated to a background agent — awaiting its
verified push. Jobs 15,18,19 also done via background agents (branches chore/copy-audit,
perf/lowend, chore/lategame-audit — all verified by the agents). NOTHING merged; all branch-and-push
only, per rails. DECISIONS.md kept uncommitted (per CLAUDE.md).


## Autonomous 10-job run (2026-08-28)
User asleep; conservative choices, logged here.
Rails: branch+push only, never merge/main/deploy; verify push via git ls-remote.
- JOB2: ImageMagick (montage/magick) not installed; convert.exe is the Windows utility. DECISION: build contact sheets as HTML grids screenshotted to PNG via Playwright (no global installs while asleep).
