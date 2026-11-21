// Low-poly impressions of ships and stations, built from primitives.
// Every model is about one unit long with its nose towards −Z.

import * as THREE from 'three';
import { paintGlow, rng } from './textures';
import { scan } from './materials';
import { DrivePlume } from './plume';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import corvetteGlb from '../assets/models/corvette.glb';
import battleshipGlb from '../assets/models/battleship.glb';
import haulerGlb from '../assets/models/hauler.glb';
import tychoGlb from '../assets/models/tycho.glb';
import dreadnoughtGlb from '../assets/models/dreadnought.glb';
import racerGlb from '../assets/models/racer.glb';
import freighterGlb from '../assets/models/freighter.glb';
import stealthGlb from '../assets/models/stealth.glb';
import surveyGlb from '../assets/models/survey.glb';
import medinaGlb from '../assets/models/medina.glb';
import hullColor from '../assets/pbr/hull_color.jpg';
import hullNormal from '../assets/pbr/hull_normal.jpg';
import hullRough from '../assets/pbr/hull_rough.jpg';
import windowRooms from '../assets/pbr/windows.jpg';

export const glowTex = new THREE.CanvasTexture(paintGlow());
glowTex.colorSpace = THREE.SRGBColorSpace;

export function glowSprite(color: THREE.ColorRepresentation, size: number, opacity = 1): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity,
  }));
  s.scale.setScalar(size);
  return s;
}

type G = THREE.Group;
type Mat = THREE.Material;

/** Hull metal, with scanned plating for its relief and sheen. */
const metal = (color: number, o: THREE.MeshStandardMaterialParameters = {}) => {
  const plates = scan('plates', 2);
  const m = new THREE.MeshStandardMaterial({ color, metalness: 0.42, roughness: 0.5, normalMap: plates.normalMap, roughnessMap: plates.roughnessMap, ...o });
  m.normalScale.set(0.8, 0.8);
  if (o.roughness === undefined) m.roughness = 1.7;
  return m;
};
/** Lamps and windows: brighter than white, so they bloom. */
const lit = (color: number) => { const m = new THREE.MeshBasicMaterial({ color }); m.color.multiplyScalar(1.5); return m; };

function bx(g: G, m: Mat, w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  g.add(o);
  return o;
}

/** A tapered tube along Z: `rf` at the front (−Z), `rb` at the back. */
function tube(g: G, m: Mat, rf: number, rb: number, len: number, z = 0, seg = 12, x = 0, y = 0): THREE.Mesh {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rf, rb, len, seg).rotateX(-Math.PI / 2), m);
  o.position.set(x, y, z);
  g.add(o);
  return o;
}

/** A drive bell at `z` with its exhaust behind it. */
function drive(g: G, m: Mat, r: number, z: number, x = 0, y = 0, color = 0x9fd8ff, burn = 1) {
  tube(g, m, r * 0.55, r, r * 1.1, z, 14, x, y);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(r * 0.85, 14), lit(burn ? color : 0x10141a));
  disc.position.set(x, y, z + r * 0.56);
  g.add(disc);
  if (burn) plumeAt(g, r, x, y, z + r * 0.56, color, burn);
}

/** Exhaust behind a drive whose bell ends at `z`: the same beam as the Rocinante's, scaled to the
 *  bell and tinted to the ship's drive colour. `burn` scales how long it is. */
function plumeAt(g: G, r: number, x: number, y: number, z: number, color: number, burn: number) {
  const p = new DrivePlume(r, r * 11 * burn, color, true);
  p.position.set(x, y, z);
  g.add(p);
}

/** Point-defence turret. */
function pdc(g: G, m: Mat, x: number, y: number, z: number, s = 0.012) {
  const up = Math.sign(y) || 1;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(s, s * 1.2, s, 8), m);
  base.position.set(x, y, z);
  g.add(base);
  bx(g, m, s * 0.35, s * 0.35, s * 2.4, x, y + up * s * 0.5, z - s);
}

function lamp(g: G, color: number, x: number, y: number, z: number, s = 0.006) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(s, 6, 4), lit(color));
  o.position.set(x, y, z);
  g.add(o);
}

function windows(g: G, x: number, y: number, z0: number, z1: number, n: number, color = 0xffe2a8, s = 0.004) {
  for (let i = 0; i < n; i++) bx(g, lit(color), s, s, s * 2, x, y, z0 + ((z1 - z0) * i) / Math.max(1, n - 1));
}

