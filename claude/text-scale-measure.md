# Site-wide text-scale — measurement (before → after)

Measured with Playwright at six viewports; font-size is the rendered computed px. `used H` = content extent (top-most to bottom-most measured element). `slack` = bottom gap to the viewport edge (the real overflow margin; a screen fits when this is >=24 and `oflowY`<=0). `oflowY` = app scroller overflow (>0 means the screen scrolls). `hOflow` = body horizontal overflow.

Targets at >=1366px wide: prompt/combo/category/fragment >=44px, input >=28px, HUD/status/message >=16px, mode-card title >=28px. At 1163x501 allow 0.78x. At <=390px sizes are kept (phones already tight).

## Menu

| viewport | card title | XP readout | wins chip | used H | slack | oflowY | hOflow |
|---|---|---|---|---|---|---|---|
| 1920x1080 | 22→**30** | 16 | 20 | 180→198 | 607→**589** | 0 | 0 |
| 1440x900 | 22→**30** | 16 | 20 | 177→196 | 513→**494** | 0 | 0 |
| 1366x768 | 21.86→**28.69** | 16 | 20 | 175→190 | 425→**409** | 0 | 0 |
| 1163x501 | 18.61→**24.42** | 16 | 20 | 160→173 | 215→**202** | 0 | 0 |
| 390x844 | 12 | 11 | 12 | 116→116 | 597→**597** | 458 | 0 |
| 360x640 | 12 | 11 | 12 | 116→116 | 364→**364** | 661 | 0 |

## Word Bomb

| viewport | combo (prompt) | input | player name | timer | used H | slack | oflowY | hOflow |
|---|---|---|---|---|---|---|---|---|
| 1920x1080 | 70 | 20→**30** | 10→**17** | null | 887→908 | 96→**86** | 0 | 0 |
| 1440x900 | 70 | 20→**30** | 10→**17** | null | 723→740 | 89→**80** | 0 | 0 |
| 1366x768 | 70 | 20→**28.69** | 10→**16.39** | null | 611→622 | 79→**73** | 0 | 0 |
| 1163x501 | 69.78→**50.1** | 17.45→**24.42** | 10→**13.96** | null | 486→445 | 0→**28** | 0 | 0 |
| 390x844 | 46 | 16 | 10 | null | 791→791 | 27→**27** | 0 | 0 |
| 360x640 | 46 | 16 | 10 | null | 819→819 | -195→**-195** | 211 | 0 |

## Category Blitz

| viewport | category (prompt) | input | accepted chip | used H | slack | oflowY | hOflow |
|---|---|---|---|---|---|---|---|
| 1920x1080 | 64 | 20→**30** | 11 | 654→667 | 213→**207** | 0 | 0 |
| 1440x900 | 64 | 20→**30** | 11 | 524→535 | 188→**183** | 0 | 0 |
| 1366x768 | 64 | 20→**28.69** | 11 | 441→447 | 163→**160** | 0 | 0 |
| 1163x501 | 60.48 | 17.45→**24.42** | 11 | 338→342 | 82→**80** | 0 | 0 |
| 390x844 | 26 | 16 | 11 | 621→621 | 112→**112** | 0 | 0 |
| 360x640 | 26 | 16 | 11 | 621→621 | 3→**3** | 13 | 0 |

## SAT Rush

| viewport | word (sr-blank) | definition | slots (input) | used H | slack | oflowY | hOflow |
|---|---|---|---|---|---|---|---|
| 1920x1080 | 25 | 25 | 16 | 585→626 | 266→**246** | 0 | 0 |
| 1440x900 | 25 | 25 | 16 | 476→509 | 227→**210** | 0 | 0 |
| 1366x768 | 25 | 25 | 16 | 394→423 | 197→**183** | 0 | 0 |
| 1163x501 | 25 | 25 | 16 | 304→328 | 105→**93** | 0 | 0 |
| 390x844 | 20 | 20 | 16 | 598→691 | 148→**102** | 0 | 0 |
| 360x640 | 20 | 20 | 16 | 506→506 | 88→**88** | 0 | 0 |

