# JOB 10 — Sweep 6: the last visual sweep

Report only. No product code changed. Screens captured at **1920×1080** and **390×844**
from each screen's real source branch (built + previewed on :4173 in turn). Largest-empty-
rectangle measured over the full viewport screenshot (the screen's container) via the
histogram method in `_cap6.mjs`; ink = any pixel > channel-distance 42 from the median
border-ring field colour. Screenshots: `claude/sweep-6-shots/<branch>/<screen>-<size>.png`.

Method note that colours the whole read: the empty-rect is measured over the **full 1920-wide
viewport**, so any screen that is a single centred panel scores a high number from its left/right
gutters. That is not a measurement artefact to wave away — it *is* the finding. On the
menu-family screens those gutters carry the graffiti-wall backdrop, so they read as intentional
frame. On the in-game / solo / RUN family the gutters are **flat black**, so the identical
centred-panel pattern reads as a hole. Desktop is where this app is weakest; mobile (where the
panel fills the width) is consistently tighter — note how every mobile number is far lower.

---

## Ranked table (screen · source branch · empty-rect% D/M · rank · worst issue)

| Screen | Source branch | Empty% D / M | Rank | Worst issue (one line) |
|---|---|---|---|---|
| menu | main | 16.0 / 18.2 | POLISH | Composed 6-card grid on the graffiti wall — the app's best surface. |
| word-bomb dialog | main | 11.6 / 15.3 | POLISH | Dense mode card; menu behind is blurred (modal scrim vs the no-blur rule). |
| category-blitz dialog | main | 11.6 / 7.3 | POLISH | Same template as WB dialog, hue-swapped — reads as a set, fine. |
| shop | main | 27.2 / 15.6 | POLISH | Theme cards + Key Power are real content; desktop side-gutter void only. |
| stats | main | 38.8 / 14.6 | POLISH | Records grid is dense in-panel; the 38.8% is pure desktop side-gutter. |
| rooms-browser (JOIN) | main | 32.5 / 22.9 | POLISH | "SCANNING FOR GAMES…" leaves an empty list region inside the card. |
| lobby (create room) | main | 33.6 / 19.0 | POLISH | Clean name/visibility card; desktop side-gutter void. |
| wb-gameover | main | 35.4 / 9.8 | POLISH | Tall results card + confetti; all-zero empty-state stats but legible. |
| blitz-gameover | main | 35.0 / 8.8 | POLISH | Same results template; reads finished. |
| sat-play (wanted poster) | main | 26.3 / 3.2 | POLISH | Own retro-print sub-style; superb on mobile, side-gutter void on desktop. |
| sat-brief (the briefing) | main | 33.8 / 4.7 | POLISH | Five study cards, dense; desktop gutters only. |
| sat-modeselect | main | 36.3 / 29.5 | LOOKS UNFINISHED | Two option cards + EXIT float tiny in a huge cream page; lots of dead paper. |
| **chain-play** | main | 30.8 / 19.3 | **LOOKS UNFINISHED** | Dim teal ring + ghost letter on flat black, big dead gap to the input. |
| **fuse-play** | main | 29.0 / 24.4 | **LOOKS UNFINISHED** | Same sparse dark layout; the "BE" fragment art is near-invisible on black. |
| menu (THE RUN card) | feat/run-mode | 29.4 / 15.1 | POLISH | THE RUN card redrawn well; the taller/narrower cards add black gutter top+bottom. |
| run wall-preview | feat/run-mode | 35.6 / 18.9 | LOOKS UNFINISHED | Pre-round panel marooned in flat-black void; no art works the frame. |
| run round | feat/run-mode | 35.6 / 25.3 | LOOKS UNFINISHED | Round panel is a small box in a 35% black void. |
| run draft | feat/run-draft-look | 28.8 / 14.7 | POLISH | Authored-SVG modifier cards are genuinely nice; panel still floats on black. |
| run round (wall meter) | feat/run-wall | 35.6 / 24.8 | LOOKS UNFINISHED | Live meter is good, but the panel is adrift in a flat-black 35.6% void. |
| run CLEAR moment | feat/run-wall | 35.6 / 23.1 | LOOKS UNFINISHED | "CLEARED!" reads well; same surrounding void. |
| run MISS (RUN OVER) | feat/run-wall | 35.6 / 21.6 | LOOKS UNFINISHED | Small RUN OVER card on black; all-zeros miss feels hollow. |
| wb-ingame (esports) | feat/ingame-look | 26.9 / 12.2 | LOOKS UNFINISHED | The two player panels are large EMPTY dark boxes (name + 3 hearts only). |
| blitz-ingame (judge's bench) | feat/ingame-look | 29.0 / 13.8 | POLISH | Well laid out; the RECORD/GALLERY right column is sparse but legible. |

No **BROKEN** surfaces found — nothing clipped, overflowing, colliding or unreadable at either
width. Every defect is a fill/hierarchy problem, not a bug.

---

## BE-PICKY detail on the weak tier

### chain-play — LOOKS UNFINISHED  (main)
- Shot: `claude/sweep-6-shots/main/chain-play-desktop.png`
- Largest empty rectangle: 30.8% (desktop) / 19.3% (mobile)
- Reads in order: 1) yellow "START WITH THE GIVEN LETTER" 2) the input box 3) …the dim ring + giant "S" (should be first, is nearly last)
- Failures: #1 small clusters in a big empty field; #2 no clear hierarchy — the hero art is the lowest-contrast thing on screen; #9/#12 the timer ring and given letter are dark-teal on near-black (fails its own edge/contrast); #16 the resting pose is two islands with a dead void between.
- What a stranger notices in the first second: "half the screen is empty and the big letter is almost invisible."

