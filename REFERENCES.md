# REFERENCES — visual + interaction library for TYPE A WORD
_Branch: `night/references` · 2026-06-26 · STUDY / docs-only · NOT merged_

> ⚠️ Branch-only scratch for Andy. Delete before any merge. No game code touched.
> **Read this BEFORE any future visual build** so drafts are anchored to real references, not model defaults (per the DESIGN.md Craft Bar).

**Locked direction this library serves:** vector / blocky / pixel / cyberpunk-neon, **motion-first** — the WOW is INTERACTION, not decoration. NOT graffiti walls. Everything below is ranked against that + the DESIGN.md palette (#FF2EC4 / #2EFFE0 / #FFE94A / #FF6B3D / #9A1AFF on #0d0618) and motion rules (snappy, offset/staggered, transitions-as-events, reduced-motion-safe).

### ⚠️ Capture note (honest limitation)
This session's browser automation **could not reliably save binary screenshots** into `references/` (the save-to-disk call returned no usable path / timed out), and two of the named galleries were access-walled: **CodePen global search now requires login**, and **Awwwards** sits behind a cookie-consent banner I don't accept unattended. So this library **cites the live source URL for each reference** (open them to see the motion — static PNGs wouldn't convey it anyway) and is **explicit about what I confirmed live vs. described from established, reproducible technique**. The one source that loaded clean and login-free — **Game UI Database** — I studied directly (Cyberpunk 2077, confirmed live). See `references/README.md` for the intended capture list to re-run when an unattended saver is available.

---

## A. HOVER STATES (mode cards, buttons)
1. **3D cursor-tilt cards** — *technique, reproducible* · ref: `tilt.js` / `vanilla-tilt.js` demos (https://micku7zu.github.io/vanilla-tilt.js/)
   - **What:** card rotates toward the cursor on a perspective plane (rotateX/rotateY from cursor offset), optional glare sheen, springy settle on leave.
   - **Why it works:** gives a flat card *weight + face*; the parallax tracks you so it feels physical, not scripted. The settle is the whole feel.
   - **How:** `perspective` on the parent; map normalized cursor offset → `rotateX/Y`; transform-only (GPU); spring/elastic ease-out on leave. (This is exactly what `night/interactions` GameCard.jsx + the `night/spring-sandbox` integrator already do.)
   - **DESIGN.md fit:** ✅ core — this is the house mode-card move.
2. **Magnetic buttons** — *technique* · ref: GSAP magnetic-button demos / Codrops "magnetic" tutorials (https://tympanus.net/codrops/?s=magnetic)
   - **What:** the button (and/or its label) is pulled toward the cursor within a radius, snapping back past the edge.
   - **Why:** rewards intent before the click — the UI "reaches for you." High delight, low cost.
   - **How:** on `pointermove` within bounds, translate by `(cursor - center) * strength`; GSAP/spring back on leave. rAF-coalesced.
   - **Fit:** ✅ CREATE ROOM / JOIN / START buttons.
3. **Neon ignite on hover** — *confirmed direction (Cyberpunk 2077 menus, Game UI DB)* + technique
   - **What:** a dim outline that blooms to full neon on hover, accent saturates, optional 1-frame flicker like a sign settling.
   - **Why:** "powering on" reads as responsiveness; the flicker adds hand-character (anti-default).
   - **How:** layered `box-shadow`/`filter: drop-shadow` ramp on opacity; `steps()` flicker keyframe; dim at rest. (Shipped in `night/interactions`.)
   - **Fit:** ✅ already the card treatment; extend to primary buttons.

## B. CURSOR-REACTIVE BACKGROUNDS
4. **Cursor-displaced particle / dot field** — *technique* · ref: Codrops interactive-grid/particle demos (https://tympanus.net/codrops/)
   - **What:** a grid of dots/blocks that push away from or lean toward the cursor.
   - **Why:** the whole canvas feels alive + aware without competing with foreground text.
   - **How:** canvas or CSS-var driven; per-point displacement = falloff(distance to cursor); rAF; cap point count on mobile.
   - **Fit:** ⚠️ good for MENU only — DESIGN.md warns 3 stacked bg systems = noise; gate OFF in-game (see the audit's perf finding).
5. **Trailing cursor / custom pointer** — *already in repo* (`CursorTrail.jsx`) + ref: Awwwards "reactive cursor" collection (https://www.awwwards.com/awwwards/collections/reactive-cursor/) *(consent-walled this session)*
   - **What:** a custom cursor with an easing trail / blob that lags and catches up.
   - **Why:** ties every screen together with one motion signature.
   - **How:** lerp a follower toward the real pointer each frame; blend modes for neon.
   - **Fit:** ✅ keep; ensure it's gated on coarse-pointer (no touch).

## C. CLICK / PRESS FEEDBACK
6. **PUNCH press (scale overshoot + hard shadow slam)** — *house move (DESIGN.md §4 PUNCH)*
   - **What:** ~1.07 scale overshoot + quick settle, shadow offset snaps bigger then back, ~280ms.
   - **Why:** the signature "snap" — impact you feel. Reuse, don't reinvent.
   - **How:** keyed scale keyframe + box-shadow offset; fire on accept/select.
   - **Fit:** ✅ canonical; map to every primary action.
7. **Ripple / shockwave from click point** — *technique* · common in juicy web games (itch.io web titles, https://itch.io/games/html5)
   - **What:** an expanding ring/flat burst from the exact cursor coordinate on click.
   - **Why:** localizes the action to where you clicked — very arcade.
   - **How:** spawn an absolutely-positioned element at click xy, animate scale+fade, self-remove.
   - **Fit:** ✅ pairs with PUNCH on card select; flat rings (no blur) to stay on-palette.

## D. TRANSITIONS (screen-to-screen)
8. **Persona-style diagonal bar wipe** — *house move (DESIGN.md PERSONA WIPE)* + ref: Persona 5 menu transitions (Game UI DB → Persona 5)
   - **What:** skewed solid-color bar wipe with a mid-wipe flash word, ≤500ms, aggressive.
   - **Why:** transitions-as-EVENTS; consistency across every nav is the brand.
   - **How:** position:fixed overlay, skew −20°, flat fills, pointer-events:none — never gates the screen (per CLAUDE.md trap).
   - **Fit:** ✅ already the system; keep cosmetic-only.
9. **Glitch / datamosh cut** — *confirmed (Cyberpunk 2077 title + menu, Game UI DB)*
   - **What:** RGB-split + slice-offset glitch on the title/letters and on hard cuts.
   - **Why:** instantly "cyberpunk"; cheap, high-identity, hand-crafted feel.
   - **How:** SVG `feTurbulence`+`feDisplacementMap`, or CSS clip-path slice layers with cyan/magenta channel offset; fire as a 150–250ms one-shot, reduced-motion → plain cut.
   - **Fit:** ✅ strong for the wordmark + Word Bomb impact frames. Use sparingly (Craft Bar: intentional, not constant).

## E. NEON / GLOW TREATMENT
10. **Layered box-shadow / text-shadow neon** — *confirmed direction* · ref: Cyberpunk 2077 HUD (Game UI DB)
    - **What:** multiple stacked shadows (tight bright core + wide soft bloom) in one accent, dim→bright on state.
    - **Why:** real glow depth vs. a single flat shadow (anti-default).
    - **How:** 2–3 `box-shadow`/`text-shadow` layers same hue, escalate opacity/blur on hover/active; never animate blur on big areas (perf).
    - **Fit:** ✅ cards (shipped), timer, primary buttons. Keep flat fills per palette; glow is the only "soft" element allowed.

## F. TYPOGRAPHY IN MOTION
11. **Per-letter wave / LETTER-BOUNCE** — *house move (DESIGN.md)* — split into inline-block spans, staggered delay (~0.08s). FNF signature. ✅ titles.
12. **Scramble / decode-in text** — *technique* · ref: Codrops "text scramble" / decode demos (https://tympanus.net/codrops/?s=scramble)
    - **What:** letters resolve from random glyphs into the final word.
    - **Why:** "terminal decoding" reads as cyberpunk + draws the eye to a value (combo, category).
    - **How:** interpolate each char from a random-glyph pool to target over N frames; reduced-motion → instant.
    - **Fit:** ✅ the Word Bomb combo reveal + category reveal; pairs with the new live-typing per-letter pop (`night/wordbomb-feel`).
13. **Per-letter pop-in live typing** — *now shipped (`night/wordbomb-feel`)* — each typed char mounts with a one-shot pop + block caret. ✅ the multiplayer differentiator.

---

## TOP 10 STEALABLE TECHNIQUES FOR TYPE A WORD (mapped)
1. **3D cursor-tilt on mode cards** → menu mode cards *(shipped `night/interactions`; pick spring via `night/spring-sandbox`)*.
2. **Magnetic primary buttons** → CREATE / JOIN / START / SEND.
3. **Neon ignite (dim→bloom + flicker)** → cards (shipped) + extend to buttons + the Word Bomb timer.
4. **Glitch cut on the wordmark + impact frames** → splash title, Word Bomb accept/KO.
5. **Scramble/decode-in reveal** → Word Bomb combo + Category Blitz category reveal.
6. **Localized click ripple/shockwave** → every card select + button press (pair with PUNCH).
7. **Cursor-displaced dot/block field** → MENU background only (gate off in-game — perf).
8. **Layered-shadow neon depth** → timer, hearts/last-life, primary buttons.
9. **Per-letter live-typing pop + caret** → Word Bomb live opponent typing *(shipped `night/wordbomb-feel`)*; reuse for Category Blitz answers.
10. **Persona diagonal wipe with flash word** → every screen nav *(house system; keep cosmetic-only per CLAUDE.md trap)*.

### Sources studied / cited
- **Game UI Database — Cyberpunk 2077** (https://www.gameuidatabase.com/gameData.php?id=439) — **confirmed live**: glitch/distorted title type, neon cyan/red/yellow on near-black, flat 2.0 panels, red transactional menus. The cleanest on-direction reference in this session.
- **Codrops** (https://tympanus.net/codrops/) — magnetic, scramble, interactive-grid tutorials (technique source; reproducible).
- **vanilla-tilt.js** (https://micku7zu.github.io/vanilla-tilt.js/) — tilt-card technique.
- **Awwwards reactive-cursor / cursor collections** (https://www.awwwards.com/awwwards/collections/reactive-cursor/) — *cookie-consent walled this session; cited for Andy to browse.*
- **itch.io HTML5 games** (https://itch.io/games/html5) — juicy web-game click/ripple feedback.
