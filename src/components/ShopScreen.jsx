// ShopScreen.jsx — the SHOP / REBIRTH overlay. Which one it shows is set by `initialView`
// (the menu now has TWO top-corner icons — SHOP and REBIRTH — each opening straight into its
// own view; there are no in-panel tabs). SHOP: Key Power tier + pop-style / sound-pack cards
// (OWNED / EQUIPPED state; unaffordable items visible-but-dimmed). REBIRTH: count, multiplier,
// next threshold, what's lost/kept, and the action (disabled with the requirement shown when
// not eligible). Mode-dialog styling; static — no animation beyond the buttons' hover/press.
import { useEffect, useRef, useState } from 'react';
import './ShopScreen.css';
import { POP_STYLES, SOUND_PACKS, getOwned, getEquipped, buy, equip, buyKeyPower, buyMomentum } from '../progress/shop';
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
import { formatNum, formatMult, formatRate } from '../format';
import ShopSticker from './ShopSticker';
import ThemePreview from './ThemePreview';
import { burst } from '../juice';
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
    setMomentum(getMomentum());
  };
  const onBuy = (id) => {
    if (buy(id).ok) {
      sndPurchase();
      const item = [...POP_STYLES, ...SOUND_PACKS].find((i) => i.id === id);
      // §2 reveal — the sticker shows the pop itself in the style you just bought.
      const isSound = SOUND_PACKS.some((i) => i.id === id);
      setReveal({
        kind: 'cosmetic',
        name: (item ? item.name : 'ITEM').toUpperCase(),
        blurb: isSound
          ? `Every keystroke now sounds ${(item ? item.name : 'new').toUpperCase()}.`
          : `Your letter pops are now ${(item ? item.name : 'new').toUpperCase()}.`,
        coin: `−${formatNum(item ? item.price : 0)} WINS`,
        itemId: id,
        previewChar: 'A',
      });
      evItemPurchased(item ? item.id : 'cosmetic');
      refresh();
    }
  };
  // One reveal for a run of buys (hold-to-buy / BUY MAX): `n` units, `spent` wins, ending at tier `t`.
  const revealKeyPower = (t, n, spent) => {
    setReveal({
      kind: 'keypower',
      name: `KEY POWER ${toRoman(t)}${n > 1 ? ` (+${n})` : ''}`,
      blurb: `Every letter now pays ${formatNum(keyTierXp(t))} XP.`,
      coin: `−${formatNum(spent)} WINS`,
      colour: t >= 5 ? '#FFD54A' : '#2EFFE0',
      tier: t,
    });
  };
  const kpRun = useRef({ n: 0, spent: 0, tier: 0 });
  const onBuyKeyPower = ({ batch = false } = {}) => {
    const r = buyKeyPower();
    if (!r.ok) return false;
    sndPurchase();
    evItemPurchased('key_power', r.tier);
    if (batch) {
      kpRun.current = { n: kpRun.current.n + 1, spent: kpRun.current.spent + r.spent, tier: r.tier };
    } else {
      revealKeyPower(r.tier, 1, r.spent);
    }
    refresh();
    return true;
  };
  const endKeyPowerRun = () => {
    const run = kpRun.current;
    kpRun.current = { n: 0, spent: 0, tier: 0 };
    if (run.n > 0) revealKeyPower(run.tier, run.n, run.spent);
  };
  const buyMaxKeyPower = () => {
    let guard = 0;
    while (guard < 500 && onBuyKeyPower({ batch: true })) guard += 1;
    endKeyPowerRun();
  };
  // The permanent mark lands on the menu rail (see MomentumRail); the sticker names the total.
  const revealMomentum = (count, n, spent) => {
    setReveal({
      kind: 'momentum',
      name: `MOMENTUM ${count}${n > 1 ? ` (+${n})` : ''}`,
      blurb: `${count} mark${count === 1 ? '' : 's'} — every win now pays +${count}%.`,
      coin: `−${formatNum(spent)} WINS`,
      colour: '#FF6B3D',
      tier: count,
    });
  };
  const mRun = useRef({ n: 0, spent: 0, count: 0 });
  const onBuyMomentum = ({ batch = false } = {}) => {
    const r = buyMomentum();
    if (!r.ok) return false;
    sndPurchase();
    evItemPurchased('momentum', r.count);
    if (batch) {
      mRun.current = { n: mRun.current.n + 1, spent: mRun.current.spent + r.spent, count: r.count };
    } else {
      revealMomentum(r.count, 1, r.spent);
    }
    refresh();
    return true;
  };
  const endMomentumRun = () => {
    const run = mRun.current;
    mRun.current = { n: 0, spent: 0, count: 0 };
    if (run.n > 0) revealMomentum(run.count, run.n, run.spent);
  };
  const buyMaxMomentum = () => {
    let guard = 0;
    while (guard < 500 && onBuyMomentum({ batch: true })) guard += 1;
    endMomentumRun();
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
      setReveal({
        kind: 'theme',
        name: t.name,
        blurb: `Your menu is now ${t.name}.`,
        coin: `−${formatNum(t.price)} WINS`,
        colour: t.vars['--theme-ink'],
        swatch: t.swatch,
      });
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
    setReveal({
      kind: 'rebirth',
      name: `×${formatMult(gained)}`,
      blurb: `Everything you earn from here is multiplied by ${formatMult(gained)}.`,
      coin: null, // a rebirth spends LEVELS, not wins — no price pill
      colour: '#9A1AFF',
      onClose: onBack,
    });
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
            {/* KEY POWER — FIRST, so it is above the fold on a laptop (see THEMES below). */}
            <h3 className="shop-subtitle">KEY POWER — TIER {keyTier}</h3>
            <div className="shop-keypower">
              <div className="shop-kp-info">
                {/* Current XP per letter at this tier. */}
                <div className="shop-kp-current">
                  <b>{formatNum(keyTierXp(keyTier))}</b> XP PER LETTER
                </div>
                {/* What the NEXT tier gives + what it costs. HOLD the buy button to keep buying, or BUY MAX. */}
                <div className="shop-kp-next">
                  NEXT TIER: <b>{formatNum(keyTierXp(keyTier + 1))} XP</b>
                  {'  ·  '}
                  <b>
                    <span className="shop-coin" aria-hidden="true" /> {formatNum(keyTierCost(keyTier))} WINS
                  </b>
                </div>
                {/* Your current per-word win rate — context for how far the tier cost is. */}
                <div className="shop-kp-rate">
                  YOUR RATE: <b>{formatRate(perWordWins({ mode: 'wordBomb' }))} WINS / WORD</b>
                </div>
                {/* §3 — the shop always shows this next goal + progress (there is always a next tier). */}
                <div className="shop-goal">
                  {wins >= kpCost ? 'READY TO UNLOCK' : `UNLOCKS AT ${formatNum(kpCost)} WINS — YOU HAVE ${formatNum(wins)}`}
                </div>
                <ProgressBar value={kpProgress} />
              </div>
              <div className="shop-kp-actions">
                {wins >= kpCost ? (
                  <>
                    <HoldBuy label={formatNum(kpCost)} onCommit={onBuyKeyPower} onBatchEnd={endKeyPowerRun} />
                    {wins >= kpCost + keyTierCost(keyTier + 1) && (
                      <button type="button" className="shop-card-btn shop-buymax" onClick={buyMaxKeyPower}>BUY MAX</button>
                    )}
                  </>
                ) : (
                  <button type="button" className="shop-card-btn" disabled>
                    <span className="shop-coin" aria-hidden="true" />
                    {formatNum(kpCost)}
                  </button>
                )}
              </div>
            </div>

            {/* THEMES — each card previews the real palette. BELOW key power: five theme cards are a full
                screen at 1366x768, and KEY POWER (the upgrade that raises every payout) sat under them at
                y=684, below the fold. Income first, cosmetics second. */}
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
                  <>
                    <HoldBuy label={formatNum(mCost)} onCommit={onBuyMomentum} onBatchEnd={endMomentumRun} />
                    {!momentumMaxed(momentum + 1) && wins >= mCost + momentumCost(momentum + 1) && (
                      <button type="button" className="shop-card-btn shop-buymax" onClick={buyMaxMomentum}>BUY MAX</button>
                    )}
                  </>
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
                <b>×{formatMult(rebirthMult(rebirths))}</b>
              </div>
              {/* The NEXT rebirth's level + multiplier, shown at all times (Economy v4). */}
              <div className="shop-rb-stat">
                <span>NEXT REBIRTH AT</span>
                <b>LEVEL {threshold}</b>
              </div>
              <div className="shop-rb-stat">
                <span>NEXT MULTIPLIER</span>
                <b>×{formatMult(nextMult)}</b>
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
                <b>GAIN:</b> a permanent ×{formatMult(nextMult)} XP multiplier.
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
                  REBIRTH {rebirths + 1} — GAIN ×{formatMult(nextMult)} XP
                </button>
              )
            ) : (
              <button type="button" className="shop-rebirth" disabled aria-disabled="true">
                REACH LEVEL {threshold} TO REBIRTH — YOU'RE LV {level}
              </button>
            )}
          </div>
        )}
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
      <ThemePreview theme={theme} />
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

