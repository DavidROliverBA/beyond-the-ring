import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { validateFacts, badgeFor, BASED_ON, type FactsFile } from '../src/facts';
import { SOL } from '../src/data';

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

const byId = () => new Map(file().entities.map((e) => [e.id, e]));
const REAL = ['sun', 'mercury', 'venus', 'earth', 'luna', 'mars', 'phobos', 'deimos', 'jupiter', 'io', 'europa', 'ganymede', 'callisto', 'saturn', 'enceladus', 'rhea', 'titan', 'iapetus', 'uranus', 'miranda', 'titania', 'oberon',
  'neptune', 'triton', 'pluto', 'charon', 'ceres', 'vesta', 'pallas', 'hygiea', 'interamnia', 'eunomia', 'juno', 'psyche', 'eros', 'ida', 'apophis', 'bennu', 'ryugu', 'hektor', 'chiron', 'oumuamua', 'haumea', 'makemake', 'eris',
  'orcus', 'quaoar', 'sedna', 'gonggong', 'halley', 'halebopp', '67p', 'tempel1', 'swifttuttle', 'borisov',
  'amalthea', 'himalia', 'mimas', 'tethys', 'dione', 'hyperion', 'phoebe', 'ariel', 'umbriel', 'proteus', 'nereid'];

test('every real body we promised has an entity that is real, with facts and a link out', () => {
  const m = byId();
  for (const id of REAL) { const e = m.get(id); expect(e, id).toBeDefined(); expect(e!.real, id).toBe(true); expect(e!.facts.length, id).toBeGreaterThanOrEqual(4); expect(e!.links.length, id).toBeGreaterThan(0); }
});

test('every real entity is an object in the game, and its game kind agrees', () => {
  const game = new Map(SOL.bodies.map((b) => [b.id, b]));
  for (const e of file().entities.filter((x) => x.real)) {
    const b = game.get(e.id);
    expect(b, `${e.id} is not in Sol`).toBeDefined();
    const ok = e.kind === b!.kind || (e.kind === 'dwarf' && b!.kind === 'dwarf') || (b!.kind === 'asteroid' && e.kind === 'asteroid') || (e.kind === 'star' && b!.kind === 'star');
    expect(ok, `${e.id}: ${e.kind} vs ${b!.kind}`).toBe(true);
  }
});

test('nothing in the game that is fiction has a real entity; every ship, station and gate is badged Fiction', () => {
  const m = byId();
  for (const b of SOL.bodies) if (['ship', 'station', 'gate', 'artifact'].includes(b.kind)) { expect(m.get(b.id)?.real ?? false, b.id).toBe(false); expect(badgeFor(b, m)?.label, b.id).toBe('Fiction'); }
});

test('badges: real bodies are Real, the story\u2019s things are Fiction, bodies we hold nothing on carry none', () => {
  const m = byId();
  for (const id of ['earth', 'mars', 'ceres', 'phobos', 'halley', 'pluto', 'sun']) expect(badgeFor({ id, kind: 'planet' }, m)?.label, id).toBe('Real');
  expect(badgeFor({ id: 'rocinante', kind: 'ship' }, m)?.label).toBe('Fiction');
  expect(badgeFor({ id: 'tycho', kind: 'station' }, m)?.label).toBe('Fiction');
  expect(badgeFor({ id: 'medina', kind: 'station' }, m)?.label).toBe('Fiction');
  expect(badgeFor({ id: 'gate-1', kind: 'gate' }, m)?.label).toBe('Fiction');
  expect(badgeFor({ id: 'oort', kind: 'dwarf' }, m)).toBeNull();
  expect(badgeFor({ id: 'metis', kind: 'moon' }, m)).toBeNull();
});

test('Tycho and the story\u2019s places say what they are based on, and point at the real thing only where one has a panel', () => {
  const m = byId();
  expect(badgeFor({ id: 'tycho', kind: 'station' }, m)?.basedOn).toContain('O\u2019Neill');
  expect(badgeFor({ id: 'interior:ceres', kind: 'station' }, m)?.basedOn).toContain('Ceres');
  for (const e of file().entities.filter((x) => !x.real)) {
    expect(e.basedOn, e.id).toBeTruthy(); expect(e.facts, e.id).toEqual([]); expect(BASED_ON[e.id] ?? e.basedOn, e.id).toBeTruthy();
    if (e.basedOnId) expect(m.get(e.basedOnId)?.real, e.id).toBe(true);
  }
  expect(m.get('interior:ceres')!.basedOnId).toBe('ceres');
  expect(m.get('interior:ganymede')!.basedOnId).toBe('ganymede');
  expect(m.get('tycho')!.basedOnId).toBeUndefined(); // no real habitat exists to link to
});

