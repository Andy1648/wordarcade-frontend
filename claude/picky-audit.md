# JOB 4 — Every screen against BE-PICKY

**Branch:** `chore/picky-audit`. REPORT ONLY. Every screen/dialog/overlay/game-over
reached via the e2e backend mock and screenshot at **desktop 1440×900 + mobile 390×844**
(short-height clipping cross-referenced from Job 3's 1568×675). Shots in
`claude/picky-audit/shots/`. Harness: `claude/_tools/cap-screens.mjs`.

18 surfaces captured (SAT deep screens deferred to Job 6). Ranked BROKEN → LOOKS
UNFINISHED → POLISH, most severe first.

---

## BROKEN

### CATEGORY BLITZ — pack chips wrap mid-word (desktop) — BROKEN
- Shot: `shots/blitz-dialog-packpicker-desktop.png` (vs clean `...-mobile.png`)
- The 3-column pack grid makes each chip too narrow for its label + count badge, so the
  names **break mid-word**: "MOVIE / S", "GAMIN / G", "ANIMA / LS", "SPORT / S".
- Failures: #6 (mid-word break, orphan letters), #13 (content doesn't fit its box).
- Desktop-only — on mobile the chips are full-width rows and read perfectly.
- **Stranger:** "why is it MOVIE-S and GAMIN-G? looks half-built."

### Mode cards — SOLO/MULTI badge clips off the card bottom at short height — BROKEN
- Shot: Job 3 `menu-critique/shots/menu-1568x675.png`
- At ≤~700px viewport height the featured cards are too short for their content and the
  bottom `SOLO/MULTI` badge is **cut off by the card edge**.
- Failures: #13 (clipped content). Common laptop height — real, reachable.
- **Stranger:** "the badge is sliced in half."

### FUSE death — "PLAY AGAIN" reads as a dead/disabled button — BROKEN(-adjacent)
- Shot: `shots/fuse-death-desktop.png` (vs `shots/chain-death-desktop.png`)
- FUSE's primary CTA renders as a **dark, low-contrast bar** that reads disabled, while
  CHAIN's identical "PLAY AGAIN" is bright cyan. Same 300ms settle → not a timing fluke.
- Failures: #11 (primary action looks dead), #12 (contrast).
- **Stranger:** "is the restart button greyed out? did I break it?"

---

## LOOKS UNFINISHED

### STATS — new-player empty state is a skeleton — LOOKS UNFINISHED
- Shots: `shots/stats-desktop.png`, `shots/stats-mobile.png`
- Largest empty rectangle: n/a (full of placeholder bars). Nearly every record is an empty
  grey bar with a hint ("ACCEPT A WORD", "CHAIN 2 WORDS"…). For a new player the whole
  panel reads like a **loading skeleton**, not a designed empty state.
- Failures: #11 (empty state reads unfinished).
- **Stranger:** "did this not finish loading?"

### ACHIEVEMENTS — a wall of grey under-styled locked cards — LOOKS UNFINISHED
- Shot: `shots/achievements-desktop.png`
- All 32 unearned cards are flat dark panels with thin borders and greyed text — **no thick
  coloured outline, no hard offset shadow** (the house signature). 5 cards in a 2-col group
  leave an empty cell (#4 template asymmetry).
- Failures: #9, #10, #11, #4.
- **Stranger:** "grey box, grey box, grey box."

### SHOP — theme cards under-styled; affordable items look dead — LOOKS UNFINISHED
- Shots: `shots/shop-desktop.png`, `shots/shop-mobile.png`
- The theme product cards are dark flat panels (no thick outline / hard shadow); unowned
  themes are greyed to the point of reading **disabled** rather than "buyable". The KEY POWER
  box is cramped against the BACK button at the bottom.
- Failures: #9, #10, #11.
- **Stranger:** "a muted store — nothing feels clickable."

### CHAIN / FUSE death cards — big empty lower half — LOOKS UNFINISHED
- Shots: `shots/chain-death-desktop.png`, `shots/fuse-death-desktop.png`
- The death card floats high-centre; the **bottom ~40% of the screen is dead black**. The
  card doesn't own the frame.
- Failures: #1 (large empty region).
- **Stranger:** "the important bit is squished into the top; the rest is empty."

### ROOMS BROWSER — empty "scanning" state — LOOKS UNFINISHED
- Shot: `shots/rooms-browser-desktop.png`
- With no public games, the panel's lower half is a big void under "SCANNING FOR GAMES…".
- Failures: #1, #11.
- **Stranger:** "there's a big empty hole where the games should be."

---

## POLISH (clears the bar; noted)

- **COLLECTION** (`shots/collection-desktop.png`) — the strongest overlay: BY-TIER chips carry
  real coloured outlines, milestones are a clean list. Only nit: the top "0 DISTINCT WORDS"
  band is airy. Keep as the model the other overlays should match.
- **WORD BOMB dialog** (`shots/wb-dialog-desktop.png`) — clean, house-styled. Good.
- **CHAIN/FUSE locked preview** (`shots/chain-locked-desktop.png`) — clean. But its backdrop is
  **not blurred** while the mode dialogs **are** — pick one. (And the house rule is "no blur",
  so the mode-dialog backdrop-blur is itself a flat-rule exception worth a decision.) #8.
- **LOBBY / ROOM** (`shots/lobby-desktop.png`, `shots/room-waiting-desktop.png`) — well composed;
  ROOM even uses the mascot. Good.
- **CATEGORY BLITZ game-over** (`shots/blitz-gameover-desktop.png`) — the game-over template done
  right: mascot, "YOU WIN! +100 WINS", clean scoreboard, REMATCH/LEAVE. This is the bar.
- **BLITZ dialog mobile** — "PICK YOUR PACK[S]" heading crowds the CLEAR button. Minor.
- **WORD BOMB game-over** (`shots/wb-gameover-settled-desktop.png`) — could NOT be captured clean:
  a turn-start **"GO!" splash stays frozen over it under reduced-motion** (a harness artifact of
  the mock's turn_update→game_over ordering). The panel behind matches BLITZ's quality. VERIFY in
  real play that the GO! splash always clears before / never co-renders with the game-over overlay.
  Per-player stat cells showed 0/— because the mock supplied no word stats (harness limitation).

---

## Tally for Job 5
BROKEN (fix first): (1) Blitz pack-name wrap · (2) card badge clip at short height · (3) FUSE
PLAY-AGAIN dead button. LOOKS UNFINISHED: (4) STATS skeleton empty-state · (5) ACHIEVEMENTS grey
wall · (6) SHOP under-styled/greyed cards · (7) CHAIN/FUSE death empty lower half · (8) rooms
browser empty state. Most are Tier-2/3 (component + CSS); none require touching App.jsx WS/state.
