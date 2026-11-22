import { describe, expect, test } from 'bun:test';
import { TYCHO, TYCHO_FLIGHT } from '../src/scenarios/tycho';
import { DAY } from '../src/transit';

describe('lw-tycho scenario', () => {
  test('the stated flight is the honest transit: days and speed come from transit()', () => {
    const days = TYCHO_FLIGHT.time / DAY;
    expect(days).toBeGreaterThan(5);
    expect(days).toBeLessThan(15);
    expect(TYCHO.captions[0].text).toContain(days.toFixed(1));
  });
  test('every shot targets a real actor and the shots tile the film without gaps', () => {
    const ids = new Set(TYCHO.actors.map((a) => a.id));
    for (const s of TYCHO.shots) expect(ids.has(s.id)).toBe(true);
    for (let i = 1; i < TYCHO.shots.length; i++) {
      const p = TYCHO.shots[i - 1];
      expect(Math.abs(p.t0 + p.secs - TYCHO.shots[i].t0)).toBeLessThan(0.01);
    }
    const last = TYCHO.shots[TYCHO.shots.length - 1];
    expect(last.t0 + last.secs).toBeGreaterThanOrEqual(TYCHO.time.duration - 1);
  });
  test('captions do not overlap', () => {
    const c = [...TYCHO.captions].sort((a, b) => a.t - b.t);
    for (let i = 1; i < c.length; i++) expect(c[i - 1].t + c[i - 1].dur).toBeLessThanOrEqual(c[i].t + 0.01);
  });
  test('every actor has a track, and a spoiler line and sources are set', () => {
    for (const a of TYCHO.actors) expect(TYCHO.tracks[a.id]?.length).toBeGreaterThan(0);
    expect(TYCHO.spoiler.length).toBeGreaterThan(10);
    expect(TYCHO.sources.length).toBeGreaterThan(0);
  });
});
