// Validates blitzCanon.json against the backend's blitzLists.json.
// Rules: every category present; every canon/alias verbatim in that category's answers;
// every answer used exactly once; canon non-empty; aliases an array; no extra categories.
// Usage: node claude/batch-a/ba1/blitzCanon-check.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const LISTS = process.env.BLITZ_LISTS || 'C:/Users/andyw_tnc0kix/Downloads/chain-reaction-backend/blitzLists.json';
const lists = JSON.parse(fs.readFileSync(LISTS, 'utf8'));
const canon = JSON.parse(fs.readFileSync(path.join(here, 'blitzCanon.json'), 'utf8'));
let failures = 0;
const fail = (cat, msg) => { failures++; console.log(`FAIL [${cat}] ${msg}`); };
const names = new Set(lists.map(c => c.name));
for (const k of Object.keys(canon)) if (!names.has(k)) fail(k, 'category not in blitzLists.json');
let totalMembers = 0, totalAnswers = 0, totalAliases = 0;
for (const c of lists) {
  const mem = canon[c.name];
  if (!Array.isArray(mem)) { fail(c.name, 'missing or not an array'); continue; }
  const ans = new Set(c.answers);
  const count = new Map();
  let aliasN = 0;
  mem.forEach((m, i) => {
    if (!m || typeof m.canon !== 'string' || !m.canon) { fail(c.name, `member ${i} has no canon`); return; }
    if (!Array.isArray(m.aliases)) { fail(c.name, `member ${i} (${m.canon}) aliases not an array`); return; }
    const extraKeys = Object.keys(m).filter(k => k !== 'canon' && k !== 'aliases');
    if (extraKeys.length) fail(c.name, `member ${m.canon} has extra keys ${extraKeys}`);
    for (const s of [m.canon, ...m.aliases]) {
      if (typeof s !== 'string') { fail(c.name, `non-string entry in ${m.canon}`); continue; }
      if (!ans.has(s)) fail(c.name, `"${s}" is not verbatim in answers`);
      count.set(s, (count.get(s) || 0) + 1);
    }
    aliasN += m.aliases.length;
  });
  for (const [s, n] of count) if (n > 1) fail(c.name, `"${s}" appears ${n} times`);
  const missing = c.answers.filter(a => !count.has(a));
  if (missing.length) fail(c.name, `${missing.length} answers unassigned: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' ...' : ''}`);
  if (new Set(c.answers).size !== c.answers.length) console.log(`note [${c.name}] answers list itself has duplicates`);
  totalMembers += mem.length; totalAnswers += c.answers.length; totalAliases += aliasN;
  console.log(`${c.name}: ${mem.length} members, ${aliasN} aliases, ${c.answers.length} answers`);
}
console.log(`\n${lists.length} categories, ${totalMembers} members, ${totalAliases} aliases, ${totalAnswers} answers`);
if (failures) { console.log(`FAILED: ${failures} problem(s)`); process.exit(1); }
console.log('PASS: every answer assigned exactly once, all strings verbatim');
