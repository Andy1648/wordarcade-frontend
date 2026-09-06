# CrazyGames submission — TYPE A WORD (ready to paste)

Everything below is final copy. Paste field-by-field into the CrazyGames developer portal.

## Title
TYPE A WORD

## Short description (≤ ~90 chars)
Fast, chaotic multiplayer word games — Word Bomb, AI Category Blitz, and a solo SAT vocab run.

## Long description
TYPE A WORD is a browser arcade of fast, loud word games. No download, no sign-up — just type.

- **WORD BOMB** — Multiplayer. A fragment ticks down on a live bomb; type any real word that
  contains it before it blows. Last typist standing wins. Rapid turns, instant rejects, real
  pressure.
- **AI CATEGORY BLITZ** — Multiplayer. Get a weirdly specific category and race to name things
  that fit. An AI judge rules on the edge cases in real time.
- **SAT RUSH** — Solo. SAT-level vocabulary reimagined as a bounty-hunter arcade run: each word is
  a suspect, letters reveal on a timer, and the skill is naming it before it "escapes."
- **CHAIN & FUSE** — Solo word puzzles for a quick single-player fix.

Type fast, die slow.

## Instructions / Controls
- **Type** with your keyboard to enter words — that's the whole game.
- **Enter** submits (words also submit as you complete them in some modes).
- **Mouse / tap** to pick a mode, choose packs, and navigate menus.
- Fully playable on mobile (on-screen keyboard) and desktop.

## Genre / Category
Primary: **Word**. Also fits: Puzzle, Casual, Multiplayer, Typing, .io-style.

## Tags
word game, multiplayer, typing, vocabulary, word bomb, spelling, brain, casual, quick, io,
party, SAT, puzzle, singleplayer, browser

## Game URL / embed
- Live: **https://typeaword.com/**
- Zero-click embed entry: **https://typeaword.com/?cg=1** — lands the player straight into a
  solo-vs-bot game with no menu clicks (see portal-checklist.md → ?cg=1 verification).
- For an uploaded (iframe) build, use the isolated **portal build**: `npm run build:portal`
  → `dist-portal/` (no service worker, intro hard-skipped; safe for a nested iframe).

## Cover / thumbnail images
CrazyGames needs game art (16:9 cover + square icon). SEE portal-checklist.md → "Cover images"
for the status: the only social image in the repo is `public/og-image.png` (1200×630, dated
Jun 24) and it **predates the card redesign** — regenerate before submitting.

## Orientation / display
Works portrait and landscape; responsive down to 360px. Desktop preferred for multiplayer typing
speed; mobile fully supported.

## Multiplayer note
Word Bomb and Category Blitz are real-time multiplayer over WebSocket (rooms by code + public
rooms). The ?cg=1 entry provisions a solo-vs-bot room so a first-time portal player is never stuck
waiting for a human opponent.
