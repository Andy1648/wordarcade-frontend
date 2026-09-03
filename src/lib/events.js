// events.js — the CANONICAL product-analytics event catalog (feat/analytics). One named helper per
// funnel event so call sites stay one-liners and the event names + payload shapes live in ONE place
// (kept in sync with claude/analytics-plan.md). Every helper is fire-and-forget and guarded by the
// analytics layer; a missing key makes them all silent no-ops.
//
// PRIVACY: payloads carry ENUMS and COUNTS only — never a word the player typed, never a name, never
// any PII. `mode` is a fixed id ('word-bomb' | 'category-blitz' | 'sat-rush' | 'chain' | 'fuse').
import { track, trackOnce, setSessionProps } from './analytics.js';

// ---- milestones (fire at most once ever) --------------------------------------------------------
export const firstVisit = () => trackOnce('first_visit', 'taw.ev.firstVisit');
export const firstWinsEarned = (amount) => trackOnce('first_wins_earned', 'taw.ev.firstWins', { amount });

// ---- onboarding / navigation --------------------------------------------------------------------
export const splashDismissed = () => track('splash_dismissed');
export const modeOpened = (mode) => track('mode_opened', { mode });
export const lockedModeClicked = (mode, unlockLevel) => track('locked_mode_clicked', { mode, unlock_level: unlockLevel });
export const shopOpened = () => track('shop_opened');

// ---- the core loop ------------------------------------------------------------------------------
export const roundStarted = (mode, kind = 'solo') => track('round_started', { mode, kind });
export const roundCompleted = (mode, { kind = 'solo', score = null, words = null } = {}) =>
  track('round_completed', { mode, kind, score, words });

// ---- progression --------------------------------------------------------------------------------
export const levelUp = (level) => track('level_up', { level });
export const rebirth = (count) => track('rebirth', { count });
export const streakDay = (count) => track('streak_day', { count });

// ---- economy / social / discovery ---------------------------------------------------------------
export const itemPurchased = (item, tier = null) => track('item_purchased', { item, tier });
export const shareCopied = (surface) => track('share_copied', { surface });
export const secretFound = (id) => track('secret_found', { id });

// Attach/refresh the session properties (progression stage) so every later event segments by them.
// Reads are lazy + guarded; pass what you already have to avoid a storage round-trip.
export function refreshSessionProps({ level, rebirths, streak } = {}) {
  const props = {};
  if (Number.isFinite(level)) props.level = level;
  if (Number.isFinite(rebirths)) props.rebirth_count = rebirths;
  if (Number.isFinite(streak)) props.streak = streak;
  if (Object.keys(props).length) setSessionProps(props);
}
