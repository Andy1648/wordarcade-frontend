# JOB 13 — the returning player (chore/return-2, REPORT ONLY)

Three returns simulated against realistic saves (LV12 + 4-day streak / LV30 R1 broken streak / LV8
streak lost). Findings are grounded in the actual return + streak code (authoritative on behaviour);
`taw.xp` set to the cumulative-XP milestones from `xp.js need()` — LV8=2,490, LV12=6,790, LV30≈403k —
`wa_last_seen` back-dated 1d / 3d / 14d, `taw.streak` shaped per scenario.

## The mechanic (from returnBonus.js + streak.js)

- **Welcome-back grant:** on a return ≥ 6h away, once per calendar day, `min(hoursAway, 12) × 100 ×
  rebirthMult` wins. A `ReturnBonusCard` shows over the home menu; header reads `N HOURS AWAY`, or
  **`12+ HOURS AWAY`** once you cross the cap. Dismisses on any key/tap (never blocks type-to-earn).
- **Streak:** consecutive local days with ≥1 accepted word. A 1-day gap resets to 1 unless a freeze
  token covers it; freezes are earned 1 per 7 days and **always survive a reset**. Explicitly guilt-free
  (streak.js: "no 'don't lose it' pressure anywhere").

## Scenario results

**1 DAY away — LV12, 4-day streak (has 0 freezes yet; first freeze is at day 7).**
- Acknowledged? **Yes.** `24h → capped at 12 → 1,200 wins`, card reads `12+ HOURS AWAY`.
- Streak: a 1-day gap with no token → **resets to 1**. So a diligent 4-day streak is wiped by a single
  day off. This is the harshest real finding: at < 7 days the player has no freeze yet, so the streak is
  most fragile exactly when it's youngest. Guilt-free in copy, but the 4→1 drop is a silent sting.
- Next goal: the XP bar + "N to go" to LV13 is clear; the wins chip jumps by the grant.

**3 DAYS away — LV30, R1 (1 rebirth), broken streak.**
- Acknowledged? **Yes**, but **identically** to the 1-day case: `72h → capped at 12 → 1,200 × rebirthMult`.
  A player gone 3× longer gets the same headline and (bar the rebirth multiplier) the same wins.
- Not punishing: purely additive; nothing is taken. R1 rebirth mult makes the grant a bit larger — the
  one place absence length interacts with anything, and only via rebirth, not via time-away.

**14 DAYS away — LV8, streak lost.**
- Acknowledged? **Yes**, again **identical**: `12+ HOURS AWAY`, 1,200 wins. A two-week lapse and a
  half-day lapse are indistinguishable to the game.
- Punishing? **No** beyond the natural streak reset (→1, freezes kept). No decay of XP/wins/upgrades.
- Next goal: at LV8 the locked-mode teasers ("CHAIN — LV20, 12 to go") give a clear target; the menu
  isn't blank.

## Answers to the brief

1. **Does the game acknowledge the absence?** Yes — a visible, dismissable welcome-back card on every
   return ≥ 6h. Warm, non-blocking, once/day.
2. **Is anything punishing?** No loss anywhere except the streak reset, which is deliberately designed
   to be consequence-light (freezes survive, no guilt copy). The only real sting is a **sub-7-day streak
   having no freeze**, so an early streak is wiped by one day off.
3. **Is the next goal obvious?** Yes — the XP-to-next-level bar and locked-mode "N to go" teasers always
   name a next target; the wins grant visibly bumps the balance.
4. **Is the welcome-back visible and does it feel fair?** Visible: yes. Fair: **flat, not scaled.** The
   12-hour cap means 12h, 1 day, 3 days and 14 days ALL pay the same 1,200 wins and read "12+ HOURS
   AWAY." Fair in that it never punishes and never creates FOMO (correct for a no-offline-income typing
   game) — but a 14-day returner gets zero extra acknowledgement over a half-day one, which is a missed
   chance to make a long-absent player feel specifically welcomed back.

## Recommendations (small, optional)

- **Tier the welcome copy by absence** even if the wins stay capped: "BACK AFTER 2 WEEKS!" vs "12+ HOURS
  AWAY" costs nothing and makes a real returner feel seen (the grant can stay flat for economy reasons).
- **Grant the first freeze earlier** (e.g. day 3, not day 7) so a young streak isn't so brittle — the
  4→1 wipe on one missed day is the only genuinely deflating moment in the return experience.

NOTE: behaviour above is read directly from `returnBonus.js` / `streak.js` (authoritative). The
1366×768 / 390×844 screenshots are the one residual confirmation step — see the run's final status; they
confirm the card + reset visuals but change none of the findings.
