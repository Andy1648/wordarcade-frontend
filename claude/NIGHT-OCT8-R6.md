# NIGHT OCT 8 — ROUND 6 (cloud run, 17:06 UTC →) — "stupid things" sweep + the LEVEL-UP moment + components

Andy, 12:38 ET, verbatim: "Cont theres so much more to do. HOLD FREE ROLL doesn't even fit. Check for stupid things like these and continue with visuals. Where's lvl up animation. Components."

## Rules I re-read before each step
- OWNERSHIP (checked by `git fetch` + last-commit time before every PR; ACTIVE = committed in the last 30 min):
  - round 4b (branches day4b/*, day4/*): rollScreen/*, markCard/*, GameScreen.jsx — last commit 17:04 UTC → ACTIVE at start. Findings there → HANDOFF.
  - round 5b (branches day5b/*): kit/*, ShopV2.*, LeaderboardV2.*, Homepage.css, typing CSS — last commit 17:03 UTC → ACTIVE at start. Findings there → HANDOFF.
  - mine: everything else (MenuXp.*, MenuNav.*, Homepage.jsx, MobileMenu.*, Season2Welcome.*, results/*, StatsV2.*, MarksIndex.*, solo/*, satRush/*, race/*, Room*/Lobby*/PublicRooms*, Achievements*, Credits*, Splash*, GameScreen.css …).
- NEVER: src/progress/*, season.js, migrations, SQL. Never commit claude/payload/homepage-load.md. No whole-screen redesign, no new mechanics.
- One component per PR (day6/<component>), from a FRESH origin/main; build + lint + unit + the relevant e2e subset locally; merge only on green CI; marker-grep the live bundle after each merge; rebase when main moves.
- Art = real SVG assets, CSS for motion; transform/opacity only; finite; pooled; ZERO new infinite loops; will-change only transform/opacity and only while playing; no orphan fixed UI.
- Real fonts in every measurement (SHOT_FONTS=1) — a fallback font hides the overflow.
- Floors: text ≥ 14px, numbers ≥ 18px. Nothing leaves its box at 1366×657 / 1920×1080 / 390×844 / 360×640.

## Plan
- [ ] Step 0 — tools/_shots/textaudit.mjs extended: overflow (scrollWidth > clientWidth), clipped text (overflow:hidden ancestors), floors, native <select>/<input type=range>, overlapping fixed elements — every screen × 4 viewports, real fonts. BEFORE counts.
- [ ] Step 1 — LEVEL-UP moment (day6/levelup): which fires on the SEASON 2 menu + make it visible. 4-frame strip.
- [ ] Step 2+ — one PR per component for the audit hits in files I own (before N → after 0 in each PR body).
- [ ] REPORT (last) + HANDOFF list.

## HANDOFF (files owned by an active round — NOT edited here)
(appended as found)

## Log
(appended per step)
