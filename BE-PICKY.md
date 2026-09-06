# BE-PICKY — the visual bar every screen has to clear

This is the standard for judging any surface in TYPE A WORD (menu, dialog, overlay,
card, game screen, game-over). It is deliberately harsh. A surface does not "look
fine" — it either clears every check below or it is logged as a failure. Applies to
every job that references it.

The house style is fixed (see CLAUDE.md / DESIGN.md): Newgrounds/FNF flat cartoon —
flat colours only, thick COLOURED outlines, hard black offset shadows, Bungee /
Space Mono, 8px radius, snappy transform/opacity motion. BE-PICKY is how we enforce
that bar element-by-element, not a new style.

---

## The largest-empty-rectangle test (the headline number)

For any card/panel/screen, find the **largest axis-aligned rectangle that contains
no ink** — no text, no SVG/img, no filled shape, no border, no distinct-colour
region — and express it as a **percentage of the container's area**. A flat colour
field is NOT content; it is emptiness with a colour.

- **< 18 %** — composed. The eye has no large void to fall into.
- **18–30 %** — soft. One region is under-worked; note it.
- **> 30 %** — **FAILS.** There is a hole in the middle of the thing. This is the
  single most common defect in this app and the one to hunt first.

Measure it, don't eyeball it. Every report must carry the number.

---

## Per-element checks (run these on every element on the surface)

**Fill & composition**
1. Does the element earn its bounding box, or is it a small thing floating in a big
   empty field? (→ largest-empty-rectangle)
2. Is there a clear first / second / third read, or does everything sit at one flat
   weight so the eye has nowhere to land?
3. Is the art doing real work, or is it one small motif in a corner while colour
   does all the lifting?
4. Composed for THIS content, or a shared template with the values swapped? Five
   things that differ only by hue are a template, not a set.

**Type**
5. Is the display type big enough to be the hero where it should be, or timid?
6. Any orphaned single words, awkward wraps, or text colliding with its own stroke?
7. Is body/label text ≥ the readable floor (16px on inputs, no sub-11px labels on
   mobile)?

**Colour & edges**
8. Flat fills only — no stray gradient/glow/blur outside the sanctioned exceptions
   (beat-glow, SAT halftone)?
9. Every shape a thick COLOURED outline (darker shade of its fill), not a hairline
   or a missing edge?
10. Hard black offset shadow present and consistent in direction, not a soft CSS
    blur?

**State & edges of behaviour**
11. Locked / disabled / empty / loading states — still legible and on-brand, or do
    they read as broken? A padlock must sit ON a still-readable card, not a grey box.
12. Contrast: does every piece of text clear itself against what's directly behind
    it (including text over art)?

**Layout integrity**
13. Nothing clipped, overflowing its container, or colliding at 1920 / 1366 / 390.
14. No orphan fixed UI — every persistent control joins an existing cluster (corner
    nav / footer), never its own coordinates.
15. Touch targets ≥ 44px on mobile.

**Motion (static-frame proxy)**
16. Resting pose is a real composition (matches the reduced-motion frame); the
    surface doesn't rely on motion to not look empty.

---

## Severity ladder (Jobs 4/6)

- **BROKEN** — clipped, overflowing, colliding, unreadable, or a state that reads as
  a bug. Ship-blocking.
- **LOOKS UNFINISHED** — clears "not broken" but fails the fill / hierarchy / template
  checks. A stranger would call it a placeholder.
- **POLISH** — clears the bar; a specific, optional refinement noted.

---

## MANDATORY REPORT FORMAT (every job that cites BE-PICKY uses this)

For **each** surface / card / screen assessed:

```
### <surface name> — <VERDICT: BROKEN | LOOKS UNFINISHED | POLISH | rank>
- Before: <path to screenshot>   (After: <path> — only for fix jobs)
- Largest empty rectangle: <N>% of area  (per-mode where a set is shown)
- Reads in order: 1) <x>  2) <y>  3) <z>
- Failures: <BE-PICKY check #s + one line each>
- What a stranger notices in the first second: <ONE line>
```

Rules:
- **Before/after screenshots are mandatory** and must be real files on disk, linked
  by path. No claim without an image behind it.
- The **largest-empty-rectangle number is mandatory** and measured, not estimated.
- The **"what a stranger notices" line is mandatory** — one honest sentence, the gut
  reaction, not a checklist echo.
- Widths tested: **1920, 1366, 390** unless the job says otherwise.
