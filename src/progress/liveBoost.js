// liveBoost.js — ms until the LAST live boost ends: the UPGRADES ×10 OVERDRIVE item (a code BOOST, boost.js →
// taw.boost) or the Rebirth Rush OVERDRIVE (overdrive.js → taw.overdrive), whichever runs longer. The one clock a
// surface that shows the BOOST factor must watch — watching only one of them is the oct8 "×10 lasts until new
// screen" bug (LiveStack watched overdriveRemaining alone).
import { boostRemaining } from './boost.js';
import { overdriveRemaining } from './overdrive.js';

export const liveBoostRemaining = (now = Date.now()) => Math.max(boostRemaining(now), overdriveRemaining(now));
