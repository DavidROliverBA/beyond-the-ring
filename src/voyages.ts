// The voyages (T): guided flights that carry the camera from place to place, with a word about each.
// "Quick look" is the old tour of the system you are in. The others fly across Sol, and through the Ring
// and the gates to other suns; each ends back where it began, and any key hands the ship back.

import { look, gateShot, type Shot, type ShotStyle, type Voyage } from './tour';

const SOL_ONLY = ['sol'];
/** How each place is staged, for variety: reveals out of the star's glare for the big worlds, low skims over rocks and moons,
 *  side-on tracking for ships, a pull back from a detail for small things. The rest sweep round the lit side. */
const STYLE: Record<string, ShotStyle> = {
  mercury: 'skim', venus: 'reveal', earth: 'reveal', luna: 'pull', phobos: 'skim', deimos: 'pull',
  vesta: 'skim', pallas: 'pull', tycho: 'pull', jupiter: 'reveal', io: 'skim', europa: 'pull', callisto: 'skim',
  saturn: 'reveal', enceladus: 'pull', titan: 'skim', neptune: 'reveal', triton: 'skim', pluto: 'pull',
  molinari: 'track', razorback: 'track', canterbury: 'track', anubis: 'track', donnager: 'track', agathaking: 'track', thomasprince: 'track', medina: 'pull',
  eros: 'pull', psyche: 'skim', ida: 'pull', haumea: 'skim', eris: 'pull',
};
const flight = (id: string, caption: string, secs = 8, side = 1): Shot => look(id, secs, 8, caption, side, STYLE[id] ?? 'sweep');

