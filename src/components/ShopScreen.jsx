// ShopScreen.jsx — the SHOP / REBIRTH overlay. Which one it shows is set by `initialView`
// (the menu now has TWO top-corner icons — SHOP and REBIRTH — each opening straight into its
// own view; there are no in-panel tabs). SHOP: Key Power tier + pop-style / sound-pack cards
// (OWNED / EQUIPPED state; unaffordable items visible-but-dimmed). REBIRTH: count, multiplier,
// next threshold, what's lost/kept, and the action (disabled with the requirement shown when
// not eligible). Mode-dialog styling; static — no animation beyond the buttons' hover/press.
import { useEffect, useRef, useState } from 'react';
import './ShopScreen.css';
import { POP_STYLES, SOUND_PACKS, getOwned, getEquipped, buy, equip, buyKeyPower, buyForge } from '../progress/shop';
import { forgeLevels, forgeBuys, forgeCost, nextForgeLetter, FORGE_PCT } from '../progress/forge';
import ForgeStrip from './ForgeStrip';
import { layerOpen } from '../progress/claims';
import { FORGE_UNLOCK_LEVEL } from '../progress/forge';
import { getWins, perWordWins } from '../progress/wins';
import { loadProgress, getRebirths, rebirthThreshold, rebirthMult, getKeyTier, keyTierCost, keyTierXp } from '../progress/xp';
import { rebirthAdvice, rebirthWithStars, starsState, PERKS, perkCost, buyPerk, layerUnlocked, LAYER_AUTO_AT } from '../progress/stars';
import { shopOpened as evShopOpened, itemPurchased as evItemPurchased, rebirth as evRebirth, refreshSessionProps } from '../lib/events.js';
import { formatNum, formatMult, formatRate } from '../format';
import ShopSticker from './ShopSticker';
import RedeemCodes from './RedeemCodes';
import { LEADERBOARD_ENABLED } from '../leaderboard/client';
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
  const [forge, setForge] = useState(() => forgeLevels());
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
  const advice = rebirthAdvice(level, rebirths);
  const [stars, setStars] = useState(() => starsState());
  const rebirthReady = level >= threshold;

  // §3 — the shop always shows a visible NEXT GOAL with a progress bar. KEY POWER's
  // next tier is always a goal (there's always a next tier); rebirth shows level
  // progress; and the cheapest unowned cosmetic is surfaced as the fallback goal.
  const kpCost = keyTierCost(keyTier);
  const kpProgress = kpCost > 0 ? Math.min(1, wins / kpCost) : 1;
  const fBuys = forgeBuys(forge);
  const forgeOpen = layerOpen('forge') || fBuys > 0;
  const fCost = forgeCost(fBuys);
  const fNext = nextForgeLetter(forge);
  const fNextLv = (forge[fNext] || 0) + 1;
  const fProgress = fCost > 0 ? Math.min(1, wins / fCost) : 1;
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
    setForge(forgeLevels());
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
  // LETTER FORGE (replaced MOMENTUM): the sticker names the letter(s) just forged and what a
  // letter level pays, in plain words.
  const revealForge = (letter, level, n, spent) => {
    setReveal({
      kind: 'forge',
      name: n > 1 ? `FORGED ×${n}` : `${letter.toUpperCase()} FORGED — LV ${level}`,
      blurb: `Every ${n > 1 ? 'forged letter' : `"${letter.toUpperCase()}"`} in a word now pays +${Math.round(FORGE_PCT * 100)}% more per level.`,
      coin: `−${formatNum(spent)} WINS`,
      colour: '#FF6B3D',
      tier: level,
      letter: letter.toUpperCase(),
    });
  };
  const fRun = useRef({ n: 0, spent: 0, letter: 'e', level: 1 });
  const onBuyForge = ({ batch = false } = {}) => {
    const r = buyForge();
    if (!r.ok) return false;
    sndPurchase();
    evItemPurchased('forge', r.count);
    if (batch) {
      fRun.current = { n: fRun.current.n + 1, spent: fRun.current.spent + r.spent, letter: r.letter, level: r.level };
    } else {
      revealForge(r.letter, r.level, 1, r.spent);
    }
    refresh();
    return true;
  };
  const endForgeRun = () => {
    const run = fRun.current;
    fRun.current = { n: 0, spent: 0, letter: 'e', level: 1 };
    if (run.n > 0) revealForge(run.letter, run.level, run.n, run.spent);
  };
  const buyMaxForge = () => {
    let guard = 0;
    while (guard < 500 && onBuyForge({ batch: true })) guard += 1;
    endForgeRun();
  };
  const onEquip = (id) => {
    if (equip(id)) setEquipped(getEquipped());
  };
  const confirmRebirth = () => {
    const gained = nextMult;
    // Zeroes xp (HEAD START may lift the new climb), pays the stars for how far past the gate the
    // player went, queues the REBIRTH N celebration + any layer-unlock claim (stars.js).
    const { stars: starsGot } = rebirthWithStars();
    sndRebirth(); // Job 11: rebirth swell
    { const n = getRebirths(); evRebirth(n); refreshSessionProps({ rebirths: n }); } // analytics
    setConfirming(false);
    // §2 rebirth reveal (700ms) with the new multiplier stamped large, THEN close.
    setReveal({
      kind: 'rebirth',
      name: `×${formatMult(gained)}`,
      blurb: `Everything you earn from here is multiplied by ${formatMult(gained)}.${starsGot ? ` +${starsGot} ★ for STAR PERKS.` : ''}`,
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

            {/* THEMES are gone from the shop (STEP 50, Andy oct2): the menu's look is now the WORLD
                your border tier has reached — earned by playing, not bought. */}
            {/* LETTER FORGE (Andy oct2 — replaced MOMENTUM, which capped at 200 and did nothing you
                could see). Uncapped: each buy forges the next letter one level; a word pays +5% per
                forged level of every letter in it. The strip IS the state — 26 letters at their levels. */}
            <h3 className="shop-subtitle">LETTER FORGE{forgeOpen ? ` — ${fBuys} FORGED` : ''}</h3>
            {!forgeOpen ? (
              <div className="shop-keypower shop-forge is-locked">
                <div className="shop-kp-info">
                  <div className="shop-kp-next">
                    <b>OPENS AT LV {FORGE_UNLOCK_LEVEL}</b> — YOU&apos;RE LV {level}
                  </div>
                  <div className="shop-kp-rate">FORGE LETTERS: EVERY FORGED LETTER IN A WORD PAYS MORE. NO CAP.</div>
                </div>
              </div>
            ) : (
            <div className="shop-keypower shop-forge">
              <div className="shop-kp-info">
                <ForgeStrip levels={forge} next={fNext} />
                <div className="shop-kp-next">
                  NEXT: <b>{fNext.toUpperCase()} → LV {fNextLv}</b>
                  {'  ·  '}
                  <b><span className="shop-coin" aria-hidden="true" /> {formatNum(fCost)} WINS</b>
                </div>
                <div className="shop-kp-rate">
                  +{Math.round(FORGE_PCT * 100)}% PER LEVEL, PER LETTER IN THE WORD — LONGER WORDS FORGE MORE. NO CAP.
                </div>
                <div className="shop-goal">
                  {wins >= fCost ? 'READY TO FORGE' : `FORGE AT ${formatNum(fCost)} WINS — YOU HAVE ${formatNum(wins)}`}
                </div>
                <ProgressBar value={fProgress} />
              </div>
              <div className="shop-kp-actions">
                {wins >= fCost ? (
                  <>
                    <HoldBuy label={formatNum(fCost)} onCommit={onBuyForge} onBatchEnd={endForgeRun} />
                    {wins >= fCost + forgeCost(fBuys + 1) && (
                      <button type="button" className="shop-card-btn shop-buymax" onClick={buyMaxForge}>BUY MAX</button>
                    )}
                  </>
                ) : (
                  <button type="button" className="shop-card-btn" disabled>
                    <span className="shop-coin" aria-hidden="true" />
                    {formatNum(fCost)}
                  </button>
                )}
              </div>
            </div>
            )}

            <h3 className="shop-subtitle">POP STYLES</h3>
            {/* Andy oct2: cosmetics are collectibles, not the headline — small tiles, KEY POWER stays big. */}
            <div className="shop-grid shop-grid--compact">
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
            <div className="shop-grid shop-grid--compact">
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

            {/* STEP 61: CODES — last, small; the shop's job is spending, a code is a side door. */}
            {LEADERBOARD_ENABLED && (
              <>
                <h3 className="shop-subtitle">CODES</h3>
                <RedeemCodes />
              </>
            )}
          </div>
        ) : (
          <div className="shop-body">
            {/* ONE BIG THING (Andy oct2): what a rebirth gets you, right now — the new multiplier
                and the stars — with the Sell-Lemons-style warning when waiting a level or two pays more. */}
            <div className={`shop-rb-hero${advice.badTime ? ' is-bad' : ''}`}>
              <div className="shop-rb-hero-label">REBIRTH {rebirths + 1} TO GET</div>
              <div className="shop-rb-hero-val">
                ×{formatMult(nextMult)} <span className="shop-rb-hero-unit">WINS</span>
                {rebirthReady && (
                  <>
                    {' · +'}
                    {advice.stars} <span className="shop-rb-star">★</span>
                  </>
                )}
              </div>
              {rebirthReady && (
                <div className="shop-rb-advice">
                  {advice.badTime
                    ? `BAD TIME — WAIT ${advice.nextIn} LV = +1 ★`
                    : `NEXT ★ IN ${advice.nextIn} LEVELS · NOW IS FINE`}
                </div>
              )}
              <div className="shop-rb-now">
                NOW ×{formatMult(rebirthMult(rebirths))} · {rebirths} REBIRTH{rebirths === 1 ? '' : 'S'}
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
                <b>GAIN:</b> a permanent ×{formatMult(nextMult)} on wins and XP, and ★ for STAR PERKS.
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
                  REBIRTH {rebirths + 1} — ×{formatMult(nextMult)} + {advice.stars} ★
                </button>
              )
            ) : (
              <button type="button" className="shop-rebirth" disabled aria-disabled="true">
                REACH LEVEL {threshold} TO REBIRTH — YOU'RE LV {level}
              </button>
            )}

            {/* LAYER 1/2 — STAR PERKS and AUTOMATION (stars.js). Hidden until the first rebirth
                unlocks them (the claimable reveal names it); AUTOMATION shows its gate until R3. */}
            {rebirths >= 1 && (
              <>
                <h3 className="shop-subtitle">STAR PERKS — {stars.balance} ★</h3>
                <div className="shop-perks">
                  {PERKS.map((p) => {
                    const lv = stars.perks[p.id] || 0;
                    const open = layerUnlocked(p.layer, rebirths);
                    const maxed = lv >= p.max;
                    const cost = perkCost(p.id, lv);
                    return (
                      <div key={p.id} className={`shop-perk${open ? '' : ' is-locked'}`}>
                        <div className="shop-perk-name">
                          {p.name}
                          {p.max > 1 && lv > 0 && <span className="shop-perk-lv"> LV {lv}</span>}
                        </div>
                        <div className="shop-perk-blurb">{open ? p.blurb : `UNLOCKS AT REBIRTH ${LAYER_AUTO_AT}`}</div>
                        <button
                          type="button"
                          className="shop-card-btn"
                          disabled={!open || maxed || stars.balance < cost}
                          onClick={() => {
                            if (buyPerk(p.id, rebirths).ok) {
                              sndPurchase();
                              setStars(starsState());
                            }
                          }}
                        >
                          {maxed ? (p.max === 1 ? 'ON' : 'MAXED') : `${cost} ★`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
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
    <div className={`shop-card shop-card--compact is-${cls}${isNextGoal ? ' is-next' : ''}`} title={item.blurb}>
      {isNextGoal && <div className="shop-card-next" aria-hidden="true">NEXT</div>}
      <div className="shop-card-name">{item.name}</div>
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
          {/* §3 — the NEXT goal keeps its gap line; the rest of the compact tiles show the bar only. */}
          {isNextGoal && <div className="shop-card-gap">YOU HAVE {formatNum(wins)}</div>}
          <ProgressBar value={item.price > 0 ? wins / item.price : 1} />
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
