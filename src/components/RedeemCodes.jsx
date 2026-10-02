// RedeemCodes.jsx — STEP 61: the shop's CODES entry. One field + REDEEM; the answer is one line.
// A good code does not pay here — it lands in REWARDS to claim (leaderboard/client.js redeemCode),
// and the line says so.
import { useState } from 'react';
import { redeemCode, normaliseCode, REDEEM_REASONS } from '../leaderboard/client';
import { formatNum } from '../format';

export default function RedeemCodes() {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { ok, text }
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const code = normaliseCode(value);
    if (code.length < 3) {
      setMsg({ ok: false, text: REDEEM_REASONS.bad_code });
      return;
    }
    setBusy(true);
    const r = await redeemCode(code);
    setBusy(false);
    if (r.ok) {
      setValue('');
      // Claims ride the STATS button (Andy oct2 A4). R10: a BOOST code / a PER-LEVEL code say so.
      const text = r.kind === 'boost'
        ? `BOOST ×${r.mult} · ${r.min} MIN — CLAIM IT IN STATS TO START`
        : r.perLevel
          ? `+${formatNum(r.wins)} WINS × YOUR LEVEL — CLAIM IT IN STATS`
          : r.wins > 0
            ? `+${formatNum(r.wins)} WINS — CLAIM IT IN STATS`
            : 'REDEEMED — CLAIM IT IN STATS';
      setMsg({ ok: true, text });
    } else {
      setMsg({ ok: false, text: REDEEM_REASONS[r.reason] || REDEEM_REASONS.bad_code });
    }
  };
  return (
    <form className="shop-codes" onSubmit={submit} noValidate>
      <label className="shop-codes-label" htmlFor="shop-codes-input">HAVE A CODE?</label>
      <div className="shop-codes-row">
        <input
          id="shop-codes-input"
          className="shop-codes-input"
          value={value}
          onChange={(e) => setValue(normaliseCode(e.target.value))}
          placeholder="ENTER CODE"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          disabled={busy}
        />
        <button type="submit" className="shop-codes-btn" disabled={busy || !value}>
          {busy ? '…' : 'REDEEM'}
        </button>
      </div>
      {msg && (
        <div className={`shop-codes-msg${msg.ok ? ' is-ok' : ' is-bad'}`} role="status">
          {msg.text}
        </div>
      )}
    </form>
  );
}
