// Places you can walk around: a small kit of rooms, doors, props and people,
// and the four interiors built from it. Units are metres.

import * as THREE from 'three';
import { Noise, rng } from './textures';
import { buildModel, glowSprite, playerShip } from './ships';
import { scan, type ScanName } from './materials';
import { PHOTOS } from './photos';
import { buildPerson } from './people';
import { buildWalker, debugging, peopleReady, type Around, type Walker } from './skinned';
import { buildConcourse, terraceFront } from './concourse';
import { BAKING, Bounce, fits, type ProbeBox } from './probes';
import type { Spin } from './spin';
import { Dress, Signs, TALLY, WEAR_ON, wearRooms, type Site, type Style, type Taken } from './wear';
import { dressTycho, dressCeres, dressGanymede, dressMedina, type Built } from './dressing';

/** How much each station's spin gravity turns a walk into the Belter lope (0 walk, 1 full lope). */
const LOPE: Record<string, number> = { ceres: 0.6, tycho: 0.5, medina: 0.5, ganymede: 0.8 };
/**
 * How each spun station turns (see spin.ts): radius to the floor, gravity on it, and which way
 * on the floor plan the floor is moving. Lighter gravity here goes with more lope above.
 * Ceres really is 470 km to the floor, which nobody on foot could feel, so it is felt as a
 * 1.5 km wheel. Its Concourse and Tycho's ring corridor both run with the spin (+z); Medina's
 * drum goes round in +x. Ganymede is a moon: its gravity is real, so it is not here.
 */
const SPIN: Record<string, Spin> = {
  ceres: { R: 470_000, g: 0.3, feelR: 1500, sx: 0, sz: 1 },
  tycho: { R: 250, g: 0.35, feelR: 250, sx: 0, sz: 1 },
  medina: { R: 250, g: 0.35, feelR: 250, sx: 1, sz: 0 },
};

export interface Point { x: number; z: number; r: number; title: string; text: string; kind: 'info' | 'exit' }
export interface Place { name: string; x: number; z: number; yaw: number }
export interface Interior {
  id: string;
  name: string;
  blurb: string;
  scene: THREE.Scene;
  spawn: Place;
  places: Place[];
  points: Point[];
  /** Set when the floor is the inside of a spinning drum of this radius. */
  curveR?: number;
  /** Set when gravity here comes from the place turning (see spin.ts). */
  spin?: Spin;
  free(x: number, z: number): boolean;
  roomAt(x: number, z: number): string;
  /** Push a point out of anyone standing or walking there (flat interiors only). */
  clearOfPeople(x: number, z: number, r: number): [number, number];
  tick(t: number, dt: number, cam: THREE.Vector3): void;
  /** Bounce light, where the browser can do it (see probes.ts). */
  bounce?: Bounce;
}

// --------------------------------------------------------------- surfaces

type Surf = 'panel' | 'white' | 'deck' | 'rock' | 'grime' | 'tile' | 'dark' | 'soil' | 'fields' | 'regolith';
const TILE: Record<Surf, number> = { panel: 6, white: 6, deck: 1.8, rock: 5, grime: 4, tile: 3, dark: 4, soil: 3, fields: 1, regolith: 14 };
/** Scanned surface behind each kind: how much to brighten it, how metallic it is, and its v-repeat. */
const SCANS: Partial<Record<Surf, { scan: ScanName; gain: number; metal: number; ry?: number; rough?: number }>> = {
  panel: { scan: 'plates', gain: 1.5, metal: 0.3, rough: 2 },
  white: { scan: 'plates', gain: 2.4, metal: 0.1, rough: 2.2 },
  deck: { scan: 'walkway', gain: 1.7, metal: 0.35, rough: 1.6 },
  dark: { scan: 'darkmetal', gain: 1.2, metal: 0.25, rough: 1.5 },
  rock: { scan: 'rock', gain: 1.35, metal: 0 },
  grime: { scan: 'concrete', gain: 1.2, metal: 0 },
  tile: { scan: 'slab', gain: 0.38, metal: 0, ry: 2 },
  soil: { scan: 'dirt', gain: 0.55, metal: 0 },
  regolith: { scan: 'rock', gain: 1.25, metal: 0 },
};
const surfCache = new Map<Surf, THREE.Texture>();

