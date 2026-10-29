// ShopV2.jsx — THE v2 SHOP (claude/mockups/v2/Shop.dc.html; SEASON2 only, P3).
//
// LAZY, its own chunk: ShopScreen renders it in place of the live SHOP only while the SEASON2 flag is on (live
// players see the old shop, untouched, until the flip). Built from the v2 kit (KitBackButton, KitPill ×2,
// KitHoldButton, KitTimerChip, KitStampCard, KitIcon, kit motion) on the REAL logic:
//   * POWER (left) — "wins buy only POWER": the price is keyTierCost(P) (PROGRESSION FINAL: 300 × 8^P — v3/econ.js), the
//     buy is shop.buyKeyPower() (the v3 swap counts the POWER LEVEL achievement), on a 1 s KitHoldButton (one POWER
//     per hold). The plate is a tilted square carrying the kit POWER key.
//   * DAILY FREE DROP (top of the right column, DailyDrop.jsx / v3/dailyDrop.js) — one free chest a local day.
//   * STOCK (right) — GEM-priced items (v3/stock.js): odd prices 45 / 65 / 120 / 150 / 225 / 495, rarity bands,
//     ×N LEFT, an hourly RESTOCK chip on the wall clock, the kit SOLD OUT stamp. The SEALED EPIC+ ROLL
//     (065) are sold by the SERVER (serverTickets.buyTicket) and open in place (SealedRollReveal). 069: EPIC+ only (500).
// Motion: kit one-shots only (pill count / deny, stamp slam, BOUGHT! float, plate bump); nothing loops at rest.
import { Suspense, useEffect, useRef, useState } from 'react';
import './ShopV2.css';
import { powerForm, nextPowerForm } from '../progress/powerArt.js';
import PowerLadder from './PowerLadder.jsx';
import { KitBackButton, KitHoldButton, KitPill, KitTimerChip, KitStampCard, KitIcon, FX, fx } from './kit/index.js';
import { getGems, subscribeGems } from '../progress/gemsCore';
import { useWinsBalance } from '../progress/useWinsBalance';
import { getKeyTier, keyTierCost, keyXpMult } from '../progress/xp';
import { letterXpNow } from '../progress/letterXp';
import { buyKeyPower } from '../progress/shop';
// v3/stock.js rides in the v3 chunk (installed before the first render in season 2) — read through the V3 holder, so
// no extra shared chunk is added to the eager index's preload map (payload ratchet)
import { V3 } from '../progress/season';
import { shopOpened as evShopOpened, itemPurchased as evItemPurchased } from '../lib/events.js';
import { sndPurchase } from '../audio/gameSounds';
import { useMomentHold } from '../lib/useMomentSlot';
import { formatNum, formatRate, formatMultExact } from '../format';
import ShopV2Looks from './ShopV2Looks';
import DailyDrop from './DailyDrop';
import VesselArt from './rollScreen/VesselArt';
import { lazyWithReload } from '../lib/chunkReload';
// 065 SEALED ROLLS: the SERVER sells the ticket (gems → lb_ticket_buy); the opening is its own lazy chunk (the roll code)
import { buyTicket } from '../leaderboard/serverTickets';
import { SHOP_ITEM_ART, CHEST_ART } from '../progress/boostArt.js';

const SHELF_ORDER = (stock) => [...stock.filter((it) => it.ticket), ...stock.filter((it) => !it.ticket)];
const SealedRollReveal = lazyWithReload(() => import('./rollScreen/SealedRollReveal'), 'SealedRollReveal');
// COSMETICS (Andy oct28 "i want all cosmetics to be from profile"): the shop's COSMETICS tab opens the PROFILE's one
// CUSTOMIZE menu over the shop (pop styles first) — the shop keeps no cosmetics screen of its own
const ProfilePopup = lazyWithReload(() => import('./profile/ProfilePopup.jsx'), 'ProfilePopup');
// the shelf tabs, each with its painted icon (Andy oct28 "give icons for boosts")
const SHELVES = [['boosts', 'BOOSTS', '/shop/everything.webp'], ['cosmetics', 'COSMETICS', '/shop/pop/chrome.webp'], ['codes', 'CODES', '/wheel/prize-ticket-rare.webp']];

