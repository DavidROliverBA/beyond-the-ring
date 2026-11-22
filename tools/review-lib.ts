// The person-review flow for the facts (BACKLOG E2.5.c): shared by tools/review-facts.ts and tools/build-facts.ts.
//
// A review is a record in tools/facts-reviews.json: who checked an entity, a note, the day, and a fingerprint of what
// they checked (the words, the numbers, the missions and the links). build-facts copies a review into facts.json only
// while the fingerprint still matches, so if the text or a number changes later the entity goes back to unchecked.
// Nothing here approves anything by itself: a review exists only because a person ran `--approve <id>` with their name and a note.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Entity, FactsFile, Review } from '../src/facts';

export interface ReviewRecord extends Review { hash: string }
export interface ReviewsFile { version: 1; reviews: Record<string, ReviewRecord> }

/** A fingerprint of everything a reviewer reads. Dates retrieved are left out, so re-reading a page does not undo a review. */
export function contentHash(e: Entity): string {
  const body = {
    id: e.id, name: e.name, kind: e.kind, real: e.real, basedOn: e.basedOn ?? null, summary: e.summary, know: e.know, unknown: e.unknown,
    facts: e.facts.map((f) => [f.id, f.label, f.value, f.unit, f.display, f.sourceUrl]),
    missions: e.missions.map((m) => [m.name, m.what, m.launch.value, m.launch.sourceUrl]),
    links: e.links.map((l) => [l.label, l.url]),
  };
  return createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
}

export function readReviews(path: string): ReviewsFile {
  if (!existsSync(path)) return { version: 1, reviews: {} };
  const j = JSON.parse(readFileSync(path, 'utf8')) as ReviewsFile;
  if (j.version !== 1 || typeof j.reviews !== 'object') throw new Error(`${path}: not a reviews file`);
  return j;
}
export function writeReviews(path: string, r: ReviewsFile) {
  const sorted = Object.fromEntries(Object.entries(r.reviews).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(path, JSON.stringify({ version: 1, reviews: sorted }, null, 2) + '\n');
}

/** Mark each entity that has a current review as checked; return what was applied and what has gone stale or points nowhere. */
export function applyReviews(entities: Entity[], r: ReviewsFile): { applied: string[]; stale: string[]; unknown: string[] } {
  const out = { applied: [] as string[], stale: [] as string[], unknown: [] as string[] };
  const byId = new Map(entities.map((e) => [e.id, e]));
  for (const [id, rec] of Object.entries(r.reviews)) {
    const e = byId.get(id);
    if (!e) { out.unknown.push(id); continue; }
    if (rec.hash !== contentHash(e)) { out.stale.push(id); continue; }
    e.humanReviewed = true; e.review = { by: rec.by, note: rec.note, date: rec.date };
    out.applied.push(id);
  }
  return out;
}

export interface ApproveInput { id: string; by: string; note: string; date: string }
/** Record a person's approval of one entity. Throws unless there is exactly that entity, a reviewer name and a real note. */
export function approve(file: FactsFile, r: ReviewsFile, a: ApproveInput): ReviewsFile {
  const e = file.entities.find((x) => x.id === a.id);
  if (!e) throw new Error(`no entity '${a.id}' in the facts file`);
  if (!a.by.trim()) throw new Error('--by "<your name>" is required: a review records who checked');
  if (a.note.trim().length < 10) throw new Error('--note "<what you checked>" is required (at least a short sentence)');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) throw new Error('bad date');
  return { version: 1, reviews: { ...r.reviews, [a.id]: { by: a.by.trim(), note: a.note.trim(), date: a.date, hash: contentHash(e) } } };
}
