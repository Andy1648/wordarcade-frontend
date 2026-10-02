// ClaimReveal.jsx — the MECHANIC-REVEAL moment (Andy oct2: "marks unlock at a level/rebirth gate
// with a mechanic-reveal moment, like the tutorial reveals; add MORE reveal moments"). Claiming a
// NEW SYSTEM (MARKS, LETTER FORGE, STAR PERKS, AUTOMATION) or a NEW MARK opens the shared reveal
// sticker naming the thing and saying, in one line, what it does for you. Tap to dismiss.
import Sticker from '../components/Sticker';
import MarkBadge from '../components/MarkBadge';
import { markById, markTier, markMainMult, markBlurbAt } from '../progress/marks';

// A plain NEW-SYSTEM burst (vector art; the shell owns the punch-in).
function GlyphSystem() {
  return (
    <svg viewBox="0 0 96 96" className="sticker-glyph" aria-hidden="true">
      <g transform="rotate(-8 48 48)">
        <path
          d="M48 6 L56 30 L82 22 L66 44 L90 58 L62 62 L66 90 L48 70 L30 90 L34 62 L6 58 L30 44 L14 22 L40 30 Z"
          fill="#FFE94A"
          stroke="#000"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <text x="48" y="58" textAnchor="middle" fontFamily="Bungee, system-ui, sans-serif" fontSize="20" fill="#0d0618">
          NEW
        </text>
      </g>
    </svg>
  );
}

export default function ClaimReveal({ claim, onDone }) {
  if (!claim) return null;
  if (claim.kind === 'mark') {
    const m = markById(claim.detail);
    if (!m) return null;
    const t = markTier(m);
    const pct = Math.round((markMainMult(m, 1) - 1) * 100);
    return (
      <Sticker
        variant="reveal"
        ribbon={`★ NEW ${t.name} MARK ★`}
        glyph={<MarkBadge mark={m} rank={1} size={110} />}
        name={m.name}
        blurb={`WEAR IT AS YOUR MAIN: +${pct}% WINS ON EVERY WORD, + ${markBlurbAt(m, 1)}`}
        onDismiss={onDone}
      />
    );
  }
  const name = String(claim.label || '').replace(/^NEW SYSTEM — /, '');
  return (
    <Sticker
      variant="reveal"
      ribbon="★ NEW SYSTEM ★"
      glyph={<GlyphSystem />}
      name={name}
      blurb={(claim.meta && claim.meta.blurb) || ''}
      onDismiss={onDone}
    />
  );
}
