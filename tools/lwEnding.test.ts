import { describe, expect, test } from 'bun:test';
import { G0 } from '../src/transit';
import { VENUS_R, closestToOrigin, interceptAccel, lapseFactor, len, pushed, surfacePoint, tripDays, tripRange, type V } from '../src/scenarios/lwEnding';
import { DIVE_DISTANCE, DIVE_LAPSE, PEEL, VENUS } from '../src/scenarios/venus';
import { ANUBIS } from '../src/scenarios/anubis';
import { SCENARIOS } from '../src/scenarios';

describe('interceptAccel', () => {
  test('lands on the target at T', () => {
    const p1: V = [1.5e8, 2e7, -1.9e8], v1: V = [-9e5, 0, 2.4e6], target: V = [4.7e6, 1.3e6, -3.5e6], T = 76;
    const { dir, g } = interceptAccel(p1, v1, target, T);
    const p = pushed(p1, v1, dir, g * G0, T);
    for (let i = 0; i < 3; i++) expect(Math.abs(p[i] - target[i])).toBeLessThan(1e-3 * len(target));
    expect(len(dir)).toBeCloseTo(1, 9);
  });
  test('no push needed when already on course', () => {
    const { g } = interceptAccel([0, 0, 0], [10, 0, 0], [100, 0, 0], 10);
    expect(g).toBeLessThan(1e-9);
  });
});

describe('time-lapse and real trips', () => {
  test('lapse factor is 1 when the film runs at real time', () => {
    const d = 0.5 * 3 * G0 * 100 ** 2;
    expect(lapseFactor(d, 100, 3)).toBeCloseTo(1, 9);
  });
  test('trip days agree with brachistochrone', () => {
    expect(tripDays(1, 3)).toBeCloseTo(1.7, 1);       // the canon table: 1 AU at 3 g is 1.7 days
    expect(tripRange(0.3, 1.5, 3)).toMatch(/about 0\.9 to 2\.\d days/);
  });
});

const at = (c: { from: V; vel: V }, t: number): V => [c.from[0] + c.vel[0] * t, c.from[1] + c.vel[1] * t, c.from[2] + c.vel[2] * t];

describe('the Venus film', () => {
  test('the dive is long and a real time-lapse', () => {
    expect(DIVE_DISTANCE).toBeGreaterThan(1e8);
    expect(DIVE_LAPSE).toBeGreaterThan(10);
  });
  test('the Rocinante clears the planet after peeling off', () => {
    const eros0 = VENUS.tracks.eros[0] as unknown as { from: V; vel: V };
    const dive = VENUS.tracks.eros[1] as unknown as { t: number; dir: V; g: number };
    const tau = 96 - dive.t, a = dive.g * G0;
    const pe = pushed(at(eros0, dive.t), eros0.vel, dive.dir, a, tau);
    const ve: V = [0, 1, 2].map((i) => eros0.vel[i] + dive.dir[i] * a * tau) as V;
    expect(closestToOrigin(pe, ve, PEEL.dir, PEEL.g * G0, 0, 40)).toBeGreaterThan(VENUS_R * 1.02);
  });
  test('the impact point is on the surface', () => {
    expect(len(surfacePoint([1, 2, 3], VENUS_R))).toBeCloseTo(VENUS_R, 3);
  });
});

describe('scenario files', () => {
  for (const s of [ANUBIS, VENUS]) {
    test(`${s.id}: registered, spoiler says so, tracks and captions in range`, () => {
      expect(SCENARIOS).toContain(s);
      expect(s.spoiler.startsWith('Spoils the ending of Leviathan Wakes')).toBe(true);
      expect(s.sources.length).toBeGreaterThan(0);
      for (const a of s.actors) expect(s.tracks[a.id]).toBeDefined();
      for (const c of s.captions) expect(c.t + c.dur).toBeLessThanOrEqual(s.time.duration);
      for (const sh of s.shots) { expect(s.actors.some((a) => a.id === sh.id)).toBe(true); expect(sh.t0 + sh.secs).toBeLessThanOrEqual(s.time.duration + 0.01); }
      for (const e of s.events) expect(e.t).toBeLessThanOrEqual(s.time.duration);
      for (const a of s.actors) if (a.confidence === '?') expect(a.invented).toBe(true);
    });
  }
});
