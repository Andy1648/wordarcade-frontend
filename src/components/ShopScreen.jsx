// ShopScreen.jsx — the SHOP / REBIRTH overlay. Which one it shows is set by `initialView`
// (the menu now has TWO top-corner icons — SHOP and REBIRTH — each opening straight into its
// own view; there are no in-panel tabs). SHOP: Key Power tier + pop-style / sound-pack cards
// (OWNED / EQUIPPED state; unaffordable items visible-but-dimmed). REBIRTH: count, multiplier,
// next threshold, what's lost/kept, and the action (disabled with the requirement shown when
// not eligible). Mode-dialog styling; static — no animation beyond the buttons' hover/press.
import { useEffect, useRef, useState } from 'react';
import './ShopScreen.css';
import { POP_STYLES, SOUND_PACKS, getOwned, getEquipped, buy, equip, buyKeyPower, buyWordSense } from '../progress/shop';
import { getWordSenseTier, wordSenseCost, wordSenseFactor } from '../progress/wordSense';
import {
  THEMES,
  themeById,
  getOwnedThemes,
  isThemeOwned,
  syncThemeUnlocks,
  buyTheme,
  getEquippedTheme,
  setEquippedTheme,
} from '../theme/themes';
import { getWins, saveWins, perWordWins } from '../progress/wins';
import { loadProgress, getRebirths, rebirthThreshold, rebirthMult, doRebirth, getKeyTier, keyTierCost, keyTierXp } from '../progress/xp';
import { formatNum } from '../format';
import { sndPurchase, sndRebirth } from '../audio/gameSounds';

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const toRoman = (n) => ROMAN[n] || String(n);

