# Old-notes audit (Andy oct3 11:52: "anything left out?")

Verified against PRODUCTION on 2026-10-03: typeaword.com bundle `index-BcahT3XL.js` / `index-BiyQtolx.css`
plus every lazy chunk it references (67); backend `GET /version` → `8858b91` (= backend `origin/main`).
Branch with the fixes: `feat/old-notes-audit` (off `origin/feat/audit-leftovers`).

| # | Item | Status | Fixed here? |
|---|------|--------|-------------|
| 1 | Blitz list-only / AI BUILT ribbon / never claims AI judging | PARTLY (now TRUE on the branch) | yes, SEO FAQ heading |
| 2 | Buying a cosmetic auto-equips; pops/sounds pricier + drawn smaller | TRUE | - |
| 3 | "Where your wins came from" cut down | TRUE | - |
| 4 | Bigger dots, only when actionable | TRUE | - |
| 5 | Mode power obvious + true on the cards | PARTLY (now TRUE on the branch) | yes, phone SAT row |
| 6 | Backend fix/blitz-data-rebased + fix/wb-combo-support-rebased | neither is on main | recommend close both (see below) |

## 1. Blitz list-only: PARTLY → fixed
- Backend prod = `8858b91`. `categoryBlitzLogic.js:616` `CATEGORIES = BLITZ_LISTS.NAMES.filter(!BENCHED)`, so the
  pool in play is exactly the 88 curated closed lists minus 7 benched, which is **81 categories**.
- I compared them with `BLITZ-ENUMERABILITY.tsv` (176 ENUMERABLE / 270 OPEN): **0 live categories are OPEN**.
  48 match an ENUMERABLE row by name. The other 33 are curated renames of ENUMERABLE concepts, e.g.
  "Bones of the human body" = "Human bones", "MLB teams", "F1 teams (2026 grid)", "Pixar feature films".
  126 ENUMERABLE rows are not in rotation because they have no curated list yet, which is fine since it
  is a subset. **Backend: no change needed.**
- The "AI BUILT" ribbon is live: `GameCard.jsx:386`; bundle has `"game-card-ribbon is-ai"... children:"AI BUILT"`.
  ModeDialog shows the `AI` + `BUILT` badge.
- Searching the live bundle for AI-judging claims found only the mode name "AI CATEGORY BLITZ" and the ribbon. No
  "judged by AI" or "AI checks" copy. In-game "checking…" (ai_check) is dead code; the server never sends it (GameScreen.jsx:5073).
- **Left out:** the SEO page `public/category-blitz/index.html:120` (served live at /category-blitz) had the FAQ heading
  **"How does the AI judging work?"**, which is a claim of AI judging even though the answer denies it.
  **Fix:** the heading is now "Does an AI judge my answers?" and the answer starts with "No.". No e2e asserts it.
- Note: the mode is still named "AI Category Blitz" in index.html meta and JSON-LD. That is a name, not a
  judging claim, so I left it.

## 2. Cosmetic auto-equip + pricing/size: TRUE
- `src/progress/shop.js:149-151`: `buy()` calls `equip(id)` and returns `equipped: true`. Live: `...UE([...Hc(),e]),XE(e),{ok:!0,wins:r,equipped:!0}`.
- Prices: `POP_PRICE_BASE = 6000`, `SOUND_PRICE_BASE = 10000`, `COMPOUND ×5` (shop.js:21-23). Live: `$E=5,Tt=6e3`.
- Smaller: `ShopScreen.jsx:322/339` `shop-grid--compact`, card `shop-card--compact` (:499). Live CSS has
  `.shop-card--compact{min-height:0;padding:8px 6px;...}` and a 6-column compact grid on wide screens. KEY POWER stays big.

## 3. End-game breakdown: TRUE
- `PayoutBreakdown.jsx:105` `ROUND_ROWS_SHOWN = 3`. Live: `const vn=3;...s.rows.slice(0,vn)`.
- Today `RoundPayout` shows: the title, one "N WORDS × BASE" line, **at most 3 factor rows**, at most 1 "+ n MORE" row,
  the winner-bonus row(s) when won, and TOTAL. That is at most 7 lines (6 without a win bonus). Before it showed up to 9 factor rows.
- It is used only in WB/Blitz game-over (GameScreen.jsx:4033). Solo game-overs (CHAIN/FUSE/SAT) have no "came from" panel.
- Observation, not changed: the WINNER bonus shows twice, once as a line in `WinsEarnedTotal` (GameScreen.jsx:4030)
  and again as a bonus row in `RoundPayout`. If Andy wants it cut further, drop the bonus rows from RoundPayout.

