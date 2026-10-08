// ShopV2.jsx — THE v2 SHOP (claude/mockups/v2/Shop.dc.html; SEASON2 only, P3).
//
// LAZY, its own chunk: ShopScreen renders it in place of the live SHOP only while the SEASON2 flag is on (live
// players see the old shop, untouched, until the flip). Built from the v2 kit (KitBackButton, KitPill ×2,
// KitHoldButton, KitTimerChip, KitStampCard, KitIcon, kit motion) on the REAL logic:
//   * POWER (left) — "wins buy only POWER": the price is keyTierCost(P) (PROGRESSION FINAL: 300 × 8^P — v3/econ.js), the
//     buy is shop.buyKeyPower() (the v3 swap counts the POWER LEVEL achievement), on a 1 s KitHoldButton (one POWER
//     per hold). The plate is a tilted square carrying the kit POWER key.
//   * STOCK (right) — six GEM-priced items (v3/stock.js): odd prices 45 / 65 / 120 / 150 / 225 / 495, rarity bands,
//     ×N LEFT, a 5:00 RESTOCK chip on the wall clock, the kit SOLD OUT stamp. FREE EPIC+ ROLL is shown but not sold
//     yet (its reveal is the ROLL screen's, P6).
// Motion: kit one-shots only (pill count / deny, stamp slam, BOUGHT! float, plate bump); nothing loops at rest.
import { useEffect, useRef, useState } from 'react';
import './ShopV2.css';
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

const NOTE = {
  nothing: 'NO BOOST RUNNING — NOTHING TO EXTEND',
  soon: 'FREE EPIC+ ROLL — COMES WITH THE ROLL SCREEN',
  sold_out: 'SOLD OUT — RESTOCKS ON THE TIMER',
};

/** One STOCK card: band · icon · big · what · gem price; SOLD OUT stamp at 0 left. */
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
      ariaLabel={`${it.big} ${it.what} — ${sold ? 'sold out' : soon ? 'coming soon' : `${it.price} gems, ${left} left`}`}
    >
      <span className="sp2-card-in" data-stock={it.id}>
        <span className="sp2-band">
          <span>{R.name}</span>
          <span className="sp2-left">×{formatNum(left)} LEFT</span>
        </span>
        <KitIcon name={it.icon} size={76} shadow={3} className="sp2-ico" />
        <span className="sp2-big">{it.big}</span>
        <span className="sp2-what">{it.what}</span>
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

/** Big screens: the 1280×720 stage scales up to fit (measured on mount / resize only — never per frame). */
function useStageScale(ref) {
  useEffect(() => {
    const set = () => {
      const w = window.innerWidth;
      const k = w >= 700 ? Math.max(1, Math.min(w / 1280, window.innerHeight / 720)) : 1;
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
  const rootRef = useRef(null);
  const winsPill = useRef(null);
  const gemsPill = useRef(null);
  const plateRef = useRef(null);
  const nowRef = useRef(null);
  const floats = useRef({});
  const cards = useRef({});
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useStageScale(rootRef);

  useEffect(() => subscribeGems(setGems), []);
  useEffect(() => {
    evShopOpened();
    rootRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onBackRef.current();
    };
    window.addEventListener('keydown', onKey);
    // the RESTOCK clock: one tick a second; a new 5-minute window refills the stock
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
    setTier(r.tier);
    fx(plateRef.current, FX.bump);
    fx(nowRef.current, FX.land(1)); // R5 oct8 #1: the NOW number lands with the surge
  };

  // ---- STOCK: gems ----
  const onBuy = (it) => {
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
          <div className="sp2-forever">FOREVER</div>
          <div className="sp2-plate" ref={plateRef} aria-hidden="true">
            <span className="sp2-plate-a" />
            <span className="sp2-plate-b" />
            <KitIcon name="power" size={104} shadow={3} className="sp2-plate-ico" />
          </div>
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

        <section className="sp2-stock" aria-label="Stock">
          <div className="sp2-stock-head">
            <div className="sp2-stock-title">
              <span className="sp2-stock-name">STOCK</span>
              <span className="sp2-stock-sub">CHANGES EVERY 5 MIN</span>
            </div>
            <KitTimerChip remaining={restockIn(now)} total={RESTOCK_MS / 1000} label="RESTOCK" note={null} className="sp2-timer" />
          </div>
          <div className="sp2-grid">
            {STOCK.map((it) => (
              <div key={it.id} className="sp2-cell" ref={(el) => { cards.current[it.id] = el; }}>
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
