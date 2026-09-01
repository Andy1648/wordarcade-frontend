# JOB 10 — the splash, redesigned (fix/splash off main)

The first thing anyone sees. Before: the wordmark + tagline + "TYPE TO START" + pips on the
graffiti wall, with a HUGE dim-yellow starburst at 0.12 opacity that read as a murky brown blob
behind the text, and no hero image (the `.splash-hero-mascot` CSS existed but nothing rendered it).
Shots: `claude/splash/shots/{before,after}/`.

## Fixes (BE-PICKY)
- **Restored the bomb mascot as the hero.** The splash had lost its centrepiece image; now the
  angry lit-fuse bomb stands on the burst under the wordmark. Pose only (no looping emote) — the
  enter pop is a one-shot, so no idle animation is added.
- **Crisped the murky burst.** 0.12 → 0.62 opacity, a black comic outline (`stroke #000`), slightly
  larger — it now reads as a real yellow FNF starburst framing the wordmark, not a brown wash.
- **Darkened the wall veil** (centre 0.34 → 0.52, edge 0.74 → 0.88) so the wordmark + burst + mascot
  pop and the competing graffiti recedes.

## Result
A comic hero screen — bright starburst, bomb mascot, the RGB-split "TYPE A WORD" wordmark popping on
top, then the tagline / TYPE TO START / pips. Fits desktop (1920/1366) and mobile (390, wordmark
wraps to two lines as designed) with no clipping.
