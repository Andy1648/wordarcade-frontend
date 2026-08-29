# SPACING SCALE (JOB 4)

Branch `chore/spacing-scale`. Establishes a spacing system; the JOB 2 audit found the layout had
none (~17 distinct `gap:` values alone).

## The scale
Defined as CSS custom properties in `src/index.css` `:root`:

| token | value | | token | value |
|---|---|---|---|---|
| `--space-1` | 4px | | `--space-5` | 24px |
| `--space-2` | 8px | | `--space-6` | 32px |
| `--space-3` | 12px | | `--space-7` | 48px |
| `--space-4` | 16px | | `--space-8` | 64px |

## Before — how many distinct values existed
Across `src/**/*.css`, fixed-px `gap` / `padding` / `margin` declarations use **36 distinct pixel
values**. By occurrence:
- **On-scale already (287 occurrences)**: 4, 8, 12, 16, 24, 32, 48, 64 — these map 1:1 to a token
  with ZERO visual change.
- **Off-scale (the rest)**: 10px ×72, 14px ×71, 6px ×63, 18px ×56, 2px ×29, 5px ×27, 3px ×27,
  20px ×26, 9px ×24, 22px ×23, 7px ×21, 40px ×11, 28px ×11, 26px ×8, 1px ×6, plus a long tail.

## Nearest-step mapping (for the supervised snap)
| off-scale | → token | | off-scale | → token |
|---|---|---|---|---|
| 1,2,3 px | `--space-1` (4) | | 18,20,22 px | `--space-4`/`--space-5` (16/24) |
| 5,6,7 px | `--space-2` (8) | | 26,28 px | `--space-6` (32) |
| 9,10,14 px | `--space-2`/`--space-3` (8/12) | | 40 px | `--space-7` (48) |
| (10→12, 14→12/16 by context) | | | | |

## After — what this branch did, and what it deliberately did NOT
- **Did:** define the 8-step scale as custom properties (the requested "put it in CSS custom
  properties") + this mapping. New spacing should use the tokens immediately.
- **Did NOT (conservative, user asleep):** blind-migrate the ~640 off-scale occurrences to the
  nearest step. Snapping 10→12, 14→12/16, 6→8, 18→16 etc. **shifts real layout on nearly every
  screen** — that is the intended end state, but it needs a per-screen visual review (viewport-
  integrity only catches clipping/overflow, not "this now looks wrong"). Doing it unsupervised
  against the "most conservative option" rule was declined; it is a supervised follow-up.

**So: distinct hardcoded spacing values BEFORE = 36. AFTER this branch = still 36 in the CSS**
(tokens added, values not yet snapped) — the honest number. The scale + mapping make the
remaining migration mechanical and reviewable; expected AFTER a full snap ≈ **8** (the token set),
plus any deliberate one-offs.

## Recommended migration order (lowest risk first)
1. Tokenize the 287 already-on-scale occurrences (`8px`→`var(--space-2)` etc.) — pure refactor,
   zero visual change, safe to do now; verify with a build + the viewport-integrity matrix.
2. Snap off-scale values per component, screen-by-screen, eyeballing each against its screenshot
   (reuse `claude/shots/`), starting with the core menu/dialog/shop files.
