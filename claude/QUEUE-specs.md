# Queue specs (verbatim from Andy's prompts, collected 2026-10-01)

Resume order (Oct 1): A9 letters → 22 menu stimulation → 47 leaderboard pull-in → 21 → 19 → 20 → 9 → 23 → 16 → 35, 32, 33, 34, 8, 13, 10, 36, Batch A, Batch B, fine-tune loops, a11y/bundle/housekeeping/cosmetic last.

## STEP 47 — leaderboard pull-in (QUALITY PROTOCOL)
- After any game where the player's stats would place them on the board, show a one-tap prompt on the game-over/results screen: "YOU'D BE #N — CLAIM YOUR NAME" (only if they haven't claimed; at most once per session; dismissible).
- When a claimed player's rank improves, show a rank-up moment on their next menu visit (animated "#12 → #7", static fallback under reduced motion), and badge the trophy button until they open the board.
- The board itself must never look dead: if fewer than 10 players exist, show the empty rows as "#N — YOUR NAME HERE?" slots, never fake players.
- Anti-abuse: rate-limit name claims per browser and per IP-ish fingerprint server-side (Supabase function or DB rule), cap name changes to 1 per day, and make sure stats pushes can't be replayed faster than the existing 5s DB throttle.
Gate: e2e that plays a solo round on a fresh profile, sees the claim prompt, claims, sees itself on the board, then simulates a rank improvement and sees the rank-up moment. CI green, merge. Verify live on production with a throwaway name, then delete that row.

QUALITY PROTOCOL (mandatory for steps 32–36):
1. Research: find 3+ real games that do this well (cite them), write what makes each feel good, in claude/<step>/research.md.
2. Spec: claude/<step>/spec.md with every number decided up front (durations, rewards, sizes, thresholds) and the acceptance numbers that prove it works. Rewards must keep payout-honesty green and fit the step-19 economy simulation (re-run it with the feature included).
3. Build 3 genuinely different versions, screenshot at 390×844, 1280×551, 1920×1080, fresh and L150+ profiles, pick one, say why.
4. Adversarial review: a separate subagent that hasn't seen the work gets the spec + screenshots + PROJECT-design-and-conventions.md and must list everything weak, confusing, cheap-looking, exploitable, or unbalanced. A second subagent tries to break it (exploits, edge cases, spam, refresh, tab-away, two tabs). Fix every finding or write why not.
5. Simulate: bot players (weak/median/strong) play it; report the numbers against the spec's acceptance targets.
6. Only then: CI green, merge. Every animation has a reduced-motion static version; ≤3 concurrent animations, 0 infinite at rest.
QUALITY PROTOCOL (mandatory for steps 32–36):



===== 46fd0794-c23d-4b7f-9dac-93b1f345e1b6.jsonl =====


<pasted_content id="167a">
do this, continuing the same rules (one step at a time, 2 workers, gates, merge via PR after green checks, skip-and-note on failure, one report at the end covering ALL steps).

STEP 8 — Proportions audit, pass 1. Fresh branch fix/proportions-1 off main. Proportions have drifted as features were added. For EVERY screen (menu, mode dialogs, shop, stats, rebirth, credits, name/join/lobby, WB board, Blitz board, SAT Rush, CHAIN, FUSE, WORD RACE, every game-over) at 1280×551, 1366×625, 1920×1080, 2560×1440, 390×844, measure:
- hierarchy: ratio of the hero element's font-size to the next-largest text (target ≥1.6×; the loudest thing must be obviously loudest)
- vertical distribution: split the stage into 50px bands, count text leaves per band; flag any screen with >40% of content in <25% of the height or ≥3 consecutive empty bands in the middle
- edge balance: left vs right and top vs bottom margins of the main content box (flag >1.5× asymmetry unless intentional)
- dead space: % of the stage that is empty at 1920×1080 and 2560×1440 (flag >45%)
Save a screenshot per screen × viewport before. Fix the worst 8 offenders (rank by how many rules they break × how often players see the screen). Everything through the --fs-* tokens; Newgrounds/Y2K direction per PROJECT-design-and-conventions.md; must still read with reduced motion. Gate: a spec that encodes the 4 rules above for the 8 fixed screens and FAILS on main (prove it), 0 failed full e2e. Report a before → after table + screenshots saved in claude/proportions-1/. Merge.

