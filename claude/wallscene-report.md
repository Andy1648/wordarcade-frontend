# JOB 12 — the backdrop (chore/wallscene, REPORT ONLY)

Does the persistent graffiti WallScene help the menu, or is it noise behind the new poster cards?
Shots: `claude/wallscene/shots/menu-{with,without}-{desktop,mobile}.png` (same menu, `.wall-scene`
toggled off via injected CSS for the "without").

## Verdict: KEEP it — it does NOT fight the cards, but it barely earns its place.

- **It doesn't fight the cards.** The graffiti (WORD / BOOM / EPIC / ZAP / POW / FIRE / NOOB / RIP,
  paint splatters, a drip, faint stars) is rendered at very low opacity in the SAME purple family as
  the background — it reads as faint texture, never as competing shapes. The five vivid poster cards
  (orange/blue/cream/teal/orange) sit clearly on top in both shots. Side-by-side, the cards pop only
  *marginally* more without it.
- **Its only real job is the empty areas.** With the wall off, the large band BETWEEN the XP bar and
  the card row — and the margins beside the cards — go flat dead-purple. The wall gives those a hint
  of arcade texture so the cards don't read as floating on a void. That is genuinely useful, but the
  effect is so faint it under-delivers.

## The real finding (not the wall)
The comparison exposes the menu's actual weakness: a ~150px EMPTY BAND between the XP/level row and
the cards, present with OR without the wall. The wall only whispers into it. That band — not the
backdrop — is what makes the top of the menu feel unfinished.

## Recommendation
1. **Keep the WallScene** (it's atmosphere, not noise). 
2. Consider nudging its opacity up *slightly* in the card-free zones (top band + side margins) so it
   actually reads there and earns its cost — but never behind/over the cards.
3. Separately, tighten the empty band above the cards (pull the card row up, or give the top row a
   real job). That is the higher-leverage menu fix, and it is independent of the backdrop.

No code changed (report only).
