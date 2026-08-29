// MomentumRail — the MENU trophy for the MOMENTUM repeatable sink. Every buy leaves ONE permanent,
// visible mark here, so N buys read as N marks of EVIDENCE (not a hidden 1.05^n number). The marks are
// real vector art (flat diamond STUDS with a thick colored outline + a hard black offset shadow, per
// the ART VS MOTION rule) laid on a FIXED 50×4 board sized so all 200 fit without the rail ever
// growing. Only DRIVEN studs render (an empty board would just be clutter on a fresh menu), grouped
// every 10 columns so you can count in tens. No idle/infinite animation: the board is static at rest;
// a purchase pops ONLY the newest stud once (consumed from a one-shot flag), like the wins stamp.
import { memo, useState } from 'react';
import './MomentumRail.css';
import { MOMENTUM_MAX, consumeMomentumPop } from '../progress/momentum';

const COLS = 50;
const ROWS = 4; // 50 × 4 = 200 = MOMENTUM_MAX
const GROUP = 10; // a wider gap every 10 columns → 5 countable blocks per row
const CELL = 6; // horizontal pitch per stud (viewBox units)
const CELLY = 6; // vertical pitch per row
const GAP = 3; // extra gap between 10-groups
const MARGIN = 3;
const H = 2.2; // stud half-diagonal (diamond radius)
const OFF = 1; // hard shadow offset
const GROUPS = COLS / GROUP;
const VW = MARGIN * 2 + COLS * CELL + (GROUPS - 1) * GAP;
const VH = MARGIN * 2 + ROWS * CELLY;

// Center of the stud at fill-index idx (fills left→right, top→bottom — reading order).
function centerOf(idx) {
  const row = Math.floor(idx / COLS);
  const col = idx % COLS;
  const g = Math.floor(col / GROUP);
  return {
    cx: MARGIN + col * CELL + g * GAP + CELL / 2,
    cy: MARGIN + row * CELLY + CELLY / 2,
  };
}
// A flat diamond (rotated square) path — chunky, reads at small sizes, on-brand as a stud/rivet.
function diamond(cx, cy, h) {
  return `M${cx} ${cy - h}L${cx + h} ${cy}L${cx} ${cy + h}L${cx - h} ${cy}Z`;
}

function MomentumRailImpl({ count = 0 }) {
  // Consume the one-shot pop flag ONCE per mount: pop the newest stud only right after a buy.
  const [pop] = useState(() => {
    try {
      return consumeMomentumPop();
    } catch {
      return false;
    }
  });

  const n = Math.max(0, Math.min(MOMENTUM_MAX, Math.floor(count)));
  if (n <= 0) return null; // fresh account: no board until the first mark is earned

  const bodyN = pop ? n - 1 : n; // the newest stud is drawn separately only when it should pop
  let shadow = '';
  let body = '';
  for (let i = 0; i < bodyN; i += 1) {
    const { cx, cy } = centerOf(i);
    shadow += diamond(cx + OFF, cy + OFF, H);
    body += diamond(cx, cy, H);
  }
  const last = centerOf(n - 1);

  return (
    <div className="momentum-rail" role="img" aria-label={`Momentum: ${n} of ${MOMENTUM_MAX} marks`}>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
        <path className="mr-shadow" d={`${shadow}${diamond(last.cx + OFF, last.cy + OFF, H)}`} />
        {body && <path className="mr-stud" d={body} />}
        {pop && <path key={n} className="mr-stud mr-newest" d={diamond(last.cx, last.cy, H)} />}
      </svg>
    </div>
  );
}

export const MomentumRail = memo(MomentumRailImpl);
