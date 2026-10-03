# Main E2E red on Oct 2 — every failing spec, with its cause (G2, Andy oct3 00:40)

Source: GitHub Actions, workflow "E2E" on `main`, Oct 2 (UTC), 12 runs that concluded `failure`
(the other non-green runs were `cancelled`, superseded by the next merge). Each run's failing shard
logs were downloaded and parsed.

| main commit (merge of) | failing spec | error | cause | status |
|---|---|---|---|---|
| 5557a72 (#105), fcc4b0c (#111), 9b80f01 (#127) | menu-fit › 1600x900 title clears XP bar | title↔XP gap below the floor | layout race between the title's --menu-scale fit pass and the XP bar on a 1600x900 runner (passed on the PRs, failed on merge) | has passed on every main run since 9b80f01 (14 runs); 6/6 repeat locally → **watch ticket W-1** |
| 9b84e29 (#116) | word-landing › frame integrity @1280x720 | ring resized 318→325px (tol 6.4) | one-off: the WB ring re-fit after a font swap during the accept animation | passed on every run since; 6/6 repeat → **watch ticket W-2** |
| a8c4b58 (#120), 2722e87 (#129), eacf55d (#130), 295a6f1 (#142) | payload-budget › homepage initial load | 1,260,097–1,260,126 B > ratchet 1,260,000 | **MERGE RACE**: each PR passed alone; two PRs that each added bytes merged back-to-back and the combined bundle crossed the ratchet. Also the mascot fetch was double-counted | fixed: URL-dedupe in the spec (#124 follow-up) and the rare moments split into lazy chunks (#133, #141); green on main since 09fc16a |
| 044885f (#118) | word-bomb-scoring › RACE turn_update | expected 25, got 38 | stale test: ignored the +13 winner bonus | fixed (test expects 25 + 13) |
| 0ce8019 (#121) | card-fit › high 1024x768 | "· LONGER = MORE" clipped | real bug: FRENZY copy on the card | fixed by E3 (#139) |
| 79ded55 (#133) | input-latency › FUSE p95 < 50 ms @4x | p95 over | CI perf noise on a shared runner (the same commit's PR run passed) | **watch ticket W-3** — retried green; cannot be judged on the local machine (slower) |
| e98cd9f (#136) | failure-states › OFFLINE CHAIN run | uncaught error offline | real bug: idle warm-up imports rejected with "Unable to preload CSS" offline | fixed in E4 (#140): warm-ups wrapped in quiet() |

**Now:** main has been green for 7 consecutive merges (#143–#149).

## Watch tickets (not quarantined — they pass; quarantine if one fails twice in a week)
- **W-1** menu-fit 1600x900 title↔XP gap — suspect the fit pass reading the title before webfonts settle.
- **W-2** word-landing ring re-fit after a font swap.
- **W-3** input-latency FUSE p95 on shared CI runners.

## New merge rule (from G2): rebase on main + green before merging
Before merging any PR: (1) its base must equal `main`'s HEAD (else rebase/merge main into it and push);
(2) every check on that exact head SHA must be green; (3) never merge on red or on a run older than
`main`'s HEAD. Two PRs never merge back-to-back without the second re-running on the first's result.
