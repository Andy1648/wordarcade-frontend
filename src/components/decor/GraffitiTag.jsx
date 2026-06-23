export default function GraffitiTag({
  word,
  fill,
  line,
  size = 34,
  top,
  left,
  rotation = 0,
  opacity = 0.16,
  drip = 0,
}) {
  const letters = word.split('');

  // Deterministic per-letter rotation: ±3deg, never random so re-renders are stable.
  const letterRot = (i) => ((i * 53) % 7) - 3;

  // Estimated word dimensions (approximate is fine for overlay alignment).
  const wordWidth = Math.max(1, letters.length) * size * 0.7;
  const wordHeight = size;

  // --- DRIP paths (2-3) hanging down from near the bottom of "random" letters ---
  const dripCount = 2 + ((word.length + Math.round(drip)) % 2); // 2 or 3, deterministic
  const drips = [];
  for (let d = 0; d < dripCount; d++) {
    // Deterministic x across the word width.
    const xFrac = ((d * 37 + 11) % 100) / 100;
    const x = xFrac * wordWidth;
    const startY = wordHeight * 0.92;
    // Length between size*0.5 and size*1.2
    const len = size * (0.5 + (((d * 29 + 7) % 70) / 100));
    const endY = startY + len;
    // Gentle wavy Q curve (control point offset to one side, alternating).
    const sway = ((d % 2 === 0) ? 1 : -1) * (size * 0.18);
    const midY = startY + len * 0.5;
    const ctrlX = x + sway;
    const dropR = Math.max(1.5, size / 12);
    drips.push({
      d: `M ${x} ${startY} Q ${ctrlX} ${midY} ${x} ${endY}`,
      cx: x,
      cy: endY,
      r: dropR,
    });
  }

  // --- OVERSPRAY dots (6-8): deterministic scatter around the word edges ---
  // Fixed offset table (fractions of width/height), index-derived, no randomness.
  const oversprayTable = [
    { fx: -0.04, fy: 0.1, r: 2, o: 0.5 },
    { fx: 0.2, fy: -0.18, r: 1.5, o: 0.45 },
    { fx: 0.45, fy: 1.15, r: 2.5, o: 0.4 },
    { fx: 0.7, fy: -0.12, r: 1, o: 0.6 },
    { fx: 1.02, fy: 0.35, r: 2, o: 0.5 },
    { fx: 0.9, fy: 1.05, r: 1.5, o: 0.45 },
    { fx: 0.12, fy: 1.1, r: 1, o: 0.55 },
    { fx: 0.6, fy: -0.2, r: 2, o: 0.42 },
  ];
  const oversprayCount = 6 + ((word.length) % 3 === 0 ? 2 : (word.length % 3)); // 6-8
  const overspray = oversprayTable.slice(0, Math.min(8, Math.max(6, oversprayCount)));

  // --- UNDERLINE SLASH below the word (only on some tags, when drip > 0) ---
  const showSlash = drip > 0;
  const slashY = wordHeight * 1.05;
  const slashStart = wordWidth * 0.1;
  const slashEnd = wordWidth * 0.6;
  const slashPath = `M ${slashStart} ${slashY} L ${slashEnd} ${slashY + size * 0.35}`;

  return (
    <div
      className="wall-graffiti-tag"
      style={{
        position: 'absolute',
        top: `${top}%`,
        left: `${left}%`,
        transform: `rotate(${rotation}deg)`,
        opacity,
        pointerEvents: 'none',
        lineHeight: 1,
      }}
    >
      {letters.map((ch, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            fontFamily: "'Bungee', cursive",
            fontSize: `${size}px`,
            color: fill,
            WebkitTextStroke: `${Math.max(2, size / 14)}px ${line}`,
            paintOrder: 'stroke fill',
            transform: `rotate(${letterRot(i)}deg)`,
          }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}

      <svg
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        {drips.map((dr, i) => (
          <g key={`drip-${i}`}>
            <path
              d={dr.d}
              stroke={fill}
              strokeWidth={Math.max(1, size / 16)}
              fill="none"
              strokeLinecap="round"
            />
            <circle cx={dr.cx} cy={dr.cy} r={dr.r} fill={fill} />
          </g>
        ))}

        {overspray.map((o, i) => (
          <circle
            key={`os-${i}`}
            cx={o.fx * wordWidth}
            cy={o.fy * wordHeight}
            r={o.r}
            fill={fill}
            opacity={o.o}
          />
        ))}

        {showSlash && (
          <path
            d={slashPath}
            stroke={line}
            strokeWidth={Math.max(1, size / 12)}
            fill="none"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}
