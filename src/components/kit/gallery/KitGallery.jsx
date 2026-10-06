// KitGallery.jsx — DEV-ONLY page: every v2 kit component in every state, laid out like the four
// mockup sheets (claude/mockups/v2/Kit*.dc.html) so they can be screenshotted side by side, and so
// e2e/kit.spec.js has one place to drive them.
//
// Reached ONLY at /?kit=1 on the dev server, or in a build made with VITE_KIT_GALLERY=1 (the e2e
// build). A production build compiles the gate in main.jsx away, so this file — and the whole kit,
// until a screen uses it — is not in the production bundle and nothing in the app links here.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KitIcon,
  KIT_ICONS,
  KIT_ICON_NAMES,
  KitButton,
  KitHoldButton,
  KitGhostButton,
  KitBackButton,
  KitIconButton,
  KitRailButton,
  KitCycleButton,
  KitSlabTabs,
  KitPlateTabs,
  KitToggle,
  KitPill,
  KitPopStage,
  KitFlyLayer,
  useCachedCenter,
  KitStampCard,
  KitBadge,
  KitBannerHost,
  pushBanner,
  KitXpBar,
  KitPityBar,
  KitTimerRing,
  KitTimerBar,
  KitTimerChip,
  KitGoalBar,
  KitRankPlate,
  RANK_PLATES,
  KitRankBannerHost,
  KitEdgeToastHost,
  createBannerStore,
} from '../index.js';
import { UNLOCK_TOAST } from '../../../progress/v3/notify.js';
import { useReduceMotion } from '../../../lib/useReduceMotion.js';
import { setReduceMotion } from '../../../lib/reduceMotion.js';
import { formatNum } from '../../../format.js';
import './KitGallery.css';

const cap = (s) => <div className="kg-cap">{s}</div>;

function Diamond({ tone }) {
  return <span className={`kg-dia kg-bg-${tone}`} />;
}
function Stk({ children, tone = 'hot' }) {
  return <span className={`kg-stk kg-bg-${tone}`}>{children}</span>;
}
function StateHead({ tone, label, live }) {
  return (
    <div className="kg-state">
      <Diamond tone={tone} />
      {label}
      {live ? <Stk>{live}</Stk> : null}
    </div>
  );
}

/** Buttons-sheet panel: a rotated number tag on the top edge. */
function TagPanel({ num, title, tone, rot = -2, note, className = '', children }) {
  return (
    <section className={`kg-tp ${className}`}>
      <div className="kg-tp-tag" style={{ transform: `rotate(${rot}deg)` }}>
        <span className={`kg-tp-n kg-bg-${tone}`}>{num}</span>
        <span className="kg-tp-t">{title}</span>
      </div>
      {note ? <div className="kg-tp-note">{note}</div> : null}
      {children}
    </section>
  );
}
/** Currency-sheet panel: a header bar with a number block. */
function BarPanel({ num, title, tone, note, className = '', children }) {
  return (
    <section className={`kg-bp ${className}`}>
      <header className="kg-bp-h">
        <span className={`kg-bp-n kg-bg-${tone}`}>{num}</span>
        <span className="kg-bp-t">{title}</span>
        {note ? <span className="kg-bp-note">{note}</span> : null}
      </header>
      <div className="kg-bp-body">{children}</div>
    </section>
  );
}
/** Bars-sheet panel: a coloured top edge + skewed number chip. */
function EdgePanel({ num, title, tone, extra, right, className = '', children }) {
  return (
    <section className={`kg-ep kg-edge-${tone} ${className}`}>
      <header className="kg-ep-h">
        <span className={`kg-ep-n kg-bg-${tone}`}>{num}</span>
        <span className="kg-ep-t">{title}</span>
        {extra ? <span className="kg-ep-x">{extra}</span> : null}
        {right ? <span className="kg-ep-r">{right}</span> : null}
      </header>
      {children}
    </section>
  );
}
function SheetHead({ title, tone, tag, right, tagFirst, sub }) {
  return (
    <header className="kg-sh">
      {tagFirst ? <span className="kg-sh-tag">{tag}</span> : null}
      <h2 className={`kg-sh-t kg-c-${tone}`}>{title}</h2>
      {sub ? <span className="kg-sh-sub">{sub}</span> : null}
      {!tagFirst && tag ? <span className="kg-sh-tag">{tag}</span> : null}
      {right ? <div className="kg-sh-r">{right}</div> : null}
    </header>
  );
}

// ======================================================================== BUTTONS
const COST = 75;
const GIFT = 45;
const RAIL = [
  { label: 'SHOP', icon: 'shop', tone: 'yellow' },
  { label: 'ROLL', icon: 'roll', tone: 'cyan' },
  { label: 'INDEX', icon: 'index', tone: 'pink' },
  { label: 'REBIRTH', icon: 'rebirth', tone: 'purple' },
];
const PLATES = [
  { label: 'WINS', tone: 'yellow', w: 120 },
  { label: 'XP', tone: 'cyan', w: 96 },
  { label: 'REBIRTHS', tone: 'lilac', w: 186 },
];
const AUTO = [
  { label: 'OFF', tone: 'off' },
  { label: 'RARE+', tone: 'blue' },
  { label: 'EPIC+', tone: 'purple' },
  { label: 'LEGENDARY+', tone: 'gold' },
];
const NAMES = ['QWERTYQUEEN', 'KEYSMASH', 'LOWERCASE'];
const BASE = [[4.2e9, 8.8e8, 1.9e8], [3.1e12, 9.4e11, 2.2e11], [61, 48, 33]];
const PLATE_C = ['kg-c-yellow', 'kg-c-cyan', 'kg-c-lilac'];

