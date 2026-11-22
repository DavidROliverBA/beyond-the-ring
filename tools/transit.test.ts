import { describe, expect, test } from 'bun:test';
import { AU, DAY, G0, accelFor, transit, transitAt, transitAU } from '../src/transit';

// The canon note's table (docs/research/canon/leviathan-wakes.md, section 1, "Accelerations"):
// brachistochrone at 0.1, 0.3, 1 and 3 g, flip at half way, peak speed at the flip.
const TABLE: [number, number, number, number][] = [
  // AU, g, days, km/s
  [0.3, 0.1, 5.0, 210], [0.3, 0.3, 2.9, 363], [0.3, 1, 1.6, 663], [0.3, 3, 0.9, 1149],
  [1, 0.1, 9.0, 383], [1, 0.3, 5.2, 663], [1, 1, 2.9, 1211], [1, 3, 1.7, 2098],
  [2, 0.1, 12.8, 542], [2, 0.3, 7.4, 938], [2, 1, 4.0, 1713], [2, 3, 2.3, 2967],
  [4, 0.1, 18.1, 766], [4, 0.3, 10.4, 1327], [4, 1, 5.7, 2422], [4, 3, 3.3, 4196],
  [8, 0.1, 25.6, 1083], [8, 0.3, 14.8, 1876], [8, 1, 8.1, 3426], [8, 3, 4.7, 5934],
];

describe('transit against the canon table', () => {
  for (const [au, g, days, kms] of TABLE) {
    test(`${au} AU at ${g} g`, () => {
      const r = transitAU(au, g);
      expect(Math.abs(r.days - days)).toBeLessThan(0.051);
      expect(Math.abs(r.peakKms - kms) / kms).toBeLessThan(0.005);
    });
  }
});

describe('transit physics', () => {
  test('no flip: T = 2 sqrt(D/a), peak sqrt(aD), flip at half way', () => {
    const D = 1e9, a = 3;
    const t = transit(D, a);
    expect(t.time).toBeCloseTo(2 * Math.sqrt(D / a), 6);
    expect(t.peakSpeed).toBeCloseTo(Math.sqrt(a * D), 6);
    expect(t.flipAtDistance).toBeCloseTo(D / 2, 3);
    expect(t.flipStart).toBeCloseTo(t.time / 2, 9);
  });
  test('a flip adds time and puts the turn-over around the middle', () => {
    const base = transit(1e9, 3), t = transit(1e9, 3, 60);
    expect(t.time).toBeGreaterThan(base.time);
    expect(t.time).toBeLessThan(base.time + 60);          // less than the flip itself: the burns are shorter
    expect(t.flipEnd - t.flipStart).toBe(60);
    expect(t.flipAtDistance + t.peakSpeed * 60 / 2).toBeCloseTo(1e9 / 2, 0); // symmetric about half way
    expect(t.flipEndDistance).toBeCloseTo(1e9 - t.flipAtDistance, 0);
  });
  test('the path is continuous, starts and ends at rest, and never overshoots', () => {
    const t = transit(5e8, 2 * G0, 45);
    expect(transitAt(t, 0)).toMatchObject({ s: 0, v: 0, phase: 'rest' });
    expect(transitAt(t, t.time)).toMatchObject({ s: 5e8, v: 0, phase: 'rest' });
    let last = 0;
    for (let i = 1; i <= 2000; i++) {
      const st = transitAt(t, (t.time * i) / 2000);
      expect(st.s).toBeGreaterThanOrEqual(last - 1e-6); last = st.s;
      expect(st.s).toBeLessThanOrEqual(5e8 + 1e-6);
      expect(st.v).toBeLessThanOrEqual(t.peakSpeed + 1e-9);
    }
    expect(transitAt(t, t.flipStart + 1)).toMatchObject({ phase: 'flip', thrust: false });
    expect(transitAt(t, 1).thrust).toBe(true);
    expect(transitAt(t, t.time - 1)).toMatchObject({ phase: 'decelerate', thrust: true });
    // Speed matches across each boundary.
    expect(transitAt(t, t.flipStart - 1e-6).v).toBeCloseTo(transitAt(t, t.flipStart + 1e-6).v, 3);
    expect(transitAt(t, t.flipEnd - 1e-6).s).toBeCloseTo(transitAt(t, t.flipEnd + 1e-6).s, -1);
  });
  test('the distance covered adds up (energy: v^2 = 2 a s while burning)', () => {
    const t = transit(2 * AU, G0);
    const st = transitAt(t, t.time / 4);
    expect(st.v * st.v).toBeCloseTo(2 * t.accel * st.s, -2);
  });
  test('zero distance is instant; bad input throws', () => {
    expect(transit(0, 1).time).toBe(0);
    expect(() => transit(1, 0)).toThrow();
    expect(() => transit(-1, 1)).toThrow();
    expect(() => transit(1, 1, -1)).toThrow();
  });
  test('one day rest to rest at 1 g covers a (T/2)^2', () => {
    // One-way, 1 g for 12 h then 1 g braking: D = a (T/2)^2 = 9.80665 * 43200^2
    const D = G0 * 43200 ** 2;
    expect(transit(D, G0).time / DAY).toBeCloseTo(1, 9);
  });
});

describe('accelFor', () => {
  test('is the inverse of transit', () => {
    for (const [D, a, f] of [[1e6, 3, 0], [2.9e3, 2.94, 8], [4.2e11, 2.94, 600]] as const) {
      const tr = transit(D, a, f);
      expect(accelFor(D, tr.time, f) / a).toBeCloseTo(1, 9);
    }
  });
  test('film leg of 150 km in 72 s with a 7 s flip takes exactly 72 s', () => {
    const a = accelFor(150e3, 72, 7);
    expect(transit(150e3, a, 7).time).toBeCloseTo(72, 9);
  });
  test('rejects a flip longer than the time', () => {
    expect(() => accelFor(1000, 5, 6)).toThrow(RangeError);
  });
});
