// MasteryPanel.jsx — the MASTERY tab of the ACHIEVEMENTS screen (MODE MASTERY ROADS, progress/masteryRoad.js).
// Andy oct21: the roads live in the achievements page only. Andy oct22: "it looks too AI (rigid design, stupid
// overloaded text (defining ticket), horrendous bronze badge design)" — so the road is a ROAD: one winding track the
// nodes sit ON, fillers small (wax seals, small chests), milestones big (the hero, the frame, the victory pose), every
// reward shown as its painted ART with at most a 1–2 word name. Progress is drawn ONCE — the track fills to where you
// are; the only number is the next reward's words-to-go.
// Geometry is pure data (percent coordinates per node, a laptop wave + a phone serpentine, swapped by CSS — no layout
// reads). Motion: the nodes drop in once per mode pick, a claim pops the art (WAAPI one-shot, will-change only for the
// run); gems fly to the screen's pill through the parent's KitFlyLayer (onPaid). Nothing loops at rest.
import { useRef, useState } from 'react';
import { roadStatus, claimRoadNode, ROAD_MODES, ROAD_LEVELS } from '../../progress/masteryRoad.js';
import { formatNum } from '../../format';
import { reduceMotion } from '../../lib/reduceMotion';
import { KitIcon } from '../kit/index.js';
import './MasteryPanel.css';

const MODES = Object.keys(ROAD_LEVELS);
const SHORT = { 'word-bomb': 'BOMB', 'category-blitz': 'BLITZ', 'sat-rush': 'SAT', chain: 'CHAIN', fuse: 'FUSE' };
const WEIGHT = { s: 1, m: 1.3, l: 1.85 };

/** Laptop: a wave left → right, spaced by node size (a milestone takes more road). Phone: a 3-wide serpentine. */
function layout(nodes) {
  const w = nodes.map((n) => WEIGHT[n.reward.size] || 1);
  const total = w.reduce((t, x, i) => t + (i ? (w[i - 1] + x) / 2 : 0), 0);
  let acc = 0;
  return nodes.map((n, i) => {
    if (i) acc += (w[i - 1] + w[i]) / 2;
    const x = 4 + (acc / total) * 92;
    // the wave: milestones ride the crests, fillers sit in the dips
    const y = n.reward.size === 'l' ? 28 + (i % 2) * 10 : 54 + 24 * Math.sin(i * 1.15 + 0.6);
    const r = Math.floor(i / 3);
    const c = r % 2 ? 2 - (i % 3) : i % 3;
    return { x, y, px: 18 + c * 32, py: 11 + r * 25.5 };
  });
}
const pts = (list, kx, ky) => list.map((p) => `${p[kx].toFixed(2)},${p[ky].toFixed(2)}`).join(' ');

