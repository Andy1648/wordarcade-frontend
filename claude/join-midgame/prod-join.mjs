// STEP 54 J3 — two real clients against the PRODUCTION backend: A hosts a Word Bomb game (vs one
// bot), B joins by code mid-round -> must be told it is spectating, then be dealt in on the next
// turn; A plays a valid word (WB smoke). Prints a timeline; exits 1 on any failed expectation.
import fs from 'node:fs';
const URL = 'wss://chain-reaction-backend-i6kx.onrender.com';
const words = fs.readFileSync(process.argv[2], 'utf8').split(/\s+/).filter((w) => w.length >= 4 && w.length <= 8);
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1).padStart(5), ...a);
function client(name) {
  const ws = new WebSocket(URL); const q = []; const waiters = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data); q.push(m); for (const w of [...waiters]) if (w.f(m)) { waiters.splice(waiters.indexOf(w), 1); w.r(m); } };
  const send = (type, payload = {}) => ws.send(JSON.stringify({ type, payload }));
  const wait = (f, ms = 20000, from = 0) => new Promise((r, j) => { const hit = q.slice(from).find(f); if (hit) return r(hit); const w = { f, r }; waiters.push(w); setTimeout(() => j(new Error(`${name}: timeout`)), ms); });
  const open = new Promise((r) => (ws.onopen = r));
  return { ws, q, send, wait, open, name, id: null };
}
let fail = 0; const ok = (c, msg) => { log(c ? 'PASS' : 'FAIL', msg); if (!c) fail++; };
const A = client('A'), B = client('B');
await Promise.all([A.open, B.open]); log('both connected');
A.send('create_room', { name: 'QAHOST' });
const created = await A.wait((m) => m.type === 'room_created'); const code = created.payload.code; log('room', code);
A.send('add_bot', { difficulty: 'easy' }); await A.wait((m) => m.type === 'room_update' && m.payload.players?.length === 2);
A.send('start_game', {}); await A.wait((m) => m.type === 'game_started'); log('A: game_started');
await A.wait((m) => m.type === 'turn_update'); await new Promise((r) => setTimeout(r, 1500));
B.send('join_room', { code, name: 'QALATE' });
const joined = await B.wait((m) => m.type === 'room_joined' || m.type === 'error');
ok(joined.type === 'room_joined', `B joined mid-round (${joined.type}${joined.payload?.message ? ': ' + joined.payload.message : ''})`);
const gs = await B.wait((m) => m.type === 'game_started').catch(() => null); ok(!!gs, 'B received game_started (enters the game screen)');
const tu = await B.wait((m) => m.type === 'turn_update').catch(() => null);
const meName = 'QALATE';
ok(!!tu && (tu.payload.spectators || []).some((s) => s.name === meName), `B listed as spectator: ${JSON.stringify(tu?.payload?.spectators)}`);
ok(!!tu && !(tu.payload.players || []).some((p) => p.name === meName), 'B not seated mid-round');
// Next turn advance deals B in.
const dealt = await B.wait((m) => m.type === 'turn_update' && (m.payload.players || []).some((p) => p.name === meName), 45000).catch(() => null);
ok(!!dealt, `B dealt in at the next turn (players: ${dealt ? dealt.payload.players.map((p) => p.name).join(',') : '-'})`);
// WB smoke: A types a valid word on A's turn.
let played = false;
for (let i = 0; i < 6 && !played; i++) {
  const turn = await A.wait((m) => m.type === 'turn_update' && m.payload.players?.find((p) => p.id === m.payload.currentPlayerId)?.name === 'QAHOST', 45000, A.q.length).catch(() => null);
  if (!turn) break;
  const combo = (turn.payload.combo || '').toLowerCase(); const used = new Set((turn.payload.usedWords || []).map((w) => w.toLowerCase()));
  const w = words.find((x) => x.includes(combo) && !used.has(x));
  if (!w) continue;
  A.send('submit_word', { word: w, combo }); log('A submits', w, 'for', combo);
  const res = await A.wait((m) => m.type === 'word_result' && (m.payload.word || '').toLowerCase() === w, 10000).catch(() => null);
  ok(!!res && res.payload.accepted, `WB smoke: "${w}" accepted (${res ? JSON.stringify(res.payload).slice(0, 120) : 'no result'})`);
  played = true;
}
ok(played, 'A got a turn and played');
A.send('leave_room'); B.send('leave_room'); setTimeout(() => { A.ws.close(); B.ws.close(); log(fail ? `${fail} FAILED` : 'ALL PASS'); process.exit(fail ? 1 : 0); }, 500);
