# Mobile Audit — TYPE A WORD

Audited every CSS + component file under `src/` plus `index.html`, against the CLAUDE.md mobile rules. Each clamp()/vw value and `@media (max-width: 600px)` / `420px` override was evaluated at its EFFECTIVE small-phone value (~360–390px), not the desktop value.

## Viewport meta — OK (not critical)
`index.html:7` — `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`. Present and correct. No action needed.

## Summary of findings
- **Touch-target (< 44px) issues: 4** (1 real, 3 minor/edge)
- **Input font-size (< 16px) issues: 0** — all three inputs (`lobby-input`, `lobby-code-input`, `game-input`) use `clamp(16px, …)` or higher floors; no iOS auto-zoom risk.
- **Fixed-width / overflow issues: 0 real** — global `overflow-x: hidden` (`index.css:16`) + a fixed `.app-viewport` clip box (`index.css:81-85`) neutralize all the large decorative fixed widths; see notes.

Good baseline: phones get explicit `min-height: 44px` on the primary buttons in Homepage, Lobby, Room, and GameScreen (send/skip/rematch/leave). The findings below are the elements that were MISSED by those rules.

---

## TOUCH-TARGET ISSUES (ordered by severity)

### 1. (MINOR but real) Imposter Word vote buttons — no min-height, ~33px tall
- **File / line:** `src/components/ImposterWord.css:185-197` (`.iw-vote-btn`)
- **Declaration:** `font-size: 13px; padding: 9px 0;` (no `min-height`)
- **Problem on mobile:** Effective height ≈ 13px text + 18px padding ≈ 33px — below the 44px minimum. This is the PRIMARY interaction of the Imposter Word voting phase (you tap a player's card to accuse them), and unlike the Word-Bomb/Category send/skip buttons it gets NO `min-height` bump in any media query. Most likely to be fat-fingered of all the findings.
- **Fix:** Add `min-height: 44px;` to `.iw-vote-btn` (or inside a `@media (max-width: 600px)` block to match the pattern used elsewhere).

### 2. (MINOR / edge) Room game-type & difficulty selector buttons — ~38–40px tall
- **File / line:** `src/components/RoomScreen.css:117-130` (`.room-gametype-btn`, `padding: 10px 4px; font-size: 10px`) and `RoomScreen.css:151-167` (`.room-difficulty-btn`, `padding: 9px 4px; font-size: 11px`)
- **Problem on mobile:** Game-type ≈ 10px + 20px ≈ 30px; difficulty (2 stacked lines + gap) ≈ ~40px. Both sit just under 44px. The `@media (max-width: 600px)` block (`RoomScreen.css:293-311`) only adds `min-height: 44px` to `.room-start-btn`/`.room-leave-btn`, skipping these toggle rows. They are in a flex row of 3, so they're already narrow.
- **Fix:** In the existing `@media (max-width: 600px)` block add `.room-gametype-btn, .room-difficulty-btn { min-height: 44px; }`.

### 3. (MINOR / edge) Category-Blitz "NEW CATEGORY" reroll button — ~38px tall
- **File / line:** `src/components/GameScreen.css:3096-3108` (`.cb-reroll-btn`)
- **Declaration:** `font-size: 12px; padding: 9px 18px;` (no `min-height`)
- **Problem on mobile:** ≈ 12px + 18px ≈ 30–38px tall, below 44px. Host/solo-only and used briefly in the reroll window, so low traffic, but still an undersized tap target.
- **Fix:** Add `min-height: 44px;` to `.cb-reroll-btn`.

### 4. (MINOR / edge) Credits link & homepage credits link — short text-button hit areas
- **Files / lines:** `src/components/CreditsScreen.css:101-110` (`.credits-link`, `font-size: 16px`, no padding → ~20px tall; drops to 14px at `:127`) and `src/components/Homepage.css:360-374` (`.homepage-credits-link`, `font-size: 10px; padding: 0 18px 16px` → ~26px tall hit area).
- **Problem on mobile:** Both act as buttons/links but have hit areas well under 44px tall. Secondary navigation, hence low severity.
- **Fix:** Give each `min-height: 44px; display: inline-flex; align-items: center;` (or add vertical padding) so the tap area reaches 44px.

### Touch targets verified OK (no action)
- `.game-leave-btn` / `.game-mute-btn`: tiny at base (9–13px font, 5px padding) but get `min-height: 40px`/`44px` at `GameScreen.css:2214-2216`. 40px is marginally under 44 but acceptable for a secondary header control.
- `.spectator-react-btn`: `width: 44px; height: 44px` (`GameScreen.css:2451-2453`) — exactly compliant.
- `.game-send-btn` / `.game-skip-btn` / `.game-over-rematch` / `.game-over-leave`: `min-height: 44px` on phones (`GameScreen.css:2210-2214`); at ≤420px send/skip stack full-width with 11px vertical padding (`2240-2248`).
- Homepage/Lobby/Room primary buttons: all get `min-height: 44px` on phones.

---

## INPUT FONT-SIZE ISSUES
**None.** All text-entry fields are ≥ 16px at their clamp floor, so iOS will not auto-zoom:
- `.lobby-input` — `font-size: clamp(16px, 1.5vw, 20px)` (`LobbyScreen.css:80`) — floor 16px. OK.
- `.lobby-code-input` — `font-size: clamp(22px, 3vw, 30px)` (`LobbyScreen.css:112`) — floor 22px. OK.
- `.game-input` — `font-size: clamp(16px, 1.5vw, 20px)` (`GameScreen.css:1034`) — floor 16px. OK. (Shared by Word Bomb, Category Blitz, and Imposter Word inputs.)

No `<textarea>` exists in the project.

---

## FIXED-WIDTH / OVERFLOW ISSUES
**No real issues.** Several large fixed pixel sizes exist but are all decorative and clipped:

- **Global guard:** `index.css:16` sets `overflow-x: hidden` on `html, body`, and `index.css:81-85` wraps the app in `.app-viewport { position: fixed; inset: 0; overflow: hidden; }` with the scroll container nested inside (`.app-scroll`, `overflow-x: hidden`). Anything wider than the viewport is clipped, not scrolled.
- `Homepage.css:269` `.homepage-speedlines span { width: 1400px; }` — purely decorative radial lines behind content, `pointer-events: none`, clipped by the guard above. OK.
- `GameScreen.css:1334-1337` `.go-win-burst { width: 560px; … max-width: 130vw; max-height: 130vh; }` — capped to viewport. OK. Likewise the bomb fuse/burst circles (`1412-1413` 540px, `2654-2655` 360px, `1334` 560px) are decorative and either capped or clipped.
- `TransitionIntro.css:125-126` (440px) and `2654` etc. — overlay decor, clipped; also shrunk at `@media (max-width: 600px)`.
- Content containers correctly use responsive caps: `.room-box max-width: clamp(380px, 50vw, 600px)` with `width: 100%` (`RoomScreen.css:22-24`); `.game-over-card`, `.homepage-btn`, `.game-input` all pair a fixed/`max-width` with `width: 100%` or `max-width: 100%`-equivalent behavior. Cards grid collapses to one column below 760px (`Homepage.css:478-482`).
- `white-space: nowrap` — not used on any long user-content text; long names/categories use `word-break: break-word` (e.g. `iw-vote-name`, `iw-reveal-cat-value`, `game-player-name`). OK.

---

## Most-severe takeaways (top 5)
1. `.iw-vote-btn` (`ImposterWord.css:185`) — Imposter Word's main voting button is ~33px tall with no min-height; the only PRIMARY game action missing a 44px target. Fix: `min-height: 44px`.
2. Room `.room-gametype-btn` / `.room-difficulty-btn` (`RoomScreen.css:117`, `:151`) — ~38–40px selector buttons skipped by the phone min-height rule. Fix: add them to the 600px media block at 44px.
3. `.cb-reroll-btn` (`GameScreen.css:3096`) — ~38px reroll button, no min-height. Fix: `min-height: 44px`.
4. Credits links (`CreditsScreen.css:101`, `Homepage.css:360`) — text links with <44px hit area; add vertical padding / `min-height`.
5. Everything else is compliant: viewport meta correct, all inputs ≥16px (no iOS zoom), no horizontal-scroll risk (global `overflow-x: hidden` + fixed clip box). No critical issues found.
