# LV100 ENDGAME AUDIT — what a maxed player sees, and what's left to do

**Method.** Crafted a localStorage save representing a fully-maxed player (keys/shapes read
directly from the source modules), injected it into a production `vite build` served on
`http://127.0.0.1:4173`, hard-reloaded so the app booted from the maxed state, and walked the
menu + SHOP + REBIRTH + STATS. Desktop viewport 1440×900. Screenshot: `claude/endgame-menu.jpg`.

## The save that was loaded

| Key | Value | Meaning |
|-----|-------|---------|
| `taw.xp` | `{"lv":100,"into":0}` | LEVEL 100 (Economy v5 stores level+progress, not cumulative — cumulative-equiv ≈ 17.2B XP) |
| `taw.rebirths` | `5` | R5 done → current XP/wins mult ×3.5 |
| `taw.keytier` | `8` | Key Power T8 (last *tabled* tier; ladder is infinite past T8) |
| `taw.wordsense` | `5` | Word Sense T5 = `WORDSENSE_MAX_TIER` (MAXED) |
| `taw.momentum` | `200` | Momentum 200 = `MOMENTUM_MAX` (MAXED, ×3.0 wins) |
| `taw.mastery` | 104,411 words/mode | Every mode at M20 = `MASTERY_MAX` |
| `taw.themesOwned` | all 5 | default/midnight/inferno/toxic/prism |
| `taw.owned` | all 11 cosmetics | 5 pop styles + 6 sound packs |
| `taw.achievements` | all 32 ids | 32/32 including the 5 secrets |
| `taw.collection` | 5,000 words | = `COLLECTION_CAP`, all milestones claimed |
| `taw.streak` | `{count:365}` | 365-day streak, ×1.25 XP (cap), 52 freeze tokens |
| `taw.wins` / `winsLifetime` | 1.0T | effectively unlimited spendable balance |

## What the maxed player SEES (menu)

- Top HUD: **`1.0T WINS`** · **`365 DAYS ×1.25 XP ❄×52`** · **`LV 100`** · XP bar `0 / 1.4B` · rank **`UNREAL`**.
- Every one of the five game cards wears an **`M20`** mastery badge.
- Nav: `SHOP` (with the "something to buy" dot still lit), `REBIRTH`, `STATS`.
- STATS → ACHIEVEMENTS reads **`32 / 32 EARNED`**; every tile is checked.
- Theme is PRISM (equipped); the whole menu is recolored accordingly.

The menu acknowledges the player's status reasonably well: terminal rank **UNREAL**, **LV 100**,
the maxed streak with its freeze count, and **M20** on all five cards. Two gaps: (1) the **rebirth
count (R5) is NOT badged on the main HUD** — it only appears inside the REBIRTH dialog
("REBIRTHS: 5"), so a passer-by can't tell an R5 player from an R0 one at LV100; (2) nothing on the
menu signals "you've finished everything" — there is no completion/prestige marker.

## What is LEFT to do — track by track

| Track | State at max | Anything left? |
|-------|--------------|----------------|
| Achievements | 32 / 32 | **No** — fully done, incl. secrets |
| Themes | 5 / 5 owned | **No** — nothing to buy, only equip |
| Cosmetics (pops + sounds) | 11 / 11 owned | **No** |
| Word Sense | T5 — **MAXED** | **No** (hard cap at 1.5×) |
| Momentum | 200 / 200 — **MAXED** | **No** — and the copy still reads *"BUY AGAIN, FOREVER — EACH BUY LEAVES A MARK"* while the button says MAXED. The "never-dry sink" **does** run dry at 200. |
| Rank | UNREAL (LV100+) | **No** — UNREAL is the terminal band; every level past 100 keeps the same title |
| Mastery | M20 every mode | **No** |
| **Key Power** | T8, next tier **151.2M wins**, "READY TO UNLOCK" | **Technically yes** — the ×6 cost ladder extends forever, so there is always a next tier. But it only raises XP-per-letter → more levels, and levels past 100 unlock **nothing** (rank terminal, all theme gates passed). Pure number-go-up. |
| **Rebirth** | R5, R6 **READY** at LV100 (×4 next); ladder runs to R20 (×1e11) then +50 lv/×10 forever | **Technically yes** — infinite. But a rebirth only multiplies XP/wins gain, and both currencies already buy nothing that isn't owned/maxed. |

## Verdict — is anything left? Practically NO.

**There is effectively nothing meaningful left for a LV100 / R5 maxed player to do.** Every
*content* and *cosmetic* track is exhausted: all 32 achievements, all 5 themes, all 11 cosmetics,
Word Sense maxed, Momentum maxed, every mode at M20, the collection at its 5,000 cap, the rank at
its terminal UNREAL band. The only two tracks that remain "open" — **Key Power tiers** and
**Rebirth** — are both pure number-inflation loops: they cost/grant ever-larger XP and wins
figures, but **no new content, cosmetic, rank, achievement, or capability is gated behind either
of them past this point.** With 1.0T wins already banked and everything owned, there is no sink to
spend toward and no goal to climb toward — the loop is "make the big number bigger for its own
sake." That is the endgame problem, and it is worth naming plainly: **the game has no designed
terminal goal or prestige payoff; it just keeps offering multipliers that multiply nothing you
still need.**

If a fix is wanted, the cheapest levers are: (a) badge R-count + a "MAXED/prestige" marker on the
menu so the accomplishment is *visible*; (b) gate *something* new behind high rebirths (a theme, a
title, a cosmetic) so the infinite track pays out occasionally; (c) fix the Momentum copy
("forever") which currently contradicts its own 200 cap.

## Caveats (environment / fidelity)

- `taw.records` (PERSONAL RECORDS: rarest word, best-streak-in-a-mode, distinct-word record) was
  **not** in the seed key-list, so the STATS → PERSONAL RECORDS tiles render their empty
  placeholders ("ACCEPT A WORD", empty bars). This is a seeding gap, not a product bug.
- The full achievement id-set was written directly to `taw.achievements`, so tiles a *live* R5
  player wouldn't yet qualify for (e.g. ETERNAL = rebirth ×10) also show earned. This over-states
  earned count vs. a legitimately-played R5 save, but was intentional to render the "everything
  unlocked" endgame view the task asked for.
- Screenshot is from a local `vite preview` build; the Vercel-preview `<vercel-live-feedback>`
  pill is absent here (good — it's not app chrome).
- Mobile caveat: this box's Chrome renders the menu at desktop width; a true 360–414px mobile
  capture wasn't taken. The HUD is known to wrap on narrow widths but no mobile-specific endgame
  regression was observed at desktop width.
- Console was clean on observation (tracking started post-load, so not authoritative for boot).
