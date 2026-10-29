// KitRankPlate.jsx — a TITLE as a painted object (Andy oct28: "titles … have no personality … mix it up with the design
// formats"). The 16 v3 titles climb through six FORMATS (titleFormats.js): masking TAPE → a die-cut STICKER → a riveted
// STEEL plate → a ribbon BANNER → a NEON sign → a gold MARQUEE. The art is one painted image per format (public/titles/);
// the name is Bungee in the title's own ink on the art's calm centre, sized from its length (no layout read).
//
//   <KitRankPlate rank="R6" />                    KEYFIEND, 156 px wide
//   <KitRankPlate rank={11} w={120} />            VOIDTYPER by ladder index
//   <KitRankPlate rank="R2" label="#7" />          the board's "#7" on CLACKER's plate
//   <KitRankPlate rank="R6" fit />                 FIT: as tall as the CSS height (--krp-h, default 28 px), as wide as
//                                                  the art's aspect makes it — never stretched. A box that must cap
//                                                  it sets --krp-h from its own width (see RankLadder.css).
//
// Every size runs off ONE number, --krp-h: width = h × the art's aspect, the name = h × its scale — so a plate always
// shrinks as one piece and the name never outgrows the art.
//
// The art keeps its aspect (Andy: no stretched art). The lit formats (NEON, MARQUEE) SWITCH ON once when the plate
// mounts (`shine`, default on) — a finite opacity flicker, skipped under REDUCE MOTION; nothing loops.
import { useEffect, useRef } from 'react';
import { titleLook, nameScale } from './titleFormats.js';
import { kitPlay } from './motion.js';
import './tokens.css';
import './KitRankPlate.css';

const SWITCH_ON = [{ opacity: 0.35 }, { opacity: 1, offset: 0.25 }, { opacity: 0.55, offset: 0.4 }, { opacity: 1 }];

export function KitRankPlate({ rank = 'R0', w = 156, label, shine = true, fit = false, className = '', innerRef, ...rest }) {
  const t = titleLook(rank);
  const f = t.fmt;
  const text = label != null ? label : t.name;
  const art = useRef(null);
  const lit = t.f === 'neon' || t.f === 'marquee';
  useEffect(() => {
    if (lit && shine) kitPlay(art.current, SWITCH_ON, { duration: 520, delay: 300, easing: 'steps(1, end)' });
  }, [lit, shine]);
  const [l, top, r, b] = f.box;
  const style = {
    '--krp-ink': t.ink,
    '--krp-k': nameScale(t, text),
    '--krp-tilt': `${f.tilt}deg`,
    '--krp-box': `${top * 100}% ${r * 100}% ${b * 100}% ${l * 100}%`,
    '--krp-aspect': f.aspect,
    ...(fit ? null : { '--krp-h': `${Math.round(w / f.aspect)}px` }),
  };
  return (
    <span
      ref={innerRef}
      className={`krp krp-${t.f}${fit ? ' krp-fit' : ''}${f.stroke ? ' is-stroked' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      data-rank-plate={t.req}
      data-rank-title={t.name}
      data-title-format={t.f}
      {...rest}
    >
      <img ref={art} className="krp-art" src={f.src} alt="" aria-hidden="true" draggable="false" decoding="async" />
      <span className="krp-name">{text}</span>
    </span>
  );
}

export default KitRankPlate;
