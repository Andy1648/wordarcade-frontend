// ProfileCard.jsx — LEADERBOARD PROFILES (Andy oct10: "click anyone on leaderboard to see their stats (only fun ones
// like gear(s), base, etc.)"). Tap a row or a podium spot → this card: the name + rank plate, the worn gear(s) as their
// cog + glyph on a tier plate, then four stat tiles — BASE WINS / WORD, WINS / WORD, POWER, GEARS FOUND (with a bar).
// Data: the board row (rank / rebirths / level) + public.profile_showcase (031, showcase.fetchShowcase). Before
// 031 runs, or for a player whose game has not sent one yet, every unknown shows a "?" (Andy oct11) — never a made-up
// number or a guessed "no gear".
// LAZY with the board (LeaderboardV2's chunk). Motion: the card pops in once (kit one-shot), 
// nothing else moves; nothing loops.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
import { fetchShowcase, saveBio, myBio, fetchUnlistedFinds } from '../leaderboard/showcase.js';
import { unlistedById, unlistedArt } from '../unlisted/unlisted.js';
import { bioVerdict, BIO_MAX } from '../leaderboard/nameFilter.js';
import { formatNum } from '../format';

// a tap on a worn gear opens its GEAR SHEET (Andy oct12 "make the gears clickable") — lazy, so the board's profile chunk stays small
const GearSheet = lazy(() => import('./GearSheet.jsx'));

const POP = [{ transform: 'scale(.86) rotate(-2deg)', opacity: 0 }, { transform: 'scale(1.03) rotate(1deg)', opacity: 1, offset: 0.6 }, { transform: 'scale(1) rotate(0)', opacity: 1 }];
const has = (v) => v != null && Number.isFinite(Number(v));
const UNKNOWN = '?'; // Andy oct11: "for anything thats not known … just put a question mark"

// 046 PROFILE FLEX (Andy oct14 "ways profiles can be shown off (not avatars)"): things the player EARNED, never bought —
// the best CHAIN and a BADGE ROW (the top claimed tier of
// each achievement ladder, the Achievements screen's own glyph + tier colour). Rows from before 046 have none of these
// fields → the sections are simply absent (no row of "?").
const BADGES = [
  ['type', 'key', 'TYPE WORDS'], ['bots', 'bot', 'BEAT BOTS'], ['reb', 'loop', 'REBIRTH'], ['roll', 'die', 'ROLL EPIC+'],
  ['win', 'cup', 'WIN ONLINE'], ['chain', 'chain', 'WORD CHAIN'], ['index', 'cards', 'FIND GEARS'], ['power', 'chev', 'BUY POWER'], // the achievement names (Andy oct17: 1–2 words)
];
const MAX_TIER = { index: 3 };
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const TC = ['#A9B4C8', '#3D8BFF', '#B04BFF', '#FFC23D', '#FF3D7F']; // AchievementsV3's tier colours
const TF = ['#262b38', '#0f2350', '#2a0e4a', '#3d2a05', '#4a0a22'];
const BIO_SAY = {
  blocked: 'NOT ALLOWED — KEEP IT CLEAN', link: 'NO LINKS', long: `${BIO_MAX} LETTERS MAX`, slow_down: 'WAIT A SEC',
  not_ready: 'DESCRIPTIONS ARE COMING SOON', fail: "COULDN'T SAVE — TRY AGAIN",
};

