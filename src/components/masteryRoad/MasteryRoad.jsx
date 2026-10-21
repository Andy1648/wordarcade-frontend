// MasteryRoad.jsx — MODE MASTERY ROADS (progress/masteryRoad.js). Three pieces, all inside existing surfaces (no
// orphan fixed UI):
//   RoadStrip      — one row in the MODE DIALOG: mastery level, a bar to the next reward, the reward's art. Opens:
//   RoadView       — the road itself, in place of the dialog's lower half: the NEXT reward big, then every node.
// (The END-CARD line, MasteryUpLine, lives in MasteryUp.jsx: the game chunks import that, so this file and its CSS stay
// inside the mode dialog's own chunk — a shared chunk made the dialog wait on one more request.)
// Art is painted (public/) only. Motion is finite transform/opacity: rows rise once on open, a claim pops its art.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { roadStatus, claimRoadNode, ROAD_MODES } from '../../progress/masteryRoad.js';
import { formatNum } from '../../format';
import { reduceMotion } from '../../lib/reduceMotion';
import './MasteryRoad.css';

const words = (n) => `${formatNum(n)} ${n === 1 ? 'WORD' : 'WORDS'}`;

export function Art({ reward, size, className = '' }) {
  return <img className={`mr-art mr-art--${reward.kind} ${className}`} src={reward.art} width={size} height={size} alt="" aria-hidden="true" draggable="false" />;
}

/** The MODE DIALOG row: tap → the road. Hidden for a mode with no road (WORD RACE). */
export function RoadStrip({ mode, onOpen }) {
  const s = roadStatus(mode);
  if (!s) return null;
  const m = ROAD_MODES[mode];
  const show = s.nodes.find((n) => n.state === 'ready') || s.next;
  return (
    <button type="button" className="mr-strip" style={{ '--mr-c': m.color }} onClick={onOpen} data-testid="road-strip" aria-label={`${m.name} mastery road`}>
      <span className="mr-strip-lv"><small>MASTERY</small><b>{formatNum(s.level)}</b></span>
      <span className="mr-strip-mid">
        <span className="mr-strip-k">{s.ready ? `${s.ready} REWARD${s.ready > 1 ? 'S' : ''} READY` : show ? `NEXT: ${show.reward.name}` : 'ROAD COMPLETE'}</span>
        <span className="mr-bar"><span className="mr-bar-fill" style={{ transform: `scaleX(${s.ready ? 1 : s.frac})` }} /></span>
        <span className="mr-strip-go">{s.ready ? 'TAP TO CLAIM' : show ? `${words(show.toGo)} TO GO` : 'EVERY REWARD CLAIMED'}</span>
      </span>
      {show ? <Art reward={show.reward} size={52} className="mr-strip-art" /> : null}
      {s.ready ? <span className="mr-dot" aria-hidden="true" /> : null}
      <span className="mr-strip-chev" aria-hidden="true">▸</span>
    </button>
  );
}

function Node({ n, color, onClaim, rowRef, idx }) {
  const artRef = useRef(null);
  const claim = () => {
    const res = onClaim(n.i);
    if (!res || !res.ok || reduceMotion() || !artRef.current) return;
    const el = artRef.current;
    el.style.willChange = 'transform';
    const a = el.animate([{ transform: 'scale(1) rotate(0)' }, { transform: 'scale(1.35) rotate(-8deg)' }, { transform: 'scale(1) rotate(0)' }], { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    a.onfinish = () => { el.style.willChange = ''; };
  };
  return (
    <li ref={rowRef} className={`mr-node is-${n.state}`} style={{ '--mr-c': color, '--i': Math.min(idx, 8) }} data-testid={`road-node-${n.i}`} data-state={n.state}>
      <span className="mr-node-lv">M{n.level}</span>
      <span className="mr-node-rail" aria-hidden="true"><span className="mr-node-pip" /></span>
      <span className="mr-node-art" ref={artRef}><Art reward={n.reward} size={64} /></span>
      <span className="mr-node-txt">
        <b>{n.reward.name}</b>
        <small>{n.reward.sub}</small>
      </span>
      <span className="mr-node-act">
        {n.state === 'ready' ? <button type="button" className="mr-claim" onClick={claim} data-testid={`road-claim-${n.i}`}>CLAIM</button>
          : n.state === 'claimed' ? <span className="mr-got">✓</span>
            : <span className="mr-togo"><b>{formatNum(n.toGo)}</b> {n.toGo === 1 ? 'WORD' : 'WORDS'}</span>}
      </span>
    </li>
  );
}

/** The road, in place of the dialog's lower half. `onBack` returns to the dialog. */
export function RoadView({ mode, onBack }) {
  const [s, setS] = useState(() => roadStatus(mode));
  const [said, setSaid] = useState('');
  const listRef = useRef(null);
  const focusRef = useRef(null);
  const m = ROAD_MODES[mode];
  // open on the first node that wants you (ready, else next) — measured ONCE on mount, never per frame
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = focusRef.current;
    if (list && row) list.scrollTop = Math.max(0, row.offsetTop - list.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2);
  }, []);
  useEffect(() => { if (!said) return undefined; const t = setTimeout(() => setSaid(''), 2400); return () => clearTimeout(t); }, [said]);
  if (!s) return null;
  const onClaim = (i) => {
    const res = claimRoadNode(mode, i);
    if (res.ok) {
      const r = res.reward;
      setSaid(r.kind === 'hero' && res.gems ? `${r.name} WAS ALREADY YOURS · +${res.gems} GEMS` : res.gems ? `+${formatNum(res.gems)} GEMS` : `${r.name} UNLOCKED`);
      setS(roadStatus(mode));
    }
    return res;
  };
  const focus = s.nodes.find((n) => n.state === 'ready') || s.next || s.nodes[s.nodes.length - 1];
  const next = s.next;
  return (
    <div className="mr-view" style={{ '--mr-c': m.color }} data-testid="road-view">
      <div className="mr-head">
        <button type="button" className="mr-back" onClick={onBack} aria-label="Back">◂</button>
        <span className="mr-title"><b>{m.name}</b> ROAD</span>
        <span className="mr-head-lv"><small>MASTERY</small><b>{formatNum(s.level)}</b></span>
      </div>
      {next ? (
        <div className="mr-next">
          <Art reward={next.reward} size={76} className="mr-next-art" />
          <span className="mr-next-txt">
            <small>NEXT · MASTERY {next.level}</small>
            <b>{next.reward.name}</b>
            <span className="mr-bar mr-bar--big"><span className="mr-bar-fill" style={{ transform: `scaleX(${s.frac})` }} /></span>
            <span className={`mr-next-go${said ? ' is-said' : ''}`} role="status" aria-live="polite">{said || `${words(next.toGo)} OF ${m.name} TO GO`}</span>
          </span>
        </div>
      ) : (
        <div className="mr-next is-done"><span className="mr-next-txt"><b>ROAD COMPLETE</b><small role="status" aria-live="polite">{said || 'EVERY 5 MASTERY STILL PAYS A WINS MILESTONE'}</small></span></div>
      )}
      <ol className="mr-list" ref={listRef}>
        {s.nodes.map((n, idx) => (
          <Node key={n.i} n={n} idx={idx} color={m.color} onClaim={onClaim} rowRef={n === focus ? focusRef : undefined} />
        ))}
      </ol>
    </div>
  );
}
