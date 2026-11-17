// People for the interiors: proper proportions (about seven and a half heads tall), a neck,
// shoulders, tapered limbs, boots, hair and a handful of outfits, with swinging arms and legs.
// Each limb is one merged mesh with vertex colours, so a person is eight meshes and two materials.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const SKIN = [0xf0c8a8, 0xd9a47c, 0xb97d56, 0x8d5a3b, 0x6a4129, 0x4a2c1c, 0xe3b48a, 0xc98f68];
export const HAIR = [0x15110e, 0x2a1d14, 0x4a3320, 0x7a5a36, 0xb9a070, 0x8a8a8a, 0x2a2a30];
export const NEON_HAIR = [0xff2d95, 0x2df0ff, 0x8a5cff, 0x4dff9a, 0xffb02d];
export const NEON = [0xff2d95, 0x2df0ff, 0xffb02d, 0x8a5cff, 0x4dff9a, 0xff5a3c];
export const STREET = [0x15171c, 0x1f232b, 0x2b2f38, 0x3a3f4a, 0x4a3a3a, 0x2e3b36, 0x403a2a, 0x5a5f66, 0x241a2e, 0x1a2a38];
/** Everyday clothes for the calmer districts: nothing lit, plenty of colour. */
export const CIVIL = [0x4f7a4a, 0x3d6a8a, 0x8a5a3a, 0xa8a090, 0x5a4a6a, 0x9a4a3a, 0x33506a, 0xc9b58a, 0x6a6f76, 0x2f3a44, 0x7a8a5a, 0xb0803a];
export const WORK = [0x8a5a2a, 0x59636b, 0x7a7468, 0x3f5a6a, 0x6a2f2a];

const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.12 });
const glow = new THREE.MeshBasicMaterial({ vertexColors: true });

type Rand = () => number;
const pick = <T,>(r: Rand, a: T[]): T => a[Math.floor(r() * a.length)];

