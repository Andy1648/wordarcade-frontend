// RushRoot.jsx — the one LANGUAGE RUSH root main.jsx mounts (lazily) on /<language>-rush. It picks that
// language's own root here, so the arcade's first-paint bundle names ONE lazy chunk instead of five (every lazy
// import in main.jsx adds its preload list to index.js — the homepage payload ratchet). Each language root is
// still its own lazy chunk with its own words; main.jsx's Suspense covers this second load too.
import { lazy } from 'react';

const ROOTS = {
  french: lazy(() => import('../FrenchRushApp.jsx')),
  spanish: lazy(() => import('./SpanishRushApp.jsx')),
  italian: lazy(() => import('./ItalianRushApp.jsx')),
  latin: lazy(() => import('./LatinRushApp.jsx')),
  chinese: lazy(() => import('./ChineseRushApp.jsx')),
};

export default function RushRoot() {
  const lang = (/^\/([a-z]+)-rush/i.exec(window.location.pathname) || [])[1];
  const Root = ROOTS[String(lang).toLowerCase()] || ROOTS.french;
  return <Root />;
}
