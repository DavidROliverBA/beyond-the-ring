// Builds assets/data/facts.json from the cached source pages in tools/facts-raw/ (BACKLOG E2.2).
//
//   bun tools/build-facts.ts            build from the cache, validate, print what changed
//   bun tools/build-facts.ts --refresh  fetch the source pages again first (the only network use;
//                                       sets each page's retrieved date to today), then build
//
// Sources: NASA NSSDCA planetary and satellite fact sheets (HTML), the NSSDCA Master Catalog (launch dates),
// and the JPL Small-Body Database API (one cached JSON response per small body).
// The game never calls these sites; only this script does, and only with --refresh.
// Exit code 1 if validation fails (a fact without a source, date or licence, a mission page that does not
// name its body, and so on).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  RAW, EARTH_FACTS, MOON_FACTS, EARTH_MISSIONS, MOON_MISSIONS, TEXT, LICENCE, CREDIT, BODY_FACTS, BODY_SHEETS, BODY_MISSIONS, SMALL, sbdbFile, sbdbUrl, sbdbLookup, SBDB_NAME, SBDB_CREDIT,
  type FactSpec, type MissionSpec,
} from './facts-curated';
import { BODY_TEXT, FICTION_TEXT } from './facts-text';
import { applyReviews, readReviews } from './review-lib';
import { validateFacts, type Entity, type Fact, type FactsFile, type Link } from '../src/facts';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW_DIR = `${ROOT}tools/facts-raw/`;
const STAMPS = `${RAW_DIR}retrieved.json`;
const OUT = `${ROOT}assets/data/facts.json`;
const UA = { 'User-Agent': 'Mozilla/5.0 (build-facts; fan project, personal use)' };

if (process.argv.includes('--refresh')) {
  const today = new Date().toISOString().slice(0, 10);
  const stamps: Record<string, string> = existsSync(STAMPS) ? JSON.parse(readFileSync(STAMPS, 'utf8')) : {};
  const jobs = [...Object.values(RAW).map((r) => ({ file: r.file, url: r.url })), ...SMALL.map((s) => ({ file: sbdbFile(s.id), url: sbdbUrl(s.sstr) }))];
  for (const r of jobs) {
    const res = await fetch(r.url, { headers: UA });
    if (!res.ok) { console.error(`fetch failed ${res.status}: ${r.url}`); process.exit(1); }
    writeFileSync(RAW_DIR + r.file, await res.text());
    stamps[r.file] = today;
    console.log(`fetched ${r.file}`);
    await new Promise((ok) => setTimeout(ok, 600)); // one at a time, politely
  }
  writeFileSync(STAMPS, JSON.stringify(Object.fromEntries(Object.entries(stamps).sort()), null, 2) + '\n');
}

const stamps: Record<string, string> = JSON.parse(readFileSync(STAMPS, 'utf8'));
const decode = (s: string) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const textOf = (file: string) => decode(readFileSync(RAW_DIR + file, 'utf8').replace(/<sup>(.*?)<\/sup>/gi, '$1').replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const pages = new Map<string, string>();
const page = (key: string, after?: string) => {
  const f = RAW[key].file;
  if (!pages.has(f)) pages.set(f, textOf(f));
  const t = pages.get(f)!;
  if (!after) return t;
  const i = t.indexOf(after);
  if (i < 0) throw new Error(`'${after}' not found in ${f}; the page layout may have changed`);
  return t.slice(i);
};

const sup = (n: number) => String(n).split('').map((c) => (c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c])).join('');
function show(v: number, fmt: FactSpec['fmt']): string {
  if (fmt === 'sci') { const e = Math.floor(Math.log10(Math.abs(v))); return `${(v / 10 ** e).toPrecision(4).replace(/\.?0+$/, '')} × 10${sup(e)}`; }
  const d = { int: 0, dec1: 1, dec2: 2, dec3: 3 }[fmt];
  return v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}
const updated = (key: string) => page(key).match(/Last Updated: ([^,]+),/)?.[1];