// PAINTED SHOP ART (Andy oct16 "items in shop have horrendous design … nothing themed to the main page"; art run P1
// SET A, art-run/ART-RUN.md). An item listed here shows its painted product art instead of the kit icon — add a line as
// each cut file lands in public/shop/ (never a path that is not there: no 404s, no broken-image frame).
// oct29: the ChatGPT gear-quality set (progress/boostArt.js — the SAME pictures the dock / STATS / pill show)
const SHOP_ART = SHOP_ITEM_ART;

const NOTE = {
  nothing: 'NO BOOST RUNNING — NOTHING TO EXTEND',
  soon: 'SEALED ROLLS OPEN SOON',
  offline: 'SEALED ROLLS NEED YOU ONLINE WITH A NAME',
  budget: 'NOT YET — PLAY A LITTLE MORE',
  sold_out: 'SOLD OUT — RESTOCKS ON THE TIMER',
  not_sold: 'NOT IN THE SHOP ANYMORE',
};

const EVOLVE_FLASH = [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }];
const EVOLVE_SLAM = [{ transform: 'scale(1.9) rotate(-14deg)', opacity: 0 }, { transform: 'scale(.86) rotate(4deg)', opacity: 1, offset: 0.45 }, { transform: 'scale(1.06) rotate(-1deg)', opacity: 1, offset: 0.72 }, { transform: 'scale(1) rotate(0)', opacity: 1 }];

// RARITY READS BEYOND COLOUR (Andy oct28 "for rarer items maybe make the design more than just color"): RARE / EPIC cards
// sweep their tier's shine band on hover, an EPIC card wears a gold-set gem on its corner, and the featured canister stands
// on its painted crystal backplate (ShopV2.css, RARITY BEYOND COLOUR). COMMON stays plain: the ladder has a bottom.
/** One BOOST card (Andy oct8 "boost what?"): band = the item's NAME (rarity = the band colour) · ×N LEFT, icon, the
 *  EFFECT big, WHAT it boosts, HOW LONG, the gem price; SOLD OUT stamp at 0 left. */
function StockCard({ it, left, onBuy, floatRef }) {
  const R = V3.stock.RARITY[it.rarity];
  const sold = left <= 0;
  const soon = it.buyable === false;
  return (
    <KitStampCard
      stamped={sold}
      kind="soldout"
      className={`sp2-card is-${it.rarity}${soon ? ' is-soon' : ''}`}
      style={{ '--sp2-line': R.line, '--sp2-fill': R.fill }}
      onClick={() => onBuy(it)}
      badge={it.rarity === 'epic' ? <img className="sp2-gem" src="/shop/gem-epic-v1.webp" width="512" height="512" alt="" draggable="false" /> : null}
      ariaLabel={`${it.name || ''} ${it.big}${it.what ? ` ${it.what}` : ''}${it.time ? `, ${it.time}` : ''} — ${sold ? 'sold out' : soon ? 'coming soon' : `${it.price} gems, ${left} left`}`}
    >
      <span className="sp2-card-in" data-stock={it.id}>
        <span className="sp2-band" title={R.name}>
          <span className="sp2-name">{it.name || R.name}</span>
          <span className="sp2-left">×{formatNum(left)}<span className="sp2-left-w"> LEFT</span></span>
        </span>
        {it.ticket ? <VesselArt tier={it.ticket} size={null} label={false} className="sp2-art sp2-vessel" /> : SHOP_ART[it.id] ? <img className="sp2-art" src={SHOP_ART[it.id]} width="256" height="256" alt="" draggable="false" /> : <KitIcon name={it.icon} size={60} shadow={3} className="sp2-ico" />}
        <span className="sp2-big">{it.big}</span>
        {it.what ? <span className="sp2-what">{it.what}</span> : null}
        {it.time ? <span className="sp2-time">{it.time}</span> : null}
        {it.rarity === 'rare' || it.rarity === 'epic' ? <img className="sp2-shine" src={`/fx/shine-${it.rarity}.svg`} alt="" draggable="false" /> : null}
        <span className="sp2-price">
          <KitIcon name={soon ? 'lock' : 'gems'} size={22} shadow={2} extras={false} />
          {soon ? 'SOON' : formatNum(it.price)}
        </span>
      </span>
      <span className="sp2-float" ref={floatRef} aria-hidden="true">
        BOUGHT!
      </span>
    </KitStampCard>
  );
}

