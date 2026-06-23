// Die-cut vinyl sticker bodies. Parent supplies <svg viewBox="-50 -50 100 100">.
// `fill` = flat fill colour, `line` = darker coloured outline (never black).
//
// Every sticker gets a thin white outer "die-cut" border by drawing a fat
// white-stroked duplicate of the main silhouette BEHIND the coloured shape.

const SW = 3;          // coloured outline strokeWidth
const HALO = SW + 4;   // white die-cut halo strokeWidth

const round = { strokeLinejoin: 'round', strokeLinecap: 'round' };

export function StickerInner({ kind, fill, line }) {
  switch (kind) {
    case 'skull':
      return <Skull fill={fill} line={line} />;
    case 'bolt':
      return <Bolt fill={fill} line={line} />;
    case 'crown':
      return <Crown fill={fill} line={line} />;
    case 'speech':
      return <Speech fill={fill} line={line} />;
    case 'bomb':
      return <Bomb fill={fill} line={line} />;
    case 'star':
    default:
      return <Star fill={fill} line={line} />;
  }
}

/* ----------------------------------------------------------------- skull */
function Skull({ fill, line }) {
  // Cranium + jaw silhouette used for both the white halo and the coloured body.
  const skullPath =
    'M -34 -8 ' +
    'C -34 -34 -18 -44 0 -44 ' +
    'C 18 -44 34 -34 34 -8 ' +
    'C 34 6 28 14 22 18 ' +
    'L 22 30 ' +
    'C 22 36 16 40 8 40 ' +
    'L -8 40 ' +
    'C -16 40 -22 36 -22 30 ' +
    'L -22 18 ' +
    'C -28 14 -34 6 -34 -8 Z';

  return (
    <g>
      {/* crossbones behind everything */}
      <g>
        <rect x={-44} y={-3} width={88} height={9} rx={4.5}
          transform="rotate(38)" fill="#fff" stroke="#fff" strokeWidth={HALO} {...round} />
        <rect x={-44} y={-3} width={88} height={9} rx={4.5}
          transform="rotate(-38)" fill="#fff" stroke="#fff" strokeWidth={HALO} {...round} />
        <rect x={-44} y={-3} width={88} height={9} rx={4.5}
          transform="rotate(38)" fill={fill} stroke={line} strokeWidth={SW} {...round} />
        <rect x={-44} y={-3} width={88} height={9} rx={4.5}
          transform="rotate(-38)" fill={fill} stroke={line} strokeWidth={SW} {...round} />
      </g>

      {/* white die-cut halo for the skull */}
      <path d={skullPath} fill="#fff" stroke="#fff" strokeWidth={HALO} {...round} />

      {/* coloured skull body */}
      <path d={skullPath} fill={fill} stroke={line} strokeWidth={SW} {...round} />

      {/* eye sockets — slightly different sizes (asymmetry) */}
      <circle cx={-15} cy={-8} r={11} fill={line} />
      <circle cx={15} cy={-8} r={9} fill={line} />

      {/* LEFT eye: crossed "X" */}
      <line x1={-21} y1={-14} x2={-9} y2={-2} stroke={fill} strokeWidth={2.6} {...round} />
      <line x1={-9} y1={-14} x2={-21} y2={-2} stroke={fill} strokeWidth={2.6} {...round} />

      {/* RIGHT eye: small dot pupil (winking) */}
      <circle cx={15} cy={-8} r={3} fill={fill} />

      {/* nose: small upside-down heart */}
      <path
        d="M 0 14 C -5 8 -8 6 -8 2 C -8 -1 -5 -2 -3.5 0 C -2.4 1.3 -2 2 0 4 C 2 2 2.4 1.3 3.5 0 C 5 -2 8 -1 8 2 C 8 6 5 8 0 14 Z"
        fill={line} {...round} />

      {/* teeth: row of 5 small rects, one missing (3rd) */}
      <g fill="#fff" stroke={line} strokeWidth={1.6} {...round}>
        <rect x={-15} y={24} width={6} height={9} rx={1.5} />
        <rect x={-7.5} y={24} width={6} height={9} rx={1.5} />
        {/* 3rd tooth intentionally missing */}
        <rect x={7.5} y={24} width={6} height={9} rx={1.5} />
        <rect x={1.5} y={24} width={6} height={9} rx={1.5} />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ bolt */
function Bolt({ fill, line }) {
  // Lightning bolt: thicker at top, curved edges, tapering to a point.
  const boltPath =
    'M 6 -46 ' +
    'C -6 -30 -16 -14 -22 -2 ' +
    'C -23 0 -22 2 -19 2 ' +
    'L -4 2 ' +
    'C -8 16 -12 30 -16 46 ' +
    'C -16 48 -13 49 -11 46 ' +
    'C 4 26 16 8 26 -8 ' +
    'C 27 -10 26 -12 23 -12 ' +
    'L 8 -12 ' +
    'C 12 -22 16 -32 19 -42 ' +
    'C 20 -45 16 -47 13 -45 Z';

  // 4-point starburst glow behind the bolt
  const burst =
    'M 0 -50 L 9 -9 L 50 0 L 9 9 L 0 50 L -9 9 L -50 0 L -9 -9 Z';

  return (
    <g>
      <path d={burst} fill={fill} opacity={0.5} {...round} />

      {/* white die-cut halo */}
      <path d={boltPath} fill="#fff" stroke="#fff" strokeWidth={HALO} {...round} />

      {/* coloured bolt */}
      <path d={boltPath} fill={fill} stroke={line} strokeWidth={SW} {...round} />
    </g>
  );
}

/* ----------------------------------------------------------------- crown */
function Crown({ fill, line }) {
  // Three-pointed crown, asymmetric (middle point taller), tilted for attitude.
  const crownPath =
    'M -38 28 ' +
    'L -44 -22 ' +
    'L -20 2 ' +
    'L 0 -36 ' +
    'L 20 2 ' +
    'L 44 -18 ' +
    'L 38 28 Z';

  return (
    <g transform="rotate(-8)">
      {/* white die-cut halo */}
      <path d={crownPath} fill="#fff" stroke="#fff" strokeWidth={HALO} {...round} />

      {/* coloured crown body */}
      <path d={crownPath} fill={fill} stroke={line} strokeWidth={SW} {...round} />

      {/* band at the bottom with tiny triangle details */}
      <rect x={-38} y={16} width={76} height={14} rx={4}
        fill={fill} stroke={line} strokeWidth={SW} {...round} />
      <g fill={line}>
        <path d="M -22 18 L -16 18 L -19 24 Z" />
        <path d="M -3 18 L 3 18 L 0 24 Z" />
        <path d="M 16 18 L 22 18 L 19 24 Z" />
      </g>

      {/* jewels at each point tip — different colours */}
      <circle cx={-44} cy={-22} r={4.5} fill="#FF2EC4" stroke={line} strokeWidth={1.6} />
      <circle cx={0} cy={-36} r={5} fill="#2EFFE0" stroke={line} strokeWidth={1.6} />
      <circle cx={44} cy={-18} r={4.5} fill="#FFE94A" stroke={line} strokeWidth={1.6} />
    </g>
  );
}

/* ---------------------------------------------------------------- speech */
function Speech({ fill, line }) {
  // Rounded-rectangle bubble with a triangular tail pointing down-left.
  const bubblePath =
    'M -38 -34 ' +
    'L 38 -34 ' +
    'C 43 -34 46 -31 46 -26 ' +
    'L 46 12 ' +
    'C 46 17 43 20 38 20 ' +
    'L -10 20 ' +
    'L -22 40 ' +          // tail out
    'L -20 20 ' +          // tail base
    'L -38 20 ' +
    'C -43 20 -46 17 -46 12 ' +
    'L -46 -26 ' +
    'C -46 -31 -43 -34 -38 -34 Z';

  return (
    <g>
      {/* white die-cut halo */}
      <path d={bubblePath} fill="#fff" stroke="#fff" strokeWidth={HALO} {...round} />

      {/* coloured bubble */}
      <path d={bubblePath} fill={fill} stroke={line} strokeWidth={SW} {...round} />

      {/* bold "!!!" text */}
      <text
        x={0} y={-2}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Bungee, sans-serif"
        fontSize={34}
        fontWeight={700}
        fill={line}>
        !!!
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ star */
function Star({ fill, line }) {
  // Irregular 5-point star (top point a touch longer) + a smaller star behind.
  const starPath =
    'M 0 -46 ' +
    'L 11 -14 ' +
    'L 45 -13 ' +
    'L 18 7 ' +
    'L 28 40 ' +
    'L 0 20 ' +
    'L -28 40 ' +
    'L -18 7 ' +
    'L -45 -13 ' +
    'L -11 -14 Z';

  const smallStar =
    'M 0 -30 L 7 -9 L 29 -8 L 12 5 L 18 26 L 0 13 L -18 26 L -12 5 L -29 -8 L -7 -9 Z';

  return (
    <g>
      {/* smaller star behind, rotated, slightly darker */}
      <g transform="rotate(25) translate(10 8)">
        <path d={smallStar} fill="#fff" stroke="#fff" strokeWidth={HALO} {...round} />
        <path d={smallStar} fill={line} stroke={line} strokeWidth={SW} {...round} />
      </g>

      {/* white die-cut halo for main star */}
      <path d={starPath} fill="#fff" stroke="#fff" strokeWidth={HALO} {...round} />

      {/* coloured main star */}
      <path d={starPath} fill={fill} stroke={line} strokeWidth={SW} {...round} />
    </g>
  );
}

/* ------------------------------------------------------------------ bomb */
function Bomb({ fill, line }) {
  // Silhouette: round body + rectangular cap + short curved fuse. No face.
  const fusePath = 'M 8 -34 C 18 -42 22 -34 26 -42 C 29 -48 36 -46 38 -50';

  return (
    <g>
      {/* white die-cut halo */}
      <circle cx={0} cy={6} r={34} fill="#fff" stroke="#fff" strokeWidth={HALO} {...round} />
      <rect x={-9} y={-34} width={18} height={10} rx={2}
        fill="#fff" stroke="#fff" strokeWidth={HALO} {...round} />
      <path d={fusePath} fill="none" stroke="#fff" strokeWidth={HALO + 2} {...round} />

      {/* coloured bomb body */}
      <circle cx={0} cy={6} r={34} fill={fill} stroke={line} strokeWidth={SW} {...round} />
      <rect x={-9} y={-34} width={18} height={10} rx={2}
        fill={fill} stroke={line} strokeWidth={SW} {...round} />
      <path d={fusePath} fill="none" stroke={line} strokeWidth={SW + 1} {...round} />

      {/* tiny 4-point sparkle at the fuse tip */}
      <path
        d="M 38 -50 L 41 -44 L 47 -50 L 41 -56 Z"
        fill={fill} stroke={line} strokeWidth={1.4} {...round} />
    </g>
  );
}
