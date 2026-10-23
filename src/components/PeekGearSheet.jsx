// PeekGearSheet.jsx — the GEAR SHEET for a gear worn on someone else's LEADERBOARD profile (ProfileCard). Andy oct22:
// "make locked gears not show stats from other people's leaderboard profiles" — a gear the VIEWER does not own opens
// exactly as it does locked in their own INDEX (rarity · LOCKED + the count of what is hidden, never a value); one they
// own shows its numbers. Your own card is always yours. Lazy with the sheet, so the board's profile chunk stays small.
import GearSheet from './GearSheet.jsx';
import { viewerOwnsGear } from './gearEntries.js';

export default function PeekGearSheet({ e, mine = false, serial = null, onClose }) {
  const have = mine || viewerOwnsGear(e);
  return <GearSheet e={e} have={have} view={null} peek serial={serial} howTo={e.kind === 'unlisted' ? e.riddle || '' : ''} onClose={onClose} />;
}
