# JOB 12 (quick-win audit) — off-palette color sprawl

**Scan:** every `#rgb`/`#rrggbb` literal in `src/**` (`.css`/`.jsx`/`.js`). **195 distinct hex values
across 1,854 uses** — against a documented house palette of **9** (7 brand + black + white). The
off-palette list below IS the finding; a consolidation plan + an enforcement test follow.

## Palette of record (CLAUDE.md)
`#FF2EC4`/`#FF4FA3` pink · `#2EFFE0` cyan · `#FFE94A` yellow · `#FF6B3D` orange · `#9A1AFF` purple ·
`#0d0618` bg · `#1a0b2e` panel · `#000` · `#fff`. Everything else is off-palette unless it's a
sanctioned sub-system (below).

## Sanctioned — NOT violations (exclude from any enforcement)
- **Theme files** (`src/theme/*`): each theme legitimately DEFINES an alternate palette via CSS vars —
  raw hex is correct there.
- **SAT Rush retro sub-style** (DESIGN.md): `#f0ead9`/`#f2efe7`/`#f3e2be` cream paper, `#c8321e`
  `--redink`. Documented, keep.
- **`.homepage-beat-glow`** pink radial (a documented flat-rule exception).

## The real sprawl (should become tokens)

**1 — DANGER RED family (highest-value fix): the palette defines NO danger color, so every reject/error
site invented its own red.** At least 5 near-identical reds:
`#ff5c5c` (27×) · `#ff4b4b` (13×) · `#ff2e2e` (9×) · `#ff3b3b` (6×) · `#ff4b4b`/`#b83a3a`/`#b4…`
variants. Spread across `Solo.css` (reject sill, dead-end, hot heat bar), `StatsScreen.css`,
`ShopScreen.css`, game-over. → **Add `--danger` (+ maybe `--danger-deep`) and collapse all five.**

**2 — MUTED-PURPLE / LAVENDER text family: ~10 near-identical tints for the same "secondary/caption
text on panel" role.** `#c9b8e8` (24×) · `#b9a7d6` (16×) · `#9a8bbf` (6×) · `#c8b8e0` · `#cdbdf0` ·
`#d8c9f0` · `#8a7bb0` · `#6b5a86` · `#4a3a63` · `#9a8bbd`. Visually interchangeable; no token, so each
component eyeballed its own. → **Add `--text-muted` / `--text-faint` (1–2 tokens) and collapse.**

**3 — Near-black sprawl:** `#111` (35×) + `#111111` (3×) used where `#000` or an `--ink` token belongs.
Two spellings of the same near-black. → **Fold to `#000` or a single `--ink` token.**

**4 — Yellow variants off `#FFE94A`:** `#b8a020` (22×, a dark-yellow border/shade), `#ffd54a` (6×),
`#f3e2be`. The `#b8a020` is consistently "the darker outline of a yellow fill" → it deserves a derived
token (`--yellow-edge`) rather than a hand-picked hex per site.

**5 — Blue family:** `#3da8ff` (14×, the Blitz blue — semi-documented in Homepage.css) plus variants
`#152744`, `#0a1424`. Promote `#3da8ff` to `--blitz-blue` and derive the darks.

**6 — Panel/dark variants:** `#2a1f3d`, `#2a1450`, `#0a0414`, `#2a1a0e`, `#3a2a10` — one-off darkenings
of `#1a0b2e`/`#0d0618`. Candidates for `color-mix()` off the two bg tokens rather than fresh hex.

## Recommended path (the JOB 12 consolidation, after this audit)
1. Add the missing SEMANTIC tokens the palette lacks — the gap that CAUSED the sprawl:
   `--danger`, `--danger-deep`, `--text-muted`, `--text-faint`, `--ink`, `--yellow-edge`, `--blitz-blue`.
   (Brand colors already have de-facto tokens; danger + muted-text are the real holes.)
2. Mechanical replace, family by family (danger first — smallest + highest clarity), one commit each,
   `viewport-integrity` after each to prove zero visual change.
3. **Enforcement (the "raw-hex build test"):** a unit test that greps `src/**` (EXCLUDING `theme/*`, the
   SAT retro files, and an explicit allowlist) and fails on any `#hex` outside the token set. Add it
   ONLY after step 2, or it fails on all 195 today. Gate it like `willChange.test.js`.

## Scope note
This is the **audit portion only** (report). The consolidation (steps 1–3) is a mechanical but broad
CSS sweep touching most component stylesheets — batchable Tier-3 work, but a separate task from this
finding. Nothing here is shipped as a code change.
