# PROGRESSION v10 — spec (Andy oct2 23:50 + amendment oct3 00:24) — DRAFT, sims in progress

Research: claude/econ-oct2/v10-research.md (Keyboard Escape, Sell Lemons, Antimatter Dimensions, Cookie
Clicker, Pet Sim 99 — cited). Sim: claude/econ-oct2/loop-sim.mjs (real modules), probes v10-probe*.sh,
first-reach metric = the first minute the CURRENT level reaches 50/100/150/225/300/400/600/1000.

## Why today's curve fails (measured)
Baseline (main, 20 h): the median bot first reaches **LV400 at 18 min** (target ≈200 h); strong reaches
LV1000 at 8 h. Cause: KEY tiers (×2.5 XP each) are bought within minutes, rebirth keeps them, so after a
rebirth the re-climb from LV1 costs almost nothing — one word can be dozens of levels. need() above LV30
is polynomial (L^4), and even a pure geometric tail cannot outrun it:

| candidate (20 h) | median first LV100 | median max LV @20 h | verdict |
|---|---|---|---|
| main (L^4 tail) | 18 min | 899 | runaway |
| geometric r=1.10 above LV30 | 9 min | 301 | LV100 far too early |
| geometric r=1.13 | 12 min | 239 | " |
| geometric r=1.16 | 17 min | 198 | " |
| geometric r=1.08 × power^0.85 (above LV30 only) | 4.7 h | 149 | closer |
| **r=1.08 × power^0.85, ALL levels** | **4.7 h** | 149 | gaps PASS |
| **r=1.08 × power^0.92, ALL levels** | **7.2 h** | 133 | gaps PASS, closest so far |

