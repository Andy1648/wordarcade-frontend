# NIGHT REPORT — branch scratch (DO NOT MERGE)

> ⚠️ This file is **branch-only scratch** for Andy's morning review. **Delete it before any eventual merge to main.** It lives only on `night/*` branches.

---

## Spring sandbox
_Branch: `night/spring-sandbox` · 2026-06-26 · Tier 2 (UI) · NOT merged, throwaway demo_

A standalone decision aid to pick the tilt physics by eye. **Not wired into the real game** — no menu/cards/game logic touched.

### How to open
- Preview: **https://wordarcade-frontend-5g1r5bahc-beenchilling.vercel.app/#spring-sandbox** (hash route — works with no server rewrite)
- The real app is unchanged: the root path still loads TYPE A WORD; only the `#spring-sandbox` hash renders the demo (verified both locally).

### What it is
4 identical cards that tilt toward the cursor on hover (perspective + rotateX/rotateY mapped to cursor offset) and spring back on leave — each card driven by a DIFFERENT spring config so the feels can be compared side by side. Each card shows its `tension / friction / mass` on-screen.

### The 4 configs shown (tension = stiffness, friction = damping)
| Card | Character | tension | friction | mass |
|------|-----------|--------:|---------:|-----:|
| **SNAPPY**  | quick, minimal overshoot   | 420 | 32 | 1   |
| **BOUNCY**  | playful overshoot          | 520 | 12 | 1   |
| **WEIGHTY** | slow momentum              | 210 | 26 | 2.6 |
| **CALM**    | smooth, no bounce          | 170 | 30 | 1   |

Shared: `MAX_TILT = 16°` at the card edge (pushed a touch high so the differences read clearly in the demo; the real card-tilt currently ships ~9°).

### How it's built
- **No new deps** (no Framer Motion). A tiny self-contained rAF spring integrator (semi-implicit Euler, per-axis `{stiffness, damping, mass}`) lives in `SpringSandbox.jsx`. The cursor sets each axis's TARGET; the spring chases it; on leave the target snaps to 0 so the card springs back with that config's own overshoot/settle.
- **Perf:** transform-only (GPU); one rAF loop per card; `pointermove` only writes the target (no per-event layout) so it's effectively rAF-coalesced; `dt` clamped so a tab stall can't explode the integrator.
- **Reduced-motion:** under `prefers-reduced-motion: reduce` the rAF loop is never started (cards stay flat/calm), plus a CSS belt-and-braces `transform:none`. The header notes when it's active.
- **Isolation:** lazy-loaded via `React.lazy` and gated in `main.jsx` on `#spring-sandbox`, so the demo code is code-split out of the normal app bundle and the real app never imports it.

### Verified in Chrome (local preview build)
- All 4 cards render with labels + numeric params visible. ✅
- Hovering a card tilts it in 3D toward the cursor; springs back on leave. ✅ (BOUNCY's overshoot vs CALM's smooth settle is the comparison.)
- Console clean — 0 errors. ✅
- Root path (`/`) still loads the real TYPE A WORD app. ✅

### Files
- `src/components/SpringSandbox.jsx` — **NEW** (demo + rAF spring util)
- `src/components/SpringSandbox.css` — **NEW**
- `src/main.jsx` — `#spring-sandbox` route guard (lazy import); real-app render path unchanged.

### What only Andy's eyes can judge
- **Which of the 4 feels right** for the real card-tilt — that's the entire point; springiness can't be read from a screenshot.
- Whether `MAX_TILT` should come down for the real cards (16° here is demo-loud).
- Whether the winning config wants a tweak (e.g. SNAPPY with slightly less friction, or BOUNCY with a touch more) before it's ported onto the real mode cards.