### fuse-play — LOOKS UNFINISHED  (main)
- Shot: `claude/sweep-6-shots/main/fuse-play-desktop.png`
- Largest empty rectangle: 29.0% / 24.4%
- Reads in order: 1) "SNEAK THE LETTERS INTO A WORD" 2) input 3) dim ring + "BE" fragment + a-z tray
- Failures: identical to chain — dim low-contrast art on flat black, big gap between the left art cluster and the right input, letter tray ghosted almost to invisibility.
- What a stranger notices: "same empty dark screen as CHAIN with a different faint letter."

### run round / wall meter — LOOKS UNFINISHED  (feat/run-wall, feat/run-mode)
- Shots: `claude/sweep-6-shots/run-wall/run-round-desktop.png`, `run-clear-desktop.png`, `run-miss-desktop.png`
- Largest empty rectangle: 35.6% (desktop, every RUN in-round frame)
- Reads in order: 1) the panel 2) …nothing; the other 64% of the screen is flat purple-black.
- Failures: #1/#3 one small panel does all the work while colour (black) does none; #16 the resting composition is a floating box. The meter, CLEAR burst and RUN-OVER stamp themselves are well designed — the problem is entirely the empty stage around them.
- What a stranger notices: "a little card in the middle of a black screen."

### wb-ingame (esports broadcast) — LOOKS UNFINISHED  (feat/ingame-look)
- Shot: `claude/sweep-6-shots/ingame-look/wb-ingame-desktop.png`
- Largest empty rectangle: 26.9% / 12.2%
- Reads in order: 1) STR fragment panel 2) bomb mascot 3) input — the two big left player panels read last because they're near-empty.
- Failures: #1/#11 the YOU and RIVAL panels are large boxes holding only a name + 3 hearts, so the "broadcast" frame is mostly dead space; hierarchy is good but the panels don't earn their size.
- What a stranger notices: "nice bomb, but those two big panels on the left are empty."

---

## The honest product question

### 1. One designed product, or a strong menu attached to weaker screens?

**A strong menu (and menu-family) attached to a visibly weaker in-game / solo / RUN tier — at
desktop width specifically.** It is unmistakably ONE product in vocabulary: every surface uses
the Bungee pink wordmark, flat colours, hard black offset shadows, the bomb mascot, 8px radius,
and the CHAIN/FUSE/RUN screens even share the RUN's neon-purple panel language. Nothing looks
like it came from a different app.

But there are two quality tiers, and the seam is the **background**:

- **Menu family** (menu, shop, stats, dialogs, lobby, rooms, game-over) sits on the decorated
  graffiti wall. Even the surfaces that score 33–39% empty read as *finished*, because the void
  is a deliberately-dressed frame around a dense card.
- **In-game / solo / RUN family** (chain, fuse, the RUN round/wall/clear/miss, WB/Blitz in-play)
  sits on **flat black** with a single centred panel. The exact same centred-panel geometry now
  reads as an unfinished hole. CHAIN/FUSE compound it with dim, low-contrast hero art. SAT RUSH
  is the one in-game surface that escapes this — it commits to its own full-bleed retro-print
  page and is excellent on mobile.

So: a stranger flipping through would say the menu, shop, stats and game-over look shipped, and
the actual *playing* screens look like a prototype dropped onto a black background — which is the
worst possible place for that impression to land.

### 2. Single weakest surface + exactly what it would take to fix it

**Weakest surface: the RUN in-round screen (the wall-meter round + its CLEAR/MISS moments),
`feat/run-wall` — 35.6% desktop void.** It is the headline mode's core loop (RUN is now the
LV8 front door per `runMode/config.js`), and it is the emptiest surface in the app: a small panel
alone in a flat-black 35.6% void, with no art anywhere doing work. The meter/CLEAR/MISS pieces
themselves are well designed — the failure is 100% the stage around them. (CHAIN and FUSE solo
play share this exact defect and are already LIVE on main, so a fix here should be built to lift
all three.)

What it would take — none of it new mechanics, all framing/composition:
1. **Kill the flat-black stage.** Give the in-game/solo/RUN screens the same dressed backdrop the
   menu uses (graffiti wall, or a mode-tinted flat backdrop with real vector art — bricks for the
   wall, a fuse/spark motif), so the panel sits in a composed frame, not a hole. This single
   change moves every 35.6% RUN frame and the 30.8% CHAIN / 29% FUSE frames under the 18% bar.
2. **Constrain and centre the play unit as one composition at desktop.** Right now the panel is
   ~640px marooned in 1920. Either widen the in-round layout to use the width (a left rail: round
   ladder / stack / banked; a right rail: the meter + input) or cap max-width and let the dressed
   backdrop own the rest — not raw black.
3. **For CHAIN/FUSE specifically, fix contrast (#9/#12).** The timer ring and the giant given
   letter/fragment are dark-teal / dark-yellow on near-black and are the lowest-contrast objects
   on their own screen. They should be the first read, at full mode-accent contrast.
4. **Pull the two islands together.** On CHAIN/FUSE the ring+letter cluster and the input sit at
   opposite sides with a dead gap. Group them into one unit so the eye has one place to land.

Do #1 and the whole in-game tier stops reading as a prototype; do #1–#4 and the RUN round becomes
as finished as the draft screen already is.
