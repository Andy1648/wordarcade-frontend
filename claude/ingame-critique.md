# JOB 6 — The in-game screens against BE-PICKY

**Branch:** `chore/ingame-critique`. REPORT ONLY. All five modes captured **mid-play**
(and game-over), the surfaces nobody had looked at. Via the e2e mock, real motion so the
3-2-1 turn-start countdown clears before the frame. Shots in `claude/ingame-critique/shots/`.
Harness: `claude/_tools/cap-ingame.mjs` + `sat-play.mjs` (SAT's exact card→Play→BRIEFING→
Start-the-run flow from `sat-rush.spec`).

---

## MID-PLAY

### WORD BOMB — POLISH
- Shot: `shots/wb-play-desktop.png`
- Reads in order: 1) the giant yellow combo **"STR"**  2) the bomb mascot with its live timer
  (22)  3) the input + SEND/SKIP. Player bars (YOU orange / RIVAL) up top, used-words chips.
- Well composed — clear focal, the mascot carries the clock, the SKIP "-1 LIFE" cost is honest.
- Nits (POLISH): dead purple space flanks the bomb left+right between the player bars and the
  combo box; the SKIP button's tiny "-1 LIFE" is easy to miss. #1 (minor).
- **Stranger:** "clear what to do — type a word with STR before the bomb blows."

### CATEGORY BLITZ — POLISH
- Shot: `shots/blitz-play-desktop.png`
- Reads: 1) the big yellow category **"CRYPTIDS & FOLKLORE MONSTERS"**  2) the timer bar  3) the
  input, with a right rail (YOUR ANSWERS / OTHER PLAYERS, ROUND 1/3). Best-composed play screen.
- Nit (POLISH): the mascot top-right is tiny and tucked; the right rail is a touch empty with one
  answer. Good otherwise.
- **Stranger:** "name monsters, race the bar — got it."

### CHAIN — LOOKS UNFINISHED
- Shots: `shots/chain-play-desktop.png`, `shots/chain-play-mobile.png`
- Everything (score row, timer ring, target letter, one tile, input) clusters in the **top ~45%**;
  the **bottom ~50% is empty** dark purple, desktop AND mobile. Largest empty rectangle by eye
  ≳35% — the screen doesn't fill.
- Failures: #1 (huge empty region), #2 (weak hierarchy — the target letter "T"/tile "E"/input "E"
  read ambiguously). The neon multiplayer screens fill the viewport; this one is a small island.
- **Stranger:** "the game's crammed in the top and the bottom half is just… empty."

### FUSE — LOOKS UNFINISHED
- Shot: `shots/fuse-play-desktop.png`
- Same as CHAIN: timer ring + fragment ("IG") + a-z used-letter strip + input in the top ~40%,
  then a **large empty lower half**. The a-z strip is a nice touch but the screen is mostly void.
- Failures: #1. Sibling of the CHAIN finding.
- **Stranger:** "lots of empty space under the word."

### SAT RUSH — POLISH / LOOKS UNFINISHED (the card is great; the surround isn't)
- Shots: `shots/sat-play-desktop.png` (wanted-poster), `shots/sat-brief-desktop.png` (briefing)
- The **wanted-poster WordCard** is the strongest single in-game artifact — WANTED masthead,
  ADJECTIVE·7 LETTERS·TIER 3, LAST SEEN clue, letter slots, REWARD 5× + ANTE. Exactly the
  DESIGN.md retro-print spec, and it fills its own bounds.
- BUT the card floats in a **large raw-black void** (~20% margin top/bottom, ~22% each side). Where
  WB/BLITZ fill the viewport, SAT is a fixed poster on black — the surround reads as dead space, not
  "a page on a desk". Failures: #1 (surround), plus the "PICK YOUR BEAT" select + cover card have the
  same black-void problem (Job 4 hand-off).
- **Stranger:** "cool wanted poster — sitting in a big black nothing."

### Cross-cutting (all in-game)
- The first-run **"3 WORDS TO EARN"** chip + the **"×1.0 / 0 WPM"** chips float top-right in the
  void, orphaned from any cluster (BE-PICKY #14), and **crowd the score row on mobile**
  (`shots/chain-play-mobile.png`).

---

## GAME-OVER

- **CATEGORY BLITZ** (`shots/blitz-gameover-desktop.png`) — **POLISH**, the model: mascot, "YOU WIN!
  +100 WINS", clean scoreboard, REMATCH/LEAVE. Every game-over should match this.
- **WORD BOMB** — **VERIFY.** In capture a turn-start **"GO!" splash froze over the win panel**
  under reduced-motion; the panel behind matches BLITZ's quality. Confirm in real play the GO! splash
  always clears before / never co-renders with the game-over overlay (Job 4).
- **CHAIN / FUSE death** — **LOOKS UNFINISHED**: same big empty lower half as their play screens
  (Job 4). FUSE's dead "PLAY AGAIN" button was **fixed in Job 5** (`shots/fuse-death-after.png`).
- **SAT results** (`.sr-respage`, the negative-reprint "CASE CLOSED") — not captured in this
  time-box; per DESIGN.md + `sat-rush.spec` it exists and is exercised. Flagged for a targeted grab.

---

## The one in-game change with the most leverage
**Fill the lower half of the two solo play screens (CHAIN/FUSE), and frame SAT's poster.** The
multiplayer screens (WB/BLITZ) already fill the viewport; the solo modes are small clusters in a
void. Give CHAIN/FUSE's empty lower half real content — a recent-words ribbon, a combo/heat meter,
or the mascot reacting — and put SAT's wanted-poster on the retro-print "desk" texture instead of
raw black. That single move brings the solo screens up to the density the neon screens already have,
and it's where players actually spend their time.
