import { describe, expect, test } from 'bun:test';
import * as THREE from 'three';
import { EROS, EROS_FLIGHT, EROS_GAP_AU, DOCK, EROS_LEN } from '../src/scenarios/eros';
import { SCENARIOS } from '../src/scenarios';
import { VENUS } from '../src/scenarios/venus';
import { EROS_HALF_W, STATION_SPOTS, erosGeometry, erosHit, erosRock, sparAxis } from '../src/eros';
import { DAY } from '../src/transit';

describe('Eros model', () => {
  test('real proportions: 34.4 km long, about 11 km across, unit length along z', () => {
    const { geo } = erosGeometry();
    const b = geo.boundingBox!;
    expect(b.max.z - b.min.z).toBeGreaterThan(0.98);
    expect(b.max.z - b.min.z).toBeLessThan(1.03);
    const w = b.max.x - b.min.x;
    expect(w * EROS_LEN / 1000).toBeGreaterThan(9);
    expect(w * EROS_LEN / 1000).toBeLessThan(13);
    expect(EROS_HALF_W * 2 * EROS_LEN / 1000).toBeCloseTo(11.2, 0);
  });
  test('it is the same every time and small enough to build and draw', () => {
    const a = erosGeometry().geo.getAttribute('position').array;
    expect(a.length).toBeGreaterThan(0);
    expect(erosGeometry().geo.getAttribute('position').count).toBeLessThan(60000);
    expect(erosGeometry().craters.length).toBeGreaterThan(100);
  });
  test('every spot of the station dressing lands on the rock', () => {
    for (const d of Object.values(STATION_SPOTS)) expect(() => erosHit(new THREE.Vector3(d[0] * 2, d[1] * 2, d[2]), erosRock())).not.toThrow();
  });
  test('the docking spar stands on the rock and its cradle is out in space', () => {
    const { p, n } = erosHit(new THREE.Vector3(0, 2, -0.1), erosRock());
    expect(p.y).toBeGreaterThan(0);
    expect(n.length()).toBeCloseTo(1, 3);
    expect(sparAxis().y).toBeGreaterThan(0.5);
    expect(Math.hypot(...DOCK) / EROS_LEN).toBeGreaterThan(0.1);
  });
});

describe('lw-eros scenario', () => {
  test('is registered after lw-tycho, with a unique id', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(ids.indexOf('lw-eros')).toBe(ids.indexOf('lw-tycho') + 1);
    expect(new Set(ids).size).toBe(ids.length);
  });
  test('the stated flight is the honest transit: days and speed from transit()', () => {
    expect(EROS_GAP_AU).toBeGreaterThan(1.5);
    expect(EROS_GAP_AU).toBeLessThan(4);
    const days = EROS_FLIGHT.time / DAY;
    expect(days).toBeGreaterThan(3);
    expect(days).toBeLessThan(14);
    expect(EROS.captions[0].text).toContain(days.toFixed(1));
  });
  test('shots tile the film, target real actors, and captions do not overlap', () => {
    const ids = new Set(EROS.actors.map((a) => a.id));
    for (const s of EROS.shots) expect(ids.has(s.id)).toBe(true);
    for (let i = 1; i < EROS.shots.length; i++) {
      const p = EROS.shots[i - 1];
      expect(Math.abs(p.t0 + p.secs - EROS.shots[i].t0)).toBeLessThan(0.01);
    }
    const last = EROS.shots[EROS.shots.length - 1];
    expect(last.t0 + last.secs).toBeGreaterThanOrEqual(EROS.time.duration - 1);
    const c = [...EROS.captions].sort((a, b) => a.t - b.t);
    for (let i = 1; i < c.length; i++) expect(c[i - 1].t + c[i - 1].dur).toBeLessThanOrEqual(c[i].t + 0.01);
    for (const k of c) expect(k.t + k.dur).toBeLessThanOrEqual(EROS.time.duration + 0.01);
  });
  test('every actor has a track; spoiler and sources set; invented things are flagged', () => {
    for (const a of EROS.actors) expect(EROS.tracks[a.id]?.length).toBeGreaterThan(0);
    expect(EROS.spoiler.length).toBeGreaterThan(10);
    expect(EROS.sources.length).toBeGreaterThan(0);
    expect(EROS.actors.find((a) => a.model === 'eros-station')?.invented).toBe(true);
  });
  test('Venus uses the same Eros shape at the real length', () => {
    const e = VENUS.actors.find((a) => a.id === 'eros')!;
    expect(e.model).toBe('eros');
    expect(e.len).toBe(EROS_LEN);
  });
});
