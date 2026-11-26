// e2e/support/noClip.js — the LANGUAGE RUSH fit rule (nov24): every element that prints its own text shows all of
// it — not cut by a box that hides overflow, not past the screen edge — the page never scrolls, no text under 11px,
// and the cover title stays inside its page. Lists that scroll by design are exempt from the off-screen check.
import { expect } from '@playwright/test';

export const LISTS = ['.sr-bank-list', '.sr-brief-list', '.sr-casefile', '.sr-lineup', '.fr-class-chips', '.fr-class-summary', '.fr-pick-list'];

// CLIPPING: any element that prints its own text must show all of it — not wider/taller than a box that hides
// overflow, and not past the screen edge. Plus the French Rush fit rules: no page scroll, no text under 11px.
export async function noClip(page, where, { soft = false } = {}) {
  const bad = await page.evaluate((lists) => {
    const out = [];
    const se = document.scrollingElement;
    if (se.scrollHeight > window.innerHeight + 1 || se.scrollWidth > window.innerWidth + 1) out.push(`page scrolls ${se.scrollWidth}x${se.scrollHeight}`);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    for (const el of document.querySelectorAll('#root *')) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
      if (el.closest('[aria-hidden="true"]')) continue; // decorative stamps (a ruled-out choice's NON band) are meant to overhang
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue; // empty, or a screen-reader-only label
      const inList = lists.some((s) => el.closest(s));
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!ownText) continue;
      const label = `"${el.textContent.trim().slice(0, 40)}" (${String(el.className).slice(0, 40)})`;
      if (parseFloat(cs.fontSize) < 11) out.push(`${parseFloat(cs.fontSize)}px text: ${label}`);
      // a WORD broken across lines ("ESPAÑO / L"): more printed lines than the text has words
      for (const n of el.childNodes) {
        if (n.nodeType !== 3 || !n.textContent.trim()) continue;
        const t = n.textContent.trim();
        if (/[㐀-鿿]/.test(t) && t.length > 6) continue; // a Chinese sentence wraps between characters by design
        const words = t.split(/[\s\-‐]+/).length; // a hyphen is a fair place to wrap (great-grand / father)
        const rg = document.createRange();
        rg.selectNodeContents(n);
        const tops = new Set([...rg.getClientRects()].filter((q) => q.width > 1).map((q) => Math.round(q.top)));
        if (tops.size > words) out.push(`word broken across lines: ${label}`);
      }
      const hidesX = /(hidden|clip)/.test(cs.overflowX) || cs.textOverflow === 'ellipsis';
      const hidesY = /(hidden|clip)/.test(cs.overflowY);
      if (hidesX && el.scrollWidth > el.clientWidth + 1) out.push(`cut off sideways: ${label} ${el.scrollWidth}>${el.clientWidth}`);
      if (hidesY && el.scrollHeight > el.clientHeight + 2) out.push(`cut off below: ${label} ${el.scrollHeight}>${el.clientHeight}`);
      if (!inList && (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1)) out.push(`off screen: ${label} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
      // an ancestor that hides overflow and cuts this text off
      for (let a = el.parentElement; a && a.id !== 'root'; a = a.parentElement) {
        if (lists.some((s) => a.matches(s))) break; // a list scrolls by design: its rows may sit below the fold
        const acs = getComputedStyle(a);
        if (!/(hidden|clip)/.test(acs.overflowX + acs.overflowY)) continue;
        const ar = a.getBoundingClientRect();
        if (r.left < ar.left - 1 || r.right > ar.right + 1 || r.bottom > ar.bottom + 2 || r.top < ar.top - 2) out.push(`cut off by ${String(a.className).slice(0, 30)}: ${label}`);
        break;
      }
    }
    // the cover title must sit inside its page (a longer language name must not run past the frame)
    const title = document.querySelector('.sr-cover .sr-title');
    if (title) {
      const range = document.createRange();
      range.selectNodeContents(title);
      const t = range.getBoundingClientRect(); // the printed letters, not the box
      const c = title.closest('.sr-cover').getBoundingClientRect();
      if (t.left < c.left - 1 || t.right > c.right + 1) out.push(`title runs past the page: ${Math.round(t.left)}..${Math.round(t.right)} vs ${Math.round(c.left)}..${Math.round(c.right)}`);
    }
    return out;
  }, LISTS);
  (soft ? expect.soft : expect)(bad, where).toEqual([]);
}

