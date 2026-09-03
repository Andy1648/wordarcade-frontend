// ShopScreen.jsx — the SHOP / REBIRTH overlay. Which one it shows is set by `initialView`
// (the menu now has TWO top-corner icons — SHOP and REBIRTH — each opening straight into its
// own view; there are no in-panel tabs). SHOP: Key Power tier + pop-style / sound-pack cards
// (OWNED / EQUIPPED state; unaffordable items visible-but-dimmed). REBIRTH: count, multiplier,
// next threshold, what's lost/kept, and the action (disabled with the requirement shown when
// not eligible). Mode-dialog styling; static — no animation beyond the buttons' hover/press.
import { useEffect, useRef, useState } from 'react';
import './ShopScreen.css';
import { POP_STYLES, SOUND_PACKS, getOwned, getEquipped, buy, equip, buyKeyPower, buyWordSense, buyMomentum } from '../progress/shop';
import { getWordSenseTier, wordSenseCost, wordSenseFactor, WORDSENSE_MAX_TIER } from '../progress/wordSense';
import { getMomentum, momentumCost, momentumMult, momentumMaxed, MOMENTUM_MAX } from '../progress/momentum';
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
import { shopOpened as evShopOpened, itemPurchased as evItemPurchased, rebirth as evRebirth, refreshSessionProps } from '../lib/events.js';
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
  const [momentum, setMomentum] = useState(() => getMomentum());
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
    if (view !== 'rebirth') evShopOpened(); // analytics: the SHOP opened (the rebirth view is its own act)
    const onKey = (e) => {
      if (e.key === 'Escape') onBackRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const wsMaxed = wsTier >= WORDSENSE_MAX_TIER; // wordSenseCost returns Infinity here
  const wsCost = wordSenseCost(wsTier);
  const wsProgress = wsMaxed ? 1 : wsCost > 0 ? Math.min(1, wins / wsCost) : 1;
  const mMaxed = momentumMaxed(momentum);
  const mCost = momentumCost(momentum); // Infinity when maxed
  const mProgress = mMaxed ? 1 : mCost > 0 ? Math.min(1, wins / mCost) : 1;
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
    setMomentum(getMomentum());
  };
  const onBuy = (id) => {
    if (buy(id).ok) {
      sndPurchase();
      const item = [...POP_STYLES, ...SOUND_PACKS].find((i) => i.id === id);
      // §2 reveal — cosmetics preview in the item's pop colour (a bought STYLE recolours
      // the pop; here we flash it so you SEE it).
      setReveal({ kind: 'cosmetic', banner: `${(item ? item.name : 'ITEM').toUpperCase()} UNLOCKED`, colour: '#ff4fa3', previewChar: 'A' });
      evItemPurchased(item ? item.id : 'cosmetic');
      refresh();
    }
  };
  const onBuyKeyPower = () => {
    const nextTier = keyTier + 1;
    if (buyKeyPower().ok) {
      sndPurchase();
      const colour = nextTier >= 5 ? '#FFD54A' : '#2EFFE0';
      setReveal({ kind: 'keypower', banner: `KEY POWER ${toRoman(nextTier)} UNLOCKED`, colour, previewChar: 'A' });
      evItemPurchased('key_power', nextTier);
      refresh();
    }
  };
  const onBuyWordSense = () => {
    const nextTier = wsTier + 1;
    if (buyWordSense().ok) {
      setReveal({ kind: 'keypower', banner: `WORD SENSE ${toRoman(nextTier)} UNLOCKED`, colour: '#FFD54A', previewChar: 'A' });
      evItemPurchased('word_sense', nextTier);
      refresh();
    }
  };
  const onBuyMomentum = () => {
    const r = buyMomentum();
    if (r.ok) {
      sndPurchase();
      // The permanent mark lands on the menu rail (see MomentumRail); here we flash the running total.
      setReveal({ kind: 'keypower', banner: `MOMENTUM — ${r.count} MARKS · +${r.count}% WINS`, colour: '#FF6B3D', previewChar: '◆' });
      evItemPurchased('momentum', r.count);
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
      evItemPurchased(`theme:${id}`);
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
    { const n = getRebirths(); evRebirth(n); refreshSessionProps({ rebirths: n }); } // analytics
    setConfirming(false);
    // §2 rebirth reveal (700ms) with the new multiplier stamped large, THEN close.
    setReveal({ kind: 'rebirth', banner: `×${formatNum(gained)} MULTIPLIER`, colour: '#9A1AFF', previewChar: '↑', onClose: onBack });
  };


  return (
    <div className="shop-overlay" role="dialog" aria-modal="true" aria-label={view === 'rebirth' ? 'Rebirth' : 'Shop'} tabIndex={-1} ref={overlayRef}>
      <div className="shop-panel">
        <div className="shop-header">
          <h2 className="shop-title">{view === 'rebirth' ? 'REBIRTH' : 'SHOP'}</h2>
          <div className="shop-wins" aria-label={`${wins} wins`}>
            <span className="shop-coin" aria-hidden="true" />
            {formatNum(wins)}
            <span className="shop-wins-label" aria-hidden="true">WINS</span>
          </div>
          <button type="button" className="shop-close" onClick={onBack} aria-label="Back to menu">
            ✕
          </button>
        </div>
        {/* Names the currency + says what it's for, so a newcomer reads the balance above as
            spendable. Shop view only (rebirth isn't a wins purchase). */}
        {view === 'shop' && <div className="shop-explainer">WINS BUY UPGRADES</div>}

        {view === 'shop' ? (
          <div className="shop-body">
            {/* THEMES — the headline section, ABOVE key power. Each card previews the real palette. */}
            <h3 className="shop-subtitle">THEMES — RECOLOR YOUR MENU</h3>
            <div className="shop-grid shop-theme-grid">
              {THEMES.map((t) => (
                <ThemeCard
                  key={t.id}
                  theme={t}
                  ownedThemes={ownedThemes}
                  equippedTheme={equippedTheme}
                  wins={wins}
                  onEquipTheme={onEquipTheme}
                  onBuyTheme={onBuyTheme}
                />
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
                  <HoldBuy label={formatNum(kpCost)} onCommit={onBuyKeyPower} />
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
            <h3 className="shop-subtitle">WORD SENSE — TIER {wsTier} / {WORDSENSE_MAX_TIER}</h3>
            <div className="shop-keypower">
              <div className="shop-kp-info">
                <div className="shop-kp-current">
                  <b>×{wordSenseFactor(wsTier).toFixed(2)}</b> ON WORD RARITY (WINS)
                </div>
                {wsMaxed ? (
                  <div className="shop-kp-next">TIER {WORDSENSE_MAX_TIER} — MAXED</div>
                ) : (
                  <div className="shop-kp-next">
                    NEXT TIER: <b>×{wordSenseFactor(wsTier + 1).toFixed(2)}</b>
                    {'  ·  '}
                    <b><span className="shop-coin" aria-hidden="true" /> {formatNum(wsCost)} WINS</b>
                  </div>
                )}
                <div className="shop-kp-rate">
                  RARE WORDS PAY MORE — COMMON WORDS UNCHANGED
                </div>
                <div className="shop-goal">
                  {wsMaxed
                    ? 'WORD SENSE MAXED'
                    : wins >= wsCost
                    ? 'READY TO UNLOCK'
                    : `UNLOCKS AT ${formatNum(wsCost)} WINS — YOU HAVE ${formatNum(wins)}`}
                </div>
                <ProgressBar value={wsProgress} />
              </div>
              <div className="shop-kp-actions">
                {wsMaxed ? (
                  <button type="button" className="shop-card-btn" disabled>
                    MAXED
                  </button>
                ) : wins >= wsCost ? (
                  <HoldBuy label={formatNum(wsCost)} onCommit={onBuyWordSense} />
                ) : (
                  <button type="button" className="shop-card-btn" disabled>
                    <span className="shop-coin" aria-hidden="true" />
                    {formatNum(wsCost)}
                  </button>
                )}
              </div>
            </div>

            {/* MOMENTUM (repeatable sink): the ONE upgrade you buy forever — cheap, gently-rising
                cost, +1% wins each, and every buy drops a permanent MARK on the menu rail. Fixes the
                end-game "nothing to buy" dead stretch (claude/dead-stretch-report.md). */}
            <h3 className="shop-subtitle">MOMENTUM — {momentum} / {MOMENTUM_MAX} MARKS</h3>
            <div className="shop-keypower">
              <div className="shop-kp-info">
                <div className="shop-kp-current">
                  <b>×{momentumMult(momentum).toFixed(2)}</b> WINS · <b>{momentum}</b> MARKS ON YOUR MENU
                </div>
                {mMaxed ? (
                  <div className="shop-kp-next">ALL {MOMENTUM_MAX} MARKS EARNED — MAXED</div>
                ) : (
                  <div className="shop-kp-next">
                    NEXT: <b>+1% (×{momentumMult(momentum + 1).toFixed(2)})</b>
                    {'  ·  '}
                    <b><span className="shop-coin" aria-hidden="true" /> {formatNum(mCost)} WINS</b>
                  </div>
                )}
                <div className="shop-kp-rate">BUY AGAIN, FOREVER — EACH BUY LEAVES A MARK</div>
                <div className="shop-goal">
                  {mMaxed
                    ? 'MOMENTUM MAXED'
                    : wins >= mCost
                    ? 'READY TO UNLOCK'
                    : `UNLOCKS AT ${formatNum(mCost)} WINS — YOU HAVE ${formatNum(wins)}`}
                </div>
                <ProgressBar value={mProgress} />
              </div>
              <div className="shop-kp-actions">
                {mMaxed ? (
                  <button type="button" className="shop-card-btn" disabled>
                    MAXED
                  </button>
                ) : wins >= mCost ? (
                  <HoldBuy label={formatNum(mCost)} onCommit={onBuyMomentum} />
                ) : (
                  <button type="button" className="shop-card-btn" disabled>
                    <span className="shop-coin" aria-hidden="true" />
                    {formatNum(mCost)}
                  </button>
                )}
              </div>
            </div>

            <h3 className="shop-subtitle">POP STYLES</h3>
            <div className="shop-grid">
              {POP_STYLES.map((item) => (
                <Card
                  key={item.id}
                  item={item}
                  type="popStyle"
                  owned={owned}
                  equipped={equipped}
                  wins={wins}
                  cheapestUnowned={cheapestUnowned}
                  onBuy={onBuy}
                  onEquip={onEquip}
                />
              ))}
            </div>

            <h3 className="shop-subtitle">SOUND PACKS</h3>
            <div className="shop-grid">
              {SOUND_PACKS.map((item) => (
                <Card
                  key={item.id}
                  item={item}
                  type="soundPack"
                  owned={owned}
                  equipped={equipped}
                  wins={wins}
                  cheapestUnowned={cheapestUnowned}
                  onBuy={onBuy}
                  onEquip={onEquip}
                />
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

// Thin progress bar — transform: scaleX ONLY (never width), no layout read (§2/§3).
// Module-scoped (stateless) so it never re-creates its identity across ShopScreen renders.
function ProgressBar({ value }) {
  return (
    <div className="shop-progress" aria-hidden="true">
      <div className="shop-progress-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, value))})` }} />
    </div>
  );
}

// Cosmetic (pop-style / sound-pack) shop card. Module-scoped and fully prop-driven — it MUST
// live outside ShopScreen's render so React keeps one identity across ShopScreen's frequent
// re-renders; an inline definition re-mounted this subtree (and the HoldBuy inside it, losing
// its in-flight hold timer) on every render.
function Card({ item, type, owned, equipped, wins, cheapestUnowned, onBuy, onEquip }) {
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
        <HoldBuy label={formatNum(item.price)} onCommit={() => onBuy(item.id)} />
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
}

// THEME card: a real PALETTE SWATCH (flat colour strip, not a text label) is the preview, then
// the name, a free-at-level note for gated themes, and EQUIPPED / EQUIP / buy / locked+progress
// — the same states as the cosmetic cards, so themes read as first-class shop goods. Module-scoped
// + prop-driven for the same re-mount reason as Card above.
function ThemeCard({ theme, ownedThemes, equippedTheme, wins, onEquipTheme, onBuyTheme }) {
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
        <HoldBuy label={formatNum(theme.price)} onCommit={() => onBuyTheme(theme.id)} />
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
}

// §2 — press-and-HOLD to buy: the button fills over holdMs; releasing early cancels
// (the tension beat). The fill is a COSMETIC WAAPI scaleX (never width); no layout reads.
//
// COMMIT IS WALL-CLOCK (setTimeout), NOT THE ANIMATION'S FINISH. Gating commit on
// `animation.onfinish` tied it to the document/animation timeline, which only advances as frames
// are produced — under main-thread saturation (a low-end/janky device, a loaded machine) frames
// starve, the fill's currentTime lags real time and can freeze entirely, so onfinish (and thus
// the buy) needed an unbounded real-time hold: a player on a slow device holding the intended
// ~400ms could fail to buy. setTimeout fires on real elapsed time regardless of frame rate, so
// holding holdMs of REAL time always commits; the WAAPI fill stays purely as visual feedback.
//
// NOTE: this component must NOT be re-created inside a parent's render (it was, via an inline
// `const HoldBuyButton = props => <HoldBuy .../>` alias + inline Card/ThemeCard) — a new
// component identity per render REMOUNTS it mid-press, throwing away the in-flight timer. It is
// module-scoped and rendered directly so its press state survives the parent's frequent
// re-renders (ShopScreen re-renders ~1-2x/sec from App churn).
function HoldBuy({ label, onCommit, holdMs = 400, className = 'shop-card-btn' }) {
  const fillRef = useRef(null);
  const animRef = useRef(null);
  const timerRef = useRef(0);
  const start = () => {
    const fill = fillRef.current;
    if (!fill || timerRef.current) return;
    // Cosmetic fill (transform/opacity only, composited). Not the commit signal.
    animRef.current = fill.animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: holdMs, easing: 'linear', fill: 'forwards' }
    );
    // Commit on holdMs of WALL-CLOCK time held (frame-rate independent).
    timerRef.current = window.setTimeout(() => {
      timerRef.current = 0;
      animRef.current = null;
      if (fillRef.current) fillRef.current.style.transform = 'scaleX(0)';
      onCommit();
    }, holdMs);
  };
  const cancel = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
    if (animRef.current) {
      animRef.current.cancel();
      animRef.current = null;
    }
    if (fillRef.current) fillRef.current.style.transform = 'scaleX(0)';
  };
  // Clear a pending hold if the button unmounts mid-press (no commit on a gone component).
  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);
  // KEYBOARD PARITY (fix/shop-keyboard): the button had pointer handlers only, so Enter/Space did
  // nothing and the whole shop was un-buyable without a mouse. Enter/Space HELD for the same holdMs
  // commits; releasing early cancels — NOT an instant-buy shortcut mouse users don't get. We ignore
  // the auto-repeat keydowns a held key fires (e.repeat) so the hold starts once, and preventDefault
  // stops Space from scrolling / the native click from racing the hold. keyup + blur cancel.
  const isBuyKey = (e) => e.key === 'Enter' || e.key === ' ' || e.code === 'Space';
  const onKeyDown = (e) => {
    if (!isBuyKey(e)) return;
    e.preventDefault();
    if (!e.repeat) start();
  };
  const onKeyUp = (e) => {
    if (!isBuyKey(e)) return;
    e.preventDefault();
    cancel();
  };
  return (
    <button
      type="button"
      className={`${className} shop-hold`}
      onPointerDown={(e) => { e.preventDefault(); start(); }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={cancel}
      aria-label={`Hold Enter or Space to buy for ${label}`}
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
  // Mirror the dismiss callback through a ref so the auto-dismiss effect does NOT depend on
  // its identity. `onDone` is an inline arrow from the parent (recreated every ShopScreen
  // render), and ShopScreen re-renders whenever App does (App churns child props ~1-2×/sec via
  // an unmemoized onBack). If the effect below listed `onDone` as a dep, each of those
  // re-renders would clear + reschedule the completion setTimeout — resetting it faster than it
  // could ever fire, so the reveal (and, on a rebirth, the whole shop overlay via reveal.onClose)
  // NEVER auto-dismissed and the player was stranded on the reveal after every rebirth. Reading
  // it from a ref keeps the timer armed once and immune to parent re-renders.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
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
      onDoneRef.current();
      if (reveal.onClose) reveal.onClose();
    }, dur + 1100);
    return () => clearTimeout(t);
    // `reveal` and `dur` are stable for the life of one reveal (reveal is ShopScreen state, set
    // once until dismissed); onDone is read via onDoneRef so it is intentionally not a dep — that
    // is what stops parent re-renders from resetting the timer above.
  }, [reveal, dur]);
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
