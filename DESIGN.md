# DESIGN.md — TYPE A WORD visual system

Single source of truth for how TYPE A WORD looks and feels. Design tasks are checked
AGAINST this file. "Make it look good" is not a task; "conform [screen] to DESIGN.md §X"
is. If a change contradicts this file, either the change is wrong or this file is stale —
decide explicitly, don't drift.

> Most of this is locked from how the app is already built. A few lines marked
> [YOUR CALL] are subjective gut-checks only Andy sets. Everything else is the
> established system — conform to it, don't reinvent per screen.

---

## 1. VOICE / PERSONALITY
The sentence that governs every visual choice:
> **Newgrounds / graffiti / Y2K Flash energy. Chaotic, fast, a little violent.
> "WORDS ARE WEAPONS." Type fast, die slow. A party game with teeth.**

It SHOULD feel: loud, kinetic, scrappy, handmade, aggressive, dangerous-but-fun,
controlled chaos. When something happens, it HAPPENS — hard cuts, not gentle fades.

It should NOT feel: corporate, sterile, calm, "default SaaS," smooth/gentle, clean-tech.
If a screen reads like a website instead of a game, it's wrong.

Reference points (locked, used repeatedly as the north star):
- **Friday Night Funkin'** — title/letter bounce, bold chunky character art
- **Jet Set Radio** — graffiti, spray-paint, street energy
- **Persona 5** — sharp angular transitions, aggressive angles, transitions-as-events
- **Splatoon** — paint accumulation, controlled mess
- **Street Fighter** — theatrical announcements ("FIGHT!", "K.O.!")
- [YOUR CALL] add/remove any that no longer fit

When a decision is ambiguous, resolve toward the sentence above.

---

## 2. COLOR  (LOCKED PALETTE — do not introduce off-palette colors)
Base:
- Background / void: `#0d0618` (dark purple-black) — the calm field everything sits on.

Player / accent palette (assigned one-per-player, used as accent/outline/highlight —
backgrounds stay on the dark panels):
- Pink:   `#FF2EC4`
- Cyan:   `#2EFFE0`
- Yellow: `#FFE94A`
- Orange: `#FF6B3D`
- Purple: `#9A1AFF`

Danger / heat (Word Bomb, last-life, errors):
- Red:    `#FF5C5C` / critical `#FF2E2E`
- Bomb heat ramp: dark → orange `#FF6B3D` → red, glowing hotter as the fuse burns.
- Error text: `#FF5C5C`

Rules:
- Refer to ROLES in new work ("danger", "player-color", "accent"), not raw hex, so the
  palette shifts in one place.
- **Chaos lives in MOTION, not in the palette.** Don't add new hues to add energy — add
  motion. Keep accent colors per screen limited; the dark base does the heavy lifting.
- **Word Bomb runs HOT** — drop cyan dominance in-game, lean orange/red/yellow. Bomb
  should feel dangerous, not clean.
- One player = one color EVERYWHERE they appear (name, typing indicator, kill-feed,
  elimination, score), consistent room→game.

Difficulty hues: HARD / CRAZY / HELL — [YOUR CALL: confirm the three hues if they're
meant to be distinct heat levels].

---

## 3. TYPE
- Display / titles: **Bungee** (the chunky FNF-style title font) + the vector graffiti
  title lettering. Letters often split into spans for per-letter animation.
- UI / body: **Space Mono** (the monospace "terminal" feel).
- Casing: TITLES IN CAPS (locked convention). Body sentence case.
- Type scale — don't freestyle sizes. [YOUR CALL: lock the scale, e.g. 12/16/24/40/64.]
- Title treatment: thick text-stroke/outline, slight skew, irregular slant. The
  "vector graffiti" look = thick black outlines (4–5px), flat fills, NO gradients,
  hard cel-shaded highlights.

Copy voice (the words themselves carry the brand — short, punchy, a little mean):
- Sanctioned strings already in use: "TYPE FAST. / DIE SLOW.", "WORDS ARE WEAPONS",
  "FIGHT!"/"LET'S GO!" (→game), "PEACE OUT" (→home), "READY?" (→lobby),
  "SQUAD UP" (→room), "CLUTCH!", "K.O.!", difficulty = HARD/CRAZY/HELL.
- Cut for school-filter safety (keep this bar): no graphic-violence framings
  ("GG EZ" was also cut as too toxic). Mean is fine; slurs/violence/toxic are not.
- [YOUR CALL] add new sanctioned voice strings as you coin them.

---

