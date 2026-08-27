# TRIAGE — 2026-08-27 (read on your phone, pre-school)

**One line:** 5 branches I made tonight are all safe **MERGE-NOW** (led by a child-safety slur fix). 6 branches from last night change game *feel* → **play them first**. The rest are design forks or unbuilt. **Merge the slur fix today** — prod currently serves slurs.

---

## Every branch (mine tonight + last night's pending)

### Made tonight (this run) — all safe
| branch (repo) | what it does | tests | merge-ready | your play-test? | risk |
|---|---|---|---|---|---|
| `fix/dict-safety` (FE `37de7b7`) | strip slurs from word assets + profanity from display assets; build-guard | 282 unit + build ✓ | **YES** | no | none |
| `fix/dict-safety` (BE `cdd2da0`) | reject slurs at the acceptance gate; purge bot display pool; guard test | 324 ✓ | **YES** | no | none |
| `fix/bot-words` (BE `f439b94`) | test only: proves bot ⊆ human word set | 324 ✓ | **YES** | no | none |
| `audit/backend-lifecycle` (BE `f2915e2`) | report only (`claude/backend-lifecycle-audit.md`) | n/a (docs) | **YES** | no | none |
| `audit/abuse` (BE `94f99d6`) | report only (`claude/abuse-audit.md`) | n/a (docs) | **YES** | no | none |

### From last night (pending, per 2026-08-26 DECISIONS.md — **I did NOT re-verify tonight**)
| branch (FE) | what it does | tests | merge-ready | your play-test? | risk |
|---|---|---|---|---|---|
| `feat/combo` (`71d2a6c`) | combo multiplier ×1.1→×3.0 on streak, CHAIN/FUSE | claimed ✓, not re-run | after play | **YES** | changes payouts |
| `feat/lucky` (`fe5cbf8`) | 1/40 lucky word = 5× wins + XP + gold burst | claimed ✓, not re-run | after play | **YES** | changes payouts + adds XP source |
| `feat/unlock-ladder` (`b829608`) | free cosmetic unlocks by level (menu accent + badge) | claimed ✓ | after glance | light | cosmetic only |
| `feat/ranks` (`b3c8abe`) | menu rank display | claimed ✓ | after glance | light | visible menu change |
| `feat/share-card` (`a7e5686`) | "COPY RESULT" share button | claimed ✓ | after glance | light | additive UI/text |
| `proto/cards` (`cc4033f`) | standalone card-redesign prototype page (not wired live) | n/a | **NO** — decision aid | n/a | it's a mockup, not a feature |

*(The repo also has 200+ older branches from prior sessions — out of scope for tonight's triage.)*

---

## BUCKET 1 — MERGE NOW
All five tonight branches: safety fixes, a test, and two docs. No taste call, no gameplay change.
- **FE `fix/dict-safety`** — removes slurs from every word list + profanity from every *displayed* asset (profanity stays *typeable*). Safe: acceptance of normal words unchanged; 282 unit + build green; a build-time guard stops regressions.
- **BE `fix/dict-safety`** — makes the server *reject* slurs even though they're in the 275k wordlist, and cleans the bot's display pool. Safe: only slurs are newly rejected; 324 tests.
- **BE `fix/bot-words`** — adds a guard test only, zero behaviour change.
- **BE `audit/backend-lifecycle`**, **BE `audit/abuse`** — markdown reports only.

**Copy-paste merge (two repos, test gate between each):**
```sh
# FRONTEND
cd ~/Downloads/wordarcade-frontend_1/wordarcade-frontend
git checkout main && git pull
git merge --no-ff fix/dict-safety && npm test && npx vite build --logLevel error
git push

# BACKEND
cd ~/Downloads/chain-reaction-backend
git checkout main && git pull
git merge --no-ff fix/dict-safety        && node --test
git merge --no-ff fix/bot-words          && node --test
git merge --no-ff audit/backend-lifecycle
git merge --no-ff audit/abuse            && node --test
git push
```
(Backend branches don't touch the same files, so order is safe; dict-safety first because it's the safety fix.)

---

## BUCKET 2 — MERGE AFTER YOU PLAY IT
Last night's economy/feel branches. Re-run `npm test && npx vite build` on each first (I didn't tonight).
- **`feat/combo`** — Play **CHAIN**. Accept several words in a row; watch the multiplier pill climb ×1.1→×3.0 and the wins payout scale with it. **Wrong if:** it resets mid-streak when it shouldn't, or payouts feel swingy/inflated.
- **`feat/lucky`** — Play **FUSE/CHAIN** ~40+ words. **Watch:** the gold burst should fire roughly 1 in 40 and pay 5×. **Wrong if:** it fires way more/less than 1/40, or the bonus XP feels like a cheat.
- **`feat/unlock-ladder`** — Level up; the **menu accent + LV badge** should change. **Wrong if:** it fights the locked pink wordmark or adds an idle animation (menu-motion-law).
- **`feat/ranks`** — glance at the menu rank. **Wrong if:** it duplicates or conflicts with the XP/LV display.
- **`feat/share-card`** — hit **COPY RESULT**, paste it. **Wrong if:** the format is off or it collides with the older ShareBar on WB/Blitz/SAT (see DECISIONS D-SHARE-COEXIST).