STEP 9 — Blitz, prepare the "cut" path WITHOUT shipping it. Backend branch feat/blitz-lists-only off backend main. Using BLITZ-ENUMERABILITY.tsv (176 enumerable of 446), for each enumerable category fill its accept-list to complete coverage from real sources (never guess; every entry must be a real member of the closed set; one hallucinated entry scores forever). Add a verdict: category playable only if coverage is complete. Add a unit test per category that 8 obvious answers are accepted and 8 junk strings (zzzzzzzz, qwrtzxcvb, afdsaada…) are rejected. Report: categories completed, entries added, any category you couldn't complete and why. PUSH, DO NOT MERGE, DO NOT DEPLOY. This waits on Andy's call.

STEP 10 — WORD RACE polish (only if Step 2 deployed it). Branch fix/word-race-polish off main. Play 5 live races against production with two contexts + bots and fix what feels off: lane legibility at 390×844 and 1280×551, the hero fragment size vs lanes (hierarchy ≥1.6×), countdown/start clarity, finish moment, results screen fit (0 overflow, REMATCH visible). Add a phone menu entry behind the same ?race=1 flag. Gate: race specs + menu specs 0 failed, full e2e 0 failed. Merge (flag stays on).

STEP 11 — Housekeeping. Branch chore/housekeeping off main: delete unreachable App.jsx:2080 `if (mode === 'join')` branch (prove unreachable first); get eslint warnings 33 → 0 without disabling rules; remove stale git worktrees that aren't checked out by anything (list them, `git worktree prune`, remove clean ones only). Gate: 0 failed full e2e. Merge.

STEP 12 — Accessibility. Branch fix/a11y off main. Keyboard-only: every menu/dialog/button reachable with Tab, visible focus ring on every focusable element (≥3:1 contrast), Escape closes every dialog, focus returns to the opener. Screen reader: every icon-only button has an accessible name; the WB timer and race progress have polite live regions. Gate: an axe-core e2e spec across the main screens with 0 serious/critical violations (prove it fails on main), 0 failed full e2e. Merge.

STEP 13 — Proportions audit, pass 2. Branch fix/proportions-2 off main. Re-run the Step 8 measurement on ALL screens (not just the 8). Fix the next worst 8. Same gate, extend the same spec. Screenshots in claude/proportions-2/. Merge.

STEP 14 — Bundle weight. Branch perf/bundle off main. Report the entry chunk and every lazy chunk size (brotli) before. Find the 5 biggest wins (dead code, duplicate deps, oversized assets, fonts) without removing features. Gate: entry chunk brotli smaller, 0 failed full e2e. Report before → after. Merge.

STEP 15 — Final report. List every step's result, every merged PR + SHA, every unmerged branch and why, and confirm typeaword.com serves the final bundle.
</pasted_content id="167a">


===== 46fd0794-c23d-4b7f-9dac-93b1f345e1b6.jsonl =====


<pasted_content id="167a">
do this, same rules. STEP 16 — Multiplier prominence. Branch fix/card-multiplier off main. Andy's repeated complaint: the multiplier (and win rate) on the menu game cards is "still not enough." It's accurate and visible now but ~15px. Make the per-card multiplier the second-loudest element on each card after the mode name: its own element, ≥ --fs-h2 on desktop and ≥ 24px on 390×844, in the mode's neon, LayeredWord or Bungee, not inside the payout sentence. Keep XP/WORD and WINS/WORD lines readable. Build 3 genuinely different treatments, screenshot each at 1280×551, 1366×625, 1920×1080, 390×844 (phone menu too), pick one yourself and say why in two lines. Gate: card-fit.spec stays green (0 clip, 0 escape, no text <13px), a new assertion that the multiplier's font-size ≥ 1.6× the payout line's and is 2nd-largest on the card, 0 failed full e2e. Merge. Screenshots in claude/card-multiplier/.
</pasted_content id="167a">


