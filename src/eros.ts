// Eros: the rock itself (procedural, real proportions) and the places the story's station would stand. No file is loaded.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Noise, rng } from './textures';

/** 433 Eros, one unit long along Z (the real long axis is 34.4 km; its other two are 11.2 km: the figures in assets/data/facts.json, from the JPL
 *  Small-Body Database). It is NOT the NEAR Shoemaker shape model: a peanut with a saddle (the real Himeros), a slight bend, lumps from noise,
 *  and craters scattered from a seeded generator, so it is the same each time. Its biggest crater, near one end, stands for the real Psyche
 *  (about 5.3 km across, 0.15 of the length). The surface relief is made twice over: real geometry for the craters, and a fine bump added in the
 *  shader so a close pass is not smooth. Nothing is loaded, so it adds no file size. */
export const EROS_HALF_W = 11.2 / 34.4 / 2;   // 0.163: the 11.2 km width as a fraction of the 34.4 km length, halved

export interface Crater { c: THREE.Vector3; r: number }
let erosCache: { geo: THREE.BufferGeometry; craters: Crater[] } | undefined;

function erosBase(vx: number, vy: number, vz: number, nz: Noise, out: THREE.Vector3) {
  const z = vz * 0.5, u = 2 * z;                                       // u runs -1..1 along the length
  const saddle = 1 - 0.3 * Math.exp(-((z / 0.12) ** 2));              // the pinched waist
  const fat = 1 + 0.1 * u;                                             // one end a little stouter, as the real one is
  let rho = EROS_HALF_W * Math.pow(Math.max(0, 1 - u * u), 0.42) * saddle * fat;
  const rxy = Math.hypot(vx, vy) || 1;
  const ax = vx / rxy, ay = vy / rxy;
  const lump = 1 + 0.2 * (nz.n3(vx * 1.7 + 5, vy * 1.7 + 5, vz * 1.7 + 5) - 0.5) + 0.07 * (nz.n3(vx * 4.1, vy * 4.1, vz * 4.1) - 0.5);
  rho *= lump;
  // A slow bend along the length and a cross-section a little flatter one way than the other.
  out.set(ax * rho * 1.06, ay * rho * 0.94 - 0.05 * (1 - u * u) + 0.02 * u, z);
}