export type ShipModel =
  | 'corvette' | 'battleship' | 'dreadnought' | 'hauler' | 'racer' | 'wreck' | 'freighter' | 'stealth'
  | 'survey' | 'magnetar' | 'tycho' | 'medina' | 'mirrors' | 'player';

const MCRN = () => [metal(0x62675f), metal(0xa8452c, { roughness: 0.6 }), metal(0x2b2e30)] as const;
const UNN = () => [metal(0x7c8998), metal(0xd7dde2, { roughness: 0.6 }), metal(0x2d3540)] as const;
const BELT = () => [metal(0x8a8377, { roughness: 0.75 }), metal(0xc49a2e, { roughness: 0.7 }), metal(0x35322e)] as const;

/** A square-ended block along Z that narrows to `k` of its size at the front (−Z). */
function taper(g: G, m: Mat, w: number, h: number, len: number, k: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const r = Math.SQRT1_2;
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r * k, r, len, 4, 1).rotateY(Math.PI / 4).rotateX(-Math.PI / 2), m);
  o.scale.set(w, h, 1);
  o.position.set(x, y, z);
  g.add(o);
  return o;
}

function corvette(): G {
  // Stand-in for the Blender Rocinante (tools/blender/build.py), same layout in plain blocks: a dark flat hull
  // with a low wedge prow over the spiked rail frame, a raised pale crew block, a wider striped engineering
  // section, the gun tower behind the crew block, the railgun on the roof and one wide drum drive.
  const g = new THREE.Group();
  const gun = metal(0x5c6066), pale = metal(0xb8bcc0, { roughness: 0.6 }), red = metal(0xbb4540, { roughness: 0.6 });
  const dark = metal(0x2b2e30), drum = metal(0x8794a3), steel = metal(0xbcc3ca);
  bx(g, gun, 0.29, 0.15, 0.7, 0, 0, 0.05);
  taper(g, gun, 0.25, 0.1, 0.22, 0.4, 0, -0.02, -0.41);
  bx(g, pale, 0.2, 0.006, 0.4, 0, 0.076, -0.08);
  bx(g, red, 0.08, 0.006, 0.1, 0, 0.05, -0.39).rotation.x = 0.2;
  // Crew block, its sloped front glazed.
  bx(g, pale, 0.19, 0.08, 0.2, 0, 0.105, 0.01);
  taper(g, pale, 0.18, 0.075, 0.06, 0.5, 0, 0.1, -0.12);
  bx(g, lit(0xffe2a8), 0.09, 0.008, 0.004, 0, 0.112, -0.148).rotation.x = -0.8;
  for (const s of [1, -1]) bx(g, red, 0.014, 0.004, 0.2, s * 0.078, 0.147, 0.01);
  // Engineering: wider than the hull, pale with red stripes, a machinery door on each flank.
  bx(g, pale, 0.304, 0.184, 0.22, 0, 0.006, 0.29);
  for (const x of [-0.082, -0.032, 0.032, 0.082]) bx(g, red, 0.016, 0.004, 0.22, x, 0.099, 0.29);
  // Gun tower, railgun and the rail frame under the prow.
  bx(g, gun, 0.1, 0.06, 0.1, 0, 0.12, 0.19);
  pdc(g, dark, 0, 0.158, 0.19, 0.015);
  tube(g, steel, 0.011, 0.011, 0.3, -0.3, 10, 0, 0.06);
  tube(g, dark, 0.015, 0.015, 0.03, -0.46, 10, 0, 0.06);
  bx(g, dark, 0.16, 0.008, 0.3, 0, -0.052, -0.4);
  for (const x of [-0.055, 0, 0.055]) tube(g, dark, 0.0035, 0.0045, 0.2, -0.58, 6, x, -0.05);
  for (const s of [1, -1]) {
    bx(g, gun, 0.05, 0.07, 0.18, s * 0.14, -0.012, -0.2);
    bx(g, dark, 0.004, 0.05, 0.09, s * 0.153, 0, 0.27);
    bx(g, red, 0.005, 0.03, 0.06, s * 0.153, 0, 0.27);
    pdc(g, dark, s * 0.17, 0.085, -0.26, 0.013);
    pdc(g, dark, s * 0.175, -0.11, 0.08, 0.013);
    lamp(g, s > 0 ? 0x4fff7a : 0xff4f4f, s * 0.172, 0, -0.06, 0.004);
    windows(g, s * 0.096, 0.1, -0.1, 0.05, 6, 0xffe2a8, 0.0035);
  }
  pdc(g, dark, 0, -0.125, 0.2, 0.013);
  // Drum drive: a ribbed barrel on a short collar, lit inside.
  tube(g, dark, 0.108, 0.108, 0.02, 0.41, 8);
  tube(g, drum, 0.112, 0.112, 0.135, 0.4875, 24);
  for (const z of [0.445, 0.475, 0.505, 0.535]) tube(g, dark, 0.115, 0.115, 0.008, z, 24);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), lit(0x9fd8ff));
  disc.position.z = 0.556;
  g.add(disc);
  plumeAt(g, 0.09, 0, 0, 0.556, 0x9fd8ff, 1);
  return g;
}