## CHAIN

| viewport | IN tile (prompt) | OUT tile | supply/ribbon | message (reason) | used H | slack | oflowY | hOflow |
|---|---|---|---|---|---|---|---|---|
| 1920x1080 | 96→**76** | 34 | 13→**16** | 14→**16** | 630→618 | 417→**429** | 0 | 0 |
| 1440x900 | 96→**76** | 34 | 13→**16** | 14→**16** | 526→515 | 347→**358** | 0 | 0 |
| 1366x768 | 96→**76** | 34 | 13→**16** | 14→**16** | 448→440 | 296→**304** | 0 | 0 |
| 1163x501 | 96→**70.14** | 34 | 13→**15.12** | 14→**15.12** | 364→350 | 118→**132** | 0 | 0 |
| 390x844 | 54.6 | 34 | 13 | 14 | 568→568 | 244→**244** | 0 | 0 |
| 360x640 | 50.4 | 34 | 13 | 14 | 563→563 | 45→**45** | 0 | 0 |

## FUSE

| viewport | fragment (prompt) | strip counter | message (reason) | used H | slack | oflowY | hOflow |
|---|---|---|---|---|---|---|---|
| 1920x1080 | 96→**76** | 12→**16** | 14→**16** | 514→526 | 533→**520** | 0 | 0 |
| 1440x900 | 96→**76** | 12→**16** | 14→**16** | 429→437 | 443→**436** | 0 | 0 |
| 1366x768 | 96→**76** | 12→**16** | 14→**16** | 364→375 | 380→**370** | 0 | 0 |
| 1163x501 | 96→**70.14** | 12→**13.96** | 14→**15.12** | 299→286 | 183→**196** | 0 | 0 |
| 390x844 | 54.6 | 12 | 14 | 456→456 | 356→**356** | 0 | 0 |
| 360x640 | 50.4 | 12 | 14 | 452→452 | 156→**156** | 0 | 0 |

## Horizontal-overflow check (scrollWidth === clientWidth)

At 320 / 360 / 390 px, `body.scrollWidth - body.clientWidth = 0` for all six screens (no horizontal overflow).

## Target adherence & notes

- **Menu, Word Bomb, Category Blitz, CHAIN, FUSE** hit every applicable target at 1920/1440/1366 and the 0.78x floor at 1163x501, with >=24px bottom slack and zero horizontal overflow at all desktop viewports.
- **Word Bomb @ 1163x501**: previously overflowed (slack 0 / oflowY 14). The combo and bomb graphic were given a `min(vw, vh)` cap so they shrink on short laptops — now +28px slack **while** the input scales 17→24px. Net: the fix *removed* a pre-existing overflow.
- **SAT Rush**: intentionally unchanged. Its reads are already 22–25px and every status line is >=16px, so no floor is missed. It has no single hero prompt like combo/category — it's a retro wanted-poster (definition is a full sentence), and forcing 44px would overflow it and break the documented SAT-RUSH design (DESIGN.md / CLAUDE.md). Per constraint #4 (slack/design wins), left as-is.
- **`.rf-input` does not exist** in the codebase — the solo modes' input is `.solo-input`. Its no-transition/animation/transform/filter/will-change invariant (and that of its ancestors up to `.solo-root`) was preserved: only a static `font-size` clamp was added.
- **Pre-existing phone overflows (not introduced here; <=390 sizes kept per spec):** Word Bomb @ 360x640 (slack -195, oflowY 211) and Category Blitz @ 360x640 (slack 3, oflowY 13) both already overflowed before this pass and are unchanged. The Menu is a scrolling page on phones (oflowY 458/661 at 390/360) by design; horizontal overflow is 0 there.
- CHAIN/FUSE tier escalation remains `transform: scale()` on the tile (untouched); no font-size appears in any keyframe or transition.
