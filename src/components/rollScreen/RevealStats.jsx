// RevealStats.jsx — the ROLL REVEAL v2 STATS EXTENSION (Andy: "when a card gets rolled, there can be a 2nd animation
// showing the stats"). Plays once the card has landed (Reel.jsx drives it from revealPlan.extensionPlan): the MAIN stat
// slams in big, each extra stat then the perk tick in ~120 ms apart, then — on a dupe — the ★ pips fill.
//
// HIERARCHY = the GEAR SHEET v2 (#334): the MAIN stat is the biggest text (Bungee, yellow), the extra stats a quiet
// list (white number, lilac label), the PERK in its own cyan plate. Nothing else: the name / rarity are on the card,
// the odds on the stamp above it. Every node is mounted once with the reveal and starts invisible (the WAAPI one-shots
// in Reel.jsx bring them in; transform/opacity only). Reduced motion never mounts a reveal at all.
// EPIC+ (`glow`): the stats sit on a panel plate wearing the rare-gear glow (GearFx) — the plate fades in with the
// MAIN stat (Reel.jsx, opacity only), so the glow never shows before there is something on it.
import { memo } from 'react';
import { MAX_PIPS } from '../../progress/markRollsCore';
import { formatNum } from '../../format';
import GearFx from '../GearFx';


const STAR5 = 'M6.5 0.6 L8.2 4.6 L12.5 4.9 L9.2 7.7 L10.2 12 L6.5 9.7 L2.8 12 L3.8 7.7 L0.5 4.9 L4.8 4.6 Z';
const SLOTS = Array.from({ length: MAX_PIPS }, (_, i) => i);

function RevealStats({ stats, reg, glow = null }) {
  if (!stats) return null;
  return (
    <div className={`rv-stats${glow ? ' is-glow' : ''}`} data-testid="roll-reveal-stats" data-glow={glow || undefined}>
      {glow ? (
        <span className="rv-stats-bg" ref={reg('xPlate')} aria-hidden="true">
          <GearFx tier={glow} scale={0.75} />
          <span className="rv-stats-plate" />
        </span>
      ) : null}
      <div className="rv-main" ref={reg('xMain')}>
        <span className={`rv-main-num${stats.num.length >= 5 ? ' is-l' : ''}`}>{stats.num}</span>
        {stats.kind ? <span className="rv-main-kind">{stats.kind}</span> : null}
      </div>
      {stats.crit.length ? (
        <div className="rv-extras">
          {stats.crit.map((l, i) => (
            <span key={l.id} className="rv-extra" ref={reg(`xEx${i}`)}>
              <span className="rv-extra-num">{l.num}</span> <span className="rv-extra-kind">{l.kind}</span>
            </span>
          ))}
        </div>
      ) : null}
      {stats.perks.length ? (
        <div className="rv-perk" ref={reg('xPerk')}>
          <span className="rv-perk-kick">PERK{stats.perks.length > 1 ? 'S' : ''} · WHILE MAIN</span>
          {stats.perks.map((p) => <span key={p} className="rv-perk-line">{p}</span>)}
        </div>
      ) : null}
      {stats.dupe ? (
        <div className="rv-dupe" ref={reg('xDupe')}>
          <span className="rv-dupe-k">DUPE ×{formatNum(stats.copies)}</span>
          <span className="rv-stars" role="img" aria-label={`★${stats.pips}`}>
            {SLOTS.map((i) => (
              <span key={i} className="rv-star">
                <svg viewBox="0 0 13 13" width="22" height="22" aria-hidden="true" focusable="false">
                  <path d={STAR5} fill="#0d0618" stroke="#5d4a78" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
                {i < stats.pips ? (
                  <svg ref={reg(`xStar${i}`)} className="rv-star-fill" viewBox="0 0 13 13" width="22" height="22" aria-hidden="true" focusable="false">
                    <path d={STAR5} fill="#FFE94A" stroke="#000" strokeWidth="1.3" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
            ))}
          </span>
          {stats.next ? <span className="rv-dupe-next">{stats.next}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export default memo(RevealStats);
