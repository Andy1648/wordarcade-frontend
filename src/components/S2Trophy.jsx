// S2Trophy.jsx — the ACHIEVEMENTS entry on the menu (PROGRESSION v3, SEASON2 only). LAZY: the live game never loads it
// (payload ratchet). It JOINS the nav cluster it is rendered in — the desktop corner-nav stack (`variant="desk"`) or the
// phone's nav strip (`variant="phone"`) — never a fixed control of its own. It owns the overlay's open state.
// DOT (Andy oct9: "make achievements have the notification symbol too"): the same plain notification dot as the other
// nav buttons while at least one tier is ready to claim — no number, no popup (phase 3's "no menu claim popups" still
// holds); it clears once nothing is claimable. Re-read on mount, on every counter / claim write (v3/store.js
// ACH_CHANGE — never per frame) and when the screen closes.
// P7: it also carries the menu's EDGE notification layer (S2Notify — rank-up banner, unlock toasts, board news), so
// the purge needs no new eager code on the menu.
// v2 MENU: it is the ACHIEVEMENTS tile of the top-right cluster (KitIconButton), in the tile's place — both trees.
import { lazy, Suspense, useEffect, useState } from 'react';
import { KitIconButton } from './kit/KitNavButton.jsx';
import { V3 } from '../progress/season';
import { useMomentHold } from '../lib/useMomentSlot';
import { readyCountV3 } from '../progress/v3/achievements.js';
import { ACH_CHANGE } from '../progress/v3/store.js';

const readyNow = () => {
  try {
    return readyCountV3() > 0;
  } catch {
    return false;
  }
};

// the ACHIEVEMENTS screen (P3, v2 kit) — THE ONLY CLAIM PLACE — is its own lazy chunk: downloaded on the first open
const AchievementsV3 = lazy(() => import('./AchievementsV3.jsx'));

export default function S2Trophy({ variant = 'desk', disabled = false }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(readyNow);
  useMomentHold(open); // no queued menu moment starts under the screen
  useEffect(() => {
    const sync = () => setReady(readyNow());
    sync();
    window.addEventListener(ACH_CHANGE, sync);
    return () => window.removeEventListener(ACH_CHANGE, sync);
  }, [open]); // `open` flipping back (the screen closed) re-reads too
  const cls = variant === 'phone' ? 'hp-m-navbtn is-ach' : 'homepage-nav-btn is-ach';
  return (
    <>
      <KitIconButton
        icon="achievements"
        tone="gold"
        className={cls}
        data-nav="achievements"
        disabled={disabled}
        dot={ready || undefined}
        onClick={() => setOpen(true)}
        ariaLabel={ready ? 'Open achievements — a reward is ready to claim' : 'Open achievements'}
        title="Achievements"
      />
      {open && (
        <Suspense fallback={null}>
          <AchievementsV3 onClose={() => setOpen(false)} />
        </Suspense>
      )}
      {V3.Notify && <V3.Notify check />}
    </>
  );
}
