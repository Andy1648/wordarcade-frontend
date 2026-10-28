import { describe, it, expect } from 'vitest';
import { careerLevel, popGrowth, GROWTH_MAX, GROWTH_MAX_NARROW, GROWTH_CAP_CAREER } from './popGrowth.js';

const gate = (r) => 25 * (r + 1); // the live table: R1 at LV25, R2 at LV50 …

describe('careerLevel', () => {
  it('is the level with no rebirths', () => {
    expect(careerLevel(1, 0, gate)).toBe(1);
    expect(careerLevel(37, 0, gate)).toBe(37);
  });
  it('banks every past rebirth gate, so a rebirth never moves it back', () => {
    expect(careerLevel(25, 0, gate)).toBe(25);
    expect(careerLevel(1, 1, gate)).toBe(26); // just rebirthed: one more than the LV25 it left
    expect(careerLevel(1, 3, gate)).toBe(1 + 25 + 50 + 75);
  });
  it('survives junk input', () => {
    expect(careerLevel(NaN, -2, gate)).toBe(1);
    expect(careerLevel(5, 2, () => NaN)).toBe(5);
  });
});

describe('popGrowth', () => {
  it('starts at x1 and grows monotonically with career level', () => {
    expect(popGrowth(1).scale).toBe(1);
    let prev = 0;
    for (const c of [1, 2, 5, 10, 25, 50, 100, 300, 1000, 3000]) {
      const s = popGrowth(c).scale;
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });
  it('is capped — no runaway past the cap', () => {
    expect(popGrowth(GROWTH_CAP_CAREER).scale).toBeCloseTo(1 + GROWTH_MAX);
    expect(popGrowth(1e9).scale).toBeCloseTo(1 + GROWTH_MAX);
    expect(popGrowth(1e9, true).scale).toBeCloseTo(1 + GROWTH_MAX_NARROW);
  });
  it('a rebirth never shrinks the pop', () => {
    expect(popGrowth(careerLevel(1, 1, gate)).scale).toBeGreaterThan(popGrowth(careerLevel(25, 0, gate)).scale);
  });
  it('feels the early levels (L10 is already ~+20%)', () => {
    expect(popGrowth(10).scale).toBeGreaterThan(1.18);
  });
  it('dresses in stages', () => {
    expect(popGrowth(9).stage).toBe(0);
    expect(popGrowth(10).stage).toBe(1);
    expect(popGrowth(100).stage).toBe(2);
    expect(popGrowth(1000).stage).toBe(3);
    expect(popGrowth(1e6).stage).toBe(3);
  });
});
