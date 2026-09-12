// FuseArt.jsx — FUSE's own vector art. Three pieces, all REAL SVG assets (ART VS MOTION:
// no CSS-drawn shapes, no gradients, no glow), all driven by transform/opacity or by a
// per-frame attribute React already re-renders. NOTHING here loops at rest.
//
//   BurningCord   the clock. A rope on a charge, eaten by an ember that crawls toward the
//                 stick. stroke-dashoffset off the same clock the ring used, exactly like
//                 Word Bomb's `bomb-fuse` — but this is FUSE's own rope, charge and ember.
//   FragmentSlab  the hero. The fragment you must use, on a slab with real presence (the
//                 shape Word Bomb's `.game-combo-box` holds down for that board).
//   FuseLifeCord  one life, drawn as a spare fuse: lit rope + flame, or a charred stub.
//   DefusedWord   the payoff. An accepted word with the MATCHED FRAGMENT picked out of it.
//
// COLOUR SCRIPT (FUSE's own — CHAIN is cyan, this is not):
//   accent  #FF6B3D  spent ONLY on the fragment: the slab, its glyph, and the same letters
//                    found again inside a word you defused. Nothing else on the screen.
//   rope    #b9a7d6  pale cord — quiet, so the ember is the only hot thing on it
//   ember   #FF4B4B outer / #FFE94A core;  danger #FF4B4B;  charred #3a2b52 / #4a3a63

// ---------------------------------------------------------------------------------------
// THE ROPE. Two cubic segments, deliberately asymmetric (the sag on the left is deeper than
// the one on the right, and the tip rides high) so it reads hand-drawn rather than plotted.
// ---------------------------------------------------------------------------------------
// NOTE ON THE BOX: the viewBox is 368 wide but the rope stops at x=330. That 38-unit margin is
// not slack — it is the room the EMBER needs. Its sparks and frayed threads hang off the burn
// point, and at full time the burn point IS the tip, so a rope that ran to the edge had its
// sparks sliced off by the svg's own clip (measured: 3 specks cut at every viewport).
const SEGS = [
  [[112, 52], [148, 10], [190, 96], [228, 56]],
  [[228, 56], [258, 26], [296, 90], [330, 44]],
];
export const CORD_D =
  'M 112 52 C 148 10, 190 96, 228 56 C 258 26, 296 90, 330 44';

const cubic = (p, t) => {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0],
    a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1],
  ];
};

