// ShopScreen.jsx — the cosmetic shop overlay (from the SHOP footer link). Two sections of
// item cards (pop styles, sound packs) with OWNED / EQUIPPED state; unaffordable items are
// visible-but-dimmed with the price shown (locked content must be visible). Equipping is
// instant + free. A REBIRTH button appears only when the level threshold is met, behind a
// confirmation that states exactly what's lost and gained. Mode-dialog styling; static —
// no animation beyond the buttons' existing hover/press.
import { useState } from 'react';
import './ShopScreen.css';
import { POP_STYLES, SOUND_PACKS, getOwned, getEquipped, buy, equip } from '../progress/shop';
import { getWins } from '../progress/wins';
import { loadProgress, levelFromXp, getRebirths, rebirthThreshold, rebirthMult, doRebirth } from '../progress/xp';

export default function ShopScreen({ onBack }) {
  const [wins, setWins] = useState(() => getWins());
  const [owned, setOwned] = useState(() => new Set(getOwned()));
  const [equipped, setEquipped] = useState(() => getEquipped());
  const [confirming, setConfirming] = useState(false);

  const level = levelFromXp(loadProgress().xp).level;
  const rebirths = getRebirths();
  const nextMult = rebirthMult(rebirths + 1);
  const rebirthReady = level >= rebirthThreshold(rebirths);

  const refresh = () => {
    setWins(getWins());
    setOwned(new Set(getOwned()));
    setEquipped(getEquipped());
  };
  const onBuy = (id) => {
    if (buy(id).ok) refresh();
  };
  const onEquip = (id) => {
    if (equip(id)) setEquipped(getEquipped());
  };
  const confirmRebirth = () => {
    doRebirth(); // zeroes xp; queues the REBIRTH N celebration for the menu
    setConfirming(false);
    onBack();
  };

  const Card = ({ item, type }) => {
    const isOwnedItem = owned.has(item.id);
    const isEquipped = equipped[type] === item.id;
    const affordable = wins >= item.price;
    const cls = isEquipped ? 'equipped' : isOwnedItem ? 'owned' : affordable ? 'buy' : 'locked';
    return (
      <div className={`shop-card is-${cls}`}>
        <div className="shop-card-name">{item.name}</div>
        <div className="shop-card-mult">×{item.mult.toFixed(2)} XP</div>
        {isEquipped ? (
          <div className="shop-card-tag">EQUIPPED</div>
        ) : isOwnedItem ? (
          <button type="button" className="shop-card-btn" onClick={() => onEquip(item.id)}>
            EQUIP
          </button>
        ) : affordable ? (
          <button type="button" className="shop-card-btn" onClick={() => onBuy(item.id)}>
            <span className="shop-coin" aria-hidden="true" />
            {item.price}
          </button>
        ) : (
          <div className="shop-card-price">
            <span className="shop-coin" aria-hidden="true" />
            {item.price}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="shop-overlay" role="dialog" aria-label="Shop">
      <div className="shop-panel">
        <div className="shop-header">
          <h2 className="shop-title">SHOP</h2>
          <div className="shop-wins" aria-label={`${wins} wins`}>
            <span className="shop-coin" aria-hidden="true" />
            {wins.toLocaleString()}
          </div>
          <button type="button" className="shop-close" onClick={onBack} aria-label="Back to menu">
            ✕
          </button>
        </div>

        <div className="shop-body">
          {rebirthReady && !confirming && (
            <button type="button" className="shop-rebirth" onClick={() => setConfirming(true)}>
              REBIRTH {rebirths + 1} — GAIN ×{nextMult.toFixed(1)} XP
            </button>
          )}
          {confirming && (
            <div className="shop-confirm">
              <div className="shop-confirm-title">REBIRTH {rebirths + 1}?</div>
              <ul className="shop-confirm-detail">
                <li>
                  <b>LOSE:</b> all XP — back to LEVEL 1.
                </li>
                <li>
                  <b>KEEP:</b> wins, all purchases, lifetime stats — everything else.
                </li>
                <li>
                  <b>GAIN:</b> a permanent ×{nextMult.toFixed(1)} XP multiplier.
                </li>
              </ul>
              <div className="shop-confirm-actions">
                <button type="button" className="shop-card-btn danger" onClick={confirmRebirth}>
                  CONFIRM REBIRTH
                </button>
                <button type="button" className="shop-card-btn ghost" onClick={() => setConfirming(false)}>
                  CANCEL
                </button>
              </div>
            </div>
          )}

          <h3 className="shop-subtitle">POP STYLES</h3>
          <div className="shop-grid">
            {POP_STYLES.map((item) => (
              <Card key={item.id} item={item} type="popStyle" />
            ))}
          </div>

          <h3 className="shop-subtitle">SOUND PACKS</h3>
          <div className="shop-grid">
            {SOUND_PACKS.map((item) => (
              <Card key={item.id} item={item} type="soundPack" />
            ))}
          </div>
        </div>

        <button type="button" className="shop-back" onClick={onBack}>
          ← BACK TO MENU
        </button>
      </div>
    </div>
  );
}
