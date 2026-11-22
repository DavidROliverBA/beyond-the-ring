// The info panel (BACKLOG E2.3): opened with I, or from the aim card, for things we hold facts about.
// Facts and links only, written into the page from assets/data/facts.json at build time. Nothing here
// calls a third party; the links out are plain links a person chooses to click.
import data from '../assets/data/facts.json';
import { badgeFor, validateFacts, type Badge, type Entity, type FactsFile } from './facts';

const file = data as unknown as FactsFile;
const problems = validateFacts(file);
if (problems.length) console.warn('facts.json is invalid, so no info panels:\n' + problems.join('\n'));
export const entities: ReadonlyMap<string, Entity> = new Map(problems.length ? [] : file.entities.map((e) => [e.id, e]));

export const badge = (thing: { id: string; kind: string }): Badge => badgeFor(thing, entities);
export const entityFor = (thing: { id: string } | null | undefined): Entity | undefined => (thing ? entities.get(thing.id) : undefined);

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function link(label: string, url: string): HTMLAnchorElement {
  const a = el('a', undefined, label);
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  return a;
}
function section(title: string): [HTMLElement, HTMLElement] {
  const s = el('section'); s.append(el('h3', undefined, title)); return [s, s];
}

/** On a phone the panel is short, so the longer lists start folded; a tap on the heading opens them. */
const small = () => matchMedia('(max-width: 700px)').matches;
function fold(title: string): [HTMLElement, HTMLElement] {
  const d = el('details'); d.open = !small();
  d.append(el('summary', undefined, title));
  return [d, d];
}

const root = () => document.getElementById('info')!;
let current: Entity | null = null;
let opener: HTMLElement | null = null; // what had focus before, so it gets it back
let cameFrom: Entity | null = null; // the story place the reader followed a 'based on' link from
let sourcesOpen = false;            // the 'Data and sources' view (E2.5.b) is showing instead of an entity
export const isOpen = () => current !== null || sourcesOpen;
const CREDITS_URL = 'https://github.com/DavidROliverBA/beyond-the-ring/blob/main/CREDITS.md';