// ARC-LENGTH LOOKUP, built ONCE at module load. `stroke-dashoffset` measures ARC LENGTH, so
// interpolating the ember by Bezier parameter t would drift off the burn point on the tight
// parts of the curve. 101 evenly-spaced-by-length samples, computed with pure maths — never
// `getPointAtLength`, which would be a DOM/geometry read inside the rAF path.
const CORD_LUT = (() => {
  const raw = [];
  let len = 0;
  for (let s = 0; s < SEGS.length; s++) {
    for (let i = s === 0 ? 0 : 1; i <= 160; i++) {
      const [x, y] = cubic(SEGS[s], i / 160);
      if (raw.length) {
        const p = raw[raw.length - 1];
        len += Math.hypot(x - p[0], y - p[1]);
      }
      raw.push([x, y, len]);
    }
  }
  const out = [];
  let j = 0;
  for (let k = 0; k <= 100; k++) {
    const want = (k / 100) * len;
    while (j < raw.length - 2 && raw[j + 1][2] < want) j++;
    const a = raw[j];
    const b = raw[j + 1];
    const span = b[2] - a[2] || 1;
    const f = Math.max(0, Math.min(1, (want - a[2]) / span));
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return out;
})();

/** Point on the rope at arc-length fraction f (0 = at the charge, 1 = the free tip). */
export function cordPointAt(f) {
  const x = Math.max(0, Math.min(1, f)) * 100;
  const i = Math.floor(x);
  const a = CORD_LUT[i];
  const b = CORD_LUT[Math.min(100, i + 1)];
  const t = x - i;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * THE CLOCK, as a burning cord. `ratio` of the rope is left; the ember sits exactly at the
 * burn point and crawls toward the charge. The seconds numeral is a sibling DOM node (see
 * Solo.css `.fcord-secs`) rather than SVG text, so it obeys the type scale in CSS pixels
 * instead of viewBox units.
 */
export function BurningCord({ remaining, tMax, redZone, armed }) {
  const ratio = armed ? Math.max(0, Math.min(1, remaining / (tMax || 1))) : 1;
  const secs = Math.max(0, remaining / 1000);
  const [ex, ey] = cordPointAt(ratio);
  const dashoffset = 100 * (1 - ratio);

  return (
    <div className={`fcord-bar${redZone ? ' is-red' : ''}`}>
      <svg className="fcord" viewBox="0 0 368 128" fill="none" aria-hidden="true">
        {/* ---- the charge. A wonky stick: the wrap is torn at one end, the wax seal blobs
             off-centre, and the collar sits crooked where the rope goes in. ---- */}
        <path
          className="fcord-stick"
          d="M 16 66 C 14 52, 26 47, 42 46 L 92 43 C 108 42, 114 51, 114 64 L 114 92
             C 114 105, 105 110, 90 110 L 38 112 C 22 113, 14 105, 15 91 Z"
        />
        {/* torn wrap seam, off-centre and not parallel to the ends */}
        <path className="fcord-seam" d="M 44 47 L 50 111" />
        <path className="fcord-seam" d="M 84 44 L 90 110" />
        {/* the collar the rope leaves through — crooked on purpose */}
        <path className="fcord-collar" d="M 96 44 L 122 36 L 126 54 L 102 60 Z" />
        {/* two wax blobs, different sizes, neither centred on the collar */}
        <circle className="fcord-wax" cx="118" cy="46" r="7" />
        <circle className="fcord-wax" cx="107" cy="57" r="4" />

        {/* ---- the rope. Ash memory of the whole run under it; the black under-shade and
             the pale rope on top both burn back together on one dashoffset. ---- */}
        <path className="fcord-ash" d={CORD_D} pathLength="100" />
        <path
          className="fcord-shade"
          d={CORD_D}
          transform="translate(0 3.6)"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={dashoffset}
        />
        <path
          className="fcord-rope"
          d={CORD_D}
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={dashoffset}
        />

        {/* ---- the ember, parked exactly on the burn point. Everything that is only true
             AT the burn — the frayed threads, the sparks, the ash specks already blown off
             the end — rides in this group, so none of it is ever left stranded on rope that
             has not burnt yet. Asymmetric by design: three whiskers of different lengths,
             three sparks of three sizes, none mirrored. ---- */}
        <g className="fcord-ember" transform={`translate(${ex.toFixed(2)} ${ey.toFixed(2)})`}>
          <path className="fcord-fray" d="M 5 -1 L 19 -7" />
          <path className="fcord-fray" d="M 6 3 L 23 5" />
          <path className="fcord-fray" d="M 4 6 L 15 13" />
          <circle className="fcord-speck" cx="26" cy="-6" r="2.4" />
          <circle className="fcord-speck" cx="34" cy="4" r="1.6" />
          <circle className="fcord-speck" cx="30" cy="12" r="1.1" />
          {/* outer petal: leans back over the rope it has eaten, with a nick out of one side */}
          <path
            className="fcord-flame-o"
            d="M -1 -4 C 9 -20, 22 -18, 18 -4 C 25 -7, 27 6, 16 12 C 6 18, -9 13, -10 3
               C -11 -3, -7 -4, -1 -4 Z"
          />
          <path className="fcord-flame-i" d="M 1 -1 C 6 -11, 14 -10, 11 -1 C 14 2, 11 8, 4 8 C -2 8, -4 3, 1 -1 Z" />
        </g>
      </svg>
      <div className="fcord-secs" aria-hidden="true">
        {secs >= 10 ? Math.ceil(secs) : secs.toFixed(1)}
      </div>
    </div>
  );
}

/**
 * THE HERO. The fragment every word must contain, on a slab with presence — a near-black
 * plate, a thick accent rule, a hard black offset shadow and a resting tilt. This is FUSE's
 * ONE accent element; nothing else on the screen takes #FF6B3D.
 */
export function FragmentSlab({ fragment }) {
  return (
    <div className="fs-slab">
      <div className="fs-slab-label">IT MUST CONTAIN</div>
      <div className="fs-frag">{(fragment || '').toUpperCase()}</div>
    </div>
  );
}

/**
 * ONE LIFE = ONE SPARE FUSE. Lit: a pale braided cord with a lit head. Spent: a charred,
 * broken stub. A STATE flip on a life loss, never an idle loop.
 */
export function FuseLifeCord({ lit }) {
  return (
    <svg className={`flife${lit ? ' is-lit' : ''}`} viewBox="0 0 62 26" fill="none" aria-hidden="true">
      <path className="flife-line" d="M 4 15 q 8 -10 15 -2 t 14 -2 t 12 -1" />
      {lit ? (
        <g className="flife-head">
          <path className="flife-flame-o" d="M 45 12 c 6 -9 15 -7 12 3 c 4 -1 3 8 -4 10 c -6 2 -12 -1 -12 -6 c 0 -3 1 -5 4 -7 z" />
          <path className="flife-flame-i" d="M 48 14 c 3 -5 8 -4 6 2 c 2 1 1 4 -3 5 c -3 1 -6 -1 -6 -3 c 0 -2 1 -3 3 -4 z" />
        </g>
      ) : (
        <circle className="flife-ash" cx="49" cy="15" r="3.4" />
      )}
    </svg>
  );
}

/**
 * THE PAYOFF. An accepted word with the fragment it matched PICKED OUT of it — the letters
 * you were given, found inside the word you found. The match is the FIRST occurrence, which
 * is the one the engine's `includes` test passed on.
 */
export function DefusedWord({ word, fragment }) {
  const w = (word || '').toUpperCase();
  const f = (fragment || '').toUpperCase();
  const at = f ? w.indexOf(f) : -1;
  if (at < 0) {
    return <span className="fd-chip">{w}</span>;
  }
  return (
    <span className="fd-chip">
      {at > 0 ? <span className="fd-rest">{w.slice(0, at)}</span> : null}
      <b className="fd-frag">{w.slice(at, at + f.length)}</b>
      {at + f.length < w.length ? <span className="fd-rest">{w.slice(at + f.length)}</span> : null}
    </span>
  );
}
