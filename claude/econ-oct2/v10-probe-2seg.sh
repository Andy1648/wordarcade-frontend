#!/bin/bash
# v10-probe-2seg.sh R ALPHA HOURS TAG — v10-probe-all with a two-segment tail: r=R up to LV B2, then R2 (env R2, B2, K).
# (the early curve too), so a rebirth's re-climb is never a free burst of levels.
R="$1"; A="$2"; H="${3:-20}"; TAG="$4"; K="${K:-1}"; R2="${R2:-$1}"; B2="${B2:-100000}"
OLD="export function need(n) {\n  if (n <= CURVE_BREAK) return round10(CURVE_BASE * Math.pow(EARLY_CURVE_EXP, n - 1));"
NEW="export function need(n) {\n  const pw = Math.max(1, (keyTierXp(getKeyTier()) / 10) * rebirthMult(getRebirths()));\n  if (n <= CURVE_BREAK) return round10(CURVE_BASE * Math.pow(EARLY_CURVE_EXP, n - 1) * Math.pow(pw, $A));\n  { const b30 = round10(CURVE_BASE * Math.pow(EARLY_CURVE_EXP, CURVE_BREAK - 1)); return round10($K * b30 * (n <= $B2 ? Math.pow($R, n - CURVE_BREAK) : Math.pow($R, $B2 - CURVE_BREAK) * Math.pow($R2, n - $B2)) * Math.pow(pw, $A)); }"
P="[[\"progress/xp.js\",\"$OLD\",\"$NEW\"]]"
SIM_PATCH="$P" SIM_SRC="$(dirname "$0")/../../src" node "$(dirname "$0")/loop-sim.mjs" --tag="$TAG" --hours="$H" ${SIM_ARGS:-}
