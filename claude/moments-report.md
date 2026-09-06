# JOB 6 — progression moments (feat/moments)

Three progression moments made to feel like rewards. All ≤1200ms, skippable where it matters,
transform/opacity only, reuse existing pooled nodes, and add ZERO new infinite animations (the
build-failing will-change + card-beat budget e2e both stay green). Reduced motion is honoured.
Gate: `vite build` 0, lint 0 errors, unit 439/439, e2e menu-xp + card-beat 8/8, dialog untouched.

## 1. LEVEL UP now scales with the level  (`MenuXp.jsx` / `MenuXp.css`)
Audit: a LV2 and a LV50 played the identical 1500ms stamp (only the phrase text cycled). Now
`celebrate(level)` derives a **tier 0-4** from the level (+ a milestone flag at 10/25/50/100) and:
- sets `data-tier` / `data-milestone` for STATIC emphasis — a hotter title colour (gold→cyan→orange→
  pink) and a larger title scale at a milestone;
- fires a **tier-scaled pooled shard burst** from the layer centre (0 shards at an early level, up to a
  full burst at a milestone — reusing the existing shard pool, gated off under reduced motion);
- shows `LEVEL n!` + `MILESTONE` at a milestone.
So an early level stays calm and a LV50 milestone genuinely erupts (see `levelup-early.png` vs
`levelup-milestone.png`).

## 2. REBIRTH is now a ceremony  (`MenuXp.jsx` / `MenuXp.css` / `Homepage.jsx`)
It was a text stamp ("REBIRTH n / PERMANENT MULTIPLIER"). Now `rebirthCelebration(n, fromLevel, mult)`
plays a sequenced ≤1200ms moment on menu return:
- the **level counter winds down to ZERO** (from the level you rebirthed at, ~520ms, capped ticks so a
  LV120 rebirth still winds smoothly);
- the new **×N FOREVER multiplier STAMPS in** (scale/opacity transition);
- a **MOMENTUM KEPT** line proves the momentum rail survives the reset.
It is **skippable** — a tap or any key fast-forwards to the end state. Reduced motion jumps straight to
the end state. `Homepage` now feeds it the rebirth threshold (fromLevel) + `rebirthMult(n)`. Peak in
`rebirth-peak.png`, mid-wind in `rebirth-winding.png`.

## 3. CHAIN / FUSE unlock IN PLACE  (`GameCard.jsx` / `GameCard.css`)
A card watched locked for 20 levels used to just quietly appear unlocked. Now, on the locked→unlocked
edge (the first time only, gated per-mode in `localStorage taw.unlockSeen.<id>`), the card fires a
one-shot **pop + an "UNLOCKED!" flash plaque** (~900ms, finite, transform/opacity). Mirrors the proven
one-shot shake pattern; reduced motion skips it (the card simply appears unlocked).

## Verification note
The peak-frame screenshots were captured by driving the real menu and forcing each fx element to its
peak state (real CSS) via a throwaway spec (removed, not committed). They render over the splash in the
grab (the fx layer is shared) — on the live menu they sit over the menu background. Styling landed in
one round; timing/integration are covered by the passing e2e + build-failing perf tests.
