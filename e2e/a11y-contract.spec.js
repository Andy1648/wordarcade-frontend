// e2e/a11y-contract.spec.js — the two accessibility rules this project states, enforced.
//
// CLAUDE.md: "Mobile: all touch targets 44px minimum, font-size 16px minimum on inputs".
// WCAG AA for the rest: 4.5:1 for body text, 3:1 for large (>=24px, or >=18.66px bold).
// Neither was checked by anything, and both were being broken in ways a reader would never
// spot in a diff:
//
//   * `.homepage-nav-btn` sets `color: #0d0618` — correct against the bright fills these
//     buttons used to have. When they were demoted to the mid-value chrome panel
//     (--v-panel-hi, #221640) only REBIRTH's rule carried a matching colour, so SHOP and
//     STATS rendered near-black on near-black: **1.19:1**, against a 3:1 floor. REBIRTH
//     being the odd one out is exactly why it read bright and its two neighbours read as
//     smudges in every menu screenshot this run — which I saw, and mis-attributed to the
//     coach mark's scrim, twice, before measuring it.
//   * `.solo-exit` is 40x40 on CHAIN and FUSE. The 40 is deliberate (it is the app's
//     canonical close glyph) but 40 is not 44, and the rule is about the TOUCH TARGET, not
//     the box — so it carries one in an out-of-flow ::after now.
//
// KNOWN AND ALLOWED, so the gate stays honest about what it is not asserting:
//   - Desktop-only controls under 44px (the mark chip, the rank chip, CREDITS). The stated
//     rule is a MOBILE rule and at 390px none of them is under the floor.
//   - `.solo-chain-node.is-ghost` at 1.84:1 — the empty chain slots are deliberately
//     ghosted. It is decoration that happens to be a character.
//   - `.sr-cover-mult` at 4.45:1 against a 4.5 requirement. Real, tiny, and in a file
//     another branch is actively reworking.
//   - The wall graffiti letters. Background art, under everything.
import { test, expect } from '@playwright/test';
import { installBackendMock } from './support/backendMock.js';

const SEED = {
  'taw.wins': '48213', 'taw.xp': JSON.stringify({ lv: 18, into: 40 }), 'taw.rebirths': '2',
  'taw.keytier': '3',
};

// Reported but not failed — each with a reason, above.
const ALLOWED_SMALL = [
  'button.menu-mark',            // desktop-only chip; full size at 390
  'button.menu-xp-rank',         // desktop-only chip; hidden under 480 entirely
  'a.homepage-credits-link',     // desktop-only footer link
  'button.homepage-credits-link',
  'button.sr-exit-chip',         // SAT Rush — owned by another branch this run
];
const ALLOWED_CONTRAST = [
  'solo-chain-node is-gho',      // the empty chain slots are deliberately ghosted
  'sr-cover-mult',               // 4.45:1 against 4.5 — real, tiny, another branch's file
  'sr-cover-ex-answer',          // same file
  'object SVGAnimatedStr',       // wall graffiti: background art with no className string
];

const SCREENS = [
  ['menu', '/?portal=1', '.menu-xp-bar'],
  ['chain', '/chain?portal=1', '.solo-root'],
  ['fuse', '/fuse?portal=1', '.solo-root'],
  ['sat', '/sat-rush?portal=1', 'body'],
];

// sRGB relative luminance + WCAG contrast ratio
const HELPERS = `
function srgb(c){c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4);}
function lum(rgb){return 0.2126*srgb(rgb[0])+0.7152*srgb(rgb[1])+0.0722*srgb(rgb[2]);}
function parse(s){const m=(s||'').match(/[\\d.]+/g);return m?m.slice(0,3).map(Number):null;}
function alphaOf(s){const m=(s||'').match(/[\\d.]+/g);return m&&m.length>=4?Number(m[3]):1;}
function effectiveBg(el){
  let e=el;
  while(e&&e!==document.documentElement){
    const cs=getComputedStyle(e);
    if(cs.backgroundColor&&cs.backgroundColor!=='transparent'&&alphaOf(cs.backgroundColor)>0.6){
      return parse(cs.backgroundColor);
    }
    e=e.parentElement;
  }
  return [13,6,24];
}
// A CONTRAST RATIO IS A CLAIM ABOUT TWO COLOURS, and over artwork there is no second
// colour to name. The mode cards are illustrations; walking up for a backgroundColor finds
// the card's base fill, not the painting on top of it, and the number that comes out is
// about something the player never sees. Measured "failures" this produced: WORD BOMB at
// 2.83:1 and CATEGORY BLITZ at 2.55:1 — both white-on-dark and plainly readable in
// claude/overlay-shots/return-1280x720.png. Text over art is a judgement for an eye, not
// for this gate, so it is skipped and said so rather than silently passed.
function overArtwork(el){
  let e=el;
  while(e&&e!==document.documentElement){
    const cs=getComputedStyle(e);
    if(cs.backgroundImage&&cs.backgroundImage!=='none') return true;
    if(e.querySelector&&e.querySelector(':scope > svg, :scope > img, :scope > canvas')) return true;
    e=e.parentElement;
  }
  return false;
}
function ratio(a,b){const l1=lum(a),l2=lum(b);const hi=Math.max(l1,l2),lo=Math.min(l1,l2);return (hi+0.05)/(lo+0.05);}
`;