function ButtonsSheet({ rm }) {
  const [gems, setGems] = useState(240);
  const [claimCd, setClaimCd] = useState(0);
  const [tier, setTier] = useState(7);
  const [commits, setCommits] = useState(0);
  const [cancels, setCancels] = useState(0);
  const [disabledClicks, setDisabledClicks] = useState(0);
  const [denies, setDenies] = useState(0);
  const [rank, setRank] = useState(4);
  const [ach, setAch] = useState(2);
  const [rail, setRail] = useState(1);
  const [dots, setDots] = useState({ SHOP: true, ROLL: false, INDEX: false, REBIRTH: true });
  const [tabA, setTabA] = useState(0);
  const [tabB, setTabB] = useState(0);
  const [auto, setAuto] = useState(0);
  useEffect(() => {
    if (!claimCd) return undefined;
    const t = setTimeout(() => setClaimCd(0), 2400);
    return () => clearTimeout(t);
  }, [claimCd]);
  const can = gems >= COST;
  const rows = NAMES.map((n, i) => {
    let v = BASE[tabB][i] * (tabA === 1 ? 0.07 : 1);
    if (tabB === 2) v = Math.max(1, Math.round(BASE[2][i] * (tabA === 1 ? 0.15 : 1)));
    return { n, v, i };
  });
  const price = 100 * Math.pow(4, tier);
  return (
    <div className="kg-sheet kg-sheet--buttons" id="buttons">
      <SheetHead
        title="BUTTONS"
        sub="TABS + TOGGLES"
        tone="cyan"
        tag="KIT 02"
        tagFirst
        right={
          <>
            <span className="kg-note">EVERYTHING HERE IS LIVE: HOVER, TAP, HOLD</span>
            <KitPill kind="gems" value={gems} label=" " />
          </>
        }
      />
      <div className="kg-b-grid">
        <TagPanel num="01" title="PRIMARY ACTION" tone="yellow" rot={-2} note="LIP 14 · INK 5 · SHADOW 6/6 · SKEW −7°" className="kg-b-primary">
          <div className="kg-row kg-row--primary">
            <div className="kg-col">
              <StateHead tone="yellow" label="IDLE" live="LIVE" />
              <KitButton
                label={can ? 'ROLL' : 'NO GEMS'}
                labelSize={can ? 38 : 24}
                sub={<><KitIcon name="gems" size={16} extras={false} shadow={0} />75</>}
                disabled={!can}
                lockText="NEED 75"
                ariaLabel="Roll for 75 gems"
                onClick={() => setGems((g) => g - COST)}
              />
              {cap(<>TAP: −75 GEMS<br />FACE ON TOP OF LIP</>)}
            </div>
            <div className="kg-col" aria-hidden="true">
              <StateHead tone="cyan" label="HOVER" />
              <KitButton label="ROLL" sub={<><KitIcon name="gems" size={16} extras={false} shadow={0} />75</>} freeze="hover" tabIndex={-1} />
              {cap(<>LIFT −4 · LIP 18<br />250MS OVERSHOOT</>)}
            </div>
            <div className="kg-col" aria-hidden="true">
              <StateHead tone="hot" label="PRESSED" />
              <KitButton label="ROLL" sub={<><KitIcon name="gems" size={16} extras={false} shadow={0} />75</>} freeze="pressed" tabIndex={-1} />
              {cap(<>LIP 14 → 3<br />34MS DOWN · 600MS UP</>)}
            </div>
            <div className="kg-col">
              <StateHead tone="faint" label="DISABLED" live="TAP" />
              <KitButton
                data-testid="kit-disabled"
                label="ROLL"
                disabled
                lockText="NEED 75"
                tag={{ text: '−41', tone: 'hot', side: 'right' }}
                ariaLabel="Roll, need 41 more gems"
                onClick={() => setDisabledClicks((n) => n + 1)}
                onDeny={() => setDenies((n) => n + 1)}
              />
              {cap(<>HATCH + LOCK STAYS<br />DEAD 3PX PRESS + SHAKE</>)}
              <span className="kg-sr" data-testid="kit-disabled-clicks">{disabledClicks}</span>
              <span className="kg-sr" data-testid="kit-disabled-denies">{denies}</span>
            </div>
            <div className="kg-col">
              <StateHead tone="cyan" label="CLAIM" live="LIVE" />
              <KitButton
                tone={claimCd ? 'off' : 'cyan'}
                label={claimCd ? 'CLAIMED' : 'CLAIM'}
                labelSize={claimCd ? 24 : 34}
                sub={claimCd ? 'NEXT IN 2S' : `+${GIFT} GEMS`}
                drainMs={claimCd ? 2400 : 0}
                drainKey={claimCd}
                tag={claimCd ? null : { text: 'READY', tone: 'yellow', side: 'left' }}
                ariaLabel={`Claim ${GIFT} gems`}
                onClick={() => {
                  if (claimCd) return;
                  setClaimCd(Date.now());
                  setGems((g) => g + GIFT);
                }}
              />
              {cap(<>+45 GEMS · 2.4S DRAIN<br />THEN BACK TO READY</>)}
            </div>
            <div className="kg-col kg-col--hold">
              <StateHead tone="gold" label="HOLD 1.0S" live="HOLD" />
              <KitHoldButton
                data-testid="kit-hold"
                ariaLabel="Hold to buy power tier"
                sub={<>POWER {tier} → {tier + 1} · <KitIcon name="wins" size={16} extras={false} shadow={0} />{formatNum(price)}</>}
                confirmText="+1 POWER"
                onConfirm={() => {
                  setTier((t) => t + 1);
                  setCommits((n) => n + 1);
                }}
                onCancel={() => setCancels((n) => n + 1)}
              />
              {cap(<>1.0S FILL · SHAKE UP AT 0.55S<br />LET GO EARLY = CANCEL, 180MS</>)}
              <span className="kg-sr" data-testid="kit-hold-commits">{commits}</span>
              <span className="kg-sr" data-testid="kit-hold-cancels">{cancels}</span>
            </div>
          </div>
        </TagPanel>

        <TagPanel num="02" title="SECONDARY + ICON" tone="cyan" rot={1.5} className="kg-b-second">
          <div className="kg-row kg-row--sec">
            <div className="kg-col">
              <KitBackButton />
              {cap('BACK · ARROW HULL')}
            </div>
            <div className="kg-col kg-pt6">
              <KitGhostButton label="INDEX" count="9/27" tone="cyan" ariaLabel="Open index" />
              {cap('GHOST · LIP 10 → 4')}
            </div>
            <div className="kg-col kg-pt6">
              <KitGhostButton label="ODDS" tone="purple" ariaLabel="Rules" />
              {cap('LIP = DESTINATION')}
            </div>
          </div>
          <div className="kg-row kg-row--icons">
            <div className="kg-icol">
              <KitIconButton icon="leaderboard" tone="yellow" rot={-3} tag={`#${formatNum(rank)}`} tagTone={rank === 1 ? 'gold' : 'yellow'} ariaLabel={`Leaderboard, rank ${formatNum(rank)}`} onClick={() => setRank((r) => (r > 1 ? r - 1 : 4))} />
              {cap('RANK TAG · TAP')}
            </div>
            <div className="kg-icol">
              <KitIconButton icon="stats" tone="cyan" rot={2} ariaLabel="Stats" />
              {cap('NOTHING TO DO')}
            </div>
            <div className="kg-icol">
              <KitIconButton
                icon="achievements"
                tone="hot"
                rot={-2}
                dot={ach > 0 ? ach : null}
                ariaLabel={`Achievements, ${ach} to claim`}
                onClick={() => {
                  if (ach > 0) {
                    setAch((a) => a - 1);
                    setGems((g) => g + 15);
                  } else setAch(2);
                }}
              />
              {cap(ach > 0 ? 'DOT · TAP CLAIMS' : 'CLEAR · TAP REFILL')}
            </div>
            <div className="kg-cap kg-cap--side">TILT ±3° EACH<br />TAG = RANK<br />DOT = REAL TO-DO</div>
          </div>
        </TagPanel>

        <TagPanel num="03" title="LEFT RAIL" tone="pink" rot={-1.5} className="kg-b-rail">
          <div className="kg-rail">
            <nav className="kg-rail-list" aria-label="Rail demo">
              {RAIL.map((r, i) => (
                <KitRailButton
                  key={r.label}
                  icon={r.icon}
                  label={r.label}
                  tone={r.tone}
                  active={rail === i}
                  dot={!!dots[r.label]}
                  onClick={() => {
                    setRail(i);
                    setDots((d) => ({ ...d, [r.label]: false }));
                  }}
                />
              ))}
            </nav>
            <ol className="kg-steps">
              <li><span className="kg-step kg-bg-yellow">1</span><span>EDGE WEDGE 24PX, −14°<br /><em>COLOUR = WHERE IT TAKES YOU</em></span></li>
              <li><span className="kg-step kg-bg-cyan">2</span><span>INK ICON 28PX + 2PX DROP<br /><em>SAME ICONS AS MENU V2</em></span></li>
              <li><span className="kg-step kg-bg-hot">3</span><span>DOT 22PX, ONE BEAT<br /><em>CLEARS WHEN YOU VISIT</em></span></li>
              <li><span className="kg-step kg-bg-purple">4</span><span>ACTIVE: +14 SLIDE, FLOOD,<br />POINTER SLAMS IN <b>· {RAIL[rail].label}</b></span></li>
            </ol>
          </div>
        </TagPanel>

        <TagPanel num="04" title="TABS" tone="purple" rot={-2.5} className="kg-b-tabs">
          <div className="kg-tabs">
            <div className="kg-tabs-l">
              <KitSlabTabs options={['ALL TIME', 'THIS WEEK']} value={tabA} onChange={setTabA} label="Time range" idBase="kg-ta" />
              {cap('2-SEG · SLOT + SLIDING SLAB · 340MS OVERSHOOT + SQUASH')}
              <div className="kg-scroll-x">
                <KitPlateTabs options={PLATES} value={tabB} onChange={setTabB} label="Rank by" idBase="kg-tb" />
              </div>
            </div>
            <div className="kg-tabs-r">
              <div className="kg-cap">PREVIEW · {tabA === 0 ? 'ALL TIME' : 'THIS WEEK'} · {PLATES[tabB].label}</div>
              {rows.map((r) => (
                <div key={r.n} className={`kg-lrow${r.i === 0 ? ' is-top' : ''}`}>
                  <span className="kg-lrow-r">#{r.i + 1}</span>
                  <span className="kg-lrow-n">{r.n}</span>
                  <span className={`kg-lrow-v ${PLATE_C[tabB]}`}>{formatNum(r.v)}</span>
                </div>
              ))}
              {cap('3-SEG PLATES: PICKED ONE GROWS 16 → 22, LIFTS, TAKES ITS COLOUR')}
            </div>
          </div>
        </TagPanel>

        <TagPanel num="05" title="TOGGLES" tone="gold" rot={2} className="kg-b-tog">
          <div className="kg-togrow">
            <div className="kg-togtext">
              <span className="kg-togname">REDUCE MOTION</span>
              <span className="kg-cap">{rm ? 'ON · THIS WHOLE KIT IS STILL NOW' : 'OFF · SHAKES, SLIDES, POPS'}</span>
            </div>
            <KitToggle checked={rm} onChange={setReduceMotion} label="Reduce motion" id="kg-rm" />
          </div>
          <div className="kg-togrow">
            <div className="kg-togtext">
              <span className="kg-togname">AUTO ROLL</span>
              <span className="kg-cap">TAP TO CYCLE · STOPS AT TARGET</span>
            </div>
            <KitCycleButton options={AUTO} index={auto} onChange={setAuto} ariaLabel="Auto roll target" />
          </div>
        </TagPanel>
      </div>
    </div>
  );
}