export default function ShopScreen({ onBack, initialView = 'shop' }) {
  const view = initialView === 'rebirth' ? 'rebirth' : 'shop'; // fixed per open; the two icons pick it
  const [wins, setWins] = useState(() => getWins());
  const [owned, setOwned] = useState(() => new Set(getOwned()));
  const [equipped, setEquipped] = useState(() => getEquipped());
  const [confirming, setConfirming] = useState(false);
  const [keyTier, setKeyTier] = useState(() => getKeyTier());
  const [wsTier, setWsTier] = useState(() => getWordSenseTier());
  // THEMES: grant any level-unlocked themes on open, then read owned + equipped.
  const [ownedThemes, setOwnedThemes] = useState(() => {
    syncThemeUnlocks(loadProgress().level);
    return getOwnedThemes();
  });
  const [equippedTheme, setEquippedThemeState] = useState(() => getEquippedTheme());
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

  // §3 — the shop always shows a visible NEXT GOAL with a progress bar. KEY POWER's
  // next tier is always a goal (there's always a next tier); rebirth shows level
  // progress; and the cheapest unowned cosmetic is surfaced as the fallback goal.
  const kpCost = keyTierCost(keyTier);
  const kpProgress = kpCost > 0 ? Math.min(1, wins / kpCost) : 1;
  const wsCost = wordSenseCost(wsTier);
  const wsProgress = wsCost > 0 ? Math.min(1, wins / wsCost) : 1;
  const rbProgress = threshold > 0 ? Math.min(1, level / threshold) : 1;
  const cheapestUnowned = [...POP_STYLES, ...SOUND_PACKS]
    .filter((i) => !owned.has(i.id))
    .sort((a, b) => a.price - b.price)[0] || null;

  const [reveal, setReveal] = useState(null);
  const refresh = () => {
    setWins(getWins());
    setOwned(new Set(getOwned()));
    setEquipped(getEquipped());
    setKeyTier(getKeyTier());
    setWsTier(getWordSenseTier());
  };
  const onBuy = (id) => {
    if (buy(id).ok) {
      sndPurchase();
      const item = [...POP_STYLES, ...SOUND_PACKS].find((i) => i.id === id);
      // §2 reveal — cosmetics preview in the item's pop colour (a bought STYLE recolours
      // the pop; here we flash it so you SEE it).
      setReveal({ kind: 'cosmetic', banner: `${(item ? item.name : 'ITEM').toUpperCase()} UNLOCKED`, colour: '#FF2EC4', previewChar: 'A' });
      refresh();
    }
  };
  const onBuyKeyPower = () => {
    const nextTier = keyTier + 1;
    if (buyKeyPower().ok) {
      sndPurchase();
      const colour = nextTier >= 5 ? '#FFD54A' : '#2EFFE0';
      setReveal({ kind: 'keypower', banner: `KEY POWER ${toRoman(nextTier)} UNLOCKED`, colour, previewChar: 'A' });
      refresh();
    }
  };
  const onBuyWordSense = () => {
    const nextTier = wsTier + 1;
    if (buyWordSense().ok) {
      setReveal({ kind: 'keypower', banner: `WORD SENSE ${toRoman(nextTier)} UNLOCKED`, colour: '#FFD54A', previewChar: 'A' });
      refresh();
    }
  };
  const onEquip = (id) => {
    if (equip(id)) setEquipped(getEquipped());
  };
  // THEMES: buy → reveal ritual → apply live (setEquippedTheme repaints the root immediately, so
  // the shop + menu behind it recolor the instant the theme lands). Equipping an owned theme is
  // instant + live too.
  const onBuyTheme = (id) => {
    const r = buyTheme(id, { getWins, saveWins });
    if (r.ok) {
      sndPurchase();
      const t = themeById(id);
      setReveal({ kind: 'theme', banner: `${t.name} UNLOCKED`, colour: t.vars['--theme-ink'], previewChar: 'A' });
      setOwnedThemes(getOwnedThemes());
      setWins(getWins());
      setEquippedTheme(id); // apply the just-bought theme live
      setEquippedThemeState(getEquippedTheme());
    }
  };
  const onEquipTheme = (id) => {
    if (setEquippedTheme(id)) setEquippedThemeState(getEquippedTheme());
  };
  const confirmRebirth = () => {
    const gained = nextMult;
    doRebirth(); // zeroes xp; queues the REBIRTH N celebration for the menu
    sndRebirth(); // Job 11: rebirth swell
    setConfirming(false);
    // §2 rebirth reveal (700ms) with the new multiplier stamped large, THEN close.
    setReveal({ kind: 'rebirth', banner: `×${formatNum(gained)} MULTIPLIER`, colour: '#9A1AFF', previewChar: '↑', onClose: onBack });
  };

  // §2 press-and-hold buy button — defined below the component (HoldBuy). This alias
  // keeps the Card markup readable.
  const HoldBuyButton = (props) => <HoldBuy {...props} />;

  // Thin progress bar — transform: scaleX ONLY (never width), no layout read (§2/§3).
  const ProgressBar = ({ value }) => (
    <div className="shop-progress" aria-hidden="true">
      <div className="shop-progress-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})` }} />
    </div>
  );

  const Card = ({ item, type }) => {
    const isOwnedItem = owned.has(item.id);
    const isEquipped = equipped[type] === item.id;
    const affordable = wins >= item.price;
    const isNextGoal = !isOwnedItem && cheapestUnowned && item.id === cheapestUnowned.id;
    const cls = isEquipped ? 'equipped' : isOwnedItem ? 'owned' : affordable ? 'buy' : 'locked';
    return (
      <div className={`shop-card is-${cls}${isNextGoal ? ' is-next' : ''}`}>
        {isNextGoal && <div className="shop-card-next" aria-hidden="true">NEXT</div>}
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
          <HoldBuyButton label={formatNum(item.price)} onCommit={() => onBuy(item.id)} />
        ) : (
          <>
            <div className="shop-card-price">
              <span className="shop-coin" aria-hidden="true" />
              {formatNum(item.price)}
            </div>
            {/* §3 — an unaffordable card always shows the GAP + a progress bar. */}
            <div className="shop-card-gap">YOU HAVE {formatNum(wins)}</div>
            <ProgressBar value={item.price > 0 ? wins / item.price : 1} />
          </>
        )}
      </div>
    );
  };

  // THEME card: a real PALETTE SWATCH (flat colour strip, not a text label) is the preview, then
  // the name, a free-at-level note for gated themes, and EQUIPPED / EQUIP / buy / locked+progress
  // — the same states as the cosmetic cards, so themes read as first-class shop goods.
  const ThemeCard = ({ theme }) => {
    const ownedT = isThemeOwned(theme.id, ownedThemes);
    const isEq = equippedTheme === theme.id;
    const affordable = wins >= theme.price;
    const cls = isEq ? 'equipped' : ownedT ? 'owned' : affordable ? 'buy' : 'locked';
    return (
      <div className={`shop-card shop-theme-card is-${cls}`}>
        <div className="shop-theme-swatch" aria-hidden="true">
          {theme.swatch.map((c, i) => (
            <span key={i} style={{ background: c }} />
          ))}
        </div>
        <div className="shop-card-name">{theme.name}</div>
        {theme.unlockLevel > 0 && !ownedT && (
          <div className="shop-theme-gate">FREE AT LV {theme.unlockLevel}</div>
        )}
        {isEq ? (
          <div className="shop-card-tag">EQUIPPED</div>
        ) : ownedT ? (
          <button type="button" className="shop-card-btn" onClick={() => onEquipTheme(theme.id)}>
            EQUIP
          </button>
        ) : affordable ? (
          <HoldBuyButton label={formatNum(theme.price)} onCommit={() => onBuyTheme(theme.id)} />
        ) : (
          <>
            <div className="shop-card-price">
              <span className="shop-coin" aria-hidden="true" />
              {formatNum(theme.price)}
            </div>
            <div className="shop-card-gap">YOU HAVE {formatNum(wins)}</div>
            <ProgressBar value={theme.price > 0 ? wins / theme.price : 1} />
          </>
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
            {/* THEMES — the headline section, ABOVE key power. Each card previews the real palette. */}
            <h3 className="shop-subtitle">THEMES — RECOLOR YOUR MENU</h3>
            <div className="shop-grid shop-theme-grid">
              {THEMES.map((t) => (
                <ThemeCard key={t.id} theme={t} />
              ))}
            </div>
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
                {/* §3 — the shop always shows this next goal + progress (there is always a next tier). */}
                <div className="shop-goal">
                  {wins >= kpCost ? 'READY TO UNLOCK' : `UNLOCKS AT ${formatNum(kpCost)} WINS — YOU HAVE ${formatNum(wins)}`}
                </div>
                <ProgressBar value={kpProgress} />
              </div>
              <div className="shop-kp-actions">
                {wins >= kpCost ? (
                  <HoldBuyButton label={formatNum(kpCost)} onCommit={onBuyKeyPower} />
                ) : (
                  <button type="button" className="shop-card-btn" disabled>
                    <span className="shop-coin" aria-hidden="true" />
                    {formatNum(kpCost)}
                  </button>
                )}
              </div>
            </div>

            {/* WORD SENSE (Job 4): the SECOND permanent wins sink, parallel to KEY POWER. Buys the
                wins multiplier per rarity tier — knowing rare words pays more the more you invest. */}
            <h3 className="shop-subtitle">WORD SENSE — TIER {wsTier}</h3>
            <div className="shop-keypower">
              <div className="shop-kp-info">
                <div className="shop-kp-current">
                  <b>×{wordSenseFactor(wsTier).toFixed(wsTier > 3 ? 0 : 2)}</b> ON WORD RARITY (WINS)
                </div>
                <div className="shop-kp-next">
                  NEXT TIER: <b>×{wordSenseFactor(wsTier + 1).toFixed(wsTier + 1 > 3 ? 0 : 2)}</b>
                  {'  ·  '}
                  <b><span className="shop-coin" aria-hidden="true" /> {formatNum(wsCost)} WINS</b>
                </div>
                <div className="shop-kp-rate">
                  RARE WORDS PAY MORE — COMMON WORDS UNCHANGED
                </div>
                <div className="shop-goal">
                  {wins >= wsCost ? 'READY TO UNLOCK' : `UNLOCKS AT ${formatNum(wsCost)} WINS — YOU HAVE ${formatNum(wins)}`}
                </div>
                <ProgressBar value={wsProgress} />
              </div>
              <div className="shop-kp-actions">
                {wins >= wsCost ? (
                  <HoldBuyButton label={formatNum(wsCost)} onCommit={onBuyWordSense} />
                ) : (
                  <button type="button" className="shop-card-btn" disabled>
                    <span className="shop-coin" aria-hidden="true" />
                    {formatNum(wsCost)}
                  </button>
                )}
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

            {/* §3 — rebirth always shows how far to the next rebirth + progress. */}
            <div className="shop-goal">
              {rebirthReady ? 'READY TO REBIRTH' : `${threshold - level} LEVELS TO GO — LV ${level} / ${threshold}`}
            </div>
            <ProgressBar value={rbProgress} />

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
      {reveal && <ShopReveal reveal={reveal} onDone={() => setReveal(null)} />}
    </div>
  );
}

// §2 — press-and-HOLD to buy: the button fills over holdMs; releasing early cancels
// (the tension beat). The fill is a WAAPI scaleX (never width); commit fires on the
// animation's finish. No layout reads. Pooled is N/A (one fill per button instance).
function HoldBuy({ label, onCommit, holdMs = 400, className = 'shop-card-btn' }) {
  const fillRef = useRef(null);
  const animRef = useRef(null);
  const start = () => {
    const fill = fillRef.current;
    if (!fill || animRef.current) return;
    const a = fill.animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: holdMs, easing: 'linear', fill: 'forwards' }
    );
    animRef.current = a;
    a.onfinish = () => {
      animRef.current = null;
      fill.style.transform = 'scaleX(0)';
      onCommit();
    };
  };
  const cancel = () => {
    const a = animRef.current;
    if (a) {
      a.cancel();
      animRef.current = null;
    }
    if (fillRef.current) fillRef.current.style.transform = 'scaleX(0)';
  };
  return (
    <button
      type="button"
      className={`${className} shop-hold`}
      onPointerDown={(e) => { e.preventDefault(); start(); }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      aria-label={`Hold to buy for ${label}`}
    >
      <span className="shop-hold-fill" ref={fillRef} aria-hidden="true" />
      <span className="shop-hold-label">
        <span className="shop-coin" aria-hidden="true" /> {label}
      </span>
    </button>
  );
}

// §2 — the REVEAL: an SVG badge slams in, a one-line banner names what unlocked, and a
// live pop preview fires ONCE so you see what you bought. All finite/one-shot WAAPI
// (transform+opacity only); auto-dismisses. Zero new infinite animations.
function ShopReveal({ reveal, onDone }) {
  const badgeRef = useRef(null);
  const popRef = useRef(null);
  const dur = reveal.kind === 'rebirth' ? 700 : 220;
  useEffect(() => {
    const badge = badgeRef.current;
    if (badge) {
      badge.animate(
        [
          { transform: 'scale(1.6) rotate(-6deg)', opacity: 0, offset: 0 },
          { transform: 'scale(0.94) rotate(-6deg)', opacity: 1, offset: 0.55 },
          { transform: 'scale(1) rotate(-6deg)', opacity: 1, offset: 1 },
        ],
        { duration: dur, easing: 'cubic-bezier(.2,1.3,.3,1)', fill: 'both' }
      );
    }
    // Live pop preview of what you bought — one shot, tier/style colour.
    const pop = popRef.current;
    if (pop) {
      pop.style.color = reveal.colour || '#2EFFE0';
      pop.animate(
        [
          { transform: 'translateY(10px) scale(0.8)', opacity: 0, offset: 0 },
          { transform: 'translateY(-6px) scale(1.15)', opacity: 1, offset: 0.35 },
          { transform: 'translateY(-2px) scale(1)', opacity: 1, offset: 0.7 },
          { transform: 'translateY(-2px) scale(1)', opacity: 0, offset: 1 },
        ],
        { duration: 620, delay: dur - 80, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }
      );
    }
    const t = setTimeout(() => {
      onDone();
      if (reveal.onClose) reveal.onClose();
    }, dur + 1100);
    return () => clearTimeout(t);
  }, [reveal, dur, onDone]);
  return (
    <div className="shop-reveal" role="status" aria-live="polite">
      <div className="shop-reveal-card">
        {/* Real SVG asset (ART VS MOTION) — CSS only animates it (the slam). */}
        <img className="shop-reveal-badge" src="/art/star.svg" alt="" ref={badgeRef} aria-hidden="true" />
        <div className="shop-reveal-banner">{reveal.banner}</div>
        <span className="shop-reveal-pop" ref={popRef} aria-hidden="true">{reveal.previewChar || 'A'}</span>
      </div>
    </div>
  );
}
