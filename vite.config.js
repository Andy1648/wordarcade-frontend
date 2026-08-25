import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The canonical list of indexed pages. `lastmod` is stamped with the BUILD date at
// generate time (see sitemapPlugin) so it never goes stale — every deploy refreshes
// it automatically. This replaces the old hand-maintained public/sitemap.xml, whose
// dates froze the day it was written.
const SITEMAP_URLS = [
  { loc: 'https://typeaword.com/', changefreq: 'weekly', priority: '1.0' },
  { loc: 'https://typeaword.com/word-bomb/', changefreq: 'monthly', priority: '0.8' },
  { loc: 'https://typeaword.com/category-blitz/', changefreq: 'monthly', priority: '0.8' },
  { loc: 'https://typeaword.com/sat-rush/', changefreq: 'monthly', priority: '0.8' },
]

function renderSitemap(lastmod) {
  const urls = SITEMAP_URLS.map(
    (u) =>
      `  <url>\n` +
      `    <loc>${u.loc}</loc>\n` +
      `    <lastmod>${lastmod}</lastmod>\n` +
      `    <changefreq>${u.changefreq}</changefreq>\n` +
      `    <priority>${u.priority}</priority>\n` +
      `  </url>`
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

// Emit dist/sitemap.xml at build time with today's date as <lastmod>. Skipped for
// the portal build (an isolated iframe embed that isn't crawled, so it needs no
// sitemap). Runs after the bundle is written so nothing overwrites it.
function sitemapPlugin(outDir) {
  return {
    name: 'generate-sitemap',
    apply: 'build',
    writeBundle() {
      const lastmod = new Date().toISOString().slice(0, 10) // YYYY-MM-DD (build date)
      writeFileSync(resolve(outDir, 'sitemap.xml'), renderSitemap(lastmod))
    },
  }
}

// `portal` mode produces an ISOLATED build for iframe embedding on game portals
// (itch.io / Newgrounds / CrazyGames): relative asset paths (base './') so it
// loads from any nested iframe URL, emitted to dist-portal/ so it never touches
// the default dist/. VITE_PORTAL='1' (from .env.portal) drives the skip-intro
// branch in App.jsx.
//
// The DEFAULT build (any non-portal mode, e.g. the `vite build` Vercel runs) is
// UNCHANGED — base '/', outDir 'dist', absolute /assets/ paths. The values set
// here for the default branch are Vite's own defaults, so behavior is identical.
export default defineConfig(({ mode }) => {
  const isPortal = mode === 'portal'
  const outDir = isPortal ? 'dist-portal' : 'dist'
  return {
    plugins: [react(), ...(isPortal ? [] : [sitemapPlugin(outDir)])],
    base: isPortal ? './' : '/',
    build: {
      outDir,
      rollupOptions: {
        output: {
          // Split the heavy, stable vendor libs out of the entry chunk (perf/bundle). React and
          // the monitoring libs (Sentry ~100KB, PostHog ~60KB) were bundled INTO the ~600KB
          // entry; isolating them drops the entry well under 450KB, lets each cache across
          // deploys, and lets the browser fetch them in parallel with the entry (HTTP/2), so no
          // route gets slower to interactive. Behaviour is unchanged — only the chunk layout.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('/scheduler/')) return 'react-vendor'
            if (id.includes('@sentry')) return 'sentry'
            // posthog is dynamically imported (deferred to idle) so it already lands in its own
            // lazy chunk — no manual rule needed.
            return undefined
          },
        },
      },
    },
  }
})