/**
 * THE DAILY CHEST as a SHELF ITEM (Andy oct10: "make the daily chest an item (like the other boosts and it has another
 * popup for the user to click)"): the first BOOSTS card — the chest art, FREE, ONCE A DAY — and a tap opens the chest
 * POPUP (the DailyDrop tap-to-open flow, unchanged). Claimed today: the CLAIMED stamp + the countdown to midnight.
 * A dot while it is ready (Andy: badges are a plain dot).
 */
function DailyChestCard({ now, onOpen }) {
  const D = V3.drop;
  const saved = D.readDrop(now);
  const claimed = !!saved.claimed;
  return (
    <KitStampCard
      stamped={claimed}
      kind="claimed"
      className={`sp2-card sp2-chest${claimed ? ' is-claimed' : ' is-ready'}`}
      style={{ '--sp2-line': '#FFE94A', '--sp2-fill': '#3a2a08' }}
      onClick={onOpen}
      badge={!claimed ? <span className="sp2-dot" aria-hidden="true" /> : null}
      ariaLabel={claimed ? `Daily chest opened — next in ${D.formatCountdown(D.msToReset(now))}` : 'Daily chest — free, once a day. Open it'}
    >
      <span className="sp2-card-in" data-stock="daily-chest" data-testid="daily-chest-card">
        <span className="sp2-band">
          <span className="sp2-name">DAILY</span>
          <span className="sp2-left">{claimed ? '×0' : '×1'}<span className="sp2-left-w"> LEFT</span></span>
        </span>
        <span className="sp2-chest-art" aria-hidden="true">
          <img className="sp2-chest-paint" src={CHEST_ART} width="256" height="256" alt="" draggable="false" />
        </span>
        <span className="sp2-big">CHEST</span>
        <span className="sp2-what">ONCE A DAY</span>
        <span className="sp2-price">{claimed ? D.formatCountdown(D.msToReset(now)) : 'FREE'}</span>
      </span>
    </KitStampCard>
  );
}