function surf(kind: Surf): THREE.Texture {
  const hit = surfCache.get(kind);
  if (hit) return hit;
  const S = kind === 'fields' ? 1024 : 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const r = rng(kind.length * 97 + kind.charCodeAt(0));
  const speckle = (n: number, a: number) => {
    for (let i = 0; i < n; i++) {
      x.fillStyle = r() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.7})`;
      x.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
    }
  };
  const grid = (step: number, style: string, lw = 2) => {
    x.strokeStyle = style;
    x.lineWidth = lw;
    for (let i = 0; i <= S; i += step) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
    }
  };
  const noiseFill = (cr: number, cg: number, cb: number, freq: number, seed: number) => {
    const N = new Noise(seed);
    const img = x.createImageData(S, S);
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        // Sample on a torus so the tile repeats without a seam.
        const a = (i / S) * Math.PI * 2, b = (j / S) * Math.PI * 2;
        const n = N.fbm(Math.cos(a) * freq, Math.sin(a) * freq + Math.cos(b) * freq, Math.sin(b) * freq, 5);
        const k = 0.45 + n * 1.1, o = (j * S + i) * 4;
        img.data[o] = cr * k; img.data[o + 1] = cg * k; img.data[o + 2] = cb * k; img.data[o + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
  };
  if (kind === 'panel' || kind === 'white') {
    x.fillStyle = kind === 'panel' ? '#7b838a' : '#c6ccd1';
    x.fillRect(0, 0, S, S);
    speckle(1800, 0.05);
    grid(128, 'rgba(0,0,0,0.38)', 3);
    grid(128, 'rgba(255,255,255,0.12)', 1);
    x.fillStyle = 'rgba(0,0,0,0.4)';
    for (const [px, py] of [[10, 10], [118, 10], [10, 118], [118, 118], [138, 10], [246, 10], [138, 118], [246, 118], [10, 138], [118, 138], [10, 246], [118, 246], [138, 138], [246, 138], [138, 246], [246, 246]]) x.fillRect(px - 2, py - 2, 4, 4);
    for (let i = 0; i < 14; i++) {
      x.strokeStyle = `rgba(${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},${r() < 0.5 ? 0 : 255},0.06)`;
      x.lineWidth = 1;
      x.beginPath(); x.moveTo(r() * S, r() * S); x.lineTo(r() * S, r() * S); x.stroke();
    }
    if (kind === 'white') { x.fillStyle = 'rgba(200,102,42,0.55)'; x.fillRect(0, 196, S, 10); }
  } else if (kind === 'deck') {
    x.fillStyle = '#31353a';
    x.fillRect(0, 0, S, S);
    x.strokeStyle = 'rgba(255,255,255,0.09)';
    x.lineWidth = 3;
    for (let j = 0; j < S; j += 16) {
      for (let i = 0; i < S; i += 16) {
        const flip = ((i + j) / 16) % 2 === 0;
        x.beginPath(); x.moveTo(i + 3, j + (flip ? 3 : 13)); x.lineTo(i + 13, j + (flip ? 13 : 3)); x.stroke();
      }
    }
    grid(128, 'rgba(0,0,0,0.5)', 4);
    speckle(1500, 0.06);
  } else if (kind === 'rock') {
    noiseFill(128, 112, 98, 2.2, 5);
    speckle(2500, 0.07);
  } else if (kind === 'regolith') {
    noiseFill(150, 146, 140, 3, 9);
    speckle(4000, 0.08);
  } else if (kind === 'grime') {
    x.fillStyle = '#5d5b55';
    x.fillRect(0, 0, S, S);
    grid(128, 'rgba(0,0,0,0.4)', 3);
    for (let i = 0; i < 18; i++) {
      const gx = r() * S, gy = r() * S, gr = 10 + r() * 40;
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, 'rgba(20,14,8,0.35)');
      g.addColorStop(1, 'rgba(20,14,8,0)');
      x.fillStyle = g;
      x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
    }
    for (let i = 0; i < 20; i++) { x.fillStyle = 'rgba(120,60,20,0.12)'; x.fillRect(r() * S, r() * S, 2, 20 + r() * 60); }
    speckle(2500, 0.07);
  } else if (kind === 'tile') {
    for (let j = 0; j < S; j += 64) {
      for (let i = 0; i < S; i += 64) {
        const v = 92 + Math.floor(r() * 26);
        x.fillStyle = `rgb(${v + 6},${v + 2},${v - 6})`;
        x.fillRect(i, j, 64, 64);
      }
    }
    grid(64, 'rgba(0,0,0,0.45)', 2);
    speckle(2200, 0.06);
  } else if (kind === 'dark') {
    x.fillStyle = '#343a41';
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 6; i++) {
      const y = 12 + i * 42;
      x.fillStyle = '#4a525b'; x.fillRect(0, y, S, 10);
      x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, y, S, 2);
    }
    speckle(900, 0.05);
  } else if (kind === 'soil') {
    x.fillStyle = '#4a3828';
    x.fillRect(0, 0, S, S);
    for (let j = 0; j < S; j += 16) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(0, j, S, 5); }
    speckle(4000, 0.09);
  } else {
    // A patchwork of fields, orchards, paths and ponds seen from across the drum.
    x.fillStyle = '#4f7a3a';
    x.fillRect(0, 0, S, S);
    const crops = ['#6a9a3e', '#3f6a30', '#8aa84a', '#b8a84f', '#5a8a48', '#7a6a3a', '#9ab85a', '#456f3a'];
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        x.fillStyle = crops[Math.floor(r() * crops.length)];
        x.fillRect(i * 128 + 5, j * 128 + 5, 118, 118);
        x.fillStyle = 'rgba(0,0,0,0.08)';
        const vertical = r() < 0.5;
        for (let k = 8; k < 118; k += 7) vertical ? x.fillRect(i * 128 + 5 + k, j * 128 + 5, 2, 118) : x.fillRect(i * 128 + 5, j * 128 + 5 + k, 118, 2);
        if (r() < 0.14) { x.fillStyle = '#3f7fa8'; x.beginPath(); x.ellipse(i * 128 + 64, j * 128 + 64, 34, 22, r() * 3, 0, 7); x.fill(); }
      }
    }
    grid(128, '#b9b39a', 5);
    speckle(9000, 0.05);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  surfCache.set(kind, t);
  return t;
}

/** A flat panel, cut into squares about 3 m across: bounce light is worked out at the corners
 *  (see probes.ts), so a wall needs more corners than its own four to show any. */
function plane(w: number, h: number, mat: THREE.Material, tile: number): THREE.Mesh {
  const g = new THREE.PlaneGeometry(w, h, Math.min(64, Math.ceil(w / 3)), Math.min(64, Math.ceil(h / 3)));
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * h) / tile);
  return new THREE.Mesh(g, mat);
}

// Soft darkening where surfaces meet: the cheap stand-in for ambient occlusion, which the
// log-depth renderer cannot do as a screen pass. A fade along wall bases and ceiling edges,
// and a blob of shade under everything that stands on the floor.
let fadeTex: THREE.CanvasTexture | undefined, blobTex: THREE.CanvasTexture | undefined;
const shadeMat = (map: THREE.Texture, opacity: number) =>
  new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: map, transparent: true, opacity, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
function fade(): THREE.CanvasTexture {
  if (!fadeTex) {
    const c = document.createElement('canvas');
    c.width = 4; c.height = 64;
    const x = c.getContext('2d')!;
    const g = x.createLinearGradient(0, 0, 0, 64); // canvas top = plane top = the far edge
    g.addColorStop(0, '#000'); g.addColorStop(1, '#fff'); // opaque at the bottom (the junction)
    x.fillStyle = g; x.fillRect(0, 0, 4, 64);
    fadeTex = new THREE.CanvasTexture(c);
  }
  return fadeTex;
}
function blob(): THREE.CanvasTexture {
  if (!blobTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, '#fff'); g.addColorStop(0.5, '#777'); g.addColorStop(1, '#000');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(c);
  }
  return blobTex;
}

function textTexture(lines: string[], color: string, bg: string, aspect: number, align: CanvasTextAlign = 'center'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = Math.max(32, Math.round(512 / aspect));
  const x = c.getContext('2d')!;
  x.fillStyle = bg;
  x.fillRect(0, 0, c.width, c.height);
  let px = (c.height / lines.length) * 0.62;
  const font = (p: number) => `600 ${p}px ui-monospace, Menlo, monospace`;
  x.font = font(px);
  const widest = Math.max(...lines.map((l) => x.measureText(l).width));
  if (widest > c.width * 0.92) px *= (c.width * 0.92) / widest;
  x.font = font(px);
  x.fillStyle = color;
  x.textAlign = align;
  x.textBaseline = 'middle';
  lines.forEach((l, i) => x.fillText(l, align === 'center' ? c.width / 2 : 16, ((i + 0.5) * c.height) / lines.length));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// -------------------------------------------------------------------- kit

type Side = 'n' | 's' | 'e' | 'w';
interface Rect { x0: number; z0: number; x1: number; z1: number }
interface Opening { side: Side; a: number; b: number; y0: number; y1: number; glass: boolean; label?: string }
interface RoomOpts { floor: Surf; wall: Surf; ceil?: Surf; tint?: number; floorTint?: number; open?: boolean; glow?: number; /** Daylit and quiet: the neon pass leaves it alone. */ calm?: boolean }
interface Room extends Rect { name: string; h: number; o: RoomOpts; openings: Opening[]; /** Changes to the room's box of light probes. */ probe?: Partial<ProbeBox> }
interface PutOpts { y?: number; yaw?: number; solid?: boolean }

const M = 0.35;
/** How many flat strips Medina's drum is drawn with, round its circumference. */
const DRUM_SIDES = 128;
/** Whether interiors built from now on get bounce light, and the probes saved for the next
 *  one. Set by buildInterior. */
let BOUNCE = false, SAVED: ArrayBuffer | null = null;
/** With bounce light the flat fill light can drop to this much of itself: the probes do its job. */
const FILL = 0.45;

/** One person in an interior. `stand` is there while they are a fixture: the patch of shade under
 *  them and the bit of floor they take up. `loose` marks a bystander; `job` what they were given. */
interface Folk { w: Walker; acc: number; i: number; stand?: { shadow: THREE.Group; rect: Rect }; loose?: boolean; job?: 'talk' | 'queue' | 'stroll' }
type XZ = { x: number; z: number };
/** A queue: the spots in order from the counter, who is in it, and where the one who has been
 *  served steps out to (`out`) and wanders off to (`rest`) before joining the back again. */
interface Queue { spots: XZ[]; yaw: number; line: Folk[]; out: XZ; rest: XZ; away?: Folk; phase: 'wait' | 'away' | 'back'; t: number; moves: { f: Folk; to: XZ; t: number }[] }

class Kit implements Site {
  scene = new THREE.Scene();
  rooms: Room[] = [];
  doors: Rect[] = [];
  blocks: Rect[] = [];
  points: Point[] = [];
  places: Place[] = [];
  anims: ((t: number, dt: number) => void)[] = [];
  curveR?: number;
  /** The light that throws shadows: which way it comes from, and how strong. It follows you about. */
  keyFrom = new THREE.Vector3(0.22, 1, 0.14).normalize();
  keyPower = 0.9;
  keyColor = 0xffffff;
  circle?: number;
  bounds?: Rect;
  stars?: THREE.Points;
  floors: THREE.Mesh[] = [];
  /** People built from here on wear everyday clothes with nothing lit. */
  plainPeople = false;
  /** Called every frame with where you are and the light that follows you. */
  onCam: ((cam: THREE.Vector3, key: THREE.DirectionalLight) => void)[] = [];
  /** Skinned people, animated more often the nearer they are to you (see tick). */
  /** Probe boxes beyond the one each room gets. */
  volumes: ProbeBox[] = [];
  /** Things the light probes should not see: people (they move) and the painted-on shade. */
  unlit: THREE.Object3D[] = [];
  bounce = BOUNCE;
  folk: Folk[] = [];
  /** Doorways between rooms: the middle of each, and the way through it from room `a` to room `b`. */
  doorways: { x: number; z: number; nx: number; nz: number; a: Room; b: Room }[] = [];
  /** The lines the pacing walkers keep to (both lanes), so nobody is told to stand in them. */
  lanes: { x: number; z: number; fx: number; fz: number; len: number }[] = [];
  /** Places a queue could form: where its first person stands, and the way it runs back from there. */
  counters: { x: number; z: number; yaw: number }[] = [];
  queues: Queue[] = [];
  strollers: { f: Folk; t: number; to?: XZ }[] = [];
  /** A dice for what people do. The dice that lays out the rooms (`r`) is left alone, so
   *  behaviour never moves the furniture or the lights the saved light probes were made for. */
  q = rng(7);
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  r = rng(1);
  /** A third dice, for wear and clutter (see wear.ts): grime never moves the furniture either. */
  w = rng(3);
  /** How worn this place is. */
  style: Style = { grime: 0.5, dirt: 0x1a1410, worn: 0x000000, wornA: 0.2, drips: 0.3, litter: 0.2, posters: 0.2, pipes: [0x6a7078, 0x4a5a62], duct: 0x7a8288 };
  /** The station's own dressing, run after the rooms are furnished and peopled. */
  dress?: (d: Dress, s: Signs) => void;
  /** Where signs already hang, so wall fittings keep clear of them. */
  taken: Taken[] = [];

  constructor(public id: string, public name: string, public blurb: string) {
    this.r = rng(id.length * 131 + id.charCodeAt(0));
    this.q = rng(id.length * 977 + id.charCodeAt(0) * 31 + 5);
    this.w = rng(id.length * 389 + id.charCodeAt(0) * 17 + 11);
  }

  /** A frame standing on the floor at (x, z), `y` above it and turned by `yaw`. In a drum it follows the hull. */
  frame(x: number, y: number, z: number, yaw = 0): THREE.Matrix4 {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), p = new THREE.Vector3(x, y, z);
    if (this.curveR) {
      // The drum is drawn as flat strips, which stand a few centimetres proud of a true
      // circle between their edges; sit on the strip, or markings on the ground sink into it.
      const R = this.curveR, th = x / R, seg = (Math.PI * 2 * R) / DRUM_SIDES, u = ((x % seg) + seg) % seg;
      y += (u * (seg - u)) / (2 * R);
      p.set((R - y) * Math.sin(th), -(R - y) * Math.cos(th), z);
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), th));
    }
    return new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1));
  }

  /** Open floor with `r` of elbow room that nobody is using: not a door, a walker's lane, a
   *  queue's place, a reading post or somewhere you are put down. For new solid clutter. */
  clear(x: number, z: number, r: number): boolean {
    if (!this.free(x, z)) return false;
    for (let i = 0; i < 8; i++) if (!this.free(x + Math.cos(i * 0.785) * r, z + Math.sin(i * 0.785) * r)) return false;
    if (this.nearLane(x, z, r + 0.7) || this.nearFolk(x, z, r + 0.4)) return false;
    const p = r + 1.3;
    for (const d of this.doors) if (x > d.x0 - p && x < d.x1 + p && z > d.z0 - p && z < d.z1 + p) return false;
    for (const d of this.doorways) if (Math.abs((x - d.x) * d.nz - (z - d.z) * d.nx) < r + 1.4 && Math.abs((x - d.x) * d.nx + (z - d.z) * d.nz) < 5) return false;
    // Where a queue would stand: a strip running out from each counter.
    for (const c of this.counters) {
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), a = (x - c.x) * fx + (z - c.z) * fz, l = (x - c.x) * fz - (z - c.z) * fx;
      if (a > -0.9 - r && a < 3.6 + r && Math.abs(l) < 1.4 + r) return false;
    }
    for (const pt of this.points) if (Math.hypot(x - pt.x, z - pt.z) < r + 1.5) return false;
    for (const pl of this.places) if (Math.hypot(x - pl.x, z - pl.z) < r + 1.6) return false;
    return true;
  }

  /** A straight line of open floor with nobody standing on it or pacing along it. For new railings. */
  lineClear(x0: number, z0: number, x1: number, z1: number): boolean {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.4);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
      if (!this.free(x, z) || this.nearLane(x, z, 0.9) || this.nearFolk(x, z, 0.75)) return false;
      for (const d of this.doors) if (x > d.x0 - 0.6 && x < d.x1 + 0.6 && z > d.z0 - 0.6 && z < d.z1 + 0.6) return false;
    }
    return true;
  }

  /** The wear pass: what every room gets, then the station's own dressing, as a few merged meshes. */
  wear() {
    if (!WEAR_ON) return;
    const d = new Dress(), s = new Signs();
    if (!this.curveR) wearRooms(this, d, this.rooms, this.style, this.taken);
    this.dress?.(d, s);
    const { meshes, skip } = d.build();
    this.scene.add(...meshes, ...s.build());
    this.unlit.push(...skip);
    if (debugging) (globalThis as unknown as { __wear: unknown }).__wear = { things: d.count, meshes: meshes.length, solid: { ...TALLY } };
  }

  mat(kind: Surf, tint = 0xffffff): THREE.MeshStandardMaterial {
    const key = `${kind}:${tint}`;
    let m = this.mats.get(key);
    if (!m) {
      const sc = SCANS[kind];
      if (sc) {
        m = new THREE.MeshStandardMaterial({ ...scan(sc.scan, 1, sc.ry ?? 1), color: tint, roughness: sc.rough ?? 1, metalness: sc.metal });
        m.color.multiplyScalar(sc.gain);
        if (kind === 'soil') m.color.multiply(new THREE.Color(0xa08a78));
      } else {
        m = new THREE.MeshStandardMaterial({ map: surf(kind), color: tint, roughness: 0.82, metalness: 0.05 });
      }
      this.mats.set(key, m);
    }
    return m;
  }

  flat(color: number, o: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
    const key = `c:${color}:${JSON.stringify(o)}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.15, ...o });
      this.mats.set(key, m);
    }
    return m;
  }

  /** Put something on the floor at (x, z). In a drum this wraps the position round the hull. */
  place<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number, yaw = 0): T {
    if (this.curveR) {
      const R = this.curveR, th = x / R;
      obj.position.set((R - y) * Math.sin(th), -(R - y) * Math.cos(th), z);
      obj.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), th).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    } else {
      obj.position.set(x, y, z);
      obj.rotation.y = yaw;
    }
    this.scene.add(obj);
    return obj;
  }

  room(name: string, x0: number, z0: number, x1: number, z1: number, h: number, o: RoomOpts, yaw = 0): Room {
    const room: Room = { name, x0, z0, x1, z1, h, o, openings: [] };
    this.rooms.push(room);
    this.places.push({ name, x: (x0 + x1) / 2, z: (z0 + z1) / 2, yaw });
    return room;
  }

  door(a: Room, b: Room, at: number, w = 2.6, h = 2.7) {
    const lo = at - w / 2, hi = at + w / 2;
    const mk = (room: Room, side: Side, label: string) => room.openings.push({ side, a: lo, b: hi, y0: 0, y1: h, glass: false, label });
    if (a.x1 === b.x0 || b.x1 === a.x0) {
      const [l, r] = a.x1 === b.x0 ? [a, b] : [b, a];
      mk(l, 'e', r.name); mk(r, 'w', l.name);
      this.doors.push({ x0: l.x1 - 0.6, x1: l.x1 + 0.6, z0: lo + M, z1: hi - M });
      this.doorways.push({ x: l.x1, z: at, nx: 1, nz: 0, a: l, b: r });
    } else if (a.z1 === b.z0 || b.z1 === a.z0) {
      const [n, s] = a.z1 === b.z0 ? [a, b] : [b, a];
      mk(n, 's', s.name); mk(s, 'n', n.name);
      this.doors.push({ x0: lo + M, x1: hi - M, z0: n.z1 - 0.6, z1: n.z1 + 0.6 });
      this.doorways.push({ x: at, z: n.z1, nx: 0, nz: 1, a: n, b: s });
    } else {
      throw new Error(`${a.name} and ${b.name} do not share a wall`);
    }
  }

  window(room: Room, side: Side, a: number, b: number, y0: number, y1: number) {
    room.openings.push({ side, a, b, y0, y1, glass: true });
  }

  private wallPiece(room: Room, side: Side, a: number, b: number, y0: number, y1: number, mat: THREE.Material, tile: number) {
    if (b - a < 0.01 || y1 - y0 < 0.01) return;
    const m = plane(b - a, y1 - y0, mat, tile);
    const mid = (a + b) / 2, y = (y0 + y1) / 2;
    if (side === 'n') m.position.set(mid, y, room.z0);
    else if (side === 's') { m.position.set(mid, y, room.z1); m.rotation.y = Math.PI; }
    else if (side === 'w') { m.position.set(room.x0, y, mid); m.rotation.y = Math.PI / 2; }
    else { m.position.set(room.x1, y, mid); m.rotation.y = -Math.PI / 2; }
    this.scene.add(m);
    if (mat.transparent) return;
    // Shade where the wall meets the floor, and where it meets the ceiling.
    const strip = (atTop: boolean) => {
      const hh = Math.min(0.9, room.h * 0.12);
      const g = new THREE.PlaneGeometry(b - a, hh);
      if (atTop) { const uv = g.getAttribute('uv'); for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); }
      const s = new THREE.Mesh(g, shadeMat(fade(), atTop ? 0.5 : 0.7));
      s.position.copy(m.position); s.rotation.copy(m.rotation);
      s.position.y = atTop ? y1 - hh / 2 : y0 + hh / 2;
      s.translateZ(0.012);
      s.renderOrder = 1;
      this.scene.add(s);
      this.unlit.push(s);
    };
    if (y0 < 0.01) strip(false);
    if (y1 > room.h - 0.01 && !room.o.open) strip(true);
  }

  /** A soft patch of shade on the floor under something standing there. */
  contact(x: number, z: number, w: number, d: number, yaw = 0, opacity = 0.55) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), shadeMat(blob(), opacity));
    m.rotation.x = -Math.PI / 2;
    const g = new THREE.Group();
    g.add(m);
    m.position.y = 0.02;
    m.renderOrder = 1;
    this.unlit.push(g);
    return this.place(g, x, 0, z, yaw);
  }

  /** Turn the declared rooms into geometry. Call after every door and window is declared. */
  finish() {
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.6, depthWrite: false });
    for (const room of this.rooms) {
      const { x0, z0, x1, z1, h, o } = room;
      const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const floor = plane(w, d, this.mat(o.floor, o.floorTint ?? o.tint), TILE[o.floor]);
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(cx, 0, cz);
      this.scene.add(floor);
      if (!o.calm) this.floors.push(floor);
      if (!o.open) {
        const ck = o.ceil ?? 'dark';
        const ceil = plane(w, d, this.mat(ck, o.tint), TILE[ck]);
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(cx, h, cz);
        this.scene.add(ceil);
      }
      const wm = this.mat(o.wall, o.tint), tile = TILE[o.wall];
      for (const side of ['n', 's', 'e', 'w'] as Side[]) {
        const [lo, hi] = side === 'n' || side === 's' ? [x0, x1] : [z0, z1];
        const ops = room.openings.filter((q) => q.side === side).sort((p, q) => p.a - q.a);
        let at = lo;
        for (const q of ops) {
          this.wallPiece(room, side, at, q.a, 0, h, wm, tile);
          this.wallPiece(room, side, q.a, q.b, 0, q.y0, wm, tile);
          this.wallPiece(room, side, q.a, q.b, q.y1, h, wm, tile);
          if (q.glass) this.wallPiece(room, side, q.a, q.b, q.y0, q.y1, glass, 1);
          if (q.label) {
            const mid = (q.a + q.b) / 2, y = Math.min(h - 0.25, q.y1 + 0.3), e = 0.05;
            const [sx, sz, yaw] = side === 'n' ? [mid, z0 + e, 0] : side === 's' ? [mid, z1 - e, Math.PI] : side === 'w' ? [x0 + e, mid, Math.PI / 2] : [x1 - e, mid, -Math.PI / 2];
            this.sign(q.label.toUpperCase(), sx, y, sz, yaw, Math.min(q.b - q.a, 3.2), 0.32, '#ffd9a0', 'rgba(10,12,16,0.85)');
          }
          at = q.b;
        }
        this.wallPiece(room, side, at, hi, 0, h, wm, tile);
      }
      if (o.glow !== undefined) {
        // Light strips along the ceiling.
        const n = Math.max(1, Math.round(d / 9));
        for (let i = 0; i < n; i++) this.strip(cx, h - 0.06, z0 + ((i + 0.5) * d) / n, Math.min(w * 0.5, 6), 0.35, o.glow);
      }
    }
  }

  free(x: number, z: number): boolean {
    if (this.curveR) {
      const C = Math.PI * 2 * this.curveR;
      x = ((((x + C / 2) % C) + C) % C) - C / 2;
      if (!this.bounds || z < this.bounds.z0 || z > this.bounds.z1) return false;
    } else if (this.circle) {
      if (x * x + z * z > this.circle * this.circle) return false;
    } else {
      let ok = false;
      for (const r of this.rooms) if (x > r.x0 + M && x < r.x1 - M && z > r.z0 + M && z < r.z1 - M) { ok = true; break; }
      if (!ok) for (const r of this.doors) if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) { ok = true; break; }
      if (!ok) return false;
    }
    for (const b of this.blocks) if (x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3) return false;
    return true;
  }

  roomAt(x: number, z: number): string {
    for (const r of this.rooms) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return r.name;
    return this.name;
  }

  block(x: number, z: number, w: number, d: number) {
    this.blocks.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  }

  box(w: number, h: number, d: number, mat: THREE.Material | number, x: number, z: number, o: PutOpts = {}): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof mat === 'number' ? this.flat(mat) : mat);
    m.castShadow = true;
    this.place(m, x, (o.y ?? 0) + h / 2, z, o.yaw ?? 0);
    if (!o.y && Math.min(w, d) > 0.25 && h > 0.2) this.contact(x, z, w * 1.35 + 0.25, d * 1.35 + 0.25, o.yaw ?? 0, h > 0.6 ? 0.55 : 0.35);
    if (o.solid !== false && (o.y ?? 0) < 1.9) {
      const turned = Math.abs(Math.sin(o.yaw ?? 0)) > 0.7;
      this.block(x, z, turned ? d : w, turned ? w : d);
    }
    return m;
  }

  cyl(r: number, h: number, mat: THREE.Material | number, x: number, z: number, o: PutOpts = {}, r2 = r): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, 16), typeof mat === 'number' ? this.flat(mat) : mat);
    m.castShadow = true;
    this.place(m, x, (o.y ?? 0) + h / 2, z, o.yaw ?? 0);
    if (!o.y && r > 0.12 && h > 0.2) this.contact(x, z, r * 2.8 + 0.2, r * 2.8 + 0.2, 0, 0.5);
    if (o.solid !== false && (o.y ?? 0) < 1.9) this.block(x, z, r * 2, r * 2);
    return m;
  }

  sign(text: string | string[], x: number, y: number, z: number, yaw: number, w: number, h: number, color = '#8fdcff', bg = 'rgba(0,0,0,0)') {
    const lines = Array.isArray(text) ? text : [text];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTexture(lines, color, bg, w / h), transparent: true }));
    this.taken.push({ x, y, z, w, h });
    return this.place(m, x, y, z, yaw);
  }

  /** A real light. Use sparingly; `strip` is free. */
  lamp(x: number, y: number, z: number, color: number, power: number, reach: number) {
    const l = new THREE.PointLight(color, power * 0.6, reach, 1.6);
    this.place(l, x, y, z);
    this.strip(x, y + 0.12, z, 0.5, 0.5, color);
  }

  strip(x: number, y: number, z: number, w: number, d: number, color: number) {
    const mat = new THREE.MeshBasicMaterial({ color });
    mat.color.multiplyScalar(1.7);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mat);
    this.place(m, x, y, z);
  }

  crates(x: number, z: number, n: number) {
    const cols = [0x8a5a3a, 0x4a6a7a, 0x7a7468, 0xb08a2e, 0x55634a];
    for (let i = 0; i < n; i++) {
      const s = 1 + this.r() * 0.8, ox = (this.r() - 0.5) * 3.5, oz = (this.r() - 0.5) * 3.5;
      this.box(s * 1.2, s, s, cols[Math.floor(this.r() * cols.length)], x + ox, z + oz, { yaw: this.r() < 0.5 ? 0 : Math.PI / 2 });
      if (this.r() < 0.4) this.box(s, s * 0.8, s * 0.8, cols[Math.floor(this.r() * cols.length)], x + ox, z + oz, { y: s, solid: false });
    }
  }

  table(x: number, z: number, seats = 3) {
    this.cyl(0.08, 0.95, 0x2d3238, x, z, { solid: false });
    this.cyl(0.55, 0.06, 0x3a3f46, x, z, { y: 0.95 });
    for (let i = 0; i < seats; i++) {
      const a = (i / seats) * Math.PI * 2 + this.r();
      this.cyl(0.2, 0.6, 0x55504a, x + Math.cos(a) * 1.0, z + Math.sin(a) * 1.0, { solid: false });
    }
  }

  console(x: number, z: number, yaw: number, lines: string[], color = '#7fe0ff') {
    this.box(1.6, 0.9, 0.7, 0x2a2f36, x, z, { yaw });
    const sx = Math.sin(yaw) * 0.2, sz = Math.cos(yaw) * 0.2;
    const s = this.sign(lines, x + sx, 1.45, z + sz, yaw, 1.5, 0.85, color, 'rgba(4,14,22,0.92)');
    s.rotation.x = this.curveR ? 0 : -0.25;
  }

  person(x: number, z: number, yaw = this.r() * 6.28, belter = false, walk = false) {
    if (peopleReady()) return this.walker(x, z, yaw, walk ? 4 + this.r() * 6 : 0, belter);
    const p = buildPerson(this.r, belter, this.plainPeople);
    const g = p.group;
    const phase = this.r() * 6;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), A = 2.4;
    // Walkers pace a short beat along the way they face, so long as the whole beat is open floor.
    const beat = walk && !this.curveR && [-1, -0.5, 0, 0.5, 1].every((s) => this.free(x + fx * A * s, z + fz * A * s));
    this.place(g, x, 0, z, yaw);
    this.unlit.push(g);
    if (!beat) this.contact(x, z, 1.0, 1.0, 0, 0.5);
    if (!beat) {
      this.block(x, z, 0.3, 0.3);
      this.anims.push((t) => p.pose(t, false));
      return;
    }
    const speed = 0.28 + this.r() * 0.14;
    this.anims.push((t) => {
      const s = Math.sin(t * speed + phase), v = Math.cos(t * speed + phase);
      g.position.x = x + fx * A * s;
      g.position.z = z + fz * A * s;
      g.rotation.y = yaw + (v >= 0 ? 0 : Math.PI);
      p.pose(t, true);
    });
  }

  /** A person with a skeleton (trial): paces `beat` metres along `yaw` if that line is open floor,
   *  otherwise stands. `lope` blends in the low-gravity Belter stride. Falls back to the old people. */
  walker(x: number, z: number, yaw: number, beat: number, belter = true, lope?: number) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    // A walker paces a loop of two lanes 0.9 m apart; use whichever side is open floor.
    const clear = (off: number) => Array.from({ length: Math.ceil(beat) + 1 }, (_, i) => Math.min(i, beat))
      .every((d) => this.free(x + fx * d + sx * off, z + fz * d + sz * off));
    const side = beat > 0 && !this.curveR && clear(0) ? ([1, -1] as const).find((s) => clear(s * 0.9) && clear(s * 0.45)) : undefined;
    // How much of the low-gravity lope to blend in: Belters raised to it, visitors half way.
    const g = LOPE[this.id] ?? 0.4;
    const w = buildWalker(this.r, x, z, yaw, { belter, lope: lope ?? (belter ? g : g * 0.5), beat: side ? beat : 0, lane: side, plain: this.plainPeople, street: !this.plainPeople });
    if (!w) return;
    this.unlit.push(w.group);
    let stand: { shadow: THREE.Group; rect: Rect } | undefined;
    if (side) {
      this.scene.add(w.group);
      for (const off of [0, side * 0.9]) this.lanes.push({ x: x + sx * off, z: z + sz * off, fx, fz, len: beat });
    }
    else {
      this.place(w.group, x, 0, z, yaw);
      const shadow = this.contact(x, z, 1.0, 1.0, 0, 0.5);
      this.block(x, z, 0.3, 0.3);
      stand = { shadow, rect: this.blocks[this.blocks.length - 1] };
    }
    this.folk.push({ w, acc: 0, i: this.folk.length, stand });
  }

  crowd(x0: number, z0: number, x1: number, z1: number, n: number, belter = true) {
    n = Math.round(n * 1.6);
    for (let i = 0, tries = 0; i < n && tries < n * 20; tries++) {
      const x = x0 + this.r() * (x1 - x0), z = z0 + this.r() * (z1 - z0);
      if (!this.free(x, z)) continue;
      const before = this.folk.length;
      this.person(x, z, undefined, belter && this.r() < 0.8, this.r() < 0.3);
      // Bystanders with nowhere to be: the ones `behave` may give something to do.
      if (this.folk.length > before) this.folk[before].loose = true;
      i++;
    }
  }

  /** A reading post. Walk up to it and its text appears. */
  placard(x: number, z: number, yaw: number, title: string, text: string) {
    this.box(0.5, 1.05, 0.25, 0x20252b, x, z, { yaw });
    const s = this.sign(['◆ ' + title.toUpperCase()], x + Math.sin(yaw) * 0.14, 1.25, z + Math.cos(yaw) * 0.14, yaw, 0.9, 0.3, '#8fdcff', 'rgba(4,18,28,0.95)');
    void s;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshBasicMaterial({ color: 0x8fdcff }));
    this.place(gem, x, 1.75, z);
    this.anims.push((t) => { gem.rotateY(0.03); gem.scale.setScalar(1 + Math.sin(t * 3) * 0.12); });
    this.points.push({ x, z, r: 3.2, title, text, kind: 'info' });
  }

  // ---- the neon pass: haze, wet floors, coloured light, signs, holograms, stalls and cables.
  neon() {
    if (!this.rooms.length || this.curveR) return;
    const r = this.r;
    const PAL = [0xff2d95, 0x2df0ff, 0xffb02d, 0x8a5cff, 0x4dff9a];
    const hot = (c: number, k = 2.4) => { const m = new THREE.MeshBasicMaterial({ color: c }); m.color.multiplyScalar(k); return m; };
    const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

    this.scene.fog = new THREE.FogExp2(0x180a28, 0.012);
    this.keyPower *= 0.45;
    this.keyColor = 0xcbb8ff;
    this.scene.traverse((o) => {
      if (o instanceof THREE.HemisphereLight || o instanceof THREE.AmbientLight) { o.intensity *= 0.5; o.color.lerp(new THREE.Color(0x8a6cff), 0.4); }
    });

    // What a wet floor would reflect: a dark city of tall neon bars, painted once and shared.
    const ec = document.createElement('canvas');
    ec.width = 1024; ec.height = 512;
    const ex = ec.getContext('2d')!;
    const sky = ex.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#0b0618'); sky.addColorStop(0.55, '#2a0f45'); sky.addColorStop(1, '#05030a');
    ex.fillStyle = sky; ex.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 70; i++) {
      const c = hex(PAL[Math.floor(r() * PAL.length)]), x = r() * 1024, w = 3 + r() * 16, y = 40 + r() * 180, h = 60 + r() * 250;
      ex.shadowColor = c; ex.shadowBlur = 24; ex.fillStyle = c; ex.globalAlpha = 0.55 + r() * 0.45;
      ex.fillRect(x, y, w, h);
    }
    const env = new THREE.CanvasTexture(ec);
    env.mapping = THREE.EquirectangularReflectionMapping;
    env.colorSpace = THREE.SRGBColorSpace;
    for (const f of this.floors) {
      const m = (f.material as THREE.MeshStandardMaterial).clone();
      m.roughness = 0.4; m.metalness = 0.5; m.envMap = env; m.envMapIntensity = 1.3;
      m.normalScale?.set(0.18, 0.18);
      m.color.multiplyScalar(0.7);
      f.material = m;
    }

    const nearDoor = (x: number, z: number, pad = 3) => this.doors.some((d) => x > d.x0 - pad && x < d.x1 + pad && z > d.z0 - pad && z < d.z1 + pad);
    const NAMES = [['RAMEN', 'ラーメン'], ['CHROME', 'クローム'], ['NIGHT', 'MARKET'], ['BIO-MODS', '24h'], ['NOODLES'], ['SYNTH BAR'], ['VR LOUNGE'], ['PAWN', '質屋'], ['INK', 'タトゥー'], ['O2 • WATER'], ['CYBERWARE'], ['ARCADE', 'アーケード'], ['STIMS'], ['LOTTO'], ['SOUP 3¢']];
    const ADS = [['SYNTHCOLA', 'taste the void'], ['BELT BREW', 'brewed in no gravity'], ['ORBITAL MOTORS', 'torque for the long dark'], ['LUNA·MART', 'everything. eventually.'], ['NEUROPOP', 'upgrade tonight'], ['VANTA SOUND', 'hear everything']];

    this.rooms.forEach((room, ri) => {
      const { x0, z0, x1, z1, h } = room;
      const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, area = w * d;
      const col = PAL[ri % PAL.length], col2 = PAL[(ri + 2) % PAL.length];
      if (h < 3.3 || room.o.calm) return;
      // With bounce light to fill the room, the lamp can be dimmer and (where there is headroom)
      // higher, which stops it burning out the heads of tall people standing near it.
      // Under a low ceiling it cannot go higher, so it is dimmed further.
      const soft = this.bounce, ly = Math.min(h - 0.6, soft ? 4.4 : 3.6);
      const dim = soft ? 0.3 + 0.25 * Math.min(1, Math.max(0, (ly - 3) / 1.4)) : 1;
      const L = new THREE.PointLight(col, (60 + Math.min(area, 400) * 0.25) * dim, Math.max(w, d) * 0.8 + 8, 1.5);
      this.place(L, cx, ly, cz);
      // Nobody stands right under it: a tall Belter's head would be a hand's breadth from the bulb.
      for (const f of this.folk) {
        const p = f.w.group.position, dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
        if (!f.stand || d >= 1.8) continue;
        const ux = d > 0.01 ? dx / d : 1, uz = d > 0.01 ? dz / d : 0, nx = cx + ux * 1.9, nz = cz + uz * 1.9;
        if (!this.free(nx, nz)) continue;
        p.x = nx; p.z = nz;
        f.w.flat.x = nx; f.w.flat.z = nz;
        f.stand.shadow.position.x = nx; f.stand.shadow.position.z = nz;
        Object.assign(f.stand.rect, { x0: nx - 0.15, x1: nx + 0.15, z0: nz - 0.15, z1: nz + 0.15 });
      }

      // Neon tubes along the walls, and a lit skirting.
      const sides: [string, number, number, number, number][] = [
        ['n', cx, z0 + 0.06, w, 0], ['s', cx, z1 - 0.06, w, 0], ['w', x0 + 0.06, cz, d, 1], ['e', x1 - 0.06, cz, d, 1],
      ];
      for (const [, sx, sz, len, alongZ] of sides) {
        const c = r() < 0.5 ? col : col2;
        const L2 = len * (0.5 + r() * 0.4), off = (r() - 0.5) * (len - L2);
        const y = Math.min(h - 0.35, 3.1 + r() * Math.max(0, h * 0.25));
        const tube = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.07 : L2, 0.07, alongZ ? L2 : 0.07), hot(c));
        this.place(tube, sx + (alongZ ? 0 : off), y, sz + (alongZ ? off : 0));
        const skirt = new THREE.Mesh(new THREE.BoxGeometry(alongZ ? 0.05 : len * 0.92, 0.05, alongZ ? len * 0.92 : 0.05), hot(c, 1.6));
        this.place(skirt, sx, 0.16, sz);
      }

      // Blade signs jutting from the walls, lit on both faces.
      const nblade = Math.min(9, Math.max(2, Math.round((w + d) / 9)));
      for (let i = 0; i < nblade; i++) {
        const side = Math.floor(r() * 4);
        const sw = 1.1 + r() * 0.9, sh = 0.55 + r() * 0.25, y = Math.min(h - 0.8, 2.9 + r() * 1.1);
        const c = PAL[Math.floor(r() * PAL.length)];
        const text = NAMES[Math.floor(r() * NAMES.length)];
        let px = 0, pz = 0, yaw = 0;
        if (side < 2) { px = x0 + 2 + r() * (w - 4); pz = side === 0 ? z0 + sw / 2 + 0.05 : z1 - sw / 2 - 0.05; yaw = side === 0 ? Math.PI / 2 : -Math.PI / 2; }
        else { pz = z0 + 2 + r() * (d - 4); px = side === 2 ? x0 + sw / 2 + 0.05 : x1 - sw / 2 - 0.05; yaw = side === 2 ? 0 : Math.PI; }
        if (nearDoor(px, pz, 1.4)) continue;
        for (const flip of [0, Math.PI]) {
          const s = this.sign(text, px, y, pz, yaw + flip, sw, sh, hex(c), 'rgba(10,4,20,0.9)');
          (s.material as THREE.MeshBasicMaterial).color.multiplyScalar(1.7);
          s.position.add(new THREE.Vector3(Math.sin(yaw + flip) * 0.012, 0, Math.cos(yaw + flip) * 0.012));
        }
        const glowbar = new THREE.Mesh(new THREE.BoxGeometry(side < 2 ? 0.05 : sw, 0.04, side < 2 ? sw : 0.05), hot(c));
        this.place(glowbar, px, y - sh / 2 - 0.02, pz);
      }

      // Big holographic adverts on the long walls of the tall rooms.
      if (h >= 6 && area > 300) {
        const n = area > 700 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const ad = ADS[Math.floor(r() * ADS.length)];
          const c1 = PAL[Math.floor(r() * PAL.length)], c2 = PAL[Math.floor(r() * PAL.length)];
          const cv = document.createElement('canvas');
          cv.width = 1024; cv.height = 512;
          const x = cv.getContext('2d')!;
          const g = x.createLinearGradient(0, 0, 1024, 512);
          g.addColorStop(0, hex(c1)); g.addColorStop(1, hex(c2));
          x.fillStyle = '#05030c'; x.fillRect(0, 0, 1024, 512);
          x.fillStyle = g; x.globalAlpha = 0.28; x.fillRect(0, 0, 1024, 512); x.globalAlpha = 1;
          x.strokeStyle = g; x.lineWidth = 10; x.strokeRect(14, 14, 996, 484);
          x.fillStyle = g; x.textAlign = 'center'; x.textBaseline = 'middle';
          x.font = '800 118px ui-sans-serif, Helvetica, Arial'; x.fillText(ad[0], 512, 210);
          x.font = '500 46px ui-monospace, Menlo, monospace'; x.fillStyle = '#ffffff'; x.fillText(ad[1].toUpperCase(), 512, 330);
          const tex = new THREE.CanvasTexture(cv);
          tex.colorSpace = THREE.SRGBColorSpace;
          const uni = { time: { value: 0 }, map: { value: tex } };
          const mat = new THREE.ShaderMaterial({
            uniforms: uni, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false,
            vertexShader: '#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);\n#include <logdepthbuf_vertex>\n}',
            fragmentShader: `#include <common>
              #include <logdepthbuf_pars_fragment>
              uniform sampler2D map; uniform float time; varying vec2 vUv;
              void main(){
                #include <logdepthbuf_fragment>
                float band = step(0.985, fract(sin(floor(time * 2.5) * 91.7 + floor(vUv.y * 12.0)) * 43758.5));
                vec2 uv = vUv + vec2(band * 0.04, 0.0);
                vec4 t = texture2D(map, uv);
                float scan = 0.82 + 0.18 * sin(vUv.y * 260.0 + time * 7.0);
                float flick = 0.92 + 0.08 * sin(time * 19.0 + vUv.x * 3.0);
                gl_FragColor = vec4(t.rgb * scan * flick * 1.9, 0.92);
              }`,
          });
          const bw = Math.min(9, w * 0.4), bh = bw * 0.5;
          const mesh = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), mat);
          const north = r() < 0.5;
          const bx = x0 + w * (0.25 + 0.5 * (i + r() * 0.4) / n);
          this.place(mesh, bx, Math.min(h - bh / 2 - 0.4, 4 + bh / 2), north ? z0 + 0.1 : z1 - 0.1, north ? 0 : Math.PI);
          this.anims.push((tm) => { uni.time.value = tm; });
        }
      }

      // Hanging cables across the room, a few sagging runs.
      if (h >= 3.5 && (w > 8 || d > 8)) {
        const runs = Math.min(7, Math.round(Math.max(w, d) / 6));
        for (let i = 0; i < runs; i++) {
          const along = w >= d;
          const t0 = (along ? z0 : x0) + 1 + r() * ((along ? d : w) - 2);
          const a = along ? new THREE.Vector3(x0 + 0.1, h - 0.25 - r() * 0.6, t0) : new THREE.Vector3(t0, h - 0.25 - r() * 0.6, z0 + 0.1);
          const b = along ? new THREE.Vector3(x1 - 0.1, h - 0.25 - r() * 0.6, t0 + (r() - 0.5) * 3) : new THREE.Vector3(t0 + (r() - 0.5) * 3, h - 0.25 - r() * 0.6, z1 - 0.1);
          const mid = a.clone().lerp(b, 0.5); mid.y -= 0.6 + r() * 1.1;
          const q1 = a.clone().lerp(mid, 0.5); q1.y -= 0.15;
          const q2 = mid.clone().lerp(b, 0.5); q2.y -= 0.15;
          const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, q1, mid, q2, b]), 24, 0.028 + r() * 0.02, 5), this.flat(0x0a0a10, { roughness: 0.5 }));
          tube.castShadow = false;
          this.scene.add(tube);
        }
      }

      // Market stalls with a vendor each, against the walls of the busy rooms.
      if (area >= 140 && !/bay|dock|hydro|workshop/i.test(room.name)) {
        const n = Math.min(7, Math.round(area / 110));
        for (let i = 0, tries = 0; i < n && tries < 60; tries++) {
          const side = Math.floor(r() * 4);
          let x = 0, z = 0, yaw = 0;
          if (side < 2) { x = x0 + 3 + r() * (w - 6); z = side === 0 ? z0 + 1.7 : z1 - 1.7; yaw = side === 0 ? 0 : Math.PI; }
          else { z = z0 + 3 + r() * (d - 6); x = side === 2 ? x0 + 1.7 : x1 - 1.7; yaw = side === 2 ? Math.PI / 2 : -Math.PI / 2; }
          if (nearDoor(x, z, 3.2) || !this.free(x, z) || !this.free(x + Math.sin(yaw) * 1.6, z + Math.cos(yaw) * 1.6)) continue;
          this.stall(x, z, yaw, PAL[Math.floor(r() * PAL.length)], NAMES[Math.floor(r() * NAMES.length)], h);
          i++;
        }
        this.crowd(x0 + 1.5, z0 + 1.5, x1 - 1.5, z1 - 1.5, Math.round(area / 50), false);
      } else if (area >= 140) {
        this.crowd(x0 + 1.5, z0 + 1.5, x1 - 1.5, z1 - 1.5, Math.round(area / 110), true);
      }
    });
  }

  /** A neon-lit stall: counter, shelves, a canopy, a sign and someone behind it. */
  stall(x: number, z: number, yaw: number, c: number, name: string[], h: number) {
    const c0 = Math.cos(yaw), s0 = Math.sin(yaw);
    const at = (lx: number, lz: number): [number, number] => [x + lx * c0 + lz * s0, z - lx * s0 + lz * c0];
    const hexs = '#' + c.toString(16).padStart(6, '0');
    const [bx, bz] = at(0, 0);
    this.box(2.4, 1.0, 0.7, 0x16181f, bx, bz, { yaw });
    const [sx, sz] = at(0, -1.3);
    this.box(2.4, 2.3, 0.3, 0x0e0f14, sx, sz, { yaw });
    for (const y of [0.7, 1.2, 1.7]) {
      const [lx, lz] = at(0, -1.14);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.035, 0.035), (() => { const m = new THREE.MeshBasicMaterial({ color: c }); m.color.multiplyScalar(2); return m; })());
      this.place(strip, lx, y + 0.4, lz, yaw);
    }
    const [ax, az] = at(0, 0.15);
    const canopy = this.box(2.8, 0.06, 1.6, 0x1c1224, ax, az, { y: 2.45, yaw, solid: false });
    canopy.rotation.x = 0.12;
    const [gx, gz] = at(0, 0.96);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.05, 0.05), (() => { const m = new THREE.MeshBasicMaterial({ color: c }); m.color.multiplyScalar(2.2); return m; })());
    this.place(edge, gx, 2.4, gz, yaw);
    const [nx, nz] = at(0, 0.97);
    const sign = this.sign(name, nx, Math.min(h - 0.4, 2.85), nz, yaw, 2.0, 0.5, hexs, 'rgba(10,4,20,0.9)');
    (sign.material as THREE.MeshBasicMaterial).color.multiplyScalar(1.7);
    const [px, pz] = at(0, -0.8);
    this.person(px, pz, yaw, this.r() < 0.5, false);
    this.blocks.pop();
    const [qx, qz] = at(0, 1.05);
    this.counters.push({ x: qx, z: qz, yaw });
  }

  // ---- what the crowd does: queues, people wandering from room to room, and conversations.
  // All of it is given to bystanders who were already standing about, so there is nobody extra
  // to draw; and it all happens after the rooms are dressed, with its own dice.

  private nearLane(x: number, z: number, pad = 0.85) {
    for (const l of this.lanes) {
      const t = Math.min(l.len, Math.max(0, (x - l.x) * l.fx + (z - l.z) * l.fz));
      if (Math.hypot(x - l.x - l.fx * t, z - l.z - l.fz * t) < pad) return true;
    }
    return false;
  }
  private nearFolk(x: number, z: number, pad: number, but?: Folk) {
    for (const f of this.folk) if (f !== but && Math.hypot(f.w.flat.x - x, f.w.flat.z - z) < pad) return true;
    return false;
  }
  /** Open floor all the way from one point to another. */
  private clearLine(a: XZ, b: XZ) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.4);
    for (let i = 0; i <= n; i++) if (!this.free(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false;
    return true;
  }
  /** A spot to stand: open floor with elbow room, out of the walkers' lanes and not on top of anyone. */
  private spot(p: XZ, but?: Folk) {
    if (!this.free(p.x, p.z) || this.nearLane(p.x, p.z) || this.nearFolk(p.x, p.z, 0.95, but)) return false;
    for (let i = 0; i < 4; i++) if (!this.free(p.x + Math.cos(i * 1.571) * 0.5, p.z + Math.sin(i * 1.571) * 0.5)) return false;
    return true;
  }
  /** Run `fn` as if this person were not standing there (their own feet block the floor otherwise). */
  private without<T>(f: Folk, fn: () => T): T {
    if (!f.stand) return fn();
    const r = f.stand.rect, keep = { ...r };
    r.x0 = r.x1 = r.z0 = r.z1 = 1e9;
    const out = fn();
    Object.assign(r, keep);
    return out;
  }
  /** A fixture becomes someone who can walk: the floor under them is free again. */
  private release(f: Folk) {
    if (!f.stand) return;
    const i = this.blocks.indexOf(f.stand.rect);
    if (i >= 0) this.blocks.splice(i, 1);
    f.stand.shadow.visible = false;
    f.stand = undefined;
  }
  /** Move a standing person (flat floors only), taking their shade and their bit of floor along. */
  private shift(f: Folk, x: number, z: number) {
    if (this.curveR || !f.stand || !this.without(f, () => this.spot({ x, z }, f))) return false;
    f.w.setPose(x, z, f.w.flat.yaw);
    f.stand.shadow.position.x = x; f.stand.shadow.position.z = z;
    Object.assign(f.stand.rect, { x0: x - 0.15, x1: x + 0.15, z0: z - 0.15, z1: z + 0.15 });
    return true;
  }
  private turn(f: Folk, yaw: number) {
    if (this.curveR) { f.w.flat.yaw = yaw; this.place(f.w.group, f.w.flat.x, 0, f.w.flat.z, yaw); }
    else f.w.setPose(f.w.flat.x, f.w.flat.z, yaw);
  }

  /** A walk from (x, z) through one of this room's doors to a spot in the room beyond: the point
   *  before the door, the point after it, and the spot. Nothing if no door can be reached in a
   *  straight line over open floor, or no spot turns up. */
  private plan(x: number, z: number): XZ[] | null {
    const q = this.q;
    const room = this.rooms.find((r) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1);
    const ds = room ? this.doorways.filter((d) => d.a === room || d.b === room) : [];
    for (let n = 0; n < 3 && ds.length; n++) {
      const d = ds[Math.floor(q() * ds.length)], sg = d.a === room ? -1 : 1, other = d.a === room ? d.b : d.a;
      const near = { x: d.x + d.nx * sg * 1.3, z: d.z + d.nz * sg * 1.3 }, far = { x: d.x - d.nx * sg * 1.3, z: d.z - d.nz * sg * 1.3 };
      if (!this.clearLine({ x, z }, near) || !this.clearLine(near, far)) continue;
      // Somewhere within about twenty metres of the door, so a walk is a walk and not a hike.
      const x0 = Math.max(other.x0 + 1.2, far.x - 20), x1 = Math.min(other.x1 - 1.2, far.x + 20);
      const z0 = Math.max(other.z0 + 1.2, far.z - 20), z1 = Math.min(other.z1 - 1.2, far.z + 20);
      for (let i = 0; i < 25; i++) {
        const to = { x: x0 + q() * (x1 - x0), z: z0 + q() * (z1 - z0) };
        // Not where another stroller is already heading.
        if (this.strollers.some((s) => s.to && Math.hypot(s.to.x - to.x, s.to.z - to.z) < 1.4)) continue;
        if (this.spot(to) && this.clearLine(far, to)) return [near, far, to];
      }
    }
    return null;
  }

  behave() {
    if (!peopleReady()) return;
    const q = this.q;
    const idle = (f: Folk) => !!f.loose && !!f.stand && !f.job;
    const dist = (f: Folk, p: XZ) => Math.hypot(f.w.flat.x - p.x, f.w.flat.z - p.z);

    // First, nobody stands in a walker's lane. (Bystanders were scattered after the lanes were
    // chosen, and some landed in them.) Each moves to the nearest clear spot.
    if (!this.curveR) for (const f of this.folk) {
      if (!idle(f) || !this.nearLane(f.w.flat.x, f.w.flat.z, 0.7)) continue;
      const { x, z } = f.w.flat;
      for (let i = 0; i < 60; i++) {
        const a = i * 2.4, d = 0.7 + i * 0.05;
        if (this.shift(f, x + Math.cos(a) * d, z + Math.sin(a) * d)) break;
      }
    }

    // Queues at some of the stalls and counters: two to four people in a line. Every so often
    // the one at the front is served and walks off, the rest shuffle up, and after a while the
    // one who left joins the back.
    if (!this.curveR) for (const c of this.counters) {
      if (this.queues.length >= 4 || q() > 0.75) continue;
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), want = 2 + Math.floor(q() * 3);
      const spots: XZ[] = [];
      for (let i = 0; i < want; i++) {
        const p = { x: c.x + fx * i * 0.8, z: c.z + fz * i * 0.8 };
        if (!this.free(p.x, p.z) || this.nearLane(p.x, p.z) || this.nearFolk(p.x, p.z, 0.75)) break;
        spots.push(p);
      }
      const pool = this.folk.filter(idle).filter((f) => dist(f, c) < 16).sort((a, b) => dist(a, c) - dist(b, c));
      spots.length = Math.min(spots.length, pool.length);
      if (spots.length < 2) continue;
      // Where the served one goes: a step to one side, then a spot a few metres off with a
      // clear walk there and a clear walk back to the end of the line.
      const tail = spots[spots.length - 1];
      let out: XZ | undefined, rest: XZ | undefined;
      for (const sd of q() < 0.5 ? [1, -1] : [-1, 1]) {
        const o = { x: spots[0].x + fz * sd * 1.1, z: spots[0].z - fx * sd * 1.1 };
        if (!this.free(o.x, o.z) || this.nearFolk(o.x, o.z, 0.6)) continue;
        for (let i = 0; i < 40 && !rest; i++) {
          const a = q() * 6.283, d = 3 + q() * 5, p = { x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d };
          if (spots.some((sp) => Math.hypot(sp.x - p.x, sp.z - p.z) < 1.8)) continue;
          // Behind the end of the line and on the side they stepped out to, so neither the walk
          // away nor the walk back cuts through the queue.
          if ((p.x - tail.x) * fx + (p.z - tail.z) * fz < 0.6 || ((p.x - tail.x) * fz - (p.z - tail.z) * fx) * sd < 0.9) continue;
          if (this.spot(p) && this.clearLine(o, p) && this.clearLine(p, tail)) { out = o; rest = p; }
        }
        if (rest) break;
      }
      if (!out || !rest) continue;
      const line = pool.slice(0, spots.length);
      line.forEach((f, i) => { this.release(f); f.job = 'queue'; f.w.setPose(spots[i].x, spots[i].z, c.yaw + Math.PI); });
      this.queues.push({ spots, yaw: c.yaw + Math.PI, line, out, rest, phase: 'wait', t: 4 + q() * 8, moves: [] });
    }

    // Strollers: a few bystanders who wander from room to room through the doors (see direct).
    if (!this.curveR && this.doorways.length) {
      const want = Math.min(10, Math.round(this.doorways.length * 1.5));
      const pool = this.folk.filter(idle).map((f) => ({ f, k: q() })).sort((a, b) => a.k - b.k);
      for (const { f } of pool) {
        if (this.strollers.length >= want) break;
        // Only those who can reach a door from where they stand.
        const room = this.rooms.find((r) => f.w.flat.x >= r.x0 && f.w.flat.x <= r.x1 && f.w.flat.z >= r.z0 && f.w.flat.z <= r.z1);
        const ok = room && this.without(f, () => this.doorways.some((d) => (d.a === room || d.b === room)
          && this.clearLine(f.w.flat, { x: d.x + d.nx * (d.a === room ? -1.3 : 1.3), z: d.z + d.nz * (d.a === room ? -1.3 : 1.3) })));
        if (!ok) continue;
        this.release(f);
        f.job = 'stroll';
        this.strollers.push({ f, t: q() * 14 });
      }
    }

    // Conversations: bystanders who happen to be near each other close up into twos and
    // threes, turn to face the middle and talk (the talking itself is in skinned.ts).
    const pool = this.folk.filter(idle);
    for (const f of pool) {
      if (f.job || q() > 0.3) continue;   // about a third of a crowd ends up talking
      const a = f.w.flat, here = this.roomAt(a.x, a.z);
      let g: Folk | undefined, best = this.curveR ? 2.6 : 4.5;
      for (const o of pool) {
        const d = dist(o, a);
        if (o !== f && !o.job && d < best && this.roomAt(o.w.flat.x, o.w.flat.z) === here) { best = d; g = o; }
      }
      if (!g) continue;
      const b = g.w.flat;
      // Talking distance is a little over a metre. If the other can't come that close, a pair
      // already within a couple of metres will still do.
      if (best > 1.5 || best < 0.95) {
        const ux = (b.x - a.x) / (best || 1), uz = (b.z - a.z) / (best || 1), d = 1.05 + q() * 0.3;
        if (!this.shift(g, a.x + ux * d, a.z + uz * d) && (best > 2.6 || best < 0.8)) continue;
      }
      const group = [f, g];
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      if (!this.curveR && q() < 0.4) {
        let o3: Folk | undefined, b3 = 3.5;
        for (const o of pool) { const d = dist(o, { x: mx, z: mz }); if (!o.job && !group.includes(o) && d < b3) { b3 = d; o3 = o; } }
        if (o3) {
          // The third stands off to one side of the pair, whichever side they are already on.
          const px = -(b.z - a.z), pz = b.x - a.x, pl = Math.hypot(px, pz) || 1;
          const sd = (o3.w.flat.x - mx) * px + (o3.w.flat.z - mz) * pz > 0 ? 1 : -1;
          if (this.shift(o3, mx + (px / pl) * sd * 1.0, mz + (pz / pl) * sd * 1.0)) group.push(o3);
        }
      }
      const cx = group.reduce((s, m) => s + m.w.flat.x, 0) / group.length, cz = group.reduce((s, m) => s + m.w.flat.z, 0) / group.length;
      const period = (5 + q() * 5) * group.length;
      group.forEach((m, i) => {
        m.job = 'talk';
        this.turn(m, Math.atan2(cx - m.w.flat.x, cz - m.w.flat.z) + (q() - 0.5) * 0.3);
        m.w.talk(i, group.length, period);
      });
    }
  }

  /** Each frame: send strollers on their next walk and move the queues along. */
  direct(dt: number) {
    const q = this.q;
    for (const s of this.strollers) {
      if (s.f.w.busy() || (s.t -= dt) > 0) continue;
      const p = this.plan(s.f.w.flat.x, s.f.w.flat.z);
      // The wait before the walk after this one starts counting when they arrive.
      if (p) { s.to = p[2]; s.f.w.walkTo(p, { face: q() * 6.283 }); s.t = 5 + q() * 16; } else s.t = 4;
    }
    for (const Q of this.queues) {
      for (const m of Q.moves) if (m.t > 0 && (m.t -= dt) <= 0) m.f.w.walkTo([m.to], { face: Q.yaw, polite: true });
      if (Q.phase === 'wait') {
        if ((Q.t -= dt) > 0 || Q.line.some((f) => f.w.busy())) continue;
        // Served. The one at the front steps out and walks off; the others shuffle up, each a
        // moment after the one in front of them.
        const f = Q.line.shift()!;
        Q.away = f;
        f.w.walkTo([Q.out, Q.rest]);
        Q.moves = Q.line.map((g, i) => ({ f: g, to: Q.spots[i], t: 1.2 + i * 0.7 }));
        Q.phase = 'away';
        Q.t = 6 + q() * 10;
      } else if (Q.phase === 'away') {
        if (Q.away!.w.busy() || (Q.t -= dt) > 0) continue;
        Q.away!.w.walkTo([Q.spots[Q.line.length]], { face: Q.yaw, polite: true });
        Q.line.push(Q.away!);
        Q.phase = 'back';
      } else if (!Q.away!.w.busy()) {
        Q.phase = 'wait';
        Q.t = 5 + q() * 10;
      }
    }
  }


  /** Your own ship on the pad, with the way back aboard. */
  parkShip(x: number, z: number, yaw: number) {
    const S = 15;
    const { group, plume } = playerShip();
    plume.visible = false;
    group.scale.setScalar(S);
    this.place(group, x, 3.5, z, yaw);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
    for (const [lx, lz] of [[0, -8], [3.4, 6], [-3.4, 6]]) {
      const [px, pz] = at(lx, lz);
      this.cyl(0.16, 2.3, 0x2d3238, px, pz, { solid: false });
      this.cyl(0.5, 0.1, 0x2d3238, px, pz, { solid: false });
    }
    this.block(x, z, 5, 22);
    const [rx, rz] = at(0, 12.5);
    const ramp = this.box(2, 0.12, 5, 0x3a3f46, rx, rz, { y: 0.9, yaw, solid: false });
    ramp.rotation.x = this.curveR ? 0 : 0.36;
    const [ex, ez] = at(0, 15.5);
    this.strip(ex, 0.03, ez, 2.4, 2.4, 0x2f6f4f);
    this.points.push({ x: ex, z: ez, r: 3, title: 'Your ship', text: 'Fuelled, cleared and waiting. Press E to board and undock.', kind: 'exit' });
    return at;
  }

  starfield(n = 2200) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = this.r() * 2 - 1, a = this.r() * 6.283, q = Math.sqrt(1 - y * y);
      pos.set([q * Math.cos(a) * 5000, y * 5000, q * Math.sin(a) * 5000], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false }));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
  }

  done(spawn: Place): Interior {
    // One box of light probes per room, 4 to 6 m apart, in one layer under a low ceiling and
    // two under a high one. A room's probes are all inside its own walls, which is what stops
    // light leaking through. The probes themselves were saved ahead of time; if the saved
    // file was made for other boxes the rooms have changed, and stale light would be wrong
    // light, so the place is lit the old way instead.
    const boxes = [...this.volumes];
    for (const r of this.rooms) {
      const w = r.x1 - r.x0, d = r.z1 - r.z0, step = Math.min(6, Math.max(4, Math.sqrt((w * d) / 40)));
      boxes.push({
        x0: r.x0, x1: r.x1, y0: 0, y1: r.h, z0: r.z0, z1: r.z1,
        nx: Math.max(1, Math.round(w / step)), ny: r.h < 4 ? 1 : 2, nz: Math.max(1, Math.round(d / step)), ...r.probe,
      });
    }
    if (this.bounce && !BAKING && !fits(SAVED, boxes)) {
      console.warn(`The saved light probes do not fit ${this.name}; going without. Run: bun tools/bake-probes.ts`);
      this.bounce = false;
    }
    if (!boxes.length) this.bounce = false;
    this.neon();
    // Wear and clutter go in after the furniture, the stalls and the people, and keep out of
    // their way; then the people are given things to do around all of it.
    this.wear();
    this.behave();
    // A place in the middle of a room may be under a parked ship or a table: nudge it to open floor.
    // It also wants elbow room, so you do not arrive nose to nose with someone.
    const roomy = (x: number, z: number) => {
      if (!this.free(x, z)) return false;
      for (let i = 0; i < 8; i++) if (!this.free(x + Math.cos(i * 0.785) * 2.4, z + Math.sin(i * 0.785) * 2.4)) return false;
      return true;
    };
    for (const pl of this.places) {
      let ok = roomy(pl.x, pl.z), fallback: [number, number] | null = null;
      for (let i = 0; i < 400 && !ok; i++) {
        const a = i * 2.4, d = 0.5 + i * 0.08;
        const x = pl.x + Math.cos(a) * d, z = pl.z + Math.sin(a) * d;
        if (roomy(x, z)) { pl.x = x; pl.z = z; ok = true; } else if (!fallback && this.free(x, z)) fallback = [x, z];
      }
      if (!ok && !this.free(pl.x, pl.z) && fallback) [pl.x, pl.z] = fallback;
    }
    // Shadows: everything solid receives them; props, people and plants cast them.
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !(m.material instanceof THREE.MeshStandardMaterial)) return;
      const mat = m.material;
      if (mat.transparent || mat.wireframe) { m.castShadow = false; return; }
      m.receiveShadow = true;
      const shell = m.geometry.type === 'PlaneGeometry' || m.geometry.type === 'CircleGeometry' || mat.side === THREE.BackSide;
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      const size = m.geometry.boundingSphere!.radius * Math.max(m.scale.x, m.scale.y, m.scale.z);
      m.castShadow = !shell && size < 40 && !m.userData.noShadow;
    });
    const key = new THREE.DirectionalLight(this.keyColor, this.keyPower);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const E = 46;
    Object.assign(key.shadow.camera, { left: -E, right: E, top: E, bottom: -E, near: 1, far: 220 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.05;
    this.scene.add(key, key.target);
    const up = new THREE.Vector3();
    // Lamps on the drum's axis (see aim).
    const axial: THREE.PointLight[] = [];
    if (this.curveR) this.scene.traverse((o) => {
      if (o instanceof THREE.PointLight && o.position.x === 0 && o.position.y === 0) { o.userData.base = o.intensity; axial.push(o); }
    });
    /** Set the lights as they are for someone standing at `cam`. */
    const aim = (cam: THREE.Vector3) => {
      for (const f of this.onCam) f(cam, key);
      if (this.curveR) {
        // In the drum the light comes from the axis, straight overhead wherever you stand.
        // The light probes are aimed from the axis itself, where no one direction is overhead:
        // for them the lamps along the axis shine with some of the key's strength instead
        // (all of it washes the drum out: the ground is all round you and all of it bounces).
        const axis = cam.x * cam.x + cam.y * cam.y < 1;
        key.intensity = axis ? 0 : this.keyPower;
        for (const l of axial) l.intensity = l.userData.base + (axis ? this.keyPower * 0.4 : 0);
        up.set(-cam.x, -cam.y, 0).normalize();
        key.target.position.copy(cam).addScaledVector(up, -1.7);
        key.position.copy(key.target.position).addScaledVector(up, 110);
      } else {
        key.target.position.set(cam.x, 0, cam.z);
        key.position.copy(key.target.position).addScaledVector(this.keyFrom, 110);
      }
    };
    let bounce: Bounce | undefined;
    if (this.bounce) {
      this.scene.traverse((o) => { if (o instanceof THREE.HemisphereLight) o.intensity *= FILL; });
      if (this.stars) this.unlit.push(this.stars);
      bounce = new Bounce(this.scene, boxes, aim, this.unlit);
      if (!BAKING) bounce.load(SAVED!);
    }
    let frame = 0;
    // What each person can see of the others (see Around in skinned.ts). There are at most a
    // couple of hundred people and only the ones walking look, so a plain pass over everyone
    // with a quick box test is cheaper than keeping a grid up to date: a few thousand
    // subtractions a frame.
    const n = this.folk.length;
    const X = new Float32Array(n), Z = new Float32Array(n), YAW = new Float32Array(n), MOVING = new Uint8Array(n);
    const around: Around = {
      px: 0, pz: 0, a: Infinity, n: 0, ls: new Float32Array(8), self: -1,
      free: (x, z) => this.free(x, z),
      ahead: (x, z, yaw) => {
        const s = Math.sin(yaw), c = Math.cos(yaw), ls = around.ls;
        let best = Infinity, m = 0;
        for (let i = -1; i < n; i++) {
          if (i === around.self) continue;
          // -1 is you. Someone walking is taken to be half a metre further on than they are:
          // where they will be by the time it matters, which is what lets people who are
          // about to cross paths see each other coming.
          let dx: number, dz: number;
          if (i < 0) { dx = around.px - x; dz = around.pz - z; }
          else { dx = X[i] - x; dz = Z[i] - z; }
          if (dx > 3.5 || dx < -3.5 || dz > 3.5 || dz < -3.5) continue;
          if (i >= 0 && MOVING[i]) {
            // Someone walking the same way is not in the way unless I am about to tread on them.
            if (Math.cos(YAW[i] - yaw) > 0.5 && dx * s + dz * c > 1) continue;
            // Where they really are still counts for not treading on them.
            const a0 = dx * s + dz * c, l0 = dx * c - dz * s;
            if (a0 > 0.05 && a0 < best && l0 < 0.42 && l0 > -0.42) best = a0;
            dx += Math.sin(YAW[i]) * 0.5; dz += Math.cos(YAW[i]) * 0.5;
          }
          const a = dx * s + dz * c;
          // From just behind the shoulder: people being passed still count for keeping clear.
          if (a < -0.6 || a > 2.6) continue;
          const l = dx * c - dz * s;
          if (l > 1.6 || l < -1.6) continue;
          if (m < 8) ls[m++] = l;
          // You take up a little more room than they do (see clearOfPeople).
          const wide = i < 0 ? 0.6 : 0.42;
          if (a > 0.05 && l < wide && l > -wide && a < best) best = a;
        }
        around.a = best; around.n = m;
      },
    };
    if (debugging) (globalThis as unknown as { __folk: () => unknown }).__folk = () => this.folk.map((f) => ({ x: f.w.flat.x, z: f.w.flat.z, yaw: f.w.flat.yaw, state: f.w.state(), glance: f.w.glance(), job: f.job ?? (f.stand ? 'stand' : 'pace') }));
    return {
      id: this.id, name: this.name, blurb: this.blurb, scene: this.scene, spawn, places: this.places, points: this.points, curveR: this.curveR, spin: SPIN[this.id], bounce,
      free: (x, z) => this.free(x, z),
      roomAt: (x, z) => this.roomAt(x, z),
      clearOfPeople: (x, z, r) => {
        if (this.curveR) return [x, z];
        for (const f of this.folk) {
          const p = f.w.group.position, dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), min = r + 0.28;
          if (d < min && d > 1e-4) { x = p.x + (dx / d) * min; z = p.z + (dz / d) * min; }
        }
        return [x, z];
      },
      tick: (t, dt, cam) => {
        // People near you animate every frame; further off, every 2nd, 4th or 8th frame, catching
        // up on the time they skipped. Only those close by cast shadows.
        frame++;
        // Where everyone is this frame, for looking where they are going. In a drum your place
        // on the floor is how far round the hull you are.
        if (this.curveR) { around.px = Math.atan2(cam.x, -cam.y) * this.curveR; around.pz = cam.z; }
        else { around.px = cam.x; around.pz = cam.z; }
        for (let i = 0; i < n; i++) {
          const w = this.folk[i].w, st = w.state();
          X[i] = w.flat.x; Z[i] = w.flat.z; YAW[i] = w.flat.yaw; MOVING[i] = st === 'walk' || st === 'turn' ? 1 : 0;
        }
        this.direct(dt);
        for (const f of this.folk) {
          f.acc += dt;
          const d2 = f.w.group.position.distanceToSquared(cam);
          const every = d2 < 400 ? 1 : d2 < 2025 ? 2 : d2 < 8100 ? 4 : 8;
          f.w.body.castShadow = d2 < 625;
          if ((frame + f.i) % every === 0) { around.self = f.i; f.w.update(f.acc, around); f.acc = 0; }
        }
        for (const a of this.anims) a(t, dt);
        this.stars?.position.copy(cam);
        aim(cam);
      },
    };
  }
}

