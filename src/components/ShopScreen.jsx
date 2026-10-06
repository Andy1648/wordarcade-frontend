// ShopScreen.jsx — the SHOP / REBIRTH overlay. Which one it shows is set by `initialView`
// (the menu now has TWO top-corner icons — SHOP and REBIRTH — each opening straight into its
// own view; there are no in-panel tabs). SHOP: Key Tier + pop-style / sound-pack cards
// (OWNED / EQUIPPED state; unaffordable items visible-but-dimmed). REBIRTH: count, multiplier,
// next threshold, what's lost/kept, and the action (disabled with the requirement shown when
// not eligible). Mode-dialog styling; static — no animation beyond the buttons' hover/press.
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import './ShopScreen.css';
import { takeRebirthNow, peekRebirthNow, isRebirthReadyNow } from '../progress/rebirthNow';
import { POP_STYLES, SOUND_PACKS, getOwned, getEquipped, buy, equip, buyKeyPower } from '../progress/shop';
// PROGRESSION v3 (SEASON2, default OFF): KEY TIER is POWER, cosmetics cost GEMS, a rebirth is ×2 (+7 × R gems, no ★,
// no star perks) and R10 opens ASCEND (performAscend → lb_ascend). Functional only — the kit restyle is phase 2.
import { SEASON2, V3 } from '../progress/season'; // V3.econ: installed lazily (main.jsx, season 2 only)

import { getGems, subscribeGems } from '../progress/gemsCore';
import { getWins } from '../progress/wins';
import { useWinsBalance } from '../progress/useWinsBalance';
import { loadProgress, getRebirths, rebirthThreshold, rebirthMult, getKeyTier, keyTierCost, keyXpMult, REBIRTH_POWER } from '../progress/xp';
import { rebirthAdvice, headStartLevel, starsState, PERKS, perkCost, buyPerk, layerUnlocked, LAYER_AUTO_AT } from '../progress/stars';
import { shopOpened as evShopOpened, itemPurchased as evItemPurchased, rebirth as evRebirth, refreshSessionProps } from '../lib/events.js';
import { formatNum, formatMult, formatMultExact } from '../format';

// A KEY multiplier: ×2.15 precision under 1,000, a grouped whole number from there (×2,150, not ×2150).
const keyMult = (m) => (m >= 1000 ? formatNum(m) : formatMultExact(m));
// REBIRTH RUSH: the STAR PERKS that no longer do anything are not sold. STAR POWER (+10% wins) is out
// of the wins formula, AUTO-FORGE buys the LETTER FORGE, which is no longer sold, and HEAD START is
// switched off (stars.js HEAD_START_ON = false). Their stored levels are untouched (stars.js) — only the
// shelf hides them.
const RETIRED_PERKS = new Set(['power', 'autoForge', 'head']);
const LIVE_PERKS = PERKS.filter((p) => !RETIRED_PERKS.has(p.id));
import ShopSticker from './ShopSticker';
import RedeemCodes from './RedeemCodes';
import RebirthCeremony from './RebirthCeremony';
import OverlaySkeleton from './OverlaySkeleton';
import { ownedMarkIds } from '../progress/marks';
import { MASTERY_MODES, masteryWords } from '../progress/mastery';
import { LEADERBOARD_ENABLED } from '../leaderboard/client';
import { performRebirth, performAscend } from '../leaderboard/serverRebirth';
import { rebirthRefusalText } from '../leaderboard/rebirthFlow';
import { burst } from '../juice';
import { sndPurchase, sndRebirth } from '../audio/gameSounds';
import { useMomentHold } from '../lib/useMomentSlot';
import { rarityClass, keyRarity } from '../lib/rarityStyle.js';
import RarityFx from './rarity/RarityFx';
import SpotlightTutorial from '../tutorials/SpotlightTutorial.jsx';
import { dueHosted, hasSeenTutorial, markTutorialSeen } from '../tutorials/registry.js';


