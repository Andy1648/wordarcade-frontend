// check-ld-json.mjs — JSON.parse every <script type="application/ld+json"> block in index.html; exit 1 on any failure.
// Usage: node scripts/check-ld-json.mjs [file=index.html]
import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'index.html';
const html = readFileSync(file, 'utf8');
const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
if (!blocks.length) {
  console.error(`${file}: no ld+json block`);
  process.exit(1);
}
let bad = 0;
blocks.forEach((b, i) => {
  try {
    const j = JSON.parse(b);
    const types = (j['@graph'] || [j]).map((n) => n['@type']).join(', ');
    console.log(`${file} block ${i + 1}: ok (${types})`);
  } catch (e) {
    bad += 1;
    console.error(`${file} block ${i + 1}: ${e.message}`);
  }
});
process.exit(bad ? 1 : 0);