// ------------------------------------------------------------------ Tycho

function tycho(): Interior {
  const k = new Kit('tycho', 'Tycho Station', 'Shipyard to the Belt. Clean corridors, careful engineers, and a view of whatever is being built next.');
  k.scene.background = new THREE.Color(0x000004);
  k.scene.add(new THREE.HemisphereLight(0xdfe8f2, 0x3a3f46, 0.5));
  k.starfield();

  const bay = k.room('Docking bay 7', -22, 0, 22, 52, 14, { floor: 'deck', wall: 'panel', glow: 0xfff2d8 }, Math.PI);
  const cor = k.room('Ring corridor', -3, 52, 3, 96, 3.6, { floor: 'white', wall: 'white', ceil: 'white', glow: 0xf2f8ff });
  const bar = k.room('Blauwe Blome', 3, 56, 25, 74, 4, { floor: 'tile', wall: 'panel', tint: 0xc9a98a, glow: 0xff9a5a }, -Math.PI / 2);
  const work = k.room('Engineering workshop', -29, 56, -3, 80, 6.5, { floor: 'deck', wall: 'panel', glow: 0xe8f2ff }, Math.PI / 2);
  const ops = k.room('Operations', 3, 76, 23, 94, 4, { floor: 'white', wall: 'panel', tint: 0xaab6c2, glow: 0x9fd0ff }, -Math.PI / 2);
  const gal = k.room('Yard gallery', -20, 96, 20, 114, 9, { floor: 'white', wall: 'white', glow: 0xdfe8f2 }, Math.PI);
  k.door(bay, cor, 0, 3.2);
  k.door(cor, bar, 65);
  k.door(work, cor, 68);
  k.door(cor, ops, 85);
  k.door(cor, gal, 0, 3.2);
  k.window(bay, 'n', -17, 17, 1.5, 11.5);
  k.window(gal, 's', -18, 18, 0.9, 8);
  k.finish();

  // Docking bay.
  k.parkShip(0, 20, 0);
  for (const [x, z] of [[-16, 8], [16, 10], [-16, 44], [15, 42], [-17, 26]]) k.crates(x, z, 4);
  for (const x of [-19, 19]) { k.cyl(1.3, 5, 0x9aa3ab, x, 34); k.cyl(1.3, 5, 0x9aa3ab, x, 30.5); }
  k.box(2.2, 2.6, 3.4, 0xc8662a, 12, 30, { yaw: 0.4 });
  k.box(1.2, 1.2, 1.2, 0x30363d, 12, 30, { y: 2.6, solid: false });
  k.sign('BAY 7', -21.9, 9, 26, Math.PI / 2, 10, 3, '#c8662a');
  k.sign(['TYCHO MANUFACTURING', '& ENGINEERING CONCERN'], 21.9, 9, 26, -Math.PI / 2, 14, 3, '#dfe8f2');
  k.sign('MAG BOOTS ON BEYOND THIS LINE', 0, 0.02, 4, 0, 14, 0.9, '#ffd24a').rotation.x = -Math.PI / 2;
  for (const [x, z] of [[-12, 14], [12, 14], [-12, 40], [12, 40]]) k.lamp(x, 12.5, z, 0xfff2d8, 240, 46);
  k.crowd(-18, 30, 18, 50, 5);
  k.placard(6, 47, Math.PI, 'Tycho Station',
    'A sphere half a kilometre across with two habitat rings turning in opposite directions around it, and drives big enough to move the whole yard wherever the work is. Tycho is owned by an Earth corporation and run, in practice, for the Belt. You are standing in one of the bays let into the sphere.');
  k.placard(-6, 47, Math.PI, 'What you can see outside',
    'Through the bay door: the Rocinante on a holding tether. She is a Martian Corvette-class frigate, about 46 metres from nose to drive cone. Tycho refitted her after her first battles and has been her home port ever since.');
  const roci = buildModel('corvette');
  roci.scale.setScalar(46);
  roci.position.set(26, 14, -70);
  roci.rotation.set(0.1, 2.2, 0.2);
  k.scene.add(roci);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
  sun.position.set(-300, 200, -400);
  k.scene.add(sun);

  // Corridor.
  // (Facing this wall, up the corridor is to your left and the bay to your right.)
  k.sign(['← WORKSHOP · BAR · OPS', 'DOCKING BAY 7 →'], -2.95, 2.3, 60, Math.PI / 2, 2.6, 0.7, '#c8662a', 'rgba(10,12,16,0.8)');
  k.lamp(0, 3.3, 62, 0xf2f8ff, 18, 16);
  k.lamp(0, 3.3, 78, 0xf2f8ff, 18, 16);
  k.lamp(0, 3.3, 91, 0xf2f8ff, 18, 16);
  k.placard(2.4, 74.5, -Math.PI / 2, 'Spin gravity',
    'The floor under you is the inside of a ring. It turns, and you are pressed outward against it; "down" is away from the hub. Pour a drink and the stream bends sideways as it falls. Belters learn to pour off-centre before they learn to walk. The corridor outside runs with the spin: run along it the way the ring turns and you weigh more, run the other way and you weigh less and your strides stretch out. The readout by the clock shows it.');
  k.crowd(-2, 54, 2, 94, 4);

  // The bar.
  k.box(9, 1.1, 0.8, 0x4a3324, 19, 58.2);
  k.box(9, 2.4, 0.4, 0x2a2f36, 19, 56.4, { solid: false });
  for (let i = 0; i < 16; i++) k.box(0.1, 0.3, 0.1, [0x7fe0a0, 0xffb347, 0x8fdcff, 0xff7a7a][i % 4], 15.2 + i * 0.5, 56.6, { y: 1.3 + (i % 2) * 0.6, solid: false });
  for (let i = 0; i < 6; i++) k.cyl(0.2, 0.75, 0x55504a, 15.5 + i * 1.4, 59.5, { solid: false });
  for (const [x, z] of [[8, 62], [8, 69], [14, 70], [20, 68], [14, 64]]) k.table(x, z);
  k.sign('BLAUWE BLOME', 14, 3.2, 73.9, Math.PI, 7, 1, '#6fa8ff');
  k.sign(['FUNGAL WHISKEY', 'REAL COFFEE (ASK)', 'RED KIBBLE · RICE'], 24.9, 2.2, 66, -Math.PI / 2, 3.4, 1.4, '#ffb347', 'rgba(10,6,4,0.85)');
  k.lamp(12, 3.5, 65, 0xff9a5a, 60, 18);
  k.lamp(20, 3.5, 60, 0x6fa8ff, 40, 14);
  k.crowd(5, 58, 23, 72, 9);
  // People wait their turn at the bar, between two of the stools.
  k.counters.push({ x: 17.6, z: 59.45, yaw: 0 });
  k.placard(5.5, 60, Math.PI / 2, 'Blauwe Blome',
    'The bar everyone on Tycho ends up in. Engineers off shift, ship crews waiting on a refit, and the occasional OPA officer pretending to be neither. The whiskey is grown in a vat and nobody mentions it.');

  // Workshop.
  const cone = k.cyl(3.2, 4.6, k.flat(0x8a9198, { metalness: 0.8, roughness: 0.3 }), -16, 68, { y: 1.2 }, 1.2);
  void cone;
  k.box(4.5, 1.2, 4.5, 0x30363d, -16, 68, { solid: false });
  for (const z of [58.5, 77.5]) { k.box(8, 0.95, 1.2, 0x55504a, -18, z); k.console(-24, z, z < 60 ? 0 : Math.PI, ['REACTION MASS', 'FEED 99.2%', 'COIL TEMP OK']); }
  k.box(1, 4, 1, 0xc8662a, -26, 68);
  k.box(5, 0.5, 0.5, 0xc8662a, -24, 68, { y: 4, solid: false });
  k.crates(-8, 76, 3);
  k.lamp(-16, 6, 68, 0xe8f2ff, 160, 26);
  k.crowd(-27, 58, -5, 78, 4);
  k.placard(-8, 62, -Math.PI / 2, 'The Epstein drive',
    'A fusion drive efficient enough to burn for weeks instead of minutes. Its inventor tested it on his own yacht, could not reach the cut-off under the acceleration, and is still out there somewhere. Mars got the patent; everyone else got the solar system. This bell is from a small freighter.');

  // Operations.
  for (let i = 0; i < 4; i++) k.console(7 + i * 4, 78, 0, [['DOCK QUEUE', 'BAY 7  HELD', 'BAY 3  FREE'], ['RING A  0.31G', 'RING B  0.31G', 'SPIN NOMINAL'], ['TRAFFIC', 'CERES  11 SHIPS', 'PALLAS  4 SHIPS'], ['YARD', 'HULL 14  62%', 'WELD CREW  C']][i]);
  const holo = buildModel('tycho');
  holo.scale.setScalar(1.6);
  holo.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = new THREE.MeshBasicMaterial({ color: 0x4fc8ff, wireframe: true, transparent: true, opacity: 0.5 }); });
  holo.position.set(13, 1.9, 87);
  k.scene.add(holo);
  k.anims.push((_t, dt) => { holo.rotation.y += dt * 0.3; holo.userData.anim?.(dt); });
  k.cyl(1.2, 0.8, 0x20252b, 13, 87);
  k.sign(['TYCHO OPERATIONS', 'ALL BERTHS UNDER POSITIVE CONTROL'], 13, 3, 93.9, Math.PI, 9, 1.2, '#7fe0ff', 'rgba(4,14,22,0.9)');
  k.lamp(13, 3.5, 85, 0x9fd0ff, 60, 18);
  k.crowd(5, 80, 21, 92, 4);
  k.placard(5.5, 90, Math.PI / 2, 'The biggest job',
    'Tycho\'s engineers spun up Ceres and Eros, which is to say they gave gravity to rocks. Their largest single contract was the Nauvoo: a generation ship two kilometres long, ordered by the Mormon church to carry its people to another star over a hundred years. It never made that trip. You can visit it; it is called Medina Station now.');

  // Yard gallery, looking out on a hull under construction.
  for (const x of [-12, -4, 4, 12]) k.box(4, 0.5, 0.9, 0x6a7078, x, 108);
  k.box(36, 1.0, 0.12, 0x9aa3ab, 0, 113.2, { solid: false });
  k.lamp(0, 8.4, 104, 0xdfe8f2, 70, 30);
  k.placard(-15, 100, Math.PI / 2, 'The yard',
    'Hulls are assembled in vacuum inside a cage of gantries. Welding crews work in shifts around the clock; the blue-white flicker is theirs. A hull this size takes years.');
  k.placard(15, 100, -Math.PI / 2, 'Who works here',
    'Mostly Belters: tall, long-boned people raised in low gravity who cannot comfortably visit the planets their employers come from. They build the ships. Until recently they were not allowed to own any with guns.');
  const hull = buildModel('hauler');
  hull.scale.setScalar(520);
  hull.position.set(40, -30, 420);
  hull.rotation.y = 1.1;
  hull.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && (m.material as THREE.Material).type === 'MeshStandardMaterial' && k.r() < 0.45) m.material = new THREE.MeshStandardMaterial({ color: 0x6a7078, wireframe: true }); });
  k.scene.add(hull);
  const cage = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(120, 2, 4, 4), new THREE.MeshStandardMaterial({ color: 0xc8662a, roughness: 0.6 }));
    ring.position.z = -240 + i * 80;
    ring.rotation.z = Math.PI / 4;
    cage.add(ring);
  }
  cage.position.copy(hull.position);
  cage.rotation.y = 1.1 + Math.PI / 2;
  k.scene.add(cage);
  const sparks: THREE.Sprite[] = [];
  for (let i = 0; i < 9; i++) {
    const s = glowSprite(0xbfe0ff, 26);
    s.position.set(40 + (k.r() - 0.5) * 380, -30 + (k.r() - 0.5) * 90, 420 + (k.r() - 0.5) * 300);
    k.scene.add(s);
    sparks.push(s);
  }
  k.anims.push((t) => sparks.forEach((s, i) => (s.material.opacity = Math.sin(t * (7 + i)) * Math.sin(t * 1.3 + i * 2) > 0.45 ? 1 : 0)));
  k.crowd(-18, 98, 18, 106, 5);

  // A working yard kept clean: light scuffing, little litter, tidy pipework.
  k.style = { grime: 0.28, dirt: 0x1c2024, worn: 0x20262c, wornA: 0.16, drips: 0.08, litter: 0.03, posters: 0.06, pipes: [0x8a9198, 0xc8662a, 0x5a7a9a], duct: 0xb8c0c6, rooms: { 'Docking bay 7': 0.5, 'Engineering workshop': 0.55 } };
  k.dress = (d, s) => dressTycho(k, d, s);
  return k.done({ name: 'Docking bay 7', x: 0, z: 38, yaw: Math.PI });
}