function battleship(): G {
  // Long armoured dagger with stacked decks, twin railgun turrets and a bank of drives.
  const g = new THREE.Group();
  const [hull, trim, dark] = MCRN();
  const body = tube(g, hull, 0.035, 0.1, 0.78, -0.02, 4);
  body.rotation.z = Math.PI / 4;
  body.scale.set(1.25, 0.75, 1);
  bx(g, hull, 0.13, 0.07, 0.36, 0, 0.05, 0.1);
  bx(g, trim, 0.1, 0.03, 0.2, 0, 0.095, 0.14);
  bx(g, hull, 0.06, 0.035, 0.09, 0, 0.125, 0.2);
  bx(g, hull, 0.13, 0.05, 0.3, 0, -0.05, 0.12);
  bx(g, trim, 0.19, 0.01, 0.05, 0, 0.0, -0.1);
  for (const up of [1, -1]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.022, 10), dark);
    t.position.set(0, up * 0.075, -0.16);
    g.add(t);
    for (const s of [1, -1]) tube(g, dark, 0.005, 0.005, 0.16, -0.25, 6, s * 0.012, up * 0.08);
  }
  for (let i = 0; i < 7; i++) {
    for (const s of [1, -1]) {
      pdc(g, dark, s * (0.05 + i * 0.008), 0.06 + (i > 2 ? 0.03 : 0), -0.3 + i * 0.09, 0.008);
      pdc(g, dark, s * (0.05 + i * 0.008), -0.05 - (i > 2 ? 0.03 : 0), -0.3 + i * 0.09, 0.008);
    }
  }
  for (const s of [1, -1]) {
    bx(g, hull, 0.03, 0.1, 0.3, s * 0.115, 0, 0.22);
    bx(g, dark, 0.006, 0.16, 0.22, s * 0.135, 0, 0.24);
    windows(g, s * 0.068, 0.07, -0.05, 0.25, 12, 0xffd9a0, 0.003);
    windows(g, s * 0.068, 0.055, -0.05, 0.25, 12, 0xffd9a0, 0.003);
    lamp(g, s > 0 ? 0x4fff7a : 0xff4f4f, s * 0.135, 0.08, 0.2);
  }
  bx(g, hull, 0.24, 0.16, 0.08, 0, 0, 0.39);
  for (const [x, y] of [[0, 0], [0.075, 0.04], [-0.075, 0.04], [0.075, -0.04], [-0.075, -0.04]]) drive(g, dark, 0.036, 0.45, x, y, 0x9fd8ff, 0.6);
  return g;
}

function dreadnought(): G {
  // Slab-sided and blocky: Earth builds for armour, not grace.
  const g = new THREE.Group();
  const [hull, trim, dark] = UNN();
  bx(g, hull, 0.16, 0.12, 0.7, 0, 0, -0.02);
  bx(g, hull, 0.12, 0.09, 0.12, 0, 0, -0.42);
  bx(g, trim, 0.165, 0.02, 0.5, 0, 0.03, 0);
  bx(g, hull, 0.1, 0.05, 0.3, 0, 0.085, 0.08);
  bx(g, dark, 0.06, 0.04, 0.1, 0, 0.13, 0.14);
  bx(g, hull, 0.03, 0.03, 0.04, 0, 0.165, 0.15);
  for (const s of [1, -1]) {
    bx(g, hull, 0.06, 0.08, 0.42, s * 0.11, -0.01, 0.06);
    bx(g, trim, 0.062, 0.012, 0.3, s * 0.11, 0.02, 0.06);
    bx(g, dark, 0.05, 0.05, 0.2, s * 0.11, -0.06, 0.12);
    for (let i = 0; i < 5; i++) pdc(g, dark, s * 0.11, 0.035, -0.12 + i * 0.09, 0.009);
    for (let i = 0; i < 4; i++) pdc(g, dark, s * 0.05, 0.065, -0.4 + i * 0.07, 0.009);
    windows(g, s * 0.141, -0.01, -0.12, 0.24, 14, 0xcfe6ff, 0.003);
    lamp(g, s > 0 ? 0x4fff7a : 0xff4f4f, s * 0.142, 0.03, -0.1);
  }
  for (const z of [-0.3, -0.18]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.02, 10), dark);
    t.position.set(0, 0.07, z);
    g.add(t);
    tube(g, dark, 0.005, 0.005, 0.12, z - 0.07, 6, 0, 0.078);
  }
  bx(g, dark, 0.26, 0.14, 0.07, 0, 0, 0.365);
  for (const x of [-0.085, 0, 0.085]) drive(g, dark, 0.045, 0.43, x, 0, 0xa8d0ff, 0.6);
  return g;
}

