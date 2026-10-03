#!/bin/bash
# compare.sh BEFORE_SRC AFTER_SRC TAG [SEEDS]  — rule P (Andy oct2 22:25): an economy change merges only if
# no window gets worse. Runs loop-sim on both trees for SEEDS seeds (default 5) and compares the MEAN of
# every window metric (gap max, KEY eta, shop eta) per skill, plus runaway fails. Lower is better.
B="$1"; A="$2"; TAG="$3"; N="${4:-5}"; D="$(dirname "$0")"
for s in $(seq 0 $((N-1))); do
  SIM_SEED=$s SIM_SRC="$B" node "$D/loop-sim.mjs" --tag="$TAG-b$s" > /dev/null 2>&1
  SIM_SEED=$s SIM_SRC="$A" node "$D/loop-sim.mjs" --tag="$TAG-a$s" > /dev/null 2>&1
done
python - "$D" "$TAG" "$N" <<'PY'
import json,sys,statistics as st
D,TAG,N=sys.argv[1],sys.argv[2],int(sys.argv[3])
def load(k):
    out={}
    for s in range(N):
        d=json.load(open(f'{D}/loop-sim-{TAG}-{k}{s}.json'))
        for r in d['results']:
            sk=r['skill'] if isinstance(r['skill'],str) else r['skill'].get('id')
            for w,v in r['perWindow'].items():
                for m in ('maxGapMin','worstKeyEtaMin','worstShopEtaMin'):
                    if v.get(m) is not None: out.setdefault((sk,w,m),[]).append(v[m])
            out.setdefault((sk,'all','runawayFails'),[]).append(r['runaway']['failCount'])
    return {k:st.mean(v) for k,v in out.items()}
b,a=load('b'),load('a'); worse=[]
print(f'{"skill":8}{"window":7}{"metric":17}{"before":>10}{"after":>10}')
for k in sorted(b):
    if k not in a: continue
    flag=''
    if a[k] > b[k]*1.0 + 1e-9: flag='  WORSE'; worse.append(k)
    print(f'{k[0]:8}{k[1]:7}{k[2]:17}{b[k]:10.2f}{a[k]:10.2f}{flag}')
print('\nWORSE windows:', len(worse)); print('VERDICT:', 'MERGE' if not worse else 'HOLD (rule P)')
PY