// ------------------------------------------------------------------ Ceres

function ceres(): Interior {
  const k = new Kit('ceres', 'Ceres Station', 'Six million people in tunnels cut through a spinning rock. Loud, crowded, and short of water.');
  k.scene.background = new THREE.Color(0x030405);
  k.scene.fog = new THREE.FogExp2(0x241c16, 0.012);
  const hemi = new THREE.HemisphereLight(0xc9b8a0, 0x2a241e, 0.55);
  k.scene.add(hemi);
  k.starfield();

  const dock = k.room('Dock 14', -18, 0, 18, 40, 12, { floor: 'deck', wall: 'grime', glow: 0xffe2b8 }, Math.PI);
  const tun = k.room('Customs tunnel', -2.5, 40, 2.5, 60, 3.2, { floor: 'grime', wall: 'rock', ceil: 'rock', glow: 0xffd9a0 });
  const mkt = k.room('The Medina', -22, 60, 22, 104, 8, { floor: 'tile', wall: 'rock', ceil: 'rock' }, Math.PI);
  const tube = k.room('Tube station', -46, 72, -22, 88, 5, { floor: 'tile', wall: 'grime', glow: 0xdfe8f2 }, Math.PI / 2);
  const frog = k.room('The Blue Frog', 22, 62, 42, 80, 3.6, { floor: 'grime', wall: 'grime', tint: 0x8a8ab0 }, -Math.PI / 2);
  const helix = k.room('Star Helix station house', 22, 84, 42, 102, 3.6, { floor: 'tile', wall: 'panel', tint: 0xa8b0b8, glow: 0xdfe8f2 }, -Math.PI / 2);
  const hydro = k.room('Hydroponics', -16, 104, 16, 130, 6, { floor: 'grime', wall: 'grime' }, Math.PI);
  k.door(dock, tun, 0);
  k.door(tun, mkt, 0);
  k.door(tube, mkt, 80, 4);
  k.door(mkt, frog, 71);
  k.door(mkt, helix, 93);
  k.door(mkt, hydro, 0, 3);
  const CW = 8, CZ0 = 130, CZ1 = 310, CH = 3.6;
  const con = k.room('The Concourse', -CW, CZ0, CW, CZ1, CH, { floor: 'grime', wall: 'white', open: true, calm: true, floorTint: 0xb9bdc1 }, Math.PI);
  k.places[k.places.length - 1].z = CZ0 + 9;
  // The street's probes take in the terraces up both walls as well, so they are lit the same way.
  con.probe = { x0: -26, x1: 26, y1: 26, nx: 6, ny: 3, nz: 12 };
  k.door(hydro, con, 0, 3.4);
  k.window(dock, 'n', -14, 14, 2, 10);
  k.finish();

  // Dock.
  k.parkShip(0, 16, 0);
  for (const [x, z] of [[-13, 8], [13, 9], [-13, 32], [13, 30], [-14, 20]]) k.crates(x, z, 5);
  k.sign('DOCK 14', -17.9, 8, 20, Math.PI / 2, 9, 2.6, '#ffb347');
  k.sign(['CERES PORT AUTHORITY', 'DECLARE ALL WATER'], 17.9, 8, 20, -Math.PI / 2, 12, 2.6, '#dfe8f2');
  for (const [x, z] of [[-10, 12], [10, 12], [0, 32]]) k.lamp(x, 11, z, 0xffe2b8, 420, 40);
  k.crowd(-16, 26, 16, 38, 6);
  const out = buildModel('hauler');
  out.scale.setScalar(300);
  out.position.set(-120, 40, -420);
  out.rotation.y = 0.8;
  k.scene.add(out);
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
  sun.position.set(300, 200, -400);
  k.scene.add(sun);
  k.placard(6, 36, Math.PI, 'Ceres Station',
    'The largest body in the Belt and its busiest port. Tycho\'s engineers spent the better part of a decade spinning the whole dwarf planet up until the tunnels inside had about a third of a g. Around six million people live here, and up to a million more are passing through at any time.');
  k.placard(-6, 36, Math.PI, 'Ice',
    'Ceres once had water of its own and sold it. Now every litre is hauled in: ice cut from Saturn\'s rings, carried here by ships like the Canterbury, and metered out. On Ceres the price of water is the news.');

  k.sign(['CUSTOMS', 'HAVE TERMINALS READY'], 2.45, 2.2, 50, -Math.PI / 2, 3, 0.8, '#ffb347', 'rgba(10,8,4,0.8)');
  k.lamp(0, 2.9, 50, 0xffd9a0, 30, 14);

  // The Medina: market stalls under the rock.
  const stalls: [number, number, string, number, string][] = [
    [-15, 66, 'NOODLES', 0xb5432a, '#ffb347'], [-15, 96, 'RED KIBBLE', 0x8a5a2a, '#ff7a5a'], [15, 66, 'TEA · REAL LEAF', 0x3a6a4a, '#7fe0a0'],
    [-5, 76, 'HAND TERMINALS', 0x2f4a7a, '#8fdcff'], [6, 84, 'AIR FILTERS', 0x55504a, '#dfe8f2'], [-8, 92, 'FUNGAL CURRY', 0x8a7a2a, '#ffd24a'],
    [14, 98, 'VAT-GROWN', 0x6a3a5a, '#ff9ad0'], [-14, 84, 'WATER 3 SCRIP/L', 0x2a5a7a, '#6fd0ff'],
  ];
  for (const [x, z, label, col, neon] of stalls) {
    k.box(3.6, 1, 1.4, 0x3a342e, x, z);
    for (const sx of [-1.7, 1.7]) k.box(0.1, 2.9, 0.1, 0x2d2a26, x + sx, z - 0.6, { solid: false });
    const awn = k.box(4.2, 0.08, 2.6, col, x, z, { y: 2.9, solid: false });
    awn.rotation.x = 0.18;
    k.sign(label, x, 2.45, z + 0.72, 0, 3.4, 0.5, neon, 'rgba(8,6,4,0.8)');
    k.sign(label, x, 2.45, z - 0.72, Math.PI, 3.4, 0.5, neon, 'rgba(8,6,4,0.8)');
    for (let i = 0; i < 5; i++) k.box(0.4, 0.3, 0.4, [0xc9a23a, 0x8a3a2a, 0x4a7a4a, 0xdfe8f2][i % 4], x - 1.3 + i * 0.65, z, { y: 1, solid: false });
    k.person(x + (k.r() - 0.5), z - 1.3, 0, true);
    k.counters.push({ x, z: z + 1.3, yaw: 0 });
  }
  k.cyl(2.2, 0.7, 0x4a443c, 0, 70);
  const trunk = k.cyl(0.18, 3.6, 0x4a3a2a, 0, 70, { y: 0.7, solid: false });
  void trunk;
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + k.r() * 0.6, 0), k.flat(0x4a6a3a, { flatShading: true }));
    k.place(leaf, (k.r() - 0.5) * 2.4, 4 + k.r() * 1.6, 70 + (k.r() - 0.5) * 2.4);
  }
  for (let i = 0; i < 5; i++) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 44, 8), k.flat(i % 2 ? 0x6a4a3a : 0x4a5a62, { metalness: 0.5 }));
    pipe.rotation.z = Math.PI / 2;
    k.place(pipe, 0, 7.2 - (i % 2) * 0.5, 64 + i * 9);
  }
  k.sign(['WATER RATION TODAY', '11.5 L / PERSON', 'NEXT HAULER: DELAYED'], 0, 5.2, 103.9, Math.PI, 9, 2.4, '#6fd0ff', 'rgba(2,10,18,0.9)');
  k.sign('PINKWATER SECURITY — NO', -21.9, 3, 66, Math.PI / 2, 5, 0.6, '#ff7a5a');
  k.sign('OPA', -21.9, 4.2, 96, Math.PI / 2, 3, 1.6, '#c8662a');
  k.sign('ROSSE BUURT ↓ 3 LEVELS', 21.9, 4.6, 77, -Math.PI / 2, 5.5, 0.6, '#ff9ad0');
  for (const [x, z, c] of [[-10, 70, 0xffb070], [10, 72, 0xffd9a0], [-10, 90, 0xffc890], [10, 94, 0xffb070], [0, 82, 0xffe2b8]] as const) k.lamp(x, 5.6, z, c, 75, 24);
  k.crowd(-20, 62, 20, 102, 26);
  k.placard(3.5, 63, Math.PI, 'The Medina',
    'The market level where most of Ceres passes through at least once a day. Food here is grown in vats and on fungal racks: kibble, rice, noodles, curry that has never met an animal. The tree is real and has its own water allowance.');
  k.placard(-3.5, 100, Math.PI, 'Up and down',
    'Ceres spins, so "down" is outward toward the surface, where gravity is strongest. The governor and the money live out there. The poor live inward, nearer the axis, where the pull is weak, the Coriolis is strong enough to make you stumble, and the air is whatever is left.');

  // Tube station.
  k.box(22, 1.2, 4, 0x1c1f23, -34, 86.4, { solid: true });
  const car = new THREE.Mesh(new THREE.CapsuleGeometry(1.5, 14, 6, 14), k.flat(0xb8bec4, { metalness: 0.6, roughness: 0.3 }));
  car.rotation.z = Math.PI / 2;
  k.place(car, -34, 2.3, 86.3);
  for (let i = 0; i < 6; i++) k.box(1.4, 0.8, 0.06, k.flat(0xffe9b8, { emissive: 0xffe9b8 }), -39.5 + i * 2.2, 84.75, { y: 2.2, solid: false });
  k.sign(['TUBE — SPINWARD', 'GOVERNOR\'S QUARTER 4 MIN', 'DOCKS 2 MIN · ROSSE BUURT 6 MIN'], -34, 3.6, 72.1, 0, 10, 1.6, '#dfe8f2', 'rgba(6,8,12,0.9)');
  for (const x of [-42, -34, -26]) k.box(2.4, 0.45, 0.6, 0x55504a, x, 74);
  k.lamp(-34, 4.6, 79, 0xdfe8f2, 110, 22);
  k.crowd(-45, 74, -24, 83, 7);
  k.placard(-24, 75, -Math.PI / 2, 'The tube',
    'Pressurised trains run through the rock between the districts. A ride is free; the station takes it out of you in air tax instead. Hold the rail when it starts: the car accelerates along the spin, and for a moment you weigh rather more than you are used to.');

  // The Blue Frog.
  k.box(0.8, 1.1, 10, 0x2a2440, 40, 71);
  for (let i = 0; i < 6; i++) k.cyl(0.2, 0.75, 0x3a3648, 38.8, 67 + i * 1.6, { solid: false });
  for (let i = 0; i < 14; i++) k.box(0.1, 0.3, 0.1, [0x6fa8ff, 0x7fe0a0, 0xff7ad0][i % 3], 41.7, 66.5 + i * 0.65, { y: 1.3 + (i % 2) * 0.5, solid: false });
  for (const [x, z] of [[27, 65], [27, 71], [27, 77], [33, 68], [33, 75]]) k.table(x, z);
  k.sign('THE BLUE FROG', 32, 2.9, 62.1, 0, 6, 0.9, '#4f8fff');
  k.sign(['TONIGHT', 'HALF-PRICE BOURBON', '(IT IS NOT BOURBON)'], 32, 2, 79.9, Math.PI, 4, 1.4, '#ff7ad0', 'rgba(10,4,14,0.85)');
  k.lamp(32, 3.2, 70, 0x4f6fff, 55, 18);
  k.lamp(38, 3.2, 76, 0xff5ab0, 28, 12);
  k.crowd(24, 64, 38, 78, 10);
  k.placard(24, 74, Math.PI / 2, 'The Blue Frog',
    'A port bar: cheap, dim, and the right place to find a ship\'s crew or lose a detective. The house bourbon is distilled from a fungus. Regulars claim to prefer it.');

  // Star Helix.
  for (const [x, z] of [[27, 88], [33, 88], [27, 96], [33, 96]]) k.console(x, z, Math.PI, ['CASE FILE', 'STATUS: OPEN', 'ASSIGNED: —']);
  for (let i = 0; i < 9; i++) k.cyl(0.05, 3.6, k.flat(0x8a9198, { metalness: 0.8 }), 38, 85 + i * 0.5, { solid: false });
  k.block(38, 87, 0.3, 5);
  k.box(1.8, 0.4, 0.7, 0x55504a, 40.5, 86);
  k.sign(['STAR HELIX SECURITY', 'CERES STATION DETACHMENT'], 32, 2.9, 101.9, Math.PI, 8, 1, '#dfe8f2', 'rgba(8,12,18,0.9)');
  k.sign(['MISSING PERSONS', '— 41 OPEN —'], 22.1, 2.2, 97, Math.PI / 2, 3, 1, '#ffb347', 'rgba(10,8,4,0.85)');
  k.lamp(32, 3.3, 92, 0xdfe8f2, 60, 18);
  k.crowd(24, 86, 36, 100, 5, false);
  k.placard(24, 86, Math.PI / 2, 'Star Helix Security',
    'Ceres has no police of its own. An Earth corporation holds the contract to keep order, and hires locally. Its officers are Belters paid by Earth to arrest Belters, and most of them have made a kind of peace with that.');

  // Hydroponics.
  for (let row = 0; row < 4; row++) {
    const x = -10.5 + row * 7;
    k.box(0.3, 3.6, 18, 0x2d3238, x, 118);
    for (const y of [0.6, 1.7, 2.8]) k.box(1.5, 0.08, 18, 0x3a4048, x, 118, { y, solid: false });
    for (let i = 0; i < 9; i++) {
      for (const y of [1, 2.1, 3.2]) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), k.flat([0x3f7a3a, 0x5a9a48, 0x2f6a30][(i + row) % 3], { flatShading: true }));
        leaf.scale.set(1.8, 0.7, 1);
        k.place(leaf, x, y, 110 + i * 2);
      }
    }
    k.strip(x, 3.75, 118, 1.6, 18, 0xff5ad0);
  }
  for (const x of [-13.5, 13.5]) k.cyl(1.4, 4.5, k.flat(0x4a6a8a, { metalness: 0.6, roughness: 0.3 }), x, 127);
  k.lamp(-6, 5.4, 114, 0xff7ad8, 110, 22);
  k.lamp(6, 5.4, 122, 0xff7ad8, 110, 22);
  k.placard(0, 107, Math.PI, 'Air and food',
    'Every breath on Ceres has been through a plant or a machine first. Racks like these scrub carbon dioxide and grow part of the station\'s food under light tuned to what leaves actually use, which is why the room is pink. A failed harvest here is an air problem before it is a food problem.');

  // The Concourse: a residential street under a sky-lit vault, housing terraced up both walls.
  {
    const planters: [number, number, number][] = [], bikes: [number, number, number][] = [];
    for (let z = CZ0 + 12, i = 0; z < CZ1 - 8; z += 13, i++) {
      const x = (i % 2 ? 1 : -1) * 4.7, L = 4 + k.r() * 2.5;
      k.box(1.5, 0.55, L, k.mat('grime', 0xc9ccce), x, z);
      planters.push([x, z, L]);
      if (i % 3 === 1) k.box(0.55, 0.45, 2.2, 0x6a5a48, -x * 1.2, z + 2);
      if (i % 4 === 2) for (let b = 0; b < 3; b++) bikes.push([x - Math.sign(x) * 1.25, z - 1 + b * 0.7, Math.PI / 2 + (k.r() - 0.5) * 0.3]);
    }
    k.scene.add(buildConcourse(k.r, { W: CW, z0: CZ0, z1: CZ1, wallH: CH, planters, bikes }));
    // Old, crowded and short of water for cleaning: grime everywhere but the station house.
    k.style = { grime: 0.9, dirt: 0x1a120a, worn: 0x8a7a68, wornA: 0.2, drips: 0.8, litter: 0.7, posters: 0.8, pipes: [0x6a4a3a, 0x4a5a62, 0x7a6a3a], duct: 0x5d5b55, rooms: { 'Star Helix station house': 0.3 } };
    k.dress = (d, s) => dressCeres(k, d, s, CW, CZ0, CZ1, planters);
    // The gutter down the middle, and a band of darker paving each side of it.
    for (const [x, w, c] of [[0, 0.45, 0x2f3438], [-2.2, 0.12, 0x6f757a], [2.2, 0.12, 0x6f757a]] as const) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, CZ1 - CZ0 - 2), k.flat(c, { roughness: 0.6 }));
      k.place(m, x, 0.011, (CZ0 + CZ1) / 2);
    }
    const SHOPS = ['BAKERY', 'TEA HOUSE', 'REPAIRS', 'CLINIC', 'LAUNDRY', 'GREENGROCER', 'TOOLS', 'BOOKS · USED', 'TAILOR', 'NOODLE BAR', 'SCHOOL 14', 'AIR & FILTERS'];
    for (let z = CZ0 + 7, i = 0; z < CZ1 - 6; z += 12.4, i++) {
      for (const sd of [-1, 1]) k.sign(SHOPS[(i * 2 + (sd > 0 ? 1 : 0)) % SHOPS.length], sd * (CW - 0.1), 3.05, z + (sd > 0 ? 3.1 : 0), -sd * Math.PI / 2, 3.2, 0.42, sd > 0 ? '#ffe2b8' : '#dfeeff', 'rgba(24,30,36,0.9)');
    }
    // Public screens set into the first terrace.
    const SCREENS: [number, number, string[], string][] = [
      [1, CZ0 + 30, ['CERES TRANSIT', 'mind the spin · hold the rail'], '#9fe0ff'], [-1, CZ0 + 62, ['WATER BOARD', 'ration today 11.5 L'], '#ffd27a'],
      [1, CZ0 + 104, ['LUNA·MART', 'everything. eventually.'], '#b8ffcf'], [-1, CZ0 + 140, ['CONCOURSE NEWS', 'next hauler: delayed'], '#ffb0a0'],
    ];
    for (const [sd, z, lines, col] of SCREENS) {
      const x = sd * (terraceFront(CW, 1) - 1.75), frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.4, 7.4), k.flat(0x1c2228, { roughness: 0.4 }));
      k.place(frame, x + sd * 0.2, CH + 2.9, z);
      const scr = k.sign(lines, x, CH + 2.9, z, -sd * Math.PI / 2, 7, 4, col, 'rgba(14,20,30,0.96)');
      (scr.material as THREE.MeshBasicMaterial).color.multiplyScalar(1.25);
    }
    k.sign(['THE CONCOURSE', 'LEVEL 3 · SPINWARD'], 0, CH + 4.5, CZ0 + 0.1, 0, 14, 3, '#2a3a46');
    k.plainPeople = true;
    // Walkers near the door, pacing the street both ways.
    for (let i = 0; i < 8; i++) {
      // Those heading back towards the door start at the far end of their line.
      const sd = i % 2 ? 1 : -1, belter = k.r() < 0.7, beat = 10 + k.r() * 8, z = CZ0 + 10 + i * 3.2;
      k.walker(sd * (1.6 + k.r() * 1.8), sd > 0 ? z : z + beat, sd > 0 ? 0 : Math.PI, beat, belter);
    }
    k.walker(-0.9, CZ0 + 12, Math.PI / 2, 0, true);
    k.walker(0.9, CZ0 + 12, -Math.PI / 2, 0, false);
    k.places.push({ name: 'Concourse entrance', x: 0, z: CZ0 + 2, yaw: Math.PI });
    k.crowd(-CW + 1, CZ0 + 14, -1.2, CZ1 - 6, 22, true);
    k.crowd(1.2, CZ0 + 14, CW - 1, CZ1 - 6, 22, true);
    // Knots of people stopped under each screen.
    for (const [sd, z] of SCREENS) k.crowd(sd * 2, z - 4, sd * 6.5, z + 4, 5, true);
    k.plainPeople = false;
    k.placard(3.2, CZ0 + 5, Math.PI, 'The Concourse',
      'Most of Ceres does not live in the docks or the market. It lives on streets like this one: homes stacked in terraces up the curve of the rock, shops underneath, and a ceiling of light panels made up to look like a sky nobody here has ever stood under. The plants are real and are counted in the air budget.');
    k.placard(-3.2, CZ0 + 44, Math.PI, 'Living on the curve',
      'The street is level because it follows the spin; the terraces climb because the wall does. Homes higher up the curve are a little lighter underfoot and a little cheaper. Belters raised here grow tall and slight, and find a planet\'s full gravity hard to bear. Run along the street away from the entrance, the way the rock turns, and you are a little heavier; run back and you are a little lighter.');
    // Daylight in here, the dark of the tunnels everywhere else: blend as you walk through the door.
    const dayFog = new THREE.Color(0xbfd0df), daySky = new THREE.Color(0xe8f1fb), dayKey = new THREE.Color(0xfff6e8);
    let base: { fog: THREE.Color; dens: number; hemi: number; sky: THREE.Color; key: number; keyC: THREE.Color } | null = null;
    k.onCam.push((cam, key) => {
      const fog = k.scene.fog as THREE.FogExp2;
      base ??= { fog: fog.color.clone(), dens: fog.density, hemi: hemi.intensity, sky: hemi.color.clone(), key: key.intensity, keyC: key.color.clone() };
      const u = Math.min(1, Math.max(0, (cam.z - (CZ0 - 3)) / 8)), b = u * u * (3 - 2 * u);
      fog.color.lerpColors(base.fog, dayFog, b);
      fog.density = base.dens + (0.0068 - base.dens) * b;
      // With bounce light the sky panels and white walls light the street themselves, so the
      // flat fill and the key both come down or the terraces wash out.
      hemi.intensity = base.hemi + ((k.bounce ? 0.5 : 1.1) - base.hemi) * b;
      hemi.color.lerpColors(base.sky, daySky, b);
      key.intensity = base.key + ((k.bounce ? 1.9 : 2.1) - base.key) * b;
      key.color.lerpColors(base.keyC, dayKey, b);
    });
  }

  return k.done({ name: 'Dock 14', x: 0, z: 33, yaw: Math.PI });
}