function hauler(): G {
  // A converted colony ship: container stacks up front, a long spine, one huge old drive.
  const g = new THREE.Group();
  const [hull, trim, dark] = BELT();
  const r = rng(31);
  const ice = new THREE.MeshStandardMaterial({ color: 0xcfe6f2, roughness: 0.35, metalness: 0.1, flatShading: true });
  tube(g, dark, 0.02, 0.02, 0.86, 0, 6);
  for (let i = 0; i < 6; i++) {
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2;
      const m = r() < 0.75 ? ice : r() < 0.5 ? hull : trim;
      const c = bx(g, m, 0.06, 0.06, 0.085, Math.cos(ang) * 0.075, Math.sin(ang) * 0.075, -0.38 + i * 0.095);
      c.rotation.z = ang;
    }
  }
  tube(g, hull, 0.06, 0.06, 0.03, -0.44, 12);
  tube(g, hull, 0.075, 0.075, 0.09, 0.24, 14);
  bx(g, trim, 0.05, 0.04, 0.07, 0, 0.085, 0.24);
  windows(g, 0.076, 0, 0.2, 0.28, 5);
  windows(g, -0.076, 0, 0.2, 0.28, 5);
  for (const s of [1, -1]) {
    bx(g, dark, 0.22, 0.004, 0.1, s * 0.15, 0, 0.33);
    lamp(g, 0xffb347, s * 0.26, 0, 0.33);
  }
  tube(g, dark, 0.05, 0.09, 0.08, 0.38, 12);
  drive(g, dark, 0.085, 0.45, 0, 0, 0xffd9a8, 0.5);
  return g;
}

function racer(burn = 1): G {
  // Almost nothing but a drive and a seat.
  const g = new THREE.Group();
  const white = metal(0xe6e9ec, { roughness: 0.3 }), trim = metal(0xe0662a), dark = metal(0x22262b);
  tube(g, white, 0.004, 0.05, 0.45, -0.25, 10);
  tube(g, white, 0.05, 0.07, 0.25, 0.1, 10);
  bx(g, dark, 0.035, 0.02, 0.1, 0, 0.04, -0.12);
  tube(g, trim, 0.052, 0.058, 0.03, -0.02, 10);
  for (let i = 0; i < 3; i++) {
    const f = bx(g, trim, 0.004, 0.14, 0.2, 0, 0.09, 0.2);
    f.position.set(Math.sin((i * Math.PI * 2) / 3) * 0.09, Math.cos((i * Math.PI * 2) / 3) * 0.09, 0.2);
    f.rotation.z = -(i * Math.PI * 2) / 3;
  }
  drive(g, dark, 0.1, 0.3, 0, 0, 0x9fd8ff, burn);
  if (burn) lamp(g, 0xffffff, 0, 0.012, -0.47, 0.004);
  return g;
}

