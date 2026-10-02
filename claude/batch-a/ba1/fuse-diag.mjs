// fuse-diag.mjs — BA1 diagnostic: what steering serves for the last dark letters, and how many
// median-known (top 15k) words actually light the letter for each lead fragment.
import { imp, loadWords } from './solo-common.mjs';
const { createFuseEngine, STEER_FROM } = await imp('solo/fuse.js');
const { accept, pools, recall } = loadWords();
const known = recall.slice(0, +(process.env.VOCAB || 15000));
const e = createFuseEngine({ accept, pools });
for (const ch of 'zjxqkvwyb') {
  const lead = e.fragmentsLeadingTo(ch);
  const rows = [];
  let good = 0, tot = 0;
  for (const t of ['e', 'm', 'h', 'b']) for (const f of lead[t]) {
    const withF = known.filter((w) => w.length >= 3 && w.includes(f));
    const withBoth = withF.filter((w) => w.includes(ch));
    tot++; if (withBoth.length >= 3) good++;
    rows.push(`${t}:${f} ${withBoth.length}/${withF.length}`);
  }
  const share = (rows.length ? rows.map(r=>{const m=r.match(/ (\d+)\/(\d+)/);return +m[2]?(+m[1]/+m[2]):0}).reduce((a,b)=>a+b,0)/rows.length : 0);
  console.log(`${ch}: leads=${tot} with>=3 known lighting words=${good}  mean P(random known answer lights ${ch})=${(100*share).toFixed(1)}%`);
  console.log('   ', rows.slice(0, 40).join('  '));
}