===== 46fd0794-c23d-4b7f-9dac-93b1f345e1b6.jsonl =====


<pasted_content id="167a">
do this, same rules as last night's queue, one step at a time, one report at the end.

STEP 0 — Move e2e to CI so the laptop stops dying. Branch ci/e2e off main. Add a GitHub Actions workflow running the full Playwright suite on every PR, sharded across 4 runners (--shard=i/4), with browsers cached and the HTML report uploaded as an artifact. Repo is public, so minutes are free. Prove it works: open the PR and confirm all 4 shards run and report. Merge it. FROM NOW ON, the "0 failed full e2e" gate means the CI e2e check on the PR is green. Locally, run ONLY the specs a step touches (1 worker). Before each step, kill orphaned node/preview/playwright processes that aren't this Claude Code session.

STEP 4b — Open a PR for fix/min-text-sweep (56faebd). Merge when CI e2e is green.

Then continue STEPS 5–16 exactly as written in last night's queue, with the CI gate. Add to STEP 10 (race polish): .wr-root scrolls horizontally by 440px on the race results screen at 1920×827 (measured live on prod). Fix it, and assert no horizontal overflow on every race screen at every viewport.
</pasted_content id="167a">


===== 46fd0794-c23d-4b7f-9dac-93b1f345e1b6.jsonl =====


