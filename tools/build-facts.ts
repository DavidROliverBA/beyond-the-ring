// Builds assets/data/facts.json from the cached source pages in tools/facts-raw/ (BACKLOG E2.2).
//
//   bun tools/build-facts.ts            build from the cache, validate, print what changed
//   bun tools/build-facts.ts --refresh  fetch the source pages again first (the only network use;
//                                       sets each page's retrieved date to today), then build
//
// The game never calls these sites; only this script does, and only with --refresh.
// Exit code 1 if validation fails (a fact without a source, date or licence, and so on).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { RAW, EARTH_FACTS, MOON_FACTS, EARTH_MISSIONS, MOON_MISSIONS, TEXT, LICENCE, CREDIT, type FactSpec, type MissionSpec } from './facts-curated';
import { validateFacts, type Entity, type Fact, type FactsFile } from '../src/facts';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW_DIR = `${ROOT}tools/facts-raw/`;
const STAMPS = `${RAW_DIR}retrieved.json`;
const OUT = `${ROOT}assets/data/facts.json`;

if (process.argv.includes('--refresh')) {
  const today = new Date().toISOString().slice(0, 10);
  const stamps: Record<string, string> = existsSync(STAMPS) ? JSON.parse(readFileSync(STAMPS, 'utf8')) : {};
  for (const r of Object.values(RAW)) {
    const res = await fetch(r.url, { headers: { 'User-Agent': 'Mozilla/5.0 (build-facts; fan project, personal use)' } });
    if (!res.ok) { console.error(`fetch failed ${res.status}: ${r.url}`); process.exit(1); }
    writeFileSync(RAW_DIR + r.file, await res.text());
    stamps[r.file] = today;
    console.log(`fetched ${r.file}`);
  }
  writeFileSync(STAMPS, JSON.stringify(stamps, null, 2) + '\n');
}

const stamps: Record<string, string> = JSON.parse(readFileSync(STAMPS, 'utf8'));
const decode = (s: string) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const textOf = (file: string) => decode(readFileSync(RAW_DIR + file, 'utf8').replace(/<sup>(.*?)<\/sup>/gi, '$1').replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
const pages = new Map<string, string>();
const page = (key: string) => { const f = RAW[key].file; if (!pages.has(f)) pages.set(f, textOf(f)); return pages.get(f)!; };

const sup = (n: number) => String(n).split('').map((c) => (c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c])).join('');
function show(v: number, fmt: FactSpec['fmt']): string {
  if (fmt === 'sci') { const e = Math.floor(Math.log10(Math.abs(v))); return `${(v / 10 ** e).toPrecision(4).replace(/\.?0+$/, '')} × 10${sup(e)}`; }
  const d = { int: 0, dec1: 1, dec2: 2, dec3: 3 }[fmt];
  return v.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
}
const updated = (key: string) => page(key).match(/Last Updated: ([^,]+),/)?.[1];

function fact(s: FactSpec): Fact {
  const m = page(s.raw).match(s.re);
  if (!m) throw new Error(`pattern for ${s.id} found nothing in ${RAW[s.raw].file}; the page layout may have changed`);
  const r = RAW[s.raw];
  const base = { id: s.id, label: s.label, unit: s.unit, sourceName: r.name, sourceUrl: r.url, retrieved: stamps[r.file], licence: LICENCE, credit: CREDIT, note: updated(s.raw) ? `Fact sheet last updated ${updated(s.raw)}` : undefined };
  if (s.text) { const t = s.text(m); return { ...base, value: t.value, display: t.display }; }
  const v = parseFloat(m[1].replace(/,/g, '')) * (s.scale ?? 1);
  const unitShown = s.unit === 'degrees' ? '°' : s.unit ? ` ${s.unit}` : '';
  return { ...base, value: v, display: `${show(v, s.fmt)}${unitShown}` };
}

function mission(s: MissionSpec) {
  const r = RAW[s.raw];
  const m = page(s.raw).match(/Launch Date: (\d{4}-\d{2}-\d{2})/);
  if (!m) throw new Error(`no launch date in ${r.file}`);
  const date = new Date(m[1] + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const launch: Fact = { id: 'launch', label: 'Launched', value: m[1], unit: 'date', display: date, sourceName: r.name, sourceUrl: r.url, retrieved: stamps[r.file], licence: LICENCE, credit: CREDIT };
  return { name: s.name, what: s.what, launch };
}

function entity(id: 'earth' | 'luna', facts: FactSpec[], missions: MissionSpec[]): Entity {
  const t = TEXT[id];
  return { id, name: t.name, kind: t.kind, real: true, summary: t.summary, facts: facts.map(fact), know: t.know, unknown: t.unknown,
    missions: missions.map(mission), links: t.links, licence: `Numbers: ${LICENCE}. Summary and lists: written for this game, AI-assisted, from the sources linked.`, credit: CREDIT,
    textBy: 'ai-assisted', humanReviewed: false };
}

const entities = [entity('earth', EARTH_FACTS, EARTH_MISSIONS), entity('luna', MOON_FACTS, MOON_MISSIONS)];
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
