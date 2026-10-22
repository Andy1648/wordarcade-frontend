// MasteryPanel.jsx — the MASTERY tab of the ACHIEVEMENTS screen (MODE MASTERY ROADS, progress/masteryRoad.js).
// Andy oct21: "you can add that in the achievements page at most … I don't want that on the main screen" — so the
// roads live HERE only: a row of the five modes, the picked mode's NEXT reward, then its whole 12-node road in one row
// (a Trophy Road per mode). It fits the achievements stage (1366×657) with no scroll; a phone stacks it.
// Art is painted (public/) only. Motion: the road's nodes rise once when a mode is picked, a claim pops its art (WAAPI
// one-shot, will-change only for the run); gems fly to the screen's pill through the parent's KitFlyLayer (onPaid).
import { useRef, useState } from 'react';
import { roadStatus, claimRoadNode, ROAD_MODES, ROAD_LEVELS } from '../../progress/masteryRoad.js';
import { formatNum } from '../../format';
import { reduceMotion } from '../../lib/reduceMotion';
import './MasteryPanel.css';

const MODES = Object.keys(ROAD_LEVELS);
const words = (n) => `${formatNum(n)} ${n === 1 ? 'WORD' : 'WORDS'}`;

function Art({ reward, size, className = '' }) {
  return <img className={`mp-art ${className}`} src={reward.art} width={size} height={size} alt="" aria-hidden="true" draggable="false" />;
}

function pop(el) {
  if (!el || reduceMotion()) return;
  el.style.willChange = 'transform';
  const a = el.animate([{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.35) rotate(-8deg)' }, { transform: 'scale(1) rotate(0)' }], { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  a.onfinish = () => { el.style.willChange = ''; };
}

/** The mode with the most rewards waiting, else the one played most (its road is the one you care about). */
function firstMode(roads) {
  return roads.reduce((a, b) => (b.ready > a.ready || (b.ready === a.ready && b.words > a.words) ? b : a), roads[0]).mode;
}

/** @param onPaid (gems, event) — the parent flies the gems to its pill */
export default function MasteryPanel({ onPaid }) {
  const [roads, setRoads] = useState(() => MODES.map(roadStatus));
  const [mode, setMode] = useState(() => firstMode(roads));
  const [said, setSaid] = useState({ i: -1, text: '' });
  const artRefs = useRef({});
  const s = roads.find((r) => r.mode === mode) || roads[0];
  const m = ROAD_MODES[s.mode];

  const claim = (i, e) => {
    const res = claimRoadNode(s.mode, i);
    if (!res.ok) return;
    const r = res.reward;
    setRoads(MODES.map(roadStatus));
    setSaid({ i, text: r.kind === 'hero' && res.gems ? `ALREADY YOURS · +${res.gems} GEMS` : res.gems ? `+${formatNum(res.gems)} GEMS` : 'UNLOCKED' });
    pop(artRefs.current[i]);
    if (res.gems && onPaid) onPaid(res.gems, e);
  };

  const next = s.next;
  return (
    <div className="mp" style={{ '--mp-c': m.color }} data-testid="mastery-panel">
      <div className="mp-modes" role="tablist" aria-label="Modes">
        {roads.map((r) => {
          const rm = ROAD_MODES[r.mode];
          const on = r.mode === s.mode;
          return (
            <button key={r.mode} type="button" role="tab" aria-selected={on} className={`mp-mode${on ? ' is-on' : ''}`} style={{ '--mp-c': rm.color }}
              data-mode={r.mode} onClick={() => { setMode(r.mode); setSaid({ i: -1, text: '' }); }}>
              <span className="mp-mode-name">{rm.name}</span>
              <span className="mp-mode-lv"><small>MASTERY</small> <b>{formatNum(r.level)}</b></span>
              <span className="mp-mode-bar" aria-hidden="true"><i style={{ transform: `scaleX(${r.ready ? 1 : r.frac})` }} /></span>
              {r.ready ? <span className="mp-dot" aria-label={`${r.ready} ready`} /> : null}
            </button>
          );
        })}
      </div>

      <section className="mp-next" aria-label={`${m.name} road`}>
        {next ? <Art reward={next.reward} size={96} className="mp-next-art" /> : null}
        <div className="mp-next-txt">
          <small>{next ? `${m.name} · NEXT AT MASTERY ${next.level}` : `${m.name} · ROAD COMPLETE`}</small>
          <b>{next ? next.reward.name : 'EVERY REWARD CLAIMED'}</b>
          {next ? (
            <>
              <span className="mp-bar" aria-hidden="true"><i style={{ transform: `scaleX(${s.frac})` }} /></span>
              <span className="mp-next-go">{words(next.toGo)} OF {m.name} TO GO</span>
            </>
          ) : <span className="mp-next-go">EVERY 5 MASTERY STILL PAYS A WINS MILESTONE</span>}
        </div>
        <div className="mp-next-side">
          <span className="mp-side-k">{s.ready ? 'READY' : 'CLAIMED'}</span>
          <b>{s.ready ? formatNum(s.ready) : `${formatNum(s.nodes.filter((n) => n.state === 'claimed').length)}/${s.nodes.length}`}</b>
        </div>
      </section>

      <ol className="mp-road" key={s.mode} aria-label="Rewards">
        {s.nodes.map((n, idx) => (
          <li key={n.i} className={`mp-node is-${n.state}`} style={{ '--i': idx }} data-testid={`road-node-${n.i}`} data-state={n.state}>
            <span className="mp-node-lv">M{n.level}</span>
            <span className="mp-node-art" ref={(el) => { artRefs.current[n.i] = el; }}><Art reward={n.reward} size={64} /></span>
            <span className="mp-node-name">{n.reward.name}</span>
            <span className="mp-node-sub">{n.reward.sub}</span>
            <span className="mp-node-act">
              {n.state === 'ready' ? (
                <button type="button" className="mp-claim" onClick={(e) => claim(n.i, e)} data-testid={`road-claim-${n.i}`} aria-label={`Claim ${n.reward.name}`}>CLAIM</button>
              ) : n.state === 'claimed' ? (
                <span className={`mp-got${said.i === n.i ? ' is-said' : ''}`}>{said.i === n.i ? said.text : '✓'}</span>
              ) : (
                <span className="mp-togo"><b>{formatNum(n.toGo)}</b> {n.toGo === 1 ? 'WORD' : 'WORDS'}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
