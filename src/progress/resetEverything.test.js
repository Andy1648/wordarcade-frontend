// resetEverything.test.js — Andy oct21 "ensure reset account resets everything (including unlisted gear)". The browser
// wipe takes every progress key (UNLISTED, gear, heroes, season-2 keys) and keeps only the name + settings; 058 makes the
// server reset clear the same things on its side (finds + serials, server gear, pity, showcase, rebirth log).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wipeProgressKeys } from '../save/cloudSave.js';
import { keepKey } from './keepKeys.js';

function mem(entries) {
  const m = new Map(entries);
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    keys: () => [...m.keys()].sort(),
  };
}

test('the browser wipe takes UNLISTED, gear, heroes and every season-2 key; keeps the name + settings', () => {
  const s = mem([
    ['taw.unlisted', '{"owned":{"mk-ul-og":{"serial":42}}}'],
    ['taw.markRolls', '{"v":2}'], ['taw.mark', 'mk-eclipse'],
    ['taw.s2.heroes', '["glitch"]'], ['taw.s2.xp', '{}'], ['taw.s2.playsec', '900'], ['taw.bio', 'hi'],
    ['taw.lb.secret', 'abc'], ['taw.lb.profile', '{"username":"ANDY"}'], ['taw.reduceMotion', '1'], ['taw.seenMenu', '1'],
  ]);
  const settings = s.keys().filter((k) => keepKey(k) && !['taw.lb.secret', 'taw.lb.profile'].includes(k)).map((k) => [k, s.getItem(k)]);
  wipeProgressKeys(s, ['taw.lb.secret', 'taw.lb.profile']);
  for (const [k, v] of settings) s.setItem(k, v); // resetAll.js restores the settings it snapshotted
  assert.deepEqual(s.keys(), ['taw.lb.profile', 'taw.lb.secret', 'taw.reduceMotion', 'taw.seenMenu']);
});

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '058_reset_wipes_everything.sql'), 'utf8').replace(/\r\n/g, '\n');
test('058: the server reset clears finds, server gear, pity, showcase and the rebirth log; keeps grants', () => {
  for (const t of ['public.unlisted_finds', 'private.gear_owned', 'private.roll_log', 'private.gear_refused', 'public.profile_showcase', 'public.rebirth_requests']) {
    assert.match(sql, new RegExp(`delete from ${t.replace('.', '\\.')} where profile_id = pid;`), t);
  }
  assert.match(sql, /s2_roll_seq = 0, s2_rolls = 0, s2_since_epic = 0, s2_since_leg = 0, s2_roll_spent = 0/);
  assert.match(sql, /set level = 1, rebirths = 0, stars = 0, lifetime_words = 0/);
  assert.match(sql, /length\(p_blob\) > 1048576/, 'keeps 056\'s 1 MB cloud cap');
  assert.doesNotMatch(sql, /delete from public\.season2_grants/, 'the welcome gems never pay twice');
  assert.match(sql, /grant execute on function public\.lb_reset_ack\(text, text, numeric\) to anon, authenticated;/);
  assert.match(sql, /notify pgrst, 'reload schema';\s*$/);
});
