// ProfileCard.jsx — LEADERBOARD PROFILES (Andy oct10: "click anyone on leaderboard to see their stats (only fun ones
// like gear(s), base, etc.)"). Tap a row or a podium spot → this card: the name + rank plate, the worn gear(s) as their
// cog + glyph on a tier plate, then four stat tiles — BASE WINS / WORD, WINS / WORD, POWER, GEARS FOUND (with a bar).
// Data: the board row (rank / rebirths / level) + public.profile_showcase (031, showcase.fetchShowcase). Before
// 031 runs, or for a player whose game has not sent one yet, every tile shows a dash — never a made-up number.
// LAZY with the board (LeaderboardV2's chunk). Motion: the card pops in once (kit one-shot), 
// nothing else moves; nothing loops.
import { useEffect, useRef, useState } from 'react';
import './kit/tokens.css';
import './ProfileCard.css';
import KitIcon from './kit/KitIcon.jsx';
import './kit/kitIconData.js'; // registers power / boost / index / levels / rebirth (the menu core set has only a few)
import MarkBadge from './MarkBadge.jsx';
import { KitRankPlate } from './kit/KitRankPlate.jsx';
import { kitPlay } from './kit/motion.js';
import { CARD_RAR, cardTier } from './markCard/palette.js';
import { rollMarkById } from '../progress/markRollsCore.js';
import { rankPlate } from '../leaderboard/s2Board.js';
import { fetchShowcase } from '../leaderboard/showcase.js';
import { formatNum } from '../format';

const POP = [{ transform: 'scale(.86) rotate(-2deg)', opacity: 0 }, { transform: 'scale(1.03) rotate(1deg)', opacity: 1, offset: 0.6 }, { transform: 'scale(1) rotate(0)', opacity: 1 }];
const has = (v) => v != null && Number.isFinite(Number(v));
const dash = '—';

function Gear({ id, slot }) {
  const m = id ? rollMarkById(id) : null;
  if (!m) {
    return (
      <div className="pc-gear is-empty" data-slot={slot}>
        <span className="pc-gear-hole" aria-hidden="true" />
        <span className="pc-gear-name">{slot === 2 ? '2ND GEAR' : 'NO GEAR'}</span>
        <span className="pc-gear-tier">{dash}</span>
      </div>
    );
  }
  const tier = cardTier(m.tier);
  const pal = CARD_RAR[tier] || CARD_RAR.rare;
  return (
    <div className="pc-gear" data-slot={slot} data-tier={tier} style={{ '--pc-line': pal.line, '--pc-edge': pal.edge, '--pc-fill': pal.fill }}>
      <MarkBadge mark={{ id: m.id, tier: m.tier }} size={72} className="pc-gear-art" />
      <span className="pc-gear-name">{m.name}</span>
      <span className="pc-gear-tier">{tier.toUpperCase()}</span>
    </div>
  );
}

function Tile({ icon, value, label, tone, children }) {
  return (
    <div className="pc-tile" style={{ '--pc-tone': tone }}>
      <KitIcon name={icon} size={34} shadow={2} extras={false} className="pc-tile-ico" />
      <span className="pc-tile-v">{value}</span>
      <span className="pc-tile-k">{label}</span>
      {children}
    </div>
  );
}

/** @param row a board row ({ id, username, rank, rebirths, level, stars }) · @param onClose */
export default function ProfileCard({ row, mine = false, onClose }) {
  const [show, setShow] = useState(undefined); // undefined = loading, null = none
  const cardRef = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => {
    let live = true;
    fetchShowcase(row.id).then((s) => { if (live) setShow(s || null); });
    return () => { live = false; };
  }, [row.id]);
  useEffect(() => {
    if (cardRef.current) kitPlay(cardRef.current, POP, { duration: 320, easing: 'cubic-bezier(.2,1.2,.4,1)' });
    if (closeRef.current) closeRef.current.focus();
  }, []);
  const s = show || {};
  const plate = rankPlate(row);
  const found = has(s.gears_found) && has(s.gears_total) && Number(s.gears_total) > 0 ? Number(s.gears_found) / Number(s.gears_total) : null;
  const loading = show === undefined;
  return (
    <div className="pc-scrim" role="presentation" onClick={onClose}>
      <div
        ref={cardRef}
        className={`pc${mine ? ' is-me' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${row.username}'s profile`}
        data-testid="profile-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="pc-x" onClick={onClose} aria-label="Close profile">✕</button>
        <div className="pc-head">
          <span className="pc-rank">#{formatNum(Number(row.rank) || 0)}</span>
          <span className="pc-name">{row.username}</span>
          <KitRankPlate rank={plate.i} fit shine={false} className="pc-plate" />
        </div>
        <div className="pc-sub">
          <span className="pc-sub-c"><KitIcon name="rebirth" size={26} shadow={1} extras={false} /> R{formatNum(Number(row.rebirths) || 0)}</span>
          <span className="pc-sub-c"><KitIcon name="levels" size={26} shadow={1} extras={false} /> LV {formatNum(Number(row.level) || 1)}</span>
        </div>
        <div className="pc-gears" data-testid="profile-gears">
          <Gear id={s.gear1} slot={1} />
          <Gear id={s.gear2} slot={2} />
        </div>
        <div className="pc-tiles" data-loading={loading ? '' : undefined}>
          <Tile icon="wins" tone="#FFE94A" value={has(s.base_wins) ? formatNum(Number(s.base_wins)) : dash} label="BASE / WORD" />
          <Tile icon="boost" tone="#FF6B3D" value={has(s.wins_per_word) ? formatNum(Number(s.wins_per_word)) : dash} label="WINS / WORD" />
          <Tile icon="power" tone="#2EFFE0" value={has(s.power) ? `T${formatNum(Number(s.power))}` : dash} label="POWER" />
          <Tile icon="index" tone="#FF4FA3" value={found != null ? `${formatNum(Number(s.gears_found))}/${formatNum(Number(s.gears_total))}` : dash} label="GEARS FOUND">
            <span className="pc-bar" aria-hidden="true"><span className="pc-bar-fill" style={{ transform: `scaleX(${found != null ? Math.min(1, found) : 0})` }} /></span>
          </Tile>
        </div>
      </div>
    </div>
  );
}
