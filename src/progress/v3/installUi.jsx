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
V3.Notify = (props) => (
  <Suspense fallback={null}>
    <NotifyUi {...props} />
  </Suspense>
);
V3.toast = say('pushToast'); // right-edge UNLOCK toast (KitEdgeToast)
V3.rankUp = say('pushRankUp'); // top-edge RANK-UP banner (KitRankBanner) — v3 ranks, and the board's #N news
V3.fx = (api) => wrapFx(api, V3.toast);

// THE SEASON 2 CONVERSION (Andy oct6: no reset — 025_season2_convert.sql): install.js already converted this
// browser's save (convertLocal); this lazy chunk adopts the server's converted rebirths / ★ for a board player and shows
// the UPDATE card once. Started WITHOUT blocking the first render — V3.boot is the promise client.js submitStats waits on.
V3.boot = import('./season2Update.js').then((m) => m.bootSeason2Update()).catch(() => true);
