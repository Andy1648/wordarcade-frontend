# PROJECT — design and conventions (reviewer brief)

Assembled for the STEP 30 fine-tune reviewers from the repo's own sources: CLAUDE.md (design rules), DESIGN.md (the visual system, verbatim), and the Arcane direction (src/theme/arcane.css header, verbatim).

## From CLAUDE.md
## Design Style
- Newgrounds/FNF Flash cartoon aesthetic
- Flat colors ONLY, no gradients, no blur, no glow
- Thick COLORED outlines (darker shade of fill, not black except text strokes and shadows)
- Hard offset box-shadows in black
- Fonts: Bungee/Bungee Shade (display), Space Mono (body)
- Border-radius: 8px on cards/buttons
- All animations snappy (200-400ms for actions), never floaty
- Constant idle animations on all elements — nothing static
- Colors: #FF4FA3 (pink; #FF2EC4 is now RESERVED for the beat flash only), #2EFFE0 (cyan), #FFE94A (yellow), #FF6B3D (orange), #9A1AFF (purple), #0d0618 (dark bg), #1a0b2e (panel bg)

## Rules
- ART VS MOTION. Visual art must come from real vector assets (SVG or PNG in /public), never assembled from CSS shapes, gradients or borders. CSS-drawn art reads as low quality — approximate curves, wrong weights, no craft. CSS is for MOTION (transform/opacity animation) applied to those assets. If a visual needs a shape that isn't a rectangle or a circle, it is an asset, not a CSS trick. This is why the mascot is a PNG component and not code.
- Never add character illustrations via code — use the PNG mascot images in /public
- All SVG art should have personality: drips, overspray, asymmetry
- Sound effects use Web Audio API synthesis, no external audio files
- Mobile: all touch targets 44px minimum, font-size 16px minimum on inputs
- NO ORPHAN FIXED UI. Any new persistent control must JOIN an existing cluster — the corner nav (SHOP/STATS/REBIRTH/audio) or the footer. Never mount a new `position:fixed` element with its own coordinates. Two regressions came from this: the audio controls colliding with CREDITS, and the footer growing to three links that overflowed at 360px. A fixed element with no layout relationship to the page will eventually collide with whatever ends up beneath it.
- PREVIEW DEPLOYMENTS INJECT VERCEL UI. *.vercel.app previews include `<vercel-live-feedback>` (a right-edge floating pill) and may include the Vercel Toolbar. These are siblings of `#root`, not app markup, and never appear on typeaword.com. When judging chrome-level visuals, verify against production or ignore any element outside `#root`.
- Categories must be niche and unexpected — no generic "things that are green" style
- Always verify build passes after changes: npx vite build --logLevel error

