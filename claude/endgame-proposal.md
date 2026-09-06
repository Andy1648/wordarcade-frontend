# ENDGAME PROPOSAL — one substantial, costed addition (PROPOSE, not built)

## The problem this must solve

Per `claude/endgame.md`: a LV100 / R5 maxed player has exhausted every *content* and *cosmetic*
track, and the only two open loops — Key Power tiers and Rebirth — are pure number-inflation:
they grow XP/wins figures that already buy nothing. The three fixes shipped on this branch
(rebirth badge, the R10 PRESTIGE frame, the honest MOMENTUM copy) make the accomplishment
*visible* and give the rebirth track *one* payout, but they do not create a renewable reason to
keep playing. A finished account still runs out of goals. The endgame needs a loop that is
**bounded per session** (so it can't be ground into another big number) yet **infinite in calendar
time** (so it never fully completes), and whose rewards are **skill records, not multipliers**.

## The proposal — DAILY CASE FILE (a deterministic, seeded, once-a-day SAT RUSH run)

A single new mode entry, "DAILY CASE FILE," that plays the existing **SAT RUSH** engine over a
**date-seeded, identical-for-everyone word order** — the Wordle pattern applied to the mode the
game already has. One attempt per calendar day. It is scored, medalled, and streaked; it grants
**no wins, no XP, no multiplier** — the reward is a **medal, a daily-play streak, and a season
record**. Because the maxed player's currencies are meaningless, the fix is deliberately to stop
paying in currency at all and pay in *status you can only earn by showing up and playing well.*

### How it works (reuses existing systems — low build risk)
- **Engine:** the pure `src/satRush/engine.js` is already deterministic given its word queue; add a
  tiny seeded shuffle (`mulberry32(dateSeed)`) that fixes the word order + deep-cut positions from
  `YYYYMMDD`. No timers change; the hook (`useSatRushGame.js`) still owns the clock. The word pool
  is the existing `words.recall.txt` — **no backend, no network** (seed = the date, list ships in
  the bundle).
- **Store:** one new guarded key `taw.daily` = `{ lastDay, streak, bestStreak, medals:{bronze,
  silver,gold}, season:{id, gold} }` — same shape/discipline as `taw.streak` and `taw.records`.
- **Surface:** the DAILY CASE FILE card joins the existing menu card grid (no orphan fixed UI); the
  medal + daily streak render as a chip in the same HUD cluster the rebirth badge just joined.

### The numbers

| Lever | Value | Rationale |
|-------|-------|-----------|
| Attempts / day | **1** (a 2nd costs **250,000 wins**) | Bounded: you cannot grind it into a big number. The retry price is a token *sink* for the meaningless bank, not a gate. |
| Run length | fixed **25-word** seed, one life | ~2–4 min — a daily ritual, not a session. |
| Medal thresholds (captures) | **bronze ≥ 10 · silver ≥ 17 · gold ≥ 23 · PERFECT = 25** | Gold demands answering deep cuts *early* (the SAT RUSH skill), so it stays hard even for a maxed player. |
| Daily-play streak | +1 per day played; **freeze-token-compatible** (reuse `streak.js`) | The renewable hook — a broken streak is the only thing at stake, and it renews forever. |
| Season | **30-day** rotating id; tracks gold-count that resets each season | An infinite ladder of *finite* 30-day goals (e.g. "9 golds = season badge"), never a running multiplier. |
| Wins granted | **0** · XP granted | **0** · Multiplier | **0** | The whole point: no inflation feedback. |

### How much meaningful play it extends
It converts a *completed* account (0 remaining goals) into an **indefinite daily 3-minute ritual**:
one bounded run per day, a streak worth protecting, and a fresh 30-day season goal 12× a year.
For a maxed player this is the difference between "nothing left" and a reason to open the app most
days for **months** — measured in *calendar days retained*, not hours grindable in one sitting.

### Why it is NOT more number-inflation
Three structural guards: (1) **bounded** — one scored run per day, so no amount of play makes any
number bigger faster; (2) **non-multiplicative rewards** — medals/streak/season are records of
*skill on a fixed seed*, and nothing they grant feeds back into earning rate, so they can never
compound the way Key Power × Rebirth × Momentum do; (3) **the only growing number (lifetime gold
count) is a scoreboard, not a power** — it multiplies nothing. The 250k-win retry is a *drain* on
the meaningless bank, deliberately not a *source*. If a leaderboard backend is ever added, the
same seed makes cross-player daily ranking free — but the mode is fully self-contained without it.

### Build cost (honest)
One seeded-shuffle helper + one store module + one menu card + one results/medal overlay, all on
top of the existing SAT RUSH engine and streak/records plumbing. No engine-timing changes, no
backend, no economy edits. The riskiest surface is the store migration (additive key, defaults to a
fresh object) — Tier 2 at most. Est. one focused session.
