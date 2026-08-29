// MomentumRail — the MENU trophy for the MOMENTUM repeatable sink. Every buy leaves ONE permanent,
// visible mark here, so N buys read as N marks of EVIDENCE (not a hidden 1.05^n number). The marks are
// real vector art (flat diamond STUDS with a thick colored outline + a hard offset shadow, per the ART
// VS MOTION rule).
//
// STAGED BOARD, no empty rows. A fixed 50×4 board leaves early counts as a speck in a 98%-empty rail;
// worse, a wide board only two rows full reads as broken. So (a) the board WIDTH grows in stages, and
// (b) we only ever render the rows actually IN USE — ceil(count / cols) rows — with faint outline cells
// filling just the remainder of the CURRENT partial row. The result at every count is a COMPLETE
// rectangle of full rows plus one filling row, never a full-width grid with empty rows sitting under
// it. Studs shrink as rows are added and as the board widens; the rail's fixed 22px height never
// changes. Grouped every 10 columns so it stays countable. No idle/infinite animation: static at rest;
// a purchase pops ONLY the newest stud once.
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

// Board WIDTH (and row cap) grows in stages. Within a stage only the rows in use are drawn (see below),
// so a row is always full or filling — never an empty row under the fill.
const STAGES = [
  { max: 10, cols: 10, rows: 1 }, //    1–10
  { max: 30, cols: 15, rows: 2 }, //   11–30
  { max: 60, cols: 20, rows: 3 }, //   31–60
  { max: 120, cols: 30, rows: 4 }, //  61–120
  { max: 200, cols: 50, rows: 4 }, // 121–200
];
function stageFor(n) {
  for (const s of STAGES) if (n <= s.max) return s;
  return STAGES[STAGES.length - 1];
}
// Cell + stud dimensions that FILL the fixed viewBox for `cols` × `rows` (rows = the rows IN USE).
function layoutOf(cols, rows) {
  const gaps = Math.ceil(cols / GROUP) - 1;
  const availW = VW - 2 * MX;
  const cellW = availW / (cols + GAPF * gaps);
  const cellH = (VH - 2 * MY) / rows;
  return { cellW, gap: GAPF * cellW, cellH, r: STUDF * Math.min(cellW, cellH) };
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

  const stage = stageFor(n);
  const cols = stage.cols;
  const visibleRows = Math.min(stage.rows, Math.ceil(n / cols)); // rows actually in use — no empties below
  const shown = visibleRows * cols; // full rows + the current partial row (faint remainder)
  const L = layoutOf(cols, visibleRows);
  const h = L.r;
  const OFF = Math.max(0.6, h * 0.35); // hard offset shadow, scaled to the stud size

  const filledN = pop ? n - 1 : n; // the newest stud is drawn separately only when it should pop
  let empty = '';
  let shadow = '';
  let body = '';
  for (let i = 0; i < shown; i += 1) {
    const { cx, cy } = centerOf(i, cols, L);
    if (i < filledN) {
      shadow += diamond(cx + OFF, cy + OFF, h);
      body += diamond(cx, cy, h);
    } else if (i >= n) {
      empty += diamond(cx, cy, h); // faint outline for the current row's unfilled cells
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