export function erosGeometry() {
  if (erosCache) return erosCache;
  const rnd = rng(433), nz = new Noise(433);
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 58);
  geo.deleteAttribute('uv'); geo.deleteAttribute('normal');
  geo = mergeVertices(geo, 1e-4);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const n = pos.count, v = new THREE.Vector3();
  for (let i = 0; i < n; i++) { v.fromBufferAttribute(pos, i).normalize(); erosBase(v.x, v.y, v.z, nz, v); pos.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  // Craters, big to small, on random directions of the base surface.
  const craters: Crater[] = [];
  const tmp = new THREE.Vector3();
  const place = (r: number) => {
    const th = Math.acos(2 * rnd() - 1), ph = 2 * Math.PI * rnd();
    erosBase(Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th), nz, tmp);
    craters.push({ c: tmp.clone(), r });
  };
  // The "Psyche" crater: first, large, near the stout end.
  erosBase(0.5, 0.35, 0.8, nz, tmp); craters.push({ c: tmp.clone(), r: 0.075 });
  for (let i = 0; i < 12; i++) place(0.035 + 0.035 * rnd());
  for (let i = 0; i < 55; i++) place(0.014 + 0.02 * rnd());
  for (let i = 0; i < 220; i++) place(0.005 + 0.009 * rnd());
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute;
  const col = new Float32Array(n * 3);
  const base = new THREE.Color(0x5e584f), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    let h = 0, rim = 0;
    for (const k of craters) {
      const dx = v.x - k.c.x, dy = v.y - k.c.y, dz = v.z - k.c.z, d2 = dx * dx + dy * dy + dz * dz, rr = k.r * 1.45;
      if (d2 > rr * rr) continue;
      const d = Math.sqrt(d2) / k.r, depth = 0.2 * k.r;
      if (d < 1) { const q = 1 - d * d; h -= depth * q * (0.6 + 0.4 * q); } 
      const rm = 0.28 * depth * Math.exp(-(((d - 1.02) / 0.2) ** 2));
      h += rm; rim += rm / depth;
    }
    h *= 1;
    const nx = nrm.getX(i), ny = nrm.getY(i), nzz = nrm.getZ(i);
    pos.setXYZ(i, v.x + nx * h, v.y + ny * h, v.z + nzz * h);
    const tone = 0.78 + 0.4 * nz.n3(v.x * 22, v.y * 22, v.z * 22) + 0.9 * rim * 0.4 + 1.6 * h;
    c.copy(base).multiplyScalar(Math.min(1.25, Math.max(0.45, tone)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere(); geo.computeBoundingBox();
  erosCache = { geo, craters };
  return erosCache;
}

let erosMat: THREE.MeshStandardMaterial | undefined;
/** Rock: vertex-colour albedo, rough, and a bump from layered noise in the shader (no texture file). */
export function erosMaterial() {
  if (erosMat) return erosMat;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.02 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vEP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vEP = position;');
    sh.fragmentShader = `varying vec3 vEP; uniform mat3 normalMatrix;
      float eh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float en(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(eh(i), eh(i + vec3(1,0,0)), f.x), mix(eh(i + vec3(0,1,0)), eh(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(eh(i + vec3(0,0,1)), eh(i + vec3(1,0,1)), f.x), mix(eh(i + vec3(0,1,1)), eh(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float eb(vec3 p) { return 0.6 * en(p * 70.0) + 0.3 * en(p * 190.0) + 0.1 * en(p * 520.0); }\n` +
      sh.fragmentShader
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          { float e = 0.004; float b0 = eb(vEP);
            vec3 g = vec3(eb(vEP + vec3(e, 0., 0.)) - b0, eb(vEP + vec3(0., e, 0.)) - b0, eb(vEP + vec3(0., 0., e)) - b0) / e;
            normal = normalize(normal - 0.0045 * normalize(normalMatrix * g) * min(1.0, length(g) * 0.02) * 55.0 + 0.0); }`)
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 0.82 + 0.36 * eb(vEP * 0.7 + 3.0);');
  };
  m.customProgramCacheKey = () => 'eros-rock';
  erosMat = m;
  return m;
}

/** A point on Eros's surface found by shooting a ray at the axis from `from` (model units), and the surface normal there. */
export function erosHit(from: THREE.Vector3, mesh: THREE.Mesh): { p: THREE.Vector3; n: THREE.Vector3 } {
  const ray = new THREE.Raycaster(from, new THREE.Vector3(0, 0, from.z).sub(from).normalize(), 0, 5);
  const hit = ray.intersectObject(mesh)[0];
  if (!hit) throw new Error('eros: dressing ray missed');
  return { p: hit.point.clone(), n: hit.face!.normal.clone() };
}


/** Where on the rock each piece of the (fictional) station stands: a direction from the axis, [x, up, z] (the ray runs at the axis at that z). */
export const STATION_SPOTS = {
  domeA: [0.5, 1, -0.2], domeB: [0.9, 1, -0.05], domeC: [-0.5, 1, -0.28], domeD: [0.6, 1, 0.12],
  pad: [-0.45, 1, 0.05], spar: [0.0, 1, -0.1], towerA: [0.3, 1, 0.25], towerB: [-0.25, 0.6, -0.38],
} as const satisfies Record<string, readonly [number, number, number]>;
/** Length of the docking spar (model units), where its cradle disc sits along it, and the disc's radius. */
export const SPAR = { len: 0.052, r: 0.0036 };

let rockMesh: THREE.Mesh | undefined;
/** The bare rock as a mesh, built once (for ray tests). */
export function erosRock(): THREE.Mesh {
  if (!rockMesh) { rockMesh = new THREE.Mesh(erosGeometry().geo); rockMesh.updateMatrixWorld(); }
  return rockMesh;
}
/** The centre of the docking cradle, in model units (rock at the origin, long axis Z, unit length). */
export function sparDock(): THREE.Vector3 {
  const d = STATION_SPOTS.spar, { p, n } = erosHit(new THREE.Vector3(d[0] * 2, d[1] * 2, d[2]), erosRock());
  return p.addScaledVector(n, SPAR.len);
}
/** The surface normal at the spar's foot (the direction the spar points). */
export function sparAxis(): THREE.Vector3 {
  const d = STATION_SPOTS.spar;
  return erosHit(new THREE.Vector3(d[0] * 2, d[1] * 2, d[2]), erosRock()).n;
}
