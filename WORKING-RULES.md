# Working Rules

How work gets done in this repo. The **For Claude Code** section below is mirrored into
`CLAUDE.md` so the agent picks it up automatically; keep the two copies in sync when either changes.

## For Claude Code

### Match ceremony to blast radius (risk tiers)
- **Tier 1 — live logic** (WebSocket message handlers, game state, view/state lifecycle, room
  lifecycle, validators). One task at a time, never batched. Diagnose before fixing — trace and
  report the cause first, never a speculative fix. A 2-device live play-test is required after
  shipping.
- **Tier 2 — UI / components** (rendering, layout, component structure). May batch closely-related
  changes; review by PLAYING the preview, not by reading every diff line. If a "UI" change touches a
  WS handler or a game-state read, it is Tier 1 — escalate.
- **Tier 3 — static / cosmetic** (CSS, copy, meta, static assets, dead-code removal, log gating).
  Batch freely; trust the build (`npx vite build --logLevel error`, exit 0). Spot-check the result.
- When unsure which tier, pick the **higher** one.

### Verify before you claim done
- Run the full gate before any merge: `npm run gate` (lint + unit + **all** Playwright). Read
  `test-results/.last-run.json` for the authoritative pass/fail and the list of failed tests — never
  gate on a viewport-narrowed subset (that has hidden real failures before).
- **A green build is not a green app.** Runtime-only bugs pass every static check — screenshot and
  inspect the real thing. Diffs cannot catch a freeze.
- **Never fabricate evidence.** If a viewport or environment cannot be reproduced (screen-size cap,
  a blocked asset, headless-only rendering), say so plainly and report what you actually measured;
  do not invent screenshots or numbers.
- **Load-flake vs regression.** Before calling a failing Playwright test either way, re-run it
  serially (`--workers=1`). A timeout that vanishes without parallel contention is a load-flake, not
  a regression — say which, with the evidence.

### Chrome-level visual verification
- Verify chrome-level visuals against **production**, or ignore any element outside `#root`.
- `*.vercel.app` **preview deployments inject Vercel UI** — `<vercel-live-feedback>` (a right-edge
  floating pill) and sometimes the Vercel Toolbar. These are **siblings of `#root`, not app
  markup**, and never appear on typeaword.com. Do not mistake them for an app orphan.
- **No orphan fixed UI.** A new persistent control JOINS an existing cluster (the corner nav or the
  footer) — never a lone `position:fixed` element with its own coordinates.

### Workflow
- Branch off `main`; do feature/fix work on a branch, never directly on `main`. Do **not** merge
  until every acceptance passes.
- After a change: commit the relevant files, push to the branch, and report the Vercel preview URL.
  Never leave work uncommitted; never ask "want me to commit/push?" — just do it.
- **Never commit** (unless told): `LoadingScreen.jsx`, `.md` audit reports,
  `generated_content_review.js`.
- Keep reports short; end with what's committed + the preview URL and no open questions.
