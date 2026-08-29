# JOB 16 — Scale limits: what breaks at extreme save states

REPORT ONLY. Findings from reading the real modules + running `claude/scale-probe.mjs`
(calls the actual `formatNum` / `need` / `levelFromXp` / `rebirthMult` / `perWordWins` /
`streakMultiplier` and measures a serialized collection). Node v24, `node claude/scale-probe.mjs`.

## TL;DR — first breakage per extreme

| Extreme | Renders | Formats | Storage fits | Overflow / NaN | FIRST break & threshold |
|---|---|---|---|---|---|
| 100,000 distinct words | yes (but capped) | yes | yes (~150 KB) | none | **Silently capped at 5,000 words** (`COLLECTION_CAP`). 100k is unreachable — LRU evicts. |
| Level 600 | yes (no crash) | ugly | yes (tiny) | precision loss | **Level 304**: `need()` exceeds 2^53, economy integer math degrades to float (silent). Visible: 12-char `Qi` readout overflows the XP bar by ~LV450+. |
| Rebirth 20 | yes | yes | yes | none | **No break at R20** (`×1e11`→"100.0B"). First break far away: `rebirthMult` → Infinity at **R318**; `formatNum` garbles ~R50+. Both need LV1,650–15,000+. |
| 1e15 wins | yes | yes ("1.0Qa") | yes (exact) | none | **No break at 1e15.** Wins lose ±1 integer precision above **2^53 ≈ 9.007e15**. No NaN/Infinity ever (formatNum guards). |
| 500-day streak | yes | yes | yes | none | **Nothing breaks** — robust at 500 and at 1e9. Multiplier caps ×1.25; ~71 freeze tokens. |
| Every achievement | yes | yes | yes | none | **Nothing breaks** — ~30 short id strings (<1 KB). |
| Every theme | yes | yes | yes | none | **Nothing breaks** — only 5 themes exist; owned set ≤5 ids. |

The app is well-hardened: `formatNum` coerces NaN/Infinity → `"0"`, every storage read is
try/catch-guarded, XP is stored as `{lv, into}` (not cumulative) so it never approaches the
old MAX_SAFE cliff, and the collection is hard-capped. Nothing in the seven extremes crashes,
NaNs, or blows the localStorage quota. The real issues are (a) **silent integer-precision
erosion above 2^53** in level/wins math, and (b) **`formatNum` producing 12–20-char strings**
above ~1e21 that overflow fixed-position readouts.

---

## 1. 100,000 distinct collected words — `src/progress/collection.js`

- **Renders / storage / NaN: all fine, but the premise is impossible.** `COLLECTION_CAP = 5000`
  with LRU eviction (`recordAcceptedWord` deletes the least-recently-seen word when a new word
  arrives at the cap). The store can **never hold more than 5,000 entries**, so a player who has
  "seen 100k words" only ever has a 5,000-word collection; `countOf()` / `collectionSummary().total`
  max out at 5,000. `formatNum(5000)` = `"5,000"`.
- **Storage measured** (`buildStore` in the probe, realistic 4-int entries `[band,mode,day,recency]`):
  - 5,000 words @ ~8 chars/word → **134.8 KB**; @ ~12 chars → **154.2 KB**. Far under the ~5 MB quota.
  - (Hypothetical uncapped 100k words → 2.7–3.1 MB — still under 5 MB, but see perf note.)
- **FIRST break: the feature itself caps at 5,000 words** — a genuine 100k-word player is
  under-credited (collection frozen at 5,000; milestone ladder tops out at the 5,000 grant).
  No crash, no NaN, no storage overflow.
- **Perf note (advisory):** eviction at the cap is an **O(n) linear scan for the LRU** on every
  new word past 5,000. At 5,000 that scan is negligible. If the cap were ever raised to 100k it
  would be a 100k-iteration loop per accepted word — a real cliff. Keep the cap.

## 2. Level 600 — `src/progress/xp.js`

- **Renders: yes, no crash.** `need(level)` is always > 0, so `levelFromXp`, `creditXp`, and the
  bar fraction (`intoLevel / cost`) never divide by zero. `need()` stays **finite through LV2000+**
  (never Infinity in range).
- **Formats: degraded.** `need(600) = 7.30e25` → `formatNum` = **`"73017794.7Qi"` (12 chars)**.
  `formatNum` stops abbreviating above 1e21 (documented), and `need()` crosses 1e21 around LV~450,
  so late-game level costs render as 8–12-char strings. The XP-bar readout
  (`.menu-xp-readout`, `position:absolute; left:50%; white-space:nowrap` — `MenuXp.css:131`)
  shows `"intoLevel / cost"` ≈ **28 chars centered over a ~760px bar → horizontal overspill past
  both bar ends**. Cosmetic, not a crash.
- **Storage: fine.** Stored as `{lv:600, into:<need(600)}` — a tiny JSON object; the cumulative-XP
  MAX_SAFE cliff was already designed out (Economy v5 note in `xp.js`).
