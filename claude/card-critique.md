# JOB 1 — Card-direction audit against BE-PICKY

**Target:** `proto-cards-2.html` (branch `chore/card-critique`, off `proto/cards-2`).
**Method:** Playwright + Chromium against `vite preview` at 1920 / 1366 / 390. The
largest-empty-rectangle is **measured by pixel analysis** (flat field colour = empty,
any other pixel = ink), not eyeballed — routine in `claude/_tools/shot.mjs`, raw
numbers in `shots/empty-rect.json`. Screenshots in `claude/card-critique/shots/`.

REPORT ONLY. Nothing shipped.

---

## Scoreboard — largest empty rectangle (% of card area)

| Direction | word-bomb | blitz | sat-rush | chain (lk) | fuse (lk) | worst |
|---|---|---|---|---|---|---|
| **ART-LED** @1920 | 9.3 | 5.3 | 4.7 | 7.6 | 8.6 | **9.3** |
| **POSTER** @1920 | 1.2 | 2.2 | 1.6 | 2.0 | 1.6 | **2.2** |
| **CABINET** @1920 | 1.6 | 1.6 | 1.6 | 8.5 | 8.5 | **8.5** |
| **DATA** @1920 | 1.8 | 2.8 | **20** | **32** | **32** | **32** |
| ART-LED @390 | 10.5 | 4.7 | 4.1 | 7.4 | 7.5 | 10.5 |
| POSTER @390 | 1.6 | 1.1 | 1.7 | 1.1 | 1.6 | 1.7 |
| CABINET @390 | 1.2 | 1.2 | 1.1 | 7.7 | 7.7 | 7.7 |
| DATA @390 | 1.9 | 2.8 | 1.9 | **33** | **33** | 33 |

Threshold: <18% clean · 18–30% soft · **>30% FAILS**. Every direction except
DATA-FORWARD clears the fill bar on every mode at every width. **The "all four are
still too empty" worry does not hold** — three of the four are genuinely full; the
problem with the weak ones is composition and state, not emptiness.

The low poster/cabinet numbers are real: big type and full-bleed screens leave no
large void. But a low empty-rectangle is necessary, not sufficient — a card can be
full and still look templated. That's what the qualitative read below catches.

---

### ART-LED — RANK 1 (SHIP THIS)
- Before: `shots/artled-1920.png`, `shots/artled-390.png`, `shots/artled-1366.png`
- Largest empty rectangle: 4.7–10.5% across all modes/widths (worst word-bomb 10.5%).
- Reads in order: 1) the art scene  2) the title on the ink scrim  3) tag + badge.
- Set, not template: **yes.** Each mode is a genuinely different scene (bomb+tiles /
  brain+bolts / manga speed-lines+SAT / chain links / fuse cord), and SAT RUSH's cream
  paper vs the neon fields breaks any templated read. The five could not be produced by
  swapping a hue.
- Locked CHAIN/FUSE: **legible.** Padlock + "UNLOCKS AT LV 20 / YOU'RE LV 14 · 6 TO GO"
  on a dimmed but still-readable scene. Passes check #11.
- Failures: only POLISH — (BE-PICKY #12) the locked title (grey CHAIN/FUSE) is low
  contrast against the dimmed teal/olive; nudge it brighter. word-bomb's 10.5% is the
  one soft spot (a gap top-left above the fuse) — trivially closed in Job 2.
- **Stranger, first second:** "those are five different little worlds, and one of them
  is a manga."

### ARCADE CABINET — RANK 2
- Before: `shots/cab-1920.png`, `shots/cab-390.png`
- Largest empty rectangle: 1.1–1.6% (unlocked), 7.7–8.5% (locked). All clean.
- Reads in order: 1) the lit marquee name  2) the CRT screen  3) the joystick/badge panel.
- Set, not template: **yes** — and the strongest "these belong together" read of the
  four, because the cabinet frame is shared identity while each screen differs. Reads as
  a row of machines in an arcade.
- Locked CHAIN/FUSE: **legible** — grayscale cabinet + lock overlay; clearly "switched
  off machine." Passes #11.
- Failures: LOOKS-UNFINISHED-adjacent — (#1/#3) the CRT screen is ~square so the
  portrait-authored art is centre-cropped (WORD BOMB's fuse tip clips at top); the outer
  bezel is flat dark-purple doing little (#8/#9 — no cabinet side-art, speaker grille, or
  coin door to earn that frame). Fixable, but it's more chrome to maintain than art-led.
- **Stranger, first second:** "a wall of arcade cabinets — cute, but the screens are
  cropping the pictures."

### POSTER — RANK 3
- Before: `shots/poster-1920.png`, `shots/poster-390.png`
- Largest empty rectangle: 0.8–2.2% — the big type fills the body.
- Reads in order: 1) the giant word  2) the badge  3) the tiny art chip (barely).
- Set, not template: **borderline template.** Strip the art chip and all five are "one
  huge word on a flat colour" — the exact swapped-hue pattern BE-PICKY #4 warns about.
  The authored art is demoted to a 38%-width corner chip doing almost no work (#3).
- Locked CHAIN/FUSE: legible but the padlock overlaps the wordmark's letters, and the
  greyed title is low-contrast (#12).
- Failures (real): **(#6) BROKEN wrap** — "CATEGORY BLITZ" breaks mid-word to
  "CATEGOR / Y BLITZ"; an orphaned "Y" is a hard fail. (#3) art wasted. (#2) with type
  this dominant there's almost no second read.
- **Stranger, first second:** "loud — but why did 'CATEGORY' break in half?"

### DATA-FORWARD — RANK 4
- Before: `shots/data-1920.png`, `shots/data-390.png`
- Largest empty rectangle: **20% (sat-rush) / 32–33% (chain, fuse) — FAILS on locked**;
  1.8–2.8% on the three unlocked. Also a 20.5% spike on word-bomb @1366 (the 3-col
  reflow opens a gap under the stat grid).
- Reads in order: 1) the big cyan number  2) the mode name  3) the mastery bar.
- Set, not template: the unlocked cards read as a set of stat-lines; fine.
- Locked CHAIN/FUSE: **weakest state of any direction** — a mostly-empty dark card with
  blurred nothing behind a lock. This is the FAIL: a brand-new player (everything low or
  locked) meets the emptiest possible version of this card. Concept ("changes as you
  play") is good, but it's the wrong bet for a *front-door* card and reads more like a
  Stats-screen module than a menu tile. (#1, #11)
- **Stranger, first second:** "some stats… and two grey empty boxes with locks."

---

## Ranking + recommendation

1. **ART-LED — ship it.** Fullest and most distinctive as a *set*, the art finally does
   the selling (the whole point of the redesign), it scales cleanly to 390, and the
   locked state stays legible. Only polish-level nits. This is the direction to push in
   Job 2.
2. **ARCADE CABINET** — the best "these belong together" read and loads of personality;
   keep it as the strong alternative (or as the eventual *mode-detail* page). Costs more
   chrome and crops the portrait art.
3. **POSTER** — bold but risks templating and wastes the authored art; has an actual
   broken word-wrap. Would need the art promoted back to a real role to compete.
4. **DATA-FORWARD** — best idea for an *engaged* player, worst first impression; the
   locked/new-player state fails the fill bar. Better repurposed as a Stats module than
   a menu card.

**Harsh verdict:** not "all four too empty" — three are full. The honest problem is that
only **two** (art-led, cabinet) read as a *designed set* rather than a layout with the
art or the numbers swapped in. Art-led is the one that's full **and** composed per-mode
**and** survives the locked/new-player case. Push it in Job 2.
