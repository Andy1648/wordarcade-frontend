// MarkPips — DUPES = ★ pips (Andy oct5, "Genshin constellation style", replacing GOLD / RAINBOW). A tiny row of
// `max` star pips under a mark: the first `pips` filled, the rest empty. Purely visual (no text node): screens
// render it UNDER a mark's art / name and put any "7/10 → ★3" copy beside it themselves. Every star is an asset
// (/public/art/rarity/pip-on.svg / pip-off.svg). Size with the `--pip` custom property on the host (default 14px).
//
//   <MarkPips pips={3} />            ★★★☆☆
//   <MarkPips pips={1} max={5} />
//
// A pip that turns on pops ONCE (finite, transform/opacity — keyed on the count, so a new ★ replays it); nothing
// loops. Reduced motion: no pop.
import { clampPips } from '../../lib/rarityStyle.js';
import './MarkPips.css';

const ART = '/art/rarity/';

export default function MarkPips({ pips = 0, max = 5, className = '' }) {
  const { on, max: m } = clampPips(pips, max);
  const row = [];
  for (let i = 0; i < m; i += 1) {
    const lit = i < on;
    row.push(
      <img
        key={lit && i === on - 1 ? `n${on}` : i}
        className={`mark-pip${lit ? ' is-on' : ''}${lit && i === on - 1 ? ' is-newest' : ''}`}
        src={`${ART}${lit ? 'pip-on.svg' : 'pip-off.svg'}`}
        alt=""
        draggable="false"
      />,
    );
  }
  return (
    <span className={`mark-pips${className ? ` ${className}` : ''}`} role="img" aria-label={`★${on}/${m}`} data-pips={on}>
      {row}
    </span>
  );
}
