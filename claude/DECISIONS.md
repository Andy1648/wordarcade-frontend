# DECISIONS — autonomous long-run (start 2026-09-01)

Conventions: never ask; most conservative option; log here; continue. Rails: branch + push only,
never merge, never push main, never deploy. Verify pushes with `git ls-remote --heads origin`.

- 2026-09-01: **Branch base.** The 7 jobs are interdependent — they build on the solo
  landscape/fill work already committed to `fix/ingame-pass` (pushed, not merged). Per rails
  (never merge to main), each job branch is cut off the PREVIOUS job's HEAD so the work chains;
  the named branches are cumulative. `fix/ingame-pass` is the base of the chain.
- 2026-09-01: **Gate command.** Using `npm run lint && npm run test && npm run test:e2e`
  (= `npm run gate`) rather than prefixing `npm ci`. A prior run logged that `npm ci` corrupted
  node_modules (concurrent-build EPERM incident, WORKLOG 06:46Z). node_modules is intact; a
  destructive reinstall mid-run is the higher-risk option. Reading test-results/.last-run.json.
- 2026-09-01: **JOB 1 (FUSE strip)** was already fixed in the working tree at directive time
  (flex-wrap so tiles wrap instead of clipping + game-fill 26-tile assertion). Committed to a
  new `fix/fuse-strip` cut off `fix/ingame-pass` HEAD (needs that branch's landscape layout).
