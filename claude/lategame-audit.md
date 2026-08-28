# JOB 19 — What does a LEVEL 50 player see?

Report only. No product code changed. Branch: `chore/lategame-audit` off `origin/main`.
Simulated a late-game save, injected it via Playwright/Chromium into a real preview build
(`vite build` + `vite preview` @ :4321), and observed the menu, SHOP, REBIRTH and STATS.

Target profile: **LV50, R3 (3 rebirths), 150,000 wins, all 5 themes owned, KEY POWER T6,
2,000 distinct words collected.**

---

## 1. The exact localStorage save

Read out of `xp.js` / `wins.js` / `shop.js` / `themes.js` / `unlockLadder.js`. Every value below
is the literal string localStorage holds (JSON where the loader does `JSON.parse`, bare strings
otherwise). Cosmetics are set to **fully maxed** (every pop style + sound pack owned) because a
player with 150k wins and ~4.8M lifetime would have bought out every sub-2,000-win cosmetic long
ago — leaving them unowned would be fiction. Themes: all 5 owned as specified.

```json
{
  "taw.xp":          "{\"lv\":50,\"into\":3500000}",
  "taw.wins":        "150000",
  "taw.winsLifetime":"4850000",
  "taw.rebirths":    "3",
  "taw.keytier":     "6",
  "taw.owned":       "[\"classic\",\"chrome\",\"inferno\",\"void\",\"prism\",\"thock\",\"clack\",\"cream\",\"marble\",\"typewriter\",\"silent\"]",
  "taw.equipped":    "{\"popStyle\":\"prism\",\"soundPack\":\"silent\"}",
  "taw.theme":       "prism",
  "taw.themesOwned": "[\"default\",\"midnight\",\"inferno\",\"toxic\",\"prism\"]",
  "taw.freeUnlocks": "[\"frame-bolt\",\"frame-tape\",\"frame-chrome\",\"frame-spike\",\"frame-gold\",\"rebirth-1\",\"rebirth-2\",\"rebirth-3\"]",
  "taw.rounds":      "{\"wordBomb\":210,\"blitz\":95,\"satRush\":140}",
  "taw.letters":     "260000",
  "taw.taps":        "4000",
  "taw.seenWinsHint":"1"
}
```
Plus `wa_last_seen = <now>` to skip the intro (not a `taw.*` key).

Notes on shape:
- `taw.xp` is the Economy-v5 `{lv,into}` object — **not** cumulative XP. `into` must be
  `< need(50) = 7,006,490`; 3.5M is a mid-level value. There is no "total XP" key anymore.
- `into: 3.5M` renders as the readout **"3.5M / 7.0M"**.
- **`2,000 distinct words collected` has NO storage key on `main`.** The record surface
  (`taw.records`, OBSCURE FINDS / LUCKY WORDS) lives only on the unmerged `feat/record-surface`
  branch. On `main` there is nothing to persist a vocabulary count and nothing that reads one.
  This is a finding, not an omission (see GAPS).

---

## 2. What the player actually sees (observed live)

### MENU
- **Title** TYPE A WORD in the **PRISM** theme (pink/purple), `<html data-theme="prism">`.
- **LV chip:** `LV 50`, pink outline. **Rank chip:** `MENACE` (yellow).
- **XP bar:** `3.5M / 7.0M`, fill `data-reb="3"` (top rebirth fill colour — see below).
- **Wins chip:** `150.0K` (opens SHOP).
- **NEXT-unlock teaser:** `NEXT · PRESTIGE 4 FRAME · REBIRTH 4`.
- **Menu frame:** `data-menu-frame="rebirth-3"` — the PRESTIGE 3 badge frame is applied.
- **SHOP affordable-dot: OFF.** `canAffordAny()` is false — every cosmetic is owned and the only
  unowned good (KEY POWER T7) costs 155× their balance. So the "something to buy" pip is dark.