## 4. MOTION VOCABULARY  (the real differentiator — name moves, reuse them)
Core principle (locked, stated by you): **synchronized animations look mechanical;
offset/staggered ones look organic. Snappy, aggressive, intentional — never smooth/gentle.
Transitions are EVENTS, not decoration.** ease-in-out timing. Stagger by ~0.08s.

Named motions (already built — reuse these, don't invent one-offs):
- **PUNCH** — scale overshoot (~1.07) + quick settle, ~280ms. Fires on accepted word /
  impact moments. The signature "snap."
- **LETTER-BOUNCE** — per-letter wave on titles (split into `inline-block` spans,
  staggered `animationDelay`). The FNF signature. Needs `display:inline-block` or
  transform won't apply.
- **PERSONA WIPE** — diagonal bar wipe (skew −20deg, flat solid colors, ≤500ms total,
  aggressive) on EVERY screen navigation, with a mid-wipe flash word (§3 copy). Fires
  splash→menu→lobby→room→game→end→rematch + back. Consistency is the whole point.
- **KNIFE-SPLIT / IMPACT FRAME** — intro transition: zoom punch + black frame.
- **DREAD** — Word Bomb tension: bomb scales up, shakes harder, heat-shifts as fuse
  burns; screen micro-shakes <3s; player card pulses red on the bomb-holder.
- **SPRAY-REVEAL** — accepted words tagged on like graffiti (Jet Set Radio).
- **CLUTCH** — sub-1s correct word: slow-mo beat then snap back, color-pop, "CLUTCH!".
- **EXPLOSION / K.O.** — timeout: expanding blast rings (orange→yellow→white), debris,
  screen white-flash, charred card on the eliminated player.
- **IDLE** — subtle float/bob/jitter on idle elements; OFFSET so it feels alive, not
  mechanical. Hover PAUSES idle (`animation-play-state:paused`) and applies hover.

Hard rules:
- Timing: snappy. Transitions ≤500ms, navigation wipes ~200–400ms. Persona-snappy,
  never slow.
- Do NOT animate text inputs or anything the user is actively typing into.
- **prefers-reduced-motion: reduce** is mandatory on all decorative/idle/looping motion
  (kill loops; soften functional feedback to opacity, keep state legible). Already
  enforced — keep it. Functional motion (whose turn, accept/reject, last-life, countdown)
  stays READABLE when softened; only de-violence it, never remove the state signal.
- One motion language across screens: if a button punches on the homepage, it punches
  the same way in-game.
- Performance ceiling: watch simultaneous animating elements (a past audit found 40–55
  causing lag). GPU-friendly transforms/opacity only; no full-viewport repaint loops;
  gate whole-app shake to gameplay only.

---

## 5. SPACING / LAYOUT
- Tap targets: **44×44px minimum** (enforced — keep it).
- No layout shift on state change: reserve space (typing-line height on ALL cards, not
  just the active one; min/max-height on growing lists) so screens never jump.
- "Sticker" tilts (~0.5–3° resting rotation) are part of the handmade feel — keep them
  small and intentional, not random.
- Keep screen shake INSIDE the `overflow:hidden` container (don't reintroduce the
  scrollbar/flicker bug).
- Background layering: speed lines + vector accents + any grid sit BEHIND title/mascot
  and must stay readable. When in doubt: fewer, bigger accents — not more. Three stacked
  background systems is where "loud poster" tips into "noisy mess."
- Base spacing unit: [YOUR CALL — e.g. 4px or 8px grid.]

---

## 6. THE "DOES THIS FEEL RIGHT" CHECK  (run on the LIVE preview, not the diff)
1. Match the VOICE sentence (§1)? Reads as a game, not a website?
2. Palette on-system (§2)? Chaos coming from motion, not extra colors?
3. Motion reuses a NAMED move (§4), not a one-off?
4. Holds up at phone width AND with reduced-motion ON?
5. Would it look out of place next to the splash screen? (Splash = brand anchor.)
If any answer is "no," it's not done — regardless of what the diff says.

---

## 7. OPEN DESIGN DEBT
- [ ] 192/512 install icons (manifest needs them)
- [ ] combo-pop is content-scale only — does it feel flat without the border pop? (decide live)
- [ ] first-person last-life vignette — verify it reads in real play
- [ ] dimmed-disabled SKIP — confirm it reads as "skipped," not "broken"
- [ ] [YOUR CALL] HARD/CRAZY/HELL distinct hues + the type scale + spacing unit
- [ ] add new debt as you notice it
