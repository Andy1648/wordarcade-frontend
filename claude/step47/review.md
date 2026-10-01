# STEP 47 — adversarial review + break pass, and what was done

Two independent subagents (a design reviewer and a breaker) read spec + code + screenshots cold.

## Breaker findings
| # | finding | sev | outcome |
|---|---|---|---|
| 1 | parallel claims all read "0 so far" and pass the per-IP limit | high | FIXED: per-bucket + site advisory locks in lb_claim (004) |
| 2 | IP from first X-Forwarded-For / X-Real-IP is client-forgeable | high | FIXED: cf-connecting-ip, else LAST XFF hop; X-Real-IP ignored. Live probe: a spoofed request was refused (403) and the 22nd plain claim was `rate_limited` |
| 3 | anyone can push any stats | high | PARTLY FIXED: lb_submit now ignores pushes where rebirths/words go down, level drops without a rebirth, or words grow > 20/s. Still client-trusted within those bounds (no accounts by design, A13); moderation = Andy deletes rows |
| 4 | IPv6 rotation inside one /64 | med | FIXED: IPv6 bucketed by /64 |
| 5 | classrooms on one IP locked out; missing headers → shared 'unknown' bucket | med | FIXED: 20/hour, 60/day per network; no header → no per-IP bucket, but a 600/hour site-wide ceiling |
| 6 | orphaned names (cleared storage) stay taken forever | med | NOT FIXED here: needs a scheduled job; logged for STEP 44 (weekly board) which adds a cron |
| 7 | off-board players re-fetch the board after every run | med | FIXED: one board read per session, result cached in sessionStorage |
| 8 | prompt returns every session forever | med | FIXED: 3 dismissals → quiet for 7 days |
| 9 | two parallel renames both pass the cooldown | low | FIXED: `for update` row lock |
| 10a | errors raised as 42501 → 401/403 | low | FIXED: default P0001 → 400; unique_violation mapped to username_taken (SQL + client) |
| 10b | no rename_cooldown copy in the prompt | low | FIXED |
| 10c | done state falls back to the estimated rank | low | FIXED: shows the board's rank, or "YOU'RE ON THE BOARD" |
| 10d | failed post-claim push → fake "#57 → #3" later | low | FIXED: baseline rank saved only if the push landed |
| 10e | menu rank check against stats the 30 s client throttle hadn't sent | low | FIXED: menu push is forced (DB still throttles at 5 s) |
| 10f | spec says "this run had a word", code checks lifetime | low | KEPT, spec updated: the board ranks lifetime stats, so a 0-word run by a player with history still has a place to claim |
| 10g | two tabs minting different secrets | low | FIXED: re-read the secret after writing it |

## Design review findings
| # | finding | sev | outcome |
|---|---|---|---|
| 1 | prompt below the fold on short screens burns the session's one shot | high | FIXED: "seen" = IntersectionObserver ≥60% on screen; mounted ABOVE the TRY row. At 1280x551 the whole end card scrolls (RESTART is below the fold too) — consistent with the card |
| 2 | board shows WORDS/WINS-PER-WORD but ranks by level | high | PARTLY: level line is now cyan + emphasised, "—" for wins/word at 0 words. Column layout kept (Andy's STEP 24 column list) |
| 3 | IP limit locks out classrooms | high | FIXED (see breaker 5) + copy "THE BOARD IS BUSY FROM THIS NETWORK. TRY IN AN HOUR." |
| 4 | re-fetch per game | high | FIXED (breaker 7) |
| 5 | rank-up card eats taps on mode cards | high | FIXED: pointer-events none, it never blocks |
| 6 | rank-up lands on top of achievement toasts | high | FIXED: shown after a 1.6 s beat (clears the menu's 1.5 s level-up / tier-up card) |
| 7 | copy drift, emoji | med | FIXED: "YOU'RE #N. FIND IT UNDER [TrophyIcon] ON THE MENU.", ✕ on the done state, no emoji |
| 8 | headlines in body font | med | FIXED: RANK UP in Bungee 28+; prompt kicker up to body size (a 28px Bungee sentence doesn't fit 390px) |
| 9 | strike-through weak; dot colour means two things | med | FIXED: 7px black strike; rank-news dot is CYAN (pink = shop) |
| 10 | no screen-reader announcement | med | FIXED: prompt role=status; rank-up has an sr-only status line (the visual card is aria-hidden) |
| 11 | tilted input renders skewed | med | FIXED: only the offer tilts; the form is straight |
| 12 | global audio button overlaps | med | NOT FIXED here: that control is the pre-existing global fixed AudioControls; the ✕ moved to the top corner so no control is covered |
| 13 | six identical invitation rows for a claimed viewer | med | KEPT: Andy's spec ("if fewer than 10 players exist, show the empty rows as #N — YOUR NAME HERE?") |
| 14 | "(YOU)" truncated | med | FIXED: separate YOU badge |
| 15 | weak once board > 100 | low | KEPT for now: the prompt is for "would place you on the board"; past 100 the funnel is the menu trophy |
| 16 | estimate vs real rank disagreement | low | FIXED via 10c |
| 17 | client-trusted stats | low | see breaker 3 |
| 18 | typo stuck for a day | low | FIXED: free rename within 10 minutes of the first claim |
| 19 | only first invitation row clickable | low | FIXED: every invitation row is a button for an unclaimed viewer |

## Live probe (migration 004 on the real DB, 2026-10-01) — `limits-probe.mjs`, `stats-probe.cjs`
- 20 new names from one network: 20 OK; 21st with spoofed CF-Connecting-IP/X-Forwarded-For/X-Real-IP: refused (403); 22nd plain: `400 rate_limited`. claim_log: 20 rows, 1 bucket, no NULL IPs.
- typo rename within 10 min: OK; first real rename: OK; second same day: `400 rename_cooldown`.
- 10 stats pushes in parallel: exactly 1 applied. Words backwards: ignored. +100,000 words in 6 s: ignored. Honest +24 words / +1 level: applied. Rebirth (level 17 → 1, rebirths 0 → 1): applied.
- All probe rows + claim_log deleted afterwards; board back to 0 rows.

## Bot sim — `prompt-sim.mjs` → `prompt-sim.txt`
Rank a weak (L4, 35 words), median (L24, 700 words) and strong (R2 L60, 15k words) player would claim:
0 players → all #1 · 10 → #10 / #3 / #1 · 150 → weak off-board (no prompt) / #65 / #14 · 1000 → only strong (#69).