---

## BUCKET 3 — NEEDS YOUR DECISION (real forks — my pick in **bold**, override me)
These are new surface area, not fixes. Mostly **unbuilt** — the decision is *build it or not*.
- **Card redesign direction** — Sticker (A) vs Arcade cabinet (B) in `proto/cards`. A = die-cut sticker, tape corners, beat-pop; B = marquee + bulbs + scanline. Both measured **0 infinite animations**. → **Pick A (sticker).** It's closer to the Newgrounds/FNF house look and reads at small mobile sizes; the cabinet's bulbs get noisy on a phone grid.
- **Ghost opponents (19)** — race a replay of your own past run. For: fixes the empty-lobby dead feeling with zero server/accounts. Against: new localStorage surface + a "is this a real person?" honesty question. → **Build it, self-ghosts only, labelled "YOUR GHOST".** Cheapest fix to the #1 multiplayer problem (empty lobby).
- **Word collection (33)** — every word you've typed, in a grid by rarity. For: the retention loop the game lacks; pairs with rarity scoring. Against: 5k-word cap + LRU storage work; a screen to maintain. → **Build it, but only *after* word-rarity (31)** — the collection is dull without tiers to sort by.
- **Achievements (37)** — ~30 named goals granting Wins. For: strong reason to try new things. Against: 30 reachability tests + a grid screen; scope. → **Build a first 10** (volume/skill/streak/mode), not 30, then expand.
- **On-screen keyboard (35)** — ASMR key-light + heatmap. For: the game is literally "TYPE A WORD" and never shows keys. Against: real SVG art + a perf budget when off. → **Defer.** Highest effort, lowest launch impact of this group; do it after the retention loop lands.
- **Word-rarity scoring (31)** — this is really an **economy fix** (every word pays the same today) wearing a taste hat. → **Build it** — but the multiplier *bands* are a feel call, so once built it becomes a Bucket-2 "play and tune" (target: OBSCURE ≥2% of real play).

---

## BUCKET 4 — DO NOT SHIP / PARKED
- **Per-mode SEO pages (9)** — **PARKED.** They need a path router (`/word-bomb` etc.). The app has **no router** — modes are query params (`?fuse=1`), see DECISIONS D0. Can't prerender per-mode pages without routing first. Decide the router, then this unblocks.
- **`proto/cards` as a feature** — **don't ship the branch.** It's a standalone mockup page, not wired to the live card. Use it only to pick a direction (Bucket 3), then build that into `GameCard` properly.
- Not a branch, but worth stating: the **old 271k accept vocab shipped with slurs** was a genuine *do-not-ship-as-was*. `fix/dict-safety` is the fix — merge it.

---

