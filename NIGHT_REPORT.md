# NIGHT REPORT — branch scratch (DO NOT MERGE)

> ⚠️ This file is **branch-only scratch** for Andy's morning review. **Delete it before any eventual merge to main.** It lives only on `night/*` branches.

---

## Monitor scale-up
_Branch: `night/scale` · 2026-06-26 · Tier 3 (layout/scale) · NOT merged, NOT on prod_

### Logged viewport (from verification run)
- `[viewport] 1280×585 · --app-scale=0.600 (width-zoom ceiling 2.5)`
- That's the **automation browser's** window, not Andy's monitor. The whole point of the log: **open the preview on your real monitor and read the `[viewport] …` line in the console** — it prints your true `innerWidth×innerHeight` and the resolved `--app-scale`. Paste that number back and I can fine-tune the ceiling if 2.5 isn't enough.

### OLD vs NEW
- **Width-zoom ceiling: `1.6` → `2.5`** (now a named token `MAX_WIDTH_ZOOM` in `src/main.jsx`).
- Height cap `h / DESIGN_H` (DESIGN_H = 1040): **unchanged**.
- Effective scale: `min(widthZoom, heightCap)` — **unchanged formula**, only the widthZoom ceiling rose.

### Why this fixes it (and stays scroll-safe)
- On a big monitor the old `widthZoom` slammed into the `1.6` cap, so the UI never filled the screen. Raising the cap to `2.5` lets wide displays scale up.
- The in-game **no-vertical-scroll** fix is preserved *by construction*: scale is still `min(widthZoom, heightCap) ≤ heightCap = h/1040`, so a screen can never zoom taller than the viewport. The height cap binds in exactly the regime where scroll would otherwise appear, and I did not touch it. On tall+wide monitors the new ceiling simply lets scale rise from 1.6 toward `heightCap` (still ≤ it → still fits).
- Verified on a short window (585px tall): scale resolved to the `0.6` floor (height-bound), identical to old behavior → **small/normal windows are not over-scaled**.
- Phones (`≤600px` → scale 1) and reduced-motion: untouched.

### Diff summary
- `src/main.jsx` — `MAX_WIDTH_ZOOM` token (1.6→2.5), comment updates, one-time viewport `console.log`. **1 file changed, +29 / −8** (commit `05efd4e`).
- No other files touched. (LoadingScreen.jsx, audit `.md`s, generated_content_review.js, stray gameLogic.test.js — left untouched.)

### Preview URL (branch)
https://wordarcade-frontend-gax177eee-beenchilling.vercel.app

### Confirm on your monitor (eyes-only)
- Menu + an in-game screen (Word Bomb) both **fill the screen larger** than before.
- In-game still has **zero vertical scroll** (the prior fix).
- Read the console `[viewport]` line and report your real resolution so I can tune `MAX_WIDTH_ZOOM` precisely if needed (e.g. a 4K 3840×2160 will now scale to ~2.08; a 2560×1440 stays height-bound ~1.38 — if you want it bigger there we'd revisit the height cap, which is a separate, scroll-risky change).