## SAT RUSH (src/satRush/) — solo vocab mode
- MECHANIC — SPELL-ALONG endgame: every word is eventually typeable; the skill is answering EARLY. The 5×→1× stage/ante decay is unchanged, but at the FINAL stage letters keep auto-revealing on a cadence (`spellAlongMs`) up to length−1 — the LAST letter is never auto-revealed, so the player always finishes the word. After the last auto-reveal + one hold it's a "walked away" miss (costs a life, zeroes heat, requeues a revenant). The engine stays PURE (no timers): it exposes the endgame as data via `endgame()` → `{ tickMs, autoRevealMax, finalHoldMs }`; the hook (`useSatRushGame.js`) owns the clock. The deep-cut interval scale applies to STAGE cadence only, never to the spell-along tick.
- HEAT / SILVER TONGUE: a clear only bumps heat when `revealed <= heatMaxRevealed` (1 — the free stage-4 letter). A clear that leaned on more spell-along reveals scores normally and KEEPS the streak but leaves heat UNCHANGED (never reset) — silver stays something you earn by knowing words. Misses still zero heat.
- RETUNED DEFAULTS (engine.js `DEFAULT_CONFIG`, mirrored in config.js `DEFAULT_STAGE_MS`): stageIntervalMs 2800, spellAlongMs 1100, tierEvery 12, deepCutEvery 15, heatMaxRevealed 1. (`?stage=`/`?spell=` dev overrides + the DevTuner sliders still work; `?stage=` now clamps up to 12000.) NOTE: this note previously said stageIntervalMs 2000, but that retune never landed — the shipped `engine.js` DEFAULT_CONFIG and `config.js` DEFAULT_STAGE_MS are both 2800 (verified 2026-08-26). The engine source is the source of truth.
- LINEUP STAGE SCALE (`lineupStageScale`, default 3.0): LINEUP-only stage-cadence multiplier — recognition among 6 unknown words needs reading time that recall-after-study (briefing) doesn't. Applied to the stage delay in lineup runs ONLY (`useSatRushGame.js` via the pure `effectiveStageIntervalMs()` helper), stacking multiplicatively with the deep-cut scale. BRIEFING's timeline is byte-identical to before this knob. CRITICAL: the LINEUP last-call decision window (`lineupWindowMs`) is computed from the UNSCALED base only — the scale must never stretch the final coin flip. Dev overrides: `?lineupx=` (0.5–5) + the DevTuner "lineup x" slider (1–4).
- VISUALS follow the DESIGN.md "SAT RUSH — retro-print sub-style" section (cream-paper manga PAGE, ink + off-register violet, `--redink #C8321E` for danger, double-rule borders, ONE halftone + 5% grain, quiet-by-default: only the caret loops at rest; speed lines are endgame-only; beat = the violet plate rattling 1px; stamps/negative-reprint invert/tear are events). Do NOT restyle it back toward the neon-sticker house look without an explicit request.
- WANTED-POSTER layout: the play screen is ONE bounty poster (`WordCard`) — WANTED header (MOST WANTED on a deep cut) → case id → LAST SEEN / DESCRIPTION / KNOWN ALIASES fields → mugshot slots → the REWARD footer. The MULTIPLIER lives in that REWARD footer (`AnteMeter`, still class `.sr-mult` — juice squashes it), NOT a separate ante row. Revenant = an ESCAPED overprint across the header (not a corner stamp); deep cut = the MOST WANTED header + red overline (not a ribbon). The bounty copy (CAPTURED!! / ESCAPED!! / CASE CLOSED / CAPTURE-not-ANSWER, etc.) is sanctioned in DESIGN.md — keep it.

## CANONICAL MENU TITLE (.homepage-logo) — do not flatten or alter without explicit request.
Wordmark: Bungee Shade font, #FF4FA3 fill, 5px #000 stroke, text-shadow: none (depth from the font, NO extrude). Menu-only: resting tilt rotate(-2deg) skewX(-4deg) and title-beat-pop on html[data-beat]. Defined in Homepage.css.
- DELIBERATE DIVERGENCE FROM SPLASH (menu-compaction): the menu title DROPS the continuous chromatic split (title-rgb-left/right ghosts are display:none) — it no longer matches the splash, on purpose. Do not "restore" it without explicit request. (Wordmark fill/stroke/pose/beat-pop above are still locked.)

## MENU MOTION LAW (Homepage) — idle removed, beat kept.
The menu has NO idle/ambient loops (the old tagline sway, section-label breathe, button idle bounce, and splatter parallax were removed to stop visual "jumping"). Every element keeps its STATIC resting pose (matching its reduced-motion state). Motion is concentrated into two beat-driven moments only: (1) title-beat-pop on .homepage-logo, (2) the .homepage-beat-glow soft pink frame glow. Hover/press feedback stays. The button beat-pop was removed (beat = title + frame glow only). Do not reintroduce idle loops here.
- DOCUMENTED FLAT-RULE EXCEPTION: .homepage-beat-glow is a pink radial-gradient pulse — an intentional, menu-frame-scoped exception to the "flat colors only, no gradients" rule. Opacity-only, beat-driven, reduced-motion-off.

