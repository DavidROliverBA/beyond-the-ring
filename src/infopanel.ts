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
let cameFrom: Entity | null = null; // the story place the reader followed a 'based on' link from
export const isOpen = () => current !== null;

export function open(e: Entity, from: Entity | null = null) {
  current = e;
  cameFrom = from;
  const p = root();
  p.replaceChildren();
  const head = el('header');
  head.append(el('h2', undefined, e.name), el('span', `badge ${e.real ? 'real' : 'fiction'}`, e.real ? 'Real' : 'Fiction'));
  const x = el('button', 'info-x', '×'); x.type = 'button'; x.title = 'Close (I)'; x.setAttribute('aria-label', 'Close');
  x.addEventListener('click', close);
  head.append(x);
  if (cameFrom) { const b = el('p', 'back'); const a = el('a', undefined, `\u2190 back to ${cameFrom.name}`); const f = cameFrom; a.addEventListener('click', () => open(f)); b.append(a); p.append(b); }
  p.append(head, el('div', 'ai', e.real ? 'AI-assisted summary, sources below' : 'AI-assisted note about a made-up place'), el('p', 'summary', e.summary));
  if (e.basedOn) {
    const b = el('p', 'based', `Based on ${e.basedOn}`);
    const real = e.basedOnId ? entities.get(e.basedOnId) : undefined;
    if (real) { b.append(' \u00b7 '); const a = el('a', undefined, `see the real ${real.name}`); a.addEventListener('click', () => open(real, e)); b.append(a); }
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
  const foot: HTMLElement[] = [el('p', 'small', `Credit: ${e.credit}. ${e.licence}.`), el('p', 'small', e.humanReviewed ? 'Checked by a person.' : 'Not yet checked by a person.')];
  if (seen.size) {
    const [d] = fold(`Sources (${seen.size})`);
    const sl = el('ul', 'links');
    for (const [url, text] of seen) { const li = el('li'); li.append(link(text, url)); sl.append(li); }
    d.append(sl, ...foot); p.append(d);
  } else { const [ss] = section(e.real ? 'Sources' : 'Credit'); ss.append(...foot); p.append(ss); }
  p.append(el('p', 'small keyhint', 'I or × closes. Esc frees the mouse so you can click a link.'));

  p.scrollTop = 0;
  document.body.classList.add('info-open');
}

export function close() {
  current = null;
  document.body.classList.remove('info-open');
}