// ======================================================================== CURRENCY
const CUR = [
  { key: 'wins', spendName: 'POWER 7', cost: 3.3e6 },
  { key: 'gems', spendName: 'ROLL', cost: 75 },
  { key: 'levels', spendName: 'REBIRTH', cost: 1000 },
];
const TIERS = [
  { id: 's', tag: 'S', label: '+14.3K XP', dur: '0.8S', tone: 'cyan' },
  { id: 'm', tag: 'M', label: '+75 GEMS', dur: '1.3S', tone: 'cyand' },
  { id: 'l', tag: 'L', label: '+1 LEVEL', dur: '1.7S', tone: 'yellow' },
  { id: 'xl', tag: 'XL', label: '×10 OVERDRIVE', dur: '2.3S', tone: 'hot' },
];
const TOASTS = {
  mythic: { name: 'ZAP', verb: 'ROLLED MYTHIC', chip: '1 IN 10K', who: 'KAI_77 · WHOLE SERVER SEES THIS', tone: 'hot', glyph: 'bolt' },
  secret: { name: 'VOID', verb: 'ROLLED SECRET', chip: '1 IN 100K', who: 'YOU · FIRST IN THE SERVER', tone: 'white', glyph: 'eye' },
  boost: { name: '×10', verb: 'OVERDRIVE ON', chip: '0:30', who: 'EVERY WORD PAYS ×10 WINS', tone: 'yellow', glyph: 'bolt' },
};

