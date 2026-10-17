// UnlistedStrip.jsx — THE UNLISTED row at the foot of the INDEX. "UNLISTED · ?/?" and one tile per gear: an unfound
// tile is the ink stamp + its riddle (unlisted.unlistedIndex is the mask — it carries no name, art or odds to leak);
// a found one is the card with its serial. Tap a found one → its sheet (the card, how it was found, WEAR).
// Snapshotted on mount like the rest of the index (no tile moves under the pointer). Nothing loops.
import { useEffect, useRef, useState } from 'react';
import { unlistedIndex, formatSerial } from './unlisted.js';
import { mainTag } from '../progress/markRollsCore.js';
import UnlistedCard from './UnlistedCard.jsx';
import './UnlistedStrip.css';

export default function UnlistedStrip({ worn = null, onWear = null }) {
  const [idx] = useState(() => unlistedIndex());
  const [sel, setSel] = useState(null);
  // a find still waiting on its serial asks again here (lazy — the leaderboard client loads only if one is pending)
  useEffect(() => {
    if (!idx.tiles.some((t) => t.owned && t.serial == null)) return;
    import('./serial.js').then((m) => m.retryPendingSerials()).catch(() => { /* stays pending */ });
  }, [idx]);
  const tile = sel ? idx.tiles.find((t) => t.id === sel) : null;
  return (
    <section className="ul-strip" aria-label="Unlisted gear" data-testid="unlisted-strip">
      <header className="ul-strip-head">
        <h3 className="ul-strip-title">UNLISTED</h3>
        <span className="ul-strip-count" data-testid="unlisted-count">{idx.label}</span>
        <span className="ul-strip-note">NOT ROLLED · NOT SOLD · FOUND</span>
      </header>
      <div className="ul-strip-row" role="list">
        {idx.tiles.map((t) => (
          <div key={t.id} role="listitem" className="ul-strip-cell">
            {t.owned ? (
              <button
                type="button"
                className={`ul-strip-btn${worn === t.id ? ' is-on' : ''}`}
                aria-haspopup="dialog"
                aria-label={`${t.name}, unlisted, ${formatSerial(t.serial)}${worn === t.id ? ', equipped' : ''}`}
                onClick={() => setSel(t.id)}
              >
                <UnlistedCard tile={t} />
                {worn === t.id ? <span className="mx-tile-main">EQUIPPED</span> : null}
              </button>
            ) : (
              <div className="ul-strip-btn is-masked" aria-label={`Unlisted, undiscovered: ${t.riddle}`}>
                <UnlistedCard tile={t} />
              </div>
            )}
          </div>
        ))}
      </div>
      {tile ? <UnlistedSheet tile={tile} on={worn === tile.id} onWear={onWear} onClose={() => setSel(null)} /> : null}
    </section>
  );
}

const fmtDate = (ms) => {
  try { return ms ? new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase() : ''; } catch { return ''; }
};

/** The detail sheet for one FOUND gear (the index's own sheet classes, so it sits like a GearSheet). */
export function UnlistedSheet({ tile, on, onWear, onClose, peek = false }) {
  const closeRef = useRef(null);
  useEffect(() => { closeRef.current?.focus(); }, [tile.id]);
  return (
    <div className="mx-sheet-layer" onClick={onClose}>
      <div className="mx-sheet ul-sheet" role="dialog" aria-modal="true" aria-label={tile.name} data-mark={tile.id} onClick={(ev) => ev.stopPropagation()}>
        <button type="button" className="mx-close mx-sheet-close" onClick={onClose} aria-label="Close" ref={closeRef}>✕</button>
        <div className="ul-sheet-card"><UnlistedCard tile={tile} size="hero" /></div>
        <div className="mx-sheet-body ul-sheet-body">
          <img className="ul-sheet-stamp" src="/fx/unlisted-stamp.webp" alt="UNLISTED" width="560" height="268" />
          <div className="mx-main" data-testid="mark-main">
            <span className="mx-main-num">{mainTag(tile.id).split(' ')[0]}</span>
            <span className="mx-main-kind">{mainTag(tile.id).split(' ').slice(1).join(' ')}</span>
          </div>
          <p className="ul-sheet-riddle">“{tile.riddle}”</p>
          <div className="mx-sheet-facts">
            <span data-testid="unlisted-serial">FINDER {formatSerial(tile.serial)}</span>
            {tile.word ? <span>FOUND WITH {tile.word}</span> : null}
            {!peek && tile.at ? <span>{fmtDate(tile.at)}</span> : null}
          </div>
          {onWear && !peek ? (
            <div className="mx-sheet-actions">
              <button type="button" className={`mx-set${on ? ' is-on' : ''}`} data-testid="gear-equip" onClick={() => onWear(on ? null : tile.id)}>
                {on ? 'UNEQUIP' : 'EQUIP'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
