// What is out there: the Sol system by hand, the ring space, and a generator
// for the systems behind every other gate.

import type { ShipModel } from './ships';
import { rng, type Stop, type TexSpec } from './textures';

/** One astronomical unit in scene units. Distances are true to scale; bodies are drawn far larger than life. */
export const AU = 1000;
export const GATE_COUNT = 1373;
export const SLOW_RADIUS = 4000;

export type Kind = 'star' | 'planet' | 'moon' | 'dwarf' | 'asteroid' | 'station' | 'ship' | 'artifact' | 'gate';
export type Model = 'platform' | 'diamond' | 'neutron' | ShipModel;

export interface RingSpec {
  inner: number;
  outer: number;
  palette: Stop[];
  seed: number;
  opacity: number;
  gap?: number;
}

export interface BodySpec {
  id: string;
  name: string;
  kind: Kind;
  sub: string;
  desc: string;
  radius: number;
  parent?: string;
  orbit: number;
  angle: number;
  lift?: number;
  tex?: TexSpec;
  atmo?: string;
  atmoK?: number;
  rings?: RingSpec;
  tilt?: number;
  spin?: number;
  range?: number;
  model?: Model;
  /** Heading of a ship model, radians. */
  yaw?: number;
  /** Id of the interior you can dock at and walk around. */
  dock?: string;
  res?: number;
}

export interface BeltSpec {
  seed: number;
  inner: number;
  outer: number;
  height: number;
  dust: number;
  rocks: number;
  color: string;
  opacity: number;
  dustSize: number;
  size: [number, number];
  shell?: boolean;
  /** Ids of bodies that get a dense knot of rocks around them. */
  clusters?: string[];
}

export interface SystemSpec {
  id: string;
  name: string;
  subtitle: string;
  blurb: string;
  light: string;
  bodies: BodySpec[];
  belts: BeltSpec[];
  gate: { orbit: number; angle: number };
}

const P: Record<string, Stop[]> = {
  sun: [[0, '#c24a05'], [0.45, '#ff9a1f'], [0.8, '#ffd76a'], [1, '#fff6d0']],
  mercury: [[0, '#3d3833'], [0.5, '#8a8078'], [1, '#c9c0b4']],
  venus: [[0, '#b8893f'], [0.5, '#e2c27a'], [1, '#f5e6b8']],
  moon: [[0, '#3a3a3c'], [0.5, '#8d8d8f'], [1, '#d5d3cf']],
  land: [[0, '#3d6b2f'], [0.28, '#5f7f3a'], [0.5, '#a08a55'], [0.78, '#7a6a5a'], [1, '#f0f0f0']],
  mars: [[0, '#5a2a18'], [0.45, '#b5522d'], [0.8, '#d98a55'], [1, '#ecc9a0']],
  dark: [[0, '#221f1c'], [0.5, '#4a443d'], [1, '#857c70']],
  jupiter: [[0, '#7a4a2a'], [0.3, '#c99a6a'], [0.55, '#efe0c4'], [0.75, '#b9793f'], [1, '#f4ead8']],
  saturn: [[0, '#a88a55'], [0.5, '#e3cf9a'], [1, '#f3e7c2']],
  uranus: [[0, '#7fc9cf'], [1, '#b9eef0']],
  neptune: [[0, '#1f3fa8'], [0.6, '#3f6fe0'], [1, '#8fb4ff']],
  io: [[0, '#3a2a10'], [0.3, '#c9a227'], [0.7, '#f0d95a'], [1, '#f7f0c0']],
  europa: [[0, '#b9a98a'], [1, '#f4f1e8']],
  ganymede: [[0, '#4a4338'], [0.5, '#8d8474'], [1, '#d2cdbf']],
  titan: [[0, '#b0701f'], [1, '#e3a84a']],
  ice: [[0, '#8fa3b5'], [0.5, '#cfdbe6'], [1, '#ffffff']],
  pluto: [[0, '#6b4a38'], [0.5, '#c9a98a'], [1, '#f3e9dc']],
  rock: [[0, '#2c2722'], [0.5, '#6b6157'], [1, '#a89c8c']],
  ringCream: [[0, '#8a765a'], [0.5, '#d9c7a0'], [1, '#f6edd6']],
  ringGrey: [[0, '#55606a'], [1, '#aab6c0']],
};

const moonTex = (seed: number, palette: Stop[] = P.moon, scale = 2.5, lights = 0): TexSpec => ({
  style: 'rock', palette, seed, scale, craters: 1, lights,
});

const ship = (
  id: string, name: string, model: ShipModel, sub: string, desc: string,
  parent: string | undefined, orbit: number, angle: number, radius: number, lift = 0, yaw = 0,
): BodySpec => ({ id, name, kind: 'ship', sub, desc, radius, parent, orbit, angle, lift, model, yaw, spin: 0, range: 4000 });

const FAR = Infinity;
/** Generated worlds were drawn with Earth at 4 units; true size puts it at 0.0426. */
const G = 1 / 94;
const MOON_RANGE = 2500;

