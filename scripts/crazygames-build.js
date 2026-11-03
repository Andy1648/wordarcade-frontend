// crazygames-build.js — the Vite plugin behind `npm run build:crazygames` (vite build --mode crazygames).
//
// CrazyGames hosts an uploaded zip on its own CDN, under a per-version SUBPATH, inside an iframe:
//   https://<game>.game-files.crazygames.com/<game>/<version>/index.html
// so every root-absolute URL ('/gear/x.webp') points at the CDN's root and 404s. Their rules (docs.crazygames.com
// /requirements/technical): relative paths only, no third-party ads (AdSense is out), <= 1500 files.
//
// THIS PLUGIN ONLY EXISTS IN THE crazygames MODE. The default `vite build` (Vercel, typeaword.com) never loads it,
// so production output is untouched by construction — no source file changes how it resolves an asset.
//
//   1. PUBLIC ASSET PATHS -> document-relative. Every JS/JSX module under src/ has its string literals that name a
//      file in public/ ('/gear/x.webp', `/cast/${id}-hero.webp`, "url(/fx/x.svg)") rewritten to './gear/x.webp'.
//      The page is always the zip's root index.html (the portal build never pushes a clean path into history — see
//      router.js hasStickyQuery), so './' IS the zip root. Doing it here rather than by hand at ~370 call sites keeps
//      production source byte-identical and covers art added later automatically. CSS url()s are rewritten by Vite
//      itself (base './'). A post-build scan fails the build if any root-absolute public path survives.
//   2. index.html: AdSense removed; the CrazyGames SDK v3 tag added first in <head> (their docs: before game code);
//      root-absolute href/src made relative.
//   3. SEO-only files dropped from the zip (the five landing pages, sitemap, robots, ads.txt, landing.css): they link
//      to typeaword.com and nothing in the game reaches them.
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'

const SEO_LANDING_DIRS = ['word-bomb', 'category-blitz', 'sat-rush', 'chain', 'fuse']
const SEO_FILES = ['ads.txt', 'robots.txt', 'sitemap.xml', 'landing.css']
const SDK_TAG = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'
const ASSET_EXT = 'webp|png|svg|avif|jpe?g|gif|woff2?|mp3|json|ico|txt'

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The public/ entries a JS literal may name: asset DIRECTORIES (minus the SEO landing pages) and top-level FILES. */
export function publicRoots(publicDir) {
  const dirs = []
  const files = []
  for (const name of readdirSync(publicDir)) {
    if (statSync(join(publicDir, name)).isDirectory()) {
      if (!SEO_LANDING_DIRS.includes(name)) dirs.push(name)
    } else files.push(name)
  }
  return { dirs, files }
}

// App ROUTES that share a name with an asset dir (public/miner/ holds MINER's art; '/miner/play' is a route). Paths
// under these are only rewritten when the literal reaches a file extension.
const ROUTE_DIRS = ['miner', 'daily', 'race', 'room', 'french-rush']

/**
 * A regex matching the leading '/' of a root-absolute public-asset path that opens a string/template literal or a
 * url( — i.e. the '/' in '/gear/x.webp', `/cast/${v ? v : 'riot'}-hero.webp`, "url(/fx/a.svg)", '/mascot-idle'
 * (an extension appended later) and `/mascot-${name}.png`. Any literal opening with an asset dir counts; a dir that
 * is also a route ('/miner/play') only when the literal reaches a file extension.
 */
export function assetPathRe({ dirs, files }) {
  const plainDirs = dirs.filter((d) => !ROUTE_DIRS.includes(d))
  const routeDirs = dirs.filter((d) => ROUTE_DIRS.includes(d))
  const stems = [...new Set(files.map((f) => f.replace(/\.[^.]+$/, '')))]
  const prefixes = [...new Set(files.filter((f) => f.includes('-')).map((f) => f.slice(0, f.indexOf('-') + 1)))]
  const parts = []
  if (plainDirs.length) parts.push(`(?:${plainDirs.map(escapeRe).join('|')})\\/`)
  if (routeDirs.length) parts.push(`(?:${routeDirs.map(escapeRe).join('|')})\\/[^'"\`\\n]*?\\.(?:${ASSET_EXT})\\b`)
  if (stems.length) parts.push(`(?:${stems.map(escapeRe).join('|')})(?=[.'"\`)?#\\s])`)
  if (prefixes.length) parts.push(`(?:${prefixes.map(escapeRe).join('|')})\\$\\{`)
  return new RegExp(`(['"\`(])\\/(?=${parts.join('|')})`, 'g')
}

/** The post-build guard: every root-absolute public-asset path still opening a literal in `code` (with context). */
export function findLeftovers(code, re) {
  const hits = []
  re.lastIndex = 0
  for (let m; (m = re.exec(code)); ) hits.push(code.slice(m.index, m.index + 48).split('\n')[0])
  return hits
}

/** Rewrite every root-absolute public-asset literal in `code` to './'. Pure. */
export function relativizeAssetPaths(code, re) {
  re.lastIndex = 0
  return code.replace(re, '$1./')
}

/** index.html for the zip: no AdSense, SDK first, no root-absolute href/src. Pure. */
export function crazyGamesHtml(html) {
  let out = html.replace(/\s*<script[^>]*pagead2\.googlesyndication\.com[^>]*><\/script>/g, '')
  out = out.replace(/<head>/, `<head>\n    ${SDK_TAG}`)
  out = out.replace(/(\s(?:href|src)=")\/(?!\/)/g, '$1./')
  return out
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

export function crazyGamesPlugin({ publicDir = 'public', outDir = 'dist-crazygames' } = {}) {
  const roots = publicRoots(resolve(publicDir))
  const re = assetPathRe(roots)
  return {
    name: 'crazygames-build',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0].replace(/\\/g, '/')
      if (!file.includes('/src/') || file.includes('/node_modules/')) return null
      if (!/\.(m?jsx?|tsx?)$/.test(file)) return null
      const next = relativizeAssetPaths(code, re)
      return next === code ? null : { code: next, map: null }
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html) => crazyGamesHtml(html),
    },
    closeBundle() {
      const out = resolve(outDir)
      if (!existsSync(out)) return
      for (const d of SEO_LANDING_DIRS) rmSync(join(out, d), { recursive: true, force: true })
      for (const f of SEO_FILES) rmSync(join(out, f), { force: true })
      // GUARD: no root-absolute public-asset path may survive in the shipped JS/CSS/HTML. A literal the transform
      // could not see (e.g. '/gear/' + id) would 404 on the CrazyGames CDN, so it fails the build here instead.
      const bad = []
      const files = walk(out)
      let bytes = 0
      for (const f of files) {
        bytes += statSync(f).size
        if (!['.js', '.css', '.html'].includes(extname(f))) continue
        const hits = findLeftovers(readFileSync(f, 'utf8'), re)
        if (hits.length) bad.push(`${f.slice(out.length + 1)}: ${[...new Set(hits)].slice(0, 5).join(' | ')}`)
      }
      if (bad.length) throw new Error(`crazygames build: root-absolute asset paths left in the bundle:\n  ${bad.join('\n  ')}`)
      console.log(`crazygames build: ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB in ${outDir}/ (limits: 1500 files, 250 MB)`)
    },
  }
}
