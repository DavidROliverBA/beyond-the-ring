// A residential concourse inside a spun-up asteroid: a long street under a vaulted, sky-lit
// ceiling, with terraces of stacked housing climbing both walls. Our own design and geometry;
// the proportions follow reference stills of such a street, nothing is copied from them.
//
// Everything here is scenery (no collision). Units are metres; the street runs along +z.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Noise } from './textures';

type Rand = () => number;

const UNIT = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const UP = UNIT.getAttribute('position').array as Float32Array;
const UN = UNIT.getAttribute('normal').array as Float32Array;
const _c = new THREE.Color();

/** Many coloured boxes written straight into one geometry. */
class Boxes {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  /** A box of size (w, h, d) centred at (x, y, z), optionally tipped about the z axis. */
  add(w: number, h: number, d: number, x: number, y: number, z: number, color: number, tone = 1, rz = 0) {
    _c.set(color).multiplyScalar(tone);
    const c = Math.cos(rz), s = Math.sin(rz);
    for (let i = 0; i < UP.length; i += 3) {
      const lx = UP[i] * w, ly = UP[i + 1] * h, lz = UP[i + 2] * d;
      this.pos.push(x + lx * c - ly * s, y + lx * s + ly * c, z + lz);
      const nx = UN[i], ny = UN[i + 1];
      this.nor.push(nx * c - ny * s, nx * s + ny * c, UN[i + 2]);
      this.col.push(_c.r, _c.g, _c.b);
    }
  }
  mesh(mat: THREE.Material): THREE.Mesh | null {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return new THREE.Mesh(g, mat);
  }
}

