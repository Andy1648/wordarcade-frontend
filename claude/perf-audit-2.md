# JOB 6 — runtime perf audit (frame time + animation budget) · REPORT ONLY

Measured median/p95 frame time, peak concurrent animations, and RUNNING-infinite animation count on
each surface, **under 4× CPU throttle @390px** (mobile — the surface that matters). Vs the ANIMATION
BUDGET (CLAUDE.md): zero new infinite loops · transform/opacity only · composited work scales · pool
per-event effects. Harness: `claude/perf/perfaudit.ruler.mjs`.

## Results (4× CPU, 390px)

| surface | median frame | p95 | peak anims | infinite (running) |
|---|---|---|---|---|
| menu — idle | **16.7 ms** | 18.4 | 46 | **3** |
| menu — 30 keys/s burst | 61 ms | 147.5 | 73 | 20 |
| FUSE — calm | 16.7 ms | 22.2 | **0** | 0 |
| FUSE — critical (rapid in/del) | 16.5 ms | 30.0 | **0** | 0 |
| CHAIN — calm | 16.6 ms | 22.2 | 0 | 0 |
| SAT RUSH — calm | 16.6 ms | 19.6 | 0 | 0 |

## Read

**Frame time is excellent almost everywhere.** Menu idle and ALL three solo modes (calm AND
fuse-critical) hold ~16.6 ms median — a solid 60 fps *even under a 4× CPU throttle*. The solo modes run
**zero animations at rest** (peak anims 0) — an exemplary match for the "nothing idles" rule; even rapid
typing in FUSE spawns no animations (p95 only 30 ms). Nothing here is main-thread-bound.

**Only surface that drops frames: the menu 30 keys/s burst — and it's an artificial worst case.** 61 ms
median / 147 ms p95, but that's a 4× throttle *and* a sustained 30 chars/sec (both extreme together).
Unthrottled it's ~15 ms. The pooled per-keystroke effects keep peak anims bounded (73, not growing with
key count), exactly as the budget intends ("pool every repeated element", "composited work scales"). The
burst infinite=20 is the effect POOL (WAAPI loops toggled on/off), not a leak — peak stays bounded.

**One rule-compliance finding (not a perf problem): 3 infinite idle animations on the menu.** Identified:
- `cb-throb` and `cb-illuminate` — the CATEGORY BLITZ card's brain SVG (two looping `<g>` animations).
- `sr-caret-blink` — the SAT RUSH card's caret (`<rect>`).

These loop continuously at menu rest. The strict **ANIMATION BUDGET** says "ZERO new infinite animations
… nothing loops at rest"; the older **Design Style** line says "Constant idle animations on all elements
— nothing static." These three card-art loops satisfy the second and violate the first — a **documented
doc tension**, on the CARD ART specifically (the menu CHROME already obeys the MENU MOTION LAW: only the
beat-driven title/frame-glow move). Perf cost is nil (idle 16.7 ms). They're also grandfathered — the
budget test asserts the infinite COUNT is unchanged, so these predate the rule and aren't new.
→ **Decision needed, not a fix:** either bless the card-icon idle loops as an explicit budget exception
(like `.homepage-beat-glow` is for the flat-color rule), or convert them to beat-driven finite one-shots
to bring the card art under the "nothing loops at rest" rule. No action taken — it's an intent call.

## Verdict vs the playbook
- transform/opacity-only, pooled effects, bounded peak anims: **holds** on every surface measured.
- 60 fps under 4× CPU on idle menu + all game screens: **holds**.
- "nothing loops at rest": **holds for the menu chrome + all game screens; 3 card-art loops are the lone
  exception**, cost-free, grandfathered — flagged for an explicit keep-or-convert decision.
No frame-budget regression found; nothing to ship.
