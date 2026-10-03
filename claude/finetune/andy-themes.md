# Andy's recurring notes — ranked, and what each pass fixed (step A, Andy oct2 22:20)

Source: every Andy note in claude/andy-notes-oct2.md + claude/QUEUE-specs.md (claude/andy-playtest-notes.md
does not exist yet). Mentions counted by keyword family (case-insensitive lines), then matched to Andy's list.

| rank | theme | mentions | how it shows up |
|---|---|---|---|
| 1 | growing, satisfying feel (juice / addiction / stimulation) | 23 | "more addiction when progression happens", V loop, the worlds miss |
| 2 | mechanics must be OBVIOUS / make sense | 15 | FRENZY copy, "LEVELS GOT HARDER" notice, marks purpose |
| 3 | text / proportions too small, hero size | 13 | E5, N3 hero icon, "fewer words, bigger type" |
| 4 | no caps on any number | 13 | NC, formatNum to 1e300, PV10 overflow |
| 5 | update a change EVERYWHERE | 10 | copy = code (B loop), receipts/cards/dialogs |
| 6 | crowding AND empty space | 9 | U, one big thing per screen |
| 7 | notification dots only when actionable | 8 | A5 shop dot |
| — | rewards claimed not auto | (in the "claim" family; E4 moved non-achievements to silent pay) | |

## Pass 1 (Oct 3 01:40 ET) — worst offender vs the top 5
- **Phone menu: the claim popup covered the title row** (the wordmark and the new #rank board icon) whenever
  a reward was pending — crowding + "one big thing" (the menu's identity row) + obviousness (the icon Andy
  just asked for was hidden). Tried: on phones the popup rode just above the CREDITS / JOIN ROOM foot row —
  but its CLAIM / LATER buttons then sat on the CHAIN|FUSE band and stole the taps (CI red on #151), so it
  is REVERTED. Next pass: an inline banner in the phone menu's flow (no fixed overlay), above the modes.
- Also tonight against these themes: U parts 1–2 (#151: marks as one tag, shop/breakdown/ladder/backup
  copy trimmed), N4 wall moment (#150: theme 1 — the world visibly changes), N3 hero board icon (#150:
  theme 3), G1 (#150: no broken screen after a deploy — theme 2).

Next pass candidates: the 1163x501 six-card menu (cards 166px — theme 3), the in-game HUD stack on
1280x551 with a live BOOST + FRENZY, the Stats page density.
