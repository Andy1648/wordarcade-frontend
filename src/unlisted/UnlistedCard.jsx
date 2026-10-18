// UnlistedCard.jsx — one UNLISTED gear as a card: the NEGATIVE PRINT (black stock, paper-cream ink, a static
// off-register cyan plate) with the painted sticker, its name and its serial. Used by the index strip, the detail
// sheet, the reveal and the two profile surfaces, so the tier reads the same everywhere.
//
// UNFOUND = the mask: the UNLISTED ink stamp + the riddle, nothing else — no art, no name, no odds (the tier has none).
// Motion: none at rest. `flare` plays ONE finite hover flare (transform/opacity, CSS :hover only).
import { formatSerial } from './unlisted.js';
import './UnlistedCard.css';

/**
 * @param {object} p
 * @param {object} p.tile   an unlistedIndex() tile, or { id, name, art, serial, word, owned, riddle, season }
 * @param {'tile'|'hero'|'chip'} [p.size]
 */
export default function UnlistedCard({ tile, size = 'tile' }) {
  const owned = !!(tile && tile.owned);
  return (
    <div className={`ulc ulc--${size}${owned ? ' is-owned' : ' is-masked'}`} data-tier="unlisted" data-gear={owned ? tile.id : undefined}>
      <div className="ulc-face">
        {tile && tile.season ? <span className="ulc-season">S{tile.season}</span> : null}
        {owned ? (
          <img className="ulc-art" src={tile.art} alt="" width="256" height="256" decoding="async" />
        ) : (
          <img className="ulc-mask" src="/fx/unlisted-stamp.webp" alt="" width="560" height="268" decoding="async" />
        )}
      </div>
      {owned ? (
        <div className="ulc-plate">
          <span className="ulc-name">{tile.name}</span>
          {size !== 'chip' ? <span className="ulc-serial">{formatSerial(tile.serial)}</span> : null}
        </div>
      ) : (
        <div className="ulc-plate is-riddle">
          <span className="ulc-riddle">{tile ? tile.riddle : ''}</span>
        </div>
      )}
      {owned && size === 'chip' ? <span className="ulc-serial ulc-serial--chip">{formatSerial(tile.serial)}</span> : null}
    </div>
  );
}
