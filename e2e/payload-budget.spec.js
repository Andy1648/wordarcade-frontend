// e2e/payload-budget.spec.js — the payload budget, measured not asserted-by-eye.
// Records every response the homepage fetches BEFORE any user gesture, and again
// after the first gesture, so "no audio before a gesture" is a measurement.
// Run: PW_PORT=4190 npx playwright test payload-budget --workers=1 --reporter=line
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const OUT = 'claude/payload';
fs.mkdirSync(OUT, { recursive: true });

// Budgets. Numbers, not vibes.
//
// THE GOAL is 400,000. THIS BRANCH DOES NOT REACH IT, and the gate says so rather than
// pretending otherwise. Media was the whole of this branch's scope and media is now done:
// audio 4,285,965 -> 0 before a gesture, mascots 1,039,764 -> 80,753. What is left is
// almost entirely JS+CSS (1,039,127 of the remaining 1,246,830), which the task described
// as "~175KB and needs no changes" — measured, that is off by ~6x. Reaching 400,000 needs
// a decision about these, none of which is media:
//     240,417  words.recall-*.js    word data, idle-PREFETCHED on the homepage
//     223,888  index-*.js
//     146,897  react-vendor-*.js
//      91,609  index-*.css
//      88,455  sentry-*.js          eager in main.jsx so an early crash is still caught
//     142,877  GameScreen js+css    idle-prefetched
//      41,107  Shop/Stats js+css    idle-prefetched
// Dropping only the idle prefetches (424,401) still lands at ~822,000 — so the core
// bundle itself has to be split or deferred. That is a separate branch.
//
// Until then this is a RATCHET, not a rubber stamp: it pins the number this branch
// achieved so the payload cannot silently grow back. Lower it whenever it improves.
const TOTAL_BUDGET = 400_000; // the goal, documented above
const TOTAL_RATCHET = 1_037_000; /* oct17 THE UNLISTED +2,500 (Andy "people have been begging me for secret gear"): the found-never-rolled gear tier — markRollsCore is eager (the payout reads the worn gear), so its id/name/owned sliver (unlisted/unlistedIds.js) + the wear branch ride the menu, and the in-game secret listener gained the word tracker + the TRIPLE DOUBLE pair count (useWordSecrets is App-eager); the grant, the reveal, the stamp + its sting, the riddles, the index strip, the serial claim and the word list are all lazy chunks — measured +2,471 over main local. oct17 HOUSE SCROLLBARS +1,000 (Andy oct16 "anywhere where there's a scroll bar … a colored one and more simplistic one"): the one global ::-webkit-scrollbar rule + its --sb-* vars in index.css (every panel now sets colour vars only) — measured +869 on CI (1,032,473 vs main 1,031,604); the INDEX glow-room hook rides the lazy INDEX / EQUIP chunks. oct17 night MENU PROFILE CHIP +1,000 (Andy "still dont like the menu … the profile thing there (also off center)"): the ?menu variant read + data-menu, the icons-fit-the-column and chip / slab grid rules — the chip itself rides the lazy ProfileTile chunk — measured 1,032,652 local before the crit segment (local reads ~1,100 above CI). oct17 night CRIT SEGMENT +500 (Andy "i dont want the entire additive bar to turn orange … include both"): the XP bar's crit-only orange piece (one more node + its placement math in KitXpBar) — measured 1,032,047 on CI. oct17 CRIT ORANGE +500 (Andy "make the … additive bar like an orange increment", "make the key a different color"): the XP bar's crit listener + its ghost tint rule and the crit event in useXpCapture — measured 1,031,604 on CI; the TOP n% chip rides the lazy leaderboard chunk. oct17 PROFILE +2,000 (Andy "change the area to 'profile' as a popup … time played … the profile description"): the menu's PROFILE face tile in the icon cluster (KitIconButton art + mainFace.js, a storage read, no cast data), the lazy ProfileTile / ProfilePopup imports + their state, and the TIME PLAYED clock hook in the idle-prefetched GameScreen / solo / SAT chunks; the popup, picker, showcase and prop art are their own chunks — measured 1,030,986 local. oct16 NO-DELAY PRESSES +1,500 (Andy "Im starting to see lag … as people press buttons like gear and shop … IT CANT DELAY"): the PRELOADABLE lazy wrapper (chunkReload.js — a warm screen renders without a Suspense round-trip, which was React's ~300 ms fallback hold on every first open) + the full overlay warm list in App and the magnet's cached-rect bookkeeping; the screens themselves stay lazy — measured 1,028,624 local. oct16 YOUR MAIN +1,000 (Andy "the customizable section … on the right side"): the menu cell CSS + the lazy MainPick import (the panel itself is its own chunk) and the podium / product-card / results-buddy CSS of the visual prototype — measured 1,027,057 local. oct16 BLITZ FITS + ONE REACTION +3,500 (Andy oct15 "no one should ever scroll unless actually a list", "dont overcrowd it"): the Blitz phone header row / rivals strip / short-desktop rules + the HITS-yield host in the idle-prefetched GameScreen js+css, the rebirth + lobby phone fits, the SAT briefing in-page scroll — measured 1,024,455 on CI, 1,026,555 local (local reads ~1,100 above CI); the profile description's save code rides the lazy showcase chunk, not the menu. oct15 SEO BRAND ENTITY +500 (Andy: WebSite / Organization / 5 VideoGame JSON-LD + the new meta description): index.html grew — measured 1,023,248 on CI. oct14 SETTINGS + PAINTED CARDS + PLAYER ICONS +3,000 (Andy "beat sync separate", "remove rank plate [→ rank menu]", the art run): BEAT SYNC (lib/beatSync + its row), plate picking moved into the lazy RankLadder, the card layer markup + CSS, the seat-icon map — measured 1,022,118 local (2 painted cards); the card / seat images are media, not this JS+CSS total. oct14 FIRST-RUN TOUR + RACE WORDS +1,000 (Andy "type for xp, games for wins … instantly show for new accts", "make word race count to rebirth word ct"): the 2-step tour (Homepage + Spotlight hold / letter-key props) and the race-word counter (mastery.js COUNT_ONLY_MODES, read by the menu rebirth tile) — measured 1,019,557 local. oct13 SHACKLES + REBIRTH ROAD +2,000 (Andy "locked boxes … chained shut", "add in more content"): LockChains (component + CSS) on the menu's locked rail tiles / 2ND GEAR / mode cards and the rebirth tile's next-step copy (rebirthReadyCopy) — measured 1,018,360 local; the chain art itself is an <img> fetched on demand. oct13 TICKER CHECK +500 (Andy "my friend admitted he used commands"): live.js asks lb_tick_ok before showing a received tick (038) — measured 1,016,558 local. oct12 ANTI-CHEAT +2,000 (Andy "barriers for people who play with source code"): the 25-game-words rebirth gate (rebirthWords.js, read by the menu tile + AUTO REBIRTH) and the refused-gear sync hook — measured 1,015,119 on CI (1,016,278 local). oct11 SETTINGS RESET ACCOUNT +500 (Andy "settings needs a reset function (for account)"): the two-step ResetRow + its danger-button CSS ride the settings sheet (the reset itself, resetAll.js, loads on confirm) — measured 1,014,037 local. oct11 GEAR SLOT 2 FULL + CREDITS RIGHT + NO-WAIT WRAP +500 (Andy "i want it to be the same as the first gear", "move the credits to the other side", "there cant be a delay"): the ≥1200 credits cell + the two-slot compaction CSS, the slot-2 props on MenuGearSlot and the wrap's fast glide — measured 1,013,843 local. oct11 ALL RANKS + PATCH NOTES +1,000 (Andy "a popup … where user can click ranks to see all ranks", "patch notes as a popup"): the RANK plate became a button (hover/press CSS) + the lazy RankLadder / PatchNotesHost imports and the patch-seen check — measured 1,013,197 local; the ladder, the notes and the painted icons stay lazy. oct11 GEAR SHINE + MENU BACKDROP +500 (Andy "need something like that for the rest", "its just plain rn"): the menu slot backdrop span + its mask CSS — measured 1,012,143 local; the shine scheduler + assets ride the lazy card chunk. oct11 MENU GEAR SLOT v4 +1,500 (preview/gear-v4, Andy "no need to have 'your gear' … include stat and substats … like the cards but horizontal"): the name plate + the substat icon chips (subChip, the crit-burst / wins / gems chips + the lazy luck icon hook) — measured 1,011,803 local. oct11 GEAR CARD v4 +2,800 (preview/gear-v4, Andy "add more substats … like genshin", "jackpot … 200% gems"): markRollsCore is eager (the payout reads it) and gained the substat table + readers, JACKPOT, the +% GEMS stat and the dupe-gems freeze; the card's substats plate + the gem hook — measured 1,010,229 local. oct11 LEADERBOARD PROFILES +200 (preview/lb-profiles): only the lazy push hook in client.submitStats + its chunk-map entry ship first (measured 1,007,554 local); the card, showcase.js and the read stay lazy. oct11 combined merge (preview/oct11: oct10 safe batch on main + gems-cheaper + gems-clarity + gear-slot-2 + gear-cog-spin) measured 1,007,319 local: the 2ND GEAR slot + its lock chip on the menu (MenuNav / Homepage.css) and the gems-clarity menu rows on top of the safe batch; the cog-turn CSS rides the lazy MarkBadge chunk. oct10 GEMS CLARITY +1,500 (preview/gems-clarity, Andy "ABSOLUTELY know where the gems come from"): the menu cards' GEM-FRIENDLY badge (3 kit gem icons) + the WINS icon on the payout line, the phone rows' gem pips (MobileMenu) and the gem-rating table — measured 1,001,936 local; the dialog's gem rows, the room's bot gems and the results' gem sources stay lazy. oct10 combined merge (gear-op + gear-ui-v3 + menu-polish-v2) measured 1,000,195 local.  oct9 MENU POLISH v2 +3,500 (preview/menu-polish-v2, Andy "the 4 icons in the menu … at least some animation", "off center", "no plain text"): the rail tiles' centring + hover/press/beat CSS, the phone slab's icon row + Bungee number (MobileMenu.css), and the shared dot-nudge scheduler (MenuNav useDotNudge) — measured 999,365 local (was under 996,500); the ROLL / INDEX / STATS type pass is in their lazy chunks. oct9 GEAR POOL v2 +2,000 (Andy: COMMON gone, 10 new gears, Genshin pity): markRollsCore is eager (the payout reads it) and gained the new pool rows, the one-mode WINS / crit / EVERY-Nth-KEY stat kinds + their statText, the crit MAIN stats in critTotals, and the once-per-save COMMON refund (migrateRollSave, run before the first render) — measured 996,029 local; the new glyph art, flavour lines and INDEX refund line stay lazy. oct9 RARE-GEAR GLOW +1,500 (Andy "clash royale cards"): the tier frame on the GEAR chip (desktop + phone CSS) and the slot's face layer + the lazy GearFx import — measured 993,565 local; GearFx (aura / motes / scheduler) and its baked aura PNGs load only when an EPIC+ gear is worn or the INDEX opens. oct9 YOUR GEAR +3,500 (preview/gear-slot, Andy "glow on rarer gears … better stat … tap shows the gear stats"): the slot's tier frame CSS (+1,236 css), the LEGENDARY+ sheen hook + the tap → GEAR SHEET wiring (+1,939 js) — measured 991,625 local vs main 988,450; the sheet itself (GearSheetOverlay + GearSheet.css), the crit line's words (GearSlotCrit) and the sheen art stay lazy, and the idle-sheen numbers moved to markCard/idleSheen.js so the reveal plan stays out of the menu chunk. oct9 combined merge (preview/oct9: FitText + SETTINGS top-right + crit/XP fixes + gear v2 together) measured 988,854 local. oct9 +2,000: FitText (kit) — rail values, YOUR GEAR, STATS chips shrink to their box + the pill re-measures when the webfont lands (Andy "make sure things fit") — measured 986,848 local. oct8 CRIT +5,500 (985,500 after main: SAT dialog + bot-difficulty payout, measured 984,808): the menu CRIT KEY (Andy) — the per-key roll (progress/crit.js), the gear crit table + critTotals (markRollsCore), the pooled critPop variant + its 6-node burst pool (MenuXp) and its pop CSS; the crit-burst.svg art loads only when a RARE+ gear is worn and the crit WORDS (critText.js) stay lazy with STATS / ROLL / INDEX — measured 983,342 local. oct8 late +500: SAT RUSH opens in the menu mode dialog (its BRIEFING / LINEUP config + the choice buttons) — measured 978,621 local. oct8 eve +2,000: the SETTINGS cog glyph on the corner control + the menu RANK plate honouring your picked plate (progress/platePick) — measured 978,343 local; the settings rows themselves stay in the lazy AudioPanel chunk. oct8 day +1,500: the bottom-right BOOST dock (Andy) — only its gate (LazyBoostDock, a few localStorage reads) + its grid-cell CSS ship first; the dock itself is lazy, loaded when a boost runs — measured 975,917 local. oct8 day +1,500: main had already drifted to 973,950 (POWER bolt #294 + icon audit) and the boost labels (frenzyShort on the menu card + MobileMenu) add ~230 B — measured 974,179 local. oct8 night +2,500: the XP bar's ghost fill + one-level wrap beat (KitXpBar, Andy step 3 "gains are especially lacking") and the pill's shrink-to-fit/bump — menu features, measured 972,890 on CI (972,295 local); the gain particle system itself stays lazy. oct8 +1,500: the SEASON2 flip — season.js now carries the browser/node split + the ?season2=0 and storage off-switches (measured 970,356) */ // what is actually achievable today; must only go DOWN (oct3: route chunks warm on the first gesture, not idle → 927,791). oct5 +3,000: the multi-level level-bar player (lib/barPlan, Andy oct5 #5) is a menu feature, +3.1 KB in the index chunk — measured, not slack. oct7 +2,000: paging is the desktop default (feat/menu-centre), so the CardPager chunk (~1.4 KB) is first-paint on every desktop — measured 964,422. oct7 +4,500: YOUR GEAR slot + the honest rate line + the tier palette on the menu (feat/menu-perrow; the cog art itself stays lazy) — measured 968,857
const MASCOT_BUDGET = 150_000;