function freighter(): G {
  // Bridge block forward, a cage of mismatched cargo pods, drive aft.
  const g = new THREE.Group();
  const [hull, trim, dark] = BELT();
  const r = rng(77);
  const cols = [0x9a5a3a, 0x4a6a7a, 0x8a8377, 0xc49a2e, 0x5a6a4a].map((c) => metal(c, { roughness: 0.8 }));
  bx(g, hull, 0.14, 0.1, 0.12, 0, 0, -0.42);
  bx(g, dark, 0.1, 0.03, 0.05, 0, 0.065, -0.44);
  windows(g, 0, 0.03, -0.482, -0.482, 1, 0xcfe6ff, 0.02);
  tube(g, dark, 0.018, 0.018, 0.7, -0.02, 6);
  for (let i = 0; i < 6; i++) {
    for (const [x, y] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      if (r() < 0.12) continue;
      bx(g, cols[Math.floor(r() * cols.length)], 0.075, 0.075, 0.085, x * 0.048, y * 0.048, -0.3 + i * 0.095);
    }
  }
  for (const z of [-0.34, 0.26]) bx(g, trim, 0.2, 0.012, 0.012, 0, 0, z);
  bx(g, hull, 0.16, 0.14, 0.1, 0, 0, 0.33);
  for (const s of [1, -1]) {
    bx(g, dark, 0.14, 0.004, 0.09, s * 0.15, 0, 0.33);
    drive(g, dark, 0.045, 0.41, s * 0.045, 0, 0xffd9a8, 0.5);
    lamp(g, 0xffb347, s * 0.075, 0.055, -0.47);
  }
  return g;
}

function stealth(): G {
  // Faceted, black, nothing proud of the hull and no lights at all.
  const g = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0e11, metalness: 0.2, roughness: 0.35, flatShading: true });
  const a = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), black);
  a.scale.set(0.34, 0.14, 1);
  g.add(a);
  const b = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), black);
  b.scale.set(0.8, 0.22, 1);
  b.position.z = 0.16;
  g.add(b);
  for (const s of [1, -1]) {
    const f = bx(g, black, 0.1, 0.006, 0.16, s * 0.16, 0, 0.26);
    f.rotation.y = s * 0.5;
  }
  drive(g, black, 0.04, 0.44, 0, 0, 0x6f8fb0, 0.12);
  return g;
}

function survey(): G {
  // A corporate deep-range vessel: long hull, spin section, dishes and a shuttle bay.
  const g = new THREE.Group();
  const white = metal(0xc9ced3, { roughness: 0.45 }), blue = metal(0x2f5f9a), dark = metal(0x2a2f36);
  tube(g, white, 0.05, 0.07, 0.6, -0.08, 12);
  tube(g, white, 0.025, 0.05, 0.1, -0.43, 12);
  tube(g, blue, 0.072, 0.072, 0.04, -0.2, 12);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 28), white);
  ring.position.z = 0;
  g.add(ring);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.32, 5), dark);
    s.rotation.z = (i * Math.PI) / 4;
    g.add(s);
  }
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 6, 0, Math.PI * 2, 0, 1.0), white);
  dish.rotation.x = Math.PI;
  dish.position.set(0, 0.13, -0.3);
  g.add(dish);
  tube(g, dark, 0.004, 0.004, 0.2, -0.56, 5);
  bx(g, dark, 0.1, 0.05, 0.12, 0, -0.07, 0.12);
  bx(g, white, 0.18, 0.14, 0.12, 0, 0, 0.3);
  for (const s of [1, -1]) {
    bx(g, dark, 0.2, 0.004, 0.12, s * 0.19, 0, 0.3);
    windows(g, s * 0.064, 0.02, -0.3, 0.15, 12, 0xfff0c8, 0.003);
    drive(g, dark, 0.04, 0.39, s * 0.045, 0, 0xcfe6ff, 0.5);
  }
  return g;
}

function magnetar(): G {
  // Grown, not built: pale, asymmetric, more vertebra than vessel.
  const g = new THREE.Group();
  const bone = new THREE.MeshStandardMaterial({ color: 0xcfdde6, emissive: 0x16384a, metalness: 0.35, roughness: 0.3 });
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const rad = 0.012 + 0.11 * Math.sin(t * Math.PI) ** 0.7 * (1 + 0.28 * Math.sin(t * 15) + 0.12 * Math.sin(t * 37));
    pts.push(new THREE.Vector2(rad, t - 0.5));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 24).rotateX(Math.PI / 2), bone);
  body.scale.set(1.5, 0.7, 1);
  g.add(body);
  const r = rng(404);
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.03 + r() * 0.035, 10, 8), bone);
    s.position.set((r() - 0.5) * 0.26, (r() - 0.5) * 0.08, (r() - 0.5) * 0.7);
    s.scale.set(1.4, 0.7, 2.2);
    g.add(s);
  }
  for (const s of [1, -1]) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.4, 5).rotateX(-Math.PI / 2), bone);
    fin.position.set(s * 0.17, 0, 0.05);
    fin.scale.set(1, 0.4, 1);
    fin.rotation.y = s * 0.25;
    g.add(fin);
  }
  for (let i = 0; i < 12; i++) lamp(g, 0x7fe0ff, (r() - 0.5) * 0.24, 0.06 * (r() < 0.5 ? 1 : -1), (r() - 0.5) * 0.7, 0.004);
  const s = glowSprite(0x6fd0ff, 0.25, 0.5);
  s.position.z = 0.5;
  g.add(s);
  return g;
}