export const SOL: SystemSpec = {
  id: 'sol',
  name: 'Sol',
  subtitle: 'Earth · Mars · the Belt',
  blurb: 'Home. Three powers, one star, and a ring parked out past Uranus.',
  light: '#fff4e0',
  gate: { orbit: 21.2 * AU, angle: 5.6 },
  bodies: [
    {
      id: 'sun', name: 'The Sun', kind: 'star', sub: 'G-type star', radius: 4.65, orbit: 0, angle: 0, spin: 0.01,
      tex: { style: 'star', palette: P.sun, seed: 1 }, res: 1024,
      desc: 'Sol. Every dome, drive and hydroponics deck in the system runs, one way or another, on this light.',
    },
    {
      id: 'mercury', name: 'Mercury', kind: 'planet', sub: 'Rocky planet · 0.39 AU', radius: 0.01631, orbit: 0.387 * AU, angle: 0.6,
      spin: 0.01, tex: moonTex(11, P.mercury),
      desc: 'Scorched, airless and slow-turning. Mined a little, visited rarely.',
    },
    {
      id: 'venus', name: 'Venus', kind: 'planet', sub: 'Rocky planet · 0.72 AU', radius: 0.04045, orbit: 0.723 * AU, angle: 2.3,
      spin: -0.008, tex: { style: 'gas', palette: P.venus, seed: 12, bands: 3, turb: 0.6 }, atmo: '#f3dca0', res: 768,
      desc: 'Wrapped in sulphuric cloud. Eros was steered into it, and whatever grew beneath the clouds later climbed out and built the Ring.',
    },
    {
      id: 'earth', name: 'Earth', kind: 'planet', sub: 'Rocky planet · 1 AU', radius: 0.04259, orbit: 1 * AU, angle: 4.0,
      tilt: 0.41, spin: 0.03, res: 1024,
      tex: { style: 'terran', palette: P.land, seed: 3, scale: 1.6, sea: 0.56, caps: 0.1, clouds: 0.85, lights: 1 }, atmo: '#5aa8ff', atmoK: 1.3,
      desc: 'Seat of the United Nations and thirty billion people, most of them on Basic. The bottom of the deepest well anyone lives in.',
    },
    {
      id: 'luna', name: 'Luna', kind: 'moon', sub: 'Moon of Earth', radius: 0.01161, parent: 'earth', orbit: 2.57, angle: 0.9,
      spin: 0.01, tex: moonTex(13, P.moon, 2.5, 0.6), range: MOON_RANGE,
      desc: 'Tunnelled cities and shipyards. The first step out of the well, and the place Earthers go to feel what low gravity is.',
    },
    ship('agathaking', 'UNN Agatha King', 'dreadnought', 'Truman-class dreadnought · UN Navy',
      'Slab-sided and heavily armoured: Earth\'s answer to the Martian battleships, and flagship of the UN fleet sent out to Jupiter.',
      'earth', 0.12, 3.4, 2.34e-6, 0.01, 1.2),
    {
      id: 'mars', name: 'Mars', kind: 'planet', sub: 'Rocky planet · 1.52 AU', radius: 0.02266, orbit: 1.524 * AU, angle: 5.2,
      tilt: 0.44, spin: 0.03, res: 768,
      tex: { style: 'rock', palette: P.mars, seed: 14, scale: 1.8, caps: 0.07, craters: 0.5, lights: 0.5 }, atmo: '#e09a66', atmoK: 0.5,
      desc: 'The Martian Congressional Republic: domed cities, a navy that punches above its weight, and a terraforming project measured in generations.',
    },
    {
      id: 'phobos', name: 'Phobos', kind: 'moon', sub: 'Moon of Mars', radius: 7.534e-05, parent: 'mars', orbit: 0.06267, angle: 2,
      tex: moonTex(15, P.dark, 3), range: 600, desc: 'A captured lump of rock skimming low over Mars.',
    },
    {
      id: 'deimos', name: 'Deimos', kind: 'moon', sub: 'Moon of Mars', radius: 4.144e-05, parent: 'mars', orbit: 0.1568, angle: 4.4,
      tex: moonTex(16, P.dark, 3), range: 600, desc: 'The smaller, further moon of Mars. It carried a deep radar station.',
    },
    {
      id: 'ceres', name: 'Ceres', kind: 'dwarf', sub: 'Dwarf planet · the Belt · 2.77 AU', radius: 0.00314, orbit: 2.77 * AU, angle: 1.2,
      spin: 0.25, tex: moonTex(17, P.rock, 2, 1), range: FAR, dock: 'ceres',
      desc: 'The Belt\'s biggest rock and busiest port. It was spun up so its millions of residents could live with a third of a g under their feet.',
    },
    {
      id: 'tycho', name: 'Tycho Station', kind: 'station', sub: 'Mobile construction yard · the Belt', radius: 3.34e-6,
      orbit: 2.95 * AU, angle: 0.25, lift: 30, model: 'tycho', spin: 0, range: 8000, dock: 'tycho',
      desc: 'A shipyard that can move itself: a half-kilometre sphere, two counter-rotating habitat rings and a yard on top. Its engineers spun up Ceres and built the largest ship ever attempted.',
    },
    ship('rocinante', 'Rocinante', 'corvette', 'Corvette-class light frigate · about 46 m',
      'Built by Mars as the Tachi, an escort carried in the belly of the Donnager. Salvaged, renamed for Don Quixote\'s horse, and ever since the best-known gunship in the system: point-defence cannons at the shoulders, torpedoes in the bow and, after a Tycho refit, a railgun along the keel.',
      'tycho', 8e-6, 0.6, 1.54e-7, 2e-6, 0.9),
    ship('molinari', 'Guy Molinari', 'freighter', 'Belter freighter · OPA',
      'A battered cargo hauler. Before the Belt had a navy, ships like this carried its boarding parties, packed into the holds behind the containers.',
      'tycho', 1.6e-5, 3.6, 3.3e-7, -3e-6, 2.4),
    ship('donnager', 'MCRN Donnager', 'battleship', 'Donnager-class battleship · Martian Navy · about half a kilometre',
      'Flagship of the Martian Jupiter fleet and a carrier for a brood of corvettes, the Tachi among them. Mars believed nothing in the system could take her class in a straight fight.',
      'mars', 0.08, 0.8, 1.59e-6, 0.01, 0.4),
    {
      id: 'vesta', name: 'Vesta', kind: 'asteroid', sub: 'Asteroid · the Belt · 2.36 AU', radius: 0.001756, orbit: 2.36 * AU, angle: 3.1,
      spin: 0.1, tex: moonTex(18, P.rock, 2), range: 8000,
      desc: 'One of the largest bodies in the Belt, bright and battered.',
    },
    {
      id: 'pallas', name: 'Pallas', kind: 'asteroid', sub: 'Asteroid · the Belt · 2.77 AU', radius: 0.001711, orbit: 2.77 * AU, angle: 4.6,
      lift: 120, spin: 0.1, tex: moonTex(19, P.dark, 2), range: 8000,
      desc: 'Steeply inclined to everything else, and home to refineries that feed the inner planets.',
    },
    {
      id: 'jupiter', name: 'Jupiter', kind: 'planet', sub: 'Gas giant · 5.2 AU', radius: 0.4779, orbit: 5.2 * AU, angle: 1.9,
      tilt: 0.05, spin: 0.05, res: 1024,
      tex: { style: 'gas', palette: P.jupiter, seed: 5, bands: 9, turb: 0.12, spot: true, storms: 1 }, atmo: '#e8c9a0', atmoK: 0.6,
      desc: 'King of the planets. Its moons feed and fuel the outer system, and its radiation belts kill the careless.',
    },
    {
      id: 'io', name: 'Io', kind: 'moon', sub: 'Moon of Jupiter', radius: 0.01218, parent: 'jupiter', orbit: 2.819, angle: 0.4,
      tex: { style: 'rock', palette: P.io, seed: 21, scale: 3, craters: 0.25 }, range: MOON_RANGE,
      desc: 'The most volcanic world known: sulphur plains, constant eruptions, and a good place to hide a laboratory.',
    },
    {
      id: 'europa', name: 'Europa', kind: 'moon', sub: 'Moon of Jupiter', radius: 0.01043, parent: 'jupiter', orbit: 4.486, angle: 2.2,
      tex: { style: 'ice', palette: P.europa, seed: 22, scale: 3, accent: '#7a4a2a' }, range: MOON_RANGE,
      desc: 'A shell of cracked ice over a deep ocean.',
    },
    {
      id: 'ganymede', name: 'Ganymede', kind: 'moon', sub: 'Moon of Jupiter', radius: 0.01761, parent: 'jupiter', orbit: 7.155, angle: 3.9,
      tex: moonTex(23, P.ganymede, 2, 0.7), range: MOON_RANGE, dock: 'ganymede',
      desc: 'Breadbasket of the outer planets. Domes and orbital mirrors grow the food, and its magnetic field makes it the safest place to be born out here.',
    },
    {
      id: 'callisto', name: 'Callisto', kind: 'moon', sub: 'Moon of Jupiter', radius: 0.01611, parent: 'jupiter', orbit: 12.59, angle: 5.4,
      tex: moonTex(24, P.dark, 3), range: MOON_RANGE,
      desc: 'Ancient, dark and cratered. Shipyards sit on its quiet, low-radiation surface.',
    },
    ship('razorback', 'Razorback', 'racer', 'Racing pinnace',
      'A rich family\'s racing yacht: one crash couch, one oversized drive and very little else. Among the fastest things ever flown by hand.',
      'io', 0.02, 1.0, 8.4e-8, 0.003, 2.0),
    {
      id: 'saturn', name: 'Saturn', kind: 'planet', sub: 'Gas giant · 9.5 AU', radius: 0.4029, orbit: 9.54 * AU, angle: 3.6,
      tilt: 0.47, spin: 0.05, res: 1024,
      tex: { style: 'gas', palette: P.saturn, seed: 6, bands: 7, turb: 0.08, storms: 0.4 }, atmo: '#f0deb0', atmoK: 0.5,
      rings: { inner: 0.5214, outer: 0.9479, palette: P.ringCream, seed: 61, opacity: 0.95, gap: 0.62 },
      desc: 'The rings are a quarry: ice haulers work them for the water the Belt drinks. One small moon, Phoebe, is missing — broken up and pushed into the planet.',
    },
    {
      id: 'enceladus', name: 'Enceladus', kind: 'moon', sub: 'Moon of Saturn', radius: 0.001685, parent: 'saturn', orbit: 1.591, angle: 1.1,
      tex: { style: 'ice', palette: P.ice, seed: 25, scale: 3, accent: '#5f86a8' }, range: MOON_RANGE,
      desc: 'Small, brilliant white, and venting its ocean into space.',
    },
    {
      id: 'rhea', name: 'Rhea', kind: 'moon', sub: 'Moon of Saturn', radius: 0.005106, parent: 'saturn', orbit: 3.523, angle: 3.0,
      tex: moonTex(26, P.ice, 3), range: MOON_RANGE, desc: 'An icy, cratered moon with a small settlement.',
    },
    {
      id: 'titan', name: 'Titan', kind: 'moon', sub: 'Moon of Saturn', radius: 0.01721, parent: 'saturn', orbit: 8.168, angle: 4.7,
      tex: { style: 'gas', palette: P.titan, seed: 27, bands: 2, turb: 0.3 }, atmo: '#e8a040', atmoK: 1.1, range: MOON_RANGE,
      desc: 'The only moon with a thick atmosphere: orange haze over methane seas, and resort domes for those who can pay.',
    },
    {
      id: 'iapetus', name: 'Iapetus', kind: 'moon', sub: 'Moon of Saturn', radius: 0.00491, parent: 'saturn', orbit: 23.8, angle: 0.2,
      tex: moonTex(28, [[0, '#2a221c'], [0.5, '#8a8078'], [1, '#f0ece4']], 1.2), range: MOON_RANGE,
      desc: 'Two-faced: one hemisphere coal dark, the other bright as snow.',
    },
    ship('canterbury', 'Canterbury', 'hauler', 'Ice hauler · Pur \'n\' Kleen Water Company',
      'A colony transport retired into hauling ice from Saturn\'s rings to Ceres. Old, slow and vast; the Belt drinks what ships like the Cant bring in. Shown here on her old run.',
      'saturn', 0.9, 2.0, 1.67e-6, 0.03, 0.5),
    ship('anubis', 'Anubis', 'stealth', 'Amun-Ra-class stealth frigate',
      'Radar-absorbing skin and internal heat sinks hide her from every scope, and she shows no running lights. A ship like this fired the shot that started a war. Look for the gap in the stars.',
      'saturn', 1.6, 5.2, 5e-7, -0.05, 4),
    {
      id: 'uranus', name: 'Uranus', kind: 'planet', sub: 'Ice giant · 19.2 AU', radius: 0.1709, orbit: 19.2 * AU, angle: 5.6,
      tilt: 1.71, spin: 0.04, res: 1024,
      tex: { style: 'gas', palette: P.uranus, seed: 7, bands: 4, turb: 0.05 }, atmo: '#a8eef0', atmoK: 0.7,
      rings: { inner: 0.2456, outer: 0.2883, palette: P.ringGrey, seed: 71, opacity: 0.4 },
      desc: 'Tipped on its side and pale as sea glass. The Ring sits two AU further out — look away from the Sun.',
    },
    {
      id: 'miranda', name: 'Miranda', kind: 'moon', sub: 'Moon of Uranus', radius: 0.001576, parent: 'uranus', orbit: 0.8649, angle: 0.7,
      tex: moonTex(31, P.ice, 4), range: 1200, desc: 'A patchwork moon of cliffs and grooves.',
    },
    {
      id: 'titania', name: 'Titania', kind: 'moon', sub: 'Moon of Uranus', radius: 0.005273, parent: 'uranus', orbit: 2.914, angle: 2.9,
      tex: moonTex(32, P.ganymede, 3), range: MOON_RANGE,
      desc: 'Largest moon of Uranus, with one of the furthest outposts in the system.',
    },
    {
      id: 'oberon', name: 'Oberon', kind: 'moon', sub: 'Moon of Uranus', radius: 0.00509, parent: 'uranus', orbit: 3.901, angle: 4.9,
      tex: moonTex(33, P.dark, 3), range: MOON_RANGE, desc: 'Dark, old and heavily cratered.',
    },
    {
      id: 'neptune', name: 'Neptune', kind: 'planet', sub: 'Ice giant · 30 AU', radius: 0.1655, orbit: 30.07 * AU, angle: 0.9,
      tilt: 0.49, spin: 0.04, res: 1024,
      tex: { style: 'gas', palette: P.neptune, seed: 8, bands: 5, turb: 0.12, storms: 0.7 }, atmo: '#6f9cff', atmoK: 0.9,
      desc: 'Deep blue, with the fastest winds in the system. The last planet before the long dark.',
    },
    {
      id: 'triton', name: 'Triton', kind: 'moon', sub: 'Moon of Neptune', radius: 0.009047, parent: 'neptune', orbit: 2.371, angle: 2.4,
      tex: { style: 'ice', palette: P.pluto, seed: 34, scale: 3, accent: '#5a6a7a' }, range: MOON_RANGE,
      desc: 'A captured world orbiting backwards, with nitrogen geysers.',
    },
    {
      id: 'pluto', name: 'Pluto', kind: 'dwarf', sub: 'Dwarf planet · Kuiper belt · 39.5 AU', radius: 0.007943, orbit: 39.5 * AU, angle: 2.7,
      lift: 900, tex: { style: 'ice', palette: P.pluto, seed: 35, scale: 2, accent: '#4a2f24' }, range: FAR,
      desc: 'Nitrogen glaciers and mountains of water ice, among the frozen leftovers of the Kuiper belt.',
    },
    {
      id: 'charon', name: 'Charon', kind: 'moon', sub: 'Moon of Pluto', radius: 0.004051, parent: 'pluto', orbit: 0.131, angle: 1,
      tex: moonTex(36, P.moon, 3), range: 600, desc: 'Half the size of Pluto itself; the two circle each other face to face.',
    },
    {
      id: 'oort', name: 'Oort Cloud', kind: 'dwarf', sub: 'Comet nursery · far beyond the planets', radius: 0.002005, orbit: 75 * AU, angle: 4.2,
      lift: 6000, tex: { style: 'ice', palette: P.ice, seed: 37, scale: 2.5, accent: '#4f6f8a' }, range: FAR,
      desc: 'A vast shell of dormant comets, the last thing tied to the Sun. In truth it lies thousands of AU out; it has been drawn in close so you can reach it.',
    },
    ship('thomasprince', 'UNN Thomas Prince', 'dreadnought', 'Xerxes-class battleship · UN Navy',
      'Sent to the Ring with a delegation of clergy, poets and politicians aboard, to bear witness to whatever lay on the other side.',
      undefined, 21.2 * AU - 0.05, 5.6 + 1e-6, 2.67e-6, 0.02, 2.6),
  ],
  belts: [
    { seed: 101, inner: 2.1 * AU, outer: 3.3 * AU, height: 90, dust: 26000, rocks: 3200, color: '#b8a48a', opacity: 0.6, dustSize: 1.6, size: [1.2e-5, 3e-4], clusters: ['ceres', 'tycho', 'vesta', 'pallas'] },
    { seed: 102, inner: 31 * AU, outer: 48 * AU, height: 2600, dust: 30000, rocks: 1500, color: '#9fb4c8', opacity: 0.5, dustSize: 2.2, size: [2e-5, 4e-4], clusters: ['pluto'] },
    { seed: 103, inner: 58 * AU, outer: 98 * AU, height: 0, dust: 42000, rocks: 0, color: '#bcd4ee', opacity: 0.45, dustSize: 1.4, size: [2e-5, 3e-4], shell: true, clusters: ['oort'] },
  ],
};

