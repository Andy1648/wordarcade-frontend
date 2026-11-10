// RankSeal — a board place worn as its LEAGUE's badge (leagues.js, Andy nov9: "the icon on the left … just doesn't look like
// it. make it match"): the league's painted badge with the exact place printed on its empty plate. Every rank has one — the
// badge says the league, the number says the place, so a row can never show one league and claim another.
// LEAGUE_PLATE tells it where the plate sits; a league whose plate is small (the ornate top leagues) draws its badge a little
// bigger so the number stays readable. A long place (1,000+) prints smaller to stay on the plate. CSS sizes it, prints the
// number and runs ONE finite shine sweep on mount (staggered down the ranks); hovering its row replays it. Other motion is the caller's.
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
  const grow = Math.min(1.3, Math.max(1, 0.4 / p.w)); // the plate reads at no less than ~40% of the slot
  return (
    <span
      className={`rseal ${className}`}
      data-league={l.key}
      data-digits={Math.min(5, String(n).length)}
      aria-label={`rank ${formatNum(Number(rank))}, ${l.name}`}
      style={{
        '--seal-art': `url(${LEAGUE_ART[l.key]})`,
        '--shine-at': `${700 + Math.min(Number(rank), 12) * 70}ms`,
        '--grow': grow,
        '--px': p.x - 0.5,
        '--py': p.y - 0.5,
        '--pf': (p.w * grow) / 0.4,
      }}
      {...rest}
    >
      <img className="rseal-art" src={LEAGUE_ART[l.key]} alt="" aria-hidden="true" draggable="false" />
      <span className="rseal-shine" aria-hidden="true"><i /></span>
      <b className="rseal-n" aria-hidden="true">{n}</b>
    </span>
  );
}
