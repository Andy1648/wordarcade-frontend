# Andy's notes — 2026-10-01 (PRIORITY OVERRIDE)

These outrank everything else in the queue. If a step conflicts with one, Andy's point wins.
Every queued step that touches a point cites it by its ID (A1…A14). A box is checked ONLY with
evidence next to it: a PR #, a measured number, or a screenshot path.

## Checklist (his words, emphasis kept)

- [ ] **A1. MENU STIMULATION, THE "SATISFYING FEEL", IS THE #1 PRIORITY**: the player must feel MORE
  stimulation as they progress. Borders/frames that escalate with level and rebirth, notification
  icons when upgrades are affordable, LONGER type animations, more visual stimulation everywhere.
  Think of more ways yourself.
  - evidence (partial — STEP 22, PR #72 merged (main cf2c04f), LIVE in prod `index-Dz2N6Ap1.js`, markers
    `taw.menuTierSeen` + `NEW FRAME UNLOCKED`): MENU TIER (level + rebirth, a
    rebirth never lowers it) drives a tier-coloured, thickening frame with SVG corner plates that
    accumulate rivets/spikes/gem/drips/crown, rebirth stars on the top edge, a tier-coloured level
    slab, a one-time "<TIER> FRAME UNLOCKED" moment. Before/after L1 vs L150R3:
    `claude/step22/before-*.png` vs `claude/step22/after-*.png`; 3 art directions compared in
    `claude/step22/v-{plate,spray,sticker}-*.png` (plate picked). Letter pops 600ms → 1230ms with
    more rise + shards by tier; level-up gains a starburst + shard ring; purchases fire two confetti
    volleys; the affordable SHOP dot pulses twice then rests. Fixed: level-up hold was being eaten
    by effect-level easing (now holds the full 900ms). Perf `claude/step22/perf.json`: 0 running /
    0 infinite at rest at L1 and L150R3. Still open under A1: STEP 33 sound, STEP 21 badges.
