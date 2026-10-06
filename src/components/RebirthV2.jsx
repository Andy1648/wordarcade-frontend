// RebirthV2.jsx — THE v2 REBIRTH SCREEN (claude/mockups/v2/Rebirth.dc.html; SEASON2 only, P3).
//
// LAZY, its own chunk: ShopScreen renders it in place of the live REBIRTH view only while the SEASON2 flag is on
// (live players see the old view, untouched, until the flip). Built from the v2 kit (KitBackButton, KitPill,
// KitHoldButton, KitIcon, kit motion) on the REAL v3 logic:
//   * HOLD TO REBIRTH — KitHoldButton (1.0 s charge + rattle). The rebirth is sent ONLY when the hold completes:
//     performRebirth() (leaderboard/serverRebirth.js — lb_rebirth, server-checked, persisted idempotent request id,
//     single-flight). The button is DISABLED while the request is pending; a refusal (gate / pace / offline) shows one
//     numbers-first line (rebirthFlow.rebirthRefusalText) and applies nothing. ONE rebirth per hold — never bulk.
//   * on ok: the stage SHAKES, the screen FLASHES, the AFTER numeral SLAMS in with the new count (kit FX one-shots).
//   * YOU GET: ×2 XP & WINS (2^R → 2^(R+1), × (1 + ★)), +7 × R gems, POWER kept, LEVELS → 1.
//   * UNLOCKS — the diamond track from v3/unlocks.js (R1 ROLL · R2 AUTO ROLL · R3 2ND BOOST · R5 2ND MARK · R7 LUCK ·
//     R10 ASCEND), lit by unlocked(feature, { rebirths, stars }).
//   * R10+: HOLD TO ASCEND — performAscend() (lb_ascend, same single-flight + request-id path): ★ += R − 9.
// The emblem is a HEXAGON plate (vector, no cog — cogs belong to marks). Motion: transform / opacity one-shots only;
// nothing loops at rest; REDUCE MOTION drops every effect (kit motion.js).
import { useEffect, useRef, useState } from 'react';
import './RebirthV2.css';
import { KitBackButton, KitHoldButton, KitPill, KitIcon, FX, fx } from './kit/index.js';
import { V3 } from '../progress/season';
import { loadProgress, getRebirths, rebirthThreshold, rebirthMult } from '../progress/xp';
import { takeRebirthNow } from '../progress/rebirthNow';
import { performRebirth, performAscend } from '../leaderboard/serverRebirth';
import { rebirthRefusalText } from '../leaderboard/rebirthFlow';
import { rebirth as evRebirth, refreshSessionProps } from '../lib/events.js';
import { sndRebirth } from '../audio/gameSounds';
import { useMomentHold } from '../lib/useMomentSlot';
import { formatNum, formatMult } from '../format';

/** Everything the screen shows, read fresh (after a rebirth / ascension it is simply read again). */
function readState() {
  const level = loadProgress().level;
  const rebirths = getRebirths() || 0;
  const stars = V3.store ? V3.store.getStarsV3() : 0;
  const gate = rebirthThreshold(rebirths);
  return { level, rebirths, stars, gate, ready: level >= gate };
}

/** The hexagon emblem plate (vector art; the kit's REBIRTH icon on it). */
function HexPlate() {
  return (
    <div className="rb2-hex" aria-hidden="true">
      <svg className="rb2-hex-plate" viewBox="0 0 120 110" width="104" height="96" focusable="false">
        <polygon points="36,12 90,10 116,56 90,102 34,104 8,58" fill="#000" transform="translate(6 6)" />
        <polygon points="36,12 90,10 116,56 90,102 34,104 8,58" fill="#B04BFF" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
        <polygon points="44,26 82,24 100,56 82,88 42,90 24,58" fill="#2a0e4a" stroke="#000" strokeWidth="4" strokeLinejoin="round" />
        <path d="M40 18 L86 17" stroke="#D88BFF" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <KitIcon name="rebirth" size={52} shadow={2} extras={false} className="rb2-hex-icon" />
    </div>
  );
}

function GetRow({ icon, label, value, tone }) {
  return (
    <div className="rb2-get-row">
      <KitIcon name={icon} size={36} shadow={2} extras={false} />
      <span className="rb2-get-label">{label}</span>
      <span className={`rb2-get-val is-${tone}`}>{value}</span>
    </div>
  );
}

