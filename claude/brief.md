# TYPE A WORD — one-page brief (docs/brief)

*Everything a fresh session needs to be useful immediately. Every claim verified against
source (CLAUDE.md, DESIGN.md, package.json, the modules cited).*

## What it is
A browser word game with a **Newgrounds / Friday-Night-Funkin' Flash-cartoon** aesthetic
(flat colors, thick colored outlines, hard black box-shadows, Bungee/Space Mono, snappy
motion). React + Vite frontend on **Vercel** (typeaword.com); Node + Express + `ws`
backend on **Render** (repo: `../chain-reaction-backend`). The hook: **typing IS the
currency** — menu keystrokes and gameplay earn XP/Wins; rarer words pay more.

## The five modes (one line each)
- **WORD BOMB** — multiplayer turn game: type a word containing the given letter fragment before the bomb times out; last standing wins. *(the flagship; Tier-1 WS logic)*
- **CATEGORY BLITZ** — name members of a niche category fast; AI judge (`aiValidator`) backs a per-category accept-list.
- **SAT RUSH** — solo vocab: a manga "wanted poster" bounty screen; answer EARLY as letters auto-reveal (spell-along). Wears a study skin (Leitner SRS) — its school-filter cover.
- **CHAIN** — solo: link words by last→first letter; long clean chains build the combo.
- **FUSE** — solo: type any word CONTAINING the burning fragment; two lives.

## The economy (one paragraph)
Two currencies. **XP** (leveling) comes from typing — `xpPerInput`/`xpPerWord`
(`src/progress/xp.js`), scaled by mode × Key-Power tier × rebirth × daily-streak
(×1.25 cap). **Wins** (spendable) come from rounds, scaled by word **rarity** (COMMON ×1
→ OBSCURE ×4, `rarity.js`) × **combo** (+0.1/word, cap ×3, `combo.js`) × **lucky** (1/40,
×5, `luck.js`), the per-word product **capped at ×40** (`cappedWordMult`). **WORD SENSE**
is a shop upgrade on the rarity axis (capped at ×1.5 after a runaway). **Rebirth** = prestige
reset for a permanent multiplier (ladder in `xp.js`). These two multiplier chains (XP vs
Wins) are separate and never multiply into one value.

## Locked design rules (do NOT break — see CLAUDE.md/DESIGN.md)
- **Art from real assets** (SVG/PNG), never CSS-drawn shapes; CSS is for MOTION only. Mascot is a PNG.
- **Flat colors only** (documented exceptions: `.homepage-beat-glow`, SAT Rush halftone).
- **Animation budget:** ZERO new infinite animations (build-failing test); transform/opacity ONLY; pool repeated effects; no layout reads in per-frame/keystroke paths; `will-change` only transform/opacity and never on idle nodes.
- **No orphan fixed UI** — new persistent controls JOIN the corner-nav or footer.
- **Menu motion law:** no idle loops; motion = title beat-pop + frame glow only.
- **Mobile:** 44px touch targets, 16px min input font.

## Gate & branches
- **Gate:** `npm run gate` = `npm run lint && npm run test && npm run test:e2e`. Lint FAILS on errors only (warnings ok, no `--max-warnings 0`). Unit = `node --test`. E2E = Playwright (flaky on this box → run `--workers=4 --retries=2`, read `.last-run.json`). Backend gate = `node --test`.
- **Always** `npx vite build --logLevel error` after changes (exit 0).
- **Branch conventions:** `feat/*` features, `fix/*` bugs, `chore/*` static/reports, `proto/*` standalone prototype pages (need a valid `vercel.json`!), `refactor/*`. Commit style: conventional (`feat:`/`fix:`/`docs:`). NEVER commit (unless told): `LoadingScreen.jsx`, `.md` audit reports, `generated_content_review.js`.
- **Preview URL** after push: `npx vercel ls wordarcade-frontend` (newest ● Ready Preview).

## Risk tiers (match ceremony to blast radius)
- **Tier 1 (live logic):** `App.jsx` WS handlers, `useWebSocket.js`, backend `server.js`/`roomManager.js`/`gameLogic.js`/bots/validators. ONE task at a time; diagnose before fixing; **2-device live play-test required before merge**.
- **Tier 2 (UI):** `GameScreen.jsx` rendering, room/lobby screens — review by playing.
- **Tier 3 (static/cosmetic):** CSS, copy, assets — batch freely, trust the build.

## Known traps (reintroduced before — verify they're absent)
1. `App.jsx` `room_update` handler MUST use **functional `setView(prev => prev==='game'?prev:'room')`** — the WS effect is keyed `[lastMessage]` only, so a direct `view` read is stale (kicks non-host to waiting).
2. The rendered screen MUST render off **live `view`**, never a lagging/`setTimeout` copy.
3. `useWebSocket` MUST buffer messages in a **FIFO queue** (drain every frame); a single overwriting slot drops co-arriving frames (game_started + room_update same tick).
4. `vercel.json` is invalid JSON if the rewrite regex uses `\.` — must be `\\.` (this broke every proto/main deploy this week; the file is shared, so main is affected too — **fix pending**).

## Current state of play (2026-09-04)
Production (typeaword.com) = `main` @ `e899545`. A long autonomous run this session shipped
**branches, none merged** (Tier-1 items await 2-device play-test): `proto/wb-look` +
`proto/blitz-look` + `proto/run-mode` (prototypes, deploy+render), `refactor/app-split-4`
(WS-drain extraction), `fix/wb-310` (rules-of-hooks build-failing), `feat/sat-srs`,
`feat/daily-seed`, `feat/bot-feel` (backend), `feat/secrets`, `feat/streak-2`,
`feat/reconnect-2` (design), `chore/dict-quality`, backend `data/accept-lists-5`. The
running worklog is `claude/WORKLOG.md`. **⚠️ Open item: main's `vercel.json` is invalid
(trap #4) — main deploys are failing; typeaword.com serves the last good build. One-char fix.**