/** Paint a geometry one colour (vertex colours), moved and scaled into place. */
function bit(geo: THREE.BufferGeometry, color: number, at: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0], tone = 1): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
  g.applyMatrix4(m);
  const c = new THREE.Color(color).multiplyScalar(tone);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const cyl = (rt: number, rb: number, h: number, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
const ball = (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);

const merge = (gs: THREE.BufferGeometry[]) => {
  const out = mergeGeometries(gs, false)!;
  gs.forEach((g) => g.dispose());
  return out;
};

export interface Person {
  group: THREE.Group;
  /** Advance the pose. `walking` swings the limbs; otherwise a quiet idle. */
  pose(t: number, walking: boolean): void;
  height: number;
}

export function buildPerson(r: Rand, belter = false, plain = false): Person {
  const CLOTH = plain ? CIVIL : STREET;
  const tall = belter ? 1.13 : 1;
  const H = (1.62 + r() * 0.22) * tall;     // body height, metres
  const k = H / 1.74;                        // scale from the 1.74 m template
  const w = (belter ? 0.86 : 0.95 + r() * 0.12) * (r() < 0.2 ? 1.12 : 1);
  const skin = pick(r, SKIN);
  const outfit = Math.floor(r() * 6);
  const accent = pick(r, NEON);
  const base = outfit === 0 ? pick(r, WORK) : pick(r, CLOTH);
  const trouser = outfit === 0 ? base : pick(r, CLOTH);
  const shirt = pick(r, CLOTH);
  const boot = pick(r, [0x0c0d10, 0x1a1512, 0x24262b]);
  const hairC = r() < 0.22 && !plain ? pick(r, NEON_HAIR) : pick(r, HAIR);
  const hairStyle = pick(r, plain ? ['short', 'short', 'long', 'long', 'shaved', 'bun'] : ['short', 'short', 'long', 'shaved', 'mohawk', 'bun', 'hood']);

  const group = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    return m;
  };

  // ---- torso and pelvis (pivot at the hips, y = 0.93)
  const trunk: THREE.BufferGeometry[] = [];
  const trim: THREE.BufferGeometry[] = [];
  trunk.push(bit(cyl(0.17 * w, 0.16 * w, 0.2, 14), trouser, [0, 0.0, 0], [1.05, 1, 0.66]));                 // pelvis
  const long = outfit === 2;
  const coatH = long ? 0.85 : 0.62;
  trunk.push(bit(cyl(0.2 * w, (long ? 0.25 : 0.19) * w, coatH, 14), base, [0, 0.12 + coatH / 2 - (long ? 0.4 : 0.1), 0], [1.12, 1, 0.64]));
  trunk.push(bit(ball(0.2 * w, 12, 8), base, [0, 0.5, 0], [1.18, 0.55, 0.66]));                              // shoulders
  trunk.push(bit(cyl(0.06, 0.07, 0.1, 14), skin, [0, 0.58, 0]));                                              // neck
  if (outfit === 1 || outfit === 3 || outfit === 4) trunk.push(bit(cyl(0.16 * w, 0.17 * w, 0.14, 14), shirt, [0, 0.48, 0.01], [1.1, 1, 0.66], [0, 0, 0], 1.2));
  if (outfit === 3) trunk.push(bit(ball(0.12, 10, 8), base, [0, 0.58, -0.09], [1.2, 0.8, 0.9]));             // hood
  if (outfit === 4) {                                                                                         // tactical vest
    trunk.push(bit(box(0.3 * w, 0.2, 0.05), 0x2a2d33, [0, 0.28, 0.1]));
    trunk.push(bit(box(0.07, 0.09, 0.05), 0x2a2d33, [-0.1 * w, 0.1, 0.12]));
    trunk.push(bit(box(0.07, 0.09, 0.05), 0x2a2d33, [0.1 * w, 0.1, 0.12]));
  }
  if (outfit === 1 || outfit === 2) {                                                                         // lit seams and collar
    trim.push(bit(box(0.012, 0.42, 0.012), accent, [-0.17 * w, 0.3, 0.1], [1, 1, 1], [0, 0, 0.04]));
    trim.push(bit(box(0.012, 0.42, 0.012), accent, [0.17 * w, 0.3, 0.1], [1, 1, 1], [0, 0, -0.04]));
    trim.push(bit(box(0.2 * w, 0.015, 0.015), accent, [0, 0.54, 0.1]));
  }
  if (outfit === 5) trim.push(bit(box(0.25 * w, 0.02, 0.012), accent, [0, 0.2, 0.125]));                      // belt light
  if (plain) {
    trim.length = 0;
    // A striped jumper on some.
    if (outfit === 1 || outfit === 5) for (const y of [0.16, 0.26, 0.36]) trunk.push(bit(cyl(0.2 * w, 0.2 * w, 0.045, 14), shirt, [0, y, 0], [1.14, 1, 0.66], [0, 0, 0], 1.25));
  }
  const torso = add(merge(trunk), body, 0, 0.93, 0);
  torso.userData.base = 0.93;
  group.add(torso);
  if (trim.length) group.add(add(merge(trim), glow, 0, 0.93, 0, false));

  // ---- head (pivot at the neck)
  const head = new THREE.Group();
  head.position.set(0, 0.93 + 0.62, 0);
  const hg: THREE.BufferGeometry[] = [];
  const hl: THREE.BufferGeometry[] = [];
  hg.push(bit(ball(1, 14, 10), skin, [0, 0.1, 0], [0.083, 0.108, 0.095]));                                   // skull and face
  hg.push(bit(box(0.07, 0.05, 0.05), skin, [0, 0.0, 0.085], [1, 1, 1], [0.1, 0, 0], 0.96));                  // jaw
  hg.push(bit(box(0.022, 0.04, 0.03), skin, [0, 0.07, 0.1], [1, 1, 1], [0.25, 0, 0], 0.94));                 // nose
  hg.push(bit(ball(0.02), skin, [0.084, 0.09, -0.005], [0.5, 1.3, 1], [0, 0, 0], 0.92));                     // ears
  hg.push(bit(ball(0.02), skin, [-0.084, 0.09, -0.005], [0.5, 1.3, 1], [0, 0, 0], 0.92));
  hg.push(bit(box(0.026, 0.008, 0.02), 0x15100e, [0.036, 0.125, 0.087]));                                    // eyes
  hg.push(bit(box(0.026, 0.008, 0.02), 0x15100e, [-0.036, 0.125, 0.087]));
  hg.push(bit(box(0.034, 0.006, 0.014), 0x2a1a14, [0.036, 0.145, 0.088]));                                   // brows
  hg.push(bit(box(0.034, 0.006, 0.014), 0x2a1a14, [-0.036, 0.145, 0.088]));
  hg.push(bit(box(0.04, 0.008, 0.012), 0x6a3a34, [0, 0.03, 0.095], [1, 1, 1], [0, 0, 0], 0.9));              // mouth
  if (hairStyle !== 'shaved' && hairStyle !== 'hood') {
    hg.push(bit(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, 1.75), hairC, [0, 0.12, -0.008], [0.09, 0.105, 0.102]));
    if (hairStyle === 'long') hg.push(bit(box(0.17, 0.24, 0.06), hairC, [0, -0.02, -0.085], [1, 1, 1], [0.05, 0, 0]));
    if (hairStyle === 'bun') hg.push(bit(ball(0.05), hairC, [0, 0.2, -0.07]));
    if (hairStyle === 'mohawk') hg.push(bit(box(0.025, 0.07, 0.2), hairC, [0, 0.215, -0.01], [1, 1, 1], [0.05, 0, 0]));
  }
  if (hairStyle === 'hood') hg.push(bit(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, 2.1), pick(r, CLOTH), [0, 0.11, -0.01], [0.098, 0.12, 0.112]));
  // The cyberpunk bit: a lit implant over one eye, or a visor, or a neon-dyed streak.
  const gear = r();
  if (gear < 0.34) hl.push(bit(box(0.034, 0.03, 0.012), accent, [r() < 0.5 ? 0.036 : -0.036, 0.122, 0.097]));
  else if (gear < 0.5) hl.push(bit(box(0.17, 0.028, 0.012), accent, [0, 0.125, 0.093], [1, 1, 1], [0, 0, 0], 0.95));
  else if (gear < 0.62) hl.push(bit(box(0.01, 0.07, 0.012), accent, [0.084 * (r() < 0.5 ? 1 : -1), 0.03, 0.04]));
  if (plain) hl.length = 0;
  head.add(add(merge(hg), body, 0, 0, 0));
  if (hl.length) head.add(add(merge(hl), glow, 0, 0, 0, false));
  group.add(head);

  // ---- legs (pivot at the hip) and arms (pivot at the shoulder)
  const limb = (side: number, kind: 'leg' | 'arm') => {
    const g = new THREE.Group();
    const parts: THREE.BufferGeometry[] = [];
    const lit: THREE.BufferGeometry[] = [];
    if (kind === 'leg') {
      g.position.set(side * 0.095 * w, 0.93, 0);
      parts.push(bit(cyl(0.085, 0.066, 0.46, 14), trouser, [0, -0.23, 0]));
      parts.push(bit(cyl(0.064, 0.047, 0.44, 14), trouser, [0, -0.66, 0.0], [1, 1, 1], [0.04, 0, 0], 0.96));
      parts.push(bit(box(0.095, 0.075, 0.27), boot, [0, -0.86, 0.045]));
      parts.push(bit(box(0.098, 0.03, 0.28), 0x08090b, [0, -0.915, 0.05]));
      if (outfit === 5 || outfit === 1) lit.push(bit(box(0.01, 0.3, 0.01), accent, [side * 0.062, -0.45, 0.01]));
    } else {
      g.position.set(side * 0.235 * w, 0.93 + 0.5, 0);
      const sleeve = long || outfit === 0 || outfit === 1 || outfit === 3 ? base : shirt;
      parts.push(bit(cyl(0.052, 0.043, 0.31, 14), sleeve, [0, -0.16, 0]));
      parts.push(bit(cyl(0.042, 0.033, 0.27, 14), outfit === 5 ? skin : sleeve, [0, -0.44, 0.03], [1, 1, 1], [-0.22, 0, 0]));
      parts.push(bit(ball(0.036, 8, 6), skin, [0, -0.6, 0.075], [1, 1.2, 0.8]));
      if (r() < 0.3 || outfit === 1) lit.push(bit(box(0.012, 0.15, 0.012), accent, [side * 0.036, -0.45, 0.04], [1, 1, 1], [-0.22, 0, 0]));
    }
    if (plain) lit.length = 0;
    g.add(add(merge(parts), body));
    if (lit.length) g.add(add(merge(lit), glow, 0, 0, 0, false));
    group.add(g);
    return g;
  };
  const legL = limb(-1, 'leg'), legR = limb(1, 'leg'), armL = limb(-1, 'arm'), armR = limb(1, 'arm');

  group.scale.set(k * w, k, k * w);
  const phase = r() * 6.28;
  const stride = 0.85 + r() * 0.3;
  const hand = r();  // some people keep a hand in a pocket / on the hip
  const pose = (t: number, walking: boolean) => {
    const p = t * 6.2 * stride + phase;
    if (walking) {
      const s = Math.sin(p);
      legL.rotation.x = s * 0.55; legR.rotation.x = -s * 0.55;
      armL.rotation.x = -s * 0.42; armR.rotation.x = s * 0.42;
      torso.position.y = 0.93 + Math.abs(Math.cos(p)) * 0.02;
      torso.rotation.y = s * 0.07;
      head.rotation.y = -s * 0.07 + Math.sin(t * 0.4 + phase) * 0.12;
      head.position.y = 0.93 + 0.62 + Math.abs(Math.cos(p)) * 0.02;
    } else {
      const b = Math.sin(t * 1.4 + phase);
      legL.rotation.x = 0.02 + Math.sin(t * 0.3 + phase) * 0.03; legR.rotation.x = -0.02;
      armL.rotation.x = 0.04 + b * 0.012; armR.rotation.x = hand < 0.3 ? 0.9 : 0.04 - b * 0.012;
      armR.rotation.z = hand < 0.3 ? -0.2 : 0;
      torso.position.y = 0.93 + b * 0.004;
      torso.rotation.y = Math.sin(t * 0.21 + phase) * 0.05;
      head.rotation.y = Math.sin(t * 0.37 + phase) * 0.5;
      head.rotation.x = Math.sin(t * 0.23 + phase * 2) * 0.05;
    }
  };
  return { group, pose, height: H };
}