<pasted_content id="167a">
do this, same rules. Andy decided: CUT Blitz to list-only. Replaces STEP 9 (don't just prepare it — ship it).

STEP 9 (revised) — Blitz list-only.
BACKEND (chain-reaction-backend), branch feat/blitz-lists-only off main:
- Playable categories = only the enumerable ones in BLITZ-ENUMERABILITY.tsv whose accept-lists you can make COMPLETE from real sources (every entry a real member of the closed set; no guessing — one wrong entry scores forever). Drop any you can't complete; report which and why.
- Remove the Haiku judge from the scoring path entirely: accept-list hit = correct, miss = rejected, with the reason shown to the player (e.g. "NOT ON THE LIST"). Keep common spelling variants (donut/doughnut) and case/spacing/punctuation normalization.
- Unit test per playable category: 8 obvious answers accepted, 8 junk strings (zzzzzzzz, qwrtzxcvb, afdsaada, etc.) rejected.
- Merge via PR after npm test is green; Render deploys. healthz 200 twice. Then with Playwright against PRODUCTION: play a Blitz round, confirm a correct answer scores and zzzzzzzz is rejected with its reason. Also re-run the prod Word Bomb smoke test. If anything fails, revert the merge via PR and report.
FRONTEND, branch feat/blitz-lists-only off main:
- Ribbon "AI JUDGED" → "AI BUILT". Keep "AI" in the mode's name/marketing copy; remove any wording claiming answers are judged by AI. Show the rejection reason in the round. Update the pack picker if packs lost categories (no empty packs).
- Gate: CI e2e green, Blitz specs updated to the list-only behavior. Merge.
Report: categories live before → after, entries added, prod junk-answer result.
</pasted_content id="167a">


===== 46fd0794-c23d-4b7f-9dac-93b1f345e1b6.jsonl =====


<pasted_content id="167a">
do this, same rules (one step at a time, CI e2e gate, merge via PR after green, skip-and-note on failure, one report at the end). Andy played all day with friends; they found it VERY addicting, so keep direction, push harder. NEW PRIORITY ORDER after the step in progress: 17, 18, 9(revised Blitz), 19, 20, 21, 22, 23, 24, 16, 25, 8, 13, 10, then the rest (5, 6, 7, 11, 12, 14, 15). Animations ARE allowed and wanted (school Chromebooks don't block them); every animation still needs a static fallback under reduced motion. Anything taste-dependent: build 3 genuinely different versions, screenshot them, pick one yourself, say why in 2 lines, save shots in claude/<step>/.

STEP 17 — BUG: friend got wins on the main menu without playing. Fresh profile, sit on the menu 10 min (fake clock ok), also type on the menu ("TYPE ANYWHERE"), tab away/back, open/close shop. Wrap every wins/XP write with a stack-trace logger to find the source (suspects: menu typing, winsCarry release, word secrets/golden pop, momentum, refunds). Wins may only come from played words, purchases/refunds, or an explicitly shown reward. Gate: spec that idles + types on the menu and asserts wins/XP unchanged unless a visible reward fired. Merge.

STEP 18 — BUG: SAT Rush spam exploit. Every 3rd wrong keystroke auto-reveals a letter, so spamming random letters solves words. Build a spam bot and an honest bot; measure wins/min for each before. Fix: revealed letters pay 0; a word where most letters were revealed pays 0; spam costs lives/heat so a pure spammer loses the run fast. Honest play pays the same as before. Gate: spam bot ≤10% of honest wins/min, honest unchanged ±5%, payout-honesty spec green. Merge.

STEP 19 — Progression rebalance (Andy stopped at L125: "the upgrades seem insane eventually"). Write a simulation of the whole economy (level curve, key power, momentum, XP multi pops, sound packs, themes, mode mastery bars for CHAIN/FUSE, rebirth, badges) for players at 10/30/60 min per day for 30 days. Find where it breaks after ~L100. Targets: a meaningful unlock/upgrade every 2–10 minutes of play from L1 to L300; cosmetic shop items (XP multi pops, sound packs, themes) priced on exponential curves like the rest; CHAIN/FUSE mastery bars go much higher than now, with milestone rewards every few levels. Chart before/after (PNG in claude/progression/). Card numbers must stay honest (payout-honesty spec green). Level progress text shows LETTERS not words ("N LETTERS TO LEVEL X"). Merge.

STEP 20 — Mode milestone mechanics, with real logic.
FUSE: completing every strip letter in a run triggers FRENZY: 5 real minutes of ×5 wins that persists across runs and modes' FUSE plays, shown as a countdown in the FUSE HUD and on the menu card, with a huge animated trigger moment and a big bonus payout. Also improve letter steering: players get stuck on the last 3 letters, so from 19 lit, most fragments should contain a missing letter, and the last missing letter must be reachable (never draw fragments that can't lead to it).
CHAIN: milestone rewards at link tiers (e.g. 16/24/32): escalating wins bursts and a timed ×multiplier, each with its own animation.
Keep the screen uncluttered: fewer words, but everything important visible. Every reward shown on screen matches what's paid (extend payout-honesty spec). Merge.

STEP 21 — Marks + shop logic. Swap the SHOP and STATS positions in the menu. Rework mark visuals (3 versions, pick one). Add HOLD TO BUY (press and hold repeats purchases, accelerating) and BUY MAX where it makes sense; no more mashing a button. Add notification badges on SHOP (and anything else) when an upgrade is affordable. Themes in the shop must be obviously noticeable: live preview of the menu in that theme, not a small swatch. Merge.

STEP 22 — Menu stimulation, the "satisfying feel". The player should FEEL progress. Escalating frames/borders on the menu and the level bar by level and rebirth tier; longer, juicier type animation on the menu; bigger level-up and purchase moments; affordable-upgrade badges pulse once (not infinite). Make it better as you progress, so a L150 player's menu looks visibly richer than L1. Perf rule: ≤3 concurrent animations at rest, 0 infinite animations at rest. Merge.

STEP 23 — In-game visual rework + font sizes WHILE PLAYING, newest modes first (WORD RACE, FUSE, CHAIN, then WB, SAT, Blitz). Measure hierarchy while a round is live (hero ≥1.6× the next text, nothing <13px, key numbers readable at a glance). Newgrounds/Arcane art direction, 3 versions per mode for the big changes, pick yourself. Merge per mode.

STEP 24 — Leaderboard (no Google sign-in). Username-only: on first use, the player claims a unique username; the device stores a secret key so the name can't be hijacked. Use Supabase (free tier) with anonymous auth + RLS: a player writes only their own row, everyone reads. Username filter: a maintained profanity library that handles leetspeak/spacing (e.g. obscenity) plus a custom blocklist; add a hidden moderation page for Andy to rename/ban names (protected by an admin secret held on the backend, not in the frontend). Board shows: rank, username, level + rebirth stars, lifetime words, current WINS/WORD multiplier. Leaderboard icon on the menu. If Supabase credentials are missing, build everything behind a flag against a local mock, then STOP this step and print EXACTLY what Andy must click in Supabase (step by step, ≤10 steps) and which 3 values to paste back. Merge only the flagged-off version.

(Step 9 revised = Blitz list-only, as already queued. Step 16 = multiplier prominence, as already queued.)
</pasted_content id="167a">


===== 66ba51ed-d429-4aa3-9bf3-a423c43812b7.jsonl =====


<pasted_content id="ea15">
do this, same rules. STEP 30 — Fine-tune loop. Runs after all other steps, and repeats.

Each pass:
1. Screenshot every screen (menu, shop, stats, rebirth, every mode dialog, lobby, every mode mid-round, every game-over, WORD RACE) at 390×844, 1280×551, 1366×625, 1920×1080, on a fresh LV1 profile AND a L150+ rebirthed profile.
2. Spawn a separate reviewer subagent that has NOT seen your work. Give it only the screenshots + PROJECT-design-and-conventions.md + the Newgrounds/Arcane direction. It ranks the 5 worst problems (proportions, hierarchy, cramped/empty space, weak reward feedback, inconsistent style, anything that feels cheap) with a specific measurable fix for each.
3. Fix those 5 on one branch, CI green, merge.
4. A second fresh reviewer re-scores the same screens 1–10. Log the score per screen in claude/finetune/scores.md.

Repeat passes until a pass's average score stops improving by ≥0.3, or 8 passes, whichever comes first. Never undo a fix from an earlier pass without saying why. Report the score table across passes at the end.
</pasted_content id="ea15">


===== 0c94d7c3-c103-41bd-9f5d-b0c25dcadafb.jsonl =====


<pasted_content id="4602">
do this, same rules.

RULE (applies now): never run gates for multiple forks/variants at the same time locally. Gate forks one at a time, or push each to its own branch and let CI run them. If memory gets tight, kill orphaned node/preview/playwright processes that aren't this session before continuing.

STEP 31 — The "type a word" search visitors. typeaword.com ranks ~#1.8 for "type a word" in Germany (197 clicks / 269 impressions); those people come from a TikTok trend ("type a word and it shows it as a picture") and bounce (mobile bounce 78–90%). Make the first 3 seconds on a phone hook them: when a first-time visitor lands on / on a phone, show a one-line "TYPE A WORD 👇" prompt with an input right on the phone menu; typing any word plays a satisfying animated reaction (the word slams in with LayeredWord, mascot reacts) and then offers one tap into PLAY SOLO Word Bomb. No new route, no image generation, nothing heavy: menu stays one screen, LCP not worse (measure median of 5 before/after on 390×844). Add German auto-detect for just that one-line prompt ("TIPP EIN WORT 👇") when navigator.language starts with de. Gate: phone menu specs green, no text <13px, 0 scroll, CI green. Merge. Report LCP before/after.
</pasted_content id="4602">


===== 0c94d7c3-c103-41bd-9f5d-b0c25dcadafb.jsonl =====


<pasted_content id="4602">
do this, same rules. These are NEW FEATURES, so they follow the QUALITY PROTOCOL below. Nothing ships as a first draft.

QUALITY PROTOCOL (mandatory for steps 32–36):
1. Research: find 3+ real games that do this well (cite them), write what makes each feel good, in claude/<step>/research.md.
2. Spec: claude/<step>/spec.md with every number decided up front (durations, rewards, sizes, thresholds) and the acceptance numbers that prove it works. Rewards must keep payout-honesty green and fit the step-19 economy simulation (re-run it with the feature included).
3. Build 3 genuinely different versions, screenshot at 390×844, 1280×551, 1920×1080, fresh and L150+ profiles, pick one, say why.
4. Adversarial review: a separate subagent that hasn't seen the work gets the spec + screenshots + PROJECT-design-and-conventions.md and must list everything weak, confusing, cheap-looking, exploitable, or unbalanced. A second subagent tries to break it (exploits, edge cases, spam, refresh, tab-away, two tabs). Fix every finding or write why not.
5. Simulate: bot players (weak/median/strong) play it; report the numbers against the spec's acceptance targets.
6. Only then: CI green, merge. Every animation has a reduced-motion static version; ≤3 concurrent animations, 0 infinite at rest.

STEP 32 — DAILY. One shared seeded daily run per solo mode (CHAIN, FUSE, SAT Rush): same puzzle for everyone that day, one attempt, a daily streak counter on the menu, and a shareable result card (emoji grid per claude/chain-fuse-spec.md §2.7/§3.6 style, deep link to the mode). Streak rewards escalate (fit the economy). Menu shows a badge when today's daily is unplayed.

STEP 33 — SOUND. A small, punchy SFX set for the moments that matter: word accepted, rejected, combo up, level up, purchase, frenzy/milestone, KO, race finish, daily complete. Respect the existing mute control; default volume sane; total audio payload budget ≤150 KB, lazy-loaded after first interaction. Every sound must make the moment feel better: the reviewer judges each one.

STEP 34 — COLLECTION PAGE. Achievements/badges/marks as a collection screen that feels like a trophy wall: locked silhouettes with progress bars, rarity tiers, a satisfying unlock moment, and a "next closest" row that tells the player what to chase. Reachable from the menu on phone and desktop.

STEP 35 — FIRST 5 MINUTES. Script a brand-new player's first 5 minutes (land → first word → first level → first purchase → first mode unlock) with a bot and measure: seconds to first word, words to L2, seconds to first reward animation, number of dead moments (>8s with nothing new happening). Targets: first word <10s, first reward <30s, no dead moment >8s. Fix the gaps. Re-measure.

STEP 36 — WORD RACE as a real mode. Only after step 10 and the leaderboard (step 24) land. Remove the ?race=1 flag only when: 20 bot races show no desync, results screen fits everywhere, race payouts pass payout-honesty, and the adversarial reviewer signs off. Add race wins to the leaderboard.

Order: 35 first (it improves everything after it), then 32, 33, 34, 36.
</pasted_content id="4602">


===== 0c94d7c3-c103-41bd-9f5d-b0c25dcadafb.jsonl =====


<pasted_content id="4602">
do this, same rules, slot it in as the next step after the current one. Supabase for STEP 24 (leaderboard): [Supabase credentials REDACTED — never committed] Never commit these; the URL + anon key go into Vercel env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) for Production and Preview via the Vercel CLI; the connection string is ONLY for running the migration locally, never stored in the repo or Vercel. Create the profiles table + RLS (anonymous users write only their own row, everyone reads), unique case-insensitive usernames, the profanity filter as a DB check too (not just client-side). Moderation = Andy edits/deletes rows in the Supabase Table Editor; skip the custom mod page. Then finish step 24 with the flag ON, verify on the preview with two browser profiles (claim names, both appear on the board, a blocked name is rejected), CI green, merge. Report what's live.
</pasted_content id="4602">