export const VOYAGES: Voyage[] = [
  {
    id: 'quick', name: 'Quick look', from: [],
    blurb: 'The sights of the system you are in, one after another.', stages: [],
  },
  {
    id: 'inner', name: 'The inner system', from: SOL_ONLY,
    blurb: 'From the Sun out through Mercury, Venus, Earth and Luna to Mars and its moons.',
    stages: [{ space: 'sol', shots: [
      { id: 'sun', from: [9, 0.3, 0.15], to: [6, -0.2, 0.05], secs: 9, travel: 8, caption: 'Sol. Everything else here is borrowed light.' },
      flight('mercury', 'Mercury: a day longer than its year, and the cheapest real estate in the system, if you can stand the heat.'),
      flight('venus', 'Venus. Sulphuric clouds, and a place the protomolecule once took for itself.', 8, -1),
      flight('earth', 'Earth: thirty billion people, most of them on Basic.', 10),
      flight('luna', 'Luna, the oldest colony, and the first to want something other than what Earth wanted.', 8, -1),
      flight('mars', 'Mars. Four million people hammering at a sky they mean to make breathable.', 10),
      flight('phobos', 'Phobos, close enough to Mars to see its storms, and to fall on it one day.', 7, -1),
      flight('deimos', 'Deimos, and then the long road out.', 7),
    ] }],
  },
  {
    id: 'belt', name: 'The Belt and the giants', from: SOL_ONLY,
    blurb: 'Ceres, Tycho and the rocks of the Belt, then Jupiter and the moons that feed the outer system.',
    stages: [{ space: 'sol', shots: [
      flight('ceres', 'Ceres: the spinning heart of the Belt, and the people who were born without a planet.', 9),
      flight('vesta', 'Vesta. Rock, ice and sunlight: someone owns all of it.', 7, -1),
      flight('pallas', 'Pallas, where the Belt is thin and the stations are few.', 7),
      flight('tycho', 'Tycho Station, where the Belt builds the ships it will not be allowed to keep.', 9, -1),
      flight('jupiter', 'Jupiter, king of the planets. Its radiation belts kill the careless.', 11),
      flight('io', 'Io: sulphur and fire, and the tide that never lets it cool.', 7, -1),
      flight('europa', 'Europa, ice over an ocean that someone is always about to drill.', 8),
      flight('ganymede', 'Ganymede: the breadbasket of the outer planets.', 9, -1),
      flight('callisto', 'Callisto, quiet, cratered and a long way from anyone.', 7),
    ] }],
  },
  {
    id: 'outer', name: 'To the edge of Sol', from: SOL_ONLY,
    blurb: 'Saturn and its rings, Titan, Uranus, Neptune, Pluto, and the Ring beyond them all.',
    stages: [{ space: 'sol', shots: [
      flight('saturn', 'Saturn, the jewel. Its rings are ice, a few metres thick and a quarter of a million kilometres wide.', 11),
      flight('enceladus', 'Enceladus, and the plumes that give Saturn its rings their fresh snow.', 7, -1),
      flight('titan', 'Titan: a haze-wrapped moon with lakes of methane.', 8),
      flight('uranus', 'Uranus rolls round the Sun on its side.', 10, -1),
      flight('neptune', 'Neptune: deep blue, and windier than anywhere else in Sol.', 10),
      flight('triton', 'Triton, captured, backwards, and slowly falling in.', 7, -1),
      flight('pluto', 'Pluto, and Charon behind it: the Kuiper belt begins here.', 9),
      flight('ring', 'The Ring: a thousand kilometres of something that should not be there.', 12),
    ] }],
  },
  {
    id: 'ships', name: 'Ships and stations', from: SOL_ONLY,
    blurb: 'A look round the fleet: freighters, warships, a racer, a hauler and a stealth ship, then Tycho Station, and Medina in the ring space.',
    stages: [
      { space: 'sol', shots: [
        flight('molinari', 'Guy Molinari: a Belter freighter. Containers lashed in rows, radiators folded out to shed the heat.', 9),
        flight('razorback', 'Razorback: a racer, built round one big drive and not much else.', 8, -1),
        flight('canterbury', 'Canterbury: an ice hauler. Cheap to run, slow to turn, and the reason the outer planets can drink.', 9),
        flight('anubis', 'Anubis, the stealth ship: no lights, a cold drive, and edges set to bounce a radar away.', 8, -1),
        flight('donnager', 'Donnager: a Martian battleship, and a carrier for a brood of corvettes.', 10),
        flight('agathaking', 'Agatha King: Earth\'s dreadnought. Radiator banks on both flanks, a comms mast, heavy guns aft.', 10, -1),
        flight('thomasprince', 'Thomas Prince, sent to the Ring with a delegation aboard.', 9),
        flight('tycho', 'Tycho Station: the yard, two habitat rings turning against each other.', 10, -1),
      ] },
      { space: 'sol', shots: [gateShot('ring', 'And now the way out.', 8)] },
      { space: 'slow', shots: [
        { id: 'station', from: [5.5, 0.9, 0.25], to: [3.6, 0.4, 0.1], secs: 7, travel: 7 },
        flight('medina', 'Medina: a slow drum, four docking arms, fuel spheres and a radiator cross.', 11),
        gateShot('g0', 'And home through the Sol gate.', 6),
      ] },
      { space: 'sol', shots: [flight('ring', 'Home again.', 8)] },
    ],
  },
  {
    id: 'small', name: 'Rocks, comets and dwarfs', from: SOL_ONLY,
    blurb: 'The small worlds: Eros, Psyche, the Trojans, Halley, Hale-Bopp, an interloper from another star, and the dwarf planets at the edge.',
    stages: [{ space: 'sol', shots: [
      flight('eros', 'Eros: thirty-four kilometres of peanut, and one of the first rocks anyone landed on.', 8),
      flight('psyche', 'Psyche: a world\'s iron heart, left lying in the Belt.', 8, -1),
      flight('ida', 'Ida, and the smaller rock that goes round it.', 7),
      flight('hektor', 'Hektor, a Trojan, sixty degrees ahead of Jupiter and in no hurry.', 8, -1),
      flight('halley', 'Halley: the tail points away from the Sun, whichever way the comet is going.', 10),
      flight('halebopp', 'Hale-Bopp. Look back along the tail: gas straight, dust curving.', 10, -1),
      flight('67p', 'Churyumov–Gerasimenko, two lobes and a long fall.', 8),
      flight('chiron', 'Chiron: not quite a comet, not quite a rock.', 8, -1),
      flight('oumuamua', 'ʻOumuamua: from somewhere else, and gone.', 8),
      flight('haumea', 'Haumea, spun into an egg.', 9, -1),
      flight('makemake', 'Makemake, rust-red and cold.', 8),
      flight('eris', 'Eris: heavier than Pluto, and a very long way from the Sun.', 9, -1),
      flight('sedna', 'Sedna, on its way to the cold and dark.', 9),
    ] }],
  },
  {
    id: 'ring', name: 'Through the Ring', from: SOL_ONLY,
    blurb: 'Out to the Ring, through it into the ring space, past the station and Medina, and through the gate to Adro and its green diamond.',
    stages: [
      { space: 'sol', shots: [gateShot('ring', 'Beyond Uranus, a hoop a thousand kilometres across. The way out.', 9)] },
      { space: 'slow', shots: [
        { id: 'station', from: [5.5, 0.9, 0.25], to: [3.6, 0.4, 0.1], secs: 9, travel: 7, caption: 'The Ring Station: where everything stops before it goes on.' },
        flight('medina', 'Medina Station: a slow drum at the hub of thirteen hundred doors.', 10),
        flight('g0', 'Behind it, the way home.', 8, -1),
        gateShot('g412', 'Adro. One gate, one star, one object.', 8),
      ] },
      { space: 'sys:412', shots: 'generic' },
      { space: 'slow', shots: [
        gateShot('g412', 'Back through the gate.', 5, 6, false),
        gateShot('g0', 'And home through the Sol gate.', 8),
      ] },
      { space: 'sol', shots: [flight('ring', 'Home again.', 8)] },
    ],
  },
  {
    id: 'worlds', name: 'The new worlds', from: SOL_ONLY,
    blurb: 'Through the Ring to Ilus, the first world settled past the gates, and Laconia, where something old keeps its platforms in orbit.',
    stages: [
      { space: 'sol', shots: [gateShot('ring', 'Out to the Ring, and through.', 9)] },
      { space: 'slow', shots: [
        { id: 'station', from: [5.5, 0.9, 0.25], to: [3.6, 0.4, 0.1], secs: 7, travel: 7 },
        gateShot('g77', 'Ilus. Also filed as New Terra: lithium in the ground and a sky full of small moons.', 8),
      ] },
      { space: 'sys:77', shots: 'generic' },
      { space: 'slow', shots: [
        gateShot('g77', undefined, 4, 6, false),
        gateShot('g1100', 'Laconia: Earth-like and quiet, with strange platforms left in orbit.', 8),
      ] },
      { space: 'sys:1100', shots: 'generic' },
      { space: 'slow', shots: [
        gateShot('g1100', undefined, 4, 6, false),
        gateShot('g0', 'Home through the Sol gate.', 8),
      ] },
      { space: 'sol', shots: [flight('ring', 'Home again.', 8)] },
    ],
  },
];