export interface NamedGate {
  idx: number;
  name: string;
  blurb: string;
  home?: string;
  special?: 'adro' | 'tecoma' | 'laconia' | 'ilus';
}

export const NAMED: NamedGate[] = [
  { idx: 0, name: 'Sol', blurb: 'The way home.' },
  { idx: 77, name: 'Ilus', home: 'Ilus', special: 'ilus', blurb: 'Also filed as New Terra. The first world settled beyond the gates: one great continent, lithium in the ground and a sky crowded with small moons.' },
  { idx: 1100, name: 'Laconia', home: 'Laconia', special: 'laconia', blurb: 'Earth-like and quiet, with strange construction platforms left in orbit by whoever built the gates.' },
  { idx: 412, name: 'Adro', special: 'adro', blurb: 'One star and one object: a carved green diamond the size of a gas giant.' },
  { idx: 968, name: 'Tecoma', special: 'tecoma', blurb: 'A dead system. A fast-spinning neutron star and nothing else at all.' },
  { idx: 233, name: 'Freehold', home: 'Freehold', blurb: 'A small colony with a stubborn streak.' },
  { idx: 655, name: 'Auberon', home: 'Auberon', blurb: 'Rich, temperate and busy; one of the great successes among the colony worlds.' },
  { idx: 841, name: 'Bara Gaon', home: 'Bara Gaon', blurb: 'Fertile soil and heavy industry: among the most productive of the new systems.' },
  { idx: 1290, name: 'Sanctuary', home: 'Sanctuary', blurb: 'A young colony under a mild sun.' },
  { idx: 530, name: 'Thanjavur', home: 'Thanjavur', blurb: 'A settled system a long way from anywhere.' },
  { idx: 150, name: 'Castila', home: 'Castila', blurb: 'One of the early colony claims.' },
  { idx: 1010, name: 'Nieuwestad', home: 'Nieuwestad', blurb: 'A corporate colony with tidy books.' },
  { idx: 345, name: 'Hasami', home: 'Hasami', blurb: 'A colony system on the far side of the ring space.' },
  { idx: 740, name: 'Ogma', home: 'Ogma', blurb: 'A quiet system with a single settled world.' },
  { idx: 1215, name: 'Kronos', blurb: 'Charted, claimed and mostly empty.' },
];

