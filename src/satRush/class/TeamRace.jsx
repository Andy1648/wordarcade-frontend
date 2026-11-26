// TeamRace.jsx — the TEAM RACE (nov26, Andy: "could use a little gamifying … a bit flat and boring rn").
// The server keeps the standings (chain-reaction-backend classRoom.js): every team has a lane, it moves by its
// POINTS PER PLAYER (a right answer 2, with hints 1), its CHAIN pays ×2 from 3 right answers in a row and ×3
// from 6, and any teammate's miss snaps the chain. This only draws what the server sends.
//
//   variant 'board'  the teacher's projector: one lane per team, big
//   variant 'strip'  a student's phone during a word: one compact row, their own team outlined
//   final            the set is over: the winner stamps in (one shot) above the lanes
//
// Motion: the fills slide with a 300 ms transform transition, a snapped chain jolts its lane once, the winner
// stamps once. Nothing loops.
import { useEffect, useRef, useState } from 'react';
import { rushLang } from '../rushLang';
import { formatNum, formatRate } from '../../format';
import './TeamRace.css';

function useSnaps(teams) {
  // a lane whose chain just went back to 0 gets a one-shot jolt (keyed by a counter so it can replay)
  const prev = useRef({});
  const [snaps, setSnaps] = useState({});
  useEffect(() => {
    const next = {};
    let changed = false;
    for (const t of teams) {
      const before = prev.current[t.id];
      if (before > 0 && t.chain === 0) {
        next[t.id] = (snaps[t.id] || 0) + 1;
        changed = true;
      }
      prev.current[t.id] = t.chain;
    }
    if (changed) setSnaps((s) => ({ ...s, ...next }));
    // only the chains matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.map((t) => t.chain).join(',')]);
  return snaps;
}

export function teamName(id) {
  const names = (rushLang().race || {}).names || ['RED', 'BLUE', 'GREEN', 'YELLOW'];
  return names[id] || `#${id + 1}`;
}

export default function TeamRace({ race, mine = null, variant = 'board', final = false, showSize = false }) {
  const teams = (race && race.teams) || [];
  const snaps = useSnaps(teams);
  if (!teams.length) return null;
  const R = rushLang().race || {};
  const goal = Math.max(1, race.goal || 1);
  const leaders = race.leaders || [];
  const winner = final && leaders.length === 1 ? leaders[0] : null;
  const tie = final && leaders.length > 1;
  return (
    <div className={`fr-race ${variant}${final ? ' final' : ''}`} role="group" aria-label="team race">
      {final && (winner != null || tie) && (
        <div className={`fr-race-win${winner != null ? ` t${winner}` : ''}`} role="status">
          {winner != null ? R.win(teamName(winner)) : R.tie}
        </div>
      )}
      <ol className="fr-race-lanes">
        {teams.map((t) => {
          const frac = Math.min(1, t.score / goal);
          const lead = leaders.includes(t.id) && t.score > 0;
          return (
            <li
              key={`${t.id}-${snaps[t.id] || 0}`}
              className={`fr-lane t${t.id}${mine === t.id ? ' mine' : ''}${lead ? ' lead' : ''}${snaps[t.id] ? ' snap' : ''}`}
            >
              <span className="fr-lane-name">
                {lead && <span aria-label="in the lead">▲ </span>}
                {teamName(t.id)}
                {showSize && <span className="fr-lane-size"> · {formatNum(t.size)}</span>}
              </span>
              {variant === 'board' && (
                <span className="fr-lane-track" aria-hidden="true">
                  <span className="fr-lane-fill" style={{ transform: `scaleX(${frac})` }} />
                </span>
              )}
              {/* the lobby lists the teams by size only: nobody has a chain or a score yet */}
              {!showSize && (
                <>
                  <span className={`fr-lane-chain${t.mult > 1 ? ' hot' : ''}`} aria-label={`${R.chain || 'chain'} ${t.chain}`}>
                    {t.mult > 1 ? `×${t.mult}` : t.chain > 0 ? `${t.chain}` : '·'}
                  </span>
                  <b className="fr-lane-score">{formatRate(t.score)}</b>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
