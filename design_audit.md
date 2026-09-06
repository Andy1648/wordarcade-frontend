# Design Audit — TYPE A WORD

Scan of all CSS/component files under `src/` (plus `index.html`) against the locked design rules in `CLAUDE.md`. Findings are ordered by **player-visibility** (always-seen surfaces first, decorative/low-opacity last). Line numbers verified via Grep/Read on the working tree.

---

## Summary — violations by category

| Category | Count | Notes |
|---|---|---|
| **Gradients** | 9 | 2 are flagged-but-likely-intentional ambience (splash scrim, imposter wash); 1 is the explicitly ALLOWED WallScene floor gradient; rest are dot/brick textures and a fade mask. |
| **Blur** | 0 | No `filter: blur`, no `backdrop-filter`. The two `drop-shadow(0 0 0 transparent)` declarations are no-op placeholders, not blur. |
| **Glow** | 0 | The one spread `box-shadow` (bomb vignette) is explicitly hard-edged/no-blur; not a glow. |
| **Soft shadows** | 0 | Every `box-shadow`/`text-shadow` uses a 0 blur radius. Clean. |
| **Black outline on colored card/button** | ~25+ | Widespread `border: Npx solid #000` on filled colored buttons/badges/cards. Largest rule-conformance gap. |
| **Border-radius (non-8px on card/button)** | 3 | Two `14px` card radii + one `999px` pill. Plus minor 3px/6px/10px chips (low severity). |
| **Off-palette colors** | ~10 | `#AAAAAA` grey, the red family `#FF5C5C` / `#FF3A2A` / `#B83A3A` / `rgba(255,60,60)`, and tan/brown `#E8B98A` / `#B0824E` (bomb art — intentional). |
| **White / near-white backgrounds** | 5 distinct | Text inputs and player chips use `background:#fff`. (Many other `#fff` hits are white *text* or one-frame flash effects — those are fine.) |

---

## A. HIGH VISIBILITY — always-seen surfaces (splash, homepage, lobby/room inputs, game screen)

### A1. White backgrounds on text inputs and chips (VIOLATION — white background)
White or near-white backgrounds are explicitly disallowed. These are prominent, persistent UI.

- `src/components/LobbyScreen.css:83` — `.lobby-input { background: #fff; }`
- `src/components/LobbyScreen.css:117` — `.lobby-code-input { background: #fff; }`
- `src/components/RoomScreen.css:73` — `.room-player-chip { background: #fff; }`
- `src/components/RoomScreen.css:123` / `:160` — name/code inputs `background: #fff;`
- `src/components/GameScreen.css:1036` — `.game-word-input { background: #fff; }` (the main typing field — very high visibility)

**Fix:** use a panel fill from the palette, e.g. `background: #1a0b2e;` with white text (text is already light in most), or a light tint derived from the palette. If a light field is desired for contrast, pick a palette tint rather than pure white.

### A2. Off-palette grey outlines on those same inputs/chips (VIOLATION — off-palette + non-darker-shade outline)
`#AAAAAA` is a foreign neutral grey, not a darker shade of any palette fill.

- `src/components/LobbyScreen.css:84` — `.lobby-input { border: 4px solid #AAAAAA; }`
- `src/components/LobbyScreen.css:118` — `.lobby-code-input { border: 4px solid #AAAAAA; }`
- `src/components/RoomScreen.css:74` — `.room-player-chip { border: 3px solid #AAAAAA; }`
- `src/components/RoomScreen.css:124` / `:161` — `border: 3px solid #AAAAAA;`
- `src/components/GameScreen.css:1037` — `.game-word-input { border: 4px solid #AAAAAA; }`

**Fix:** replace the fill+outline pair with a palette card: e.g. fill `#1a0b2e`, outline a darker purple `#0f0820` or accent `#5A0EAA`; or if keeping a colored chip, outline = darker shade of the fill.

### A3. Black borders on colored buttons / badges (VIOLATION — black outline on filled element)
Per the rule, a black border on a colored card/button is a violation; black is only allowed for text strokes and hard offset shadows. These elements have BOTH a black offset shadow (fine) AND a black `border` (violation). High-visibility examples:

