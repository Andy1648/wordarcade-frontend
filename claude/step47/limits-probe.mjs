// claude/step47/limits-probe.mjs — live probe of migration 004 against the real board (anon REST).
// env: SUPA_URL (…/rest/v1), SUPA_KEY (publishable anon key). Creates rows prefixed "zqp" + random;
// prints them so the caller deletes them afterwards (and their claim_log rows).
const B = process.env.SUPA_URL.replace(/\/+$/, '');
const K = process.env.SUPA_KEY;
const H = (extra = {}) => ({ apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json', ...extra });
const rpc = async (fn, body, extra) => {
  const r = await fetch(`${B}/rpc/${fn}`, { method: 'POST', headers: H(extra), body: JSON.stringify(body) });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, msg: (j && j.message) || null, body: j };
};
const rnd = () => Math.random().toString(36).slice(2, 8);
const sec = () => Array.from({ length: 48 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
const tag = rnd();
const out = { created: [] };

// 1. per-network new-name limit: 20/hour. Fire 20 (sequential), then a 21st with SPOOFED headers.
let ok = 0, firstRefusal = null;
for (let i = 0; i < 20; i++) {
  const r = await rpc('lb_claim', { p_secret: sec(), p_username: `zqp${tag}${i}` });
  if (r.status === 200) { ok += 1; out.created.push(r.body.username); } else if (!firstRefusal) firstRefusal = `${i}:${r.status}:${r.msg}`;
}
out.claims20 = { ok, firstRefusal };
const spoof = await rpc('lb_claim', { p_secret: sec(), p_username: `zqp${tag}sp` }, { 'X-Forwarded-For': `9.${Math.floor(Math.random() * 250)}.1.1`, 'X-Real-IP': '8.8.4.4', 'CF-Connecting-IP': '1.2.3.4' });
out.spoofed21st = `${spoof.status} ${spoof.msg}`;
if (spoof.status === 200) out.created.push(spoof.body.username);
const plain = await rpc('lb_claim', { p_secret: sec(), p_username: `zqp${tag}pl` });
out.plain22nd = `${plain.status} ${plain.msg}`;
if (plain.status === 200) out.created.push(plain.body.username);

console.log(JSON.stringify(out, null, 1));