function CurrencySheet() {
  const [vals, setVals] = useState({ wins: 2.61e6, gems: 240, levels: 940 });
  const pills = { wins: useRef(null), gems: useRef(null), levels: useRef(null) };
  const flyRef = useRef(null);
  const botRef = useRef(null);
  const dropRef = useRef(null);
  const botPt = useCachedCenter(botRef);
  const dropPt = useCachedCenter(dropRef);
  const [busy, setBusy] = useState({ bot: false, drop: false });
  const stageRef = useRef(null);
  const [statsN, setStatsN] = useState(3);
  const [boardOn, setBoardOn] = useState(true);
  const [stamps, setStamps] = useState([1, 1, 1, 1]);
  const gain = (key) => {
    const amt = key === 'wins' ? Math.round((380e3 + Math.random() * 80e3) / 1e3) * 1e3 : key === 'gems' ? [45, 75, 150][Math.floor(Math.random() * 3)] : 25;
    setVals((v) => ({ ...v, [key]: v[key] + amt }));
  };
  const spend = (key) => {
    const c = CUR.find((x) => x.key === key);
    if (vals[key] < c.cost) {
      pills[key].current.deny(c.cost - vals[key]);
      return false;
    }
    setVals((v) => ({ ...v, [key]: v[key] - c.cost }));
    return true;
  };
  const fly = (src, pt, amounts) => {
    if (busy[src]) return;
    setBusy((b) => ({ ...b, [src]: true }));
    flyRef.current.fly({
      from: pt.current,
      amounts,
      onLand: (a) => setVals((v) => ({ ...v, gems: v.gems + a })),
      onDone: () => setBusy((b) => ({ ...b, [src]: false })),
    });
  };
  const rollN = Math.floor(vals.gems / 75);
  const shopReady = vals.wins >= 3.3e6;
  return (
    <div className="kg-sheet kg-sheet--currency" id="currency">
      <SheetHead title="CURRENCY & FEEDBACK" tone="yellow" tag="KIT 01" right={<span className="kg-note kg-note--r">EVERY GAIN IS SHOWN<br /><b>TAP ANYTHING</b></span>} />
      <KitBannerHost contained />
      <div className="kg-c-grid">
        <BarPanel num="01" title="CURRENCY PILLS" tone="yellow" note="COUNT-UP · SQUASH · +N STACKS · SHAKE" className="kg-c-pills">
          <div className="kg-pills">
            {CUR.map((c) => (
              <div key={c.key} className="kg-pillcol">
                <KitPill ref={pills[c.key]} kind={c.key} value={vals[c.key]} />
                <div className="kg-pillbtns">
                  <button type="button" className="kg-btn kg-bg-yellow" data-testid={`kit-gain-${c.key}`} onClick={() => gain(c.key)}>+ GAIN</button>
                  <button type="button" className="kg-btn kg-btn--dark" data-testid={`kit-spend-${c.key}`} onClick={() => spend(c.key)}>
                    <span className="kg-btn-s">{c.spendName}</span>
                    <span className={`kg-btn-p${vals[c.key] >= c.cost ? '' : ' is-short'}`}>{formatNum(c.cost)}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </BarPanel>

        <BarPanel num="03" title="FLY TO COUNTER" tone="cyan" note="BURST · ARC · LAND" className="kg-c-fly">
          <div className="kg-flysrc">
            <button ref={botRef} type="button" className="kg-src" aria-label="Beat bot, collect 75 gems" onClick={() => fly('bot', botPt, [12, 12, 12, 13, 13, 13])}>
              <span className="kg-src-art"><KitIcon name="settings" size={72} /></span>
              <span className="kg-src-row"><span>BOT DOWN</span><span className="kg-src-chip"><KitIcon name="gems" size={16} extras={false} shadow={0} />75</span></span>
              {busy.bot ? <span className="kg-src-dim" /> : null}
            </button>
            <button ref={dropRef} type="button" className="kg-src" aria-label="Typing drop, collect 5 gems" onClick={() => fly('drop', dropPt, [2, 3])}>
              <span className="kg-src-art kg-src-tiles">
                {['Q', 'U', 'A', 'R', 'T', 'Z'].map((ch, i) => <span key={ch} className={`kg-tile${i === 2 ? ' is-hit' : ''}`}>{ch}</span>)}
              </span>
              <span className="kg-src-row"><span>TYPING DROP</span><span className="kg-src-chip"><KitIcon name="gems" size={16} extras={false} shadow={0} />5</span></span>
              {busy.drop ? <span className="kg-src-dim" /> : null}
            </button>
          </div>
          {cap('TAP · GEMS BURST, ARC INTO THE GEM PILL, EACH ONE LANDS')}
        </BarPanel>

        <BarPanel num="02" title="NUMBER POPS" tone="hot" note="BIGGER EVENT = BIGGER, LONGER, HARDER" className="kg-c-pops">
          <div className="kg-pops">
            <div className="kg-tiers">
              {TIERS.map((t) => (
                <button key={t.id} type="button" className="kg-tier" onClick={() => stageRef.current.play(t.id)}>
                  <span className={`kg-tier-tag kg-bg-${t.tone}`}>{t.tag}</span>
                  <span className="kg-tier-l">{t.label}</span>
                  <span className="kg-tier-d">{t.dur}</span>
                </button>
              ))}
            </div>
            <KitPopStage ref={stageRef} className="kg-stage" />
          </div>
        </BarPanel>

        <BarPanel num="04" title="BADGES" tone="lilac" note="ONLY WHEN THERE'S A TODO" className="kg-c-badges">
          <div className="kg-badges">
            {[
              { name: 'STATS', icon: 'stats', kind: 'count', count: statsN, show: statsN > 0, state: statsN > 0 ? `${statsN} TO CLAIM` : 'ALL CLAIMED', tap: () => statsN > 0 && setStatsN(0) },
              { name: 'BOARD', icon: 'leaderboard', kind: 'dot', show: boardOn, state: boardOn ? 'RANK UP' : 'SEEN', tap: () => setBoardOn(false) },
              { name: 'SHOP', icon: 'shop', kind: 'alert', show: shopReady, state: shopReady ? 'POWER READY' : 'NOT YET', tap: () => spend('wins') },
              { name: 'ROLL', icon: 'roll', kind: 'count', count: rollN, show: rollN > 0, state: rollN > 0 ? `${rollN} ROLLS` : 'NO GEMS', tap: () => spend('gems') },
            ].map((b) => (
              <div key={b.name} className="kg-badge">
                <button type="button" className="kg-badge-tile" aria-label={b.name} onClick={b.tap}>
                  <KitIcon name={b.icon} size={50} extras={false} />
                  <KitBadge kind={b.kind} count={b.count} show={b.show} />
                </button>
                <div className="kg-badge-n">{b.name}</div>
                <div className={`kg-badge-s${b.show ? ' is-live' : ''}`}>{b.state}</div>
              </div>
            ))}
          </div>
          <div className="kg-badge-foot">
            <span className="kg-cap">SHOP + ROLL BADGES READ YOUR REAL WINS + GEMS</span>
            <button type="button" className="kg-btn kg-bg-lilac kg-btn--sm" onClick={() => { setStatsN((n) => n + 3); setBoardOn(true); }}>+ NEW TODO</button>
          </div>
        </BarPanel>

        <BarPanel num="05" title="STAMPS" tone="purple" note="TAP A CARD TO RE-SLAM" className="kg-c-stamps">
          <div className="kg-stamps">
            <KitStampCard stamped kind="claimed" playKey={stamps[0]} onClick={() => setStamps((s) => [s[0] + 1, s[1], s[2], s[3]])} ariaLabel="Replay CLAIMED stamp">
              <div className="kg-card-h kg-bg-cyan">ACHIEVEMENT</div>
              <div className="kg-card-t">TYPE 10K<br />WORDS</div>
              <div className="kg-card-r"><KitIcon name="gems" size={20} extras={false} shadow={0} /><span className="kg-c-cyan">+150</span></div>
            </KitStampCard>
            <KitStampCard stamped kind="soldout" playKey={stamps[1]} style={{ '--kstc-bg': 'var(--k-blue-fill)' }} onClick={() => setStamps((s) => [s[0], s[1] + 1, s[2], s[3]])} ariaLabel="Replay SOLD OUT stamp">
              <div className="kg-card-h kg-bg-blue kg-card-h--split"><span>RARE</span><span>×0 LEFT</span></div>
              <div className="kg-card-c"><KitIcon name="boost" size={58} /></div>
              <div className="kg-card-big kg-c-yellow">×2 LUCK</div>
            </KitStampCard>
            <KitStampCard stamped kind="new" playKey={stamps[2]} style={{ '--kstc-bg': 'var(--k-hot-fill)' }} onClick={() => setStamps((s) => [s[0], s[1], s[2] + 1, s[3]])} ariaLabel="Replay NEW stamp">
              <div className="kg-card-h kg-bg-hot">MYTHIC</div>
              <div className="kg-card-c"><KitIcon name="overdrive" size={62} /></div>
              <div className="kg-card-zap"><span>ZAP</span><span className="kg-c-yellow">×10 XP</span></div>
            </KitStampCard>
            <KitStampCard stamped kind="max" playKey={stamps[3]} onClick={() => setStamps((s) => [s[0], s[1], s[2], s[3] + 1])} ariaLabel="Replay MAX stamp">
              <div className="kg-card-h kg-bg-gold">UPGRADE</div>
              <div className="kg-card-pw"><span className="kg-c-dim">POWER</span><span className="kg-card-pwn">50</span></div>
              <div className="kg-card-hatch" />
              <div className="kg-card-m">1.2B XP / LETTER</div>
            </KitStampCard>
          </div>
        </BarPanel>

        <BarPanel num="06" title="TOP BANNERS" tone="gold" note="FROM THE TOP · NEVER CENTER" className="kg-c-banners">
          <div className="kg-tbtns">
            {[
              { k: 'mythic', name: 'ZAP', verb: 'MYTHIC ROLL', chip: '1 IN 10K', tone: 'hot' },
              { k: 'secret', name: 'VOID', verb: 'SECRET ROLL', chip: '1 IN 100K', tone: 'white' },
              { k: 'boost', name: '×10', verb: 'OVERDRIVE BOOST', chip: '0:30', tone: 'yellow' },
            ].map((t) => (
              <button key={t.k} type="button" className="kg-tbtn" onClick={() => pushBanner(TOASTS[t.k])}>
                <span className={`kg-tbtn-s kg-bg-${t.tone}`} />
                <span className={`kg-tbtn-n kg-c-${t.tone}`}>{t.name}</span>
                <span className="kg-tbtn-v">{t.verb}</span>
                <span className="kg-tbtn-c">{t.chip}</span>
              </button>
            ))}
          </div>
          {cap('STACKS 3 DEEP · 4S EACH · TAP A BANNER TO CLOSE')}
        </BarPanel>
      </div>
      <KitFlyLayer ref={flyRef} target={() => pills.gems.current && pills.gems.current.iconEl()} />
    </div>
  );
}

// ======================================================================== BARS
const NEED = 35000;
const PER = 21000;
const SHOP_MAX = 300;
const BOOST_MAX = 600;
const LUCK_MAX = 120;
const GOALS = [
  { name: 'WIN ROUNDS', icon: 'achievements', tiers: [50, 500, 5000, 5e4, 5e5], tier: 1, v: 212, step: 60 },
  { name: 'TYPE LETTERS', icon: 'power', tiers: [1e4, 1e5, 1e6, 1e7, 1e8], tier: 2, v: 912000, step: 30000 },
];

function BarsSheet() {
  const [xp, setXp] = useState(() => ({ T: 1243100 + 24000 / NEED }));
  const [last, setLast] = useState('-');
  const lvl = Math.floor(xp.T);
  const frac = xp.T - lvl;
  const addXp = (n) => setXp((s) => ({ T: s.T + (n * PER) / NEED }));
  const startT = useRef(null);
  const onClimbDone = useCallback((l, f, ms) => {
    if (startT.current === null) return;
    setLast(`${l - startT.current >= 1 ? `+${formatNum(l - startT.current)} LV` : 'XP'} IN ${(ms / 1000).toFixed(2)}S`);
    startT.current = null;
  }, []);
  const climb = (n) => {
    if (startT.current === null) startT.current = lvl;
    addXp(n);
  };

  const [pity, setPity] = useState({ left: 37, leg: 412, hit: false });
  const roll = () => {
    if (pity.hit) return;
    const p = pity.left - 1;
    const lg = pity.leg > 1 ? pity.leg - 1 : 500;
    if (p <= 0) {
      setPity({ left: 0, leg: lg, hit: true });
      setTimeout(() => setPity((s) => ({ ...s, left: 50, hit: false })), 1100);
    } else setPity({ left: p, leg: lg, hit: false });
  };

  const [tm, setTm] = useState({ shop: 263, boost: 598, luck: 41 });
  useEffect(() => {
    const iv = setInterval(() => {
      setTm((t) => ({ shop: t.shop <= 0 ? SHOP_MAX : t.shop - 1, boost: Math.max(0, t.boost - 1), luck: t.luck <= 0 ? LUCK_MAX : t.luck - 1 }));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const [goals, setGoals] = useState(GOALS);
  const [gems, setGems] = useState(240);
  const act = (gi) => {
    const g = goals[gi];
    if (!g || g.tier >= 5) return;
    if (g.v >= g.tiers[g.tier]) {
      setGems((x) => x + 75);
      setGoals((gs) => gs.map((x, i) => (i === gi ? { ...x, tier: x.tier + 1 } : x)));
    } else {
      setGoals((gs) => gs.map((x, i) => (i === gi ? { ...x, v: x.v + x.step } : x)));
    }
  };
  return (
    <div className="kg-sheet kg-sheet--bars" id="bars">
      <SheetHead title="BARS + METERS" tone="cyan" tag="KIT 05" right={<><span className="kg-chip">FILL = SCALEX</span><span className="kg-chip">WRAP CAP 1S</span><span className="kg-chip">URGENT &lt; 30S</span></>} />
      <EdgePanel num="01" title="MENU XP BAR" tone="yellow" extra="HERO · SPAM THE BUTTONS" right={<><span className="kg-out">A · 250MS GLIDE</span><span className="kg-out">B · RETARGET, NEVER RESTART</span><span className="kg-out">C · SWEEP PER LEVEL</span><span className="kg-out">D · 6+ LEVELS COMPRESS</span></>} className="kg-x">
        <div className="kg-x-bar" data-testid="kit-xp-wrap">
          <KitXpBar level={lvl} frac={frac} need={NEED} onClimbDone={onClimbDone} className="kg-xp" />
        </div>
        <div className="kg-x-foot">
          <div className="kg-x-rate">
            <div className="kg-x-per">+21.0K XP<span> / LETTER</span></div>
            <div className="kg-cap">LAST <span className="kg-c-cyan" data-testid="kit-xp-last">{last}</span></div>
          </div>
          <div className="kg-x-btns">
            <button type="button" className="kg-btn kg-btn--big kg-bg-yellow" onClick={() => climb(1)}>+1 LETTER</button>
            <button type="button" className="kg-btn kg-btn--big kg-bg-cyan" onClick={() => climb(5)}>+5 LETTERS</button>
            <button type="button" className="kg-btn kg-btn--big kg-bg-hot" onClick={() => climb(50)}>+50 STRESS</button>
          </div>
        </div>
      </EdgePanel>
      <div className="kg-bars-grid">
        <EdgePanel num="02" title="PITY METER" tone="purple" right={<><button type="button" className="kg-btn kg-btn--sm kg-bg-yellow" onClick={roll}>ROLL</button><button type="button" className="kg-btn kg-btn--sm kg-btn--dark" onClick={() => !pity.hit && setPity((s) => ({ ...s, left: 3 }))}>→ 3 LEFT</button></>}>
          <KitPityBar left={pity.left} total={50} label="EPIC+" hit={pity.hit} sub={{ label: 'LEGENDARY+', left: pity.leg, total: 500 }} />
        </EdgePanel>
        <EdgePanel num="03" title="TIMERS" tone="cyan" right={<><button type="button" className="kg-btn kg-btn--sm kg-bg-hot" onClick={() => setTm({ shop: 35, boost: 33, luck: 31 })}>→ 0:35</button><button type="button" className="kg-btn kg-btn--sm kg-btn--dark" onClick={() => setTm({ shop: 263, boost: 598, luck: 41 })}>RESET</button></>}>
          <div className="kg-timers">
            <KitTimerRing remaining={tm.shop} total={SHOP_MAX} />
            <div className="kg-timers-r">
              <KitTimerBar remaining={tm.boost} total={BOOST_MAX} />
              <KitTimerChip remaining={tm.luck} total={LUCK_MAX} />
            </div>
          </div>
        </EdgePanel>
        <EdgePanel num="04" title="GOAL BARS" tone="gold" right={<span className="kg-gemchip"><KitIcon name="gems" size={22} extras={false} shadow={2} />{formatNum(gems)}</span>}>
          <div className="kg-goals">
            {goals.map((g, i) => (
              <KitGoalBar key={g.name} icon={g.icon} name={g.name} tier={g.tier} value={g.v} target={g.tiers[Math.min(g.tier, 4)]} actionLabel={`+${formatNum(g.step)}`} claimLabel="CLAIM +75" onAction={() => act(i)} />
            ))}
          </div>
        </EdgePanel>
      </div>
    </div>
  );
}

// ======================================================================== LEVEL + RANK UP (KitLevelUp.dc.html, P9a)
const LU_UNLOCKS = [
  { code: 'R1', label: 'ROLL', id: 'rollScreen' },
  { code: 'R2', label: 'AUTO ROLL', id: 'autoRoll' },
  { code: 'R3', label: 'BOOST SLOT', id: 'boost2' },
  { code: 'R5', label: 'MARK SLOT', id: 'mark2' },
  { code: 'R7', label: 'LUCK ×1.25', id: 'luck' },
  { code: 'R10', label: 'ASCEND', id: 'ascend' },
];
const luBanners = createBannerStore({ lifeMs: 2500, leaveMs: 0, max: 1 });
const luToasts = createBannerStore({ lifeMs: 2400, leaveMs: 0, max: 3 });

function LevelUpSheet() {
  const [xp, setXp] = useState({ lv: 1243100, fr: 0.62 });
  const [last, setLast] = useState('-');
  const startT = useRef(null);
  const onClimbDone = useCallback((l, f, ms) => {
    if (startT.current === null) return;
    setLast(`+${formatNum(l - startT.current)} LV IN ${(ms / 1000).toFixed(2)}S`);
    startT.current = null;
  }, []);
  const addLv = (n) => {
    if (startT.current === null) startT.current = xp.lv;
    setXp((s) => ({ lv: s.lv + n, fr: s.fr }));
  };
  const [rk, setRk] = useState(2);
  const [un, setUn] = useState(1);
  const bannerFor = (r) => ({ from: { name: RANK_PLATES[r - 1].name, req: RANK_PLATES[r - 1].req }, to: { name: RANK_PLATES[r].name, req: RANK_PLATES[r].req } });
  const toastFor = (i) => {
    const u = LU_UNLOCKS[i];
    return { code: u.code, label: u.label, ...UNLOCK_TOAST[u.id] };
  };
  useEffect(() => {
    const a = setTimeout(() => luBanners.push(bannerFor(2)), 500);
    const b = setTimeout(() => luToasts.push(toastFor(1)), 1100);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  const nextRank = () => {
    const r = rk + 1 > 15 ? 1 : rk + 1;
    setRk(r);
    luBanners.push(bannerFor(r));
  };
  const pickUnlock = (i) => {
    setUn(i);
    luToasts.push(toastFor(i));
  };
  return (
    <div className="kg-sheet kg-sheet--lu" id="levelup">
      <SheetHead title="LEVEL + RANK UP" tone="yellow" tag="KIT 06" right={<><span className="kg-chip">EDGES ONLY · NO CENTER POPUPS</span><span className="kg-chip">RANK = STATUS · NO REWARDS</span><span className="kg-chip">TRANSFORM + OPACITY</span></>} />
      <EdgePanel num="01" title="XP BAR LEVEL-UP" tone="yellow" extra="IN-RUN · LIVES ON THE BAR" right={<><span className="kg-out">A · FILL TO CAP</span><span className="kg-out">B · WHITE SWEEP + WRAP</span><span className="kg-out">C · LV TICK BUMP</span><span className="kg-out">D · MULTI = +N LV CHIP</span></>} className="kg-x">
        <div className="kg-x-bar" data-testid="lu-xp-wrap">
          <KitXpBar level={xp.lv} frac={xp.fr} need={Math.round(800 * Math.pow(xp.lv + 1, 0.75))} onClimbDone={onClimbDone} className="kg-xp" />
        </div>
        <div className="kg-x-foot">
          <div className="kg-cap">LAST <span className="kg-c-cyan" data-testid="lu-xp-last">{last}</span></div>
          <div className="kg-x-btns">
            <button type="button" className="kg-btn kg-btn--big kg-bg-yellow" onClick={() => addLv(1)}>+1 LV</button>
            <button type="button" className="kg-btn kg-btn--big kg-bg-cyan" onClick={() => addLv(37)}>+37 LV</button>
          </div>
        </div>
      </EdgePanel>
      <div className="kg-lu-grid">
        <EdgePanel num="02" title="RANK-UP BANNER" tone="purple" extra="0.5S IN · 1.6S HOLD · 0.4S OUT" right={<button type="button" className="kg-btn kg-btn--sm kg-bg-yellow" onClick={nextRank}>NEXT RANK</button>}>
          <div className="kg-lu-screen" data-testid="lu-banner-screen">
            <KitRankBannerHost store={luBanners} contained />
            <div className="kg-lu-ghost">GAME STAYS CLEAR</div>
          </div>
        </EdgePanel>
        <EdgePanel num="04" title="UNLOCK TOAST" tone="cyan" extra="RIGHT EDGE · 2.4S · STACKS DOWN" right={<>{LU_UNLOCKS.map((u, i) => <button key={u.code} type="button" className={`kg-btn kg-btn--sm ${i === un ? 'kg-bg-cyan' : 'kg-btn--dark'}`} onClick={() => pickUnlock(i)}>{u.code}</button>)}</>}>
          <div className="kg-lu-screen kg-lu-screen--toast" data-testid="lu-toast-screen">
            <div className="kg-lu-toasthost"><KitEdgeToastHost store={luToasts} contained /></div>
          </div>
        </EdgePanel>
      </div>
      <EdgePanel num="03" title="RANK PLATES" tone="hot" extra="NAME BADGES · SHAPE + TRIM ESCALATE · ★ TIERS SHIMMER" right={<><span className="kg-out">R0-R10 REBIRTH</span><span className="kg-out kg-c-yellow">★ ASCENSION</span></>}>
        <div className="kg-lu-plates" data-testid="lu-plates">
          {RANK_PLATES.map((p) => (
            <div key={p.req} className="kg-lu-plate">
              <KitRankPlate rank={p.req} w={156} />
              <div className="kg-lu-pcap"><span className="kg-lu-pcode" style={{ color: p.c1 }}>{p.req}</span>{p.cap}</div>
            </div>
          ))}
        </div>
      </EdgePanel>
    </div>
  );
}

// ======================================================================== ICONS
function IconsSheet() {
  return (
    <div className="kg-sheet kg-sheet--icons" id="icons">
      <SheetHead
        title="ICONS"
        tone="cyan"
        tag={`UI KIT · ${KIT_ICON_NAMES.length}`}
        right={
          <>
            <span className="kg-legend"><small>LIGHT</small><b className="kg-c-yellow">↖ TOP-LEFT</b></span>
            <span className="kg-legend"><small>INK</small><b className="kg-c-cyan">6 / 100</b></span>
            <span className="kg-legend"><small>DROP</small><b className="kg-c-hot">4 · 3 · 2 PX</b></span>
            <span className="kg-legend"><small>SIZES</small><b>96 · 48 · 24</b></span>
          </>
        }
      />
      <div className="kg-icons">
        {KIT_ICON_NAMES.map((n) => {
          const d = KIT_ICONS[n];
          return (
            <div key={n} className="kg-itile" style={{ '--kg-it': d.tone }}>
              <span className="kg-sw"><span style={{ background: d.tone }} /><span style={{ background: d.shade }} /></span>
              <div className="kg-isizes">
                <KitIcon name={n} size={96} />
                <KitIcon name={n} size={48} />
                <KitIcon name={n} size={24} />
              </div>
              <div className="kg-iname">{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ======================================================================== PAGE
// ?kit=1&sheet=bars renders one sheet alone (perf measurement, focused screenshots)
const ONLY = (() => {
  try {
    return new URLSearchParams(window.location.search).get('sheet');
  } catch {
    return null;
  }
})();
const show = (id) => !ONLY || ONLY === id;

export default function KitGallery() {
  const rm = useReduceMotion();
  useEffect(() => {
    document.title = 'Kit gallery';
    document.documentElement.classList.add('kg-page');
    return () => document.documentElement.classList.remove('kg-page');
  }, []);
  return (
    <main className="kg" data-reduce={rm ? '1' : '0'}>
      <nav className="kg-nav" aria-label="Kit sheets">
        <span className="kg-nav-t">V2 KIT</span>
        <a href="#currency">CURRENCY</a>
        <a href="#buttons">BUTTONS</a>
        <a href="#bars">BARS</a>
        <a href="#icons">ICONS</a>
        <a href="#levelup">LEVEL UP</a>
        <span className="kg-nav-rm" data-testid="kit-rm-state">REDUCE MOTION {rm ? 'ON' : 'OFF'}</span>
      </nav>
      {show('buttons') && <ButtonsSheet rm={rm} />}
      {show('currency') && <CurrencySheet />}
      {show('bars') && <BarsSheet />}
      {show('icons') && <IconsSheet />}
      {show('levelup') && <LevelUpSheet />}
    </main>
  );
}
