// S2Trophy.jsx — the ACHIEVEMENTS entry on the menu (PROGRESSION v3, SEASON2 only). LAZY: the live game never loads it
// (payload ratchet). It JOINS the nav cluster it is rendered in — the desktop corner-nav stack (`variant="desk"`) or the
// phone's nav strip (`variant="phone"`) — never a fixed control of its own. No badge: Andy phase 3 removed every menu
// claim notification; the ACHIEVEMENTS screen itself says what is ready. It owns the overlay's open state.
// v2 MENU: it is the ACHIEVEMENTS tile of the top-right cluster (KitIconButton), in the tile's place — both trees.
import { lazy, Suspense, useState } from 'react';
import { KitIconButton } from './kit/KitNavButton.jsx';
import { useMomentHold } from '../lib/useMomentSlot';

// the ACHIEVEMENTS screen (P3, v2 kit) — THE ONLY CLAIM PLACE — is its own lazy chunk: downloaded on the first open
const AchievementsV3 = lazy(() => import('./AchievementsV3.jsx'));

export default function S2Trophy({ variant = 'desk', disabled = false }) {
  const [open, setOpen] = useState(false);
  useMomentHold(open); // no queued menu moment starts under the screen
  const cls = variant === 'phone' ? 'hp-m-navbtn is-ach' : 'homepage-nav-btn is-ach';
  return (
    <>
      <KitIconButton
        icon="achievements"
        tone="gold"
        className={cls}
        data-nav="achievements"
        disabled={disabled}
        onClick={() => setOpen(true)}
        ariaLabel="Open achievements"
        title="Achievements"
      />
      {open && (
        <Suspense fallback={null}>
          <AchievementsV3 onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
