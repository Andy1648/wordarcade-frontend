// e2e/support/fixedDay.js — pin the page's calendar to a fixed instant (the clock keeps TICKING from there).
//
// Why: daily things are dealt from the LOCAL DATE — contracts (contracts/pool.js pickDay seeds on the day key), the
// daily drop / wheel / streak day keys, limited-hero windows (HOLLOW_UNTIL). A spec that reads an end card or a menu
// therefore changed shape at midnight (CI runs in UTC): on 2026-10-27 the day's pick was wb-long9 and the spec's own
// CONSTRUCT finished it, so a CONTRACT DONE line appeared that no other day had. Pinning the day makes every run see
// the same day. Unlike page.clock.setFixedTime this only shifts Date — timers, rAF and performance.now are real,
// and Date.now() still advances, so countdowns and elapsed-time code behave normally.
//
// Use: await pinDay(page)                         → the default day (a weekday, mid-afternoon, nowhere near midnight)
//      await pinDay(page, '2026-10-27T12:00:00')  → a specific local instant
export const DEFAULT_DAY = '2026-10-21T15:00:00';

export async function pinDay(page, at = DEFAULT_DAY) {
  await page.addInitScript((iso) => {
    if (window.__TAW_PINNED_DAY) return;
    window.__TAW_PINNED_DAY = iso;
    const RealDate = Date;
    const realNow = RealDate.now.bind(RealDate);
    const offset = new RealDate(iso).getTime() - realNow();
    class PinnedDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(realNow() + offset);
        else super(...args);
      }
      static now() { return realNow() + offset; }
    }
    // eslint-disable-next-line no-global-assign
    Date = PinnedDate;
    window.Date = PinnedDate;
  }, at);
}
