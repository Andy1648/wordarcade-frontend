# SEASON 2 — CHECKLIST (Andy authorized all of it, Oct 6 2026)

Source of truth: `claude/progression-FINAL.md` **v2 (rewritten 22:30)** — it REPLACES what #235 built.
Rules: SAVE USAGE — one task at a time, no parallel agents, read CI logs before fixing, re-run only failed
shards, no local full e2e. Update this file after each step with result + PR #. **Claude never runs migrations.**

## RULE — exactly ONE notice in the whole game
The EDITOR'S NOTE welcome (step 2), shown once. Every other progression/economy notice, popup or
"what changed" card is removed — incl. the unused `taw.pv10notice` flag and the conversion UPDATE card.
No other popups anywhere. (Replaces the old step 0 "LEVELS GOT HARDER" item — it never rendered; the
flag that would have driven it goes with this rule.)

## 1. PROGRESSION FINAL v2 behind SEASON2 — branch `feat/s2-progression-v2`, PR (see below), CI pending
- [x] need(n) = 100 × 1.15^(n−1), one curve for everyone (v3/econ + v3/curve, O(1) carry kept)
- [x] XP/letter = 10 × KEY × 3^R × MARK × OVERDRIVE; game letters ×1 (typed, no ×0.2 share / top-up), menu ×0.2;
      ANY keys count, no rate cap (v3/menuWords.js deleted; letterXp skips the 12/s limiter in season 2)
- [x] WINS/word = 10 × length/5 × MODE × 3^R × MARK × OVERDRIVE, games only (SAT ×5; FUSE FRENZY ×5 unchanged)
- [x] KEY ladder ×1…1000 then ×2.15; T→T+1 150 × 5^T; KEPT through rebirth; hold-to-buy (ShopV2, unchanged)
- [x] REBIRTH at LV 15 + 18R → LV 1, ×3 forever; AUTO REBIRTH at R2 (unchanged toggle)
- [x] OVERDRIVE on in season 2 (×10, 5 min, every 30–60 min of GAME play — the game-letter flush clock), own key
      taw.s2.overdrive; the edge pill carries the timer (no centre START / OVER moment in season 2)
- [x] gems / rolls / marks as the doc (75, games-only, pity 50/500, AUTO ROLL R1, 2nd MARK R5, LUCK R7 — already in)
- [x] ×1000 scale: none exists in the code (searched src + every branch) — v2 uses the doc's raw numbers (need 100,
      wins 10), so nothing scales them. ASCENSION hidden: canAscend always false, no ASCEND unlock / button / ★ chip
- [x] ONE-NOTICE rule: taw.pv10notice + taw.rrnotice never set (stale ones deleted), the live "YOUR LEVELS BECAME +N
      REBIRTHS" card removed; season 2: rank-up banner, unlock / bought / tutorial / dev-reset toasts, timer moments silent
- [x] `supabase/migrations/027_progression_final_v2.sql` (replaces 026's rules; never run): lb_rebirth season 2
      LV ≥ 15 + 18R → level 1, 12/hour cap kept; lb_ascend season 2 → 'off'; board-write room 15 + 18R + 100
- [x] CI sim (`claude/econ-oct2/final-sim.mjs`, econ-sims `season2` job, 10 h): doc table ±25% + spammer + no ascension.
      Local 1.5 h probe: median R1 3.3 min / R3 20.8 / R5 69.2 · fast R1 2.0 / R3 12.2 / R5 44.7 (all within ±11%)
- Unit 1270/1270 locally; e2e + econ sims on CI only.

## 2. WELCOME = the one notice — EDITOR'S NOTE screen (house style, based on Season2.dc.html, not a plain box)
- [ ] "EDITOR'S NOTE" / "SORRY FOR RESCALING THE PROGRESSION — HERE'S SOME GEMS"
- [ ] old run → gems = round5(300 + 40 × old rebirths)
- [ ] COLLECT → gems float + fly into the left gem pill (KitFly), counter ticks up; shown once

## 3. LEADERBOARD after the reset
- [ ] everyone keeps their old position; every stat shows "—" until earned in season 2
- [ ] order = season-2 stats desc, ties by season-1 rank from the reset snapshot
- [ ] the view as a migration — never run it

## 4. FLIP-STEPS
- [ ] update `claude/FLIP-STEPS.md` with the exact SQL files in order
- [ ] STOP — visual polish moves to a separate cloud session later
