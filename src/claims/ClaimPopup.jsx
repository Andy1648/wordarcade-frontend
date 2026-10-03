// ClaimPopup.jsx — the "you earned something" popup on the menu (Andy oct2: claimed "via a popup
// or by clicking it"). It appears when a claim the player has not seen this session is pending —
// an achievement checked on the way back to the menu, a rank-up, the welcome-back bonus — names
// it, and offers CLAIM right there. LATER (or any keystroke, so it never steals the menu's
// type-to-earn) tucks it away; the REWARDS button keeps the notification badge until it is claimed.
//
// It took the welcome-back card's slot (top-centre, same look family), and replaces that card.
//
// H5: it waits its turn on the ONE moments queue (PRIORITY.REWARD) — never over the wall, a tier-up or a
// rank-up. It lingers (up to CLAIM_TUCK_MS), so it is announced `interruptible`: a higher-priority moment
// that arrives while it shows tucks it away UNSEEN, and it comes back once that moment is over. The
// key/tap "not now" listeners run only while it is actually showing — before its turn, typing on the menu
// is untouched.
import { useEffect, useMemo, useState } from 'react';
import { useMomentSlot } from '../lib/useMomentSlot.js';
import { momentOpts, CLAIM_TUCK_MS } from '../lib/menuMoments.js';
import { claim, claimAll, claimAmount, CLAIM_KINDS } from '../progress/claims.js';
import { useClaims } from './useClaims.js';
import { KIND_COLOUR } from './kindColour.js';
import './ClaimPopup.css';
import { formatNum } from '../format.js';

const SEEN_KEY = 'taw.claimPopSeen';
function loadSeen() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}
function saveSeen(set) {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
  } catch {
    /* blocked */
  }
}

const SLOT = momentOpts('claim-pop');

export default function ClaimPopup({ onOpenPanel, onReveal, inline = false }) {
  const list = useClaims();
  const [seen, setSeen] = useState(loadSeen);
  const fresh = useMemo(() => list.filter((c) => !seen.has(c.id)), [list, seen]);
  const later = () => {
    const next = new Set(seen);
    for (const c of list) next.add(c.id);
    saveSeen(next);
    setSeen(next);
  };
  // nothing fresh any more (claimed, LATER, tucked) → `want` drops and the slot releases the queue
  const [on] = useMomentSlot(fresh.length > 0, SLOT);
  useEffect(() => {
    if (!on || !fresh.length) return undefined;
    // Typing on the menu is type-to-earn: a keystroke means "not now", never a lost keystroke.
    const onKey = (e) => {
      if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') return; // keyboard users reach the buttons
      later();
    };
    // ...and a tap anywhere but its own buttons goes through to what is under it and means "not now"
    // too (the popup is pointer-transparent, see ClaimsPanel.css), so it can never block the menu.
    const onDown = (e) => {
      if (e.target && e.target.closest && e.target.closest('.claim-pop button')) return;
      later();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    window.addEventListener('pointerdown', onDown, { capture: true });
    // It tucks itself away after a while too: the REWARDS badge keeps the reminder, so the popup
    // never has to sit over the menu for good (fine-tune oct2).
    const tuck = setTimeout(later, CLAIM_TUCK_MS);
    return () => {
      clearTimeout(tuck);
      window.removeEventListener('keydown', onKey, { capture: true });
      window.removeEventListener('pointerdown', onDown, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, fresh.length]);
  if (!on || !fresh.length) return null;
  const one = fresh.length === 1 && list.length === 1 ? fresh[0] : null;
  const total = list.reduce((a, c) => a + claimAmount(c), 0);
  const k = one ? KIND_COLOUR[one.kind] : '#FFE94A';
  return (
    <div className={`claim-pop${inline ? ' claim-pop--inline' : ''}`} role="status" aria-live="polite" style={{ '--k': k }}>
      <div className="claim-pop-text">
        <span className="claim-pop-kind">{one ? CLAIM_KINDS[one.kind] || 'REWARD' : 'REWARDS WAITING'}</span>
        <span className="claim-pop-label">
          {one ? one.label.replace(/^[A-Z ]+ — /, '') : `${list.length} TO CLAIM`}
        </span>
      </div>
      <button
        type="button"
        className="claims-btn"
        onClick={() => {
          if (one) {
            const r = claim(one.id);
            if (r && (r.kind === 'layer' || r.kind === 'mark') && onReveal) onReveal(r);
          } else if (onOpenPanel) onOpenPanel();
          else claimAll();
          later();
        }}
      >
        {one ? (one.kind === 'boost' && one.meta ? `START ×${one.meta.mult}` : claimAmount(one) > 0 ? `CLAIM +${formatNum(claimAmount(one))}` : 'CLAIM') : total > 0 ? `OPEN +${formatNum(total)}` : 'OPEN'}
      </button>
      <button type="button" className="claim-pop-later" onClick={later}>
        LATER
      </button>
    </div>
  );
}
