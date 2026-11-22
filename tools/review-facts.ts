// Person review of the facts (BACKLOG E2.5.c). Nothing is ever approved without an explicit --approve <id>.
//
//   bun tools/review-facts.ts                      list every entity not yet checked by a person
//   bun tools/review-facts.ts --show <id>          print one entity: summary, what we know, what we do not know, numbers, missions, sources
//   bun tools/review-facts.ts --show-all           print all of the unchecked ones (long)
//   bun tools/review-facts.ts --approve <id> --by "Your Name" --note "what you checked"
//                                                  record your review of that one entity and rebuild facts.json
//   bun tools/review-facts.ts --revoke <id>        take a review back
//
// A review lives in tools/facts-reviews.json with a fingerprint of what was checked; if the words or numbers change
// later, the next build marks the entity unchecked again. There is no 'approve all' and no default approval.
// --file and --reviews point at other files (the tests use them).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Entity, FactsFile } from '../src/facts';
import { approve, applyReviews, readReviews, writeReviews } from './review-lib';

const ROOT = new URL('..', import.meta.url).pathname;
const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); return i < 0 ? undefined : args[i + 1]; };
const has = (n: string) => args.includes(n);
const FILE = flag('--file') ?? `${ROOT}assets/data/facts.json`;
const REVIEWS = flag('--reviews') ?? `${ROOT}tools/facts-reviews.json`;

const facts = (): FactsFile => JSON.parse(readFileSync(FILE, 'utf8'));

function show(e: Entity) {
  const bar = '='.repeat(78);
  console.log(`\n${bar}\n${e.id}  ${e.name}  [${e.kind}, ${e.real ? 'real' : 'fiction'}]  ${e.humanReviewed ? `checked by ${e.review?.by} on ${e.review?.date}` : 'NOT checked by a person'}\n${bar}`);
  console.log(`\nSummary\n  ${e.summary}`);
  if (e.basedOn) console.log(`\nBased on\n  ${e.basedOn}`);
  if (e.facts.length) { console.log('\nKey numbers (read from the cached source pages)'); for (const f of e.facts) console.log(`  ${f.label}: ${f.display}`); }
  const list = (t: string, xs: string[]) => { console.log(`\n${t}`); for (const x of xs) console.log(`  - ${x}`); };
  list(e.real ? 'What we know' : 'What is real about it', e.know);
  list(e.real ? 'What we do not know' : 'What is made up', e.unknown);
  if (e.missions.length) { console.log('\nMissions'); for (const m of e.missions) console.log(`  - ${m.name} (launched ${m.launch.display}): ${m.what}\n    ${m.launch.sourceUrl}`); }
  const src = new Map<string, string>();
  for (const f of [...e.facts, ...e.missions.map((m) => m.launch)]) src.set(f.sourceUrl, `${f.sourceName}, read ${f.retrieved}`);
  console.log('\nSources behind the numbers'); for (const [u, t] of src) console.log(`  - ${t}\n    ${u}`);
  console.log('\nLinks'); for (const l of e.links) console.log(`  - ${l.label}\n    ${l.url}`);
  console.log(`\nLicence: ${e.licence}\nCredit: ${e.credit}`);
  console.log('\nCheck the words and numbers above against the sources, then run:');
  console.log(`  bun tools/review-facts.ts --approve ${e.id} --by "<your name>" --note "<what you checked>"`);
}

if (has('--approve')) {
  const id = flag('--approve');
  if (!id || id.startsWith('--') || id === 'all') { console.error('--approve needs exactly one entity id (there is no approve-all). Example: --approve mars --by "Your Name" --note "checked numbers against the sheet"'); process.exit(2); }
  try {
    const f = facts();
    const next = approve(f, readReviews(REVIEWS), { id, by: flag('--by') ?? '', note: flag('--note') ?? '', date: new Date().toISOString().slice(0, 10) });
    writeReviews(REVIEWS, next);
    // Apply to the facts file now, so the panel shows it without a full rebuild (a build gives the same result).
    for (const e of f.entities) { e.humanReviewed = false; delete e.review; }
    applyReviews(f.entities, next);
    writeFileSync(FILE, JSON.stringify(f, null, 2) + '\n');
    console.log(`Recorded: ${id} checked by ${next.reviews[id].by} on ${next.reviews[id].date}. ${f.entities.filter((e) => e.humanReviewed).length} of ${f.entities.length} entities are now checked.`);
  } catch (err) { console.error(String((err as Error).message ?? err)); process.exit(2); }
} else if (has('--revoke')) {
  const id = flag('--revoke');
  const r = readReviews(REVIEWS);
  if (!id || !r.reviews[id]) { console.error(`no review recorded for '${id ?? ''}'`); process.exit(2); }
  delete r.reviews[id]; writeReviews(REVIEWS, r);
  const f = facts(); for (const e of f.entities) { e.humanReviewed = false; delete e.review; } applyReviews(f.entities, r);
  writeFileSync(FILE, JSON.stringify(f, null, 2) + '\n');
  console.log(`Review of ${id} taken back.`);
} else if (has('--show') || has('--show-all')) {
  const f = facts();
  if (has('--show-all')) { for (const e of f.entities.filter((x) => !x.humanReviewed)) show(e); }
  else { const e = f.entities.find((x) => x.id === flag('--show')); if (!e) { console.error(`no entity '${flag('--show') ?? ''}'`); process.exit(2); } show(e); }
} else {
  const f = facts(); const todo = f.entities.filter((e) => !e.humanReviewed);
  console.log(`${todo.length} of ${f.entities.length} entities have not been checked by a person.\n`);
  const w = Math.max(...todo.map((e) => e.id.length));
  for (const e of todo) console.log(`  ${e.id.padEnd(w)}  ${e.name.padEnd(28)} ${(e.real ? e.kind : 'fiction').padEnd(9)} ${e.facts.length} numbers, ${e.missions.length} missions`);
  console.log('\n--show <id> to read one, --approve <id> --by "<name>" --note "<what you checked>" to record your review. Nothing is approved automatically.');
  if (existsSync(REVIEWS)) { const r = readReviews(REVIEWS); const n = Object.keys(r.reviews).length; if (n) console.log(`${n} review record(s) in ${REVIEWS.replace(ROOT, '')}.`); }
}
