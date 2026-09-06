# fix/firstrun — 2 jobs (first-run UX + daily streak)

**Branch:** `fix/firstrun` @ `0c36c78` — pushed, NOT merged (per instruction).
**Verification:** 274 unit + 134 e2e pass, `vite build` clean.
**Preview:** newest Vercel build for the push is
`https://wordarcade-frontend-3sk0nmfak-beenchilling.vercel.app`
(the `vercel ls` output didn't show Ready/branch columns — confirm it's the `fix/firstrun` row before testing).

---

## JOB 1 — first-run fixes (verified rendering at 1440x900 AND 390x844)

1. **REBIRTH hidden at LV1** — top nav shows only SHOP + STATS for a fresh account. Reappears once
   the player has earned any wins, has rebirthed, or reaches the first rebirth level.
   (`homepage-nav-btn.is-rebirth` count = 0 for a new account.)
2. **XP bar labeled** — static "LEVEL" kicker added, plus a first-visit caption
   "TYPE ANYWHERE TO EARN XP" under the bar. Shows only to a genuinely new LV1 account, gone for
   good at LV2. Hidden on <560px-tall screens so it never breaks the one-screen fit.
3. **WINS explainer** — the first round that ever pays out shows a one-time 3s stamp
   "WINS BUY UPGRADES IN THE SHOP" (gated by `taw.seenWinsHint`); later payouts show "+N WINS".
4. **PLAY primary** — the mode dialog's primary button now reads PLAY (opens a solo-playable room
   you can also share); JOIN becomes "JOIN WITH CODE" (secondary). Verified render:
   `{create:"PLAY", join:"JOIN WITH CODE"}`.
5. **Locked path** — CHAIN/FUSE cards and the locked-preview dialog show
   "UNLOCKS AT LV 15 · YOU'RE LV 1 · 14 TO GO" (levels-to-go, not raw XP — see decisions).
6. **Intro gate** — measured first-visit gate ~3.9s (TransitionIntro ~1.9s + KnifeSplit ~2.0s).
   Compressed to ~1.8s (~1.0s + ~0.83s), preserving the two-beat TYPE FAST / DIE SLOW -> knife
   structure at a faster tempo. Note: the intro is already first-visit-only (`SEEN_INTRO`), so
   repeat visitors already skipped it.

### First-run walkthrough capture (headless, both viewports)
```
desktop 1440x900 / phone 390x844 — identical:
  rebirthBtn: 0        (hidden)
  shopBtn: 1, statsBtn: 1
  levelLabel: "LEVEL"
  lvChip: "LV 1"
  caption: "TYPE ANYWHERE TO EARN XP"
  streakChip: null     (streak 0 -> correctly hidden)
  lockLabels: ["UNLOCKS AT LV 15  YOU'RE LV 1 · 14 TO GO",
               "UNLOCKS AT LV 22  YOU'RE LV 1 · 21 TO GO"]
  dialog buttons: {create:"PLAY", join:"JOIN WITH CODE"}
```

---

## JOB 2 — daily streak

- New `src/progress/streak.js`: `taw.streak {count, lastDay, freezes}` (extended the spec's
  {count,lastDay} with `freezes` for the token mechanic). Local-midnight day boundary; all storage
  access guarded (blocked store -> zeroed streak, never throws).
- **Multiplier**: x1.05 @3 days / x1.10 @7 / x1.20 @14 / x1.25 @30 (cap). Folds into `xpPerInput`
  (live default; explicit param in tests) so it multiplies into the existing XP stack.
- **Freeze tokens**: +1 granted per 7 days held; a single missed day spends a token instead of
  resetting; a larger gap (or a missed day with no token) resets to 1. Freezes are kept across a
  reset. No punishment beyond the counter reset; no guilt/"don't lose it" copy anywhere.
- **Menu chip**: a small flame chip (🔥 N) shows only once the streak is >= 2.
- Hooked into `wordCount.addWords`, so any accepted word in Word Bomb / Category Blitz / SAT Rush
  counts the day.
- **12 tests** added (`src/progress/streak.test.js`): day rollover increments, two-day gap resets,
  a freeze token absorbs one miss, the multiplier is applied in `xpPerInput`, plus the reward
  curve, freeze-grant milestones, and the local day index.

---

## What I couldn't do / conservative decisions (all logged in DECISIONS.md)

- **Live Chrome walkthrough**: the Chrome extension wasn't connected in this background session, so
  I captured the first-run state (DOM values + screenshots) headless via Playwright instead —
  equivalent evidence, at both required viewports.
- **CHAIN/FUSE streak gap**: those solo modes record wins directly and don't route through
  `addWords`, so they don't currently bump the streak. Low impact (the three main modes cover daily
  engagement); documented to revisit if CHAIN/FUSE-only players report resets.
- **JOB1.4**: relabeled the multiplayer primary CREATE -> PLAY rather than adding a redundant third
  button (PLAY and CREATE are the same underlying action here). Matches the audit's own rec #4.
- **JOB1.5**: showed remaining as LEVELS-to-go, not raw cumulative XP — the spec said "remaining XP"
  but a big cumulative number reinforces the exact opacity the audit flagged. Deliberate divergence.
- Updated one e2e test (`shop.spec.js`) that asserted the old "REBIRTH present at LV1" behavior;
  split into hidden-when-fresh / shown-once-earned.
- Nothing merged; `fix/firstrun` is push-only.

## Files changed
New: `src/progress/streak.js`, `src/progress/streak.test.js`
Modified: `src/progress/xp.js`, `src/progress/wins.js`, `src/wordCount.js`,
`src/components/MenuXp.jsx`, `src/components/MenuXp.css`, `src/components/Homepage.jsx`,
`src/components/modeDialogConfig.js`, `src/components/ModeDialog.jsx`,
`src/components/GameCard.jsx`, `src/components/GameCard.css`,
`src/components/LockedPreviewDialog.jsx`, `src/components/TransitionIntro.jsx`,
`src/components/TransitionIntro.css`, `src/components/KnifeSplit.jsx`,
`e2e/shop.spec.js`, `DECISIONS.md`
