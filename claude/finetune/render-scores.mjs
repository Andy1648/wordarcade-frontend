// render-scores.mjs — rebuilds the table in scores.md from scores.json (one column per pass).
import fs from 'fs';
const S = JSON.parse(fs.readFileSync('claude/finetune/scores.json', 'utf8'));
const passes = Object.keys(S);
const screens = Object.keys(S[passes[0]]).sort();
const avg = (p) => (Object.values(S[p]).reduce((a, b) => a + b, 0) / Object.values(S[p]).length).toFixed(2);
let t = `| screen | ${passes.join(' | ')} |\n|---|${passes.map(() => '---').join('|')}|\n`;
for (const s of screens) t += `| ${s} | ${passes.map((p) => S[p][s] ?? '').join(' | ')} |\n`;
t += `| **AVERAGE** | ${passes.map((p) => `**${avg(p)}**`).join(' | ')} |\n`;
const md = fs.readFileSync('claude/finetune/scores.md', 'utf8');
fs.writeFileSync('claude/finetune/scores.md', md.replace(/<!-- table -->[\s\S]*<!-- \/table -->/, `<!-- table -->\n${t}<!-- /table -->`));
console.log(t);
