# JOB 16 — fix/copy → TRIAGE + DEFER (no speculative copy churn)

Date: 2026-09-01 · Branch: fix/copy (off main) · No source changed — see WHY below.

A thorough **copy & voice audit already exists** (a prior JOB 15, stranded in an agent worktree).
I promoted it into the tree as `claude/copy-audit.md` so it isn't lost. This report TRIAGES it into
what's safe to change autonomously vs what's the owner's call — and flags items that are actually
WRONG against the shipped design intent.

## WHY NO CODE CHANGE THIS PASS
I checked every candidate for a safe, clearly-correct, not-a-taste-decision fix. There basically
isn't one, and copy is exactly where a wrong autonomous guess does outward-facing damage:

- **Voice rewrites (the TOP 20 / §5)** — subjective. "THIS NUKES EVERYTHING" vs the current warning
  is a taste call the owner should make. The audit itself labels these "suggestions."
- **Terminology renames (§2: fragment→"THE LETTERS", `AI CATEGORY BLITZ`→`CATEGORY BLITZ`)** —
  cross-cutting design decisions touching many files incl. Tier-2 `GameScreen.jsx` prompts. Not a
  mechanical fix; a product decision.
- **Ellipsis `...`→`…` (§1f)** — needs a canonical-form decision and touches dozens of Tier-2
  strings (GameScreen uses `...` heavily). Picking the winner is a call, not a cleanup.
- **`resultCard.js` separators `-`/`pts` (§1f/#20)** — this format is **locked by
  `resultCard.test.js`** (deliberate Wordle-style receipt) and is outward-facing (COPY RESULT).
  Overriding a test-pinned deliberate format on my own judgment is not a safe fix.
- **VERIFIED WRONG — `SCRAPS`→`WINS` (audit #12)** — I traced it: `WordCard.jsx:217` "1× SCRAPS"
  is in the spell-along endgame ("the mugshot prints itself out for **scraps**") — intentional
  bounty-voice for "you're down to the minimum 1× reward," NOT a second name for the WINS currency.
  Applying the audit's suggestion would DELETE deliberate voice. **Do not do this one.** (Recommend
  striking it from the audit's quick-win list.)

Making outward-facing copy changes on guesses violates "don't push speculative changes" and the
"confirm outward-facing changes" rule. So this pass diagnoses and hands the decisions back.

## IF THE OWNER WANTS TO ACTION THE AUDIT — the genuinely safe, mechanical subset
These are the only items that are consistency-not-taste AND don't fight a deliberate choice. Each is
still small enough to do in one sitting once you confirm the canonical form you want:

1. **Placeholder casing** (§1c): force the two lowercase solo placeholders to ALL-CAPS to match
   every other input — `ChainGame.jsx:280` `start with "T"…`, `FuseGame.jsx:195` `type a word…`.
   (Low risk; matches the app's own dominant register.)
2. **CreditsScreen `// CREATED BY //` / `// MUSIC //`** (§3/#15) → `MADE BY` / `MUSIC`, IF the
   code-comment styling isn't the intended dev-aesthetic (owner's call — it reads deliberate to me).
3. **Share-card `-`/`pts` vs `·`/`PTS`** (#20): pick ONE brand form across `resultCard.js` +
   `shareText.js` and update `resultCard.test.js`. Worth doing, but it IS a deliberate-format
   override, so it needs an explicit "yes, make them match."

Everything else in the audit is voice/terminology = owner decision.

## RECOMMENDATION
Treat `claude/copy-audit.md` as the backlog. Do a single supervised copy pass where the owner
picks: (a) the canonical fragment word, (b) the canonical mode name, (c) the ellipsis form, (d) which
TOP-20 voice rewrites they like. That's a 30-minute review together, not an autonomous guess. Strike
audit #12 (SCRAPS) — it's intended flavor.
