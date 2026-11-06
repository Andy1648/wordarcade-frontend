// RedeemCodes.jsx — STEP 61: the CODES box. One field + REDEEM; the answer is one line. It lives in SETTINGS only (Andy
// nov4 "move codes to settings"; styled in SettingsPanel.css). A good code pays the moment it is redeemed.
// H3/H5 (Andy oct3): a redeem is announced, never a quiet line — a good code STAMPS its prize with the
// purchase chime, a bad one shakes. Both finite transform/opacity, keyed per attempt so each one replays.
import { useRef, useState } from 'react';
import { sndPurchase, sndWordRejected } from '../audio/gameSounds';
import { redeemCode, normaliseCode, REDEEM_REASONS } from '../leaderboard/client';
import { formatNum } from '../format';
import { claimAmount } from '../progress/claims';

export default function RedeemCodes() {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text, n }
  const nRef = useRef(0);
  const say = (ok, text) => {
    nRef.current += 1;
    setMsg({ ok, text, n: nRef.current });
    try { (ok ? sndPurchase : sndWordRejected)(); } catch { /* audio blocked */ }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const code = normaliseCode(value);
    if (code.length < 3) {
      say(false, REDEEM_REASONS.bad_code);
      return;
    }
    setBusy(true);
    const r = await redeemCode(code);
    setBusy(false);
    if (r.ok) {
      setValue('');
      // E4 (Andy oct2 evening): a code applies the moment it is redeemed — no inbox, no second step.
      const text = r.kind === 'tester'
        ? 'TESTER MODE ON — NO CAPS FOR THIS ACCOUNT'
        : r.kind === 'gems'
        ? `+${formatNum(r.gems)} GEMS — ADDED`
        : r.kind === 'overdrive'
          ? `OVERDRIVE ×${r.mult} · ${r.min} MIN — STARTED`
          : r.kind === 'boost'
        ? `BOOST ×${r.mult} · ${r.min} MIN — STARTED`
        : r.perLevel
          // H2d: say what was ADDED (base × your level, the same claimAmount the credit used), not a
          // formula — "+1,000 WINS × YOUR LEVEL" left the player to do the multiplication.
          ? `+${formatNum(claimAmount({ amount: r.wins, meta: { perLevel: true } }))} WINS — ADDED`
          : r.wins > 0
            ? `+${formatNum(r.wins)} WINS — ADDED`
            : 'REDEEMED';
      say(true, text);
    } else {
      say(false, REDEEM_REASONS[r.reason] || REDEEM_REASONS.bad_code);
    }
  };
  return (
    <form className="sp-codes" onSubmit={submit} noValidate data-testid="sp-codes">
      <div className="sp-restore">
        <input
          className="sp-input sp-codes-input"
          aria-label="Enter a code"
          value={value}
          onChange={(e) => setValue(normaliseCode(e.target.value))}
          placeholder="ENTER CODE"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          disabled={busy}
        />
        <button type="submit" className="sp-btn sp-codes-btn" disabled={busy || !value}>
          {busy ? '…' : 'REDEEM'}
        </button>
      </div>
      {msg && (
        <div key={msg.n} className={`sp-msg sp-codes-msg${msg.ok ? ' is-ok' : ' is-bad'}`} role="status">
          {msg.text}
        </div>
      )}
    </form>
  );
}
