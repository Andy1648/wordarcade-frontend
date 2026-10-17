// UnlistedShelf.jsx — the SHOW-OFF row: a player's UNLISTED gears, each with its serial ("O.G. #0042"). On YOUR profile
// it reads your own store (and teases "?/?" before your first find); on someone else's leaderboard card it shows what
// the SERVER recorded for them (public.unlisted_finds, supabase 052) — never their device's word for it.
// Static: no motion beyond the cards' own one hover flare.
import UnlistedCard from './UnlistedCard.jsx';
import { unlistedById, unlistedArt, cleanSerial, UNLISTED_GEARS } from './unlisted.js';
import './UnlistedShelf.css';

/** Server rows [{ gear_id, serial }] → owned card tiles, in catalog order; unknown ids dropped. */
export function tilesFromFinds(rows) {
  const by = new Map();
  for (const r of rows || []) {
    const g = r && unlistedById(r.gear_id);
    if (g && !by.has(g.id)) by.set(g.id, { id: g.id, owned: true, name: g.name, art: unlistedArt(g), serial: cleanSerial(r.serial), riddle: g.riddle, season: g.season, word: null });
  }
  return UNLISTED_GEARS.filter((g) => by.has(g.id)).map((g) => by.get(g.id));
}

/**
 * @param {object} p
 * @param {object[]} p.tiles  owned tiles (unlistedIndex().tiles filtered, or tilesFromFinds)
 * @param {string} [p.label]  the count shown when there are none ("?/?" on your own profile); omit → render nothing
 */
export default function UnlistedShelf({ tiles = [], label = null }) {
  if (!tiles.length && !label) return null;
  return (
    <section className="ul-shelf" aria-label="Unlisted gear" data-testid="unlisted-shelf">
      <header className="ul-shelf-head">
        <span className="ul-shelf-title">UNLISTED</span>
        <span className="ul-shelf-count">{tiles.length ? `${tiles.length} FOUND` : label}</span>
      </header>
      {tiles.length ? (
        <div className="ul-shelf-row" role="list">
          {tiles.map((t) => <div key={t.id} role="listitem"><UnlistedCard tile={t} size="chip" /></div>)}
        </div>
      ) : (
        <p className="ul-shelf-empty">NOT ROLLED · NOT SOLD · ONLY FOUND</p>
      )}
    </section>
  );
}
