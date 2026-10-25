// powerArt.js — THE POWER LADDER (oct24, Andy: the UPGRADES power icon was the same battery at every level, "making me
// rage" — "progression must FEEL like progression"). POWER levels forever, so its icon EVOLVES: every two levels is a
// new FORM, painted (ChatGPT, one image per form, the old battery as the style reference), from a nervous AA battery up
// to cosmic. Each form also has its own plate colour (the tilted square behind it). Pure data + lookups; the shop draws it.
// All ten forms painted (oct24); POWER 18+ holds the BLACK HOLE.
export const POWER_LEVELS_PER_FORM = 2;
export const POWER_FORMS = [
  { name: 'AA BATTERY', plate: '#9aa3b5', inner: '#2b2f3a' },
  { name: 'POWER CELL', plate: '#FFE94A', inner: '#3d2a05' },
  { name: 'CAR BATTERY', plate: '#FF6B3D', inner: '#3d1405' },
  { name: 'TESLA COIL', plate: '#2EFFE0', inner: '#063a36' },
  { name: 'GENERATOR', plate: '#FFB627', inner: '#3d2a05' },
  { name: 'REACTOR', plate: '#3DFFB0', inner: '#04361f' },
  { name: 'STORM JAR', plate: '#3D8BFF', inner: '#0a1f45' },
  { name: 'MINI SUN', plate: '#FF6B3D', inner: '#4a1404' },
  { name: 'NEBULA ORB', plate: '#B04BFF', inner: '#2a0950' },
  { name: 'BLACK HOLE', plate: '#FF4FA3', inner: '#0d0618' },
].map((f, i) => ({ ...f, n: i + 1, from: i * POWER_LEVELS_PER_FORM, src: `/shop/power/t${i + 1}.webp` }));

/** The form for a POWER level (0-based levels; the top painted form holds above its range). */
export function powerForm(tier) {
  const t = Math.max(0, Math.floor(Number(tier) || 0));
  return POWER_FORMS[Math.min(POWER_FORMS.length - 1, Math.floor(t / POWER_LEVELS_PER_FORM))];
}
/** The next form and the level it arrives at, or null at the top. */
export function nextPowerForm(tier) {
  const f = powerForm(tier);
  const nx = POWER_FORMS[f.n];
  return nx ? { ...nx, at: nx.from } : null;
}
