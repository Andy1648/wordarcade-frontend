// The crazygames build plugin's pure helpers (scripts/crazygames-build.js) + the no-op contract on typeaword.com.
import test from 'node:test';
import assert from 'node:assert/strict';
import { assetPathRe, relativizeAssetPaths, crazyGamesHtml } from '../../scripts/crazygames-build.js';
import { IS_CRAZYGAMES, setGameplay, initCrazyGames } from './crazygames.js';
import { navHref } from '../router.js';

const re = assetPathRe({ dirs: ['gear', 'cast', 'fx', 'miner', 'shop'], files: ['mascot-idle.png', 'favicon.ico'] });
const rel = (s) => relativizeAssetPaths(s, re);

test('public-asset literals become document-relative', () => {
  assert.equal(rel(`src: '/gear/a.webp'`), `src: './gear/a.webp'`);
  assert.equal(rel('src="/mascot-idle.png"'), 'src="./mascot-idle.png"');
  assert.equal(rel('`/cast/${c.id}-${pose}.webp`'), '`./cast/${c.id}-${pose}.webp`');
  assert.equal(rel('`/shop/power/t${i + 1}.webp`'), '`./shop/power/t${i + 1}.webp`');
  assert.equal(rel("background: 'url(/fx/a.svg)'"), "background: 'url(./fx/a.svg)'");
  assert.equal(rel("`/cast/${ID.test(v || '') ? v : 'riot'}-hero.webp`"), "`./cast/${ID.test(v || '') ? v : 'riot'}-hero.webp`");
  assert.equal(rel("idle: '/mascot-idle',"), "idle: './mascot-idle',");
  assert.equal(rel('`/mascot-${name}.png`'), '`./mascot-${name}.png`');
  assert.equal(rel("art: '/miner/ore-dirt.webp'"), "art: './miner/ore-dirt.webp'");
  assert.equal(rel("startsWith('/gear/')"), "startsWith('./gear/')");
});

test('routes, external URLs and non-asset paths are left alone', () => {
  for (const s of [`'/miner/play'`, `'/room/'`, `'https://typeaword.com/gear/a.webp'`, `'/chain/play'`, `'/'`, `'//cdn.x/gear/a.webp'`]) {
    assert.equal(rel(s), s);
  }
});

test('index.html: AdSense out, SDK in first, root-absolute href/src relative', () => {
  const html = '<html><head>\n<link rel="icon" href="/favicon.ico">\n<link href="https://fonts.googleapis.com/x" rel="stylesheet">\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1" crossorigin="anonymous"></script>\n</head></html>';
  const out = crazyGamesHtml(html);
  assert.ok(!out.includes('googlesyndication'));
  assert.ok(out.indexOf('crazygames-sdk-v3.js') < out.indexOf('favicon'));
  assert.ok(out.includes('href="./favicon.ico"'));
  assert.ok(out.includes('href="https://fonts.googleapis.com/x"'));
});

test('outside the crazygames build everything is a no-op', () => {
  assert.equal(IS_CRAZYGAMES, false);
  assert.doesNotThrow(() => { initCrazyGames(); setGameplay(true); setGameplay(false); });
  assert.equal(navHref('/chain/play'), '/chain/play');
});
