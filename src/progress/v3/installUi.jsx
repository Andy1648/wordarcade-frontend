// v3/installUi.jsx — the browser's season-2 install (main.jsx, before the first render, SEASON2 only): the v3 rules
// (install.js — node-safe, the sims and tests import it alone) plus the menu's ACHIEVEMENTS trophy, which the menu
// renders as V3.Trophy. One lazy chunk; the live game never downloads it.
import { V3 } from '../season.js';
import './install.js';
import S2Trophy from '../../components/S2Trophy.jsx';

V3.Trophy = S2Trophy;

// PHASE 4 — THE SEASON 2 RESET (023_season2_reset.sql): the boot check (wipe a pre-season-2 save once the server reset
// ran, then the SEASON 2 welcome once). Its own lazy chunk; started here WITHOUT blocking the first render — V3.boot is
// the promise client.js submitStats waits on.
V3.boot = import('./season2Boot.js').then((m) => m.bootSeason2()).catch(() => true);
