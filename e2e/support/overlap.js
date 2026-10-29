// e2e/support/overlap.js — the OVERLAP AUDIT's in-page layout check (oct29), as a spec helper. It walks the visible
// text inside `scope` (default: the whole page) plus the controls / meaningful images, and reports:
//   * overlaps  — two unrelated text runs / controls / alt-images intersecting, where the one on top is really on top at
//                 that point (elementsFromPoint) and no big scrim sits between them;
//   * spills    — text running out of the nearest bordered card around it (a ≥ 3px border), or out of an
//                 overflow:hidden / clip ancestor (clipped);
//   * offscreen — text past the viewport's left / right edge outside a horizontal scroller;
//   * hscroll   — the page scrolls sideways.
// Text clipped AWAY by a scroller / by its own overflow (ellipsis) only counts for the part that is visible. Decorative
// layers (pointer-events:none outside a control) and aria-hidden / sr-only text are skipped — the same rules the audit's
// screenshots were reviewed by. Returns { overlaps, spills, offscreen, hscroll }; a clean screen is all empty / false.
export async function layoutDefects(page, { scope = 'body', tol = 2 } = {}) {
  return page.evaluate(({ scope, TOL }) => {
    const root = document.querySelector(scope) || document.body;
    const VW = innerWidth, VH = innerHeight;
    const se = document.scrollingElement || document.documentElement;
    const out = { overlaps: [], spills: [], offscreen: [], hscroll: se.scrollWidth > VW + 1 };
    const csC = new Map();
    const cs = (el) => { let c = csC.get(el); if (!c) { c = getComputedStyle(el); csC.set(el, c); } return c; };
    const hidC = new Map();
    const hidden = (el) => {
      if (!el || el === document.documentElement) return false;
      if (hidC.has(el)) return hidC.get(el);
      const c = cs(el);
      const h = c.display === 'none' || c.visibility === 'hidden' || Number(c.opacity) < 0.05 || (el.getAttribute && el.getAttribute('aria-hidden') === 'true') || hidden(el.parentElement);
      hidC.set(el, h);
      return h;
    };
    const srOnly = (el) => {
      for (let a = el, d = 0; a && a !== document.body && d < 4; a = a.parentElement, d++) {
        const c = cs(a); const r = a.getBoundingClientRect();
        if ((c.clip && c.clip !== 'auto') || /inset\(50%/.test(c.clipPath) || ((r.width <= 2 || r.height <= 2) && /(hidden|clip)/.test(c.overflowX + c.overflowY))) return true;
      }
      return false;
    };
    const decor = (el) => cs(el).pointerEvents === 'none' && !el.closest('button,a,[role=button],input,label');
    const desc = (el) => {
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
      const t = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('alt') || '').replace(/\s+/g, ' ').trim().slice(0, 30);
      return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${t ? ` "${t}"` : ''}`;
    };
    const inter = (a, b) => {
      const l = Math.max(a.left, b.left), r = Math.min(a.right, b.right), t = Math.max(a.top, b.top), bt = Math.min(a.bottom, b.bottom);
      return r - l > 0 && bt - t > 0 ? { left: l, right: r, top: t, bottom: bt, width: r - l, height: bt - t } : null;
    };
    // the part of a rect visible through its own clip and every clipping ancestor (null = clipped away)
    const visible = (el, r, self = false) => {
      const v = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      for (let a = self ? el : el.parentElement; a && a !== document.body; a = a.parentElement) {
        const c = cs(a);
        const cx = c.overflowX !== 'visible', cy = c.overflowY !== 'visible';
        if (cx || cy) {
          const A = a.getBoundingClientRect();
          if (cx) { v.left = Math.max(v.left, A.left); v.right = Math.min(v.right, A.right); }
          if (cy) { v.top = Math.max(v.top, A.top); v.bottom = Math.min(v.bottom, A.bottom); }
          if (v.right - v.left < 1 || v.bottom - v.top < 1) return null;
        }
        if (c.position === 'fixed') break;
      }
      v.width = v.right - v.left; v.height = v.bottom - v.top;
      return v;
    };
    const scroller = (el, axis) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const c = cs(a);
        if (/(auto|scroll)/.test(axis === 'x' ? c.overflowX : c.overflowY)) return a;
      }
      return null;
    };
    // text leaves: one entry per element, its own text line boxes (trimmed 18% top/bottom: the glyphs, not the leading)
    const leaves = new Map();
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.nodeValue.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest('svg,script,style,noscript') || hidden(el) || srOnly(el)) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      const rects = [...rg.getClientRects()].filter((r) => r.width > 1 && r.height > 1).map((r) => { const k = r.height * 0.18; return { left: r.left, right: r.right, top: r.top + k, bottom: r.bottom - k, width: r.width, height: r.height - 2 * k }; });
      if (!rects.length) continue;
      if (!leaves.has(el)) leaves.set(el, []);
      leaves.get(el).push(...rects);
    }
    const items = [];
    for (const [el, rects] of leaves) {
      if (decor(el)) continue;
      // an ellipsised / self-clipped run counts only for what shows
      const vis = rects.map((r) => visible(el, r, true)).filter(Boolean);
      if (!vis.length) continue;
      const vb = vis.reduce((b, r) => ({ left: Math.min(b.left, r.left), top: Math.min(b.top, r.top), right: Math.max(b.right, r.right), bottom: Math.max(b.bottom, r.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
      if (!scroller(el, 'x') && (vb.left < -TOL || vb.right > VW + TOL)) out.offscreen.push(`${desc(el)} [${Math.round(vb.left)}..${Math.round(vb.right)}] past the ${VW}px viewport`);
      // spill: out of the nearest bordered card (≤ 6 up) or out of a clipping ancestor
      for (let a = el.parentElement, d = 0; a && a !== document.body && d < 6; a = a.parentElement, d++) {
        const c = cs(a);
        if (/(auto|scroll)/.test(c.overflowX + c.overflowY)) break;
        const clips = /(hidden|clip)/.test(c.overflowX + c.overflowY);
        const bordered = parseFloat(c.borderTopWidth) + parseFloat(c.borderLeftWidth) >= 3 && c.borderTopStyle !== 'none';
        if (!clips && !bordered) continue;
        const A = a.getBoundingClientRect();
        const dd = Math.max(A.left - vb.left, vb.right - A.right, A.top - vb.top, vb.bottom - A.bottom);
        if (dd > TOL + 1) out.spills.push(`${desc(el)} ${clips ? 'clipped by' : 'spills out of'} ${desc(a)} by ${Math.round(dd)}px`);
        break;
      }
      items.push({ el, rects: vis });
    }
    for (const el of root.querySelectorAll('button, a[href], input, select, textarea, [role=button], [role=tab], img[alt]:not([alt=""])')) {
      if (hidden(el) || decor(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || (el.tagName === 'IMG' && (r.width < 20 || r.height < 20))) continue;
      const v = visible(el, r);
      if (v) items.push({ el, rects: [v] });
    }
    const rel = (a, b) => a === b || a.contains(b) || b.contains(a);
    const seen = new Set();
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const A = items[i], B = items[j];
        if (rel(A.el, B.el)) continue;
        const ac = A.el.closest('button,a,[role=button],[role=tab]'), bc = B.el.closest('button,a,[role=button],[role=tab]');
        if ((ac && ac === bc) || (ac && rel(ac, B.el)) || (bc && rel(bc, A.el))) continue;
        let best = null;
        for (const ra of A.rects) for (const rb of B.rects) { const x = inter(ra, rb); if (x && (!best || x.width * x.height > best.width * best.height)) best = x; }
        if (!best || best.width < 3 || best.height < 3) continue;
        const small = Math.min(...[A, B].map((it) => Math.min(...it.rects.map((r) => r.width * r.height))));
        if (best.width * best.height < Math.max(12, 0.08 * small)) continue;
        const px = best.left + best.width / 2, py = best.top + best.height / 2;
        if (px < 0 || py < 0 || px > VW || py > VH) continue;
        const stack = document.elementsFromPoint(px, py);
        if (!stack[0]) continue;
        const onA = rel(stack[0], A.el) || (ac && rel(stack[0], ac));
        const onB = rel(stack[0], B.el) || (bc && rel(stack[0], bc));
        if (!onA && !onB) continue; // something else (a modal) covers both
        const under = onA ? B : A;
        const iu = stack.findIndex((s) => rel(s, under.el));
        if (iu < 0) continue;
        let scrim = false;
        for (let k = 0; k < iu; k++) {
          const s = stack[k];
          if (s.contains(under.el)) continue;
          const r = s.getBoundingClientRect();
          if (r.width * r.height < 0.25 * VW * VH) continue;
          const c = cs(s);
          const m = c.backgroundColor.match(/rgba?\(([^)]+)\)/);
          const alpha = m ? (m[1].split(',')[3] !== undefined ? parseFloat(m[1].split(',')[3]) : 1) : 0;
          if (alpha > 0.25 || c.backgroundImage !== 'none') { scrim = true; break; }
        }
        if (scrim) continue;
        const key = `${desc(A.el)} × ${desc(B.el)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.overlaps.push(`${key} (${Math.round(best.width)}x${Math.round(best.height)})`);
      }
    }
    return out;
  }, { scope, TOL: tol });
}

/** Asserts a clean screen: no overlaps, spills, off-screen text or sideways scroll. `label` names the screen + size. */
export async function expectNoLayoutDefects(expect, page, label, opts) {
  const d = await layoutDefects(page, opts);
  expect.soft(d.overlaps, `${label}: overlapping text / controls`).toEqual([]);
  expect.soft(d.spills, `${label}: text spilling out of its card`).toEqual([]);
  expect.soft(d.offscreen, `${label}: text past the viewport`).toEqual([]);
  expect(d.hscroll, `${label}: the page scrolls sideways`).toBe(false);
}