- [ ] **A2. Anything BIG needs animations** (school Chromebooks don't block them).
  - evidence (partial): STEP 22 — level-up starburst + shard ring, tier-up frame slam + name card,
    purchase confetti; all with reduced-motion static fallbacks.
- [ ] **A3. Marks need much better visuals AND a better system/logic.**
  - evidence (STEP 21, PR pending — branch feat/marks-shop): marks are drawn SVG badges (coin medallion picked of coin/pin/patch, `claude/step21/marks-*.png`), no emoji; NEW SYSTEM: a worn mark ranks I→V with words typed wearing it (150/500/1500/4000), each rank scaling its bonus up to 1.6× (bounded, unit-tested), picker shows rank, this-rank and next-rank payout, words-worn bar; menu names a rank-up once; NEW MARK badge when an unlocked mark hasn't been looked at.
- [ ] **A4. Shop and stats menus: swap their places.**
  - evidence (STEP 21, PR pending — branch feat/marks-shop): STATS now leads and SHOP sits last in both the desktop corner stack and the phone strip (`e2e/shop-hold.spec.js` asserts order at 1280 and 390; `claude/step21/menu-nav-*.png`).
- [ ] **A5. No mashing buttons: at worst "hold to buy".**
  - evidence (STEP 21, PR pending — branch feat/marks-shop): KEY POWER + MOMENTUM: tap = 1 buy; HOLD keeps buying, accelerating 420→70 ms, ONE reveal per run ("KEY POWER VII (+7)"); BUY MAX button. e2e: a 1.6 s hold buys ≥5 tiers with exactly 1 sticker. One-off cosmetics stay single-press (nothing to mash).
- [ ] **A6. Progression:** Andy stopped at ~L125 because upgrades "seem insane eventually". Fix the
  late game. Shop XP multi pops and sound packs priced more exponentially. CHAIN and FUSE bars go
  MUCH higher with better rewards.
  - evidence:
- [ ] **A7. Higher mode bars must come with LOGICAL, INTERESTING mechanics**, e.g. CHAIN more wins,
  FUSE all letters → 5-minute ×5 wins timer + huge bonus. Don't crowd the screen: fewer words, but
  everything important shows, and everything makes sense.
  - evidence:
- [ ] **A8. Game modes more rewarding overall.**
  - evidence:
- [x] **A9. Level-up progress says LETTERS needed, not words.**
  - evidence: PR #71 merged (main d794cd6), LIVE in prod bundle `index-Dz2N6Ap1.js` (marker `"LETTERS"`). Menu XP hint now reads e.g. "1,423 LETTERS TO
    LEVEL 28" (`claude/a9/hint-1280.png`, seeded L27). XP is linear in word length, so letters =
    ceil(toNext × 5 ÷ featured card's XP/word) — the card quotes a 5-letter word. `e2e/menu.spec.js`
    asserts the rendered hint against the rendered card in LETTERS and that "WORDS TO" is gone;
    menu/menu-fit/menu-xp/menu-spotlight/overlays specs 23/23 green. The phone menu (≤480px) has no
    XP hint line, so nothing there said WORDS. The in-game "3 WORDS TO EARN" pill is the wins
    payout gate (counted in words), not level progress — left as is.
- [ ] **A10. FUSE: players get stuck on the last ~3 letters**, so steer fragments toward missing letters.
  - evidence:
- [ ] **A11. Visual reworks INSIDE game modes**, especially the newer ones, plus font sizes WHILE
  PLAYING. Check it yourself in a live round.
  - evidence:
- [ ] **A12. Themes in the shop aren't noticeable: make them obvious.**
  - evidence (STEP 21, PR pending — branch feat/marks-shop): every theme card is a miniature of the MENU in that palette (wordmark, level bar, 5 mode cards, pops) instead of a 4-colour strip — `claude/step21/shop-themes-*.png`; e2e asserts ≥150px wide and distinct per theme.
- [x] **A13. Leaderboard: no Google sign-in, username only, block bad names.**
  - evidence: PR #70 merged (main 05ad2e1); LIVE in production bundle `index-D9gquwJb.js` (marker
    `lb_claim`, ~60 s after merge). Two separate browser profiles on **typeaword.com**: 12/12 checks
    pass (both names claimed, both on both boards, leetspeak `f4gg0t_99` refused, `qa_alpha_*` refused
    as taken): `claude/step24/verify/prod-*.png`. DB enforces the filter too: client/DB parity 50/50
    vectors vs the live DB (`claude/step24/db-parity.mjs`); anon REST probe: direct insert/update/
    delete → 401, wrong secret → refused, blocked name → `username_blocked`. No sign-in of any kind:
    a per-browser secret, username only. QA rows deleted after each run (board starts empty).
  - STEP 47 (pull players in): PR #73 merged (main 6b5e3b5), LIVE `index-DejTQHrr.js` (markers
    `taw.lb.promptShown`, `taw.lb.rankNews`, `YOUR NAME HERE?`). Verified ON typeaword.com, no mocks
    (`claude/step47/prod-verify.mjs`, shots `claude/step47/prod/1-4*.png`): real CHAIN round → "YOU'D BE
    #2" → claimed `zqpLive47` → board #2 + 8 invitation slots → ghost row removed → next menu "RANK UP
    #2 → #1" + trophy "your rank went up"; throwaway + ghost rows and claim logs deleted (board = 0). — end-screen "YOU'D BE #N" claim prompt, menu "#a → #b" rank-up +
    trophy dot, never-dead board, migration 004 live (claim/rename limits, stats replay/shape rules;
    probe results in `claude/step47/review.md`).
- [x] **A14. (Done, keep verified) free menu wins #67, SAT spam #68.**
  - evidence: PR #67 (fix/menu-free-wins) and PR #68 (fix/sat-spam) merged to main (main 115f5e6 →
    0c1fe74); both specs (`e2e/menu-no-free-wins.spec.js`, SAT spam spec) ran green in PR #69's CI.
    Re-verify after every economy change.

## Queue order (points-serving steps first)

(Oct 1 resume: A9 → 22 → 47 leaderboard pull-in (A13) → 21 → 19 → 20 → 9 → 23 → 16 → rest; full specs in `claude/QUEUE-specs.md`.)
1. STEP 35 first 5 minutes (in progress) — A1 (feel), A2
2. STEP 24 leaderboard, LIVE on typeaword.com — A13
3. Andy quick wins — A4, A5, A9, A12, + affordable-upgrade notification icons (A1) — STEP 21 adds dots on REBIRTH (ready) and the mark slot (NEW MARK)
4. Menu stimulation: escalating level/rebirth frames, longer type animations + STEP 42 rebirth moment — A1, A2
5. Late-game economy: exponential pops/sound-pack prices, CHAIN/FUSE higher bars + mechanics, mode rewards; FUSE missing-letter steering — A6, A7, A8, A10
6. STEP 34 collection / marks rework — A3, A1
7. STEP 33 sound — A1
8. In-game visual + font pass, live-round check (STEP 39 phone gameplay folded in) — A11
9. STEP 32 daily — A8
10. STEP 37 / 38 bot playtest + bot tuning — A8
11. STEP 43 stats redesign — A1
12. STEP 44 weekly leaderboard — A13
13. STEP 36 word race — A8
14. STEP 45 fine-tune loop round 2 — A11
15. STEP 40 Chromebook perf, STEP 41 failure states (housekeeping-class)
16. STEP 46 final report
