# LESS IS MORE — oct3 17:45 pass (feat/less-is-more)

Andy: "some visuals/logic are 'doing too much'. Cut, don't add, this pass." The only addition is the
round-start match-win banner.

## BASE wording
| Site | Before | After |
|---|---|---|
| Word receipt (`WordPayout`, WB/Blitz) | `5 LETTERS × 10` | `BASE 10 / LETTER × 5 LETTERS` then the named ×rows |
| Word receipt fallback (no letter terms) | `BASE 5` | `BASE 5 / WORD` |
| Round receipt (`RoundPayout`) head | `12 WORDS × BASE` | `BASE · 12 WORDS` |
| Stats XP stack | `BASE XP / LETTER` | unchanged (already right) |
| Mode dialog rate tag | `(×2.4)` | `(×2.4 BONUS)` — the multiplier named, as the card already does |

Numbers unchanged: same terms, same product. The cards / dialogs / SAT cover / HUD chip print the
RESOLVED rate (what a word pays now), not a base, so they are not relabelled BASE.

## WIN ×N lines
Removed: GameCard perk `WIN → YOUR GAME ×N` (WB/Blitz/RACE cards now show their normal perk:
LONGER WORDS PAY MORE / RACE POWER ×1.5); ModeExample `WIN A MATCH: YOUR GAME ×N VS A HUMAN RIVAL`;
WinnerPopup caption `YOUR GAME ×N` (duplicated the receipt's WINNER row).
Kept: the end-of-game receipt WINNER row (+ its gate/cap note) — payout honesty.
Added: `MatchWinBanner` — "WIN = ×N YOUR GAME" (N = 1 + WINNER_MATCH[mode].mult), 1.5 s, once at round
start, only with ≥1 human rival. WB/Blitz: inside the existing 3-2-1 countdown overlay. RACE: inside
the countdown hero. Absolute, pointer-events:none, finite transform/opacity; reduced motion = static.

## Cuts (one line each)
1. Podium icon: cream die-cut sticker, cyan/gold/orange steps, pink number, plinth, star, glint sweep
   → one-ink glyph (button ink, black outline, one hard black shadow). Multicolour clashed with the theme.
2. Podium glint timer + state in Homepage/MobileMenu — decoration on a button that already pulls the eye.
3. GameCard `WIN → YOUR GAME ×N` — said once at round start instead.
4. ModeExample `WIN A MATCH: YOUR GAME ×N VS A HUMAN RIVAL` — same.
5. WinnerPopup `YOUR GAME ×N` caption — duplicate of the receipt row directly below it.
6. In-game HUD chip `LONGER WORDS PAY MORE` row — fourth copy of a rule the card, dialog and teach strip say.
7. SAT RUSH cover `LONGER WORDS PAY MORE` — SAT words are dealt to you; you cannot choose a longer one.
8. Blitz dialog `AI BUILT` sticker badge — decorative chip that does not help pick the mode.
9. Stats `ACHIEVEMENTS WITH THEIR GOAL HIDDEN UNTIL YOU CROSS IT` — the heading HIDDEN ACHIEVEMENTS says it.
10. Stats `SAT RUSH — THE WORDS THAT KEEP ESCAPING. STUDY THESE.` → `SAT RUSH` — the heading WORDS YOU KEEP MISSING says the rest.
11. Dead CSS for the above (`.mode-dialog-ai-badge*`, `.sr-cover-longer`, `.lstack-row--base`, the solo-HUD `:has()` hide rule).