- **REBIRTH button: present** (rebirths > 0).
- **Game cards: all 5 unlocked, zero locked.** CHAIN (gate LV20) and FUSE (gate LV25) are open.
  Every card's per-word rate is annotated with the live rebirth boost, e.g. `20 WINS / WORD (×2.5)`,
  FUSE `300 WINS / WORD (×2.5)`.

### SHOP  (screenshot: `shop.png`)
- **THEMES:** DEFAULT / MIDNIGHT / INFERNO / TOXIC all show **EQUIP**, PRISM shows **EQUIPPED**.
  Nothing to buy.
- **KEY POWER — TIER 6:** current `2,350 XP PER LETTER`. `NEXT TIER: 5,875 XP · 23.3M WINS`.
  `YOUR RATE: 50 WINS / WORD`. Goal line: **`UNLOCKS AT 23.3M WINS — YOU HAVE 150.0K`**
  (progress bar at **0.64%**). Buy button disabled.
- **POP STYLES / SOUND PACKS:** all 11 read OWNED/EQUIPPED. Nothing to buy.

So the entire shop offers the player **one** purchasable thing — KEY POWER T7 — at a price 155×
their current wins and ~4.8× their entire lifetime earnings.

### REBIRTH  (screenshot: `rebirth.png`)
- `REBIRTHS 3` · `CURRENT MULTIPLIER ×2.5` · `NEXT REBIRTH AT LEVEL 60` · `NEXT MULTIPLIER ×3`.
- Goal: `10 LEVELS TO GO — LV 50 / 60`.
- LOSE all XP → LV1 · KEEP wins/purchases/lifetime · GAIN permanent **×3** XP.
- Action button **disabled**: `REACH LEVEL 60 TO REBIRTH — YOU'RE LV 50`.

### STATS  (screenshot: `stats.png`)
`LEVEL 50 · RANK MENACE · XP INTO LEVEL 3.5M · REBIRTHS 3 · LETTERS TYPED 260.0K · TAPS 4,000 ·
WINS BALANCE 150.0K · WINS EARNED (ALL-TIME) 4.8M · KEY POWER T6 · BASE XP/LETTER 2,350 ·
REBIRTH ×2.5 · MENU XP/LETTER 5,880 · WORD BOMB 210 · CATEGORY BLITZ 95 · SAT RUSH 140.`
No vocabulary / words-collected row exists.

Console: one benign `404` (a static asset under `vite preview`); **zero** JS/React errors, no
red gameplay errors.

---

## 3. The questions, answered bluntly

**Is anything still LOCKED at LV50/R3?**
No. All 5 game modes are unlocked (last gate was FUSE @ LV25). All 5 themes owned. All frame
cosmetics through LV35 (GOLD) earned. There is no level-gated content left in the game — the
last content gate is 25 levels behind them.

**Is anything still worth BUYING?**
Effectively no. All cosmetics + themes are owned. The **only** remaining sink is **KEY POWER T7 =
23,328,000 wins** (T6 was 3,888,000; the tier cost steps ×6). At their top realistic earn rate
(FUSE, 300 × ×2.5 rebirth = 750 wins/word) that's **~31,000 accepted FUSE words** for one tier —
and it only lifts XP/letter 2,350 → 5,875, which does nothing but level them slightly faster
toward a rebirth whose reward is itself flattening. Their 150k balance is **dead money**: there is
nothing under 23.3M to spend it on. Every wins payout they see for the foreseeable future is a
number with no destination.

**Next rebirth threshold:** LV60 (10 levels away) for ×3 — a **+20%** bump over the current ×2.5.
The rebirth ladder's early rungs are tiny (×1.5 → ×2 → ×2.5 → ×3 → ×3.5); the big ×100 jump isn't
until R11 @ LV225. A LV50/R3 player is deep in the shallow, low-reward stretch of the prestige
curve.