/** Big screens: the 1280×720 stage scales up to fit (measured on mount / resize only — never per frame). */
function useStageScale(ref) {
  useEffect(() => {
    const set = () => {
      const w = window.innerWidth;
      const k = w >= 1000 ? Math.max(1, Math.min(w / 1280, window.innerHeight / 720)) : 1; // under 1000 the stacked (phone) layout takes over
      if (ref.current) ref.current.style.setProperty('--sp2-k', k.toFixed(4));
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, [ref]);
}

export default function ShopV2({ onBack }) {
  const { STOCK, buyStock, stockLeft, restockIn, RESTOCK_MS } = V3.stock;
  useMomentHold(true);
  const wins = useWinsBalance();
  const [gems, setGems] = useState(getGems);
  const [tier, setTier] = useState(getKeyTier);
  const [now, setNow] = useState(() => Date.now());
  const [left, setLeft] = useState(() => stockLeft());
  const [note, setNote] = useState(null);
  // BOOSTS | LOOKS | CODES (Andy oct8: the season-1 POP STYLES, SOUND PACKS and CODES are back, one tap away)
  const [shelf, setShelf] = useState('boosts');
  const [cosmetics, setCosmetics] = useState(false); // the profile's CUSTOMIZE menu, opened over the shop
  const [chest, setChest] = useState(false); // the DAILY CHEST popup
  const [sealed, setSealed] = useState(null); // 065: a just-bought SEALED ROLL's ticket — the opening popup
  const buying = useRef(false);
  const chestRef = useRef(chest);
  chestRef.current = chest;
  const [ladder, setLadder] = useState(false); // THE POWER LADDER popup (a tap on the plate)
  const ladderRef = useRef(ladder);
  ladderRef.current = ladder;
  const sealedRef = useRef(sealed);
  sealedRef.current = sealed;
  const rootRef = useRef(null);
  const winsPill = useRef(null);
  const gemsPill = useRef(null);
  const plateRef = useRef(null);
  const evolveRef = useRef(null);
  const artRef = useRef(null);
  const [evolve, setEvolve] = useState(0); // bumps when a buy reaches a NEW POWER FORM
  // EVOLVE (oct24): a buy that reaches a new form flashes the plate white and SLAMS the new art in — one finite
  // WAAPI run each (transform / opacity only, will-change only while it plays, reduce motion = the new art at rest)
  useEffect(() => {
    if (!evolve) return;
    fx(evolveRef.current, { frames: EVOLVE_FLASH, opts: { duration: 520, easing: 'ease-out' } });
    fx(artRef.current, { frames: EVOLVE_SLAM, opts: { duration: 620, easing: 'cubic-bezier(.2,1.4,.4,1)' } });
  }, [evolve]);
  const nowRef = useRef(null);
  const floats = useRef({});
  const cards = useRef({});
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useStageScale(rootRef);

  useEffect(() => subscribeGems(setGems), []);
  // the shelf tabs' NEW dots (oct28, v3/shopDots.js — the menu's UPGRADES dot reads the same): COSMETICS lights for a newly
  // affordable look, until CUSTOMIZE's POP STYLE / SOUND tab shows it
  // V3.dots, never a static import: this chunk is idle-prefetched in season 1 too, and v3/hooks.js must only ever run under
  // the v3 install (a static import here evaluated it in season 1 and doubled the gear stats — e2e/marks.spec.js caught it)
  const tabDot = V3.dots ? { boosts: V3.dots.boostsNew(now), cosmetics: V3.dots.looksNew(gems), codes: false } : {};
  useEffect(() => {
    evShopOpened();
    rootRef.current?.focus();
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (sealedRef.current) return; // the SEALED ROLL opening owns the screen until NICE
      if (ladderRef.current) { setLadder(false); plateRef.current?.focus(); } // Esc closes the power forms first
      else if (chestRef.current) setChest(false); // Esc closes the chest popup first
      else onBackRef.current();
    };
    window.addEventListener('keydown', onKey);
    // the RESTOCK clock: one tick a second; a new hour window refills the stock
    const S = V3.stock;
    let w = S.windowOf();
    const iv = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (S.windowOf(t) !== w) {
        w = S.windowOf(t);
        setLeft(S.stockLeft(t));
      }
    }, 1000);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearInterval(iv);
    };
  }, []);
  useEffect(() => {
    if (!note) return undefined;
    const t = setTimeout(() => setNote(null), 2600);
    return () => clearTimeout(t);
  }, [note]);

  // ---- POWER: wins only, one per 1 s hold ----
  const form = powerForm(tier);
  const next = nextPowerForm(tier);
  const cost = keyTierCost(tier);
  const canPower = Number.isFinite(cost) && wins >= cost;
  // XP / KEY now → after the buy: the SAME number the menu's rate line and STATS show (letterXpNow — the worn mark,
  // INDEX and any BOOST included; levelXpPerLetter alone left them out), × POWER's own step for the next. SEASON 2
  // (v4 SIMPLE): XP comes from MENU KEYS only, so the unit is "XP / KEY" (R2 oct8 #3 — "XP / LETTER" was season 1's).
  const perNow = letterXpNow();
  const kNow = keyXpMult(tier);
  const kNext = keyXpMult(tier + 1);
  const perNext = kNow > 0 ? (perNow * kNext) / kNow : perNow;
  const onPower = () => {
    const r = buyKeyPower();
    if (!r.ok) {
      winsPill.current?.deny(cost - (r.wins || 0));
      return;
    }
    sndPurchase();
    evItemPurchased('key_power', r.tier);
    const evolved = powerForm(r.tier).n !== powerForm(r.tier - 1).n;
    setTier(r.tier);
    fx(plateRef.current, FX.bump);
    if (evolved) setEvolve((n) => n + 1); // a NEW FORM: the plate slams the new art in (below)
    fx(nowRef.current, FX.land(1)); // R5 oct8 #1: the NOW number lands with the surge
  };

  // ---- 065 SEALED ROLL: the server sells it; the wallet pays (refunded on a definite no) ----
  const onBuyTicket = async (it) => {
    if (buying.current) return;
    const short = it.price - getGems();
    if (left[it.id] <= 0) { fx(cards.current[it.id], FX.deny); setNote(NOTE.sold_out); return; }
    if (short > 0) { fx(cards.current[it.id], FX.deny); gemsPill.current?.deny(short); return; }
    buying.current = true;
    const r = await buyTicket(it.ticket);
    buying.current = false;
    if (Number.isFinite(r.left)) setLeft(V3.stock.setStockLeft(it.id, r.left));
    if (!r.ok) {
      fx(cards.current[it.id], FX.deny);
      if (r.reason === 'gems') gemsPill.current?.deny(r.short || short);
      else if (r.reason === 'sold_out') { setLeft(V3.stock.setStockLeft(it.id, 0)); setNote(NOTE.sold_out); }
      else setNote(NOTE[r.reason] || NOTE.offline);
      return;
    }
    sndPurchase();
    evItemPurchased(`stock_${it.id}`);
    fx(floats.current[it.id], FX.float);
    setSealed(r.ticket);
  };

  // ---- STOCK: gems ----
  const onBuy = (it) => {
    if (it.ticket) { onBuyTicket(it); return; }
    const r = buyStock(it.id);
    setLeft(r.left);
    if (!r.ok) {
      fx(cards.current[it.id], FX.deny);
      if (r.reason === 'gems') gemsPill.current?.deny(r.short);
      else setNote(NOTE[r.reason] || null);
      return;
    }
    sndPurchase();
    evItemPurchased(`stock_${it.id}`);
    fx(floats.current[it.id], FX.float);
  };

  return (
    <div className="sp2" role="dialog" aria-modal="true" aria-label="Upgrades" tabIndex={-1} ref={rootRef}>
      <div className="sp2-stripes" aria-hidden="true" />
      {sealed ? (
        <Suspense fallback={null}>
          <SealedRollReveal ticket={sealed} onDone={() => setSealed(null)} />
        </Suspense>
      ) : null}
      {chest && V3.drop ? (
        <div className="sp2-pop" role="dialog" aria-modal="true" aria-label="Daily chest" onClick={(e) => { if (e.target === e.currentTarget) setChest(false); }}>
          <div className="sp2-pop-in">
            <button type="button" className="sp2-pop-x" onClick={() => setChest(false)} aria-label="Close the daily chest">✕</button>
            {/* the tap-to-open flow rides the RESTOCK clock's 1 s tick (`now`) */}
            <DailyDrop now={now} />
          </div>
        </div>
      ) : null}
      {cosmetics ? <Suspense fallback={null}><ProfilePopup view0="customize" tab0="pop" onClose={() => setCosmetics(false)} /></Suspense> : null}
      {ladder ? <PowerLadder current={form.n} onClose={() => { setLadder(false); plateRef.current?.focus(); }} /> : null}
      <div className="sp2-scale">
      <div className="sp2-stage">
        <header className="sp2-head">
          <KitBackButton label="MENU" ariaLabel="Back to menu" onClick={onBack} className="sp2-back" />
          <h2 className="sp2-title">UPGRADES</h2>
          <div className="sp2-pills">
            <KitPill ref={winsPill} kind="wins" value={wins} ariaLabel={`${formatNum(wins)} wins`} />
            <KitPill ref={gemsPill} kind="gems" value={gems} ariaLabel={`${formatNum(gems)} gems`} />
          </div>
        </header>

        <section className="sp2-power" aria-label="Power">
          {/* THE POWER LADDER (oct24, powerArt.js): the plate shows the FORM this level has reached — a new painted icon
              every two levels, each with its own plate colour — and the next form waits, blacked out, in the corner */}
          <div className="sp2-forever" data-testid="sp2-form">FORM {form.n} · {form.name}</div>
          {/* a tap opens THE POWER LADDER: every form, the ones ahead hidden (Andy oct26) */}
          <button type="button" className="sp2-plate" ref={plateRef} aria-label={`Power form ${form.n}, ${form.name} — see every form`} aria-haspopup="dialog" onClick={() => setLadder(true)} style={{ '--pf-plate': form.plate, '--pf-inner': form.inner }} data-form={form.n}>
            <span className="sp2-plate-a" />
            <span className="sp2-plate-b" />
            <span className="sp2-evolve" ref={evolveRef} />
            <img key={form.n} ref={artRef} className="sp2-plate-ico sp2-plate-art" src={form.src} width="256" height="256" alt="" aria-hidden="true" draggable="false" />
            {next ? (
              <span className="sp2-next" title={`Next form at POWER ${next.at}`}>
                <img src={next.src} width="256" height="256" alt="" draggable="false" />
                <span className="sp2-next-at">P{next.at}</span>
              </span>
            ) : null}
          </button>
          <div className="sp2-pw">
            <span className="sp2-pw-lab">POWER</span>
            <span className="sp2-pw-now" data-testid="sp2-power" ref={nowRef}>{formatNum(tier)}</span>
            <span className="sp2-pw-arrow">→</span>
            <span className="sp2-pw-next">{formatNum(tier + 1)}</span>
          </div>
          {/* THE EFFECT, big (R2 oct8 #3): the POWER multiplier ×2^T → ×2^(T+1); the honest rate under it */}
          <div className="sp2-mult" aria-label={`Power multiplier ×${formatMultExact(kNow)} now, ×${formatMultExact(kNext)} after`}>
            <span className="sp2-mult-now">×{formatMultExact(kNow)}</span>
            <span className="sp2-mult-arrow">→</span>
            <span className="sp2-mult-next">×{formatMultExact(kNext)}</span>
          </div>
          <div className="sp2-per">
            <span className="sp2-per-now">{formatRate(perNow)}</span>
            <span className="sp2-per-arrow">→</span>
            <span className="sp2-per-next">{formatRate(perNext)}</span>
            <span className="sp2-per-lab">XP / KEY</span>
          </div>
          <KitHoldButton
            tone={canPower ? 'yellow' : 'gold'}
            className="sp2-buy"
            label={canPower ? 'HOLD TO BUY' : 'NEED WINS'}
            holdingLabel="HOLD…"
            sub={
              <>
                <KitIcon name="wins" size={16} shadow={1} extras={false} />
                {canPower ? formatNum(cost) : `${formatNum(cost - wins)} MORE`}
              </>
            }
            width={280}
            labelSize={30}
            disabled={!canPower}
            ariaLabel={canPower ? `Hold to buy POWER ${tier + 1} for ${formatNum(cost)} wins` : `POWER ${tier + 1} needs ${formatNum(cost)} wins`}
            confirmText="+1 POWER"
            onConfirm={onPower}
          />
        </section>

        <section className="sp2-stock" aria-label="Boosts">
          <div className="sp2-stock-head">
            <div className="sp2-tabs" role="tablist" aria-label="Shop shelves">
              {SHELVES.map(([k, label, icon]) => (
                <button key={k} type="button" role="tab" aria-selected={shelf === k} className={`sp2-tab${shelf === k ? ' is-on' : ''}`} data-shelf={k}
                  onClick={() => (k === 'cosmetics' ? setCosmetics(true) : setShelf(k))}>
                  <img className="sp2-tab-ico" src={icon} width="256" height="256" alt="" aria-hidden="true" draggable="false" />
                  {label}
                  {tabDot[k] && shelf !== k ? <span className="sp2-dot sp2-tab-dot" data-testid={`shop-tab-dot-${k}`} aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
            {shelf === 'boosts' && <KitTimerChip remaining={restockIn(now)} total={RESTOCK_MS / 1000} label="RESTOCK" note={null} className="sp2-timer" />}
          </div>
          <div className="sp2-stock-sub sp2-shelf-sub">
            {shelf === 'boosts' ? 'TIMED BOOSTS · STOCK REFILLS EVERY HOUR' : 'REDEEM A CODE'}
          </div>
          {shelf === 'codes' ? <div className="sp2-shelf"><ShopV2Looks tab="codes" gems={gems} onNote={setNote} /></div> : null}
          <div className="sp2-grid" hidden={shelf !== 'boosts'}>
            {V3.drop ? (
              <div className="sp2-cell is-chest">
                <DailyChestCard now={now} onOpen={() => { sndPurchase(); setChest(true); }} />
              </div>
            ) : null}
            {/* the SEALED ROLLS lead the shelf, right after the chest — the new thing is in the FIRST view, never below a scroll */}
            {SHELF_ORDER(STOCK).map((it) => (
              <div key={it.id} className={`sp2-cell${it.ticket ? ' is-ticket' : ' is-boost'}`} data-cell={it.id} ref={(el) => { cards.current[it.id] = el; }}>
                <StockCard it={it} left={left[it.id]} onBuy={onBuy} floatRef={(el) => { floats.current[it.id] = el; }} />
              </div>
            ))}
          </div>
          <div className="sp2-note" role="status" aria-live="polite">
            {note}
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