// ------------------------------------------------------------------ the chooser

const CSS = `
#voyages { position: fixed; inset: 0; z-index: 21; display: none; align-items: center; justify-content: center; background: rgba(1,4,10,0.55); backdrop-filter: blur(3px); font: 13px/1.45 -apple-system, "Helvetica Neue", sans-serif; color: #cfe3f2; }
body.voyages-open #voyages { display: flex; }
#voyages-box { width: min(560px, 92vw); max-height: 86vh; overflow-y: auto; background: rgba(4,10,20,0.94); border: 1px solid rgba(143,220,255,0.3); border-radius: 5px; padding: 18px 20px 14px; }
#voyages h2 { margin: 0 0 2px; font: 400 13px ui-monospace, Menlo, monospace; letter-spacing: 0.24em; color: #8fdcff; }
#voyages .sub { margin: 0 0 12px; color: #6f8aa0; font: 11px ui-monospace, Menlo, monospace; }
.voy { display: flex; gap: 12px; padding: 9px 10px; border-radius: 4px; cursor: pointer; border: 1px solid transparent; }
.voy:hover, .voy.sel { background: rgba(143,220,255,0.12); border-color: rgba(143,220,255,0.3); }
.voy .k { flex: none; width: 22px; height: 22px; line-height: 22px; text-align: center; border: 1px solid rgba(143,220,255,0.4); border-radius: 3px; color: #8fdcff; font: 11px ui-monospace, Menlo, monospace; }
.voy b { display: block; font-weight: 500; color: #fff; letter-spacing: 0.04em; }
.voy span { color: #9fb6c8; font-size: 12px; }
.voy.off { opacity: 0.35; cursor: default; }
#voyages .foot { margin-top: 10px; color: #6f8aa0; font: 10px ui-monospace, Menlo, monospace; letter-spacing: 0.08em; }
`;