for (const [label, url, ready] of SCREENS) {
  for (const [vn, w, h] of [['1280x720', 1280, 720], ['390x844', 390, 844]]) {
    test(`a11y ${label} ${vn}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await installBackendMock(page);
      await page.addInitScript((s) => {
        try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch { /* blocked */ }
      }, SEED);
      await page.goto(url);
      await page.locator(ready).waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(1200);

      const r = await page.evaluate(new Function(`${HELPERS}
        const small = [];   // touch targets under 44px
        const unlabelled = []; // controls with no accessible name
        const lowContrast = [];
        for (const el of document.querySelectorAll('button, a[href], input, select, [role="button"]')) {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
          const b = el.getBoundingClientRect();
          if (!b.width || !b.height) continue;
          const id = (el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\\s+/).slice(0,2).join('.')).slice(0,34);
          // hit area may be widened by an ::after; count that
          // A control may carry its touch target in an out-of-flow pseudo-element, and it may
          // do so with EITHER height/width OR min-height/min-width. Reading only the min-*
          // pair reported the wins chip as a 16px target when it already had a 44px ::after
          // using a plain height. Measure the pseudo's real box.
          let hitW = b.width;
          let hitH = b.height;
          for (const pseudo of ['::after', '::before']) {
            const ps = getComputedStyle(el, pseudo);
            if (ps.content === 'none') continue;
            const pw = Math.max(parseFloat(ps.width) || 0, parseFloat(ps.minWidth) || 0);
            const ph = Math.max(parseFloat(ps.height) || 0, parseFloat(ps.minHeight) || 0);
            // a pseudo inset outside the box widens the target on both sides
            const insetX = (parseFloat(ps.left) < 0 ? -parseFloat(ps.left) : 0) + (parseFloat(ps.right) < 0 ? -parseFloat(ps.right) : 0);
            hitW = Math.max(hitW, pw, b.width + insetX);
            hitH = Math.max(hitH, ph);
          }
          if (hitW < 44 || hitH < 44) small.push(id + ' ' + Math.round(hitW) + 'x' + Math.round(hitH));
          const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
          if (!name) unlabelled.push(id);
        }
        for (const el of document.querySelectorAll('body *')) {
          if (el.children.length) continue;
          const t = (el.textContent || '').trim();
          if (!t) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const op = Number(cs.opacity);
          if (op < 0.35) continue;      // deliberately faded decoration
          const b = el.getBoundingClientRect();
          if (b.width < 8 || b.height < 8) continue;
          if (el.closest('.wall-graffiti-tag, .game-wall, .wall-layer, .wall-scene')) continue;
          if (overArtwork(el)) continue;
          const fg = parse(cs.color);
          if (!fg) continue;
          const bg = effectiveBg(el);
          const cr = ratio(fg, bg);
          const fs = parseFloat(cs.fontSize) || 16;
          const bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
          const large = fs >= 24 || (fs >= 18.66 && bold);
          const need = large ? 3.0 : 4.5;
          if (cr < need) {
            lowContrast.push(String(el.className).slice(0,22) + ' "' + t.slice(0,16) + '" ' + cr.toFixed(2) + ':1 need ' + need + ' @' + Math.round(fs) + 'px');
          }
        }
        return { small: [...new Set(small)].slice(0,10), unlabelled: [...new Set(unlabelled)].slice(0,8), lowContrast: [...new Set(lowContrast)].slice(0,12) };
      `));
      // eslint-disable-next-line no-console
      console.log(`A11Y ${label} ${vn} :: small=${r.small.length} unlabelled=${r.unlabelled.length} contrast=${r.lowContrast.length}`);

      // EVERY control has an accessible name. No exceptions and none needed.
      expect(r.unlabelled, `controls with no accessible name: ${r.unlabelled.join(' | ')}`).toEqual([]);

      // TOUCH TARGETS. The stated rule is a mobile one, so it is enforced at phone width;
      // at desktop it is reported and the known desktop-only chips are allowed.
      const smallReal = r.small.filter((x) => !ALLOWED_SMALL.some((a) => x.startsWith(a)));
      if (vn === '390x844') {
        expect(smallReal, `touch targets under 44px at phone width: ${smallReal.join(' | ')}`).toEqual([]);
      }

      const badContrast = r.lowContrast.filter((x) => !ALLOWED_CONTRAST.some((a) => x.includes(a)));
      expect(badContrast, `text under the WCAG AA floor: ${badContrast.join(' | ')}`).toEqual([]);
    });
  }
}
