# SEASON 2 — CHECKLIST (Andy authorized all of it, Oct 6 2026)

Source of truth: `claude/progression-FINAL.md` **v2 (rewritten 22:30)** — it REPLACES what #235 built.
Rules: one task at a time, no parallel agents, read CI logs before fixing, re-run only failed shards,
update this file after each step, **Claude never runs migrations**.

## 0. ASAP, live — remove the "LEVELS GOT HARDER" popup for everyone (ship alone)
- [ ] BLOCKED — cannot reproduce (Oct 6). The string is in no production chunk (71 JS + 48 CSS
      fetched from typeaword.com), not in main's `src`, and never in git history (`git log -S`).
      Fresh headless visits (1440×900 + iPhone 13, splash → menu, menu typing, 25 s idle) show no
      popup. The only trace is the v10 spec copy (`andy-notes-oct2.md`, `v10-spec.md`); its
      `taw.pv10notice` flag is set by `econMigrate.js` but nothing renders it.
      NEED: a screenshot / the exact wording + URL (prod or a preview?) where it shows.

## 1. PROGRESSION FINAL v2 behind SEASON2
- [ ] need(n) = 100 × 1.15^(n−1)
- [ ] rebirth at LV 15 + 18R → LV 1; ×3 XP & wins per rebirth
- [ ] KEY/POWER ladder ×1,2,5,10,25,50,100,250,500,1000 then ×2.15/tier; cost 150 × 5^T wins; KEPT through rebirth
- [ ] menu typing ×0.2, ANY keys count, no rate cap (revert the real-words / repeat-decay filter)
- [ ] wins from games only; OVERDRIVE kept; gems / rolls / marks exactly as the doc
- [ ] REMOVE the ×1000 scale; hide ascension
- [ ] AUTO REBIRTH at R2
- [ ] New migration replacing 026's rules: `lb_rebirth` gate LV ≥ 15 + 18R → level 1 (12/hour cap stays). Never run it.
- [ ] Port `claude/progression-final-sim.py` into CI; must match the doc's sim table ±25%

## 2. WELCOME — EDITOR'S NOTE screen (house style, based on Season2.dc.html, not a plain box)
- [ ] "EDITOR'S NOTE" / "SORRY FOR RESCALING THE PROGRESSION — HERE'S SOME GEMS"
- [ ] old run → gems = round5(300 + 40 × old R)
- [ ] COLLECT → gems float + fly into the left gem pill (KitFly) with a counter tick-up

## 3. LEADERBOARD after the reset
- [ ] everyone keeps their old position; every stat shows "—" until earned in season 2
- [ ] order = season-2 stats desc, ties by season-1 rank from the reset snapshot
- [ ] the view as a migration — never run it

## 4. FLIP-STEPS
- [ ] update `claude/FLIP-STEPS.md` with the new SQL order
- [ ] STOP — visual polish moves to a separate cloud session later
