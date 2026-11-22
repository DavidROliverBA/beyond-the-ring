// The shape of what the game knows about real things (BACKLOG E2.2), plus the checks the build
// script and the tests share. No data lives here: assets/data/facts.json is written by
// tools/build-facts.ts and read by src/infopanel.ts. The game never calls a third party at runtime.

export type EntityKind = 'star' | 'planet' | 'moon' | 'dwarf' | 'asteroid' | 'comet' | 'probe' | 'station' | 'site' | 'ship' | 'artifact' | 'gate';

/** One number or value, with everything needed to say where it came from. */
export interface Fact {
  id: string;            // stable key within the entity, e.g. 'radius-mean'
  label: string;         // what the panel shows, e.g. 'Mean radius'
  value: number | string;
  unit: string;          // 'km', 'kg', 'K', 'days', 'date'... ('' for a pure number)
  display: string;       // the formatted line, made by the build so the game does no maths
  sourceName: string;    // e.g. 'NASA NSSDCA Earth Fact Sheet'
  sourceUrl: string;
  retrieved: string;     // YYYY-MM-DD, the day the cached page was fetched
  licence: string;
  credit: string;
  note?: string;         // e.g. 'Fact sheet last updated 15 November 2024'
}

export interface Link { label: string; url: string }

/** A spacecraft that visited, with a launch date taken from its catalogue entry. */
export interface Mission { name: string; what: string; launch: Fact }

export interface Entity {
  id: string;            // matches the game's own id for the body ('earth', 'luna')
  name: string;
  kind: EntityKind;
  real: boolean;         // false = fiction (badge 'Fiction')
  basedOn?: string;      // for fiction: the real thing it resembles, in a few words (E2.3.c)
  basedOnId?: string;    // for fiction: the id of the real entity whose panel the 'based on' line links to, where one exists
  summary: string;       // one sentence, our own words
  facts: Fact[];         // the key numbers, in the order shown
  know: string[];        // what we know
  unknown: string[];     // what we do not know
  missions: Mission[];
  links: Link[];
  licence: string;       // licence line for the entity as a whole (facts, and our own text)
  credit: string;
  textBy: 'ai-assisted'; // the summary and the lists were drafted with AI help and checked against the sources
  humanReviewed: boolean;// E2.5.c: has a person checked this entity?
  /** Set only with humanReviewed: who checked it, a note, and the day. Written from tools/facts-reviews.json by the build. */
  review?: Review;
}

export interface Review { by: string; note: string; date: string }

export interface FactsFile { version: 1; generated: string; entities: Entity[] }

/** Kinds of thing in the game that are fiction. Everything with these kinds today (the Rocinante and
 *  other ships, Tycho, Medina, the Ring Station, gates, the Adro Diamond) comes from the story. */
export const FICTION_KINDS: ReadonlySet<string> = new Set(['ship', 'station', 'gate', 'artifact']);
/** 'Based on' for fiction that has an honest real analogue (E2.3.c). Kept modest: only where the likeness is real.
 *  The same words are written into the fiction entities in facts.json; this is the fallback for things with no panel. */
export const BASED_ON: Readonly<Record<string, string>> = {
  tycho: 'rotating space-habitat designs such as the O\u2019Neill cylinder and the Stanford torus',
  'interior:tycho': 'rotating space-habitat designs such as the O\u2019Neill cylinder and the Stanford torus',
  'interior:medina': 'rotating space-habitat designs such as the O\u2019Neill cylinder',
  'interior:ceres': 'the real Ceres, the largest object in the asteroid belt',
  'interior:ganymede': 'the real Ganymede, Jupiter\u2019s largest moon',
};

export type Badge = { label: 'Real' | 'Fiction'; basedOn?: string } | null;

export function badgeFor(thing: { id: string; kind: string }, entities: ReadonlyMap<string, Entity>): Badge {
  const e = entities.get(thing.id);
  if (e) return e.real ? { label: 'Real' } : { label: 'Fiction', basedOn: e.basedOn || BASED_ON[thing.id] || undefined };
  if (FICTION_KINDS.has(thing.kind)) return { label: 'Fiction', basedOn: BASED_ON[thing.id] || undefined };
  return null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const URL_OK = /^https:\/\/[^\s]+$/;

function checkFact(f: Fact, where: string, errs: string[]) {
  const need = ['id', 'label', 'display', 'sourceName', 'sourceUrl', 'retrieved', 'licence', 'credit'] as const;
  for (const k of need) if (typeof f[k] !== 'string' || !f[k].trim()) errs.push(`${where}: fact '${f.id ?? '?'}' has no ${k}`);
  if (f.value === undefined || f.value === null || f.value === '' || (typeof f.value === 'number' && !Number.isFinite(f.value))) errs.push(`${where}: fact '${f.id}' has no value`);
  if (typeof f.unit !== 'string') errs.push(`${where}: fact '${f.id}' has no unit field`);
  if (f.sourceUrl && !URL_OK.test(f.sourceUrl)) errs.push(`${where}: fact '${f.id}' has a bad source URL`);
  if (f.retrieved && !DATE.test(f.retrieved)) errs.push(`${where}: fact '${f.id}' has a bad retrieved date`);
}

/** Every problem in the file; empty means it may be used. A fact without a source, a date or a licence fails. */
export function validateFacts(file: FactsFile): string[] {
  const errs: string[] = [];
  if (file.version !== 1) errs.push('unknown version');
  const ids = new Set<string>();
  for (const e of file.entities) {
    const w = `entity '${e.id}'`;
    if (ids.has(e.id)) errs.push(`${w}: duplicate id`);
    ids.add(e.id);
    for (const k of ['name', 'kind', 'summary', 'licence', 'credit'] as const) if (!e[k] || !String(e[k]).trim()) errs.push(`${w}: no ${k}`);
    if (e.humanReviewed && (!e.review?.by?.trim() || !e.review.note?.trim() || !DATE.test(e.review.date ?? ''))) errs.push(`${w}: marked as checked by a person without a reviewer, a note and a date`);
    if (!e.humanReviewed && e.review) errs.push(`${w}: has a review record but is not marked as checked`);
    if (e.textBy !== 'ai-assisted') errs.push(`${w}: textBy must be 'ai-assisted'`);
    if (/\b(according to|NASA says|NASA states|NASA reports)\b/i.test([e.summary, ...e.know, ...e.unknown].join(' '))) errs.push(`${w}: text attributes a statement to the agency`);
    if (!e.real && e.facts.length) errs.push(`${w}: a fiction entity may not carry facts`);
    if (e.basedOnId && e.real) errs.push(`${w}: only fiction has a 'based on' link`);
    if (e.real) {
      if (!e.facts.length) errs.push(`${w}: a real entity with no facts`);
      if (!e.links.length) errs.push(`${w}: no links out`);
    }
    for (const f of e.facts) checkFact(f, w, errs);
    for (const m of e.missions) { if (!m.name || !m.what) errs.push(`${w}: mission without name or text`); checkFact(m.launch, `${w}, mission '${m.name}'`, errs); }
    if (e.basedOnId && !file.entities.some((x) => x.id === e.basedOnId && x.real)) errs.push(`${w}: 'based on' points at '${e.basedOnId}', which is not a real entity here`);
    for (const l of e.links) if (!l.label || !URL_OK.test(l.url)) errs.push(`${w}: bad link '${l.label}'`);
  }
  return errs;
}