interface StarClass {
  name: string;
  weight: number;
  light: string;
  palette: Stop[];
  radius: [number, number];
  hz: [number, number];
}

const STARS: StarClass[] = [
  { name: 'Red dwarf', weight: 30, light: '#ff9a70', palette: [[0, '#7a1e08'], [0.5, '#e0531f'], [1, '#ffb37a']], radius: [45, 70], hz: [450, 750] },
  { name: 'Orange dwarf', weight: 22, light: '#ffcb96', palette: [[0, '#a3440e'], [0.5, '#f08a2e'], [1, '#ffd9a0']], radius: [70, 95], hz: [700, 1100] },
  { name: 'Yellow dwarf', weight: 24, light: '#fff1d6', palette: P.sun, radius: [95, 120], hz: [900, 1400] },
  { name: 'White star', weight: 14, light: '#f4f6ff', palette: [[0, '#d9c9a0'], [0.5, '#fff6e0'], [1, '#ffffff']], radius: [120, 150], hz: [1300, 2000] },
  { name: 'Blue-white star', weight: 8, light: '#cfe0ff', palette: [[0, '#8fb0ff'], [0.6, '#dfe9ff'], [1, '#ffffff']], radius: [150, 200], hz: [2000, 3200] },
];

const GAS_PALETTES: Stop[][] = [
  P.jupiter, P.saturn, P.neptune, P.uranus,
  [[0, '#4a1f4f'], [0.5, '#a05fb0'], [1, '#f0c9f4']],
  [[0, '#1f4a3a'], [0.5, '#5fb08a'], [1, '#d9f4e0']],
  [[0, '#5a1f1f'], [0.5, '#c05f3f'], [1, '#f4d9b0']],
];