## FINDINGS THAT MATTER MORE THAN THE CODE (ranked by severity)
1. **SLURS were shipped in every word asset AND accepted/scored by the server.** 27+25 slur forms in the two acceptance lists, 7 in the displayed CHAIN supply, 8 in the bot's pool, and **102 slur forms live in the 275k backend acceptance vocab** (so the server *scored* them). Fixed on `fix/dict-safety` (both repos) — **UNMERGED. Until you merge it, production still serves and scores slurs to a school audience.** This leads everything.
2. **Display names are not moderated.** A player can set their name to a slur; it's broadcast to every player (`room_update`/`turn_update`). No branch fixes this yet — quick follow-up: run `sanitizeName` output through the new `blockedTerms`. (JOB 23 A1)
3. **Unbounded dictionary cache = memory/DoS.** The server caches *every* distinct submission, valid or not, with no eviction — **measured +20.8 MB per 50k junk words**. On the public, unauthenticated socket a client can grow it to OOM. (JOB 22 F1 / 23 A3)
4. **AI-judge cost bomb, latent.** The day you add `ANTHROPIC_API_KEY`, every Blitz answer that misses the list hits the model with only a *global* throttle (no per-socket budget) — one abuser can burn your spend. Disabled today. (JOB 23 A2)
5. **Good news:** the bot **cannot** play a word a human is rejected for (proven — 14,543/14,543 pass the human gate). The `markAsValid` risk is real in theory but not exploitable; a guard test now pins it. (JOB 14)
6. **Growth ceiling:** 5 modes share 1 URL (no router) — search sees one page. Not a safety issue, but caps organic traffic. (JOB 9, parked)

---

## WHAT I MEASURED vs WHAT I ASSUMED
**Measured (verifiable numbers):**
- main: 277 unit + 133 e2e pass (ran); the 1 e2e failure passes alone in 11s.
- dict-safety removals counted by scanner: 27/25 slurs (accept lists), 7 slur + 11 profanity (recall), 8 slur + 58 profanity (botWords).
- After fixes: FE 282 unit + build; BE 324 tests (ran).
- Fragment pools: every fragment ≥4 solutions in the cleaned top-6000 (computed); `tit`→`ela` both 15 solutions.
- Bot: 14,543 bot words, **0** rejected by the human gate (ran).
- Rooms: **0.08 KB/room** over 1,000 create/abandon (measured, `--expose-gc`).
- Dict cache: **+20.8 MB / 50k** distinct invalids (measured).

**Assumed / inferred (NOT independently measured tonight — treat with caution):**
- JOB 2's "46 infinite animations" — **not re-measured** (branch already merged; inferred no new loops by construction).
- Last night's branches (`feat/combo`, `feat/lucky`, etc.) "build clean + tests pass" — **from the 2026-08-26 notes, not re-run tonight.**
- The e2e failure being *purely* a pre-existing timing flake — inferred from the isolation pass (strong, not proof).
- Slur/profanity list **completeness** — it's a curated list (the LDNOOBW fetch was refused); it catches the obvious terms but I did not validate it against an external corpus. Unknown gaps are possible.
- The AI-judge "cost bomb" — inferred from the code path; not observed live (judge is off with no key).

---

## WHAT I DID NOT DO (plainly)
- **SAT words (3) / category lists (4,13) / SAT accuracy audit (24):** not done — inventing words/definitions is explicitly forbidden and I had no verified source. Needs a licensed list or web verification.
- **TIER-1 live logic (8 app-split, 11 parity, 15 optimistic-input, 17 reconnect):** not done — your CLAUDE.md requires a 2-device play-test I can't run autonomously.
- **Browser audits (5 first-run, 6 perf, 20 iOS-WebKit, 41 return-player, 10 visual-regression):** not done — need a live driven browser to be credible.
- **The three follow-up FIXES I found (name moderation, dict-cache cap, judge budget):** identified, **not implemented** — each is a small new branch; flagged for next run.
- **Feature jobs (18,19,25,27,28,31–40):** not built — each is a real project; left for you to prioritise (see BACKLOG.md).
- **JOB 29 (empty-lobby)** — your message was truncated at "This"; and **JOB 7-orig (handoff doc)** — not written. **There is no JOB 30.**
- **Did not re-verify last night's 6 branches** — run `npm test && vite build` on each before merging.

*Full detail: `claude/run-report-2026-08-27.md`; rationale: `DECISIONS.md`; audits: the two `claude/*-audit.md` on their backend branches.*
