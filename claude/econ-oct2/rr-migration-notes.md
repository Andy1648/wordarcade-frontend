# Rebirth Rush — server migration notes (018_rebirth_rush.sql)

Claude wrote it and never ran it. Andy runs it by hand.

## What to run, in order
1. **Deploy the Rebirth Rush client first.** It reads `lb_caps` and, while the server still says `econ: 10` (016/017), it sends `p_econ = 10`, so submits and cloud saves keep working before 018.
2. **Run `supabase/migrations/018_rebirth_rush.sql`** in the SQL Editor (project oajvvwptwifspmwiohlt). Read the output.
3. **Run `notify pgrst, 'reload schema';`**
4. Check: `select public.lb_caps();` should show `"econ" : 12`.

The file is safe to re-run. If 011, 013, 015, 016 or 017 is ever re-run, re-run 018 after it.

Keep the gap between step 1 and step 2 short. During that gap, the client's conversion submit goes through 017's old rule, which allows only +1 rebirth per submit. For example, snapplemelon's row would show R5 LV1 for a while. After 018 runs, the full rebirth bucket (60) lifts that row to its real count on its next submit, so nothing is lost.

Optional preview before running. This lists every row that converts on its owner's next visit:
```sql
select username, rebirths, level, 15 + 18*rebirths as gate,
       rebirths + floor((level - (15 + 18*rebirths)) / 18.0) + 1 as becomes_r
  from public.profiles where level >= 15 + 18*rebirths order by becomes_r desc;
```

## What each real board row becomes
The conversion runs in each player's own save (`econMigrate.rebirthRushConvert`) the next time they load the game. 018 only *accepts* the result, in one submit.

| row | now | after their next visit |
|---|---|---|
| snapplemelon | R4 LV195 | **R11 LV1** (gate 87, (195−87)/18 = 6, +7) |
| Xavi | R8 LV168 | **R9 LV1** (gate 159, +1) |
| elol | R7 LV156 | **R8 LV1** (gate 141, +1) |
| Daan, Tangie, maSON, creator, NoBuffCookies | — | keep (below their gate) |

A player who never comes back keeps their old row. The board now sorts by rebirths first, so their old R/LV still ranks fairly.

## What changed server-side
- `lb_submit3`, `lb_save2` and `lb_load2` accept `p_econ = 12` only. Stale v10 and v11 tabs are refused until they reload.
- New column `profiles.rb_clock`: the rebirth token bucket. The new write rule is `private.lb_board_write_rr`, mirrored in `src/leaderboard/submitRules.js` as `decideSubmitRR`.
- The old write paths stay no-ops (re-asserted).
- `public.leaderboard` is rebuilt in the order **rebirths desc, level desc, lifetime_words desc, created_at asc**.
- `lb_caps` reports `econ: 12`.

## Risks
- **Stale cheated levels convert.** The conversion bonus is computed from the *stored* level. A row with an old forged level (the LV5222 incident) would get about +290 rebirths. Run the preview query above and admin-reset any bogus row *before* 018.
- **Cheater ceiling.** Rebirths can rise by +60 at once, then about +60/hour. Honest play is about 4/hour. This is generous on purpose, so an honest burst is never clamped. To tighten it, lower `RB_SECS`/`RB_BURST` in 018 and in `submitRules.js` together.
- **The first submit is still unclamped.** The claim-time baseline is the same as in 013–017. A brand-new claim can post any R/LV once.
- **Clamping is never wrong upward.** A burst beyond the bucket shows a lower R for a while, then catches up at 1/min.
- **wins_per_word is unbounded `numeric`** (since 011): 5^80 ≈ 8e55 is fine. Only a non-finite JS value (beyond about 1.8e308) arrives as JSON null and is written as 0.
- **The e2e board mock still models 016/017** (`decideSubmit`, econ 10). The live rule is unit-tested only (`submitRules.test.js`). No e2e covers 018.
- **Board wins/word "—" rule unchanged (econ ≥ 10).** Rows last written on 10 or 11 show their older, lower wins/word until their next submit.
