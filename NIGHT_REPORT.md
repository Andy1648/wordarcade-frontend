# NIGHT REPORT — branch scratch (DO NOT MERGE)

> ⚠️ This file is **branch-only scratch** for Andy's morning review. **Delete it before any eventual merge to main.** It lives only on `night/*` branches.

---

## Mode-card hover — cursor-tilt + neon ignite + sound
_Branch: `night/interactions` · 2026-06-26 · Tier 2 (UI/interaction) · NOT merged, NOT on prod_

### Diff summary
- `src/components/GameCard.jsx` — tilt logic (refs + rAF pointer handler + reset) and a new `.game-card-tilt` wrapper element. (+~70)
- `src/components/GameCard.css` — `perspective` on the wrap, the `.game-card-tilt` transform/spring + neon `::after` glow + flicker keyframe + reduced-motion gating. (+~68 / −1)
- **2 files changed, 138 insertions(+), 1 deletion(−)** (commit `917af7f`).
- No other files touched. (LoadingScreen.jsx, audit `.md`s, generated_content_review.js, and the stray gameLogic.test.js change all left untouched/uncommitted.)

### The 3 layers as built
1. **Cursor-tilt (3D parallax).** A dedicated `.game-card-tilt` layer sits between the swaying wrapper and the scaling card so all three transforms compose instead of fighting. `perspective: 900px` on the wrap; a `pointermove` handler (rAF-throttled, reads `clientX/Y`) writes `--tilt-x`/`--tilt-y` degrees from the cursor's normalised offset to the card centre → `rotateY`/`rotateX`. On leave the angles zero and a long elastic `cubic-bezier(0.18,1.5,0.4,1)` springs it back; while hovered the transition is near-instant (0.07s) so the lean tracks live. The existing scale-up stays on the inner card.
2. **Neon ignite.** A glow halo (`.game-card-tilt::after`, box-shadow in the card's own accent) — on the tilt layer, NOT the `overflow:hidden` card, so it escapes; behind the opaque card so only the outer bloom shows. Dim at rest, blooms to full on hover with a quick buzzing-sign flicker keyframe. Per-card accent = the card's fill (`--card-accent` = cyan / orange / purple).
3. **Sound.** The hover-tick already fires once-per-enter via the existing sound system (`onHover` → `Homepage.handleHover` → `sound.menuHover()`, a 660Hz/30ms sine blip identical to juice `sfx('hover')`, deduped, mute-respected). Left as the single source — adding a second identical blip would just double it, and touching `Homepage` is out of scope for "cards only." **Note for Andy:** if you'd rather the card own its tick via the juice toolkit, that's a one-liner — flag it.

### Tunability tokens (defaults + location)
- `--neon-idle: 0.18` — idle glow opacity (`src/components/GameCard.css`, on `.game-card-tilt`)
- `--neon-on: 1` — hover glow opacity (same)
- `--neon-flicker: neon-flicker` — flicker animation name; set to `none` to disable the buzz (same)
- `MAX_TILT = 9` (degrees) — tilt strength, the one place it's set (`src/components/GameCard.jsx`, top of file)

### Constraints
- **Reduced-motion:** tilt JS is gated by `prefersReducedMotion()` (no angles ever set); CSS also forces `transform:none` + kills the flicker, keeping a calm steady glow on hover.
- **Performance:** transform-only (GPU), `pointermove` rAF-throttled, glow via opacity. Only the hovered card animates.
- **Preserved:** click/select handlers, routing, keyboard activation, existing juice — all untouched (hover FEEL only). No WS/game logic.

### Preview URL (branch)
https://wordarcade-frontend-ix7aq246v-beenchilling.vercel.app

### What only Andy's eyes/ears can judge
- Whether the **tilt amount + spring feel** is right (too stiff / too loose / too much) — static screenshots can't show the live lean. `MAX_TILT` and the spring bezier are the dials.
- Whether the **neon flicker** reads as "cool buzzing sign" vs "gimmicky" — `--neon-flicker: none` kills it.
- Whether the **glow intensity** (`--neon-on` / blur radii) is tasteful or too loud on the real monitor.
- The **hover-tick sound** — confirm it fires once per card-enter and the volume sits right (ears only).
- That **all three cards hold 60fps** while hovering on the actual machine.