**Does the menu ACKNOWLEDGE their status?**
Partially, and quietly. Yes: rank title **MENACE**, the **PRESTIGE 3** LV-badge frame, the top
rebirth XP-fill colour, and REBIRTHS/×2.5 in stats. But it's all understated — nothing on the menu
says "R3" in words, the prestige is a frame most players won't parse, and `data-reb` is
**clamped to 3** (`Math.min(3, rebirths)` in `MenuXp.jsx`), so the XP bar looks **identical from R3
onward forever** — a maxed visual tell reached at only the 3rd of 20+ rebirths.

**Where does the progression run dry?**
Three treadmills, and two of them are already dry at LV50/R3:
1. **Content:** dry since LV25. Nothing new to unlock, ever.
2. **Shop/wins:** dry. One item priced 155× out of reach; balance can't be spent.
3. **Levels/rebirth:** still moving but **rewards shrinking** — 7M XP/level, ×3 next rebirth
   (+20%), then ×3.5. The only *infinite* acknowledgement is the `PRESTIGE N` frame teaser, which
   mints a new (near-identical) LV-badge frame per rebirth — cosmetic confetti, not a chase.

**What does a devoted player stare at with nothing to chase?**
A menu that says LV 50 / MENACE / 150K wins, a shop where literally everything is EQUIPPED except a
23-million-win wall, a rebirth button that's greyed out for 10 more levels to buy a 20% multiplier,
and a stats page that has **no idea they know 2,000 words.** The moment-to-moment loop (type → pops
→ XP → occasional level-up) still fires, but every meta destination is either owned, unreachable, or
invisible. The wins counter keeps ticking up into a void.

---

## GAPS / RECOMMENDATIONS

1. **The wins sink cliff (biggest gap).** Between T6 (3.9M) and T7 (23.3M) there is a 19.4M-wide
   dead zone with nothing to buy. A 150k balance — and everything earned up to 23.3M — has zero
   purpose. **Fix:** add mid-tier sinks in that gap (consumables, one-run boosters, prestige-only
   cosmetics priced 200k–5M), or flatten the ×6 tier-cost step so tiers stay within a session or
   two of reach.

2. **Vocabulary is completely invisible on `main`.** 2,000 distinct words is arguably the most
   impressive thing a devoted player has done, and nothing surfaces it — no stat, no record, no
   badge. The `feat/record-surface` work (OBSCURE FINDS / LUCKY WORDS) is exactly the missing
   acknowledgement but is unmerged. **Fix:** ship a words-collected count in STATS at minimum
   (cheap, one `taw.*` counter + one row), and land the record surface. Vocabulary should be a
   named chase.

3. **The rebirth reward curve is backwards for retention.** The first rebirths (×1.5→×2→×2.5→×3)
   give trivial bumps while asking for a full XP reset; the exciting ×100 is 8 rebirths and ~175
   levels away. A LV50/R3 player has done the resets and felt almost nothing. **Fix:** front-load a
   little more multiplier, or attach a *visible* per-rebirth reward (a real cosmetic, a rate boost)
   so the reset feels earned.

4. **Prestige tops out visually at R3.** `data-reb` is clamped to 3, so the XP bar can never look
   more prestigious than a 3rd-rebirth player — a 20-rebirth veteran's menu is pixel-identical.
   **Fix:** extend the fill-colour/frame tiers (or add a numeric R-badge) so prestige keeps
   reading upward.

5. **Rank is the one healthy chase — lean into it.** MENACE (LV41-55) still has WARLORD (56),
   DEMON (76), UNREAL (100) ahead. It's the only meta with genuine headroom at LV50. **Fix:** make
   rank louder (rank-up celebration, rank on the share card) since it's carrying the late game
   alone.

Bottom line: at LV50/R3 the *content* and *shop* are exhausted, the *rebirth* reward is thin, and
the player's biggest achievement (vocabulary) is unrecorded. The game keeps handing them wins with
nowhere to spend them.