## 4. Notification dots: TRUE
| Dot | Condition | Size (live CSS) |
|-----|-----------|-----------------|
| SHOP (desktop `.homepage-shop-dot`, phone `.hp-m-dot`) | `canAffordAny()`: an unowned affordable cosmetic, OR the next Key Power tier, OR the next forge (only once forge is open). Themes are excluded (shop.js:186-200) | 20×20px, 3px ring |
| REBIRTH | `level >= rebirthThreshold(rebirths)` (Homepage.jsx:938) | 20px |
| MARKS (MenuXp, phone) | `hasUnseenMarks(unlocked)`, i.e. an unlocked mark not yet seen | 20px |
| BOARD (trophy) | `hasRankNews()`, i.e. an unread rank-up that clears on visit | `max(20px, 20% of hero)` |
| STATS/claims | a count badge only while `claims.length > 0`; STATS then opens the claims | 30px pill |
- All are pink, flat, with a 3px black ring. The pulse is a finite 2-iteration transform (MenuFrame.css:131-137).
- Minor: the shop shows the forge at `level >= FORGE_UNLOCK_LEVEL`, but `canAffordAny` needs `layerOpen('forge')`. So the dot can
  *under*-report a forge buy. It never lights for something you cannot act on.

## 5. Mode power on the cards: PARTLY → fixed
- Real multipliers, `xp.js:22`: WB 2, Blitz 2, SAT 10, CHAIN 4, FUSE 2, RACE 3. `modePower` is relative to WB, giving SAT ×5, CHAIN ×2,
  FUSE ×1, RACE ×1.5. Live: `"sat-rush":10,chain:4,fuse:2`. Frenzy is `FRENZY_MULT = 5` (frenzy.js:21).
- Desktop cards (`GameCard.jsx:285-296`): SAT "POWER ×5", CHAIN "POWER ×2", FUSE "ALL LETTERS → FRENZY ×5", and WB/Blitz/Race
  "WIN → YOUR GAME ×N". The `WINS / WORD` figure includes the mode factor, so the per-word order SAT > CHAIN > FUSE = WB
  is visible and true.
- Phone solo band (`MobileMenu.jsx SoloPerk`): CHAIN "POWER ×2", FUSE "FRENZY ×5". True.
- **Left out:** on the phone, the SAT RUSH row showed only "SAT VOCAB, ARCADE SPEED. SOLO.", with no power. So the mode that pays
  most per word did not say so on phones. **Fix:** the SAT row's description now ends with an accent-coloured
  " POWER ×5", read from `modePower` (MobileMenu.jsx and `.hp-m-perk` in MobileMenu.css). Like the description, it is
  hidden on very short rows (container height ≤150px). No e2e asserts `.hp-m-desc`.

## 6. Backend branches: neither is on main
Both branches fork from `7b5d6db` and are **24 commits behind** `origin/main` (`8858b91`). `git cherry` marks every commit `+`,
meaning not on main, and none of their new files exist on main.

- **fix/blitz-data-rebased** (9 commits, 09-09..09-10): an accept-list audit, wrong-accept seeds, an LLM sweep, an answer-LENGTH
  difficulty model + score normaliser, and a tier-distribution test. All of it targets the old OPEN pool (`categoryAnswers` accept lists,
  `RAW_CATEGORIES` tiering). STEP 9 (list-only) replaced that pool: play now runs only on `blitzLists.json`, and categoryAnswers is
  tooling only. A merge dry-run gives a CONFLICT in `categoryBlitzLogic.js`.
  **Recommend: CLOSE.** Reason: superseded by STEP 9 list-only, because the lists it repairs are no longer in rotation.
- **fix/wb-combo-support-rebased** (3 commits, 09-09): weights WB combos by SUPPORT (common words containing them, from a new
  `data/top3k.txt` + `comboSupport.json`), drops combos with support < 8, and makes the bot's miss/delay scale with support. Main still
  uses length + pool-size rarity weighting (`gameLogic.js:145-262`). A merge dry-run gives CONFLICTS in `roomManager.js`, `wordBombBot.js`
  and `wordBombBot.test.js` (BA1 / bot-balance work landed since). `gameLogic.js` auto-merges.
  **Recommend: CLOSE as-is.** It is a stale Tier-1 gameplay change that conflicts with the bot tuning already shipped. If support
  weighting is still wanted, re-port only the `gameLogic.js` combo-weighting part onto current main as a fresh branch, then run the
  2-context test. Do not merge the old bot changes over BA1.
