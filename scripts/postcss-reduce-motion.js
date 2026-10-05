// scripts/postcss-reduce-motion.js — build-time PostCSS plugin (wired in vite.config.js css.postcss).
//
// THE APP NO LONGER FOLLOWS THE OS MOTION SETTING. Managed school Chromebooks report
// `prefers-reduced-motion: reduce` by policy, which switched off nearly every animation for players
// who never asked. Reduce motion is now an in-game toggle (src/lib/reduceMotion.js) that sets
// `data-reduce-motion` on <html>. This plugin moves every motion media query onto that attribute, so
// the ~110 hand-written reduced-motion blocks keep EXACTLY their current styling — they just switch on
// the toggle instead of the OS:
//
//   @media (prefers-reduced-motion: reduce) { .a { animation: none } }
//     → :where([data-reduce-motion]) .a { animation: none }
//   @media (prefers-reduced-motion: no-preference) { .a { … } }
//     → :where(:root:not([data-reduce-motion])) .a { … }
//   html[data-beat] .x  → html:where([data-reduce-motion])[data-beat] .x   (merged into the html/:root compound)
//   @media (max-width: 480px) and (prefers-reduced-motion: reduce) { … }
//     → @media (max-width: 480px) { <scoped rules> }  (only the motion feature is dropped)
//
// The scope is wrapped in :where() so it adds ZERO specificity: each rule competes in the cascade
// exactly as it did inside the media query (an @media block adds no specificity either).
//
// Handled: nested at-rules inside the block (@supports/@media — their rules are scoped too),
// @keyframes inside the block (kept as-is: they are inert until referenced, and only the scoped rules
// reference them), a motion query nested inside a style rule (CSS nesting: bare declarations are
// wrapped in `:where(…) &`), and nested motion queries (a rule is scoped once). A media list that
// can't be expressed as a selector scope (a `not` query, mixed reduce/no-preference, or a list where
// only SOME queries test motion) fails the build loudly rather than silently changing behaviour.

const FEATURE_RE = /\(\s*prefers-reduced-motion\s*(?::\s*([a-z-]+)\s*)?\)/i;
const ATTR = 'data-reduce-motion';

/** Split a media query list on top-level commas. */
function splitQueries(params) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of params) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/**
 * Pull the motion feature out of a media param string.
 * @returns {{ mode: 'reduce'|'no-preference', params: string } | null} null = no motion feature.
 */
export function splitMotionQuery(params) {
  if (!FEATURE_RE.test(params)) return null;
  let mode = null;
  const rest = [];
  for (const q of splitQueries(params)) {
    const m = q.match(FEATURE_RE);
    if (!m) throw new Error(`reduce-motion: media list mixes motion and non-motion queries: "${params}"`);
    if (/^\s*not\b/i.test(q) || /\bor\b/i.test(q)) {
      throw new Error(`reduce-motion: cannot scope a "not"/"or" motion query: "${params}"`);
    }
    const value = (m[1] || 'reduce').toLowerCase(); // boolean form (prefers-reduced-motion) == reduce
    if (value !== 'reduce' && value !== 'no-preference') {
      throw new Error(`reduce-motion: unknown prefers-reduced-motion value "${value}"`);
    }
    if (mode && mode !== value) throw new Error(`reduce-motion: mixed reduce/no-preference list: "${params}"`);
    mode = value;
    const MARK = '\u0000';
    const r = q
      .replace(FEATURE_RE, MARK)
      .replace(new RegExp(`\\s+and\\s+${MARK}`, 'i'), '')
      .replace(new RegExp(`${MARK}\\s+and\\s+`, 'i'), '')
      .replace(MARK, '')
      .trim();
    rest.push(r);
  }
  // Any query left empty was "motion only" — in an OR list that makes the whole list unconditional.
  return { mode, params: rest.some((r) => r === '' || /^(only\s+)?all$/i.test(r)) ? '' : rest.join(', ') };
}

// The ancestor scope. Only <html> ever carries the attribute, so the reduce scope needs no `:root`
// (5 bytes x every selector on the boot stylesheet); the no-preference scope MUST keep it, or
// `:not([attr])` would match any ancestor at all.
const SCOPE = { reduce: `:where([${ATTR}])`, 'no-preference': `:where(:root:not([${ATTR}]))` };

/** Scope ONE selector to the attribute state. */
export function scopeSelector(selector, mode) {
  const cond = mode === 'reduce' ? `[${ATTR}]` : `:not([${ATTR}])`;
  const s = selector.trim();
  // Already rooted at <html>: merge into that compound instead of adding a descendant hop.
  const root = s.match(/^(html|:root)(?![\w-])/i);
  if (root) return `${root[1]}:where(${cond})${s.slice(root[1].length)}`;
  // A pseudo-element of the root (::view-transition-*): attach directly, no descendant combinator.
  if (s.startsWith('::')) return `:where(:root${cond})${s}`;
  return `${SCOPE[mode]} ${s}`;
}

