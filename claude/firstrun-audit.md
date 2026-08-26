# First-Run Experience Audit — typeaword.com

**Date:** 2026-08-26 · **Branch:** chore/firstrun-audit · **Method:** cleared all storage, loaded `/`
as a brand-new visitor, walked the first five minutes on desktop (1440×900) and a phone (390×844).
**Report-only — no code changed.** Verdict up front, then the walk, then the fixes.

## Verdict (harsh, because this decides whether traffic converts)

The game itself is legible the moment you're *in* a round — the mode dialog's worked example
(`TRA → TRAIN`) is genuinely good. But **everything around the first round is built for a returning
player, not a new one.** A first-timer is dropped onto a menu carrying an XP bar, a SHOP, a REBIRTH
button, two locked modes, and a "20 WINS / WORD" economy — **none of which is explained**, and most
of which is meaningless until they've played. The single worst offender: **REBIRTH, a prestige-reset
mechanic, is a top-level button for a level-1 player who has nothing to reset.** Nothing ever says
"here's what wins are," "here's what XP does," or "just press CREATE to play." Conversion is leaking
in the 30 seconds between landing and the first round.

## The walk — minute by minute

**0:00 — Splash (`fr-desk-2`).** Big "TYPE A WORD" wordmark, a burst behind it, and **"TYPE TO
START"** over five empty boxes (`□□□□□`). It's a cute gate, but ambiguous: type *what*? The five
boxes imply a five-letter word, but nothing prompts one, and there's no "just start" affordance for
someone who doesn't want to guess. A confident visitor types something and moves on; a hesitant one
stalls on the very first screen. **Assumed, not explained.**

**0:03 — Intro animation (`fr-phone-3`: "TYPE FAST. DIE SLOW." knife-split).** Flashy and on-brand,
but it's a **~3-4s gate between the click and the menu** every single load. A new player who just
typed to start now waits through a cinematic before they can do anything. First-time patience is
thin; this is pure delay before value.

**0:06 — The menu (`fr-desk-3`).** Five cards: WORD BOMB, CATEGORY BLITZ, SAT RUSH, and CHAIN /
FUSE stamped **"UNLOCKS AT LV 15 / LV 22."** Up top: an **XP bar reading "LV 1 · 0 / 120"**. Top-right:
**SHOP, REBIRTH, STATS.** Bottom: JOIN ROOM, DAILY #238, CREDITS. This is a *lot* of surface for
someone who has been here six seconds. Specific problems:
- **The XP bar means nothing to a newcomer.** "LV 1, 0/120" — 120 of what? Earned how? Leveling to
  *what end*? It's the game's core progression signal and it is 100% unexplained. A new player reads
  it as decoration.
- **Two of five modes are locked** with no visible path. "UNLOCKS AT LV 15" tells you the gate but
  not the effort (is that 5 minutes or 5 hours?) or the how (play *what* to level?).
- **SHOP and REBIRTH are premature.** SHOP spends "wins" you don't have and don't understand.
  **REBIRTH is an end-game prestige reset shown to a level-1 account** — it is genuinely
  disorienting; the most experienced idle-game player wouldn't rebirth at LV1, and a newcomer has no
  frame for it at all. Putting it in the top-right trio (equal weight with SHOP/STATS) is a mistake.
- **"JOIN ROOM" / "DAILY #238"** assume multiplayer-room and daily-streak literacy the player
  doesn't have yet.

**0:20 — Opening a mode (`fr-desk-4`).** Click WORD BOMB → a clean dialog: "SOLO/MULTI", "Beat the
bomb. Combo or choke.", the **`TRA → TRAIN` worked example** (this is the best onboarding moment in
the whole flow — it teaches the mechanic in one glance), "20 WINS / WORD", "TURN-BASED", and
**CREATE / JOIN** buttons. Two friction points:
- **"20 WINS / WORD" is the third time the wins economy is shoved at the player without ever
  defining it.** Wins are the currency you earn by playing and spend in the SHOP — but the game
  never says so. A newcomer reads "wins" as "points" and misses that it's a spendable resource.
- **CREATE vs JOIN is a choice a first-timer can't evaluate.** Both are room/multiplayer language.
  The player who just wants to *play right now* has to guess that **CREATE** is the "start playing"
  button (it is — it opens a room they can play solo), while JOIN expects a code they don't have.
  There is no "PLAY" button. The label works for a returning host; it's a small wall for a newcomer.

**Mobile (390×844):** the same flow, and it's responsive and clean (`fr-phone-4` — the dialog scales
well). Two mobile-specific notes: (1) the intro cinematic eats even more of the small screen's
attention before the menu appears; (2) the menu is the fixed-frame scrolling layout (good — all five
cards are reachable), but a newcomer still meets the same unexplained XP bar / SHOP / REBIRTH.

## Where a new player gets stuck (ranked by how many they'll lose)

1. **The unexplained economy.** WINS appear on every card and drive the SHOP, but nothing defines
   them. This is the biggest silent leak — the whole meta-progression is invisible.
2. **REBIRTH at LV1.** A prestige button with no context, equal-weighted in the top nav. Confusing
   at best, alarming at worst ("will this delete my progress?").
3. **The XP bar with no meaning.** The core "why keep playing" signal reads as chrome.
4. **CREATE/JOIN instead of PLAY.** A guessable-but-real wall between the dialog and the first round.
5. **The splash "TYPE TO START" ambiguity** + the ~3-4s intro gate: friction before any value.
6. **Locked modes with no path.** Aspiration shown, the route withheld.

## What's actually good (keep it)
- The mode dialog's worked example (`TRA → TRAIN`, and the CHAIN/FUSE equivalents) — the one place
  the game teaches instead of assuming.
- The art and identity are strong and coherent; the game reads as *made*.
- Once in a round, the mechanic is self-evident.

## Recommended fixes (report-only — for the owner to prioritize)
1. **Define WINS on first sight.** One line the first time the menu loads ("WINS — earn them every
   round, spend them in the SHOP"), or a tooltip on the wins counter. Cheapest, highest-impact fix.
2. **Hide REBIRTH until it's reachable** (e.g. until the first rebirth level is in range, or until
   the player has any wins). It should not share the top nav with SHOP/STATS at LV1.
3. **Give the XP bar a one-time "what's this?"** — "Type anywhere to earn XP · level up to unlock
   CHAIN & FUSE." It already ties to the locked modes; say so.
4. **Add a PLAY affordance.** Either relabel CREATE→"PLAY" for the solo case, or lead with a single
   "PLAY" that opens a solo room and keep CREATE/JOIN for the multiplayer path.
5. **Let the player skip the intro after the first time** (or shorten it) — returning-visitor logic
   already exists (`wa_last_seen`); a first-run cinematic is fine, a per-load one is a tax.
6. **On the splash, accept any key / a click as "start"** and drop the five-box ambiguity, or label
   what to type.

**No code changed in this audit.**