function classify(url) {
  const p = new URL(url).pathname;
  if (/\.(mp3|ogg|wav|m4a)$/i.test(p)) return 'audio';
  if (/mascot-/i.test(p)) return 'mascot';
  if (/\.(js|mjs)$/i.test(p)) return 'js';
  if (/\.css$/i.test(p)) return 'css';
  if (/\.(png|jpe?g|webp|avif|svg|ico)$/i.test(p)) return 'image';
  if (/\.(woff2?|ttf|otf)$/i.test(p)) return 'font';
  return 'other';
}

async function record(page) {
  const seen = [];
  page.on('response', async (res) => {
    const url = res.url();
    // Only OUR origin: Google Fonts / analytics are third-party and not this budget.
    if (!url.includes('localhost')) return;
    let bytes = 0;
    try {
      const buf = await res.body();
      bytes = buf.length;
    } catch {
      const len = res.headers()['content-length'];
      bytes = len ? Number(len) : 0;
    }
    seen.push({ url: new URL(url).pathname, bytes, kind: classify(url), status: res.status() });
  });
  return seen;
}

test('homepage initial load stays inside the payload budget', async ({ page }) => {
  const seen = await record(page);
  // A cold, gesture-free load: no clicks, no keys, no pointer events at all.
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // let any idle-callback work fire too

  // One entry per URL: a second <picture> asking for the same file (splash → menu mascot) is a
  // memory-cache hit, but Playwright still reports it with a full body — on CI's slower box that
  // double-counted mascot-idle.avif (+13,383) and tripped the ratchet with nothing downloaded twice.
  const preGesture = seen.filter((r, i) => seen.findIndex((o) => o.url === r.url) === i);
  const total = preGesture.reduce((a, r) => a + r.bytes, 0);
  const byKind = {};
  for (const r of preGesture) byKind[r.kind] = (byKind[r.kind] || 0) + r.bytes;
  const audio = preGesture.filter((r) => r.kind === 'audio');
  const mascots = preGesture.filter((r) => r.kind === 'mascot');

  const report = [
    '# Homepage initial load (no user gesture)',
    '',
    `TOTAL: ${total.toLocaleString()} bytes  (budget ${TOTAL_BUDGET.toLocaleString()})`,
    '',
    '## by kind',
    ...Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k.padEnd(8)} ${String(v).padStart(9)}`),
    '',
    '## every response, largest first',
    ...preGesture.sort((a, b) => b.bytes - a.bytes).map((r) => `  ${String(r.bytes).padStart(9)}  ${r.kind.padEnd(7)} ${r.url}`),
    '',
    `## audio requested before a gesture: ${audio.length === 0 ? 'NONE' : audio.map((a) => a.url).join(', ')}`,
    `## mascot bytes before a gesture: ${mascots.reduce((a, r) => a + r.bytes, 0)}`,
  ].join('\n');
  fs.writeFileSync(`${OUT}/homepage-load.md`, report + '\n');
  console.log('\n' + report + '\n');

  // The acceptance criterion this branch DOES meet, and the one that mattered most.
  expect(audio, `audio must not be fetched before a user gesture, got: ${audio.map((a) => a.url)}`).toHaveLength(0);
  // The ratchet. See the note on TOTAL_BUDGET for why this is not 400,000 yet.
  expect(total, `initial payload ${total} regressed past the ratchet ${TOTAL_RATCHET}`).toBeLessThan(TOTAL_RATCHET);
  if (total >= TOTAL_BUDGET) {
    console.log(`
NOTE: ${total.toLocaleString()} is still above the ${TOTAL_BUDGET.toLocaleString()} goal by ${(total - TOTAL_BUDGET).toLocaleString()} bytes — JS+CSS, not media. See the header comment.`);
  }
});

test('the five mascot assets together stay under budget', async () => {
  // Measures what SHIPS, from dist — the format the browser actually receives.
  const dist = 'dist';
  const poses = ['idle', 'panic', 'celebrate', 'run', 'taunt'];
  const pick = (pose) => {
    for (const ext of ['avif', 'webp', 'png']) {
      const p = `${dist}/mascot-${pose}.${ext}`;
      if (fs.existsSync(p)) return { p, bytes: fs.statSync(p).size, ext };
    }
    return null;
  };
  const rows = poses.map((x) => ({ pose: x, ...pick(x) }));
  const total = rows.reduce((a, r) => a + (r.bytes || 0), 0);
  const lines = rows.map((r) => `  ${r.pose.padEnd(10)} ${String(r.bytes).padStart(7)}  ${r.ext}`);
  const md = ['# Mascot assets (best format shipped)', ...lines, '', `TOTAL: ${total} bytes (budget ${MASCOT_BUDGET})`].join('\n');
  fs.writeFileSync(`${OUT}/mascots.md`, md + '\n');
  console.log('\n' + md + '\n');
  expect(total, `mascots total ${total} exceeds ${MASCOT_BUDGET}`).toBeLessThan(MASCOT_BUDGET);
});