export interface VoyageMenu { open(): void; close(): void; isOpen(): boolean }

/** The chooser. `can(v)` says which voyages start from where you are; `go` begins one. */
export function createVoyageMenu(can: (v: Voyage) => boolean, go: (v: Voyage) => void, ok: () => boolean): VoyageMenu {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const root = document.createElement('div');
  root.id = 'voyages';
  root.innerHTML = '<div id="voyages-box"><h2>VOYAGES</h2><p class="sub">Choose one; any key hands the ship back.</p><div id="voy-list"></div><div class="foot">1–8 or click · Enter starts the highlighted one · T or Esc closes</div></div>';
  document.body.append(root);
  const listEl = root.querySelector('#voy-list') as HTMLElement;
  let isOpen = false, sel = 0;

  function fill() {
    listEl.innerHTML = '';
    VOYAGES.forEach((v, n) => {
      const row = document.createElement('div');
      const on = can(v);
      row.className = 'voy' + (n === sel ? ' sel' : '') + (on ? '' : ' off');
      row.innerHTML = `<div class="k">${n + 1}</div><div><b></b><span></span></div>`;
      (row.querySelector('b') as HTMLElement).textContent = v.name;
      (row.querySelector('span') as HTMLElement).textContent = on ? v.blurb : `${v.blurb} (from Sol)`;
      row.onclick = () => { if (on) pick(n); };
      row.onmouseenter = () => { sel = n; listEl.querySelectorAll('.voy').forEach((r, m) => r.classList.toggle('sel', m === n)); };
      listEl.append(row);
    });
  }
  function pick(n: number) {
    const v = VOYAGES[n];
    if (!v || !can(v)) return;
    close();
    go(v);
  }
  function open() {
    if (isOpen || !ok()) return;
    document.exitPointerLock();
    sel = Math.max(0, VOYAGES.findIndex(can) === -1 ? 0 : sel);
    fill();
    isOpen = true;
    document.body.classList.add('voyages-open');
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    document.body.classList.remove('voyages-open');
  }
  addEventListener('keydown', (e) => {
    if (!isOpen) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === 'Escape' || e.code === 'KeyT') close();
    else if (e.code === 'Enter') pick(sel);
    else if (e.code === 'ArrowDown') { sel = (sel + 1) % VOYAGES.length; fill(); }
    else if (e.code === 'ArrowUp') { sel = (sel + VOYAGES.length - 1) % VOYAGES.length; fill(); }
    else if (/^Digit[1-9]$/.test(e.code)) pick(Number(e.code.slice(5)) - 1);
  }, true);
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
  return { open, close, isOpen: () => isOpen };
}
