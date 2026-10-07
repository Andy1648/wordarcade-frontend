// v3/installUi.jsx — the browser's season-2 install (main.jsx, before the first render, SEASON2 only): the v3 rules
// (install.js — node-safe, the sims and tests import it alone) plus the menu's ACHIEVEMENTS trophy, which the menu
// renders as V3.Trophy. One lazy chunk; the live game never downloads it.
//
// P7 POPUP PURGE: the season's EDGE notification layer (S2Notify.jsx — the rank-up banner + unlock toast hosts and
// their queues) is ANOTHER lazy step behind this chunk, fetched on the menu's first paint: V3.Notify renders it,
// V3.toast / V3.rankUp push to it, V3.fx (MenuXpFx's centre cards → edges, v3/notify.js wrapFx) speaks through it.
// Kept out of this chunk on purpose — its kit pieces are shared with other lazy screens, and pulling them in here
// would add a shared-chunk entry to the INDEX's preload map (the payload ratchet counts every byte of that).
import { lazy, Suspense } from 'react';
import { V3 } from '../season.js';
import './install.js';
import S2Trophy from '../../components/S2Trophy.jsx';
import { wrapFx } from './notify.js';

const loadUi = () => import('../../components/S2Notify.jsx');
const NotifyUi = lazy(loadUi);
const say = (k) => (payload) => {
  loadUi().then((m) => m[k](payload), () => {});
};

V3.Trophy = S2Trophy;
// THE ONE-NOTICE RULE (SEASON 2 checklist, Andy oct6): the game has exactly ONE notice — the EDITOR'S NOTE welcome
// (season2Boot.js). Every other progression / economy notice is gone: no rank-up banner, no unlock / bought /
// dev-reset toast, no centre card (wrapFx). The edge layer (S2Notify) stays in the tree, silent, for later.
const SILENT = true;
const none = () => {};
V3.Notify = (props) =>
  SILENT ? null : (
    <Suspense fallback={null}>
      <NotifyUi {...props} />
    </Suspense>
  );
V3.toast = SILENT ? none : say('pushToast'); // right-edge toast (KitEdgeToast)
V3.rankUp = SILENT ? none : say('pushRankUp'); // top-edge RANK-UP banner (KitRankBanner)
V3.fx = (api) => wrapFx(api, V3.toast);

// PHASE 4 — THE SEASON 2 RESET (023_season2_reset.sql): the boot check (wipe a pre-season-2 save once the server reset
// ran, then the SEASON 2 welcome once). Its own lazy chunk; started here WITHOUT blocking the first render — V3.boot is
// the promise client.js submitStats waits on.
V3.boot = import('./season2Boot.js').then((m) => m.bootSeason2()).catch(() => true);
