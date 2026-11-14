// Crowds of ships. Each model is drawn once per part with instancing, so a few hundred
// hulls cost a few dozen draw calls. Ships fly slow ellipses round a port, a planet or a
// queue at the gate; a warm or blue glint at the stern keeps them visible from far off.

import * as THREE from 'three';
import { buildModel, type ShipModel } from './ships';
import { rng } from './textures';

type V3 = THREE.Vector3;

/** Lengths are in scene units where one unit is about 200 m, the scale ships and stations share. */
const KINDS: { model: ShipModel; len: number; w: number }[] = [
  { model: 'racer', len: 0.1, w: 6 },
  { model: 'corvette', len: 0.23, w: 4 },
  { model: 'freighter', len: 0.5, w: 6 },
  { model: 'hauler', len: 1.0, w: 2.5 },
  { model: 'survey', len: 0.7, w: 1.6 },
  { model: 'stealth', len: 0.4, w: 0.4 },
  { model: 'battleship', len: 2.4, w: 0.35 },
  { model: 'dreadnought', len: 3.6, w: 0.15 },
];
const TOTAL_W = KINDS.reduce((a, k) => a + k.w, 0);

export interface Cluster {
  centre: V3;
  n: number;
  inner: number;
  outer: number;
  /** 1 keeps every orbit in the plane of the system, 0 tilts them all ways. */
  flat?: number;
  /** Typical speed in units per second. */
  speed?: number;
  /** Multiplies ship size; the ring space is drawn larger than Sol. */
  scale?: number;
  /** Only these kinds, by model name. */
  only?: ShipModel[];
}

interface Craft {
  kind: number;
  slot: number;
  c: V3;
  u: V3;
  v: V3;
  a: number;
  b: number;
  w: number;
  phase: number;
  len: number;
  tint: THREE.Color;
}

interface Part { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[]; local: THREE.Matrix4 }

function randomBasis(r: () => number, flat: number): [V3, V3] {
  const n = new THREE.Vector3(0, 1, 0);
  if (flat < 1) {
    const tilt = (1 - flat) * Math.PI * 0.5 * r();
    const az = r() * Math.PI * 2;
    n.set(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az)).normalize();
  }
  const ref = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(ref, n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return [u, v];
}

export function makeTraffic(clusters: Cluster[], seed: number): { group: THREE.Group; tick: (dt: number) => void; count: number } {
  const r = rng(seed);
  const group = new THREE.Group();
  const crafts: Craft[] = [];
  const perKind = KINDS.map(() => 0);

  for (const cl of clusters) {
    const pool = cl.only ? KINDS.filter((k) => cl.only!.includes(k.model)) : KINDS;
    const poolW = pool.reduce((a, k) => a + k.w, 0);
    for (let i = 0; i < cl.n; i++) {
      let pick = r() * (cl.only ? poolW : TOTAL_W);
      let kind = pool[0];
      for (const k of pool) { pick -= k.w; if (pick <= 0) { kind = k; break; } }
      const ki = KINDS.indexOf(kind);
      const [u, v] = randomBasis(r, cl.flat ?? 0.35);
      // Big hulls keep further out and move slower.
      const big = Math.min(1, kind.len / 3);
      const a = cl.inner + (cl.outer - cl.inner) * (Math.pow(r(), 0.8) * (1 - big * 0.4) + big * 0.4 * r());
      const speed = (cl.speed ?? 1.2) * (0.6 + r() * 0.8) * (1 - big * 0.5);
      const scale = cl.scale ?? 1;
      const dir = r() < 0.5 ? 1 : -1;
      crafts.push({
        kind: ki, slot: perKind[ki]++, c: cl.centre, u, v, a, b: a * (0.62 + r() * 0.38),
        w: (dir * speed) / Math.max(a, 0.5), phase: r() * Math.PI * 2, len: kind.len * scale * (0.85 + r() * 0.3),
        tint: new THREE.Color(r() < 0.25 ? 0xffd9a8 : r() < 0.5 ? 0xffffff : 0x9fd8ff),
      });
    }
  }

  // One InstancedMesh per mesh of each model in use.
  const meshes: { parts: Part[]; inst: THREE.InstancedMesh[] }[] = KINDS.map((k, i) => {
    if (!perKind[i]) return { parts: [], inst: [] };
    const tpl = buildModel(k.model);
    tpl.updateMatrixWorld(true);
    const parts: Part[] = [];
    tpl.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) parts.push({ geo: m.geometry, mat: m.material, local: m.matrixWorld.clone() });
    });
    const inst = parts.map((p) => {
      const im = new THREE.InstancedMesh(p.geo, p.mat, perKind[i]);
      im.frustumCulled = false;
      im.castShadow = false;
      group.add(im);
      return im;
    });
    return { parts, inst };
  });

  // Engine glints.
  const N = crafts.length;
  const gp = new Float32Array(N * 3), gc = new Float32Array(N * 3);
  crafts.forEach((c, i) => gc.set([c.tint.r, c.tint.g, c.tint.b], i * 3));
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(gp, 3));
  gg.setAttribute('color', new THREE.BufferAttribute(gc, 3));
  const glints = new THREE.Points(gg, new THREE.PointsMaterial({
    size: 3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  glints.frustumCulled = false;
  group.add(glints);

  const pos = new THREE.Vector3(), vel = new THREE.Vector3(), M = new THREE.Matrix4(), L = new THREE.Matrix4();
  const S = new THREE.Matrix4(), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3(), tgt = new THREE.Vector3();
  let clock = 0;

  const place = () => {
    for (let i = 0; i < N; i++) {
      const c = crafts[i];
      const th = c.phase + c.w * clock;
      const cs = Math.cos(th), sn = Math.sin(th);
      pos.copy(c.c).addScaledVector(c.u, c.a * cs).addScaledVector(c.v, c.b * sn);
      vel.copy(c.u).multiplyScalar(-c.a * sn * c.w).addScaledVector(c.v, c.b * cs * c.w);
      if (vel.lengthSq() < 1e-12) vel.set(0, 0, -1);
      fwd.copy(vel).normalize();
      // Matrix4.lookAt points -Z at the target, which is where the models' noses are.
      tgt.copy(pos).add(fwd);
      M.lookAt(pos, tgt, up).setPosition(pos);
      S.makeScale(c.len, c.len, c.len);
      M.multiply(S);
      const { parts, inst } = meshes[c.kind];
      for (let p = 0; p < parts.length; p++) {
        inst[p].setMatrixAt(c.slot, L.multiplyMatrices(M, parts[p].local));
      }
      gp[i * 3] = pos.x - fwd.x * c.len * 0.5;
      gp[i * 3 + 1] = pos.y - fwd.y * c.len * 0.5;
      gp[i * 3 + 2] = pos.z - fwd.z * c.len * 0.5;
    }
    for (const m of meshes) for (const im of m.inst) im.instanceMatrix.needsUpdate = true;
    gg.attributes.position.needsUpdate = true;
  };
  place();
  return {
    group, count: N,
    tick: (dt) => { clock += dt; place(); },
  };
}
