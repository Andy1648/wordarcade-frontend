
---

# FIXES (fix/design-consistency branch)

## What I unified
- **#1 Close / exit ✕ control (the highest-visibility mismatch).** Consolidated all four to ONE spec —
  the canonical StatsScreen/ShopScreen control: **40×40, #0d0618 fill, white glyph, 3px #000 border,
  8px radius, 3px 3px hard shadow, 16px Bungee**. Fixed:
  - `.mode-dialog-close` (was 38×38, **white-on-black** — the standout outlier every dialog showed).
  - `.solo-exit` (was 44×44 on #1a0b2e — a third size/fill).
  - `.stats-close` / `.shop-close` were already the canonical spec (left as the reference).
  Verified in-browser: the mode dialog now shows the same dark ✕ as Stats/Shop/solo; reads cleanly on
  the colored dialog. Suite green; build clean.

## What I deliberately left (and why)
- **Primary button cyan vs purple (#2).** `.solo-restart`'s purple is not drift — it's a two-state
  control that arms to the mode ACCENT (`.solo-restart.is-armed { background: var(--solo-accent) }`).
  Forcing it to cyan would break that interaction. Left intentionally.
- **Elements that live on OTHER (unmerged) branches** — `.coll-*`, `.ach-*`, `.mastery-track`,
  `.game-card-mastery` (from this run's economy chain). They can't be edited from `main`; unify them
  when the chain merges (a token set — `--ctl-close-*`, `--shadow-1/2/3` — is the right vehicle then).
- **Sticker/identity variations** — the featured card's heavier 7px shadow (it's the flagship), the
  `.game-card-badge` tilt + sharp corners (a taped-sticker look), the `.game-card-ai-badge` chunkier
  border (a deliberate "AI JUDGED" call-out), and `.mode-dialog-shell`'s per-mode accent border. These
  are identity, not drift.
- **Progress-bar heights (#4)** — only `.shop-progress` exists on main; the 12px/9px variants are on
  the unmerged branches, so there's nothing to consolidate *against* here yet.

## Recommendation for the merge
Once the economy chain lands, introduce the token set named in the report (`--ctl-close-*`,
`--btn-primary-*`, `--chip-*`, `--shadow-1/2/3`) in `index.css :root` and point every variant at it —
that's the durable fix so drift can't recur. This branch does the one consolidation that's both
genuine drift AND fully on `main`.
