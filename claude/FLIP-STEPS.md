# SEASON 2 — FLIP STEPS (for Andy)

Progression is FROZEN in `claude/progression-FINAL.md` **v2** (Oct 6 22:30). The full reset is ON. Claude never runs SQL:
you run each file below in the Supabase SQL Editor, in this exact order, then tell Claude **"flip SEASON2"**. Nothing
changes for players until that last step. (Checklist: `claude/SEASON2-CHECKLIST.md` — steps 1–3 are PRs #247 / #248 / #249.)

## Before you start (check, don't run)
- [ ] `021_server_rebirth.sql` is already live (`select public.lb_caps();` shows `"rebirth_rpc": true`). ✅ confirmed Oct 6.
- [ ] typeaword.com is serving the current main (all Season 2 code ships behind the flag, OFF).
- [ ] Do NOT run these (superseded or cancelled): `019_*`, `020_*` (folded into 021), `025_*` (the no-reset conversion —
      deleted), **`026_progression_final.sql`** (the first FINAL — replaced by 027; if it was already run, that is fine:
      027 re-declares all three of its functions).

## Run, in this order (each whole file, one at a time)
1. `supabase/migrations/022_season2_board.sql` — the Season 2 board + season-2 write rules. Stops with a clear error if
   021 is missing.
2. `supabase/migrations/024_season2_weekly.sql` — the Season 2 THIS WEEK board.
3. `supabase/migrations/027_progression_final_v2.sql` — PROGRESSION FINAL v2 on the server: `lb_rebirth` (season 2) needs
   LEVEL ≥ 15 + 18 × R → level 1 (≤ 12 rebirths an hour, kept); `lb_ascend` refuses (ascension hidden); the board write
   allows 15 + 18 × R + 100 levels. Needs 022. (If 022 is ever re-run, re-run 027 after it.)
4. `claude/run-season2.sql` (identical to `supabase/migrations/023_season2_reset.sql`) — **THE RESET**: snapshots every
   profile, wipes everything except usernames, grants each player GEMS = round5(300 + 40 × old rebirths) to collect once
   on the EDITOR'S NOTE. One-shot (a second run does nothing).
   - 023's own header lists 022 → 024 → 023; the full order is this list (027 BEFORE 023 — 023 does not re-declare 027's
     functions, so they stay).
5. `supabase/migrations/028_season2_board_keep_place.sql` — the board after the reset: everyone keeps their season-1
   place (ties broken by the snapshot 023 just took), every stat shows "—" until they earn something. **Needs 023**
   (stops with a clear error if the snapshot table is missing). If 022 is ever re-run, re-run 028 after it.
6. `notify pgrst, 'reload schema';`
7. Check:
   - `select public.lb_caps();` now includes `"season2_reset": true`;
   - `select rank, username, earned, s1_rank from public.leaderboard_s2 order by rank limit 5;` — rank 1 is the old #1,
     `earned` false everywhere, `s1_rank` = rank.

## Then
8. Tell Claude: **"flip SEASON2"**. Claude changes ONE line — `src/progress/season.js`: `export const SEASON2_LIVE = true;`
   — merges it, and verifies it is live in the production bundle.
9. Every visitor then runs Season 2: their local save is wiped once (username + settings kept) and the EDITOR'S NOTE
   shows once with their gems — the only notice in the game.

## If something goes wrong
- Undo the reset: run `claude/rollback-season2.sql` (restores profiles + cloud saves from the snapshot 023 took), then
  `notify pgrst, 'reload schema';`, and tell Claude to set `SEASON2_LIVE` back to `false`. (027 and 028 can stay: they
  only touch season-2 requests / rows, and the restored rows are season 1.)
