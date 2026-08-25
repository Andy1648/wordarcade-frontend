# Style Consistency Audit — TYPE A WORD

Report only (item 4 of the UI pass). **No style files were changed for this audit.** Walks every
screen and lists where the FOREGROUND UI departs from the locked Newgrounds/FNF + Y2K direction:
bold blocky vector, thick outlines, **hard offset shadows in solid black** (`Xpx Ypx 0 #000`),
**flat colors (no gradients / no blur / no glow)**, neon palette, Bungee/Bungee Shade + Space Mono.

**Headline:** the app is highly consistent. Fonts are 100% compliant (no stray families). No blur
on foreground UI outside the sanctioned mode-dialog scrim. Every real departure is a **soft or
glowing shadow** (a shadow with a non-zero blur radius, or a colored bloom) where the house rule is
a hard black offset. They cluster on the **menu (Homepage/GameCard/WordCountChip)**; the in-game and
room/lobby/shop/stats screens are clean.

SAT Rush's cream-paper manga treatment is a **deliberate, sanctioned sub-style** (DESIGN.md) — noted
below, never counted as a defect.

---

## Departures (foreground UI)

### Homepage — WordCountChip (`src/components/WordCountChip.css`)
- **L28** `box-shadow: 5px 5px 0 #000, inset 0 0 16px rgba(255,46,196,0.22);` — the `inset 0 0 16px`
  is a **soft blurred pink inner glow**. Hard-offset layer is fine; the inner glow departs from the
  no-glow rule. (The file self-labels it a "sanctioned small exception," but that note is the
  author's, not CLAUDE.md.)
- **L54** `box-shadow: inset 0 3px 5px rgba(0,0,0,0.78), inset 0 -2px 3px rgba(0,0,0,0.55);` —
  **soft blurred inner shadows** (5px/3px) on the digit slots. Should be hard (`Xpx Ypx 0`).
- **L69, L78** `text-shadow: 0 2.5px 0 rgba(0,0,0,0.5);` — 0-blur so technically hard, but
  **semi-transparent** black instead of solid `#000`. Minor.

### Homepage — game cards + footer links
`src/components/GameCard.css`
- **L156/L167** `--beat-glow-blur: 22px;` → `box-shadow: inset 0 0 var(--beat-glow-blur) 2px var(--card-glow);`
  — a **22px soft neon bloom** pulsing on the menu game cards. Opacity-only/beat-driven, but it is a
  glow on a foreground card (broader than the sanctioned menu-*frame* beat-glow).
- **L194–203** SAT-Rush menu card: `…, 5px 5px 0 #111, 0 14px 32px -8px rgba(0,0,0,0.75);`
  (hover `0 18px 40px -8px …`) — the `0 14px 32px` layer is a **soft ambient drop shadow** (32px
  blur). Departs from hard-offset; note this lives in the menu's GameCard.css, not `src/satRush/`.
- **L252** glitch keyframe `box-shadow: inset 0 0 12px var(--card-glow);` — soft glow, but a
  transient ~200ms one-shot click FX. Minor.

`src/components/Homepage.css`
- **L555** `.homepage-credits-link` and **L837** `.homepage-daily-link` —
  `text-shadow: 0 1px 3px rgba(13,6,24,.95), 0 0 3px rgba(13,6,24,.95);` — **blurred (3px) dark
  halo** on foreground footer text (self-justified as legibility over the drifting splatter layer).

### Everywhere else — CLEAN
ShopScreen, StatsScreen, LobbyScreen, RoomScreen, PublicRoomsScreen, CgArmScreen, LoadingScreen,
LockedPreviewDialog, ModeDialog panel, CreditsScreen, ComboMeter, PlayerDot, ShareBar, ClackButton,
MusicButton, Solo.css (CHAIN/FUSE game): **all box-shadows are hard `Xpx Ypx 0`** (or colored hard
offsets like Lobby's `4px 4px 0 #2EFFE0`). No soft/glow shadows, no gradient fills, no blur.

### GameScreen — effectively clean
All `.game-*` panels/cards/buttons use hard black offsets. Its `radial-gradient` uses (reject flash,
danger/last-life/tension vignettes, clutch flash) are **full-screen `position:fixed/absolute;
pointer-events:none` atmospheric gameplay overlays**, not foreground panels — same
backdrop/atmosphere class as the sanctioned mode-dialog canvas. Its one colored `box-shadow`
(`0 0 0 5px rgba(255,92,92,.35)`, L1381/L1386) is **spread-only with 0 blur** (hard cel edge) —
compliant.

### Overlay / transition FX — noted, not foreground defects
- `MenuXp.jsx:425` `inset 0 0 64px 14px <colour>` — screen-edge streak-tier glow pulse (event FX).
- `KnifeSplit.css:222` `0 0 26px 9px rgba(255,255,255,.95)` — blade-glint glow on the wipe (transition FX).

---

## Sanctioned exceptions — confirmed, do **not** treat as defects
- **`src/satRush/` (SAT Rush)** — the entire cream-paper **manga/retro-print sub-style**: halftone
  `radial-gradient` tones, paper/ink inset rules, off-register violet, `--redink`, ink-offset
  text-shadow. Deliberate per DESIGN.md. **Not a defect.**
- **`Homepage.css` `.homepage-beat-glow`** — the documented pink `radial-gradient` beat pulse
  (opacity-only, menu-frame-scoped). DESIGN-sanctioned flat-rule exception.
- **ModeDialog animated canvas** — `backdrop-filter: blur(4px)` scrim, the bottom legibility
  `linear-gradient`, and the animated `linear-gradient` fire/streaks background
  (ModeDialogBackground.jsx). The intentional animated mode-dialog scene.
- **WallScene / wall-system** — brick/plaster/vignette gradients: the textured wall **backdrop**.

## Halftone / dot textures — acceptable (not gradients-as-fill)
`CreditsScreen.css:19`, `GameScreen.css:64/2994`, `SplashScreen.css:208`, `GameCard.css:212`
use `radial-gradient(circle, …0.8px, transparent)` as a **tiled polka/halftone `background-image`
texture**, and `MenuXp.css:57` a 1.5px `repeating-linear-gradient` notch pattern — consistent with
the Newgrounds print look, not smooth gradient fills.

## Systemic note (a choice, not a defect list)
DESIGN says outlines should be "a darker shade of the fill, not black." In practice the app's house
style is overwhelmingly `border: …px solid #000` + hard black shadow (nearly every button/card).
A minority use colored outlines (credits box `#5A0EAA`, Lobby ready `#2EFFE0`). This is a broad
stylistic decision, not a set of isolated bugs — flagged only if you want to enforce colored
outlines app-wide. The hundreds of black-border instances are not enumerated.

---

## Recommended priority (if/when these are addressed — NOT done here)
1. **WordCountChip inner glows** (L28, L54) → swap to hard `Xpx Ypx 0` shadows.
2. **GameCard SAT-Rush ambient drop shadow** (L194–203, the `0 14px 32px` layer) → hard offset.
3. **Homepage footer-link blurred text halo** (L555, L837) → hard 0-blur offset or a solid plate.
4. **GameCard 22px card beat-bloom** (L167) — lowest priority; it's opacity-only and reads as juice.