function tycho(): G {
  // A half-kilometre sphere, two counter-rotating habitat rings, drives underneath, a yard on top.
  const g = new THREE.Group();
  const hull = metal(0x9aa3ab, { roughness: 0.55 }), dark = metal(0x30363d), trim = metal(0xc8662a);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 20), hull));
  for (let i = -2; i <= 2; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.36 * Math.cos(i * 0.5) + 0.002, 0.004, 4, 40), dark);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.36 * Math.sin(i * 0.5);
    g.add(band);
  }
  const rings: G[] = [];
  for (const [y, rad] of [[0.07, 0.62], [-0.07, 0.56]]) {
    const ring = new THREE.Group();
    const t = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.035, 8, 64), hull);
    t.rotation.x = Math.PI / 2;
    ring.add(t);
    const lights = new THREE.Mesh(new THREE.TorusGeometry(rad + 0.036, 0.004, 4, 64), lit(0xffe2a8));
    lights.rotation.x = Math.PI / 2;
    ring.add(lights);
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, rad * 2, 5), dark);
      sp.rotation.z = Math.PI / 2;
      sp.rotation.y = (i * Math.PI) / 6;
      ring.add(sp);
    }
    ring.position.y = y;
    g.add(ring);
    rings.push(ring);
  }
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.2, 16), dark);
  eng.position.y = -0.42;
  g.add(eng);
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.1, 10), dark);
    c.position.set(Math.cos(i * 1.257) * 0.14, -0.56, Math.sin(i * 1.257) * 0.14);
    g.add(c);
  }
  // Construction yard: a gantry cage with a half-built hull inside.
  const yard = new THREE.Group();
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) bx(yard, trim, 0.012, 0.5, 0.012, x * 0.12, 0.25, z * 0.12);
  for (const y of [0.1, 0.3, 0.5]) {
    for (const s of [1, -1]) {
      bx(yard, trim, 0.25, 0.008, 0.008, 0, y, s * 0.12);
      bx(yard, trim, 0.008, 0.008, 0.25, s * 0.12, y, 0);
    }
  }
  const keel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.36, 8, 4, true), new THREE.MeshStandardMaterial({ color: 0x7a838c, wireframe: true }));
  keel.position.y = 0.28;
  yard.add(keel);
  lamp(yard, 0xffffff, 0.12, 0.5, 0.12, 0.012);
  lamp(yard, 0xffffff, -0.12, 0.5, -0.12, 0.012);
  yard.position.y = 0.34;
  g.add(yard);
  for (let i = 0; i < 24; i++) lamp(g, 0xffe2a8, Math.cos(i * 0.9) * 0.36 * Math.cos(i * 0.37 - 1), 0.36 * Math.sin(i * 0.37 - 1), Math.sin(i * 0.9) * 0.36 * Math.cos(i * 0.37 - 1), 0.005);
  g.userData.anim = (dt: number) => {
    rings[0].rotation.y += dt * 0.35;
    rings[1].rotation.y -= dt * 0.35;
  };
  return g;
}