// ----------------------------------------------------------------- Medina

function medina(): Interior {
  const R = 250, L = 1000;
  const k = new Kit('medina', 'Medina Station', 'Inside the drum: two kilometres of farmland rolled into a tube, with a line of light for a sun.');
  k.curveR = R;
  k.bounds = { x0: 0, x1: 0, z0: -L / 2 + 12, z1: L / 2 - 12 };
  k.scene.background = new THREE.Color(0x8fa9bd);
  k.scene.fog = new THREE.FogExp2(0x9db5c8, 0.0011);
  k.scene.add(new THREE.HemisphereLight(0xffffff, 0x8fa9bd, 0.55));
  k.keyPower = 1.5;
  k.keyColor = 0xfff2d8;
  for (const z of [-300, 0, 300]) {
    const l = new THREE.PointLight(0xfff2d8, 0.45, 0, 0);
    l.position.set(0, 0, z);
    k.scene.add(l);
  }
  const tex = surf('fields').clone();
  tex.repeat.set(6, 4);
  tex.needsUpdate = true;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, DRUM_SIDES, 16, true).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, side: THREE.BackSide, roughness: 0.95 }));
  k.scene.add(drum);
  const sunTube = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, L * 0.94, 12).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false }));
  k.scene.add(sunTube);
  for (let i = 0; i < 9; i++) {
    const s = glowSprite(0xfff2d0, 120, 0.5);
    s.position.z = -420 + i * 105;
    (s.material as THREE.SpriteMaterial).fog = false;
    k.scene.add(s);
  }
  for (const s of [1, -1]) {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(R, 96), k.mat('panel', 0x9aa6b0));
    cap.position.z = (s * L) / 2;
    if (s > 0) cap.rotation.y = Math.PI;
    k.scene.add(cap);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(34, 46, 26, 24).rotateX(Math.PI / 2), k.flat(0x6a7480, { metalness: 0.5 }));
    hub.position.z = s * (L / 2 - 13);
    k.scene.add(hub);
    for (let i = 0; i < 6; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(5, R * 2, 3), k.flat(0x7a8590, { metalness: 0.4 }));
      spoke.rotation.z = (i * Math.PI) / 6;
      spoke.position.z = s * (L / 2 - 4);
      k.scene.add(spoke);
    }
  }

  // Trees, scattered in groves.
  const N = 520;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 3, 6).translate(0, 1.5, 0), k.flat(0x5a4632), N);
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.4, 0).translate(0, 4.6, 0), k.flat(0x3f7a3a, { flatShading: true }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), zAxis = new THREE.Vector3(0, 0, 1);
  const C = Math.PI * 2 * R;
  for (let i = 0; i < N; i++) {
    const grove = Math.floor(k.r() * 26);
    const gx = (((grove * 197) % 100) / 100 - 0.5) * C, gz = (((grove * 61) % 100) / 100 - 0.5) * (L - 80);
    const x = gx + (k.r() - 0.5) * 70, z = THREE.MathUtils.clamp(gz + (k.r() - 0.5) * 70, -L / 2 + 20, L / 2 - 20);
    const th = x / R, s = 0.7 + k.r() * 0.9;
    p.set(R * Math.sin(th), -R * Math.cos(th), z);
    q.setFromAxisAngle(zAxis, th);
    sc.set(s, s * (0.8 + k.r() * 0.6), s);
    m.compose(p, q, sc);
    trunks.setMatrixAt(i, m);
    crowns.setMatrixAt(i, m);
    crowns.setColorAt(i, new THREE.Color().setHSL(0.27 + k.r() * 0.08, 0.4, 0.3 + k.r() * 0.15));
  }
  trunks.frustumCulled = crowns.frustumCulled = false;
  k.scene.add(trunks, crowns);

  // Low buildings in clusters; they were laid out as a town and never demolished.
  const lit = k.flat(0xffe9b8, { emissive: 0xffe9b8, emissiveIntensity: 0.9 });
  const built: Built[] = [];
  for (let c = 0; c < 16; c++) {
    const cx = c === 0 ? 0 : (k.r() - 0.5) * C, cz = c === 0 ? -430 : (k.r() - 0.5) * (L - 140);
    for (let i = 0; i < 6; i++) {
      const w = 7 + k.r() * 8, d = 7 + k.r() * 8, h = 3.5 + Math.floor(k.r() * 3) * 3;
      const x = cx + (k.r() - 0.5) * 60, z = cz + (k.r() - 0.5) * 60;
      if (c === 0 && Math.abs(x) < 16 && Math.abs(z + 440) < 34) continue;
      k.box(w, h, d, [0xd9d4c8, 0xc8bfae, 0xb8c2c8, 0xe2d9c4][Math.floor(k.r() * 4)], x, z);
      built.push({ x, z, w, d, h, town: c });
      k.box(w + 0.6, 0.3, d + 0.6, 0x7a6a5a, x, z, { y: h, solid: false });
      for (let f = 0; f < h / 3 - 0.5; f++) k.box(w * 0.7, 0.9, d + 0.08, lit, x, z, { y: 1.3 + f * 3, solid: false });
    }
  }

  // The lift from the docks comes down a spoke at the bow end.
  const spoke = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, R, 12), k.flat(0x8a96a0, { metalness: 0.5 }));
  spoke.position.set(0, -R / 2, -452);
  k.scene.add(spoke);
  k.box(9, 4, 7, 0x6a7480, 0, -452);
  k.sign(['LIFT TO DOCKS', 'AND COMMAND'], 0, 3, -448.4, 0, 6, 1.2, '#ffd9a0', 'rgba(10,12,16,0.85)');
  k.strip(0, 0.05, -444, 3, 3, 0x2f6f4f);
  k.points.push({ x: 0, z: -444, r: 3.5, title: 'Lift to the docks', text: 'Your ship is berthed at the bow. Press E to ride up the spoke and undock.', kind: 'exit' });

  k.placard(8, -436, Math.PI, 'The drum',
    'You are standing on the inside of a cylinder about half a kilometre across. It turns, and the turning holds you to the floor. Look up: that is not sky, it is more ground, with people on it looking up at you. The bright line along the axis is the sun. The floor is going round at about thirty metres a second. Run round the drum with it and you weigh more than double; run hard against it and you almost cancel the turning, weigh next to nothing and cross the fields in long, slow bounds. Run along the drum instead and each stride lands a little to one side.');
  k.placard(-8, -436, Math.PI, 'From Nauvoo to Medina',
    'Built at Tycho as the Nauvoo, a ship meant to carry a Mormon colony to another star across a century of travel: hence the farmland. Commandeered before it ever left, refitted as the warship Behemoth, flown through the Ring, and finally parked here as Medina Station.');
  k.placard(12, -410, -Math.PI / 2, 'Thirteen hundred doors',
    'Medina sits near the centre of the ring space, within sight of every gate. Whoever holds this station decides who goes to which sun, and in what order. Ships that go through too close together have a way of not coming out the other side.');
  k.placard(-12, -380, Math.PI / 2, 'The farms',
    'The soil was shipped up from Earth and Ganymede for a voyage of generations. It now feeds the station and a good share of the traffic passing through. The orchards are older than most of the people tending them.');
  for (let i = 0; i < 26; i++) {
    const x = (k.r() - 0.5) * 60, z = -440 + k.r() * 90;
    if (k.free(x, z)) k.person(x, z, undefined, k.r() < 0.6);
  }
  k.places.push(
    { name: 'Bow lift', x: 0, z: -438, yaw: Math.PI },
    { name: 'Mid-drum', x: 60, z: 0, yaw: Math.PI },
    { name: 'Far side of the drum', x: C / 2, z: -200, yaw: Math.PI },
    { name: 'Stern end', x: -40, z: 440, yaw: 0 },
  );
  // The whole drum in one coarse box of probes. The light in here changes slowly, and what a
  // probe sees in every direction is lit farmland, which is exactly the drum's fill light.
  k.volumes.push({ x0: -R, x1: R, y0: -R, y1: R, z0: -L / 2, z1: L / 2, nx: 6, ny: 6, nz: 8 });
  k.dress = (d, s) => dressMedina(k, d, s, built, C);
  return k.done({ name: 'Bow lift', x: 0, z: -438, yaw: Math.PI });
}

