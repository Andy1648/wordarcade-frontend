// sentryLazy.js (perf/first-load) — the ONLY module that imports @sentry/react, and it names just
// the two exports the app uses. lib/analytics.js dynamic-imports THIS file, so Rollup tree-shakes
// @sentry/react through a static, two-name import (a bare `import('@sentry/react')` namespace
// keeps the whole package: ~490 KB raw instead of ~90 KB) and the result is still a lazy chunk
// that never sits on the boot path.
export { init, captureException } from '@sentry/react';
