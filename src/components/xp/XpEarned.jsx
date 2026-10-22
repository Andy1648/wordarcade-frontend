// XpEarned.jsx — GAME XP on the end card (Andy oct21: games give XP, "it'd prob go under wins … it shouldnt look crazy").
// One line, the gems line's shape in the XP bar's yellow: the painted XP hex (/results/xp-hex.webp), "+N XP", and a
// "LV +k" chip only when the game crossed a level. Hidden when the game earned nothing (no "+0 XP" noise — the same
// rule the multiplayer ResultsCard's XP block uses). `print` = SAT RUSH's printed-page voice.
//
// ART VS MOTION: the hex is a painted asset; nothing here animates and nothing loops.
import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../../format';
import { gameXpMark, gameXpSince, subscribeGameXp } from '../../progress/gameXp';
import '../kit/tokens.css';
import './XpEarned.css';

/** The XP mark for a RUN that starts whenever `playing` turns true (a solo run, a race, a SAT run): taken on mount
 *  and on every false → true flip — never when the run ends, so the end card counts the whole run. */
export function useGameXpRunMark(playing) {
  const [since, setSince] = useState(() => gameXpMark());
  const was = useRef(!!playing);
  useEffect(() => {
    if (playing && !was.current) setSince(gameXpMark());
    was.current = !!playing;
  }, [playing]);
  return since;
}

/** The XP mark for a GAME: taken on mount and whenever `resetKey` changes (a new game). */
export function useGameXpRound(resetKey) {
  const [since, setSince] = useState(() => gameXpMark());
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSince(gameXpMark());
  }, [resetKey]);
  return since;
}

export function XpEarnedLine({ since = 0, className = '', print = false }) {
  const [got, setGot] = useState(() => gameXpSince(since));
  useEffect(() => {
    setGot(gameXpSince(since));
    return subscribeGameXp(() => setGot(gameXpSince(since)));
  }, [since]);
  const { xp, levels } = got;
  if (!(xp > 0) && !(levels > 0)) return null;
  if (print) {
    return (
      <div className={`xp-earned-print ${className}`.trim()} data-testid="xp-earned" data-xp-total={xp} data-xp-levels={levels}>
        <b>+{formatNum(xp)}</b> xp{levels > 0 ? <span className="xp-earned-print-lv"> · lv +{formatNum(levels)}</span> : null}
      </div>
    );
  }
  return (
    <div className={`xp-earned ${className}`.trim()} data-testid="xp-earned" data-xp-total={xp} data-xp-levels={levels}>
      <img className="xp-earned-hex" src="/results/xp-hex.webp" width="22" height="22" alt="" aria-hidden="true" draggable="false" />
      <span className="xp-earned-num">+{formatNum(xp)}</span>
      <span className="xp-earned-label">XP</span>
      {levels > 0 ? <span className="xp-earned-lv">LV +{formatNum(levels)}</span> : null}
    </div>
  );
}