// 051 PROFILE DESCRIPTION (Andy oct15: "a profile description that the user can type in but censorship is needed there"
// / "no need for signature word … that space can be used for the profile description"). Everyone sees it; on your own
// card it is a tap-to-edit box. Filtered twice: bioVerdict here for the instant answer, public.bio_is_clean in the DB.
function Bio({ text, mine }) {
  const [bio, setBio] = useState(text || '');
  const [draft, setDraft] = useState(null); // null = not editing
  const [say, setSay] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBio(text || ''); }, [text]);
  if (!mine) {
    return bio ? (
      <div className="pc-bio" data-testid="profile-bio">
        <span className="pc-bio-k">ABOUT</span>
        <p className="pc-bio-t">{bio}</p>
      </div>
    ) : null;
  }
  async function save() {
    const t = draft.trim();
    const v = t ? bioVerdict(t) : 'ok';
    if (v !== 'ok') { setSay(BIO_SAY[v] || BIO_SAY.fail); return; }
    setBusy(true);
    const r = await saveBio(t);
    setBusy(false);
    if (r.ok) { setBio(t); setDraft(null); setSay(''); } else setSay(BIO_SAY[r.error] || BIO_SAY.fail);
  }
  if (draft == null) {
    return (
      <div className="pc-bio is-mine" data-testid="profile-bio">
        <span className="pc-bio-k">ABOUT YOU</span>
        {bio ? <p className="pc-bio-t">{bio}</p> : <p className="pc-bio-t is-empty">Say something — everyone on the board can see it.</p>}
        <button type="button" className="pc-bio-btn" data-testid="profile-bio-edit" onClick={() => { setDraft(bio); setSay(''); }}>
          {bio ? 'EDIT' : 'WRITE ONE'}
        </button>
      </div>
    );
  }
  return (
    <div className="pc-bio is-mine is-editing" data-testid="profile-bio">
      <span className="pc-bio-k">ABOUT YOU <span className="pc-bio-n">{draft.length}/{BIO_MAX}</span></span>
      <textarea
        className="pc-bio-in"
        data-testid="profile-bio-input"
        value={draft}
        maxLength={BIO_MAX}
        rows={2}
        autoFocus
        aria-label="Profile description"
        onChange={(e) => { setDraft(e.target.value.replace(/\s*\n\s*/g, ' ')); setSay(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') { e.stopPropagation(); setDraft(null); } }}
      />
      {say ? <span className="pc-bio-say" role="alert" data-testid="profile-bio-say">{say}</span> : null}
      <span className="pc-bio-row">
        <button type="button" className="pc-bio-btn is-ghost" onClick={() => { setDraft(null); setSay(''); }}>CANCEL</button>
        <button type="button" className="pc-bio-btn" data-testid="profile-bio-save" disabled={busy} onClick={save}>{busy ? 'SAVING' : 'SAVE'}</button>
      </span>
    </div>
  );
}

function BadgeRow({ badges }) {
  const got = BADGES.filter(([id]) => badges[id] > 0);
  if (!got.length) return null;
  return (
    <ul className="pc-badges" data-testid="profile-badges" aria-label="Achievement badges">
      {got.map(([id, g, name]) => {
        const t = Math.min(badges[id], MAX_TIER[id] || 5) - 1;
        const max = t + 1 >= (MAX_TIER[id] || 5);
        return (
          <li key={id} className="pc-badge" style={{ '--tc': TC[t], '--tf': TF[t] }} title={`${name} ${max ? 'MAX' : ROMAN[t]}`}>
            <span className="pc-badge-plate" aria-hidden="true" />
            <img className="pc-badge-glyph" src={`/ach/${g}.svg`} alt="" aria-hidden="true" />
            <span className="pc-badge-roman">{max ? 'MAX' : ROMAN[t]}</span>
            <span className="pc-sr">{`${name} ${max ? 'MAX' : ROMAN[t]}`}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** This player's server serial for one UNLISTED gear (052 unlisted_finds), or null. */
function serialOf(finds, id) {
  const f = (finds || []).find((x) => x && x.gear_id === id);
  return f ? f.serial : null;
}

function Gear({ id, slot, known, onOpen }) {
  const m = id ? rollMarkById(id) : null;
  const u = !m && id ? unlistedById(id) : null;
  if (u) {
    // THE UNLISTED worn in either slot: the negative-print plate — a tap opens its card like any gear (Andy oct19 "they
    // dont have clickable card on leaderboard")
    return (
      <button
        type="button"
        className="pc-gear is-tap is-unlisted"
        data-slot={slot}
        data-tier="unlisted"
        data-testid={`profile-gear-${slot}`}
        aria-label={`${u.name} — see the gear`}
        style={{ '--pc-line': CARD_RAR.unlisted.line, '--pc-edge': CARD_RAR.unlisted.edge, '--pc-fill': CARD_RAR.unlisted.fill }}
        onClick={() => onOpen({ id: u.id, name: u.name, tier: 'unlisted', kind: 'unlisted' })}
      >
        <img className="pc-gear-art pc-gear-img" src={unlistedArt(u)} alt="" width="72" height="72" />
        <span className="pc-gear-name">{u.name}</span>
        <span className="pc-gear-tier">UNLISTED</span>
      </button>
    );
  }
  if (!m) {
    // unknown (no showcase sent yet) → "?"; known and nothing worn there → an empty slot
    return (
      <div className={`pc-gear is-empty${known ? '' : ' is-unknown'}`} data-slot={slot}>
        <span className="pc-gear-hole" aria-hidden="true">{known ? null : UNKNOWN}</span>
        <span className="pc-gear-name">{known ? 'EMPTY' : UNKNOWN}</span>
        <span className="pc-gear-tier">{slot === 2 ? '2ND GEAR' : 'GEAR'}</span>
      </div>
    );
  }
  const tier = cardTier(m.tier);
  const pal = CARD_RAR[tier] || CARD_RAR.rare;
  return (
    <button
      type="button"
      className="pc-gear is-tap"
      data-slot={slot}
      data-tier={tier}
      data-testid={`profile-gear-${slot}`}
      aria-label={`${m.name} — see the gear`}
      style={{ '--pc-line': pal.line, '--pc-edge': pal.edge, '--pc-fill': pal.fill }}
      onClick={() => onOpen({ id: m.id, name: m.name, tier: m.tier, kind: 'roll' })}
    >
      <MarkBadge mark={{ id: m.id, tier: m.tier }} size={72} className="pc-gear-art" />
      <span className="pc-gear-name">{m.name}</span>
      <span className="pc-gear-tier">{tier.toUpperCase()}</span>
    </button>
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

/** 050 TITLES: your card lists every title — the earned ones are tappable (wear it), the rest show what earns them. */

/** @param row a board row ({ id, username, rank, rebirths, level, stars }) · @param onClose */
export default function ProfileCard({ row, mine = false, onClose }) {
  const [show, setShow] = useState(undefined); // undefined = loading, null = none
  const [gear, setGear] = useState(null); // the gear whose sheet is open
  const [finds, setFinds] = useState([]); // 052 THE UNLISTED: this player's server serials (the worn one's FINDER # on its card)
  const cardRef = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => {
    let live = true;
    fetchShowcase(row.id).then((s) => { if (live) setShow(s || null); });
    fetchUnlistedFinds(row.id).then((f) => { if (live) setFinds(f); });
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
        {loading && !mine ? null : <Bio text={typeof s.bio === 'string' ? s.bio : mine ? myBio() : ''} mine={mine} />}
        <div className="pc-gears" data-testid="profile-gears">
          <Gear id={s.gear1} slot={1} known={!!show} onOpen={setGear} />
          <Gear id={s.gear2} slot={2} known={!!show} onOpen={setGear} />
        </div>
        <div className="pc-tiles" data-loading={loading ? '' : undefined}>
          <Tile icon="wins" tone="#FFE94A" value={has(s.base_wins) ? formatNum(Number(s.base_wins)) : UNKNOWN} label="BASE / WORD" />
          <Tile icon="boost" tone="#FF6B3D" value={has(s.wins_per_word) ? formatNum(Number(s.wins_per_word)) : UNKNOWN} label="WINS / WORD" />
          <Tile icon="power" tone="#2EFFE0" value={has(s.power) ? `T${formatNum(Number(s.power))}` : UNKNOWN} label="POWER" />
          <Tile icon="index" tone="#FF4FA3" value={found != null ? `${formatNum(Number(s.gears_found))}/${formatNum(Number(s.gears_total))}` : UNKNOWN} label="GEARS FOUND" />
          {/* Andy oct22: one read-out a stat — the count, no bar beside it */}
        </div>
        {s.badges && typeof s.badges === 'object' ? <BadgeRow badges={s.badges} /> : null}
        {/* no UNLISTED shelf / found-count here (Andy oct19 "no need to show how many unlisted you've found") */}
      </div>
      {gear ? (
        // a layer of this scrim (GearSheet's .mx-sheet-layer is absolute) — a tap inside never closes the profile
        <div role="presentation" onClick={(e) => e.stopPropagation()}>
          <Suspense fallback={null}>
            <GearSheet
              key={gear.id}
              e={gear}
              have
              view={null}
              peek
              serial={gear.kind === 'unlisted' ? serialOf(finds, gear.id) : null}
              onClose={() => setGear(null)}
            />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}

// the PROFILE popup (oct17) reuses your own description editor — the same one the board card shows (titles removed oct17: Andy "no need for titles … we already have enough cosmetics")
export { Bio };