function Art({ reward, className = '' }) {
  if (reward.kind === 'badge') {
    return (
      <span className={`mp-seal ${className}`} aria-hidden="true">
        <img src={reward.art} alt="" draggable="false" />
        <b>{reward.roman}</b>
      </span>
    );
  }
  return <img className={`mp-art ${className}`} src={reward.art} alt="" aria-hidden="true" draggable="false" />;
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

/** The track: an ink under-stroke, the empty road, and the mode-colour fill up to where you are. */
function Track({ p, reached, frac, kx, ky, className }) {
  const filled = p.slice(0, reached);
  if (reached > 0 && reached < p.length) {
    const a = p[reached - 1];
    const b = p[reached];
    filled.push({ [kx]: a[kx] + (b[kx] - a[kx]) * frac, [ky]: a[ky] + (b[ky] - a[ky]) * frac });
  }
  return (
    <svg className={`mp-track ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <polyline className="mp-track-ink" points={pts(p, kx, ky)} vectorEffect="non-scaling-stroke" />
      <polyline className="mp-track-road" points={pts(p, kx, ky)} vectorEffect="non-scaling-stroke" />
      {filled.length > 1 ? <polyline className="mp-track-fill" points={pts(filled, kx, ky)} vectorEffect="non-scaling-stroke" /> : null}
    </svg>
  );
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
    setRoads(MODES.map(roadStatus));
    setSaid({ i, text: res.gems ? `+${formatNum(res.gems)}` : 'YOURS' });
    pop(artRefs.current[i]);
    if (res.gems && onPaid) onPaid(res.gems, e);
  };

  const next = s.next;
  const geo = layout(s.nodes);
  const reached = s.nodes.filter((n) => n.state !== 'locked').length;
  return (
    <div className="mp" style={{ '--mp-c': m.color }} data-testid="mastery-panel">
      <div className="mp-modes" role="tablist" aria-label="Modes">
        {roads.map((r) => {
          const rm = ROAD_MODES[r.mode];
          const on = r.mode === s.mode;
          return (
            <button key={r.mode} type="button" role="tab" aria-selected={on} aria-label={`${rm.name} mastery ${r.level}`} className={`mp-mode${on ? ' is-on' : ''}`} style={{ '--mp-c': rm.color }}
              data-mode={r.mode} onClick={() => { setMode(r.mode); setSaid({ i: -1, text: '' }); }}>
              <span className="mp-mode-name"><span className="mp-long">{rm.name}</span><span className="mp-short">{SHORT[r.mode]}</span></span>
              <b className="mp-mode-lv">{formatNum(r.level)}</b>
              {r.ready ? <span className="mp-dot" aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>

      <section className="mp-next" aria-label={`${m.name} next reward`}>
        {next ? <Art reward={next.reward} className="mp-next-art" /> : null}
        <div className="mp-next-txt">
          <small>{next ? `NEXT · M${next.level}` : m.name}</small>
          <b>{next ? next.reward.name : 'ROAD COMPLETE'}</b>
        </div>
        {next ? (
          <div className="mp-next-go">
            {next.reward.gems ? <span className="mp-next-gems"><KitIcon name="gems" size={28} shadow={2} extras={false} />{formatNum(next.reward.gems)}</span> : null}
            <span className="mp-next-words"><b>{formatNum(next.toGo)}</b> {next.toGo === 1 ? 'WORD' : 'WORDS'} TO GO</span>
          </div>
        ) : null}
      </section>

      <div className="mp-road-wrap">
        <Track p={geo} reached={reached} frac={s.frac} kx="x" ky="y" className="mp-track--wide" />
        <Track p={geo} reached={reached} frac={s.frac} kx="px" ky="py" className="mp-track--snake" />
        <ol className="mp-road" key={s.mode} aria-label="Rewards">
          {s.nodes.map((n, idx) => {
            const g = geo[idx];
            const isNext = next && next.i === n.i;
            const body = (
              <>
                <span className="mp-node-art" ref={(el) => { artRefs.current[n.i] = el; }}><Art reward={n.reward} /></span>
                {n.state === 'ready' ? <span className="mp-tag mp-tag--claim">CLAIM</span>
                  : n.state === 'claimed' && said.i === n.i ? <span className="mp-tag mp-tag--said">{said.text}</span>
                  : <span className="mp-tag">M{n.level}</span>}
                {n.state === 'claimed' ? <span className="mp-check" aria-hidden="true">✓</span> : null}
              </>
            );
            return (
              <li key={n.i} className={`mp-node is-${n.state} is-${n.reward.size}${isNext ? ' is-next' : ''}`}
                style={{ '--x': `${g.x}%`, '--y': `${g.y}%`, '--px': `${g.px}%`, '--py': `${g.py}%`, '--i': idx }}
                data-testid={`road-node-${n.i}`} data-state={n.state} data-kind={n.reward.kind}>
                {n.state === 'ready' ? (
                  <button type="button" className="mp-node-in mp-claim" onClick={(e) => claim(n.i, e)} data-testid={`road-claim-${n.i}`} aria-label={`Claim ${n.reward.name}`}>{body}</button>
                ) : (
                  <span className="mp-node-in" role="img" aria-label={`${n.reward.name}, mastery ${n.level}${n.state === 'claimed' ? ', claimed' : ''}`}>{body}</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
