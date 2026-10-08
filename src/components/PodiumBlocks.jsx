// PodiumBlocks.jsx — the LEADERBOARD's three podium blocks (R5 oct8 #2; Andy: "the podium is legit just a few lines
// and filled in"). Real vector art, not CSS: each block is a SOLID — a coloured FRONT face, a lighter TOP face and a
// darker SIDE face (one light direction, top-left), outlined in a darker shade of its own fill (CLAUDE.md: coloured
// outlines, black only for text strokes and shadows), standing on ONE hard black offset shadow. Gold / silver /
// bronze by place. Craft: uneven depths (22 / 18 / 14), #3's top still slopes, #2's top-right corner lifts a touch,
// a plinth band at the foot, overspray dots off the top-left corner and one drip off the top face.
//
// The three viewBoxes match the old blocks exactly (214×262, 210×190, 210×138) so LeaderboardV2.css's slot at
// 1366×657 and the phone layout (--pk 0.5) are untouched. The rank numerals stay HTML (.lb2-place), on top.
// Static art: no animation here (the ARRIVAL rise is LeaderboardV2's kit one-shot on the column).

const INK = 6; // the outline (viewBox units)
const SHADOW = 9; // the hard black offset

const TONES = {
  1: { face: '#FFC23D', top: '#FFE94A', side: '#E09A12', line: '#9C6A0C' },
  2: { face: '#E4DDF0', top: '#FFFFFF', side: '#B8AECB', line: '#6F5E92' },
  3: { face: '#FF6B3D', top: '#FF9A6B', side: '#D9381E', line: '#8E2410' },
};

/**
 * One block. `x,y,w,h` = the FRONT face; `d` = the depth (the top + side faces run up-right by d);
 * `tilt` = how much lower (+) or higher (−) the front face's top-right corner sits than its top-left (asymmetry).
 */
function Block({ vw, vh, x, y, w, h, d, tilt = 0, tone, drip, spray }) {
  const t = TONES[tone];
  const pts = (arr) => arr.map((p) => p.join(',')).join(' ');
  const silhouette = pts([[x, y], [x + d, y - d], [x + w + d, y + tilt - d], [x + w + d, y + h - d], [x + w, y + h], [x, y + h]]);
  const top = pts([[x, y], [x + d, y - d], [x + w + d, y + tilt - d], [x + w, y + tilt]]);
  const side = pts([[x + w, y + tilt], [x + w + d, y + tilt - d], [x + w + d, y + h - d], [x + w, y + h]]);
  const front = pts([[x, y], [x + w, y + tilt], [x + w, y + h], [x, y + h]]);
  const band = 14; // the plinth band at the foot of the front face
  return (
    <svg className="lb2-block" viewBox={`0 0 ${vw} ${vh}`} width={vw} height={vh} aria-hidden="true" focusable="false">
      {/* ONE hard black offset shadow under the whole solid */}
      <polygon points={silhouette} fill="#000" stroke="#000" strokeWidth={INK} strokeLinejoin="round" transform={`translate(${SHADOW} ${SHADOW})`} />
      {/* the three planes, then the outline over all of them */}
      <polygon points={side} fill={t.side} />
      <polygon points={top} fill={t.top} />
      <polygon points={front} fill={t.face} />
      <rect x={x + 3} y={y + h - band - 3} width={w - 6} height={band} fill={t.side} />
      {/* the drip: paint running off the top face onto the front */}
      <rect x={drip} y={y + tilt * ((drip - x) / w) - 2} width={11} height={24} rx={5.5} fill={t.top} />
      <polygon points={top} fill="none" stroke={t.line} strokeWidth={INK} strokeLinejoin="round" />
      <polygon points={side} fill="none" stroke={t.line} strokeWidth={INK} strokeLinejoin="round" />
      <polygon points={front} fill="none" stroke={t.line} strokeWidth={INK} strokeLinejoin="round" />
      {/* one glint along the top face's lit edge */}
      <path d={`M${x + 14} ${y - 4} L${x + d + 10} ${y - d + 2}`} stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" />
      {/* overspray off the top-left corner */}
      {spray.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill={t.face} stroke={t.line} strokeWidth="2.5" />)}
    </svg>
  );
}

export function Block1() {
  return <Block vw={214} vh={262} x={4} y={34} w={186} h={220} d={22} tilt={0} tone={1} drip={132} spray={[[-2, 14, 4], [10, 2, 3], [24, 10, 2.5]]} />;
}
export function Block2() {
  return <Block vw={210} vh={190} x={4} y={30} w={184} h={156} d={18} tilt={-4} tone={2} drip={48} spray={[[0, 8, 3.5], [14, 0, 2.5]]} />;
}
export function Block3() {
  return <Block vw={210} vh={138} x={4} y={26} w={184} h={108} d={14} tilt={10} tone={3} drip={140} spray={[[-2, 10, 3.5], [12, -1, 2.5], [26, 6, 2]]} />;
}

export const BLOCKS = { 1: Block1, 2: Block2, 3: Block3 };
