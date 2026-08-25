// ShopScreen.jsx — the cosmetic shop overlay (opened from the loud top-right SHOP button or
// the menu Wins chip). Two TABS: SHOP (pop-style + sound-pack item cards with OWNED /
// EQUIPPED state; unaffordable items visible-but-dimmed with the price shown) and REBIRTH
// (its own screen — count, multiplier, next threshold, what's lost/kept, and the action,
// disabled with the requirement shown when not eligible). Mode-dialog styling; static — no
// animation beyond the buttons' existing hover/press.
import { useEffect, useRef, useState } from 'react';
import './ShopScreen.css';
import { POP_STYLES, SOUND_PACKS, getOwned, getEquipped, buy, equip, buyKeyPower, buyKeyPowerMax } from '../progress/shop';
import { getWins } from '../progress/wins';
import { loadProgress, levelFromXp, getRebirths, rebirthThreshold, rebirthMult, doRebirth, getKeyPower, keyPowerCost, keyPowerBaseXp, keyPowerNextDoubler } from '../progress/xp';
import { formatNum } from '../format';

export default function ShopScreen({ onBack }) {
  const [wins, setWins] = useState(() => getWins());
  const [owned, setOwned] = useState(() => new Set(getOwned()));
  const [equipped, setEquipped] = useState(() => getEquipped());
  const [tab, setTab] = useState('shop'); // 'shop' | 'rebirth'
  const [confirming, setConfirming] = useState(false);
  const [keyPower, setKeyPower] = useState(() => getKeyPower());
  const overlayRef = useRef(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  // A11y: move focus into the dialog on open; Escape closes it. Once on mount (ref keeps the
  // latest onBack) so re-renders never re-steal focus.
  useEffect(() => {
    overlayRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onBackRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const level = levelFromXp(loadProgress().xp).level;
  const rebirths = getRebirths();
  const threshold = rebirthThreshold(rebirths);
  const nextMult = rebirthMult(rebirths + 1);
  const rebirthReady = level >= threshold;

  const refresh = () => {
    setWins(getWins());
    setOwned(new Set(getOwned()));
    setEquipped(getEquipped());
    setKeyPower(getKeyPower());
  };
  const onBuy = (id) => {
    if (buy(id).ok) refresh();
  };
  const onBuyKeyPower = () => {
    if (buyKeyPower().ok) refresh();
  };
  const onBuyKeyPowerMax = () => {
    if (buyKeyPowerMax().ok) refresh();
  };
  const onEquip = (id) => {
    if (equip(id)) setEquipped(getEquipped());
  };
  const confirmRebirth = () => {
    doRebirth(); // zeroes xp; queues the REBIRTH N celebration for the menu
    setConfirming(false);
    onBack();
  };
  const goTab = (next) => {
    setTab(next);
    setConfirming(false);
  };

  const Card = ({ item, type }) => {
    const isOwnedItem = owned.has(item.id);
    const isEquipped = equipped[type] === item.id;
    const affordable = wins >= item.price;
    const cls = isEquipped ? 'equipped' : isOwnedItem ? 'owned' : affordable ? 'buy' : 'locked';
    return (
      <div className={`shop-card is-${cls}`}>
        <div className="shop-card-name">{item.name}</div>
        <div className="shop-card-blurb">{item.blurb}</div>
        {item.xpMult > 1 && (
          <div className="shop-card-xp">+{Math.round((item.xpMult - 1) * 100)}% XP</div>
        )}
        {isEquipped ? (
          <div className="shop-card-tag">EQUIPPED</div>
        ) : isOwnedItem ? (
          <button type="button" className="shop-card-btn" onClick={() => onEquip(item.id)}>
            EQUIP
          </button>
        ) : affordable ? (
          <button type="button" className="shop-card-btn" onClick={() => onBuy(item.id)}>
            <span className="shop-coin" aria-hidden="true" />
            {formatNum(item.price)}
          </button>
        ) : (
          <div className="shop-card-price">
            <span className="shop-coin" aria-hidden="true" />
            {formatNum(item.price)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="shop-overlay" role="dialog" aria-modal="true" aria-label="Shop" tabIndex={-1} ref={overlayRef}>
      <div className="shop-panel">
        <div className="shop-header">
          <h2 className="shop-title">SHOP</h2>
          <div className="shop-wins" aria-label={`${wins} wins`}>
            <span className="shop-coin" aria-hidden="true" />
            {formatNum(wins)}
          </div>
          <button type="button" className="shop-close" onClick={onBack} aria-label="Back to menu">
            ✕
          </button>
        </div>

        <div className="shop-tabs" role="tablist" aria-label="Shop sections">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'shop'}
            className={`shop-tab${tab === 'shop' ? ' is-active' : ''}`}
            onClick={() => goTab('shop')}
          >
            SHOP
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'rebirth'}
            className={`shop-tab${tab === 'rebirth' ? ' is-active' : ''}`}
            onClick={() => goTab('rebirth')}
          >
            REBIRTH
          </button>
        </div>

        {tab === 'shop' ? (
          <div className="shop-body">
            <h3 className="shop-subtitle">KEY POWER</h3>
            <div className="shop-keypower">
              <div className="shop-kp-info">
                {/* Current base XP per letter — the value, never a level. */}
                <div className="shop-kp-current">
                  <b>{formatNum(keyPowerBaseXp(keyPower))}</b> XP PER LETTER
                </div>
                {/* What the next purchase gives + what it costs. */}
                <div className="shop-kp-next">
                  NEXT: <b>{formatNum(keyPowerBaseXp(keyPower + 1))} XP</b>
                  {'  ·  '}
                  <b>
                    <span className="shop-coin" aria-hidden="true" /> {formatNum(keyPowerCost(keyPower))} WINS
                  </b>
                </div>
                {/* The milestone doubler ahead — the exponential jump every 10th purchase. */}
                <div className="shop-kp-doubler">
                  {(() => {
                    const d = keyPowerNextDoubler(keyPower);
                    return `×2 AT ${d.at} PURCHASES (${d.toGo} TO GO)`;
                  })()}
                </div>
              </div>
              <div className="shop-kp-actions">
                <button
                  type="button"
                  className="shop-card-btn"
                  disabled={wins < keyPowerCost(keyPower)}
                  onClick={onBuyKeyPower}
                >
                  <span className="shop-coin" aria-hidden="true" />
                  {formatNum(keyPowerCost(keyPower))}
                </button>
                <button
                  type="button"
                  className="shop-card-btn ghost"
                  disabled={wins < keyPowerCost(keyPower)}
                  onClick={onBuyKeyPowerMax}
                >
                  BUY MAX
                </button>
              </div>
            </div>

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
        ) : (
          <div className="shop-body">
            <div className="shop-rebirth-stats">
              <div className="shop-rb-stat">
                <span>REBIRTHS</span>
                <b>{rebirths}</b>
              </div>
              <div className="shop-rb-stat">
                <span>CURRENT MULTIPLIER</span>
                <b>×{rebirthMult(rebirths).toFixed(1)}</b>
              </div>
              <div className="shop-rb-stat">
                <span>NEXT REBIRTH AT</span>
                <b>LEVEL {threshold}</b>
              </div>
            </div>

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

            {rebirthReady ? (
              confirming ? (
                <div className="shop-confirm-actions">
                  <button type="button" className="shop-card-btn danger" onClick={confirmRebirth}>
                    CONFIRM REBIRTH {rebirths + 1}
                  </button>
                  <button type="button" className="shop-card-btn ghost" onClick={() => setConfirming(false)}>
                    CANCEL
                  </button>
                </div>
              ) : (
                <button type="button" className="shop-rebirth" onClick={() => setConfirming(true)}>
                  REBIRTH {rebirths + 1} — GAIN ×{nextMult.toFixed(1)} XP
                </button>
              )
            ) : (
              <button type="button" className="shop-rebirth" disabled aria-disabled="true">
                REACH LEVEL {threshold} TO REBIRTH — YOU'RE LV {level}
              </button>
            )}
          </div>
        )}

        <button type="button" className="shop-back" onClick={onBack}>
          ← BACK TO MENU
        </button>
      </div>
    </div>
  );
}