- **Overflow / precision: FIRST break at LEVEL 304.** `need(304)` is the first level cost to exceed
  `Number.MAX_SAFE_INTEGER` (2^53 ≈ 9.007e15). Above LV304, level costs are floats, not exact
  integers: `round10`'s "every credited/displayed +N ends in a zero" invariant **silently breaks**,
  and `intoLevel` accumulation gains sub-unit gaps. Not visible, not a crash — a correctness erosion.
  (Also observed: `levelFromXp(sum-of-needs-to-600)` returns **599**, an off-by-one from float
  rounding of the cumulative sum at 9e26 magnitude — but the app no longer feeds cumulative totals
  to `levelFromXp` except on legacy migration, so impact is negligible.)

## 3. Rebirth 20 — `src/progress/xp.js` `rebirthMult` / `rebirthThreshold`

- **R20 is completely fine.** `rebirthMult(20) = 1e11` → `formatNum` = `"100.0B"`;
  `rebirthThreshold(20) = 650`; stored as the string `"20"`. Renders/formats/storage all clean.
- Beyond R20 (past the table, `×10` per rebirth): `rebirthMult` stays **finite through R317** and
  becomes **Infinity at R318** (would be 1e318 > Number.MAX ≈ 1.8e308). `formatNum` starts emitting
  **malformed scientific-notation** output once the value ≳1e34 (`rc≈43`: probe shows `rc=100` →
  `"1.0000000000000001e+73Qi"`) because after 6 tier-divisions the mantissa is still ≥1e16 and
  `toFixed(1)` yields `"e+NN"`. `perWordWins` at R40 hard = 6e15 → `"6000000000000000.0Qi"` (20 chars).
- **FIRST break for this extreme: none at R20.** First real break is **R318** (mult → Infinity),
  with garbled formatting from ~R43+. All unreachable: R20 gates at LV600, R40 at LV1,650, R318 at
  LV~15,550.

## 4. 1e15 wins — `src/progress/wins.js`

- **1e15 is fine.** `1e15 < MAX_SAFE_INTEGER` (9.007e15) so it's an exact integer;
  `formatNum(1e15)` = `"1.0Qa"`; `String(Math.floor(1e15))` round-trips exactly through
  `getWins`/`saveWins`. Renders, formats, stores cleanly.
- **FIRST break: integer precision above 2^53 ≈ 9,007,199,254,740,991 (~9e15 wins).** `grantWins`/
  `readInt` still run (`Math.floor`/`Number`), but ±1 counting drifts and large additions lose the
  low bits. **No NaN, no Infinity** — `formatNum` keeps producing compact strings well past this
  (`formatNum(9.5e15)`="9.5Qa"); only the string length grows past ~1e21 as in §2.

## 5. 500-day streak — `src/progress/streak.js`

- **Fully robust.** `streakMultiplier(500)` = **1.25** (caps at ×1.25 for count ≥ 30; identical at
  1e9). Count `500` renders directly (or `formatNum(500)`="500"). Stored as
  `{count:500, lastDay, freezes:~71}` — a tiny object. **No break at any tested value.**

## 6. Every achievement earned — `src/progress/achievements.js`

- **Fully robust.** ~30 achievements; earned set is a JSON array of ~30 short id strings (`"vol-1"`
  …) — well under 1 KB. Grid renders each; `formatNum(a.base)` on reward figures is fine.
  **No overflow, no NaN, no storage concern.**

## 7. Every theme owned — `src/theme/themes.js`

- **Fully robust.** Only **5 themes exist** (`THEMES`). "Every theme owned" = an owned set of ≤5
  ids in `taw.themesOwned`. Shop renders 5 cards; prices (max 25,000 → "25.0K") format fine.
  **No break.**

---

## Cases reasoned about, not run headless

- **XP-bar readout overflow at high level** (§2): reasoned from `MenuXp.css:131` (`.menu-xp-readout`
  is absolute, centered, `white-space:nowrap`, no `max-width`/`text-overflow`) + the measured 12-char
  `formatNum(need(600))`. Not rendered in a browser — conclusion is from CSS + string length.
- **Collection LRU O(n) perf cliff if uncapped** (§1): reasoned from the eviction loop in
  `recordAcceptedWord`; not benchmarked.
- **localStorage ~5 MB quota**: standard per-origin string-length quota; the measured byte figures
  are `JSON.stringify(...).length`, the correct unit for the quota. Actual browser `setItem` was not
  invoked (Node has no localStorage; all real accesses are try/catch-guarded and degrade to defaults).

## Suggested (non-blocking) follow-ups — NOT done here
1. Give `.menu-xp-readout` (and the wins chip) a `max-width` + `text-overflow` OR clamp `formatNum`
   to stay ≤ ~6 chars above 1e21 (it already claims "never more than 5 chars before the suffix" — that
   promise breaks above 1e21).
2. If levels above ~300 are intended reachable, the `round10`/integer-exact invariants above 2^53 are
   worth a note or a BigInt path; currently they silently erode (no crash).