## The Arcane direction (src/theme/arcane.css)
```
/* ============================================================================
   ARCANE PASS — EXAGGERATE, DON'T DECORATE
   Andy: "exaggerated graphic textures, structural shapes, sharpness, so things
   POP. Fewer elements, each louder."

   This file holds the five primitives, applied to surfaces that already exist.
   It adds NO elements: every treatment rides a ::before/::after on a box that is
   already in the tree, or a background on the box itself. That is the whole point
   of running it AFTER the subtraction pass — louder is a property of what is left,
   not a reason to add more.

   FIVE PRIMITIVES
     1. .arc-facet     posterised hard cel-shadow — two FLAT bands, hard stop, no ramp
     2. .arc-rim       one bright rim, hero elements ONLY (see the rule below)
     3. the grain      a single-hue static overlay, one fixed layer, app-wide
     4. .arc-halftone  a dot field inside large flat shapes, never behind text
     5. .arc-recede    value grouping — everything that is NOT the hero steps back

   RULES THIS FILE KEEPS
   - MOTION BUDGET: nothing here animates. No keyframes, no transitions, no
     will-change. The grain is a static tiled background, not a filter re-run per
     frame — it rasterises once and is then just pixels.
   - transform/opacity only elsewhere in the app is untouched; this file adds no
     animation of any kind, so it cannot move the infinite-animation count.
   - FLAT COLOUR: every gradient here uses HARD STOPS. A hard-stop gradient paints
     flat bands — it is a way to get two colours out of one box, not a ramp. There
     is no blur, no glow and no soft shadow anywhere in this file.
   - SAT RUSH IS EXCLUDED from the rim and the facet. CLAUDE.md pins it to the
     retro-print sub-style ("Do NOT restyle it back toward the neon-sticker house
     look"), and it already has halftone + grain natively in its own ink/paper
     idiom. Applying the neon house treatment there would be the one change this
     pass must not make.
   ============================================================================ */
```

---

# DESIGN.md — TYPE A WORD visual system

Single source of truth for how TYPE A WORD looks and feels. Design tasks are checked
AGAINST this file. "Make it look good" is not a task; "conform [screen] to DESIGN.md §X"
is. If a change contradicts this file, either the change is wrong or this file is stale —
decide explicitly, don't drift.

> Most of this is locked from how the app is already built. A few lines marked
> [YOUR CALL] are subjective gut-checks only Andy sets. Everything else is the
> established system — conform to it, don't reinvent per screen.

---

## THE CRAFT BAR  (the gate every visual passes before it ships)
The governing sentence for execution quality:
> **Every visual must be intentional and crafted — real texture, depth, layering,
> and hand character. Generic AI-default output is a FAIL.**

What FAILS, no exceptions: plain emoji, basic flat stickers, default outlines,
clip-art shapes — anything that reads as "a model generated this in one pass with no
design intent." The test: **if a visual could be produced by any model from a one-line
prompt with zero craft, it does not ship.**