export function open(e: Entity, from: Entity | null = null) {
  current = e; sourcesOpen = false;
  cameFrom = from;
  const p = root();
  p.replaceChildren();
  const head = el('header');
  head.append(el('h2', undefined, e.name), el('span', `badge ${e.real ? 'real' : 'fiction'}`, e.real ? 'Real' : 'Fiction'));
  const x = el('button', 'info-x', '×'); x.type = 'button'; x.title = 'Close (I)'; x.setAttribute('aria-label', 'Close');
  x.addEventListener('click', close);
  head.append(x);
  if (cameFrom) { const b = el('p', 'back'); const a = el('a', undefined, `\u2190 back to ${cameFrom.name}`); const f = cameFrom; a.tabIndex = 0; a.setAttribute('role', 'button'); a.addEventListener('click', () => open(f)); a.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') open(f); }); b.append(a); p.append(b); }
  p.append(head, el('div', 'ai', e.real ? 'AI-assisted summary, sources below' : 'AI-assisted note about a made-up place'), el('p', 'summary', e.summary));
  if (e.basedOn) {
    const b = el('p', 'based', `Based on ${e.basedOn}`);
    const real = e.basedOnId ? entities.get(e.basedOnId) : undefined;
    if (real) { b.append(' \u00b7 '); const a = el('a', undefined, `see the real ${real.name}`); a.tabIndex = 0; a.setAttribute('role', 'button'); a.addEventListener('click', () => open(real, e)); a.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') open(real, e); }); b.append(a); }
    p.append(b);
  }

  if (e.facts.length) {
    const [kn] = section('Key numbers');
    const dl = el('dl');
    for (const f of e.facts) { dl.append(el('dt', undefined, f.label), el('dd', undefined, f.display)); }
    kn.append(dl); p.append(kn);
  }

  const list = (title: string, items: string[], folded = false) => { const [s] = folded ? fold(title) : section(title); const ul = el('ul'); for (const t of items) ul.append(el('li', undefined, t)); s.append(ul); p.append(s); };
  list(e.real ? 'What we know' : 'What is real about it', e.know);
  list(e.real ? 'What we do not know' : 'What is made up', e.unknown, true);

  if (e.missions.length) {
    const [s] = fold('Missions that visited');
    const ul = el('ul', 'missions');
    for (const m of e.missions) { const li = el('li'); li.append(el('b', undefined, m.name), el('span', 'when', ` · launched ${m.launch.display}`), el('div', undefined, m.what)); ul.append(li); }
    s.append(ul); p.append(s);
  }

  if (e.links.length) {
    const [ls] = fold('Links');
    const ul = el('ul', 'links');
    for (const l of e.links) { const li = el('li'); li.append(link(l.label, l.url)); ul.append(li); }
    ls.append(ul); p.append(ls);
  }

  // Every distinct source behind the numbers above, with the day we read it. Folded shut on a phone, where the panel is short.
  const seen = new Map<string, string>();
  for (const f of [...e.facts, ...e.missions.map((m) => m.launch)]) seen.set(f.sourceUrl, `${f.sourceName}, read ${f.retrieved}`);
  const foot: HTMLElement[] = [el('p', 'small', `Credit: ${e.credit}. ${e.licence}.`), el('p', 'small', e.humanReviewed ? `Checked by a person: ${e.review!.by}, ${e.review!.date}. ${e.review!.note}` : 'Not yet checked by a person.')];
  if (seen.size) {
    const [d] = fold(`Sources (${seen.size})`);
    const sl = el('ul', 'links');
    for (const [url, text] of seen) { const li = el('li'); li.append(link(text, url)); sl.append(li); }
    d.append(sl, ...foot); p.append(d);
  } else { const [ss] = section(e.real ? 'Sources' : 'Credit'); ss.append(...foot); p.append(ss); }
  const ds = el('p', 'small'); const dl2 = el('a', undefined, 'Data and sources'); dl2.addEventListener('click', () => openSources(e)); ds.append(dl2, ' \u00b7 how this data was gathered and who it comes from'); p.append(ds);
  p.append(el('p', 'small keyhint', 'I, Esc or × closes. Tab moves along the links.'));

  p.scrollTop = 0;
  if (!document.body.classList.contains('info-open')) opener = document.activeElement as HTMLElement | null;
  document.body.classList.add('info-open');
  x.focus({ preventScroll: true });
}

/** Where the facts come from, worked out from the facts themselves so it can never drift from the data. */
export function sourceSummary(f: FactsFile = file) {
  const fam = new Map<string, { name: string; url: string; facts: number; first: string; last: string }>();
  const root: Record<string, string> = { 'NASA NSSDCA planetary and satellite fact sheets': 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/', 'NASA NSSDCA Master Catalog': 'https://nssdc.gsfc.nasa.gov/nmc/', 'NASA/JPL Small-Body Database (SBDB) API': 'https://ssd-api.jpl.nasa.gov/doc/sbdb.html' };
  for (const e of f.entities) for (const x of [...e.facts, ...e.missions.map((m) => m.launch)]) {
    const name = /Fact Sheet$/.test(x.sourceName) ? 'NASA NSSDCA planetary and satellite fact sheets' : x.sourceName.split(':')[0];
    const cur = fam.get(name) ?? { name, url: root[name] ?? x.sourceUrl, facts: 0, first: x.retrieved, last: x.retrieved };
    cur.facts++; if (x.retrieved < cur.first) cur.first = x.retrieved; if (x.retrieved > cur.last) cur.last = x.retrieved;
    fam.set(name, cur);
  }
  const real = f.entities.filter((e) => e.real);
  return { sources: [...fam.values()].sort((a, b) => b.facts - a.facts), real: real.length, fiction: f.entities.length - real.length, reviewed: f.entities.filter((e) => e.humanReviewed).length, total: f.entities.length,
    licence: f.entities.find((e) => e.real)?.facts[0]?.licence ?? '' };
}

/** The 'Data and sources' text (E2.5.b), shared by the panel and the start screen. */
function sourcesView(): HTMLElement[] {
  const sum = sourceSummary();
  const out: HTMLElement[] = [
    el('p', 'summary', `The facts about ${sum.real} real bodies, and the notes on ${sum.fiction} places from the story, were built from public NASA pages and databases and are bundled with the game. It never contacts them while you play.`),
    el('div', 'ai', 'Summaries and the know / do-not-know lists are written in our own words with AI help; they are not statements by NASA')];
  const [ss] = section('Where the numbers come from');
  const ul = el('ul', 'links');
  for (const s of sum.sources) { const li = el('li'); li.append(link(s.name, s.url), el('span', 'when', ` \u00b7 ${s.facts} facts \u00b7 read ${s.first === s.last ? s.first : `${s.first} to ${s.last}`}`)); ul.append(li); }
  ss.append(ul); out.push(ss);
  const [cs] = section('Checking');
  cs.append(el('p', undefined, sum.reviewed === 0 ? `None of the ${sum.total} entries has been checked by a person yet. Each panel says so.` : `${sum.reviewed} of ${sum.total} entries have been checked by a person; each panel says which.`));
  out.push(cs);
  const [ls] = section('Licence');
  ls.append(el('p', undefined, `${sum.licence}.`)); out.push(ls);
  const f = el('p', 'small'); f.append(link('Full credits and licences (CREDITS.md)', CREDITS_URL)); out.push(f);
  return out;
}

/** 'Data and sources' in the same panel, reached from the foot of any entity panel. */
export function openSources(from: Entity | null = null) {
  current = null; sourcesOpen = true; cameFrom = null;
  const p = root();
  p.replaceChildren();
  const head = el('header');
  head.append(el('h2', undefined, 'Data and sources'));
  const x = el('button', 'info-x', '×'); x.type = 'button'; x.title = 'Close (I)'; x.setAttribute('aria-label', 'Close');
  x.addEventListener('click', close); head.append(x);
  if (from) { const b = el('p', 'back'); const a = el('a', undefined, `\u2190 back to ${from.name}`); a.addEventListener('click', () => open(from)); b.append(a); p.append(b); }
  p.append(head, ...sourcesView(), el('p', 'small keyhint', 'I or × closes. Esc frees the mouse so you can click a link.'));
  p.scrollTop = 0;
  document.body.classList.add('info-open');
}

// The start screen carries a link to the same account, so the credit is visible before play begins. The panel
// lives in the HUD, which is hidden until launch, so there the account opens inside the start box instead.
document.getElementById('data-sources')?.addEventListener('click', (ev) => {
  ev.preventDefault();
  const box = document.getElementById('start-sources') ?? (() => { const d = el('div', 'start-sources'); d.id = 'start-sources'; d.hidden = true; d.append(...sourcesView()); (ev.target as HTMLElement).closest('small')!.after(d); return d; })();
  box.hidden = !box.hidden;
});

export function close() {
  const had = current !== null;
  current = null; sourcesOpen = false;
  document.body.classList.remove('info-open');
  if (had) { if (opener && document.contains(opener) && opener !== document.body) opener.focus({ preventScroll: true }); else if (root().contains(document.activeElement)) (document.activeElement as HTMLElement).blur(); }
  opener = null;
}