function fact(s: FactSpec): Fact {
  const m = page(s.raw, s.after).match(s.re);
  if (!m) throw new Error(`pattern for ${s.id} found nothing in ${RAW[s.raw].file}${s.after ? ` after '${s.after}'` : ''}; the page layout may have changed`);
  const r = RAW[s.raw];
  const base = { id: s.id, label: s.label, unit: s.unit, sourceName: r.name, sourceUrl: r.url, retrieved: stamps[r.file], licence: LICENCE, credit: CREDIT, note: updated(s.raw) ? `Fact sheet last updated ${updated(s.raw)}` : undefined };
  if (s.text) { const t = s.text(m); return { ...base, value: t.value, display: t.display }; }
  const v = parseFloat(m[1].replace(/,/g, '')) * (s.scale ?? 1);
  if (!Number.isFinite(v)) throw new Error(`pattern for ${s.id} read '${m[1]}', which is not a number`);
  const unitShown = s.unit === 'degrees' ? '°' : s.unit ? ` ${s.unit}` : '';
  return { ...base, value: v, display: `${show(v, s.fmt)}${unitShown}` };
}

function mission(s: MissionSpec) {
  const r = RAW[s.raw];
  const t = page(s.raw);
  const m = t.match(/Launch Date: (\d{4}-\d{2}-\d{2})/);
  if (!m) throw new Error(`no launch date in ${r.file}`);
  for (const w of s.mentions ?? []) if (!new RegExp(`\\b${w}\\b`).test(t)) throw new Error(`mission '${s.name}': its catalogue page ${r.file} does not mention ${w}`);
  const date = new Date(m[1] + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const launch: Fact = { id: 'launch', label: 'Launched', value: m[1], unit: 'date', display: date, sourceName: r.name, sourceUrl: r.url, retrieved: stamps[r.file], licence: LICENCE, credit: CREDIT };
  return { name: s.name, what: s.what, launch };
}

const ENTITY_LICENCE = (l: string) => `Numbers: ${l}. Summary and lists: written for this game, AI-assisted, from the sources linked.`;
const nssdcLink = (key: string): Link => ({ label: RAW[key].name.replace('NASA NSSDCA ', 'NSSDCA '), url: RAW[key].url });

function entity(id: 'earth' | 'luna', facts: FactSpec[], missions: MissionSpec[]): Entity {
  const t = TEXT[id];
  return { id, name: t.name, kind: t.kind, real: true, summary: t.summary, facts: facts.map(fact), know: t.know, unknown: t.unknown,
    missions: missions.map(mission), links: t.links, licence: ENTITY_LICENCE(LICENCE), credit: CREDIT, textBy: 'ai-assisted', humanReviewed: false };
}

function bodyEntity(id: string): Entity {
  const t = BODY_TEXT[id];
  if (!t) throw new Error(`no text written for ${id}`);
  const links = [...(t.links ?? []), ...BODY_SHEETS[id].map(nssdcLink)];
  return { id, name: t.name, kind: t.kind, real: true, summary: t.summary, facts: BODY_FACTS[id].map(fact), know: t.know, unknown: t.unknown,
    missions: (BODY_MISSIONS[id] ?? []).map(mission), links, licence: ENTITY_LICENCE(LICENCE), credit: CREDIT, textBy: 'ai-assisted', humanReviewed: false };
}

// ---- JPL Small-Body Database
const G = 6.6743e-20; // km^3 / (kg s^2), CODATA 2018
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SBDB_LICENCE = 'JPL Small-Body Database data is produced by a NASA centre and, in the absence of a separate data licence, is treated as NASA content (generally not subject to copyright in the United States; NASA media usage guidelines); facts only, no endorsement implied';
const num = (s: string | null | undefined) => (s == null ? NaN : parseFloat(String(s).replace(/,/g, '')));
function fmtNum(v: number): string { return v.toLocaleString('en-GB', { maximumSignificantDigits: 4 }); }

function smallEntity(id: string, sstr: string): Entity {
  const t = BODY_TEXT[id];
  if (!t) throw new Error(`no text written for ${id}`);
  const file = sbdbFile(id);
  const d = JSON.parse(readFileSync(RAW_DIR + file, 'utf8'));
  if (!d.object) throw new Error(`${file}: no object in the response`);
  const phys: Record<string, string> = Object.fromEntries((d.phys_par ?? []).map((p: { name: string; value: string }) => [p.name, p.value]));
  const el: Record<string, string | null> = Object.fromEntries(d.orbit.elements.map((e: { name: string; value: string | null }) => [e.name, e.value]));
  const jd = num(d.orbit.epoch);
  const epoch = new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 10);
  const mk = (fid: string, label: string, value: number | string, unit: string, display: string, note?: string): Fact =>
    ({ id: fid, label, value, unit, display, sourceName: `${SBDB_NAME}: ${d.object.fullname}`, sourceUrl: sbdbUrl(sstr), retrieved: stamps[file], licence: SBDB_LICENCE, credit: SBDB_CREDIT, note });
  const orbitNote = `Orbit solution ${d.object.orbit_id}, epoch ${epoch}${d.object.kind.startsWith('c') ? '; osculating elements, so they shift a little with the date' : ''}`;
  const facts: Fact[] = [];
  facts.push(mk('class', 'Kind of orbit', d.object.orbit_class.name.replace(/\*$/, ''), '', d.object.orbit_class.name.replace(/\*$/, '')));
  const diam = num(phys.diameter);
  if (Number.isFinite(diam)) facts.push(mk('diameter', 'Mean diameter', diam, 'km', `${fmtNum(diam)} km`, 'A volume-equivalent sphere where the body is not round; see the three-axis size below where one is given'));
  if (phys.extent) { const ax = phys.extent.split(/\s*x\s*/i); facts.push(mk('extent', 'Size (three axes)', ax.join(' x '), 'km', `${ax.join(' × ')} km`.replace(/ × (\S+) km$/, ' × $1 km'))); }
  const gm = num(phys.GM);
  if (Number.isFinite(gm) && /\d\.\d|e-|e\+|E/.test(String(phys.GM))) { const mass = gm / G; facts.push(mk('mass', 'Mass', mass, 'kg', show(mass, 'sci') + ' kg', `Worked out from the catalogue’s GM of ${phys.GM} km³/s² divided by G = 6.6743 × 10⁻²⁰ km³/(kg s²)`)); }
  const H = num(phys.H); if (Number.isFinite(H)) facts.push(mk('h', 'Absolute magnitude (H)', H, '', String(phys.H), 'A brightness scale: the lower the number, the brighter the object would be at a standard distance'));
  const alb = num(phys.albedo); if (Number.isFinite(alb)) facts.push(mk('albedo', 'Reflectivity (albedo)', alb, '', String(phys.albedo)));
  const rot = num(phys.rot_per); if (Number.isFinite(rot)) facts.push(mk('rotation', 'Rotation period', rot, 'hours', `${fmtNum(rot)} hours`));
  const a = num(el.a), e = num(el.e), q = num(el.q), inc = num(el.i), per = num(el.per);
  if (e < 1 && Number.isFinite(a)) facts.push(mk('a', 'Mean distance from the Sun', a, 'AU', `${fmtNum(a)} AU`, orbitNote));
  if (Number.isFinite(q)) facts.push(mk('q', 'Closest approach to the Sun', q, 'AU', `${fmtNum(q)} AU`, orbitNote));
  facts.push(mk('e', 'Orbit eccentricity', e, '', String(el.e), e >= 1 ? 'An eccentricity above 1 is an open, one-way path: the object is not bound to the Sun' : orbitNote));
  facts.push(mk('i', 'Orbit tilt', inc, 'degrees', `${fmtNum(inc)}°`, 'Angle to the plane of the planets'));
  if (Number.isFinite(per)) { const y = per / 365.25; facts.push(mk('period', 'Orbit period', per, 'days', y >= 2 ? `${y < 100 ? y.toFixed(1) : Math.round(y).toLocaleString('en-GB')} years` : `${fmtNum(per)} days`, orbitNote)); }
  const dd = d.discovery?.date as string | undefined;
  if (dd) { const [y, mo, day] = dd.split('-'); const iso = `${y}-${String(MONTHS.indexOf(mo) + 1).padStart(2, '0')}-${day}`;
    const when = new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    const who = d.discovery.who as string | null;
    facts.push(mk('discovered', 'Discovered', iso, 'date', who ? `${when} · ${who}` : when)); }
  const links: Link[] = [...(t.links ?? []), { label: 'JPL Small-Body Database: ' + d.object.shortname, url: sbdbLookup(sstr) }];
  return { id, name: t.name, kind: t.kind, real: true, summary: t.summary, facts, know: t.know, unknown: t.unknown, missions: (BODY_MISSIONS[id] ?? []).map(mission), links,
    licence: ENTITY_LICENCE(SBDB_LICENCE), credit: SBDB_CREDIT, textBy: 'ai-assisted', humanReviewed: false };
}

