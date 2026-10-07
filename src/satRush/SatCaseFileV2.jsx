// SatCaseFileV2.jsx — the SEASON 2 SAT RUSH run-over (claude/mockups/v2/SatRush.dc.html, "CASE CLOSED"): a manila case
// file with the CASE CLOSED stamp slammed across its corner. Left: CAPTURED (the big number) + "N GOT AWAY" + the run's
// pips. Right: the case numbers (avg ante, best streak, hardest, score, mastered) and then EVERY credit of the run on
// its own line — the wins the words banked, each bonus credit, the gems — then RUN IT BACK / MENU. Fits every screen
// without a scrollbar (the study lists the live card carries are cut to the one hardest word).
//
// Same data and the same exits as SatRushResults (flag OFF keeps that card). Motion: the stamp slams once (kitPlay),
// the two numbers count up once; REDUCE MOTION shows the end state.
import { useEffect, useRef, useState } from 'react';
import { formatNum } from '../format';
import { createCountUp } from '../juice/countUp';
import { kitPlay } from '../components/kit/motion.js';
import { reduceMotion } from '../lib/reduceMotion.js';
import * as juice from './juice';
import TryModeRow from '../share/TryModeRow.jsx';
import RebirthReadyButton from '../components/RebirthReadyButton.jsx';
import { GemsEarnedLine } from '../components/gems/Gems';
import { MORE_MODES } from '../gameData';
import './SatV2.css';

const SLAM = [
  { transform: 'rotate(-12deg) scale(2.4)', opacity: 0 },
  { transform: 'rotate(-12deg) scale(.92)', opacity: 1, offset: 0.55 },
  { transform: 'rotate(-12deg) scale(1.05)', offset: 0.75 },
  { transform: 'rotate(-12deg) scale(1)', opacity: 1 },
];

export default function SatCaseFileV2({ results, winsEarned = 0, winsBonusLines = [], gemsSince = 0, onAgain, onExit, offerMenu = false }) {
  const captured = results.cleared || 0;
  const wins = winsEarned || 0;
  const bonus = (winsBonusLines || []).filter((l) => l && l.kind === 'bonus' && l.amount > 0);
  const [n, setN] = useState(0);
  const [w, setW] = useState(0);
  const stampRef = useRef(null);
  useEffect(() => {
    juice.resultsStamp();
    kitPlay(stampRef.current, SLAM, { duration: 520, easing: 'cubic-bezier(.2,1.2,.4,1)', delay: 180 });
    if (reduceMotion() || !(Math.max(captured, wins) > 0)) {
      setN(captured);
      setW(wins);
      return undefined;
    }
    const target = Math.max(captured, wins);
    const cu = createCountUp({
      initial: 0,
      onFrame: (v) => {
        const p = Math.min(1, v / target);
        setN(Math.round(captured * p));
        setW(Math.round(wins * p));
      },
      onDone: () => { setN(captured); setW(wins); },
    });
    cu.to(target);
    return () => cu.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const avgAnte = results.avgAnte ? `${Number(results.avgAnte).toFixed(1)}×` : '—';
  const hardest = results.hardestWord ? results.hardestWord.word.toUpperCase() : '—';
  const log = Array.isArray(results.runLog) ? results.runLog.slice(-16) : [];
  return (
    <div className="sat2-over">
      <div className="sat2-file">
        <div className="sat2-file-tab" aria-hidden="true" />
        <div className="sat2-sheet">
          <div className="sat2-sheet-h">
            <span>CASE FILE · SAT RUSH</span>
            <span translate="no">{formatNum(captured + (results.missed || 0))} WORDS</span>
          </div>
          <div ref={stampRef} className="sat2-closed" role="img" aria-label="Case closed">CASE CLOSED</div>
          <div className="sat2-sheet-b">
            <div className="sat2-capt">
              <span className="sat2-capt-k">CAPTURED</span>
              <b className="sat2-capt-n" translate="no">{formatNum(n)}</b>
              <span className="sat2-away">{formatNum(results.missed || 0)} GOT AWAY</span>
              {log.length ? (
                <span className="sat2-run" aria-label="run timeline">
                  {log.map((e, i) => (
                    <i key={i} className={`sat2-pip${e.ok ? (e.silver ? ' is-silver' : ' is-ok') : ' is-miss'}`} />
                  ))}
                </span>
              ) : null}
            </div>
            <dl className="sat2-facts">
              <div><dt>AVG ANTE</dt><dd translate="no">{avgAnte}</dd></div>
              <div><dt>BEST STREAK</dt><dd translate="no">{formatNum(results.bestStreak || 0)}</dd></div>
              <div><dt>HARDEST</dt><dd translate="no">{hardest}</dd></div>
              <div><dt>SCORE</dt><dd translate="no">{formatNum(results.score || 0)}</dd></div>
              <div className="sat2-fact-wins" data-wins-line="WINS EARNED" data-wins-amount={wins}>
                <dt>WINS EARNED</dt>
                <dd translate="no">{wins > 0 ? `+${formatNum(w)}` : 'CAPTURE 3 TO EARN'}</dd>
              </div>
              {bonus.map((l) => (
                <div key={l.id} className="sat2-fact-wins" data-wins-line={l.label} data-wins-amount={l.amount}>
                  <dt>{String(l.label || '').toUpperCase()}</dt>
                  <dd translate="no">+{formatNum(l.amount)}</dd>
                </div>
              ))}
            </dl>
            <div className="sat2-gems"><GemsEarnedLine since={gemsSince} /></div>
            <div className="sat2-actions">
              <RebirthReadyButton onGo={onExit} className="is-sat" />
              <button type="button" className="sat2-btn sat2-btn--go" onClick={onAgain}>RUN IT BACK</button>
              {offerMenu ? (
                <button type="button" className="sat2-btn" onClick={onExit}>{`SEE ${MORE_MODES} MORE MODES`}</button>
              ) : (
                <button type="button" className="sat2-btn" onClick={onExit}>MENU</button>
              )}
            </div>
            {offerMenu ? null : <div className="sat2-try"><TryModeRow current="sat-rush" /></div>}
          </div>
        </div>
      </div>
    </div>
  );
}
