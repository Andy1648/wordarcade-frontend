#!/usr/bin/env node
// s2-probes.mjs — SEASON2 constant probes on CI (econ-sims `season2` job, workflow_dispatch input s2probes): runs
// loop-sim's v3 mode once per probe with its SIM_PATCH and prints each targets table. Only the ±20% constant tuning
// of v3/econ.js is meant to go through here.
//   node claude/econ-oct2/s2-probes.mjs probes.json [hours]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const probes = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const hours = process.argv[3] || '10';
for (const p of probes) {
  let out = '';
  try {
    out = execFileSync('node', ['claude/econ-oct2/loop-sim.mjs', `--hours=${hours}`, `--tag=ci-s2-${p.name}`, '--no-masher'], {
      env: { ...process.env, SIM_SEASON2: '1', SIM_SRC: 'src', SIM_PATCH: JSON.stringify(p.patch) }, encoding: 'utf8', maxBuffer: 64 << 20,
    });
  } catch (e) {
    out = String(e.stdout || '');
  }
  const rows = out.split('\n').filter((l) => /^\|/.test(l) || /S2 HARD CHECK:|FAST pace/.test(l));
  console.log(`### probe ${p.name}\n${rows.join('\n')}\n`);
}