function medina(): G {
  // Two kilometres of generation ship: a spinning drum between a command bow and the drive.
  const g = new THREE.Group();
  const hull = metal(0x8f969c, { roughness: 0.6 }), dark = metal(0x2d3238), trim = metal(0xb89a5a);
  const drum = new THREE.Group();
  tube(drum, hull, 0.125, 0.125, 0.56, 0, 32);
  for (let i = 0; i < 9; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.127, 0.004, 4, 40), dark);
    rib.position.z = -0.26 + i * 0.065;
    drum.add(rib);
  }
  for (let i = 0; i < 40; i++) {
    const a = i * 2.4, z = -0.25 + ((i * 0.0131) % 0.5);
    bx(drum, lit(0xffe9b8), 0.004, 0.004, 0.012, Math.cos(a) * 0.127, Math.sin(a) * 0.127, z);
  }
  g.add(drum);
  tube(g, hull, 0.05, 0.11, 0.1, -0.33, 20);
  tube(g, trim, 0.055, 0.055, 0.03, -0.39, 16);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(-Math.PI / 2), hull);
  dome.position.z = -0.405;
  g.add(dome);
  tube(g, dark, 0.003, 0.003, 0.12, -0.5, 5);
  tube(g, dark, 0.11, 0.09, 0.08, 0.32, 20);
  bx(g, dark, 0.3, 0.02, 0.05, 0, 0, 0.33);
  bx(g, dark, 0.02, 0.3, 0.05, 0, 0, 0.33);
  for (const [x, y] of [[0, 0], [0.05, 0.05], [-0.05, 0.05], [0.05, -0.05], [-0.05, -0.05]]) drive(g, dark, 0.03, 0.39, x, y, 0x9fd8ff, 0);
  for (const s of [1, -1]) {
    lamp(g, s > 0 ? 0x4fff7a : 0xff4f4f, s * 0.15, 0, 0.33, 0.006);
    bx(g, hull, 0.02, 0.02, 0.07, s * 0.07, 0, -0.44);
  }
  g.userData.anim = (dt: number) => (drum.rotation.z += dt * 0.25);
  return g;
}

function mirrors(): G {
  // A flock of thin reflectors, each angled to throw sunlight down onto the domes.
  const g = new THREE.Group();
  const face = new THREE.MeshStandardMaterial({ color: 0xdfe9f2, metalness: 1, roughness: 0.08, emissive: 0x44525e, side: THREE.DoubleSide });
  const frame = metal(0x30363d);
  const r = rng(12);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Group();
    m.add(new THREE.Mesh(new THREE.CircleGeometry(0.13, 6), face));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.006, 4, 6), frame);
    m.add(rim);
    m.position.set((r() - 0.5) * 1.6, (r() - 0.5) * 0.5, (r() - 0.5) * 1.6);
    m.rotation.set(-1.1 + r() * 0.2, r() * 0.3, 0);
    g.add(m);
  }
  return g;
}

/** Your ship — an original design: a long-range survey skiff. Returns the model and its exhaust. */
/** The ship you fly is the Rocinante: the Blender corvette, 1.24 model units from nose to drive, which at
 *  the 46 m the books give her makes a model unit about 37 m. Its drive nozzle is at the tail (+z). */
export const ROCI = { length: 1.236, nozzleZ: 0.556, nozzleR: 0.09, metres: 46 };
export const ROCI_UNIT = ROCI.metres / ROCI.length;   // metres in one model unit

export function playerShip(): { group: G; plume: DrivePlume } {
  const g = new THREE.Group();
  const file = loaded.get('corvette');
  g.add(file ? file.clone(true) : corvette());
  // A tall drive plume, as long as four ship lengths at full burn.
  const plume = new DrivePlume(ROCI.nozzleR, 4.2);
  plume.position.z = ROCI.nozzleZ;
  g.add(plume);
  return { group: g, plume };
}

const BUILDERS: Record<Exclude<ShipModel, 'player'>, () => G> = {
  corvette, battleship, dreadnought, hauler, racer: () => racer(1), wreck: () => racer(0), freighter, stealth, survey, magnetar, tycho, medina, mirrors,
};

// ---- Models made in Blender (tools/blender), loaded once at start-up. The
// builders above stay as stand-ins should a file fail to load.

const GLB: Partial<Record<ShipModel, string>> = {
  corvette: corvetteGlb, battleship: battleshipGlb, hauler: haulerGlb, tycho: tychoGlb, dreadnought: dreadnoughtGlb, racer: racerGlb,
  freighter: freighterGlb, stealth: stealthGlb, survey: surveyGlb, medina: medinaGlb,
};
const BURN: Partial<Record<ShipModel, [color: number, burn: number]>> = {
  corvette: [0x9fd8ff, 1], battleship: [0x9fd8ff, 0.6], hauler: [0xffd9a8, 0.3], dreadnought: [0xa8d0ff, 0.6], racer: [0x9fd8ff, 1],
  freighter: [0xffd9a8, 0.4], stealth: [0x6f8fb0, 0.12], survey: [0xcfe6ff, 0.5],
};
const LAMPS = new Set(['window', 'glow', 'red', 'green', 'blue']);
/** Lamps that are windows: their panes show small lit rooms from the window sheet. */
const PANES = new Set(['window', 'blue']);
/** The level clean paint is stored at in the models' vertex colours (CLEAN in tools/blender/kit.py). */
const CLEAN = 0.72;
const loaded = new Map<ShipModel, G>();

