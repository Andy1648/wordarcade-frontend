# PROJECT — design and conventions (reviewer brief)

True as of **Oct 2, 2026 (main after PRs #104–#117)**. Rewritten from the code, not from older briefs:
when this file and the code disagree, the code wins and this file is the bug. Sources: CLAUDE.md,
DESIGN.md, `src/theme/type.css`, `src/gameData.js`, `src/progress/*`, the backend's `blitzLists.js`.

---

## 1. THE GAME TODAY

TYPE A WORD (typeaword.com) — a browser word-game arcade. React + Vite on Vercel; Node + Express + `ws`
backend on Render; leaderboard / cloud save / redeem codes on Supabase (no auth — a per-browser secret,
SECURITY DEFINER RPCs).

### Modes (`src/gameData.js` order)
| Mode | Players | The mechanic | Notes |
|---|---|---|---|
| **WORD BOMB** | solo vs bot / multi | Turn-based: type a word containing the fragment before the bomb blows. | Ring layout; WIN +50% end-of-game bonus; local instant reject for too_short / missing_combo / already_used, dictionary on the server. |
| **CATEGORY BLITZ** | solo vs bot / multi | 3 × 30 s rounds: name as many members of the category as you can. | **LIST-ONLY** (STEP 9): an answer scores only if it is on the category's COMPLETE curated list; anything else is **NOT ON THE LIST**. 88 closed-set categories in 7 packs (gaming, sports, world, science, history, movies, mythology). The card ribbon says **AI BUILT** — the lists were built with AI and checked against 8 known-good / 8 known-junk answers each. **No AI judges an answer.** |
| **SAT RUSH** | solo | Vocab: capture the word from its clue before the reward (5× → 1×) drains; BRIEFING / LINEUP. | Retro-print WANTED-poster sub-style (§6). |
| **CHAIN** | solo | Each word starts with the previous word's last letter. | POWER ×2. |
| **FUSE** | solo | Every word must contain the fragment; light all 26 letters → **FRENZY ×5** for 5 real minutes. | CLUTCH bonus at ≤2 s; FRENZY OVER moment when it ends. |
| **RACE** | 2–5 + bots | **Entire-word racing** (monkeytype / TypeRacer): everyone types the SAME 25 whole words in order; first to 25 or most at 1:00 wins. | Dark-launched behind `?race=1`. Exact word only, no dictionary; bots type per letter. |

There is **no Imposter mode** (removed long ago; only stale SEO notes mention it).

### Progression (the one payout stack — `wins.js perWordFactors`)
Per-word WINS = per-word XP ÷ 10. Factors: mode POWER, difficulty, rebirth, daily streak, BONUS (mark ×
mastery × star power), FUSE FRENZY, **BOOST** (redeem code ×N on every mode, wall-clock), LETTER FORGE,
then per-word rarity / length / combo / lucky. The receipt ("WHERE YOUR WINS CAME FROM") names every
factor that paid; nothing pays invisibly. KEY POWER (XP per letter) and LETTER FORGE are the shop sinks;
REBIRTH resets level for ×wins and ★ stars; MARKS (LV10+) are worn titles with a MAIN bonus; non-game
rewards are CLAIMED — via the **STATS** button, which wears the claim count (no separate REWARDS icon).
Redeem codes: wins, per-level wins, or BOOST.

### Menu
TOP nav: STATS / REBIRTH / SHOP / trophy (leaderboard) / audio — one cluster. The wall behind the menu is
WallScene's floating sprayed words; each of the 24 border tiers re-lays the same words out (sceneLayout.js)
and a tier climb swishes the scene up with ONE transform. The leaderboard ranks by **LEVEL only** (words break ties; rebirths are not ranked — Andy oct2 evening; top 10 + your pinned real rank; a THIS WEEK board by words typed resets Monday 00:00 ET).

---

## 2. DESIGN STYLE (from CLAUDE.md, corrected where it had drifted)
- Newgrounds / FNF Flash cartoon aesthetic. "WORDS ARE WEAPONS." A game, not a website.
- Flat colours only — no gradients, no blur, no glow. Documented exception: the menu's beat-driven
  `.homepage-beat-glow` (opacity-only, reduced-motion off).
- Thick COLOURED outlines (a darker shade of the fill; black only for text strokes and shadows). Hard
  black offset box-shadows. 8px radius on cards / buttons.
- Fonts: **Bungee / Bungee Shade** (display — always ALL CAPS, enforced by `src/perf/typeScale.test.js`),
  **Space Mono** (body).
- Palette: `#FF4FA3` pink (`#FF2EC4` is RESERVED for the beat flash), `#2EFFE0` cyan, `#FFE94A` yellow,
  `#FF6B3D` orange, `#9A1AFF` purple, `#0d0618` void, `#1a0b2e` panel. Danger `#FF5C5C`.
- **Type scale (tokens in `src/theme/type.css`):** `--fs-hero`, `--fs-h1`, `--fs-h2`, `--fs-panel`,
  `--fs-body` (16–18px), `--fs-label` (13px — the floor for anything read), `--fs-micro` (11px, decoration
  only), `--fs-band`. Nothing a player reads is under 13px. ≥1800×1000 scales overlays/solo/race ~1.2×.
- Mobile: 44px touch targets; inputs ≥16px; the viewport opts into `interactive-widget=resizes-content`
  so the keyboard shrinks the layout (input / prompt / timer stay on screen — e2e/keyboard-up.spec.js).

**Corrected from the old brief:** "Constant idle animations on all elements — nothing static" is NOT the
rule any more. The animation budget is: **zero new infinite animations** (build-failing), transform /
opacity only, pooled per-event nodes, no layout reads in per-frame / per-keystroke paths, `will-change`
only `transform`/`opacity` and only while animating. The menu has NO idle loops (beat-driven title pop +
frame glow only). Finite "moments" (level-up, FRENZY, CLUTCH, OVER) are fine.

### Surfaces
- **`.wall-surface`** (`src/components/wall-system.css`, imported by Homepage and SoloShell) is applied to
  the **menu stage**, the **CHAIN/FUSE solo shell**, and the **RACE lobby + race screen** — each overriding
  its tokens. Word Bomb, Blitz and SAT RUSH do **not** use it. (The wall-system header and a
  MobileMenu.css comment still say "the game modes build on this / shared by the three game screens";
  that is out of date.)
- The persistent **WallScene** (App-level, z 0) is the floating-word alley behind every screen; on the
  menu it shows through the stage.

### Rules (unchanged, still enforced)
- ART VS MOTION: art is real SVG/PNG in /public; CSS is for motion. The mascot is a PNG component.
- NO ORPHAN FIXED UI: persistent controls join the corner nav or the footer (the BOOST pill rides the XP
  bar and the in-game rate stack; transient moments like FRENZY OVER are fixed + pointer-events:none).
- Sound = Web Audio synthesis. Categories must be niche/unexpected AND (Blitz) closed sets with complete lists.
- Preview deployments inject Vercel UI outside `#root`; judge chrome against production.
- Always `npx vite build --logLevel error`; the gate is the FULL suite (lint + node tests + all e2e).

---

## 3. CANONICAL MENU TITLE (.homepage-logo) — locked
Bungee Shade, `#FF4FA3` fill, 5px `#000` stroke, no text-shadow; resting tilt rotate(-2deg) skewX(-4deg);
title-beat-pop on `html[data-beat]`. Deliberately drops the splash's chromatic split.

## 4. MENU MOTION LAW — idle removed, beat kept
No ambient loops on the menu; every element at its static resting pose. Motion = (1) title beat-pop,
(2) `.homepage-beat-glow`. Hover/press feedback stays. One-shot moments (level-up, tier swish, OVER) allowed.

## 5. MOTION VOCABULARY (DESIGN.md §4, still current)
PUNCH (~1.07 overshoot, ~280ms), LETTER-BOUNCE, PERSONA WIPE (navigation, cosmetic only — never gates the
screen), KNIFE-SPLIT intro (once per 30-min session), DREAD (Word Bomb), SPRAY-REVEAL, CLUTCH, EXPLOSION /
K.O., FRENZY burst and its reverse (FRENZY OVER / BOOST OVER). Reduced motion keeps every state legible.

## 6. SAT RUSH — retro-print sub-style (scoped to `src/satRush/`) — keep
Cream newsprint page, ink + off-register violet, `--redink #C8321E` danger, double-rule borders, ONE
halftone + 5% grain; quiet by default (only the caret loops at rest); speed lines endgame-only; beat =
the violet plate rattling 1px. The play screen is ONE WANTED poster: header (MOST WANTED on a deep cut) →
case id → LAST SEEN / DESCRIPTION / KNOWN ALIASES → mugshot slots → REWARD footer (the multiplier + drain
— the mode's timer). Sanctioned bounty copy: CAPTURED!!, ESCAPED!!, CASE CLOSED, verbs are CAPTURE.
At keyboard-up heights the case id and ante caption drop and the suspects scroll so the REWARD stays.

## 7. LIVE-LOGIC TRAPS (CLAUDE.md "Known Bugs" — never reintroduce)
- `room_update` uses the functional `setView(prev => prev === 'game' ? prev : 'room')`.
- The screen renders off the LIVE `view`, never a lagging copy; transitions are cosmetic overlays.
- `useWebSocket` buffers a FIFO queue; the App drains every frame in order.

## 8. OPEN DESIGN DEBT
- 192/512 install icons; HARD/CRAZY/HELL hues; Word Bomb phone ring is width-bound on tall phones;
  Blitz lists don't group alternate names by member (two spellings of one member both score);
  iOS Safari ignores `interactive-widget` (keyboard-up handled on Android only).