test('a fiction entity cannot carry facts, and a link target must be real', () => {
  const f = file(); const t = f.entities.find((e) => e.id === 'tycho')!; t.facts.push(f.entities[0].facts[0]);
  expect(validateFacts(f).join()).toContain('may not carry facts');
  const g = file(); g.entities.find((e) => e.id === 'interior:ceres')!.basedOnId = 'tycho';
  expect(validateFacts(g).join()).toContain('not a real entity');
});

test('numbers come from the cached pages: spot checks', () => {
  const m = byId(); const d = (id: string, f: string) => m.get(id)!.facts.find((x) => x.id === f)!.display;
  expect(d('ceres', 'diameter')).toBe('939.4 km');
  expect(d('phobos', 'distance')).toBe('9,378 km');
  expect(d('pluto', 'discovered')).toContain('1930');
  expect(d('venus', 'rotation')).toContain('retrograde');
  expect(d('ganymede', 'radius-mean')).toBe('2,631.2 km');
  expect(d('triton', 'period')).toContain('5.88');
  expect(d('eros', 'extent')).toBe('34.4 × 11.2 × 11.2 km');
  expect(d('oumuamua', 'e')).toBe('1.2');
});

test('SBDB gaps are not filled with guesses: Pluto-class bodies without a catalogue diameter show none', () => {
  const m = byId();
  for (const id of ['haumea', 'makemake', 'eris', 'orcus', 'quaoar', 'sedna', 'gonggong', 'oumuamua', 'borisov']) expect(m.get(id)!.facts.some((f) => f.id === 'diameter'), id).toBe(false);
  for (const id of ['haumea', 'makemake', 'eris']) expect(m.get(id)!.unknown.join(' '), id).toContain('no diameter');
});

test('every mission has a launch date taken from a catalogue page, and is listed once', () => {
  for (const e of file().entities) {
    const names = e.missions.map((x) => x.name); expect(new Set(names).size, e.id).toBe(names.length);
    for (const x of e.missions) { expect(x.launch.sourceUrl, `${e.id}/${x.name}`).toContain('nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id='); expect(x.launch.value).toMatch(/^\d{4}-\d{2}-\d{2}$/); }
  }
  expect(byId().get('pallas')!.missions).toEqual([]); // nothing has visited: none is listed
});

test('every date a fact was read matches the cache stamp file', () => {
  const stamps: Record<string, string> = JSON.parse(readFileSync(new URL('./facts-raw/retrieved.json', import.meta.url), 'utf8'));
  const days = new Set(Object.values(stamps));
  for (const e of file().entities) for (const f of [...e.facts, ...e.missions.map((x) => x.launch)]) expect(days.has(f.retrieved), `${e.id}/${f.id}`).toBe(true);
});

test('nothing has been checked by a person yet, and every text is marked AI-assisted', () => {
  for (const e of file().entities) { expect(e.humanReviewed, e.id).toBe(false); expect(e.textBy).toBe('ai-assisted'); }
});

test('no text attributes a statement to the agency', () => {
  for (const e of file().entities) { const t = [e.summary, ...e.know, ...e.unknown, ...e.missions.map((m) => m.what)].join(' '); expect(t, e.id).not.toMatch(/according to NASA|NASA says|NASA states|NASA reports/i); }
});

test('the small moons: numbers read from the satellite sheets, no density guessed where the sheet gives none', () => {
  const m = byId(); const d = (id: string, f: string) => m.get(id)!.facts.find((x) => x.id === f)?.display;
  expect(d('mimas', 'distance')).toBe('185,520 km');
  expect(d('phoebe', 'period')).toContain('548');
  expect(m.get('phoebe')!.facts.find((x) => x.id === 'period')!.label).toContain('retrograde');
  expect(d('phoebe', 'ecc')).toBe('0.164');
  expect(d('himalia', 'ecc')).toBe('0.162');
  expect(d('nereid', 'ecc')).toBe('0.751');
  expect(d('umbriel', 'radius-mean')).toBe('584.7 km');
  for (const id of ['himalia', 'proteus', 'nereid']) expect(d(id, 'density'), id).toBeUndefined();
  for (const id of ['amalthea', 'mimas', 'tethys', 'dione', 'hyperion', 'phoebe', 'ariel', 'umbriel']) expect(d(id, 'density'), id).toBeDefined();
});