/** The textures every Blender-built ship shares, painted by tools/blender/hulltex.py: hull wear,
 *  relief and sheen (tiling), and the sheet of lit rooms behind the windows. */
let shared: { color: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture; rooms: THREE.Texture } | undefined;
function hullMaps() {
  if (!shared) {
    const loader = new THREE.TextureLoader();
    const load = (url: string, srgb: boolean, tile = true) => {
      const t = loader.load(url);
      t.flipY = false; // the way model files count texture rows
      if (tile) t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      return t;
    };
    shared = { color: load(hullColor, true), normal: load(hullNormal, false), rough: load(hullRough, false), rooms: load(windowRooms, true, false) };
  }
  return shared;
}

/** Navigation strobes: flash briefly once a period. Each kind of ship has its own rhythm. */
const strobes: { m: THREE.MeshBasicMaterial; base: THREE.Color; period: number; phase: number }[] = [];
export function tickShipLights(t: number) {
  for (const s of strobes) {
    const u = (t / s.period + s.phase) % 1;
    s.m.color.copy(s.base).multiplyScalar(u < 0.1 ? 2.2 : 0.1);
  }
}

function prepare(root: G): G {
  const hull = hullMaps();
  const mats = new Map<string, Mat>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    let m = mats.get(src.name);
    if (!m) {
      if (LAMPS.has(src.name)) {
        const b = new THREE.MeshBasicMaterial({ color: src.color, map: PANES.has(src.name) ? hull.rooms : null });
        b.color.multiplyScalar(1.6);
        // The red and green lights are the navigation strobes: a short flash, then dim, as on any real craft.
        if (src.name === 'red' || src.name === 'green') strobes.push({ m: b, base: b.color.clone(), period: 1.1 + Math.random() * 0.7, phase: Math.random() });
        m = b;
      } else {
        // The vertex colours hold the weathering (shadowed dirt, soot, scuffed edges) as a multiplier on the paint.
        src.color.multiplyScalar(1 / CLEAN);
        if (src.name !== 'ice') {
          src.map = hull.color;
          src.normalMap = hull.normal;
          src.normalScale.set(0.8, 0.8);
          src.roughnessMap = hull.rough;
          src.roughness = 1;
        }
        m = src;
      }
      mats.set(src.name, m);
    }
    mesh.material = m;
  });
  return root;
}

export async function loadModels() {
  // The files are packed with meshopt (tools/blender/build.py), which the loader unpacks as it reads.
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  await Promise.all((Object.entries(GLB) as [ShipModel, string][]).map(async ([name, url]) => {
    try {
      loaded.set(name, prepare((await loader.loadAsync(url)).scene));
    } catch (e) {
      console.warn(`Model "${name}" did not load; using the simple one.`, e);
    }
  }));
}

function fromFile(name: ShipModel, src: G): G {
  const g = new THREE.Group();
  const c = src.clone(true);
  g.add(c);
  const burn = BURN[name];
  if (burn) {
    c.traverse((o) => {
      if (o.name.startsWith('drive')) plumeAt(g, o.scale.x, o.position.x, o.position.y, o.position.z, burn[0], burn[1] * (o.name.includes('small') ? 0.6 : 1));
    });
  }
  const a = c.getObjectByName('ring_a'), b = c.getObjectByName('ring_b');
  if (a && b) g.userData.anim = (dt: number) => { a.rotation.y += dt * 0.35; b.rotation.y -= dt * 0.35; };
  const drum = c.getObjectByName('drum');
  if (drum) g.userData.anim = (dt: number) => { drum.rotation.z += dt * 0.25; };
  if (name === 'wreck') {
    // Dead in space: no lights, a cold drive.
    const cold = new THREE.MeshStandardMaterial({ color: 0x0c0f13, roughness: 0.6 });
    c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.material instanceof THREE.MeshBasicMaterial) m.material = cold; });
  }
  return g;
}

export function buildModel(m: ShipModel): G {
  if (m === 'player') return playerShip().group;
  const file = loaded.get(m === 'wreck' ? 'racer' : m);
  if (file) return fromFile(m, file);
  const make = BUILDERS[m];
  if (!make) throw new Error(`No model called "${m}"`);
  return make();
}
