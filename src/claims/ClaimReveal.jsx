// ClaimReveal.jsx — the MECHANIC-REVEAL moment (Andy oct2: "marks unlock at a level/rebirth gate
// with a mechanic-reveal moment, like the tutorial reveals; add MORE reveal moments"). Claiming a
// NEW SYSTEM (MARKS, LETTER FORGE, STAR PERKS, AUTOMATION) or a NEW MARK opens the shared reveal
// sticker naming the thing and saying, in one line, what it does for you. Tap to dismiss.
import { useEffect, useRef } from 'react';
import Sticker from '../components/Sticker';
import { SEASON2, V3 } from '../progress/season'; // P7: V3.toast = the kit's right-edge toast (v3 chunk)
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

// P7 POPUP PURGE (SEASON2 only): no centre sticker — a NEW SYSTEM / NEW MARK is said as a right-edge toast and the
// reveal ends at once. (Season 2 has no claim inbox, so this is a belt-and-braces path.) Flag OFF: the sticker below.
export default function ClaimReveal(props) {
  return SEASON2 ? <S2Reveal {...props} /> : <ClaimRevealLive {...props} />;
}

function S2Reveal({ claim, onDone }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (claim) {
      const m = claim.kind === 'mark' ? markById(claim.detail) : null;
      V3.toast(m ? { head: 'NEW MARK', label: m.name, icon: 'index', tile: '#B04BFF' } : { head: 'NEW SYSTEM', label: String(claim.label || '').replace(/^NEW SYSTEM — /, ''), icon: 'levels', tile: '#2EFFE0' });
    }
    if (onDone) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per reveal
  }, []);
  return null;
}

function ClaimRevealLive({ claim, onDone }) {
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
        /* C2: the MAIN bonus is in the one stack (wins AND XP), and the perk line already starts with its
           own sign — this read "+100% WINS ON EVERY WORD, + +20% wins & XP in every mode." */
        blurb={`+${pct}% · ${markBlurbAt(m, 1).toUpperCase()}`}
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