// §2 — the BUY button: a plain click commits. It was a press-and-HOLD gate (400ms fill,
// wall-clock timer, pointerup cancelled) with nothing on screen saying "hold", so every upgrade
// button read as broken — a normal click did nothing. Plain click now; REBIRTH keeps its own
// confirm. The component name is kept so call sites don't churn.
//
// NOTE: this component must NOT be re-created inside a parent's render (it was, via an inline
// `const HoldBuyButton = props => <HoldBuy .../>` alias + inline Card/ThemeCard) — a new
// component identity per render REMOUNTS it. It is module-scoped and rendered directly.
// HOLD TO BUY (STEP 21 / Andy A5: "no mashing buttons — at worst hold to buy"). A tap buys ONE.
// Holding keeps buying, accelerating (first repeat after 420 ms, then every 240 → 70 ms), until you
// let go or can't afford the next one. `onCommit({ batch })` returns true when a buy landed; during a
// hold every buy is a quiet batch buy, and `onBatchEnd(n)` fires once on release with the count so
// the reveal ritual plays ONCE for the whole run instead of once per unit. Keyboard: Enter/Space =
// one buy (the native click). Repeatables only; one-off cosmetics keep a single-press buy.
function HoldBuy({ label, onCommit, onBatchEnd = null, className = 'shop-card-btn' }) {
  const timer = useRef(null);
  const count = useRef(0);
  const pointerBuy = useRef(false);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (count.current > 0 && onBatchEnd) onBatchEnd(count.current);
    count.current = 0;
  };
  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps
  const step = (delay) => {
    timer.current = setTimeout(() => {
      if (!onCommit({ batch: true })) { stop(); return; }
      count.current += 1;
      step(Math.max(70, delay * 0.78));
    }, delay);
  };
  const repeatable = !!onBatchEnd;
  return (
    <button
      type="button"
      className={`${className} shop-buy${repeatable ? ' is-hold' : ''}`}
      onPointerDown={repeatable ? (e) => {
        if (e.button !== 0) return;
        pointerBuy.current = true;
        if (!onCommit({ batch: true })) return;
        count.current = 1;
        timer.current = setTimeout(() => step(240), 420 - 240);
      } : undefined}
      onPointerUp={repeatable ? stop : undefined}
      onPointerLeave={repeatable ? stop : undefined}
      onPointerCancel={repeatable ? stop : undefined}
      onClick={() => {
        if (pointerBuy.current) { pointerBuy.current = false; return; } // the pointer path already bought
        onCommit({ batch: false });
      }}
      aria-label={repeatable ? `Buy for ${label}. Hold to keep buying` : `Buy for ${label}`}
    >
      {repeatable ? (
        <>
          <span className="shop-buy-main"><span className="shop-coin" aria-hidden="true" /> {label}</span>
          <span className="shop-hold-hint" aria-hidden="true">HOLD</span>
        </>
      ) : (
        <><span className="shop-coin" aria-hidden="true" /> {label}</>
      )}
    </button>
  );
}