function skyTexture(): THREE.CanvasTexture {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d')!;
  const N = new Noise(31);
  const img = x.createImageData(S, S);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      // Sampled on a torus so the panel repeats without a seam.
      const a = (i / S) * Math.PI * 2, b = (j / S) * Math.PI * 2, f = 1.1;
      const n = N.fbm(Math.cos(a) * f, Math.sin(a) * f + Math.cos(b) * f, Math.sin(b) * f, 5);
      const k = Math.min(1, Math.max(0, (n - 0.27) / 0.2)), cl = k * k * (3 - 2 * k);
      const o = (j * S + i) * 4;
      img.data[o] = 128 + cl * 104; img.data[o + 1] = 172 + cl * 66; img.data[o + 2] = 218 + cl * 24; img.data[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  // The seams between the light panels.
  x.strokeStyle = 'rgba(70,96,120,0.35)';
  x.lineWidth = 2;
  for (let i = 0; i <= S; i += S / 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke(); }
  for (let j = 0; j <= S; j += S / 4) { x.beginPath(); x.moveTo(0, j); x.lineTo(S, j); x.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export interface ConcourseOpts {
  /** Half the width of the street. */
  W: number;
  z0: number;
  z1: number;
  /** Height of the street-level shopfront wall the first terrace sits on. */
  wallH: number;
  /** Where planters stand, so foliage can be put in them: [x, z, length along z]. */
  planters: [number, number, number][];
  /** Where bikes are parked: [x, z, yaw]. */
  bikes: [number, number, number][];
}

const TIERS = 7, TIER_H = 3.1, CHUNK = 20;
/** How far forward of the previous terrace each one starts; the wall steepens as it climbs. */
const setback = (t: number) => 3.4 - t * 0.35;
/** Distance from the street's centre line to the front of terrace `t`. */
export function terraceFront(W: number, t: number): number {
  let x = W + 1.6;
  for (let i = 0; i < t; i++) x += setback(i);
  return x;
}

export function buildConcourse(r: Rand, o: ConcourseOpts): THREE.Group {
  const { W, z0, z1, wallH } = o;
  const len = z1 - z0, zm = (z0 + z1) / 2;
  const group = new THREE.Group();

  const wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.04 });
  const glassMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.7 });
  const litMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const sets = new Map<string, Boxes>();
  const into = (kind: 'wall' | 'glass' | 'lit', s: number, z: number) => {
    const key = `${kind}:${s}:${Math.floor((z - z0) / CHUNK)}`;
    let b = sets.get(key);
    if (!b) sets.set(key, (b = new Boxes()));
    return b;
  };
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)];
  const BODY = [0xe4e5e1, 0xe4e5e1, 0xd9dcdb, 0xc3c8cb, 0xaab1b6, 0x8e989e, 0x5f989b, 0x4b8388];
  const TRIM = [0x3f8f96, 0xd8a53a, 0xb5552f, 0x55606a];

  for (const s of [-1, 1]) {
    for (let t = 0; t < TIERS; t++) {
      const xf = terraceFront(W, t), yb = wallH + t * TIER_H;
      // What shows through the gaps, and the walkway each terrace opens on to.
      for (let z = z0; z < z1; z += CHUNK) {
        const L = Math.min(CHUNK, z1 - z), zc = z + L / 2;
        into('wall', s, zc).add(5.6, TIER_H, L, s * (xf + 3.9), yb + TIER_H / 2, zc, 0x767e85);
        into('wall', s, zc).add(1.9, 0.22, L, s * (xf - 0.65), yb - 0.11, zc, 0x9299a0);
      }
      let z = z0 + r() * 2;
      while (z < z1 - 3.5) {
        let L = 5 + r() * 4.5;
        if (z + L > z1 - 3.5) L = z1 - z;
        const tall = t < TIERS - 1 && r() < 0.16;
        const zc = z + L / 2, jit = r() < 0.2 ? -0.9 - r() * 0.5 : r() * 1.3, depth = 6, hgt = tall ? 2.95 + TIER_H : 2.95, fx = xf + jit;
        const wall = into('wall', s, zc), glass = into('glass', s, zc), lit = into('lit', s, zc);
        wall.add(depth, hgt, L - 0.25, s * (fx + depth / 2), yb + hgt / 2, zc, pick(BODY), 0.92 + r() * 0.12);
        wall.add(depth + 0.35, 0.13, L - 0.1, s * (fx + depth / 2 - 0.18), yb + hgt + 0.065, zc, 0x8f979d);
        if (r() < 0.4) wall.add(0.08, 0.45, L - 0.25, s * (fx - 0.03), yb + 2.55, zc, pick(TRIM));
        // A door and a row of windows on the street side.
        const n = Math.max(1, Math.floor((L - 1) / 2.1)), door = Math.floor(r() * n);
        for (let i = 0; i < n; i++) {
          const wz = z + 0.6 + ((i + 0.5) * (L - 1.2)) / n;
          if (i === door) {
            glass.add(0.07, 2.1, 0.95, s * (fx - 0.02), yb + 1.05, wz, 0x25323c);
            wall.add(0.1, 0.08, 1.15, s * (fx - 0.04), yb + 2.17, wz, 0x6d757b);
          } else if (r() < 0.22) {
            lit.add(0.07, 1.2, 1.3, s * (fx - 0.02), yb + 1.6, wz, 0xffd9a0, 1.15);
          } else {
            glass.add(0.07, 1.2, 1.3, s * (fx - 0.02), yb + 1.6, wz, pick([0x2c3f50, 0x334a5c, 0x26343f]));
          }
          if (i !== door) wall.add(0.14, 0.06, 1.45, s * (fx - 0.06), yb + 0.97, wz, 0x7d858b);
        }
        // The railing along the walkway's edge.
        const rx = s * (xf - 1.5);
        wall.add(0.06, 0.06, L, rx, yb + 1.05, zc, 0x4a535b);
        wall.add(0.04, 0.04, L, rx, yb + 0.55, zc, 0x4a535b);
        const posts = Math.ceil(L / 1.6);
        for (let i = 0; i < posts; i++) wall.add(0.05, 1.05, 0.05, rx, yb + 0.525, z + ((i + 0.5) * L) / posts, 0x4a535b);
        // Things people leave on a walkway and a roof.
        if (r() < 0.35) wall.add(0.5, 0.5 + r() * 0.5, 0.5 + r() * 0.8, s * (xf - 0.5), yb + 0.3, z + 1 + r() * (L - 2), pick([0x6a7a4a, 0x8a6a4a, 0x55606a, 0xb08a2e]));
        if (r() < 0.3) wall.add(1.2, 0.6, 1.4, s * (fx + 2 + r() * 2.5), yb + hgt + 0.43, z + 1 + r() * (L - 2), 0x7a8288);
        // A steep outside stair up to the next terrace, in the gap after this unit.
        const stair = t < TIERS - 1 && r() < 0.24;
        if (stair) {
          const x0 = xf - 0.3, x1 = xf + setback(t) - 1.7, run = x1 - x0, hyp = Math.hypot(run, TIER_H), a = s * Math.atan2(TIER_H, run), sz = z + L + 0.75;
          wall.add(hyp, 0.16, 1.05, s * (x0 + run / 2), yb + TIER_H / 2 - 0.05, sz, 0x858d93, 1, a);
          for (const e of [-0.52, 0.52]) wall.add(hyp, 0.05, 0.05, s * (x0 + run / 2), yb + TIER_H / 2 + 0.95, sz + e, 0x4a535b, 1, a);
        }
        z += L + (stair ? 1.5 : r() < 0.3 ? 0.7 : 0);
      }
    }
    // Street level: shop windows, doors and awnings against the wall.
    for (let z = z0 + 4; z < z1 - 4; z += 6.2) {
      const zc = z + (r() - 0.5), wall = into('wall', s, zc), glass = into('glass', s, zc), lit = into('lit', s, zc);
      if (r() < 0.7) lit.add(0.06, 1.7, 3.2, s * (W - 0.04), 1.45, zc, pick([0xffe2b8, 0xdfeeff, 0xffd0a0]), 0.95);
      else glass.add(0.06, 2.2, 1.6, s * (W - 0.04), 1.1, zc, 0x25323c);
      wall.add(0.12, 0.1, 3.5, s * (W - 0.07), 2.38, zc, 0x5a646c);
      if (r() < 0.6) wall.add(1.5, 0.06, 3.6, s * (W - 0.72), 2.72, zc, pick(TRIM), 1, s * 0.2);
    }
  }
  for (const [key, b] of sets) {
    const kind = key.split(':')[0];
    const m = b.mesh(kind === 'wall' ? wallMat : kind === 'glass' ? glassMat : litMat)!;
    m.castShadow = kind === 'wall';
    group.add(m);
  }

  // The vault: light panels made up as a sky, ribs across it and purlins along it.
  const R = 42, yc = 4, dip = 0.3;
  const sky = skyTexture();
  sky.repeat.set(3, len / 56);
  const vault = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, len, 64, 1, true, Math.PI / 2 - dip, Math.PI + dip * 2).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: sky, color: 0xdadada, side: THREE.BackSide }),
  );
  vault.position.set(0, yc, zm);
  group.add(vault);
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x566878, roughness: 0.6, metalness: 0.4 });
  for (let z = z0 + 8; z < z1; z += 16) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(R - 0.5, 0.42, 6, 56, Math.PI + dip * 2), ribMat);
    rib.rotation.z = -dip;
    rib.position.set(0, yc, z);
    group.add(rib);
  }
  for (const a of [0.55, 1.05, Math.PI / 2, Math.PI - 1.05, Math.PI - 0.55]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, len), ribMat);
    p.position.set(Math.cos(a) * (R - 0.4), yc + Math.sin(a) * (R - 0.4), zm);
    p.rotation.z = a;
    group.add(p);
  }
  // The far end is lost in haze; the near end is a bulkhead over the way in.
  const far = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R + yc), new THREE.MeshBasicMaterial({ color: 0xbfd0df, fog: false }));
  far.position.set(0, (R + yc) / 2, z1);
  far.rotation.y = Math.PI;
  group.add(far);
  const near = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R + yc), new THREE.MeshStandardMaterial({ color: 0x9aa3aa, roughness: 0.9 }));
  near.position.set(0, (R + yc) / 2 + wallH, z0 - 0.05);
  group.add(near);

  // Planting: broad blades fanning out of each planter.
  const leaves: THREE.BufferGeometry[] = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const GREEN = [0x2f5a34, 0x3d6f3a, 0x4a7f42, 0x2a4f3a, 0x587f3c];
  for (const [px, pz, pl] of o.planters) {
    const n = Math.round(pl * 9);
    for (let i = 0; i < n; i++) {
      const hgt = 0.45 + r() * 0.6, g = new THREE.ConeGeometry(0.16 + r() * 0.1, hgt, 5).toNonIndexed();
      g.deleteAttribute('uv');
      g.translate(0, hgt / 2, 0);
      e.set(0.35 + r() * 0.85, r() * Math.PI * 2, 0, 'YXZ');
      m4.compose(new THREE.Vector3(px + (r() - 0.5) * 0.9, 0.5, pz + (r() - 0.5) * (pl - 0.5)), q.setFromEuler(e), new THREE.Vector3(1, 1, 0.3));
      g.applyMatrix4(m4);
      _c.set(pick(GREEN)).multiplyScalar(0.55 + r() * 0.4);
      const col = new Float32Array(g.getAttribute('position').count * 3);
      for (let k = 0; k < col.length; k += 3) col.set([_c.r, _c.g, _c.b], k);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      leaves.push(g);
    }
  }
  if (leaves.length) {
    const lg = mergeGeometries(leaves, false)!;
    lg.computeVertexNormals();
    const plants = new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }));
    plants.castShadow = true;
    group.add(plants);
  }

  // Bikes leaning in their racks.
  const bikeMat = new THREE.MeshStandardMaterial({ color: 0x23272c, roughness: 0.5, metalness: 0.6 });
  const wheel = new THREE.TorusGeometry(0.33, 0.022, 6, 20);
  for (const [bx, bz, yaw] of o.bikes) {
    const b = new THREE.Group();
    for (const wx of [-0.52, 0.52]) { const w = new THREE.Mesh(wheel, bikeMat); w.position.set(wx, 0.35, 0); b.add(w); }
    const bar = (l: number, x: number, y: number, a: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(l, 0.035, 0.035), bikeMat); m.position.set(x, y, 0); m.rotation.z = a; b.add(m); };
    bar(0.75, 0.05, 0.62, 0.12); bar(0.62, -0.25, 0.5, 0.95); bar(0.6, 0.22, 0.52, -1.05); bar(0.5, 0.5, 0.62, 1.25); bar(0.3, -0.36, 0.86, 0);
    b.traverse((m) => { (m as THREE.Mesh).castShadow = true; });
    b.position.set(bx, 0, bz);
    b.rotation.set(0.12, yaw, 0, 'YXZ');
    group.add(b);
  }
  return group;
}