Where to pull from instead of defaults: the locked references in §1 (Friday Night
Funkin', Jet Set Radio, Persona 5, Splatoon, Street Fighter) plus the Newgrounds /
graffiti / Y2K Flash energy — and **real reference images**, not whatever a model
reaches for on autopilot.

This bar is about effort, not speed. **Quality and artfulness over speed — slow is fine,
generic is not.** A thing that took longer but has hand character ships; a thing that was
fast but reads as default does not.

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
- DOCUMENTED EXCEPTION to "flat colors only, no gradients": the menu's
  `.homepage-beat-glow` is a soft pink radial-gradient pulse on the menu frame,
  beat-driven and opacity-only. Scoped to the Homepage frame; intentional, not drift.

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
  The full intro (LoadingScreen → splash → "TYPE FAST. DIE SLOW." → knife split)
  replays once per SESSION, not once per visitor: a 30-minute absence from the site
  is the session boundary (same window GA uses). It's gated on a last-seen timestamp
  (`wa_last_seen`, see `src/visitHistory.js` `INTRO_COOLDOWN_MS`), refreshed on load
  and on pagehide — so a refresh after a long play session does NOT replay it, but a
  fresh visit after 30+ min away does (which also re-arms music via the splash's
  CLICK ANYWHERE TO START gesture). `?portal=1` still hard-skips regardless.
- **DREAD** — Word Bomb tension: bomb scales up, shakes harder, heat-shifts as fuse
  burns; screen micro-shakes <3s; player card pulses red on the bomb-holder.
- **SPRAY-REVEAL** — accepted words tagged on like graffiti (Jet Set Radio).
- **CLUTCH** — sub-1s correct word: slow-mo beat then snap back, color-pop, "CLUTCH!".
- **EXPLOSION / K.O.** — timeout: expanding blast rings (orange→yellow→white), debris,
  screen white-flash, charred card on the eliminated player.
- **IDLE** — subtle float/bob/jitter on idle elements; OFFSET so it feels alive, not
  mechanical. Hover PAUSES idle (`animation-play-state:paused`) and applies hover.
  EXCEPTION — the MENU (Homepage) has had its idle loops removed: too many always-on
  loops (tagline sway, label breathe, button bounce, splatter parallax) made it
  "jump." The menu now follows an "idle = remove, beat = keep" law — static resting
  poses, with motion concentrated into the title beat-pop + a beat-driven pink frame
  glow (`.homepage-beat-glow`). The menu title also intentionally DROPS the splash's
  chromatic split (it no longer matches the splash — deliberate). See CLAUDE.md.
  SPINNER EXCEPTION — a loading spinner shown DURING an active wait (e.g. the
  CONNECTING… / WAKING THE SERVER… ring inside a tapped CTA while the cold Render
  backend wakes) is FEEDBACK, not idle motion, so it's allowed here despite the
  no-idle-motion law. It exists only while the wait is in progress and reduced-motion
  swaps it for a static ⏳. Idle loops with no active wait stay banned on the menu.

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

## SAT RUSH — retro-print sub-style  (scoped to `src/satRush/`)
SAT RUSH deliberately diverges from the neon-sticker house look into a **vintage
manga / pulp PAGE**: cream newsprint printed in black ink + violet, sitting on the
site void (`#0d0618`). It still obeys the CRAFT BAR and the flat-colour / ink-outline
/ hard-offset-shadow / Bungee+Space-Mono rules — it's "print-era, not sticker-era."
This is a documented, intentional sub-style; do not "restore" it to the neon system.

Tokens (CSS vars on `.sr-app`):
- `--paper #F0EAD9` (newsprint) · `--tile #FBF7EC` (slot fill) · `--ink #111`
- `--violet #A855F7` — the accent, printed **off-register** (a violet `::before`
  plate offset −5px/−5px behind ink text)
- `--redink #C8321E` — the mode's danger. **Documented divergence** from the house
  neon danger red (`#FF5C5C`), scoped to this mode: on cream paper, print-red reads
  right where neon does not. Do not swap it back.

Surface:
- **Double-rule borders** (a 4px ink border + an inset 3px-paper / 5px-ink rule) and
  ONE hard offset shadow (`6px 6px 0 #111`) on every page/panel. Straight (no tilt).
- **Decoration budget — nothing beyond this list ships:** the double-rule borders,
  ONE halftone corner patch (`radial-gradient(circle,#111 30%,transparent 34%)` at
  7px), and a 5% pulp grain (3px dot pattern). That's it.

QUIET-BY-DEFAULT law (same spirit as the menu's "idle = remove"):
- **At rest the ONLY motion is the caret blink.** No idle bob, no ambient loops, no
  tilted elements (the ONE exception is the SFX stamp, ~4°).
- **Speed lines are endgame-only** (hidden until the final "spell-along" stage).
- **Beat response = the violet plate rattling ~1px** further off-register for ~120ms
  (scaled by `--beat-intensity`). That is the entire beat response — no page flash.
- **Stamps / the SILVER negative-reprint invert / the miss page-tear are EVENTS** —
  they enter, land, and are gone; nothing new loops while a state holds. SILVER TONGUE
  is expressed by INVERSION (the page reprints ink-on-paper → paper-on-ink), not by
  added elements. `prefers-reduced-motion` turns stamps into opacity fades and kills
  the flashes/rattle; state stays legible (shape + text, never colour alone).

WANTED-POSTER structure (the play screen is ONE bounty poster — `WordCard`; the
word is a fugitive, the multiplier is its REWARD, a missed word returns as an
ESCAPEE):
- Top→bottom: overline → **WANTED** header (Bungee + the off-register violet
  plate; **MOST WANTED** on a deep cut) → case id (the meta, in a double-ruled
  band) → FIELDS (**LAST SEEN** = the sentence with the violet blank,
  **DESCRIPTION** = the gloss, **KNOWN ALIASES** = the root line with cousins in
  muted violet; a root-null word omits the ALIASES row) → mugshot **SLOTS**
  (centred) → the **REWARD** footer (the multiplier lives HERE — the bounty is the
  ante: reward + ante note + pips + drain bar) → fine print.
- Event framing is print, not corner tags: **deep cut** = the MOST WANTED header
  + a red deep-cut overline (`--redink`); **revenant** = an ESCAPED overprint (a
  red double-ruled stamp slapped across the header at ~4°, HELD for the whole word
  as a state marker, reading `ESCAPED ×N — REWARD DOUBLED`); clear/miss = the
  corner STAMP; silver = the whole poster reprints in negative (invert extends to
  every poster element). The cover is a newspaper FRONT PAGE — gazette name, the
  SAT RUSH masthead, a ruled dateline, the paper PLAY button — and nothing else:
  Play opens the MODE SELECT (two paper cards, **BRIEFING** and **LINEUP**, one
  line each; the last choice preselected with the violet plate). The old
  "— Reward Schedule —" notice box + bounty how-to were cut in the copy purge —
  they explained the ante mechanic, and the table listed a stale 5-stage
  5×/4×/3×/2×/1× schedule the 3-stage engine never used. (No copy explains a
  mode: BRIEFING teaches by making you study, LINEUP by the suspects narrowing.)
- Sanctioned copy (the bounty voice — keep it, don't drift): clear **CAPTURED!!**
  (alt **CLOSE!**), miss **ESCAPED!!**, revenant **ESCAPED ×N — REWARD DOUBLED**,
  deep cut **MOST WANTED** header, silver **SILVER TONGUE!**; ante note **ANTE —
  CAPTURE NOW FOR MORE** / final **LAST CALL — IT'S PRINTING** (briefing) ·
  **LAST CALL — TWO LEFT** (lineup); the spell-along row **MUGSHOT PRINTING… · 1×
  SCRAPS** (briefing only); the LINEUP suspect panel **SUSPECTS · N STANDING**
  with a **CLEARED** alibi stamp on eliminated suspects; results entry stamp
  **CASE CLOSED**; the miss line "the fugitive was X — it'll be back". (Verbs are
  CAPTURE, not ANSWER.)

---

## 7. OPEN DESIGN DEBT
- [ ] 192/512 install icons (manifest needs them)
- [ ] combo-pop is content-scale only — does it feel flat without the border pop? (decide live)
- [ ] first-person last-life vignette — verify it reads in real play
- [ ] dimmed-disabled SKIP — confirm it reads as "skipped," not "broken"
- [ ] [YOUR CALL] HARD/CRAZY/HELL distinct hues + the type scale + spacing unit
- [ ] add new debt as you notice it
