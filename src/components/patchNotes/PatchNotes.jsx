// PatchNotes.jsx — THE PATCH NOTES popup (Andy oct11: "patch notes as a popup with a few short items that are positive
// and addicting with the new best looking cards plus a few bonus gems … after the slash animation on the menu"). LAZY
// (its own chunk) — PatchNotesHost mounts it once per release (patchNotesData PATCH_ID), on its turn in the menu moments
// queue. House style: one panel, flat fills, coloured outline + hard black shadow; the two showcase cards fan in with
// their rarity glow (hover one: the SECRET ring laps). COLLECT → the gems burst from the gift into the pill (GainLayer,
// the season-2 welcome's flight) → PLAY closes. Every motion is a finite transform/opacity one-shot; REDUCE MOTION:
// no fan / rise, the gems land at once. Closing early (Esc / ✕) still credits the gift — it is never lost.
import { useEffect, useRef, useState } from 'react';
import { KitPill, KitIcon, KitButton, useCachedCenter } from '../kit/index.js';
import GainLayer from '../gains/GainLayer.jsx';
import { countMs } from '../gains/gainPlan.js';
import MarkCard from '../markCard/MarkCard.jsx';
import GearFx from '../GearFx.jsx';
import { grantGems, getGems, ROLL_PRICE_GEMS } from '../../progress/gemsCore.js';
import { formatNum } from '../../format.js';
import { PATCH_ITEMS, PATCH_CARDS, PATCH_GIFT_ROLLS, PATCH_LABEL, PATCH_ID } from './patchNotesData.js';
import { markPatchSeen, patchSeen } from './patchSeen.js';
import './PatchNotes.css';

const TAG_TONE = { NEW: 'cyan', BUFF: 'yellow', GIFT: 'pink' };

export default function PatchNotes({ onClose }) {
  // idle → flying (gems in the air; the button is dead) → done
  const [phase, setPhase] = useState('idle');
  const [wallet, setWallet] = useState(() => getGems());
  const pill = useRef(null);
  const fly = useRef(null);
  const giftRef = useRef(null);
  const btnRef = useRef(null);
  // re-opened from the UPDATE LOG tile after the gift was collected: the notes only — the gift reads COLLECTED, never pays twice
  const [already] = useState(() => patchSeen());
  const paid = useRef(already);
  const from = useCachedCenter(giftRef);

  const giftGems = PATCH_GIFT_ROLLS * ROLL_PRICE_GEMS; // the live price (a `let` binding — season 2 swaps it)
  const pay = () => {
    if (paid.current) return 0;
    paid.current = true;
    markPatchSeen();
    return grantGems(giftGems, 'start', { detail: `patch-${PATCH_ID}` });
  };
  const close = () => {
    pay();
    onClose();
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    // the menu types on keystrokes: while the notes are up, keys belong to them (Enter/Space press the button)
    const stop = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
      }
      if (e.target && e.target.closest && e.target.closest('.pn')) return;
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', stop, true);
    if (btnRef.current && btnRef.current.focus) btnRef.current.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', stop, true);
  }, []);

  const onCollect = () => {
    if (phase === 'flying') return;
    if (phase === 'done' || already) {
      onClose();
      return;
    }
    const start = getGems();
    const got = pay();
    const target = start + got;
    if (!fly.current || got <= 0) {
      setWallet(target);
      setPhase('done');
      return;
    }
    setPhase('flying');
    fly.current.gain({
      from: from.current,
      amount: got,
      onFirstLand: () => {
        if (pill.current) pill.current.countNext(countMs(got));
        setWallet(target);
      },
      onLand: () => pill.current && pill.current.bump(),
      onDone: () => {
        setWallet(target);
        setPhase('done');
      },
    });
  };

  const rolls = PATCH_GIFT_ROLLS;
  const label = already ? 'CLOSE' : phase === 'done' ? 'PLAY' : phase === 'flying' ? 'COLLECTING' : 'COLLECT';
  return (
    <div className="pn" role="dialog" aria-modal="true" aria-labelledby="pn-title" data-testid="patch-notes" data-phase={already ? 'done' : phase}>
      <div className="pn-wallet">
        <KitPill ref={pill} kind="gems" value={wallet} ariaLabel={`Gems: ${formatNum(wallet)}`} />
      </div>
      <div className="pn-panel">
        <button type="button" className="pn-x" aria-label="Close" onClick={close} data-testid="patch-notes-close">
          ✕
        </button>
        <header className="pn-head">
          <span className="pn-ver pn-rise" style={{ '--pn-d': '0ms' }}>UPDATE · {PATCH_LABEL}</span>
          <h1 id="pn-title" className="pn-title pn-slam">PATCH NOTES</h1>
        </header>
        <div className="pn-cards" aria-hidden="true">
          {PATCH_CARDS.map((c, i) => (
            <div key={c.id} className={`pn-card pn-card-${i}`}>
              <GearFx tier={c.tier} scale={0.8} />
              <MarkCard id={c.id} tier={c.tier} name={c.name} w={132} />
            </div>
          ))}
        </div>
        <div className="pn-body">
        <ul className="pn-list">
          {PATCH_ITEMS.map((it, i) => (
            <li key={i} className="pn-item pn-rise" style={{ '--pn-d': `${260 + i * 70}ms` }}>
              <span className={`pn-tag is-${TAG_TONE[it.tag] || 'cyan'}`}>{it.tag}</span>
              <span className="pn-line">
                {it.pre}
                {it.num ? <b className="pn-num"> {it.num}</b> : null}
                {it.post ? ` ${it.post}` : null}
              </span>
            </li>
          ))}
        </ul>
        <div className="pn-gift pn-rise" style={{ '--pn-d': `${260 + PATCH_ITEMS.length * 70}ms` }}>
          <span className="pn-tag is-pink">GIFT</span>
          <span className="pn-gem" ref={giftRef}>
            <KitIcon name="gems" size={40} />
            <b className="pn-num pn-gift-num" data-testid="patch-notes-gems">{formatNum(giftGems)}</b>
          </span>
          <span className="pn-rolls">{already ? 'COLLECTED ✓' : `= ${rolls} FREE ${rolls === 1 ? 'ROLL' : 'ROLLS'}`}</span>
        </div>
        <div className="pn-foot">
          <KitButton ref={btnRef} tone={phase === 'done' ? 'yellow' : 'cyan'} label={label} labelSize={32} width={280} disabled={phase === 'flying'} onClick={onCollect} data-testid="patch-notes-collect" />
        </div>
        </div>
      </div>
      <GainLayer ref={fly} icon="gems" target={() => pill.current && pill.current.iconEl()} />
    </div>
  );
}
