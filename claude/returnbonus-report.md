# JOB 6 — RETURN BONUS (feat/return-bonus)

On returning after **≥ 6 hours away**, a one-time **WELCOME BACK** grant of
`min(hoursAway, 12) × 100 × rebirthMult` wins, **at most once per calendar day**. A small static card
appears top-center of the menu and is dismissed on any keystroke, tap, or its close button. The wins
are granted immediately on load (the card is just the acknowledgement).

Offline income is deliberately NOT paid (this is a typing game — you weren't typing), but zero
acknowledgement is cold, so this is the middle path.

## Never rivals active play (< 25%, confirmed)
The grant tops out at **1,200 wins (12h × 100)** at R0. A typical established session ≈ 60 words at a
mixed ~100 wins/word ≈ **6,000 wins** → the max bonus is **20%** of a session. Both the bonus and
session earnings scale with the rebirth multiplier, so the ratio is **rebirth-stable at ~20%**.

Crucially it gets **relatively smaller over time**: session earnings also grow with WORD SENSE,
mastery, rarity, combo, and mode choice — none of which the return bonus tracks — so a powered-up
player's session dwarfs the bonus. It can never overtake active play.

| Player state | Max return bonus (12h) | Typical session | Bonus as % |
|--------------|------------------------|-----------------|------------|
| New (R0, word-bomb only) | 1,200 | ~1,200–3,000 | high early edge* |
| Established (R0, mixed modes) | 1,200 | ~6,000 | 20% |
| R3, WORD SENSE T3, mastery | ~4,200 | ~60,000+ | <10% |

*Honest edge note: a brand-new player on word-bomb only (20 wins/word) has a small session, so the
first-day bonus is a larger share — but a new player won't have a 6h+ gap-with-history on day one, and
the grant is capped and once-daily. For every established player (the ones who actually return after a
gap) it is well under 25%.

## Implementation
- `returnBonus.js` — pure given (lastSeen, now); guarded store `taw.returnClaim` (local calendar
  day). `getLastSeen()` added to visitHistory so the away-time is captured at MODULE LOAD before the
  app re-stamps `wa_last_seen`.
- App claims once on mount; the card renders only over the home menu (a deep-link into a game never
  overlays it). Dismiss on any keydown/pointerdown (capture, once) — never blocks type-to-earn.
- `returnBonus.test.js` (5): the 6h gate, 12h cap, once-per-day, × rebirth, fresh-visitor no-op, and
  the <25% invariant. Full suite green. Card verified via seeded screenshot (10h → +1,000 wins).
