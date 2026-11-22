import { describe, expect, test } from 'bun:test';
import { chapterAt, nextChapterT, prevChapterT, fmtTime, visibleScenarios, loadGuard, saveGuard, loadResume, saveResume, clearResume, DEFAULT_GUARD, type Store } from '../src/scenarioNav';
import { SCENARIOS } from '../src/scenarios';

const mem = (): Store & { m: Map<string, string> } => { const m = new Map<string, string>(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }; };
const CH = [{ t: 0, title: 'a' }, { t: 30, title: 'b' }, { t: 90, title: 'c' }];

describe('chapters', () => {
  test('chapterAt', () => {
    expect(chapterAt(CH, 0)).toBe(0); expect(chapterAt(CH, 29.9)).toBe(0); expect(chapterAt(CH, 30)).toBe(1); expect(chapterAt(CH, 500)).toBe(2);
    expect(chapterAt([], 5)).toBe(-1); expect(chapterAt([{ t: 10, title: 'x' }], 5)).toBe(-1);
  });
  test('next and previous', () => {
    expect(nextChapterT(CH, 0)).toBe(30); expect(nextChapterT(CH, 30)).toBe(90); expect(nextChapterT(CH, 90)).toBeNull();
    expect(prevChapterT(CH, 50)).toBe(30);      // restart this chapter
    expect(prevChapterT(CH, 31)).toBe(0);       // just in: the one before
    expect(prevChapterT(CH, 1)).toBe(0); expect(prevChapterT(CH, 10)).toBe(0);
    expect(prevChapterT([], 10)).toBe(0);
  });
  test('fmtTime', () => { expect(fmtTime(83.4)).toBe('1:23'); expect(fmtTime(-3)).toBe('0:00'); expect(fmtTime(190)).toBe('3:10'); });
  test('every scenario has chapters that start at 0, ascend, and sit inside the film', () => {
    for (const s of SCENARIOS) {
      const c = s.chapters ?? [];
      expect(c.length).toBeGreaterThan(1);
      expect(c[0].t).toBe(0);
      for (let i = 1; i < c.length; i++) expect(c[i].t).toBeGreaterThan(c[i - 1].t);
      expect(c[c.length - 1].t).toBeLessThan(s.time.duration - 5);
      for (const x of c) expect(x.title.length).toBeGreaterThan(2);
    }
  });
});

describe('spoiler guard', () => {
  const L = [{ book: 1 }, { book: 2 }, { book: 3 }];
  test('default shows all; hide cuts later books', () => {
    expect(visibleScenarios(L, DEFAULT_GUARD).length).toBe(3);
    expect(visibleScenarios(L, { hide: true, upTo: 2 }).map((s) => s.book)).toEqual([1, 2]);
    expect(visibleScenarios(L, { hide: true, upTo: 0 }).length).toBe(0);
  });
  test('persists, and survives junk or no storage', () => {
    const s = mem();
    expect(loadGuard(s)).toEqual(DEFAULT_GUARD);
    saveGuard({ hide: true, upTo: 2 }, s);
    expect(loadGuard(s)).toEqual({ hide: true, upTo: 2 });
    s.setItem('beyond-ring.scn.guard', '{{nope');
    expect(loadGuard(s)).toEqual(DEFAULT_GUARD);
    s.setItem('beyond-ring.scn.guard', '{"hide":"yes","upTo":-4}');
    expect(loadGuard(s)).toEqual({ hide: false, upTo: 1 });
    expect(loadGuard(null)).toEqual(DEFAULT_GUARD);
    expect(() => saveGuard(DEFAULT_GUARD, null)).not.toThrow();
    const bad: Store = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); } };
    expect(loadGuard(bad)).toEqual(DEFAULT_GUARD); expect(() => saveGuard(DEFAULT_GUARD, bad)).not.toThrow();
  });
});

describe('resume store', () => {
  test('saves mid-film, ignores the very start and the tail, per scenario', () => {
    const s = mem();
    saveResume('a', 83.44, 190, s); saveResume('b', 40, 150, s);
    expect(loadResume(s)).toEqual({ a: 83.4, b: 40 });
    saveResume('a', 2, 190, s); expect(loadResume(s)).toEqual({ b: 40 });
    saveResume('b', 148, 150, s); expect(loadResume(s)).toEqual({});
    saveResume('a', 60, 190, s); clearResume('a', s); expect(loadResume(s)).toEqual({});
  });
  test('junk and failing storage are harmless', () => {
    const s = mem(); s.setItem('beyond-ring.scn.resume', '[1,2'); expect(loadResume(s)).toEqual({});
    s.setItem('beyond-ring.scn.resume', '{"a":"x","b":-1,"c":30}'); expect(loadResume(s)).toEqual({ c: 30 });
    expect(loadResume(null)).toEqual({}); expect(() => saveResume('a', 50, 100, null)).not.toThrow();
  });
});
