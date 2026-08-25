// ShopScreen.jsx — the SHOP / REBIRTH overlay. Which one it shows is set by `initialView`
// (the menu now has TWO top-corner icons — SHOP and REBIRTH — each opening straight into its
// own view; there are no in-panel tabs). SHOP: Key Power tier + pop-style / sound-pack cards
// (OWNED / EQUIPPED state; unaffordable items visible-but-dimmed). REBIRTH: count, multiplier,
// next threshold, what's lost/kept, and the action (disabled with the requirement shown when
// not eligible). Mode-dialog styling; static — no animation beyond the buttons' hover/press.
import { useEffect, useRef, useState } from 'react';
import './ShopScreen.css';
import { POP_STYLES, SOUND_PACKS, getOwned, getEquipped, buy, equip, buyKeyPower } from '../progress/shop';
import { getWins, perWordWins } from '../progress/wins';
import { loadProgress, getRebirths, rebirthThreshold, rebirthMult, doRebirth, getKeyTier, keyTierCost, keyTierXp } from '../progress/xp';
import { formatNum } from '../format';

export default function ShopScreen({ onBack, initialView = 'shop' }) {
  const view = initialView === 'rebirth' ? 'rebirth' : 'shop'; // fixed per open; the two icons pick it
  const [wins, setWins] = useState(() => getWins());
  const [owned, setOwned] = useState(() => new Set(getOwned()));
  const [equipped, setEquipped] = useState(() => getEquipped());
  const [confirming, setConfirming] = useState(false);
  const [keyTier, setKeyTier] = useState(() => getKeyTier());
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

  const level = loadProgress().level;
  const rebirths = getRebirths();
  const threshold = rebirthThreshold(rebirths);
  const nextMult = rebirthMult(rebirths + 1);
  const rebirthReady = level >= threshold;

  const refresh = () => {
    setWins(getWins());
    setOwned(new Set(getOwned()));
    setEquipped(getEquipped());
    setKeyTier(getKeyTier());
  };
  const onBuy = (id) => {
    if (buy(id).ok) refresh();
  };
  const onBuyKeyPower = () => {
    if (buyKeyPower().ok) refresh();
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
    <div className="shop-overlay" role="dialog" aria-modal="true" aria-label={view === 'rebirth' ? 'Rebirth' : 'Shop'} tabIndex={-1} ref={overlayRef}>
      <div className="shop-panel">
        <div className="shop-header">
          <h2 className="shop-title">{view === 'rebirth' ? 'REBIRTH' : 'SHOP'}</h2>
          <div className="shop-wins" aria-label={`${wins} wins`}>
            <span className="shop-coin" aria-hidden="true" />
            {formatNum(wins)}
          </div>
          <button type="button" className="shop-close" onClick={onBack} aria-label="Back to menu">
            ✕
          </button>
        </div>

        {view === 'shop' ? (
          <div className="shop-body">
            <h3 className="shop-subtitle">KEY POWER — TIER {keyTier}</h3>
            <div className="shop-keypower">
              <div className="shop-kp-info">
                {/* Current XP per letter at this tier. */}
                <div className="shop-kp-current">
                  <b>{formatNum(keyTierXp(keyTier))}</b> XP PER LETTER
                </div>
                {/* What the NEXT tier gives + what it costs (one tier at a time — no buy max). */}
                <div className="shop-kp-next">
                  NEXT TIER: <b>{formatNum(keyTierXp(keyTier + 1))} XP</b>
                  {'  ·  '}
                  <b>
                    <span className="shop-coin" aria-hidden="true" /> {formatNum(keyTierCost(keyTier))} WINS
                  </b>
                </div>
                {/* Your current per-word win rate — context for how far the tier cost is. */}
                <div className="shop-kp-rate">
                  YOUR RATE: <b>{formatNum(perWordWins({ mode: 'wordBomb' }))} WINS / WORD</b>
                </div>
              </div>
              <div className="shop-kp-actions">
                <button
                  type="button"
                  className="shop-card-btn"
                  disabled={wins < keyTierCost(keyTier)}
                  onClick={onBuyKeyPower}
                >
                  <span className="shop-coin" aria-hidden="true" />
                  {formatNum(keyTierCost(keyTier))}
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
                <b>×{formatNum(rebirthMult(rebirths))}</b>
              </div>
              {/* The NEXT rebirth's level + multiplier, shown at all times (Economy v4). */}
              <div className="shop-rb-stat">
                <span>NEXT REBIRTH AT</span>
                <b>LEVEL {threshold}</b>
              </div>
              <div className="shop-rb-stat">
                <span>NEXT MULTIPLIER</span>
                <b>×{formatNum(nextMult)}</b>
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
                <b>GAIN:</b> a permanent ×{formatNum(nextMult)} XP multiplier.
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
                  REBIRTH {rebirths + 1} — GAIN ×{formatNum(nextMult)} XP
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
