import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { validateFacts, badgeFor, type FactsFile } from '../src/facts';

const file = (): FactsFile => JSON.parse(readFileSync(new URL('../assets/data/facts.json', import.meta.url), 'utf8'));

test('the built facts file is valid', () => { expect(validateFacts(file())).toEqual([]); });

test('every fact has a source, a URL, a date, a licence and a credit', () => {
  for (const e of file().entities) for (const f of [...e.facts, ...e.missions.map((m) => m.launch)]) {
    for (const k of ['sourceName', 'sourceUrl', 'retrieved', 'licence', 'credit'] as const) expect(f[k].length).toBeGreaterThan(0);
  }
});

test('a fact without a source or licence fails', () => {
  for (const k of ['sourceName', 'sourceUrl', 'licence', 'retrieved'] as const) {
    const f = file(); (f.entities[0].facts[0] as unknown as Record<string, string>)[k] = '';
    expect(validateFacts(f).length).toBeGreaterThan(0);
  }
});

test('an entity without a licence line fails', () => {
  const f = file(); f.entities[1].licence = '';
  expect(validateFacts(f).join()).toContain('no licence');
});

test('text may not be phrased as the agency speaking', () => {
  const f = file(); f.entities[0].summary = 'According to NASA, Earth is round.';
  expect(validateFacts(f).join()).toContain('attributes');
});

test('badges: Earth is Real, the Rocinante and Tycho are Fiction, other bodies carry none yet', () => {
  const m = new Map(file().entities.map((e) => [e.id, e]));
  expect(badgeFor({ id: 'earth', kind: 'planet' }, m)?.label).toBe('Real');
  expect(badgeFor({ id: 'rocinante', kind: 'ship' }, m)?.label).toBe('Fiction');
  expect(badgeFor({ id: 'tycho', kind: 'station' }, m)?.label).toBe('Fiction');
  expect(badgeFor({ id: 'mars', kind: 'planet' }, m)).toBeNull();
});
