// gen-080.mjs — writes supabase/migrations/080_new_gears_2.sql from the GAME (the pool rows in order + 061's gear_luck at
// season-2 sizes), the same way serverRolls.test / serverLuckCap.test read them. node claude/gen-080.mjs
import { writeFileSync } from 'node:fs';
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k), clear: () => mem.clear(), key: (i) => [...mem.keys()][i] ?? null, get length() { return mem.size; } };
globalThis.location = { search: '?season2=1' };
await import('../src/progress/season.js');
await import('../src/progress/v3/install.js');
const C = await import('../src/progress/markRollsCore.js');
const { UNLISTED_IDS } = await import('../src/unlisted/unlistedIds.js');
const luck0 = (id) => { const st = C.statOf(id, null); return (st && st.kind === 'luckPct' ? st.value : 0) + C.substatsOf(id, null).filter((x) => x.kind === 'luckPct').reduce((s, x) => s + x.value, 0); };
const ALL = [...C.ROLL_MARKS.map((m) => m.id), ...C.PERMANENT_MARKS.map((m) => m.id), ...UNLISTED_IDS];
const pool = C.ROLL_MARKS.map((m, i) => `  ('${m.id}', '${m.tier}', ${m.x}, ${i + 1})`).join(',\n');
const luck = ALL.filter((id) => luck0(id) > 0).map((id) => `  ('${id}', ${luck0(id)})`).join(',\n');
const n = (t) => C.ROLL_MARKS.filter((m) => m.tier === t).length;
const x = (t) => C.ROLL_MARKS.find((m) => m.tier === t).x;
const sql = `-- 080_new_gears_2.sql - NEW GEARS batch 2 (nov3, "bombs, newgrounds energy"): 5 new gears re-seed the server pool.
--   * 3 RARE (CHERRY BOMB, SPRAY CAN, POPCORN) + 1 MYTHIC (PINATA) + 1 SECRET (MEGATON), on the last free stat slots.
--   * TIER ODDS UNCHANGED: each tier's odds split over more gears (each RARE now 1 in ${x('rare').toFixed(1)}, each MYTHIC 1 in
--     ${x('mythic')}, each SECRET 1 in ${x('secret')}); EPIC and LEGENDARY are untouched.
--   * private.gear_pool is re-seeded (pick_gear / pity / tickets read it), and private.gear_luck (061's per-account luck cap)
--     is refreshed: CHERRY BOMB / PINATA / MEGATON carry ROLL LUCK substats, so their owners are never clamped.
-- ORDER: run 079 first (if not yet run), then THIS SQL, then merge the PR. serverRolls.test + serverLuckCap.test pin it.
-- HOW: Supabase > SQL editor > New query > paste the WHOLE file > Run. Safe to re-run. ASCII only.
-- WRITE-ONLY: Claude never runs migrations.

truncate private.gear_pool;
insert into private.gear_pool (mark_id, tier, x, ord) values
${pool};

-- ---- 061's gear_luck table, with the nov3 gears, season 2 sizes (luck_cap reads it; the function is unchanged)
truncate private.gear_luck;
insert into private.gear_luck (mark_id, luck_pct) values
${luck};
`;
writeFileSync('supabase/migrations/080_new_gears_2.sql', sql);
console.log('080 written', C.ROLL_MARKS.length, 'gears', n('rare'), n('mythic'), n('secret'));
