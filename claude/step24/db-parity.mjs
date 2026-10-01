// db-parity.mjs — runs NAME_VECTORS through the LIVE database filter (public.username_is_clean via the
// anon REST API) and the client filter; prints any disagreement. usage:
//   VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node claude/step24/db-parity.mjs
import { NAME_VECTORS } from '../../src/leaderboard/nameVectors.js';
import { isNameBlocked } from '../../src/leaderboard/nameFilter.js';
const URL = process.env.VITE_SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
let bad = 0;
for (const [name, blocked] of NAME_VECTORS) {
  const r = await fetch(`${URL}/rest/v1/rpc/username_is_clean`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ u: name }) });
  const dbBlocked = !(await r.json());
  const js = isNameBlocked(name);
  if (dbBlocked !== blocked || js !== blocked) { bad++; console.log(`MISMATCH ${name}: expected ${blocked} db ${dbBlocked} js ${js}`); }
}
console.log(`${NAME_VECTORS.length} vectors, ${bad} mismatches`);
process.exit(bad ? 1 : 0);
