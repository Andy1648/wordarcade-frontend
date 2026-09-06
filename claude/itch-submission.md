# itch.io submission — TYPE A WORD (ready to paste)

itch is a hosted-HTML5 upload. Config below is final; upload the isolated portal build.

## Project title
TYPE A WORD

## Short tagline (itch "short description", one line)
Fast, chaotic multiplayer word games — type fast, die slow.

## Classification
- **Kind of project:** Game
- **Release status:** Released
- **Pricing:** No payments (free)

## Upload / embed settings
- **Kind of upload:** HTML — "This file will be played in the browser."
- Build: `npm run build:portal` → zip the **contents** of `dist-portal/` (index.html at the zip
  root, not nested in a folder).
- **Embed options:**
  - Viewport: **960 × 640** (or "Fullscreen button" enabled + "Mobile friendly").
  - Check **Fullscreen button**, **Mobile friendly**, and **Automatically start on page load**.
- The portal build has no service worker and hard-skips the intro, so it behaves correctly inside
  the itch iframe.

## Long description (itch body)
TYPE A WORD is a browser arcade of loud, fast word games. No download, no account — just type.

**WORD BOMB (multiplayer)** — a fragment ticks down on a live bomb; type a real word that contains
it before it blows. Last typist standing wins.

**AI CATEGORY BLITZ (multiplayer)** — a weirdly specific category, and a race to name things that
fit. An AI judge handles the edge cases live.

**SAT RUSH (solo)** — SAT vocabulary as a bounty-hunter arcade run: each word is a suspect, letters
reveal on a timer, and the skill is naming it before it escapes.

**CHAIN & FUSE (solo)** — quick single-player word puzzles.

Type fast, die slow.

## Genre / Tags (itch)
- **Genre:** Puzzle (also Educational, Multiplayer)
- **Tags:** word, multiplayer, typing, vocabulary, casual, arcade, singleplayer, spelling, browser,
  party-game

## Controls (put in description + itch "Input" metadata)
- Keyboard to type words (the whole game). Enter submits.
- Mouse / touch for menus and mode/pack selection.
- **Inputs:** Keyboard, Mouse, Touchscreen.

## Cover image
itch cover is **630 × 500** (min 315 × 250). Screenshots recommended (1–5). The current
`public/og-image.png` (1200×630) predates the card redesign — see portal-checklist.md → "Cover
images"; crop/regenerate a 630×500 from current art before publishing.

## Community / metadata
- **Community:** Comments (or Disqus) — optional.
- **AI disclosure:** Category Blitz uses an AI (LLM) to judge answers — disclose "Generative AI is
  used to validate player answers in one mode" if itch prompts for AI usage.
