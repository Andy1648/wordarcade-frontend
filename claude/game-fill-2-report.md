# JOB 2 — WORD BOMB / BLITZ / SAT fill the viewport (feat/game-fill-2, TIER-1, BRANCH ONLY)

The solo fill fix (fix/game-fill) left WB/BLITZ/SAT still on the `.view-screen` `--app-scale`
zoom, so they rendered as narrow centred cards. Removing that zoom naively overflowed them
(131–145% height at 551px). This branch does the per-screen height-fit so each fills width AND
fits height without the zoom — the same idea as solo's landscape, adapted per screen. **Branch
only; not merged (Tier-1 live multiplayer needs the 2-device REGRESSION CHECKLIST first).**

## Width fill — `.game-stage` (WB/BLITZ) / `.sr-app` board (SAT), before → after

| viewport   | WORD BOMB | CATEGORY BLITZ | SAT (board) |
|------------|-----------|----------------|-------------|
| **BEFORE** | 57–76%    | 57–76%         | poster 39–51% |
| 1920×1080  | 75.7 → **90.9%** | 75.7 → **90.9%** | **100%** (poster 49%) |
| 1568×675   | 57.9 → **90.1%** | 57.9 → **90.1%** | **100%** (poster 59%) |
| 1366×768   | 70.1 → **89.8%** | 70.1 → **89.8%** | **100%** (poster 68%) |
| 1280×551   | 57.0 → **89.7%** | 57.0 → **89.7%** | **100%** (poster 73%) |
| 390×844    | → **88.2%**      | → **88.2%**      | **100%** (poster 95%) |

No vertical overflow, no ancestor zoom, at any of the five. (WB/BLITZ height fill is 58–95% —
their content is genuinely short at tall viewports; the stage centres on the WallScene backdrop,
which is intentional art, not flat void.) Shots: `claude/ingame-pass/shots/jf2-after/`.

## How

- **App.jsx** — `view === 'game'` and `SAT_RUSH_VIEW` join the zoom-exempt list (with the solo
  views), so their stages carry no ancestor zoom. `.game-wrap` min-height is now a plain `100dvh`.
- **WORD BOMB** (`.game-stage--wb`) — a CSS-**grid reflow** on SHORT windows
  (`min-width:900 and max-height:900`): the existing children are placed into grid-areas — the
  bomb in a left column beside the combo/used/input column — so the ~880px vertical stack becomes
  a ~450px two-column layout that fits 551px. Bomb sized by `vh`. Pure CSS on existing DOM; the
  absolute FX (hype/clutch/fly/shatter/explosion) are out of flow and untouched. Tall windows keep
  the single-column stack (which already fits + fills there).
- **CATEGORY BLITZ** (`.game-stage--blitz`) — already two-zone (`.cb-round` main | rail); it just
  needed the zoom off + a short-window cap on the big category hero (sized by `vh`) so it fits
  551px without overflowing.
- **SAT RUSH** — the poster (`.sr-stage`) is a fixed-aspect WANTED-poster artifact on a full-bleed
  board (`.sr-app`), which fills the viewport (the toned screentone desk from the prior pass). The
  board IS the filling surface; the poster is content on it, exactly like the menu cards on the
  menu stage. Forcing the poster to 90% width would overflow its height and break the locked manga
  proportions (CLAUDE.md: don't restyle SAT without an explicit request), so SAT is gated on the
  board. Without the zoom the poster is also now BIGGER at short heights (73–95% vs 44–51%).

## Gate — `e2e/game-fill.spec.js` extended to all five modes
- CHAIN/FUSE `.solo-root` ≥90% both axes + no ancestor zoom + no element past bounds.
- FUSE strip: 26 visible tiles, none past the container.
- WB/BLITZ `.game-stage` ≥85% width + no page vertical overflow + stage within viewport height +
  no ancestor zoom, at all five viewports.
- SAT `.sr-app` board ≥90% both axes + no ancestor zoom.
- **31/31 pass.** WB/BLITZ viewport-integrity 140/140 (reflow causes no overflow/clipping at any
  theme×viewport).

## Not done / honest limits
- WB/BLITZ **height** fill is 58–95% (short content at tall viewports). Filling the height would
  need more content or a different composition; out of scope for a fill pass. No overflow anywhere.
- The SAT poster itself is not width-filled (aspect + locked style). A landscape poster (clue |
  slots) would fill it but is a WordCard redesign requiring an explicit SAT restyle sign-off.
