// ThemePreview — STEP 21 / Andy A12: "themes in the shop aren't noticeable: make them obvious".
// A four-colour swatch asked the player to imagine their menu; this IS their menu, in miniature:
// the wordmark, the level bar, the mode cards and a few letter pops, drawn in the theme's own
// palette (read from the same `vars` applyTheme() stamps on the root, so the picture can't lie).
// A picture, not UI: one static SVG, aria-hidden, no motion.
export default function ThemePreview({ theme }) {
  const v = theme.vars;
  const bg = v['--theme-bg'];
  const panel = v['--theme-panel'];
  const ink = v['--theme-ink'];
  const xp = v['--theme-xp-fill'];
  const accent = v['--theme-accent'];
  const card = v['--theme-card-accent'];
  const pops = [v['--theme-pop-1'], v['--theme-pop-2'], v['--theme-pop-3'], v['--theme-pop-4']];
  return (
    <svg className="shop-theme-preview" viewBox="0 0 200 124" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <rect x="0" y="0" width="200" height="124" rx="8" fill={bg} />
      {/* wordmark */}
      <text x="100" y="27" textAnchor="middle" fontFamily="Bungee, sans-serif" fontSize="19" fill={ink} stroke="#000" strokeWidth="2.5" paintOrder="stroke" transform="rotate(-2 100 22)">
        TYPE A WORD
      </text>
      {/* level slab + bar */}
      <rect x="34" y="36" width="132" height="18" rx="3" fill={panel} stroke="#000" strokeWidth="2" />
      <rect x="37" y="39" width="20" height="12" rx="2" fill={xp} />
      <rect x="60" y="41" width="102" height="8" rx="2" fill="#000" />
      <rect x="60" y="41" width="62" height="8" rx="2" fill={xp} />
      {/* mode cards */}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <rect x={16 + i * 35} y="62" width="31" height="44" rx="4" fill={panel} stroke={i === 0 ? card : accent} strokeWidth="2.5" />
          <rect x={20 + i * 35} y="94" width="18" height="4" rx="1" fill={i % 2 ? accent : ink} />
        </g>
      ))}
      {/* letter pops */}
      <text x="22" y="60" fontFamily="Bungee, sans-serif" fontSize="12" fill={pops[0]} stroke="#000" strokeWidth="1.5" paintOrder="stroke">A</text>
      <text x="176" y="34" fontFamily="Bungee, sans-serif" fontSize="12" fill={pops[1]} stroke="#000" strokeWidth="1.5" paintOrder="stroke">K</text>
      <text x="168" y="118" fontFamily="Bungee, sans-serif" fontSize="10" fill={pops[2]} stroke="#000" strokeWidth="1.5" paintOrder="stroke">+10</text>
      <text x="12" y="118" fontFamily="Bungee, sans-serif" fontSize="10" fill={pops[3]} stroke="#000" strokeWidth="1.5" paintOrder="stroke">Z</text>
    </svg>
  );
}