===== 0c94d7c3-c103-41bd-9f5d-b0c25dcadafb.jsonl =====


<pasted_content id="4602">
do this. PRIORITY OVERRIDE from Andy, applies to everything queued.

1) LEADERBOARD (STEP 24) GOES NEXT, right after the step in progress. Supabase credentials are already in this session. It must be LIVE on typeaword.com by morning: username claim, profanity-filtered (leetspeak-aware, enforced in the DB too), board showing rank, username, level + rebirth stars, lifetime words, WINS/WORD; leaderboard icon on the menu, phone and desktop. Verify on production with two browser profiles. If anything blocks it, fix it yourself; do not stop and wait.

2) Write claude/andy-notes-oct1.md with Andy's points below as a checklist. Every queued step that touches one must cite it. A point is only checked off with EVIDENCE (PR #, measured number, screenshot path). These points outrank everything else in the queue; if a step conflicts with one, Andy's point wins.

ANDY'S POINTS (his words, keep the emphasis):
- MENU STIMULATION, THE "SATISFYING FEEL", IS THE #1 PRIORITY: the player must feel MORE stimulation as they progress. Borders/frames that escalate with level and rebirth, notification icons when upgrades are affordable, LONGER type animations, more visual stimulation everywhere. Think of more ways yourself.
- Anything BIG needs animations (school Chromebooks don't block them).
- Marks need much better visuals AND a better system/logic.
- Shop and stats menus: swap their places.
- No mashing buttons: at worst "hold to buy".
- Progression: Andy stopped at ~L125 because upgrades "seem insane eventually". Fix the late game. Shop XP multi pops and sound packs priced more exponentially. CHAIN and FUSE bars go MUCH higher with better rewards.
- Higher mode bars must come with LOGICAL, INTERESTING mechanics, e.g. CHAIN more wins, FUSE all letters → 5-minute ×5 wins timer + huge bonus. Don't crowd the screen: fewer words, but everything important shows, and everything makes sense.
- Game modes more rewarding overall.
- Level-up progress says LETTERS needed, not words.
- FUSE: players get stuck on the last ~3 letters, so steer fragments toward missing letters.
- Visual reworks INSIDE game modes, especially the newer ones, plus font sizes WHILE PLAYING. Check it yourself in a live round.
- Themes in the shop aren't noticeable: make them obvious.
- Leaderboard: no Google sign-in, username only, block bad names.
- (Done, keep verified: free menu wins #67, SAT spam #68.)

3) Reorder the queue so every step that serves these points runs before steps that don't (a11y, bundle, housekeeping, cosmetic backlog go last). Report the new order in one line, then continue.
</pasted_content id="4602">


===== 615c5cf3-4e58-46a6-ad52-60824e899bb6.jsonl =====


<pasted_content id="3c94">
do this. Resume the queue. Done so far: #65-#70 (CI e2e, min-text, free menu wins, SAT spam, type-a-word hook, leaderboard). Everything else is still open.

HARD RULE: do not end your turn while queued steps remain. If a step is blocked, note why, skip it, start the next. Only stop for a usage limit, and when you resume, continue where you left off.

Order, following Andy's priority override (his points outrank everything):
1. Commit claude/andy-notes-oct1.md (the checklist) now and keep it updated with evidence per point.
2. LETTERS not WORDS in level progress (menu still says "283 WORDS TO LEVEL 28" live). Small; do it first.
3. STEP 22 menu stimulation / satisfying feel (Andy's #1).
4. STEP 21 marks visuals + system, swap SHOP/STATS, hold-to-buy, obvious theme previews.
5. STEP 19 progression rebalance (late game, exponential cosmetics, much higher CHAIN/FUSE bars).
6. STEP 20 FUSE frenzy + steering, CHAIN milestones.
7. STEP 9 Blitz list-only (ribbon AI BUILT).
8. STEP 23 in-game visual rework + live font sizes.
9. STEP 16 multiplier prominence.
10. Then everything else as already queued (35, 32, 33, 34, 8, 13, 10, 36, Batch A, Batch B, fine-tune loops, then a11y/bundle/housekeeping/cosmetic last).
</pasted_content id="3c94">