function fictionEntity(f: (typeof FICTION_TEXT)[number]): Entity {
  return { id: f.id, name: f.name, kind: 'station', real: false, basedOn: f.basedOn, basedOnId: f.basedOnId, summary: f.summary, facts: [], know: f.know, unknown: f.unknown, missions: [], links: f.links,
    licence: 'Written for this game, AI-assisted. The place is fiction; the real ideas it resembles are described from the sources linked', credit: 'This project; sources as linked', textBy: 'ai-assisted', humanReviewed: false };
}

// The order in the file: by distance from the Sun, planets with their moons, then the small bodies.
const ORDER = ['sun', 'mercury', 'venus', 'earth', 'luna', 'mars', 'phobos', 'deimos', 'ceres', 'vesta', 'pallas', 'hygiea', 'interamnia', 'eunomia', 'juno', 'psyche', 'eros', 'ida', 'apophis', 'bennu', 'ryugu', 'hektor',
  'jupiter', 'amalthea', 'io', 'europa', 'ganymede', 'callisto', 'himalia', 'saturn', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'hyperion', 'iapetus', 'phoebe', 'chiron', 'uranus', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'neptune', 'proteus', 'triton', 'nereid', 'pluto', 'charon',
  'haumea', 'makemake', 'eris', 'orcus', 'quaoar', 'sedna', 'gonggong', 'halley', 'halebopp', '67p', 'tempel1', 'swifttuttle', 'oumuamua', 'borisov'];
