# ROLL screen — Sol's RNG feel notes (Andy oct5)

1. Sol's RNG cycles aura names fast in the centre and slows into the result. The slowdown is what you feel. Our reel uses `land × (1 − (1 − t/D)^k)`, where k rises with the tier, so a rarer mark crawls longer over its last cells.
2. Rarity is announced before the name. Sol's darkens the screen and changes the light for rare auras. We dim through the last half of an EPIC+ spin (0.5 for EPIC up to 0.88 for SECRET).
3. Big auras get a full-screen cutscene with "1 in X" as the headline. Ours is LEGENDARY+ only, shows "1 IN X" at 12cqw with formatNum, and holds for 2.2 s (LEGENDARY), 2.6 s (MYTHIC) or 3.2 s (SECRET).
4. Sol's has quick roll and auto roll, because most rolls are commons nobody wants to watch. We have no ×10. AUTO ROLL runs "until [tier] or better", and "skip reveals below [tier]" (default EPIC) shortens every common to a 0.5 s snap.
5. A new aura always gets its moment in Sol's. Here a first-time mark ignores the skip setting and always plays the full reveal.
6. Players trust Sol's because the odds on screen are the real odds. Every cell of our strip is an independent draw from `rollTable()` for the roll just paid for. The landing cell is the real result, and the fillers never read the result, so nothing gets placed next to a win as a near-miss.
7. Sound carries the build-up. We tick once per mark crossing the line, so the ticks slow with the reel. A rarer passing mark ticks a step higher, which is honest because it is the same information the strip shows. A tier sting lands with the result.
8. Shake scales with the tier (0 / 2 / 5 / 9 / 12 / 16 px), with no shake on a skipped land. The burst is pooled, EPIC+ only, 10–18 particles.
9. Tap anywhere skips to the result in Sol's, and in ours too: the tap cancels the reel, lands it on the result, plays the sting and shows the card.
10. The pity ladder is always on screen (EPIC+ in 50, LEGENDARY+ in 500). Players chase the countdown as much as the luck.
