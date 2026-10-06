# SEASON 2 — FLIP STEPS (for Andy)

Progression is FROZEN in `claude/progression-FINAL.md`. The full reset is ON. Claude never runs SQL: you run each file below in the
Supabase SQL Editor, in this exact order, then tell Claude **"flip SEASON2"**. Nothing changes for players until that last step.

## Before you start (check, don't run)
- [ ] `021_server_rebirth.sql` is already live (`select public.lb_caps();` shows `"rebirth_rpc": true`). ✅ confirmed Oct 6.
- [ ] typeaword.com is serving the current main (all Season 2 code ships behind the flag, OFF).
- [ ] PR #237 (numbers audit — fixes season-2 MARK payouts: LEGENDARY ×2, SECRET ×5) is MERGED. Do not flip before it.
- [ ] Do NOT run these (superseded or cancelled): `019_*`, `020_*` (folded into 021), `025_*` (the no-reset conversion — deleted).

## Run, in this order (each whole file, one at a time)
1. `supabase/migrations/022_season2_board.sql` — the Season 2 board (★ → rebirths → level) + season-2 write rules. Stops with a clear error if 021 is missing.
2. `supabase/migrations/024_season2_weekly.sql` — the Season 2 THIS WEEK board.
3. `supabase/migrations/026_progression_final.sql` — PROGRESSION FINAL on the server: `lb_rebirth` needs LEVEL > 25×(R+1) and SPENDS it (keeps the rest); `lb_ascend` at R ≥ 10+5×★ → +1 ★. Needs 022. (If 022 is ever re-run, re-run 026 after it.)
4. `claude/run-season2.sql` (identical to `supabase/migrations/023_season2_reset.sql`) — **THE RESET**: snapshots every profile, wipes everything except usernames, grants each player GEMS = round5(300 + 40 × old rebirths) to collect once on the SEASON 2 welcome. One-shot (a second run does nothing).
   - Note: 023's own header lists 022 → 024 → 023; the correct full order is this list (026 BEFORE 023 — 023 does not re-declare 026's functions).
5. `notify pgrst, 'reload schema';`
6. Check: `select public.lb_caps();` now includes `"season2_reset": true`.

## Then
7. Tell Claude: **"flip SEASON2"**. Claude changes ONE line — `src/progress/season.js`: `export const SEASON2_LIVE = true;` — merges it, and verifies it is live.
8. Every visitor then runs Season 2: their local save is wiped once (username + settings kept) and the SEASON 2 welcome shows once with their gems.

## If something goes wrong
- Undo the reset: run `claude/rollback-season2.sql` (restores profiles + cloud saves from the snapshot 023 took), then `notify pgrst, 'reload schema';`, and tell Claude to set `SEASON2_LIVE` back to `false`.
