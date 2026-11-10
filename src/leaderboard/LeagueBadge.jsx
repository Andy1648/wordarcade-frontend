// LeagueBadge — your RANK LEAGUE (leagues.js), worn where titles used to be: the profile, the menu's profile plate, the
// board's past-#100 rows and the results. The league NAME on its league-coloured plate (Bungee, thick rim a shade darker,
// hard black shadow), the painted league badge in front of it (LEAGUE_ART, leagues.js). `place` adds
// your exact board place after the name, `range` the board places the league spans ("RANKS 11–50", leagues.js rangeLabel),
// `art={false}` drops the badge where a RankSeal beside it already shows it. No rank → UNRANKED. Motion is the caller's.
import { leagueOf, LEAGUE_ART } from './leagues.js';
import { rangeLabel } from './leagueRange.js';
import { formatNum } from '../format';
import './LeagueBadge.css';

export { LEAGUE_ART };

export default function LeagueBadge({ rank, place = false, range = false, art: showArt = true, className = '', ...rest }) {
  const l = leagueOf(rank);
  const key = l ? l.key : 'unranked';
  const art = showArt && l && LEAGUE_ART[key];
  return (
    <span className={`lg-badge ${className}`} data-league={key} aria-label={l ? `${l.name} league${place ? `, number ${formatNum(Number(rank))}` : ''}` : 'Unranked'} {...rest}>
      {art ? <img className="lg-badge-art" src={art} width="512" height="512" alt="" aria-hidden="true" draggable="false" /> : null}
      <span className="lg-badge-name" aria-hidden="true">{l ? l.name : 'UNRANKED'}</span>
      {l && place ? <b className="lg-badge-n" aria-hidden="true">#{formatNum(Number(rank))}</b> : null}
      {l && range ? <span className="lg-badge-range" aria-hidden="true">{rangeLabel(l)}</span> : null}
    </span>
  );
}
