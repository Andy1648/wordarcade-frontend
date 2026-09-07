# Stranger test 3 — honest first 5 minutes (fresh LV1)

First honest stranger pass since RUN mode, the card redesign, backdrops and onboarding landed
on `integration/run-stack`. Storage cleared before first paint (real LV1, no level warp).
Walked the natural newcomer path at two REAL viewports and screenshotted every screen in order.

- Script: `claude/_tools/stranger-3-walk.mjs` (spins its own `vite preview`, inlines the
  e2e WebSocket mock + non-localhost block, drives in-game screens by pushing frames).
- Shots: `claude/stranger-3-shots/phone-390x844/` and `.../laptop-1366x768/` (20 each).
- Backend never contacted (hermetic mock, same boundary as `e2e/support/backendMock.js`).

Note on the dim in-game shots: `09/10/15` were captured during the 3-2-1 countdown / turn-intro
(screen dims) — the LIVE play state is `11` (bright, finished). Judge gameplay off `11`.

---

## What CONFUSES a newcomer

1. **The flagship "PLAY" dumps a solo player into a share-with-friends lobby.** WORD BOMB is the
   FEATURED card; its dialog button says **PLAY** (`06`). Clicking it lands on a ROOM screen:
   "ROOM CODE ABCD / SHARE THIS CODE WITH FRIENDS TO JOIN / PLAYERS (1) / **NEED 2+ PLAYERS TO
   START**" (`07`). A lone stranger reads this as "I need friends to play." The solo escape hatch
   is the **ADD BOT OPPONENT** button, but the screen leads with sharing, not soloing. Same path
   for Category Blitz. (phone/laptop `06` → `07`)
2. **Three unexplained economy/progression systems at once.** "0 WINS" and "40 / 20 / 10 WINS /
   WORD" on the cards (`04`,`05`), plus "**M1 MASTERY — PLAY TO LEVEL UP**" in every mode dialog
   (`06`,`14`). A first-timer has no idea what WINS are, what they buy, or what mastery does.
3. **Redundant, overlapping first-load onboarding.** The XP-bar coach-mark spotlight and the big
   hero text "TYPE OR CLICK ANYWHERE / IT FILLS YOUR LEVEL BAR" say nearly the same thing and
   visually collide with the faint "TYPE ANYWHERE TO EARN XP" line between them. (phone `04`)
4. **In-game coach headings overlap controls.** The yellow "TYPE A WORD WITH THE LETTERS" and
   Blitz's "NAME THINGS IN THE CATEGORY" sit on top of the input / SEND button area. (`10`,`15`)
5. **SAT Rush adds an un-onboarded "PICK YOUR BEAT" step.** After PLAY you must choose BRIEFING vs
   LINEUP ("no help, but you'll see the suspects") — bounty-hunter framing a newcomer hasn't met
   yet. (`17`)

## What looks UNFINISHED

1. **First few seconds of a round read as an empty dark void (phone).** During the countdown/turn
   intro the graffiti backdrop is nearly invisible and a tiny bomb floats in a large black gap in
   the middle of the screen — looks unfinished. (phone `09`,`10`; Blitz `15`) It resolves to a
   vivid, clearly-finished screen the moment play starts (`11`), so it's a first-impression timing
   problem, not broken art.
2. **Game-over title legibility + a stray name.** Confetti overlaps "YOU WIN!" and the subtitle
   renders as a garbled "L + RAN OUT OF WORDS.", and the WORDSMITH highlight shows "CYBERYETI54"
   in a plain YOU-vs-BOT game — reads like a placeholder/attribution glitch. (`13`) (Caveat: the
   `game_over` payload here was mocked with only a winnerId, which likely contributes to the name.)
3. Everything else is polished — dialogs, lobby, locked previews and both SAT screens look finished.

## What would make them CLOSE THE TAB in the first 5 min

- **"This game needs friends I don't have."** A solo stranger taps the FEATURED PLAY and hits
  "SHARE THIS CODE WITH FRIENDS TO JOIN / NEED 2+ PLAYERS TO START" (`07`); if they don't spot
  ADD BOT they bounce. This is the #1 tab-closer.
- **"Most of this isn't for me yet."** The biggest, first-read card — the RUN marquee — is a grey
  LOCKED tile for every newcomer (UNLOCKS AT LV 8), and half the six-card grid is locked at LV1
  (RUN LV8, CHAIN LV20, FUSE LV25). The hero of the page is a padlock. (`04`,`05`,`18`,`19`,`20`)

## The SINGLE BEST thing they see

The **teaching screens that explain a mode in one glance** — SAT Rush's intro (clue "lasting only
a very short time" → **EPHEMERAL**, `16`) and the locked CHAIN preview (E → EAGLE → ELEPHANT →
TIGER, `19`). Backed by a genuinely strong cartoon identity: the laptop card grid with distinct
per-mode art (`05`) and the punchy live Word Bomb screen with its instant "TOO SHORT" reject toast
(`11`). If forced to pick one: SAT Rush's intro (`16`).

## Blunt overall first impression (2-3 sentences)

It looks like a real, polished game with a strong Newgrounds/FNF identity and unusually good
per-mode explainer screens — the craft is obviously there. But a brand-new solo player is funneled
into a "share this code with friends / need 2+ players" lobby on the flagship mode and greeted by a
grey LOCKED hero card, so the first 60 seconds can read as "this needs friends and most of it is
locked" before they ever reach the (excellent) actual gameplay. Fix two things and the first look
flips: give new players a one-tap SOLO/bot start, and don't lead them with a locked marquee.