const built = new Map<string, Entity>();
built.set('earth', entity('earth', EARTH_FACTS, EARTH_MISSIONS));
built.set('luna', entity('luna', MOON_FACTS, MOON_MISSIONS));
for (const id of Object.keys(BODY_FACTS)) built.set(id, bodyEntity(id));
for (const s of SMALL) built.set(s.id, smallEntity(s.id, s.sstr));
const missing = ORDER.filter((id) => !built.has(id)), extra = [...built.keys()].filter((id) => !ORDER.includes(id));
if (missing.length || extra.length) { console.error(`order mismatch: missing ${missing}, extra ${extra}`); process.exit(1); }
const entities = [...ORDER.map((id) => built.get(id)!), ...FICTION_TEXT.map(fictionEntity)];
// Person reviews (E2.5.c) recorded by tools/review-facts.ts are applied only while what was checked is unchanged.
const reviewed = applyReviews(entities, readReviews(`${ROOT}tools/facts-reviews.json`));
for (const id of reviewed.stale) console.warn(`review of '${id}' is out of date (its words or numbers changed), so it is unchecked again; run tools/review-facts.ts --approve ${id} after checking it`);
for (const id of reviewed.unknown) console.warn(`tools/facts-reviews.json has a review for '${id}', which is not an entity`);
const file: FactsFile = { version: 1, generated: Object.values(stamps).sort().pop()!, entities };

const errs = validateFacts(file);
if (errs.length) { console.error('Validation failed:\n' + errs.map((e) => '  ' + e).join('\n')); process.exit(1); }

// What changed since the last build.
const flat = (f: FactsFile) => new Map(f.entities.flatMap((e) => [...e.facts.map((x) => [`${e.id}/${x.id}`, x.display] as const), ...e.missions.map((x) => [`${e.id}/mission:${x.name}`, x.launch.display] as const)]));
if (existsSync(OUT)) {
  const before = flat(JSON.parse(readFileSync(OUT, 'utf8'))), after = flat(file);
  let n = 0;
  for (const [k, v] of after) if (!before.has(k)) { console.log(`+ ${k}: ${v}`); n++; } else if (before.get(k) !== v) { console.log(`~ ${k}: ${before.get(k)} -> ${v}`); n++; }
  for (const k of before.keys()) if (!after.has(k)) { console.log(`- ${k}`); n++; }
  if (!n) console.log('No fact changed.');
}
writeFileSync(OUT, JSON.stringify(file, null, 2) + '\n');
console.log(`Wrote ${OUT.replace(ROOT, '')}: ${entities.length} entities, ${entities.reduce((a, e) => a + e.facts.length + e.missions.length, 0)} facts, valid.`);