/** Big screens: the 1280×720 stage scales up to fit (measured on mount / resize only — never per frame). */
function useStageScale(ref) {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700);
  useEffect(() => {
    const set = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const k = w >= 700 ? Math.max(1, Math.min(w / 1280, h / 720)) : 1;
      if (ref.current) ref.current.style.setProperty('--rb2-k', k.toFixed(4));
      setNarrow(w < 700);
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, [ref]);
  return narrow;
}

export default function RebirthV2({ onBack }) {
  useMomentHold(true); // no queued moment (rank-up, tutorial…) starts under this screen
  const [s, setS] = useState(readState);
  const [busy, setBusy] = useState(false); // a lb_rebirth / lb_ascend request is in flight
  const [msg, setMsg] = useState(null);
  const [charging, setCharging] = useState(false);
  const busyRef = useRef(false);
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const flashRef = useRef(null);
  const afterRef = useRef(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const narrow = useStageScale(rootRef);

  useEffect(() => {
    // REBIRTH READY opens this screen with a one-shot intent; in season 2 the HOLD is the confirm, so the intent is
    // only consumed here (never auto-sent).
    takeRebirthNow();
    rootRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onBackRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const boom = () => {
    fx(stageRef.current, FX.shake);
    fx(flashRef.current, FX.flash);
    fx(afterRef.current, FX.slamBig);
  };

  // ONE rebirth, sent only when the 1 s hold completes. Single-flight here AND in the flow.
  const doRebirth = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMsg(null);
    let res;
    try {
      res = await performRebirth();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    const next = readState();
    setS(next);
    if (!res || !res.ok) {
      setMsg(rebirthRefusalText(res));
      return;
    }
    sndRebirth();
    evRebirth(next.rebirths);
    refreshSessionProps({ rebirths: next.rebirths });
    boom();
  };

  const doAscend = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMsg(null);
    let res;
    try {
      res = await performAscend();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    setS(readState());
    if (!res || !res.ok) {
      setMsg(rebirthRefusalText(res));
      return;
    }
    sndRebirth();
    setMsg(`ASCENDED — ★${formatNum(res.stars)} (+${formatNum(res.added || 0)} ★)`);
    boom();
  };

  const { level, rebirths, stars, gate, ready } = s;
  const econ = V3.econ;
  const canAscend = !!(econ && econ.canAscend(rebirths));
  const unlocks = V3.unlocks ? V3.unlocks.UNLOCKS : [];
  const lastAt = unlocks.length ? unlocks[unlocks.length - 1].at : 10;
  // the track fills to the last unlock reached, then part-way to the next (evenly spaced diamonds)
  const reached = unlocks.filter((u) => rebirths >= u.at).length;
  const nextU = unlocks[reached];
  const prevAt = reached > 0 ? unlocks[reached - 1].at : 0;
  const partial = nextU ? Math.max(0, Math.min(1, (rebirths - prevAt) / (nextU.at - prevAt))) : 0;
  const slots = Math.max(1, unlocks.length - 1);
  const trackF = reached === 0 ? 0 : Math.min(1, (reached - 1 + partial) / slots);
  const gateF = gate > 0 ? Math.max(0, Math.min(1, level / gate)) : 1;

  const holdLabel = busy ? 'REBIRTHING…' : ready ? 'HOLD TO REBIRTH' : 'NEED LEVELS';
  const holdSub = ready ? `LV ${formatNum(level)} → 1` : `LV ${formatNum(level)} / ${formatNum(gate)}`;

  return (
    <div className="rb2" role="dialog" aria-modal="true" aria-label="Rebirth" tabIndex={-1} ref={rootRef}>
      <div className={`rb2-stripes${charging ? ' is-charging' : ''}`} aria-hidden="true" />
      <div className="rb2-scale">
      <div className="rb2-stage" ref={stageRef}>
        <header className="rb2-head">
          <KitBackButton label="MENU" ariaLabel="Back to menu" onClick={onBack} className="rb2-back" />
          <h2 className="rb2-title">REBIRTH</h2>
          <div className="rb2-levels">
            <KitPill kind="levels" value={level} ariaLabel={`Level ${formatNum(level)}`} />
          </div>
        </header>

        <section className="rb2-left">
          <div className="rb2-now-after">
            <HexPlate />
            <div className="rb2-r">
              <span className="rb2-cap">NOW</span>
              <span className="rb2-r-now" data-testid="rb2-now">R{formatNum(rebirths)}</span>
            </div>
            <svg className="rb2-arrow" width="70" height="44" viewBox="0 0 70 44" aria-hidden="true" focusable="false">
              <path d="M4 16 L44 16 L44 4 L66 22 L44 40 L44 28 L4 28 Z" fill="#B04BFF" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
            </svg>
            <div className="rb2-r rb2-r--after" ref={afterRef}>
              <span className="rb2-cap">AFTER</span>
              <span className="rb2-r-after">R{formatNum(rebirths + 1)}</span>
            </div>
          </div>

          <div
            className="rb2-actions"
            onPointerDownCapture={() => setCharging(ready && !busy)}
            onPointerUpCapture={() => setCharging(false)}
            onPointerLeave={() => setCharging(false)}
            onPointerCancelCapture={() => setCharging(false)}
          >
            <KitHoldButton
              tone="purple"
              className="rb2-hold"
              label={holdLabel}
              holdingLabel="HOLD…"
              sub={holdSub}
              width={narrow ? 320 : canAscend ? 250 : 420}
              labelSize={canAscend || narrow ? 24 : 30}
              disabled={busy || !ready}
              aria-busy={busy}
              ariaLabel={ready ? `Hold to rebirth to R${rebirths + 1}` : `Rebirth needs level ${gate}`}
              confirmText={`R${formatNum(rebirths + 1)}`}
              onConfirm={() => {
                setCharging(false);
                doRebirth();
              }}
            />
            {canAscend && (
              <KitHoldButton
                tone="gold"
                className="rb2-ascend"
                label={busy ? 'ASCENDING…' : 'HOLD TO ASCEND'}
                holdingLabel="HOLD…"
                sub={`+${formatNum(econ.starsForAscend(rebirths))} ★ · R → 0`}
                width={narrow ? 320 : 250}
                labelSize={24}
                disabled={busy}
                aria-busy={busy}
                ariaLabel={`Hold to ascend for ${econ.starsForAscend(rebirths)} stars`}
                confirmText={`+${formatNum(econ.starsForAscend(rebirths))} ★`}
                onConfirm={() => {
                  setCharging(false);
                  doAscend();
                }}
              />
            )}
          </div>
          <div className="rb2-gate" aria-hidden={ready ? 'true' : undefined}>
            <div className="rb2-gate-bar">
              <div className="rb2-gate-fill" style={{ transform: `scaleX(${gateF.toFixed(3)})` }} />
            </div>
            <span className="rb2-gate-txt">{ready ? `GATE LV ${formatNum(gate)} — READY` : `${formatNum(gate - level)} LEVELS TO GO`}</span>
          </div>
          <div className="rb2-msg" role="status" aria-live="polite">
            {msg}
          </div>
        </section>

        <section className="rb2-get" aria-label="You get">
          <div className="rb2-get-head">YOU GET</div>
          <GetRow icon="boost" label="WINS + XP" tone="lilac" value={`×${formatMult(rebirthMult(rebirths))} → ×${formatMult(rebirthMult(rebirths + 1))}`} />
          <GetRow icon="gems" label="GEMS" tone="cyan" value={`+${formatNum(econ ? econ.rebirthGems(rebirths + 1) : 0)}`} />
          <GetRow icon="power" label="POWER" tone="gold" value="KEPT" />
          <GetRow icon="levels" label="LEVELS" tone="hot" value="→ 1" />
          {stars > 0 && <div className="rb2-stars">★{formatNum(stars)} · ×{formatNum(1 + stars)} ON EVERYTHING</div>}
        </section>

        <section className="rb2-track" aria-label="Unlocks">
          <div className="rb2-track-head">UNLOCKS</div>
          <div className="rb2-track-rail" aria-hidden="true">
            <div className="rb2-track-fill" style={{ transform: `scaleX(${trackF.toFixed(3)})` }} />
          </div>
          <ol className="rb2-track-list">
            {unlocks.map((u) => {
              const got = V3.unlocks.unlocked(u.id, { rebirths, stars });
              return (
                <li key={u.id} className={`rb2-ms${got ? ' is-got' : ''}`} data-unlock={u.id} data-at={u.at}>
                  <span className="rb2-ms-dia" aria-hidden="true">
                    <span className="rb2-ms-r">R{u.at}</span>
                  </span>
                  <span className="rb2-ms-what">
                    {u.id === 'ascend' ? 'ASCEND ★' : u.label}
                    <span className="rb2-sr">{got ? ' (unlocked)' : ` (at rebirth ${u.at})`}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <span className="rb2-sr">{`Unlocks run to R${lastAt}`}</span>
        </section>
      </div>
      </div>
      <div className="rb2-flash" ref={flashRef} aria-hidden="true" />
    </div>
  );
}
