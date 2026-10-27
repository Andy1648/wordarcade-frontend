// PowerLadder.jsx — THE POWER LADDER popup (Andy oct26: "have a pop-up-able for the power (with the newer ones
// obviously hidden)"). A tap on the UPGRADES plate opens every POWER form as its painted icon: the forms you reached in
// full, the one you hold now lifted and outlined, the ones ahead blacked out behind a padlock. Icon + number + name
// only (no copy explaining the mechanic). Rides ShopV2's .sp2-pop scrim: outside tap / Esc (ShopV2) / ✕ close it.
// Motion: the panel's finite pop-in + a one-shot stagger on the forms (transform / opacity, CSS, reduce motion = none).
import { useEffect, useRef } from 'react';
import KitIcon from './kit/KitIcon.jsx';
import { POWER_FORMS } from '../progress/powerArt.js';

export default function PowerLadder({ current, onClose }) {
  const xRef = useRef(null);
  useEffect(() => { xRef.current?.focus(); }, []);
  return (
    <div
      className="sp2-pop pl-pop"
      role="dialog"
      aria-modal="true"
      aria-label="Power forms"
      data-testid="power-ladder"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sp2-pop-in pl-in">
        <button ref={xRef} type="button" className="sp2-pop-x" onClick={onClose} aria-label="Close the power forms">✕</button>
        <h3 className="pl-title">POWER</h3>
        <ol className="pl-grid">
          {POWER_FORMS.map((f, i) => {
            const state = f.n < current ? 'got' : f.n === current ? 'now' : 'locked';
            const locked = state === 'locked';
            return (
              <li
                key={f.n}
                className={`pl-form is-${state}`}
                data-form={f.n}
                style={{ '--pf-plate': locked ? '#2a1d42' : f.plate, '--pf-inner': locked ? '#120a20' : f.inner, '--pl-i': i }}
                aria-label={locked ? `Form ${f.n} — locked` : `Form ${f.n} — ${f.name}${state === 'now' ? ' (yours)' : ''}`}
                aria-current={state === 'now' ? 'true' : undefined}
              >
                <span className="pl-plate" aria-hidden="true">
                  <span className="pl-plate-a" />
                  <span className="pl-plate-b" />
                  <img className="pl-art" src={f.src} width="256" height="256" alt="" draggable="false" loading="lazy" />
                  {locked ? <KitIcon name="lock" size={34} shadow={2} extras={false} className="pl-lock" /> : null}
                </span>
                <span className="pl-cap" aria-hidden="true">
                  <b className="pl-n">{f.n}</b>
                  {locked ? null : <span className="pl-name">{f.name}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
