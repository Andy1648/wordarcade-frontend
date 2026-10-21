// contracts/ContractDoneLine.jsx — the end card's "CONTRACT DONE +N" line, under the WINS / XP / GEMS lines. Read from
// the gem ledger the card already reads (reason 'contract', since the round's mark) — so it can only say what was paid.
// Renders nothing when no contract finished this round.
import { useEffect, useState } from 'react';
import { gemsLedgerSince, subscribeGemLedger } from '../../progress/gemsCore.js';
import { GemIcon } from '../gems/GemChip.jsx';
import { formatNum } from '../../format';
import './contractLine.css';

const paid = (since) => gemsLedgerSince(since).filter((e) => e.reason === 'contract');

export default function ContractDoneLine({ since = 0, className = '' }) {
  const [list, setList] = useState(() => paid(since));
  useEffect(() => {
    setList(paid(since));
    return subscribeGemLedger(() => setList(paid(since)));
  }, [since]);
  if (!list.length) return null;
  const tasks = list.filter((e) => e.detail !== 'sweep').length;
  const sweep = list.some((e) => e.detail === 'sweep');
  const total = list.reduce((a, e) => a + e.amount, 0);
  const label = sweep ? 'ALL 3 CONTRACTS DONE' : tasks > 1 ? `${tasks} CONTRACTS DONE` : 'CONTRACT DONE';
  return (
    <div className={`cx-endline ${className}`.trim()} data-testid="contract-done" data-contract-gems={total}>
      <img src="/cast/props/page.webp" alt="" width="30" height="30" draggable="false" />
      {label}
      <b><GemIcon size={18} />+{formatNum(total)}</b>
    </div>
  );
}
