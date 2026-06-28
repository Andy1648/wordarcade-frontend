import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
  return {
    plugins: [react()],
    base: isPortal ? './' : '/',
    build: {
      outDir: isPortal ? 'dist-portal' : 'dist',
    },
  }
})