// --------------------------------------------------------------- Ganymede

async function ganymede(): Promise<Interior> {
  const k = new Kit('ganymede', 'Ganymede', 'An agricultural dome on the breadbasket of the outer planets, with Jupiter filling a quarter of the sky.');
  const R = 60;
  k.circle = R - 2.5;
  k.scene.background = new THREE.Color(0x000004);
  k.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a4238, 0.5));
  k.keyFrom.set(500, 700, 300).normalize();
  k.keyPower = 2.6;
  k.keyColor = 0xfff6e6;
  k.starfield(3000);

  const ground = plane(R * 2, R * 2, k.mat('soil'), TILE.soil);
  ground.geometry.dispose();
  ground.geometry = new THREE.CircleGeometry(R, 64);
  const uv = ground.geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 40, uv.getY(i) * 40);
  ground.rotation.x = -Math.PI / 2;
  k.scene.add(ground);
  const outside = plane(6000, 6000, k.mat('regolith', 0xb8b4ac), TILE.regolith);
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.3;
  k.scene.add(outside);
  for (let i = 0; i < 40; i++) {
    const a = k.r() * 6.283, d = 110 + k.r() * 900, s = 8 + k.r() * 50;
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), k.flat(0x9a968e, { flatShading: true, roughness: 1 }));
    rock.position.set(Math.cos(a) * d, -s * 0.45, Math.sin(a) * d);
    rock.scale.y = 0.5 + k.r() * 0.5;
    k.scene.add(rock);
  }
  for (const [x, z, r] of [[-190, -120, 55], [170, -210, 70], [40, -330, 60], [-320, 140, 80]]) {
    const other = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 10, 0, 6.283, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.22, roughness: 0.1, emissive: 0x2a4a3a }));
    other.position.set(x, 0, z);
    k.scene.add(other);
  }

  // The dome.
  const glass = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 20, 0, 6.283, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.07, side: THREE.BackSide, roughness: 0.05, depthWrite: false }));
  k.scene.add(glass);
  const frame = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(R, 3)), new THREE.LineBasicMaterial({ color: 0xaab8c4, transparent: true, opacity: 0.55 }));
  k.scene.add(frame);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.8, 6, 64).rotateX(Math.PI / 2), k.flat(0x8a9198, { metalness: 0.5 }));
  k.scene.add(rim);

  // Crops in long rows either side of a central path.
  const rows: [number, number, number][] = [];
  for (let z = -52; z <= 18; z += 2.4) {
    const half = Math.sqrt(Math.max(0, 54 * 54 - z * z));
    for (const s of [1, -1]) if (half > 6) rows.push([s * (2.5 + (half - 2.5) / 2), z, half - 2.5]);
  }
  const crop = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.9 }), rows.length);
  const m = new THREE.Matrix4();
  rows.forEach(([x, z, len], i) => {
    const tall = 0.5 + ((i * 7) % 5) * 0.18;
    m.makeScale(len, tall, 1.1).setPosition(x, tall / 2, z);
    crop.setMatrixAt(i, m);
    crop.setColorAt(i, new THREE.Color().setHSL(0.24 + ((i * 13) % 7) * 0.012, 0.55, 0.26 + ((i * 5) % 4) * 0.035));
  });
  k.scene.add(crop);
  for (const z of [-40, -22, -4, 14]) {
    const half = Math.sqrt(54 * 54 - z * z);
    k.box(half * 2, 0.25, 0.25, 0x8a9198, 0, z, { y: 4.2, solid: false });
    k.strip(0, 4.1, z, half * 2 - 4, 0.3, 0xff9ae0);
    for (const s of [1, -1]) k.cyl(0.12, 4.2, 0x8a9198, s * (half - 1), z, { solid: false });
  }

  // Pad, control hut, tanks.
  const pad = new THREE.Mesh(new THREE.CircleGeometry(15, 40), k.mat('deck'));
  const puv = pad.geometry.getAttribute('uv');
  for (let i = 0; i < puv.count; i++) puv.setXY(i, (puv.getX(i) * 30) / TILE.deck, (puv.getY(i) * 30) / TILE.deck);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.02, 38);
  k.scene.add(pad);
  k.parkShip(0, 34, 0);
  k.box(9, 3.6, 6, 0xc9ced3, -30, 27);
  k.box(9.6, 0.3, 6.6, 0x6a7078, -30, 27, { y: 3.6, solid: false });
  k.sign(['AGRICULTURAL DOME 7', 'MARIUS REGIO'], -30, 2.6, 23.95, Math.PI, 7, 1, '#7fe0a0', 'rgba(4,14,8,0.9)');
  k.console(-24, 30, Math.PI / 2, ['MIRROR ARRAY', 'INSOLATION 104%', 'DOME 0.98 ATM']);
  for (const x of [26, 31, 36]) k.cyl(2, 6, k.flat(0x9aa3ab, { metalness: 0.6, roughness: 0.3 }), x, 26);
  k.crowd(-20, -30, 20, 30, 8, false);
  k.lamp(0, 5, 26, 0xfff2d8, 90, 26);

  // Jupiter, and the mirrors that stand in for a nearer sun.
  const jt = await new THREE.TextureLoader().loadAsync(PHOTOS.jupiter.color[1]);
  jt.colorSpace = THREE.SRGBColorSpace;
  const jup = new THREE.Mesh(new THREE.SphereGeometry(560, 64, 32), new THREE.MeshStandardMaterial({ map: jt, roughness: 1, fog: false }));
  jup.position.set(-900, 1250, -1900);
  jup.rotation.z = 0.3;
  k.scene.add(jup);
  k.anims.push((_t, dt) => { jup.rotation.y += dt * 0.01; });
  for (let i = 0; i < 9; i++) {
    const mir = glowSprite(0xffffff, 60 + (i % 3) * 20, 0.95);
    mir.position.set(300 + i * 130 - (i % 2) * 60, 1500 + (i % 3) * 90, -200 + i * 70);
    k.scene.add(mir);
  }

  k.placard(5, 22, 0, 'The breadbasket',
    'Ganymede feeds the outer planets. Hundreds of domes like this one grow soy, rice and wheat on a moon with no air, under glass, in sunlight a twenty-fifth as strong as Earth\'s. When Ganymede has a bad year, the Belt goes hungry.');
  k.placard(-5, 22, 0, 'The mirrors',
    'Look up and to the right: those hard white points are orbital mirrors, each one kilometres across, turned to pour gathered sunlight onto the domes. Lose a mirror and a dome goes dark. Drop one and it does worse.');
  k.placard(4, -8, -Math.PI / 2, 'Why babies are born here',
    'Ganymede is the only moon with a magnetic field of its own, which shelters the surface from the worst of Jupiter\'s radiation. That makes it the safest place beyond Mars to carry a child, and Belter families cross the system to do it.');
  k.placard(-4, -34, Math.PI / 2, 'A sixth of a sixth',
    'Gravity here is about a seventh of Earth\'s. Crops grow tall and thin, water arcs lazily out of the irrigation heads, and a dropped tool takes a full second and a half to reach the soil.');
  // One low box of probes for the whole dome: sunlight coming back up off the soil and crops.
  k.volumes.push({ x0: -R, x1: R, y0: 0, y1: 10, z0: -R, z1: R, nx: 10, ny: 1, nz: 10 });
  k.dress = (d, s) => dressGanymede(k, d, s);
  k.places.push({ name: 'Landing pad', x: 10, z: 50, yaw: 0.3 }, { name: 'Centre of the dome', x: 0, z: -4, yaw: 0 }, { name: 'Far edge', x: 0, z: -54, yaw: 0 });
  return k.done({ name: 'Landing pad', x: 10, z: 50, yaw: 0.3 });
}

const cache = new Map<string, Interior>();

/** Build (once) the inside of a station. `saved` is its file of light probes, if bounce light
 *  is wanted and the browser can do it. */
export async function buildInterior(id: string, bounce = false, saved: ArrayBuffer | null = null): Promise<Interior> {
  let it = cache.get(id);
  if (!it) {
    BOUNCE = bounce;
    SAVED = saved;
    it = id === 'tycho' ? tycho() : id === 'ceres' ? ceres() : id === 'medina' ? medina() : await ganymede();
    cache.set(id, it);
  }
  return it;
}
