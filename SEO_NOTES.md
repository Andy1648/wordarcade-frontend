# SEO_NOTES.md — crawler / share-preview pass (branch `chore/seo-share-pass`)

**Local scratch notes. NOT committed** (add to `.gitignore` or just leave untracked).

Scope kept to the document `<head>` and static files — no components, game logic,
or styles touched.

## Audit result: the setup was already strong
Present and correct before this pass (left as-is):
- `index.html`: `<title>`, `meta description`, `canonical`, full Open Graph
  (site_name/title/description/type/url/image + width/height/alt), Twitter
  `summary_large_image` (title/description/image/image:alt), favicons
  (`.ico` 32, `.svg` any, `apple-touch-icon`), `manifest.json`.
- JSON-LD: root `@graph` with `WebSite` + three `VideoGame` entries; each game's
  static landing page (`public/<game>/index.html`) has its own richer `VideoGame`
  block (`offers` price 0, `publisher`, genre, playMode) — all claims verifiable
  from the repo; **no invented ratings / player counts / reviews**.
- `robots.txt` (allow-all + Sitemap line) and `sitemap.xml` (home + 3 games) both
  present and correct — nothing to add or fix there.

## What I changed (gaps filled)
1. **`theme-color` meta** — was MISSING from every HTML head (only `manifest.json`
   had it). Added `<meta name="theme-color" content="#0d0618">` to `index.html` and
   all 3 landing pages. `#0d0618` = the app's void background (DESIGN.md §2) and the
   manifest `theme_color`, so mobile browser chrome + unfurlers tint consistently.
2. **`twitter:image:alt`** — `index.html` had it; the 3 landing pages did not. Added
   for parity (same shared `og-image.png`, same alt text).
3. **`og:image:type` = `image/png`** — small correctness add on `index.html` + all 3
   landing pages (the referenced asset is a PNG). Helps some unfurlers.

No new imagery generated — everything points at the existing `og-image.png` (1200×630).

## Verified
- `npm run build` clean; grepped `dist/` — all new tags present in
  `dist/index.html` and `dist/{word-bomb,category-blitz,imposter-word}/index.html`;
  `robots.txt`, `sitemap.xml`, `og-image.png`, `manifest.json` all copied to `dist/`.
- **Share result-card unfurl**: `src/share/links.js` builds share URLs as
  `https://typeaword.com/?join=CODE&ref=share` and `?daily=1&ref=share` — both
  resolve to `/`, so crawlers get `index.html`'s OG. Served the build and fetched
  `/?join=ABCDE&ref=share` and `/?daily=1&ref=share`: both return the full OG set
  (title "Type a Word", chaotic-word-games description, `og-image.png`,
  `summary_large_image`, `theme-color`). `/word-bomb/` unfurls with its own title.
  Sensible previews confirmed.

## Human decisions / possible follow-ups (not done tonight)
- **`og:title` on the root is just "Type a Word"** while the `<title>` is the fuller
  "TYPE A WORD — Free Multiplayer Word Games Online". The short OG title is fine, but
  a punchier share headline in DESIGN.md's voice (e.g. "TYPE A WORD — type fast, die
  slow") is a copy/tone call for a human. Left unchanged to avoid editing shipped copy.
- **192×512 install icons**: `manifest.json` only lists `favicon.svg` (any) +
  `favicon.png` (48). DESIGN.md OPEN DEBT already tracks "192/512 install icons".
  Not addressed here — requires generating new imagery (out of scope).
- **`sitemap.xml` `lastmod`** is `2026-07-12`. These files were touched today, but
  only meta tags changed (no substantive content), so I left `lastmod` as-is rather
  than overstate a content change. Bump to today if you prefer.
- **A dedicated OG image per game** (vs. the one shared `og-image.png`) would make
  per-game shares distinct — needs new art, so a design/human decision.
- **No `twitter:site`/`twitter:creator`** — there's no known @handle in the repo;
  adding one would be inventing data. Skipped intentionally.
