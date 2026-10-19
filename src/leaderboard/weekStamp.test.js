// 056: the week-rollover trigger must never declare a PL/pgSQL variable named like a column it writes in SQL —
// 034's `wk` clashed with private.s2_week_final.wk (42702 ambiguous), which failed every first-of-the-week board write.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'supabase', 'migrations');
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

function latestBody(fn) {
  let body = null;
  for (const f of files) {
    const sql = readFileSync(join(DIR, f), 'utf8');
    const at = sql.indexOf(`create or replace function ${fn}(`);
    if (at < 0) continue;
    body = sql.slice(at, sql.indexOf('$$;', at));
  }
  return body;
}

test('lb_s2_week_stamp (latest) declares no variable named wk', () => {
  const body = latestBody('private.lb_s2_week_stamp');
  assert.ok(body, 'lb_s2_week_stamp is defined');
  const decl = body.slice(body.indexOf('declare'), body.indexOf('begin'));
  assert.ok(!/\bwk\b/.test(decl), 'a `wk` variable is ambiguous with s2_week_final.wk');
  assert.ok(body.includes('on conflict (wk, profile_id)'), 'still snapshots the week being left');
});