// §2 — the REVEAL: the shared reveal STICKER (see ShopSticker.jsx / Sticker.jsx), showing the
// item's own art, its name, one line of what it does and the price as a red debit. It replaced a
// black box with a generic star + a one-line banner, which was doing no work on a moment that can
// cost 2,500 wins. Click (sticker or backdrop) dismisses; it also auto-dismisses after 4.2s.
//
// THE TIMER STAYS HERE, keyed off a ref. `onDone` is an inline arrow from the parent (recreated
// every ShopScreen render), and ShopScreen re-renders whenever App does (App churns child props
// ~1-2×/sec via an unmemoized onBack). If the effect below listed `onDone` as a dep, each of those
// re-renders would clear + reschedule the setTimeout — resetting it faster than it could ever fire,
// so the reveal (and, on a rebirth, the whole shop overlay via reveal.onClose) NEVER auto-dismissed
// and the player was stranded on the reveal after every rebirth. Reading it from a ref keeps the
// timer armed once and immune to parent re-renders.
const REVEAL_MS = 4200;
function ShopReveal({ reveal, onDone }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const doneRef = useRef(false);
  // One dismiss path for both the timer and the click, so a click can't fire onClose twice
  // (a rebirth's onClose closes the whole shop).
  const finish = useRef(() => {});
  finish.current = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
    if (reveal.onClose) reveal.onClose();
  };
  // STEP 22 / A1 — a purchase is an EVENT: two confetti volleys from the sticker (pooled juice
  // particles, finite) in the bought item's colour. Fired once per reveal.
  useEffect(() => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const colors = [reveal.colour || '#2EFFE0', '#FFE94A', '#FF4FA3', '#ffffff'];
    burst(cx, cy, { count: 36, speed: 520, colors, sizeMin: 4, sizeMax: 10, life: 0.8 });
    const t = setTimeout(() => burst(cx, cy - 40, { count: 20, speed: 360, colors, life: 0.7 }), 180);
    return () => clearTimeout(t);
  }, [reveal]);
  useEffect(() => {
    const t = setTimeout(() => finish.current(), REVEAL_MS);
    return () => clearTimeout(t);
    // `reveal` is stable for the life of one reveal (ShopScreen state, set once until dismissed);
    // onDone is read via onDoneRef so it is intentionally not a dep — that is what stops parent
    // re-renders from resetting the timer above.
  }, [reveal]);
  return <ShopSticker reveal={reveal} onDismiss={() => finish.current()} />;
}