(power P = KEY tier XP per letter ÷ 10 × rebirth multiplier — the player's own XP strength.)

## Three versions (QUALITY PROTOCOL — the adversarial reviewer's only job: break existing players)

### V1 — POWER-SCALED CURVE (the one the sim supports)
- need(n) = curve(n) × P^α for every level. curve(n) = today's early curve to LV30 (600·1.16^(n−1)), then
  geometric need(30)·r^(n−30). At P = 1 (a new player) the first session is UNCHANGED.
- KEY and rebirth still speed levels — by P^(1−α) (α≈0.92–0.95 → a KEY tier ×2.5 XP = ×1.05–1.08 level
  speed) — and keep their full effect on WINS. So the curve's growth per hour beats KEY's exponential
  income (Andy's rule), and a rebirth's re-climb is never a free burst of levels.
- **Progress is stored as a FRACTION of the level** ({lv, frac}), so buying a KEY tier never shrinks the
  bar (need rises with P; frac is kept). The bar still shows XP numbers: into = frac × need.
- Rebirth thresholds (LV15…600) unchanged; the sim checks every rebirth is reachable inside the gap rules.

### V2 — PURE GEOMETRIC + HARDER REBIRTH GATES (rejected by the sim)
Geometric r=1.10–1.16 above LV30 with no power term. LV100 still arrives in 9–17 minutes, because a
rebirth keeps KEY tiers and the re-climb is free. Would need rebirth gates far above LV600 to compensate.

### V3 — KEYBOARD-ESCAPE STYLE (K1 + rebirth ladder) (rejected by the sim)
KEY priced in words past T8 (K1) + rebirth multiplier gentle-then-explosive. K1 alone left the next KEY
15–35 min away and did not slow levels (claude/econ-oct2/k1.md); levels still run away after rebirths.

## EXISTING PLAYERS — the decision Andy must make (amendment: "fair rescale" vs "minor edge")
Top-8 board rows today (anon read; private cloud saves are not readable — the sim uses these rows):

| # | name | LV | R | lifetime words | wins/word |
|---|---|---|---|---|---|
| 1 | snapplemelon | 195 | 4 | 606 | 55,774 |
| 2 | Xavi | 168 | 8 | 849 | 1.0e9 (stale, never re-submitted) |
| 3 | elol | 156 | 7 | 321 | 1.15e7 |
| 4 | NoBuffCookies | 147 | 6 | 0 | 2.1e6 |
| 5 | Daan | 144 | 9 | 1,196 | 16,831 |
| 6 | Tangie | 126 | 10 | 1,013 | 85,315 |
| 7 | maSON_im_cRYAN | 119 | 8 | 512 | 25,465 |
| 8 | creator | 118 | 6 | 193 | 3,754 |

- **Option K (KEEP levels):** under V1 nobody loses a level, rebirth, wins, mark or tier; only the cost of
  the NEXT levels changes (P^α). Board order unchanged, shift 0%. The fraction storage keeps every bar
  where it is. Risk: today's top players sit far above where v10 time would put them (LV195 from ~1 h of
  typing; under v10 a median player reaches LV100 at ~7–10 h).
- **Option H (HOURS-equivalent):** convert each save to the level a v10 player reaches in the same play
  time. Monotone in level, so board ORDER is preserved — but the shift is huge (LV195 → roughly LV50–60,
  −70%), which the amendment says "needs a fix, not a shrug".
- Recommendation: **K for levels + rebirths + marks + tiers**, and **H only for the spendable WINS
  balance** (failure mode 1: a 1e15 balance must not buy 40 KEY tiers on day one) — capped like the v9
  migration at N KEY-tier prices. ANDY DECIDES.

## The 11 failure modes → how V1 handles each (implementation plan)
1. RUNAWAY (LV5222): P^α makes levels cost scale with power, so dozens of KEY tiers can't buy hundreds
   of levels; the wins balance is capped on migration; sim adds a "1 QA balance" player (must not reach
   LV1000 in a session).
2. STALE BOARD ROWS (Xavi): migration 015 adds profiles.econ_version; rows below 10 show "—" for
   wins/word until their client re-submits (server can't recompute a client-side rate exactly).
3. OLD CACHED CLIENT: the save + every submit carry econ_version=10; lb_submit2/lb_save refuse < 10 →
   the client reloads (G1 + SW fixes already make a stale tab reload onto the new build).
4. OLD SAVES RESURFACING: migrateEconomyV10 runs on load by taw.econ version, idempotent (stamped);
   cloud restore goes through it too.
5. REBIRTH WALL: sim checks every existing save's time to its next rebirth threshold.
6. DEAD-BAR SHOCK: fraction storage keeps the bar; the sim reports time-to-next-level per existing save;
   one-time notice "LEVELS GOT HARDER — YOUR PROGRESS WAS CONVERTED".
7. UNLOCK GATES: report hours to LV50 (CHAIN) / LV100 (FUSE) — at α 0.92 the median reaches LV50 at ~1 h
   and LV100 at ~7 h → **FUSE over ~10 h for casual: flag to Andy**.
8. CLOUD-SAVE SCORE: localScore must be recomputed after migration (lower) → lb_reset_ack-style
   server path (014 lb_self_reset pattern) so the cloud accepts the converted save once.
9. OVERFLOW: need() at LV1000+ with P up to 1e300 stays finite (test), formatNum everywhere.
10. PRICES: per-level codes, achievements (words at the live rate) and mark rolls priced in words —
    unaffected by the level curve; checked in the sim.
11. COPY: the bar, stats, board, receipts, tutorials read need()/frac — one source.

## Open (sims running at 01:45 ET): 200 h runs for α 0.95 @ r 1.08 and α 0.92 @ r 1.09 → LV225 ≈ 50 h,
LV400 ≈ 200 h targets; then the adversarial review; then implementation on a branch; merge only if all
11 pass.

## Calibration log (median skill, power-scaled at ALL levels, α 0.95, tail multiplier K above LV30)
| K | r | LV100 | LV225 | LV300 | LV400 | max @200h |
|---|---|---|---|---|---|---|
| 1 | 1.02 | 2.8 h | 8.7 h | — | 32 h | — |
| 3 | 1.03 | 5.6 h | 29 h | — | — | — |
| 4 | 1.025 | 6.0 h | 25 h | 51 h | — | — |
| 8 | 1.025 | 8.5 h | 35.9 h | 73.6 h | — (LV393) | 393 |
Target: 10 h / 50 h / 200 h. K8 r1.025 is the closest so far: early pacing right, LV225 a bit early.
| 8 | 1.028 | 8.9 h | 44.4 h | 100 h | — (LV366) | 366 |
r1.028 fixes LV225 but LV400 drops out of 200 h → a steeper tail is wrong; next: K10 r1.025 (uniformly later).
| 10 | 1.025 | 9.6 h | 41 h | 83 h | — (LV379) | 379 |
One r can't hit both LV225≈50 h and LV400≈200 h (late levels speed up as rebirth power compounds). Next: a two-segment tail (v10-probe-2seg.sh) — K10, r1.028 to LV225, then r1.018.
| 10 | 1.028 → 1.018 above LV225 | 10.1 h | 49.2 h | 96 h | — (LV379) | 379 |
**CHOSEN: K10, r1.028 to LV225, r1.018 above** — LV100 10.1 h and LV225 49.2 h hit the targets. The peak stays LV379
in every run because the sim's bots REBIRTH around LV225–260 (R12 from LV260): "LV400 ≈ 200 h" is reached only
by a player who stops rebirthing, so it is a rebirth-policy number, not a curve number. Next: all 3 skills at 200 h.

## ADVERSARIAL REVIEW (oct3 10:55, only job: break existing players) — verdict: SAFE TO IMPLEMENT WITH FIXES
Ranked breakages of the plan as written, and the MUST-FIX list the implementation now follows:
1. CRITICAL — reading an old save against the new curve collapses or bursts the bar (LV195 R4: need ×1,700 → a 99% bar
   becomes 0.06%; a high-level T0 R0 save: the new tail is CHEAPER above ~LV75 → into ≥ need → zeroed, or free levels via
   creditXp's carry loop). FIX: freeze today's curve as needV9(); convert ONCE as f = clamp(into / needV9(lv), 0, 1−1e-9);
   levelFromXp uses needV9; legacy is detected by SHAPE (no v:10), never by the taw.econ stamp; clamp, never zero.
2. CRITICAL — P rises (KEY buy ×2.39/tier, AUTO-KEY, a higher-tier restore) or FALLS (cloud restore by score, old backup
   import, admin reset) mid-level → the bar moves backwards / zeroes / bursts. {lv, into, p} + rescale only works if every
   writer stamps p and a missing p never defaults to 1 (×26,800 burst at T10 R4). FIX: store a FRACTION {lv, f, rc, v:10};
   into = f × need for display only.
3. HIGH — need() can be Infinity → round10 → 0 → creditXp's while-loop never ends (keyTierXp is Infinity from ~T772; the
   tail overflows ~LV36k). FIX: need always finite and > 0 (P capped 1e300, result ≤ MAX_VALUE); creditXp breaks out on a
   non-finite need; tests at T1000 and LV1e6.
4. HIGH — a stale tab / old bundle on the same localStorage keeps farming the OLD curve (LV400 in 18 min) and spreads it:
   lb_save accepts equal-or-higher scores, restore copies the blob to other devices, lb_submit2 accepts it at 0.5 lv/s; an
   econ_version argument does nothing because old clients don't send it. FIX: version-gate by SIGNATURE (lb_submit3,
   lb_save2, lb_load2 with p_econ; revoke/no-op the old ones); locally a legacy-shaped taw.xp written after the stamp never
   raises the level; rc honours a rebirth done elsewhere.
5. HIGH — cloud restore + backup import skip the migration (pre-STEP-52 blobs have no taw.econ; progressScoreFromKeys still
   reads taw.xp.lv). FIX: importSave writes the blob's taw.econ (or removes it); the score reads the authoritative level;
   new keys join PROGRESS_KEYS.
6. HIGH — the rebirth WALL for existing high-R players (Tangie R10 LV126 → R11 needs LV225: ~36 h stuck; Daan ~24 h;
   maSON ~18 h). FIX: sim the 8 real rows on the CHOSEN curve; retune the gates above R8 or grandfather a one-time gate.
7. MEDIUM — the wins cap is a LOSS and misses its target (T10's cap ≈ 7.3e15, so a 1e15 balance isn't capped; a T5 player is
   cut to ~9.4e11). Under P^0.95 a big balance no longer runs away anyway. FIX: drop the cap and the "—" wins/word blanking.
8. MEDIUM (Option H only) — 015's lv<old.level return would freeze the whole submit. → choose K.
9. LOW-MED — K=10 is a ×10.3 cliff at LV31. FIX: ramp K in over LV30–40 (K^((n−30)/10)), re-sim.
10. LOW — the LV5222 row stays #1 forever and its bar is permanently frozen (need ≈ 5e46). FIX: admin-reset it (012).
11. LOW — after the first KEY buy a tier is ×1.05 level speed instead of ×2.5: early levels slower than today. Tell Andy.
NOTE: v10-existing-players.md was computed on K8 r1.025; the chosen curve needs ~2× more at LV195–225 → REDO it from a sim
of the 8 real rows (heavy; next free slot).
