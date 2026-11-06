// GemsPlus.jsx — the "+" beside a gem count (Andy nov5): THE way to buy gems, from anywhere a balance shows. It joins the
// pill (KitPill draws it inside its own body), never a fixed control of its own. Nothing at all while payments are off.
// EAGER and tiny: the panel behind it (BuyGems.jsx) is its own chunk, loaded on the first tap.
import { PAYMENTS_ON } from '../../payments/flag.js';
import { isStaleChunkError, reloadOnceForStaleChunk } from '../../lib/chunkReload.js';
import './GemsPlus.css';

export function openBuyGems() {
  return import('../BuyGems.jsx').then((m) => m.mountBuyGems()).catch((err) => {
    if (isStaleChunkError(err)) reloadOnceForStaleChunk();
  });
}

export function GemsPlus({ className = '' }) {
  if (!PAYMENTS_ON) return null;
  return (
    <button type="button" className={`gems-plus ${className}`.trim()} aria-label="Buy gems" data-testid="gems-plus" onClick={openBuyGems}>
      <span className="gems-plus-face" aria-hidden="true">+</span>
    </button>
  );
}
