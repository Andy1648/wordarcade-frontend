// MomentumRail — the MENU trophy for the MOMENTUM repeatable sink. Every buy leaves ONE permanent,
// visible mark here, so N buys read as N marks of EVIDENCE (not a hidden 1.05^n number). The marks are
// real vector art (flat diamond STUDS with a thick colored outline + a hard offset shadow, per the ART
// VS MOTION rule).
//
// STAGED BOARD: a single 50×4 board sized for the endgame would leave the first ~20 buys as a speck in
// a 98%-empty rail. Instead the board GROWS in stages, so the studs stay large early and the rail is
// always visually full at every count. The studs shrink as the board grows; the rail's fixed height
// never changes. Faint OUTLINE cells fill the current stage's remaining capacity so the group
// structure (and the next milestone) is visible even at n=1 — a single mark reads as a deliberate,
// large, left-aligned stud, not a glitch. Grouped every 10 columns so it stays countable at every
// stage. No idle/infinite animation: static at rest; a purchase pops ONLY the newest stud once.
import { memo, useState } from 'react';
import './MomentumRail.css';
import { MOMENTUM_MAX, consumeMomentumPop } from '../progress/momentum';

const VW = 312;
const VH = 20; // viewBox aspect ≈ the rail's rendered 340×22 box, so 'meet' fills it with no letterbox
const MX = 4;
const MY = 2;
const GROUP = 10; // a wider gap every 10 columns → countable blocks
const GAPF = 0.6; // group gap as a fraction of a cell
const STUDF = 0.42; // stud radius as a fraction of the cell

// The board CAPACITY grid for a given buy count — grows in stages (studs shrink, rail stays full).
function boardFor(n) {
  if (n <= 10) return { cols: 10, rows: 1 }; //   1–10:  one big row of 10
  if (n <= 40) return { cols: 20, rows: 2 }; //  11–40:  two rows of 20
  if (n <= 100) return { cols: 25, rows: 4 }; // 41–100: four rows of 25
  return { cols: 50, rows: 4 }; //              101–200: four rows of 50 (the full board)
}
// Cell + stud dimensions that FILL the fixed viewBox for this stage's grid.
function layoutOf(cols, rows) {
  const gaps = Math.ceil(cols / GROUP) - 1;
  const availW = VW - 2 * MX;
  const cellW = availW / (cols + GAPF * gaps);
  return {
    cellW,
    gap: GAPF * cellW,
    cellH: (VH - 2 * MY) / rows,
    r: STUDF * Math.min(cellW, (VH - 2 * MY) / rows),
  };
}
function centerOf(idx, cols, L) {
  const row = Math.floor(idx / cols);
  const col = idx % cols;
  const g = Math.floor(col / GROUP);
  return {
    cx: MX + col * L.cellW + g * L.gap + L.cellW / 2,
    cy: MY + row * L.cellH + L.cellH / 2,
  };
}
// A flat diamond (rotated square) — chunky, reads at every size, on-brand as a stud/rivet.
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

  const { cols, rows } = boardFor(n);
  const cap = cols * rows;
  const L = layoutOf(cols, rows);
  const h = L.r;
  const OFF = Math.max(0.6, h * 0.35); // hard offset shadow, scaled to the stud size

  const filledN = pop ? n - 1 : n; // the newest stud is drawn separately only when it should pop
  let empty = '';
  let shadow = '';
  let body = '';
  for (let i = 0; i < cap; i += 1) {
    const { cx, cy } = centerOf(i, cols, L);
    if (i < filledN) {
      shadow += diamond(cx + OFF, cy + OFF, h);
      body += diamond(cx, cy, h);
    } else if (i >= n) {
      empty += diamond(cx, cy, h); // faint outline for not-yet-earned cells → structure stays visible
    }
  }
  const last = centerOf(n - 1, cols, L);
  if (pop) shadow += diamond(last.cx + OFF, last.cy + OFF, h); // the popping stud's shadow

  return (
    <div className="momentum-rail" role="img" aria-label={`Momentum: ${n} of ${MOMENTUM_MAX} marks`}>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
        {empty && <path className="mr-empty" d={empty} />}
        {shadow && <path className="mr-shadow" d={shadow} />}
        {body && <path className="mr-stud" d={body} />}
        {pop && <path key={n} className="mr-stud mr-newest" d={diamond(last.cx, last.cy, h)} />}
      </svg>
    </div>
  );
}

export const MomentumRail = memo(MomentumRailImpl);
