// S2Trophy.jsx — the ACHIEVEMENTS entry on the menu (PROGRESSION v3, SEASON2 only). LAZY: the live game never loads it
// (payload ratchet). It JOINS the nav cluster it is rendered in — the desktop corner-nav stack (`variant="desk"`) or the
// phone's nav strip (`variant="phone"`) — never a fixed control of its own. No badge: Andy phase 3 removed every menu
// claim notification; the ACHIEVEMENTS screen itself says what is ready. It owns the overlay's open state.
import { useState } from 'react';
import './S2Trophy.css';
import AchievementsV3 from './AchievementsV3.jsx';
import { useMomentHold } from '../lib/useMomentSlot';

export default function S2Trophy({ variant = 'desk', disabled = false }) {
  const [open, setOpen] = useState(false);
  useMomentHold(open); // no queued menu moment starts under the screen
  const cls = variant === 'phone' ? `hp-m-navbtn is-ach${disabled ? ' is-disabled' : ''}` : `homepage-nav-btn is-ach${disabled ? ' disabled' : ''}`;
  return (
    <>
      <button type="button" className={cls} onClick={() => setOpen(true)} disabled={disabled} aria-label="Open achievements" title="Achievements">
        <img src="/ach/cup.svg" width={variant === 'phone' ? 28 : 30} height={variant === 'phone' ? 28 : 30} alt="" aria-hidden="true" />
      </button>
      {open && <AchievementsV3 onClose={() => setOpen(false)} />}
    </>
  );
}