const itemPrice = (id) => (SEASON2 ? V3.hooks.itemGemPrice(id) : (POP_STYLES.find((i) => i.id === id) || SOUND_PACKS.find((i) => i.id === id) || { price: Infinity }).price);

// P3 (SEASON2 only): the v2 SHOP (Shop.dc.html — POWER + the gem STOCK) and the v2 REBIRTH screen (Rebirth.dc.html),
// each its own lazy chunk. With the flag OFF the live SHOP / REBIRTH views below are untouched.
const ShopV2 = lazy(() => import('./ShopV2.jsx'));
const RebirthV2 = lazy(() => import('./RebirthV2.jsx'));

export default function ShopScreen(props) {
  if (SEASON2 && props.initialView === 'rebirth') {
    return (
      <Suspense fallback={<OverlaySkeleton title="REBIRTH" />}>
        <RebirthV2 onBack={props.onBack} />
      </Suspense>
    );
  }
  if (SEASON2) {
    return (
      <Suspense fallback={<OverlaySkeleton title="SHOP" />}>
        <ShopV2 onBack={props.onBack} />
      </Suspense>
    );
  }
  return <ShopScreenLive {...props} />;
}

function ShopScreenLive({ onBack, initialView = 'shop' }) {
  useMomentHold(true); // H5: no queued moment (rank-up, claim popup, tutorial…) starts under this panel
  const view = initialView === 'rebirth' ? 'rebirth' : 'shop'; // fixed per open; the two icons pick it
  // Opened by REBIRTH READY (see the layout effect below): the panel stays hidden under the ceremony.
  const [autoMode, setAutoMode] = useState(() => view === 'rebirth' && peekRebirthNow() && isRebirthReadyNow());
  // 021: the rebirth is a server action for board players — the buttons stay disabled ("…") until it answers, and a
  // refusal (gate / pace / offline) shows one numbers-first line instead of a rebirth.
  const [rbBusy, setRbBusy] = useState(false);
  const [rbMsg, setRbMsg] = useState(null);
  const rbBusyRef = useRef(false);
  const wins = useWinsBalance(); // W: the one balance channel
  // v3: cosmetics are priced in GEMS — the cards read the gem balance (live)
  const [gems, setGems] = useState(() => (SEASON2 ? getGems() : 0));
  useEffect(() => (SEASON2 ? subscribeGems(setGems) : undefined), []);
  const shelfBalance = SEASON2 ? gems : wins;
  const KEY_LABEL = 'POWER'; // v2 menu: KEY TIER is POWER in every season
  // v3: a cosmetic's GEM price (v3/hooks.js); the live game's wins price otherwise
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

  // §3 — the shop always shows a visible NEXT GOAL with a progress bar. KEY TIER's
  // next tier is always a goal (there's always a next tier); rebirth shows level
  // progress; and the cheapest unowned cosmetic is surfaced as the fallback goal.
  const kpCost = keyTierCost(keyTier);
  const kpProgress = kpCost > 0 ? Math.min(1, wins / kpCost) : 1;
  const rbProgress = threshold > 0 ? Math.min(1, level / threshold) : 1;
  // KEY TIER spotlight (Andy oct5): the first time a KEY tier is affordable, light the KEY item once.
  const [keyTutDone, setKeyTutDone] = useState(false);
  const keyTut = view === 'shop' && !keyTutDone && !autoMode
    ? dueHosted('shop', { keyAffordable: wins >= kpCost, keyTier, rebirths }, hasSeenTutorial)
    : null;
  const cheapestUnowned = [...POP_STYLES, ...SOUND_PACKS]
    .filter((i) => !owned.has(i.id))
    .sort((a, b) => itemPrice(a.id) - itemPrice(b.id))[0] || null;

  const [reveal, setReveal] = useState(null);
  const [ceremony, setCeremony] = useState(null); // BB1: the kept-vs-reset rebirth ceremony
  const refresh = () => {
    // wins: live off useWinsBalance — every buy already told it
    setOwned(new Set(getOwned()));
    setEquipped(getEquipped());
    setKeyTier(getKeyTier());
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
        coin: `−${formatNum(item ? itemPrice(item.id) : 0)} ${SEASON2 ? 'GEMS' : 'WINS'}`,
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
      // H6/M14: "TIER n" everywhere (the shop heading, stats and the ceremony say the same).
      name: `${KEY_LABEL} ${t}${n > 1 ? ` (+${n})` : ''}`,
      // Rebirth Rush: KEY multiplies XP / LETTER only (not wins) — say exactly that.
      blurb: `POWER T${formatNum(t)}: ×${keyMult(keyXpMult(t))} XP / LETTER.`,
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
  // LETTER FORGE: no longer sold (Rebirth Rush — it is out of the wins formula). Its storage
  // (taw.forge) is untouched; the shop simply has no shelf for it.
  const onEquip = (id) => {
    if (equip(id)) setEquipped(getEquipped());
  };
  // 021: ONE async action (leaderboard/client.js performRebirth — single-flight; server-checked when the player has a
  // board row and 021 is live, else today's local rebirth). The v2 kit's HOLD-TO-REBIRTH will call this same path.
  const confirmRebirth = async () => {
    if (rbBusyRef.current) return; // a second click while pending does nothing
    rbBusyRef.current = true;
    setRbBusy(true);
    setRbMsg(null);
    const fromLevel = level;
    const fromKey = getKeyTier(); // read BEFORE the rebirth
    // Zeroes xp, pays the stars for how far past the gate the player went, queues the REBIRTH N celebration + any
    // layer-unlock claim (stars.js) — only once the server said ok (server mode) or the local gate holds (local).
    const res = await performRebirth();
    rbBusyRef.current = false;
    setRbBusy(false);
    if (!res.ok) {
      setRbMsg(rebirthRefusalText(res));
      setAutoMode(false); // REBIRTH READY one-tap: show the panel with the reason
      return;
    }
    const rc = res.rc;
    const starsGot = res.stars;
    sndRebirth(); // Job 11: rebirth swell
    { const n = getRebirths(); evRebirth(n); refreshSessionProps({ rebirths: n }); } // analytics
    setConfirming(false);
    // BB1 (Andy oct2): a ceremony that SHOWS kept vs reset with the player's real numbers — read
    // AFTER the rebirth, so every KEPT value is provably what survived it.
    let words = 0;
    for (const m of MASTERY_MODES) words += masteryWords(m) || 0;
    // Rebirth Rush: KEY is NOT kept (it resets to T0, or the HEIRLOOM tiers — shown in RESET, read AFTER the
    // rebirth as toKey); the LETTER FORGE row went with the forge.
    const kept = [
      { label: 'WINS', value: formatNum(getWins()) },
      { label: 'COSMETICS', value: formatNum(getOwned().length) },
      { label: 'MARKS', value: formatNum(ownedMarkIds().length) },
      { label: 'WORDS TYPED', value: formatNum(words) },
    ];
    // the multiplier the rebirth actually reached (server mode lands on the server's count)
    setCeremony({ rc, mult: rebirthMult(rc), stars: starsGot, fromLevel, toLevel: loadProgress().level, fromKey, toKey: getKeyTier(), kept });
  };
  // v3 ASCEND (R10): rebirths, levels and POWER reset; ★ += R − 9 — server-checked like the rebirth (lb_ascend).
  const [ascMsg, setAscMsg] = useState(null);
  const confirmAscend = async () => {
    if (rbBusyRef.current) return;
    rbBusyRef.current = true;
    setRbBusy(true);
    setAscMsg(null);
    const res = await performAscend();
    rbBusyRef.current = false;
    setRbBusy(false);
    if (!res.ok) {
      setAscMsg(rebirthRefusalText(res));
      return;
    }
    sndRebirth();
    setAscMsg(`ASCENDED — ★${formatNum(res.stars)} (+${formatNum(res.added || 0)} ★)`);
    setKeyTier(getKeyTier());
  };
  // REBIRTH READY → ×5 FOREVER (Andy oct3): opened from that button (menu CTA or a round-end card),
  // the rebirth runs straight away — the ONE tap was the confirm — and the ceremony plays. Layout
  // effect, so the panel is never painted first; the ref + the re-checked gate make a StrictMode
  // double-run (or a stale intent below the gate) a no-op, which then shows the normal REBIRTH view.
  const autoRebirthRef = useRef(false);
  useLayoutEffect(() => {
    if (autoRebirthRef.current || view !== 'rebirth') return;
    if (!takeRebirthNow()) return;
    autoRebirthRef.current = true;
    if (isRebirthReadyNow()) confirmRebirth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <div className={`shop-overlay${autoMode ? ' is-rr-auto' : ''}`} role="dialog" aria-modal="true" aria-label={view === 'rebirth' ? 'Rebirth' : 'Shop'} tabIndex={-1} ref={overlayRef}>
      <div className="shop-panel">
        <div className="shop-header">
          <h2 className="shop-title">{view === 'rebirth' ? 'REBIRTH' : 'SHOP'}</h2>
          <div className="shop-wins" aria-label={`${formatNum(wins)} wins`}>
            <span className="shop-coin" aria-hidden="true" />
            {formatNum(wins)}
          </div>
          <button type="button" className="shop-close" onClick={onBack} aria-label="Back to menu">
            ✕
          </button>
        </div>

        {view === 'shop' ? (
          <div className="shop-body">
            {/* KEY TIER — FIRST, so it is above the fold on a laptop (see THEMES below). */}
            {/* CLUTTER PASS: no "— TIER n" — the KEY Tn → Tn+1 line right under it carries the tier. */}
            <h3 className="shop-subtitle">{KEY_LABEL}</h3>
            <div className="shop-keypower">
              <div className="shop-kp-info">
                {/* REBIRTH RUSH: KEY multiplies XP / LETTER only — it no longer touches wins, so the shelf
                    quotes no WINS / WORD. ONE BIG LINE: this tier's KEY → the next one on the ladder
                    (×1, ×2, ×5, ×10, ×25 … ×1,000, then ×2.15 a tier). The price lives on the button, the
                    gap in the goal line. */}
                <div className="shop-kp-current">
                  {/* TIER IDENTITY (Andy oct5): each KEY tier wears its rung's rarity look (KEY_RAMP) — colour + glow,
                      shimmer / sparks as it climbs — so the tier reads at a glance, not from the number */}
                  POWER <span key={`kt${keyTier}`} className={`shop-kp-tier rarity-chip ${rarityClass(keyRarity(keyTier))}`}>T{formatNum(keyTier)}<RarityFx tier={keyRarity(keyTier)} /></span> <b>×{keyMult(keyXpMult(keyTier))}</b> XP / LETTER → <span className={`shop-kp-tier rarity-chip ${rarityClass(keyRarity(keyTier + 1))}`}>T{formatNum(keyTier + 1)}</span> <b>×{keyMult(keyXpMult(keyTier + 1))}</b>
                </div>
                <div className="shop-kp-rate">
                  {SEASON2 ? `BASE ${V3.econ.XP_BASE} XP / LETTER × POWER × REBIRTH × (1 + ★)` : 'BASE 10 XP / LETTER × POWER × REBIRTH'}
                </div>
                {/* §3 — the shop always shows this next goal + progress (there is always a next tier).
                    CLUTTER PASS: no "READY TO UNLOCK" — the full bar + the live HOLD price button say it. */}
                <div className="shop-goal">
                  {wins >= kpCost ? null : `NEED ${formatNum(kpCost - wins)} MORE WINS`}
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
            {/* LETTER FORGE: removed from the shelf (Rebirth Rush — not in the wins formula). Storage kept. */}

            <h3 className="shop-subtitle">POP STYLES</h3>
            {/* Andy oct2: cosmetics are collectibles, not the headline — small tiles, KEY TIER stays big. */}
            <div className="shop-grid shop-grid--compact">
              {POP_STYLES.map((item) => (
                <Card
                  key={item.id}
                  item={SEASON2 ? { ...item, price: itemPrice(item.id) } : item}
                  type="popStyle"
                  owned={owned}
                  equipped={equipped}
                  wins={shelfBalance}
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
                  item={SEASON2 ? { ...item, price: itemPrice(item.id) } : item}
                  type="soundPack"
                  owned={owned}
                  equipped={equipped}
                  wins={shelfBalance}
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
              {/* REBIRTH RUSH: every rebirth is ×5 XP & WINS, forever — the line names the step, then the
                  total it moves (×5^R → ×5^(R+1)). */}
              <div className="shop-rb-hero-label">REBIRTH: ×{formatNum(SEASON2 ? V3.econ.REBIRTH_STEP : REBIRTH_POWER)} XP &amp; WINS</div>
              <div className="shop-rb-hero-val">
                ×{formatMult(rebirthMult(rebirths))} → ×{formatMult(nextMult)}
                {rebirthReady && !SEASON2 && (
                  <>
                    {' · +'}
                    {formatNum(advice.stars)} <span className="shop-rb-star">★</span>
                  </>
                )}
                {rebirthReady && SEASON2 && <>{' · +'}{formatNum(V3.econ.rebirthGems(rebirths + 1))} GEMS</>}
              </div>
              {rebirthReady && !SEASON2 && (
                <div className="shop-rb-advice">
                  {advice.badTime
                    ? `BAD TIME — WAIT ${advice.nextIn} LV = +1 ★`
                    : `NEXT ★ IN ${advice.nextIn} LEVELS · NOW IS FINE`}
                </div>
              )}
              {/* H2d: the "NOW ×9 · 8 REBIRTHS" line went — GAIN below says ×9 → ×10, and the label's
                  REBIRTH n already says how many came before. */}
            </div>

            {/* §3 — rebirth always shows how far to the next rebirth + progress.
                CLUTTER PASS: no "READY TO REBIRTH" — the full bar + the live REBIRTH n button say it. */}
            <div className="shop-goal">
              {rebirthReady ? null : `${threshold - level} LEVELS TO GO` /* the bar is the ratio; the button says the gate LV */}
            </div>
            <ProgressBar value={rbProgress} />

            {/* KEY RESETS · WINS KEPT — the one rule that makes a rebirth a rebuy spree. The ×5 is the hero
                above; this says the cost. HEAD START lifts the new climb (stars.js headStartLevel). */}
            <ul className="shop-confirm-detail">
              <li>
                <b>LOSE:</b> LEVEL → {formatNum(headStartLevel(rebirths + 1))}.
              </li>
              <li>
                <b>KEEP:</b> WINS · {KEY_LABEL} · MARKS · PURCHASES · STATS.
              </li>
            </ul>

            {rebirthReady ? (
              confirming ? (
                <div className="shop-confirm-actions">
                  <button type="button" className="shop-card-btn danger" onClick={confirmRebirth} disabled={rbBusy} aria-busy={rbBusy}>
                    {rbBusy ? '…' : `CONFIRM REBIRTH ${rebirths + 1}`}
                  </button>
                  <button type="button" className="shop-card-btn ghost" onClick={() => setConfirming(false)} disabled={rbBusy}>
                    CANCEL
                  </button>
                </div>
              ) : (
                <button type="button" className="shop-rebirth" onClick={() => setConfirming(true)} disabled={rbBusy} aria-busy={rbBusy}>
                  {rbBusy ? '…' : SEASON2 ? <>REBIRTH {rebirths + 1} — ×{formatMult(nextMult)}</> : <>REBIRTH {rebirths + 1} — ×{formatMult(nextMult)} + {formatNum(advice.stars)} ★</>}
                </button>
              )
            ) : (
              <button type="button" className="shop-rebirth" disabled aria-disabled="true">
                {/* H2d: the goal line above already says how many levels to go and LV n / gate. */}
                REBIRTH AT LV {threshold}
              </button>
            )}
            {rbMsg && (
              <div className="shop-goal shop-rb-msg" role="status">
                {rbMsg}
              </div>
            )}

            {/* v3 ASCEND (R10): ★ += R − 9; rebirths, levels and POWER reset. The ★ multiply XP and wins (1 + ★). */}
            {SEASON2 && (
              <div className="shop-ascend">
                <h3 className="shop-subtitle">ASCEND — {formatNum(V3.store.getStarsV3())} ★</h3>
                <button
                  type="button"
                  className="shop-rebirth shop-ascend-btn"
                  onClick={confirmAscend}
                  disabled={rbBusy || !V3.econ.canAscend(rebirths)}
                  aria-busy={rbBusy}
                >
                  {V3.econ.canAscend(rebirths) ? `ASCEND → +${formatNum(V3.econ.starsForAscend(rebirths))} ★` : 'ASCEND AT REBIRTH 10'}
                </button>
                {ascMsg && <div className="shop-goal shop-asc-msg" role="status">{ascMsg}</div>}
              </div>
            )}
            {/* LAYER 1/2 — STAR PERKS and AUTOMATION (stars.js). Hidden until the first rebirth
                unlocks them (the claimable reveal names it); AUTOMATION shows its gate until R3. */}
            {rebirths >= 1 && !SEASON2 && (
              <>
                <h3 className="shop-subtitle">STAR PERKS — {formatNum(stars.balance)} ★</h3>
                <div className="shop-perks">
                  {LIVE_PERKS.map((p) => {
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
                          {maxed ? (p.max === 1 ? 'ON' : 'MAXED') : `${formatNum(cost)} ★`}
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
      {/* P7 POPUP PURGE (SEASON2 only): no centre sticker — the purchase is said as a right-edge toast (V3.Notify hosts
          it here, since the menu and its hosts are unmounted under the shop). Flag OFF: the sticker, unchanged. */}
      {reveal && (SEASON2 ? <S2BuyToast reveal={reveal} onDone={() => setReveal(null)} /> : <ShopReveal reveal={reveal} onDone={() => setReveal(null)} />)}
      {SEASON2 && V3.Notify && <V3.Notify />}
      {ceremony && <RebirthCeremony c={ceremony} onContinue={onBack} />}
      {keyTut && !reveal && !ceremony && (
        <SpotlightTutorial tutorial={keyTut} onDone={() => { markTutorialSeen(keyTut.id); setKeyTutDone(true); }} />
      )}
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
      {/* PROGRESSION v11 (review round 2): cosmetics are LOOKS ONLY — the old "+N% MENU XP" multiplied
          level XP up to ×6.9 for a masher. No XP line; the card sells the look. */}
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
          {/* C2: the GAP, in the same words KEY TIER and the FORGE use — "YOU HAVE n" was the balance, not the gap. */}
          {isNextGoal && <div className="shop-card-gap">NEED {formatNum(item.price - wins)} MORE</div>}
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

// P7 (SEASON2 only): the purchase, said once at the RIGHT edge (kit toast), then the reveal is over.
function S2BuyToast({ reveal, onDone }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  useEffect(() => {
    V3.toast(reveal.kind === 'keypower' ? { head: 'BOUGHT', label: reveal.name, icon: 'power', tile: '#FFE94A' } : { head: 'UNLOCKED', label: reveal.name, icon: 'shop', tile: '#FF4FA3' });
    onDoneRef.current();
  }, [reveal]);
  return null;
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
