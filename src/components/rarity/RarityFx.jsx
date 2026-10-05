// RarityFx — the EFFECTS half of the rarity identity (Andy oct5). Drop it as the LAST child of any element that
// carries `rarityClass(tier, …)` (src/lib/rarityStyle.js); the host gets the fill / glow / finish rim from CSS,
// this adds what the tier earns on top:
//   EPIC+      a shimmer sweep          SECRET / RAINBOW dupe   a palette sweep
//   GOLD dupe  a gold glint             LEGENDARY+              three sparks (pop in once, then rest)
// Every sweep plays ONCE when the node mounts (after `delay` ms) and once more on hover / focus — finite,
// transform/opacity only, nothing loops. Remount it (a `key`) to replay on a new result. Every shape is an asset
// in /public/art/rarity. Reduced motion: no sweeps, sparks rest in place.
import { rarityFx, rarityKey } from '../../lib/rarityStyle.js';
import './RarityFin.css';

const ART = '/art/rarity/';
const SPARK = { legendary: 'spark-gold.svg', mythic: 'spark-mythic.svg', secret: 'spark-secret.svg' };
const SPARKS = [0, 1, 2];

export default function RarityFx({ tier, finish = 'base', particles = true, delay = null }) {
  const k = rarityKey(tier);
  const fx = rarityFx(k, finish);
  const style = Number.isFinite(delay) ? { '--rar-delay': `${Math.max(0, Math.round(delay))}ms` } : undefined;
  const sweep = fx.shimmer || fx.rainbow || fx.gold;
  return (
    <>
      {sweep ? (
        <span className="rarity-fx" aria-hidden="true" style={style}>
          {fx.gold ? <img className="rarity-glint" src={`${ART}glint-gold.svg`} alt="" draggable="false" /> : null}
          {fx.shimmer ? <img className="rarity-shine" src={`${ART}shimmer.svg`} alt="" draggable="false" /> : null}
          {fx.rainbow ? <img className="rarity-rainbow" src={`${ART}rainbow.svg`} alt="" draggable="false" /> : null}
        </span>
      ) : null}
      {fx.particles && particles ? (
        <span className="rarity-sparks" aria-hidden="true" style={style}>
          {SPARKS.map((i) => (
            <img key={i} className={`rarity-spark s${i}`} src={`${ART}${SPARK[k]}`} alt="" draggable="false" />
          ))}
        </span>
      ) : null}
    </>
  );
}
