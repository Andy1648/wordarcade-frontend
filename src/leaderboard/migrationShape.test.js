// Every DB entry point that checks a username's SHAPE must agree with the newest shape rule.
// Found on prod (Oct 2): 005 allowed CJK in the constraint + lb_name_status, but lb_claim (from 004)
// still refused it, so a Chinese name passed the name check and failed on CLAIM. 008 fixes lb_claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'supabase', 'migrations');
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
const CJK = '[A-Za-z0-9_㐀-䶿一-鿿]{2,12}';

/** The body of the LAST migration that (re)defines `fn`. */
function latestBody(fn) {
  let body = null;
  for (const f of files) {
    const sql = readFileSync(join(DIR, f), 'utf8');
    const at = sql.indexOf(`create or replace function public.${fn}(`);
    if (at < 0) continue;
    const end = sql.indexOf('$$;', at);
    body = sql.slice(at, end);
  }
  return body;
}

for (const fn of ['lb_claim', 'lb_name_status']) {
  test(`${fn} (latest definition) accepts CJK names like the profiles constraint`, () => {
    const body = latestBody(fn);
    assert.ok(body, `${fn} is defined in a migration`);
    assert.ok(body.includes(CJK), `${fn} carries the CJK shape`);
  });
}
