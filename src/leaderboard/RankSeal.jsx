// RankSeal — a board place worn as its LEAGUE's badge (leagues.js, Andy nov9: "the icon on the left … just doesn't look like
// it. make it match"): the league's painted badge, its EMBLEM in the centre, the exact place on a pill over the badge's bottom
// name-plate tab (LEAGUE_PLATE). Every rank has one — the badge says the league, the number says the place. The pill is UI
// (flat plum, black ink), sized for reading at row size rather than to the painted tab, which it covers. CSS sizes it and runs
// ONE finite shine sweep on mount (staggered down the ranks); hovering its row replays it. Other motion is the caller's.
import { leagueOf, LEAGUE_ART } from './leagues.js';
import { LEAGUE_PLATE } from './leaguePlate.js';
import { formatNum, formatShort } from '../format';
import './RankSeal.css';

/** The place as the plate prints it (formatShort: in full up to 9,999, "12K" past it). */
export const sealNumber = (rank) => formatShort(Number(rank));

export default function RankSeal({ rank, className = '', ...rest }) {
  const l = leagueOf(rank);
  if (!l) return null;
  const n = sealNumber(rank);
  const p = LEAGUE_PLATE[l.key];
  return (
    <span
      className={`rseal ${className}`}
      data-league={l.key}
      data-digits={Math.min(5, String(n).length)}
      aria-label={`rank ${formatNum(Number(rank))}, ${l.name}`}
      style={{
        '--seal-art': `url(${LEAGUE_ART[l.key]})`,
        '--shine-at': `${700 + Math.min(Number(rank), 12) * 70}ms`,
        '--tx': `${p.x * 100}%`,
        '--ty': `${p.y * 100}%`,
      }}
      {...rest}
    >
      <img className="rseal-art" src={LEAGUE_ART[l.key]} alt="" aria-hidden="true" draggable="false" />
      <span className="rseal-shine" aria-hidden="true"><i /></span>
      <b className="rseal-n" aria-hidden="true">{n}</b>
    </span>
  );
}