// Single-colon spellings that are really pseudo-elements (not allowed inside :is()).
const LEGACY_PSEUDO_EL = /:(before|after|first-line|first-letter|marker|placeholder|selection|backdrop)(?![\w-])/i;

/**
 * Specificity [ids, classes, types] of a SIMPLE selector, or null when it isn't simple enough to be
 * sure (functional pseudos, pseudo-elements, nesting, root-anchored) — those are never grouped.
 */
export function simpleSpecificity(sel) {
  const s = sel.trim();
  if (/[()&\\]|::/.test(s) || LEGACY_PSEUDO_EL.test(s) || /^(html|:root)(?![\w-])/i.test(s)) return null;
  const noAttr = s.replace(/\[[^\]]*\]/g, '.x'); // an attribute selector weighs as a class
  const ids = (noAttr.match(/#[\w-]+/g) || []).length;
  const classes = (noAttr.match(/[.:][\w-]+/g) || []).length;
  const types = noAttr
    .split(/[\s>+~]+/)
    .filter((c) => /^[a-z][\w-]*/i.test(c)).length;
  return [ids, classes, types];
}

/**
 * Scope a selector LIST. Selectors with identical (simple) specificity share ONE scope:
 *   `.a, .b > .c`  →  `:where([data-reduce-motion]) :is(.a,.b > .c)`
 * which matches exactly the same elements with exactly the same specificity (`:is()` takes the
 * specificity of its most specific argument, and they are all equal). It keeps the boot stylesheet
 * from paying the scope's bytes once per selector. Everything else is scoped one by one.
 */
export function scopeSelectors(selectors, mode) {
  const groups = new Map();
  const out = [];
  for (const sel of selectors) {
    const spec = simpleSpecificity(sel);
    if (!spec) {
      out.push(scopeSelector(sel, mode));
      continue;
    }
    const key = spec.join(',');
    if (!groups.has(key)) {
      groups.set(key, []);
      out.push(key); // placeholder keeps the group at its first member's position
    }
    groups.get(key).push(sel.trim());
  }
  return out.map((x) => {
    const g = groups.get(x);
    if (!g) return x;
    return g.length === 1 ? scopeSelector(g[0], mode) : `${SCOPE[mode]} :is(${g.join(',')})`;
  });
}

function insideKeyframes(node, stop) {
  for (let p = node.parent; p && p !== stop; p = p.parent) {
    if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return true;
  }
  return false;
}

function insideRule(node, stop) {
  for (let p = node.parent; p && p !== stop; p = p.parent) if (p.type === 'rule') return true;
  return false;
}

function hasRuleAncestor(node) {
  for (let p = node.parent; p; p = p.parent) if (p.type === 'rule') return true;
  return false;
}

export default function reduceMotionScope() {
  return {
    postcssPlugin: 'taw-reduce-motion-scope',
    Once(root, { Rule }) {
      const targets = [];
      root.walkAtRules('media', (at) => {
        if (FEATURE_RE.test(at.params)) targets.push(at);
      });
      const scoped = new WeakSet();
      // Innermost first (reverse document order), so a nested motion query is resolved before its parent.
      for (const at of targets.reverse()) {
        const split = splitMotionQuery(at.params);
        if (!split) continue;
        const { mode } = split;
        // Rules directly in (or under non-rule at-rules in) the block get the scope.
        const nested = hasRuleAncestor(at);
        at.walkRules((rule) => {
          if (scoped.has(rule) || insideKeyframes(rule, at) || insideRule(rule, at)) return;
          // Inside a style rule a relative selector `.b` means `& .b`: make the & explicit so the
          // scope lands ABOVE the parent, not between it and `.b`.
          const sels = rule.selectors.map((s) => (nested && !s.includes('&') ? `& ${s.trim()}` : s));
          rule.selectors = scopeSelectors(sels, mode);
          scoped.add(rule);
        });
        // A motion query nested INSIDE a style rule (CSS nesting) carries bare declarations.
        if (nested) {
          const decls = at.nodes.filter((n) => n.type === 'decl');
          if (decls.length) {
            const wrap = new Rule({ selector: scopeSelector('&', mode) });
            scoped.add(wrap);
            decls[0].before(wrap);
            for (const d of decls) wrap.append(d);
          }
        }
        if (split.params) at.params = split.params;
        else if (at.nodes && at.nodes.length) at.replaceWith(at.nodes);
        else at.remove();
      }
    },
  };
}
reduceMotionScope.postcss = true;