const LAND_PALETTES: Stop[][] = [
  P.land,
  [[0, '#5a2f5f'], [0.4, '#8a4f7a'], [0.75, '#6a5a6a'], [1, '#f0f0f0']],
  [[0, '#7a5a1f'], [0.4, '#b08a3f'], [0.75, '#8a6a4a'], [1, '#f4f0e8']],
  [[0, '#1f5a4a'], [0.4, '#3f8a6a'], [0.75, '#6a7a6a'], [1, '#f0f4f0']],
];

const OCEANS: [string, string][] = [
  ['#06203f', '#1f6a96'], ['#0a2f2f', '#2f8a7a'], ['#1a1040', '#4a4fb0'], ['#102a18', '#3f7a4a'],
];

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const TAU = Math.PI * 2;

export function gateName(idx: number): string {
  const n = NAMED.find((g) => g.idx === idx);
  return n ? n.name : `Gate ${String(idx).padStart(4, '0')}`;
}

/** The system behind gate `idx`. The same gate always leads to the same place. */
export function genSystem(idx: number): SystemSpec {
  const named = NAMED.find((g) => g.idx === idx);
  const r = rng(idx * 7919 + 13);
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)];
  const between = (a: number, b: number) => a + (b - a) * r();
  const name = named?.name ?? `System ${String(idx).padStart(4, '0')}`;
  const base: Omit<SystemSpec, 'bodies' | 'belts' | 'gate' | 'light' | 'subtitle'> = {
    id: `sys:${idx}`,
    name,
    blurb: named?.blurb ?? 'Uncharted. No survey on file — you may be the first to look.',
  };

  if (named?.special === 'tecoma') {
    return {
      ...base, subtitle: 'Neutron star', light: '#cfe0ff', belts: [], gate: { orbit: 2600, angle: 1.3 },
      bodies: [{
        id: 'star', name: 'Tecoma', kind: 'star', sub: 'Neutron star', radius: 8e-5, orbit: 0, angle: 0, model: 'neutron', spin: 6,
        desc: 'A city-sized cinder with more mass than the Sun, turning many times a second. Nothing else is here.',
      }],
    };
  }

  let w = r() * STARS.reduce((s, c) => s + c.weight, 0);
  let cls = STARS[0];
  for (const c of STARS) {
    if ((w -= c.weight) <= 0) { cls = c; break; }
  }
  if (named?.home) cls = STARS[1 + Math.floor(r() * 3)];

  const bodies: BodySpec[] = [{
    id: 'star', name: named ? `${name} (star)` : `${name} A`, kind: 'star', sub: cls.name,
    radius: between(cls.radius[0], cls.radius[1]) * 0.0423, orbit: 0, angle: 0, spin: 0.01, res: 1024,
    tex: { style: 'star', palette: cls.palette, seed: idx + 1 },
    desc: `${cls.name} at the heart of the ${name} system.`,
  }];

  if (named?.special === 'adro') {
    bodies.push({
      id: 'diamond', name: 'The Adro Diamond', kind: 'artifact', sub: 'Artefact · planetary scale', radius: 0.48, orbit: 5200, angle: 2.1,
      model: 'diamond', spin: 0.03,
      desc: 'A single flawless green gem as wide as Jupiter, cut by the gate builders. Whatever they knew, some say it is written inside.',
    });
    return { ...base, subtitle: cls.name, light: cls.light, bodies, belts: [], gate: { orbit: 7400, angle: 2.6 } };
  }

  const [hz0, hz1] = cls.hz;
  const count = 3 + Math.floor(r() * 5);
  let orbit = hz0 * between(0.3, 0.5);
  let needHome = !!named?.home;
  let homeId = '';
  for (let i = 0; i < count && orbit < 42000; i++) {
    const id = `p${i}`;
    const angle = r() * TAU;
    let type: 'lava' | 'rock' | 'terran' | 'gas' | 'icegiant' | 'ice';
    const q = r();
    if (orbit < hz0 * 0.65) type = q < 0.35 ? 'lava' : 'rock';
    else if (orbit <= hz1 * 1.05) type = q < 0.55 ? 'terran' : 'rock';
    else if (orbit < hz1 * 4.5) type = q < 0.55 ? 'gas' : q < 0.8 ? 'rock' : 'ice';
    else type = q < 0.45 ? 'icegiant' : q < 0.85 ? 'ice' : 'gas';
    let pname = `${name} ${ROMAN[i]}`;
    if (needHome && orbit >= hz0 * 0.65) {
      type = 'terran';
      orbit = between(hz0, hz1);
      pname = named!.home!;
      needHome = false;
      homeId = id;
    }
    const seed = idx * 31 + i * 7 + 5;
    const au = (orbit / AU).toFixed(2);
    if (type === 'lava') {
      bodies.push({
        id, name: pname, kind: 'planet', sub: `Molten world · ${au} AU`, radius: between(1.5, 3.5) * G, orbit, angle, spin: 0.02,
        tex: { style: 'lava', palette: [[0, '#140c0a'], [1, '#4a2a20']], seed, scale: 2.5 },
        desc: 'Too close to its star. The crust has split and the cracks glow.',
      });
    } else if (type === 'rock') {
      const pal = pick([P.mercury, P.mars, P.dark, P.rock, P.moon]);
      bodies.push({
        id, name: pname, kind: 'planet', sub: `Barren world · ${au} AU`, radius: between(1.4, 4.2) * G, orbit, angle, spin: 0.02,
        tex: { style: 'rock', palette: pal, seed, scale: between(1.5, 3), craters: between(0.4, 1), caps: r() < 0.3 ? 0.08 : 0 },
        atmo: r() < 0.4 ? '#d0a080' : undefined, atmoK: 0.4,
        desc: 'Rock and dust. Good for ore, perhaps, and little else.',
      });
    } else if (type === 'terran') {
      const isHome = id === homeId;
      const ilus = named?.special === 'ilus' && isHome;
      bodies.push({
        id, name: pname, kind: 'planet', sub: `${isHome ? 'Colony world' : 'Living world'} · ${au} AU`,
        radius: between(3.2, 5) * G, orbit, angle, tilt: between(0, 0.5), spin: 0.03, res: 1024,
        tex: {
          style: 'terran', palette: isHome ? P.land : pick(LAND_PALETTES), seed, scale: ilus ? 0.9 : between(1.2, 2.4),
          sea: ilus ? 0.6 : between(0.42, 0.7), caps: between(0.03, 0.16), clouds: between(0.5, 0.9),
          ocean: isHome ? OCEANS[0] : pick(OCEANS), lights: isHome ? 0.35 : 0,
        },
        atmo: '#6ab0ff', atmoK: 1.2,
        desc: isHome ? named!.blurb : 'Open water, weather and something growing on the land. Breathable? Nobody has checked.',
      });
      if (r() < 0.6) {
        bodies.push({
          id: `${id}m`, name: `${pname} a`, kind: 'moon', sub: `Moon of ${pname}`, radius: between(0.5, 1.2) * G, parent: id,
          orbit: between(18, 28) * G * 6, angle: r() * TAU, tex: moonTex(seed + 1), range: MOON_RANGE,
          desc: 'A small airless companion.',
        });
      }
    } else if (type === 'gas' || type === 'icegiant') {
      const giant = type === 'gas';
      const R = (giant ? between(22, 42) : between(11, 18)) * G;
      const ringed = r() < (giant ? 0.4 : 0.25);
      bodies.push({
        id, name: pname, kind: 'planet', sub: `${giant ? 'Gas giant' : 'Ice giant'} · ${au} AU`, radius: R, orbit, angle,
        tilt: between(0, 0.6), spin: 0.05, res: 1024,
        tex: { style: 'gas', palette: giant ? pick(GAS_PALETTES) : pick([P.uranus, P.neptune, GAS_PALETTES[5]]), seed, bands: between(4, 11), turb: between(0.05, 0.2), spot: r() < 0.3, storms: r() },
        atmo: '#c0d0e0', atmoK: 0.5,
        rings: ringed ? { inner: R * between(1.25, 1.5), outer: R * between(1.9, 2.5), palette: pick([P.ringCream, P.ringGrey]), seed: seed + 3, opacity: between(0.5, 0.95), gap: r() < 0.5 ? between(0.3, 0.7) : undefined } : undefined,
        desc: giant ? 'A giant of hydrogen and storm bands, with a family of moons.' : 'Cold, blue and far from its star.',
      });
      const moons = 1 + Math.floor(r() * 4);
      let mo = R * (ringed ? 2.8 : 2.2);
      for (let m = 0; m < moons; m++) {
        const icy = r() < 0.5;
        bodies.push({
          id: `${id}m${m}`, name: `${pname} ${'abcd'[m]}`, kind: 'moon', sub: `Moon of ${pname}`, radius: between(0.4, 1.8) * G, parent: id,
          orbit: mo, angle: r() * TAU, range: MOON_RANGE,
          tex: icy ? { style: 'ice', palette: P.ice, seed: seed + 10 + m, scale: 3, accent: '#5f7f9a' } : moonTex(seed + 10 + m, pick([P.moon, P.dark, P.io, P.ganymede])),
          desc: icy ? 'An ice moon, cracked by the tides of its giant.' : 'A rocky moon, pocked with craters.',
        });
        mo += R * between(0.5, 0.9);
      }
    } else {
      bodies.push({
        id, name: pname, kind: 'planet', sub: `Frozen world · ${au} AU`, radius: between(1, 3.2) * G, orbit, angle, spin: 0.02,
        tex: { style: 'ice', palette: pick([P.ice, P.pluto, P.europa]), seed, scale: between(2, 3.5), accent: pick(['#5f7f9a', '#6b4a38', '#3f5a6a']) },
        desc: 'Ice all the way down, lit by a star that is barely more than the brightest point in the sky.',
      });
    }
    orbit *= between(1.5, 1.95);
  }

  if (homeId && named?.special === 'ilus') {
    for (let m = 0; m < 6; m++) {
      bodies.push({
        id: `ilus-m${m}`, name: `Ilus moon ${m + 1}`, kind: 'moon', sub: 'Small moon of Ilus', radius: 0.35 * G, parent: homeId,
        orbit: (14 + m * 4) * G * 6, angle: m * 1.9 + 0.4, lift: (m % 3 - 1) * 3 * G, tex: moonTex(900 + m, P.dark, 3), range: 900,
        desc: 'One of a swarm of small, dark moons. Not all of them are natural.',
      });
    }
  }
  if (homeId && named?.special === 'ilus') {
    bodies.push(
      ship('israel', 'Edward Israel', 'survey', 'Survey and colony ship · Royal Charter Energy',
        'The corporate expedition with the UN charter for this world, arriving to find Belter refugees already digging.',
        homeId, 0.12, 1.2, 1e-6, 0.016, 0.7),
      ship('barb', 'Barbapiccola', 'freighter', 'Belter freighter',
        'Carried refugees here from Ganymede, and waits in orbit to haul their lithium ore home.',
        homeId, 0.1, 4.0, 3e-7, -0.01, 3.5),
    );
  }
  if (homeId && named?.special === 'laconia') {
    bodies.push(ship('tempest', 'Heart of the Tempest', 'magnetar', 'Magnetar-class battlecruiser · Laconia',
      'Grown on the orbital platforms rather than built: pale, asymmetric, and larger than anything Earth or Mars ever launched.',
      homeId, 0.25, 5.0, 5e-6, 0.03, 1.1));
    for (let m = 0; m < 3; m++) {
      bodies.push({
        id: `platform${m}`, name: `Construction platform ${m + 1}`, kind: 'artifact', sub: 'Artefact in orbit of Laconia', radius: 0.004,
        parent: homeId, orbit: (13 + m * 2.5) * G * 6, angle: m * 2.1 + 1, lift: (m - 1) * 2 * G, model: 'platform', spin: 0.15, range: 1500,
        desc: 'Left by the gate builders and still, in its way, working. Shipyards that grow rather than build.',
      });
    }
  }

  const belts: BeltSpec[] = [];
  const last = orbit / 1.5;
  if (r() < 0.5) {
    const at = between(hz1 * 1.3, hz1 * 2.2);
    belts.push({ seed: idx + 500, inner: at, outer: at * 1.3, height: 70, dust: 14000, rocks: 1600, color: '#b0a090', opacity: 0.55, dustSize: 1.6, size: [1.2e-5, 3e-4] });
  }
  if (r() < 0.6) {
    belts.push({ seed: idx + 600, inner: last * 1.5 + 2000, outer: last * 2.2 + 4000, height: 1200, dust: 16000, rocks: 0, color: '#a8bcd0', opacity: 0.45, dustSize: 2.2, size: [2e-5, 3e-4] });
  }
  return {
    ...base, subtitle: cls.name, light: cls.light, bodies, belts,
    gate: { orbit: last * 1.25 + 700, angle: r() * TAU },
  };
}
