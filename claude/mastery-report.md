# JOB 2 — MODE MASTERY (feat/mastery)

Per-mode mastery track M1–M20, earned by words accepted in that mode. Shown as an `M{n}` chip on
the mode card (from M2, to avoid new-player clutter) and a full readout in the mode dialog.

## The perk (and why this one)

**Perk = a per-mode XP bonus: +3% XP for that mode per mastery level above M1 (M1 = base, M20 = +57%).**

The job's own framing is "no reason to pick one mode over another **except payout size**." A perk that
grants *more wins* would just widen the payout axis — the exact thing already differentiating modes.
So the perk is on a **different axis: XP**. Mastering a mode makes *that mode level you faster*, which
compounds the Job-1 unified loop (play → XP → levels) for the mode you commit to. That is a real,
mode-specific reason to keep playing one mode.

It is also the **conservative** choice (user asleep, rails say pick conservative):
- No engine/balance change → cannot invalidate a simulated-balance constant (timers, lives, dead-end
  guarantee, spell-along cadence are all balance-critical and were explicitly ring-fenced).
- Word Bomb and Category Blitz are **server-authoritative** — a client perk *cannot* change their
  timer or reroll count anyway (that needs a backend change, which is out of rails).

### Mechanical perks — PROPOSED, not shipped (need your pick + re-sim)
The spec's mechanical examples are good but each touches balance or the backend. Proposed table for
a later opt-in, once each is re-simulated:

| Mode | Proposed mechanical perk | Blocker |
|------|--------------------------|---------|
| Word Bomb | +0.1s bomb timer at M5/M10/M15 | Timer is **server-set** — needs backend |
| Category Blitz | +1 reroll at M6 | Rerolls are **server-enforced** — needs backend |
| SAT Rush | briefing definition shown +0.4s at M4 | Client-side; safe-ish — touches SAT study timing, re-sim |
| CHAIN | dead-end guarantee +1 at M8 | Client-side; touches `DEAD_END_BELOW` balance, re-sim |
| FUSE | +1 starting life at M10 | Client-side; lives are a spec constant, re-sim |

## Perk table + pacing (from `claude/mastery-sim.mjs`)

Curve: `masteryNeed(n) = round(50 × 1.4^n)` words to leave level n.

| Milestone | Cumulative words | XP perk |
|-----------|------------------|---------|
| M2  | 70      | +3%  |
| M5  | 497     | +12% |
| M10 | 3,440   | +27% |
| M15 | 19,271  | +42% |
| M20 | 104,411 | +57% |

Early levels come fast (M2 at 70 words ≈ one Word Bomb game), so the system reveals itself quickly;
late levels are a long-haul flex (M20 ≈ 1,700 sessions of 60 words). At ~60 words/session: M5 ≈ 8
sessions, M10 ≈ 58, M20 ≈ 1,741 — per mode.

## Implementation
- `src/progress/mastery.js` — the pure model + guarded store (`taw.mastery`), keyed by the XP-style
  mode ids so it co-locates with `awardWordXp`.
- `xp.js awardWordXp` now credits the word to mastery AND applies `masteryXpMult(mode)` to the grant.
  One call per accepted word already wired in Job 1, so no new accept-site plumbing.
- Display: `game-card-mastery` chip (GameCard) + `MasteryLine` (ModeDialog).
- Tests: `mastery.test.js` (6). Full suite 361 green. Build clean. UI verified via seeded screenshot.

## Left undone / flagged
- The mastery XP bonus applies in `awardWordXp` (impure wrapper); the pure `xpPerWord` used by sims
  does not include it, so sim figures are the *floor* — real leveling in a mastered mode is faster.
- SAT Rush mastery chip shows on its menu card but SAT's own start screen doesn't yet show the
  dialog readout (it uses a bespoke StartScreen, not ModeDialog). Minor; noted.