- `src/components/GameScreen.css:164` — `.game-meta-diff { border: 3px solid #000; }` (filled `#9A1AFF` badge, line 175). Use darker purple `#5A0EAA` (already used as `border-color` on a sibling — line 176 — so this base rule's `#000` is overridden there, but the base `.game-meta` still ships black).
- `src/components/GameScreen.css:213` — `.game-meta-* { border: 3px solid #000; }` base badge (filled `#2a1450`).
- `src/components/GameScreen.css:1178` — `.go-* { border: 4px solid #000; }` on a `#1a0b2e` panel.
- `src/components/GameScreen.css:1579` / `:2000` — buttons/cards on filled backgrounds with `border: 4px solid #000`.
- `src/components/RoomScreen.css:18` & `LobbyScreen.css:18` & `GameScreen.css:36` & `CreditsScreen.css:61` & `Homepage.css:392` & `LoadingScreen.css:187` — main **panel/card** `border: 4–5px solid #000`. These are the big framed cards; a black frame on a `#1a0b2e` panel is the canonical violation.

**Fix:** swap each `#000` border to a darker shade of the element's fill. For a `#1a0b2e` panel use `#0d0618` or `#3a1d5e`; for the `#9A1AFF` badge use `#5A0EAA`; keep the separate `box-shadow: … 0 #000` (those are correct). Note many *colored* buttons already do this correctly (e.g. `#FF6B3D` card with `#FF2EC4`/darker outlines, `#2EFFE0` with `#1A9985`), so the pattern to follow already exists in the codebase.

### A4. Off-palette red family (VIOLATION — off-palette)
The palette's only warm reds are pink `#FF2EC4` and orange `#FF6B3D`. A separate true-red family appears across high-visibility elements:

- `src/components/GameScreen.css:184` / `:295` — `.game-leave-btn` / danger fill `background: #FF5C5C;` with outline `#B83A3A` (line 185).
- `src/components/GameScreen.css:1158`, `:1949` — `#FF5C5C` kill-feed/timeout fills.
- `src/components/LobbyScreen.css:105` — error text `color: #FF5C5C;`
- `src/components/RoomScreen.css:259` / `:260` — `background: #FF5C5C; border: 4px solid #B83A3A;`
- `src/components/ImposterWord.css:420` — `.iw-award.imposter { background: #FF5C5C; }`
- `src/components/GameScreen.css:2553` — `.game-warmth { background: #FF3A2A; }` (full-screen warmth wash, low opacity inline).

**Fix (decide intent):** if a distinct "danger red" is wanted, it should be formally added to the palette (it is used consistently enough to look deliberate). Otherwise remap danger to orange `#FF6B3D` (outline `#B8430F`) to stay strictly on-palette. The matching `#B83A3A` outlines are at least darker shades of the red, so only the base hue is off-palette.

### A5. Homepage brick texture uses pure-black gradient lines (gradient — low/medium)
- `src/components/Homepage.css:54-56` — `repeating-linear-gradient(... #000 0 2px ...)` ×3 building the brick mortar.

**Fix:** This is a flat repeating-gradient used as a texture (not a soft color blend), so it is borderline; the bigger concern is the `#000` lines reading as black outlines over the `#1a0b2e` wall. Acceptable as texture, but if strict, switch mortar lines to a dark purple `#0d0618`. Mark LOW.

### A6. Homepage card radius off-spec (radius — low)
- `src/components/Homepage.css:33` — `border-radius: 14px;` on the dot-grid card backdrop (`.homepage` wall card). Cards should be 8px.
- `src/components/CreditsScreen.css:21` — `border-radius: 14px;` on the credits panel card.

**Fix:** change both to `border-radius: 8px;`.

---

## B. MEDIUM VISIBILITY — splash & in-game overlays

### B1. Splash dimming scrim radial-gradient (gradient — FLAGGED, likely intentional)
- `src/components/SplashScreen.css:21-26` — `background: radial-gradient(ellipse at center, rgba(13,6,24,0.34) … 0.74)`.
This is the recently-added vignette scrim over the WallScene. It is a multi-stop radial gradient = technically a gradient violation, but it is dimming ambience (all stops are the same dark-bg color at varying alpha, not a hue blend). **Flagged for human decision** per the audit brief. If it must go, replace with a flat `rgba(13,6,24,0.55)` overlay, losing the centre-bright vignette.

### B2. Imposter "hide" red wash radial-gradient (gradient — FLAGGED, intentional ambience)
- `src/components/ImposterWord.css:20` — `radial-gradient(ellipse at center, rgba(255,60,60,0.16) … 0.28)`.
The file's own header comment (line 6) calls out "the subliminal red wash" as an intended exception. It is also off-palette red. **Note as intentional**; if strict, flatten to `background: rgba(255,107,61,0.18)` (orange, on-palette) or a flat dark-red panel tint.

### B3. Bomb reject-flash radial-gradient (gradient — low, transient)
- `src/components/GameScreen.css:528` — `radial-gradient(circle, rgba(255,60,60,0.55) 0%, rgba(255,60,60,0) 70%)` — a 250ms flash on a rejected word, plus off-palette red. Transient and over the bomb only. **Fix:** could be a flat `rgba(255,107,61,0.5)` circle that fades via opacity; LOW priority.

### B4. Pill radius on a stat element (radius — low)
- `src/components/GameScreen.css:2066` — `border-radius: 999px;` (pill). If this is a button/card it should be 8px; if it's a decorative progress/stat pill, note only. Verify element role; LOW.

---

## C. LOW VISIBILITY — decorative, background textures, no-ops

### C1. ALLOWED environmental gradient (note only — explicitly permitted)
- `src/components/WallScene.css:41` — `linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.55) 100%)`, with the code comment at lines 36-40 and `WallScene.jsx:197` declaring it "the one allowed environmental gradient" (alley floor darkening). **ALLOWED — leave as is.**

### C2. Dot-grid / brick background textures (gradient — low, decorative)
- `src/components/Homepage.css:27`, `GameScreen.css:34`, `CreditsScreen.css:18` — `radial-gradient(circle, rgba(255,46,196,0.0X) …)` faint dot grid (on-palette pink at very low alpha).
- `src/components/WallScene.css:29-31`, `WallScene.css:166`, `WallScene.css:200`, `SplashScreen.css:185` — brick `repeating-linear-gradient` + dot-grid radial-gradients (background art).
These are flat repeating/dot textures, not soft hue blends; consistent with the cartoon-poster look. **Low severity — note, likely keep.**

### C3. Kill-feed fade mask (gradient — low, functional mask)
- `src/components/GameScreen.css:1908-1909` — `mask-image: linear-gradient(to bottom, #000 72%, transparent 100%)`. This is an alpha **mask**, not a visible color gradient. **Acceptable — note only.**

### C4. No-op drop-shadow placeholders (not a violation)
- `src/components/LoadingScreen.css:140` and `src/components/Mascot.css:47` — `filter: drop-shadow(0 0 0 transparent);`. Zero-size, transparent — a no-op placeholder (likely to force a compositing layer). **Not a blur/glow; note only.**

### C5. Bomb art tan/brown fills (off-palette — intentional art)
- `src/components/GameScreen.css:989` `#E8B98A`, `:990` `#B0824E`, `:917` `#1a1008` — fuse/bomb illustration colors. Foreign hues but part of bespoke SVG-ish bomb art. **Note as intentional art; not a UI-chrome violation.**

### C6. Minor non-8px radii on small chips (radius — low / not card-buttons)
- `GameScreen.css:186` (3px), `ImposterWord.css:109` (6px), `:156`/`:317`/`:409` (10px), `RoomScreen.css` host badge uses no radius. Small skewed chips/badges — borderline; flag only if treated as buttons. The `50%` circles (dots, avatars, spinners) and `4px` splash chip are fine.

---

## Worst-offenders summary (read this first)

1. **White input/chip backgrounds** — the main game word input (`GameScreen.css:1036`) plus all lobby/room name & code fields use `background:#fff`, a direct white-background violation on the most-touched controls.
2. **`#AAAAAA` grey outlines** on those same inputs/chips — off-palette neutral grey, and not a darker shade of any fill (`LobbyScreen.css:84/118`, `RoomScreen.css:74/124/161`, `GameScreen.css:1037`).
3. **Black borders on colored cards/buttons/panels** — pervasive `border: Npx solid #000` (e.g. main panels in `GameScreen/RoomScreen/LobbyScreen/CreditsScreen/Homepage/LoadingScreen`, badges at `GameScreen.css:164/213`). Should be darker shades of each fill; the codebase already does this correctly elsewhere, so it's a consistency fix.
4. **Off-palette red family** (`#FF5C5C`, `#FF3A2A`, `#B83A3A`) used for danger/error/leave across many screens — either canonize a danger red in the palette or remap to orange `#FF6B3D`.
5. **Splash radial-gradient scrim** (`SplashScreen.css:21`) and **imposter red wash** (`ImposterWord.css:20`) — flagged gradients, but both are same-hue alpha ambience the code treats as intentional; human call. The **WallScene floor gradient is explicitly allowed**.
6. Clean bills of health: **no blur, no glow, no soft (blurred) shadows** anywhere — every shadow is a hard `Npx Npx 0` offset. Only the outline-color and white-background rules are materially out of spec.
