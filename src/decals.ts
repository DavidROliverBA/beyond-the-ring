// Hull names, registry marks and insignia for the hero ships (E1.4.d).
//
// Everything here is drawn by this file: lettering in a plain stencil-ish face, and badges of our own
// design (simple flags of shape and colour: a disc, a chevron, a drop, stars). None of it is taken from the
// books, the series or any licensed game, and the registry numbers are invented. See CREDITS.md.
//
// A decal is a small mesh laid over the hull. Its grid of points is shot at the model along a fixed
// direction, so it follows the hull's curve and stands a hair off the paint. It is made once per ship,
// after the model's materials are prepared, and shared by every clone.

import * as THREE from 'three';

type V3 = [number, number, number];

export type Badge = 'mars' | 'un' | 'company' | 'roci' | 'yard';

export interface DecalSpec {
  /** Lettering, or a badge. */
  text?: string;
  badge?: Badge;
  /** Where the middle of the decal sits before it is shot at the hull (model units). */
  at: V3;
  /** The way it is shot: from `at` towards the hull. */
  dir: V3;
  /** Which way is up for the lettering. */
  up: V3;
  /** Size across and up (model units). */
  w: number; h: number;
  /** Paint colour; the default is a warm off-white. */
  ink?: string;
  /** Panel colour behind the lettering, if it needs one (a band of the hull's own paint). */
  plate?: string;
  /** Bold, wide lettering for names; narrower for numbers. */
  wide?: boolean;
}

const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();

// ---- Painting

function rough(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  // Worn paint: speckles knocked out of the lettering, and a few streaks running down from it.
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < w * h / 700; i++) {
    ctx.globalAlpha = 0.25 + r() * 0.6;
    const k = 1 + r() * 4;
    ctx.fillRect(r() * w, r() * h, k * (r() < 0.2 ? 4 : 1), k);
  }
  for (let i = 0; i < 9; i++) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const x = r() * w;
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.4 + r() * 0.3, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 2 + r() * 8, h);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function paintBadge(ctx: CanvasRenderingContext2D, size: number, badge: Badge) {
  const c = size / 2;
  ctx.save();
  ctx.translate(c, c);
  const disc = (r: number, col: string) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); };
  const ring = (r: number, t: number, col: string) => { ctx.strokeStyle = col; ctx.lineWidth = t; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); };
  const star = (x: number, y: number, r: number, col: string) => {
    ctx.fillStyle = col; ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  };
  const R = c * 0.94;
  if (badge === 'mars') {
    // Red disc, pale rim, a chevron over a bar and four rivets: the navy of a world with one colour.
    disc(R, '#d8d2c4'); disc(R * 0.9, '#9c2f22');
    ctx.strokeStyle = '#ece6d6'; ctx.lineWidth = R * 0.13; ctx.lineJoin = 'miter';
    ctx.beginPath(); ctx.moveTo(-R * 0.5, R * 0.28); ctx.lineTo(0, -R * 0.38); ctx.lineTo(R * 0.5, R * 0.28); ctx.stroke();
    ctx.fillStyle = '#ece6d6'; ctx.fillRect(-R * 0.5, R * 0.46, R, R * 0.1);
    for (const a of [0.8, 2.34, 3.9, 5.48]) { ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.76, Math.sin(a) * R * 0.76, R * 0.04, 0, 7); ctx.fill(); }
  } else if (badge === 'un') {
    // Blue disc, pale ring, three stars over a plain horizon bar: the fleet of a crowded planet.
    disc(R, '#d8dde2'); disc(R * 0.9, '#2a4f86'); ring(R * 0.68, R * 0.05, '#d8dde2');
    for (const [x, y, k] of [[-0.3, -0.12, 0.17], [0, -0.3, 0.21], [0.3, -0.12, 0.17]] as const) star(x * R, y * R, k * R, '#e9edf0');
    ctx.fillStyle = '#e9edf0'; ctx.fillRect(-R * 0.55, R * 0.22, R * 1.1, R * 0.08); ctx.fillRect(-R * 0.38, R * 0.4, R * 0.76, R * 0.06);
  } else if (badge === 'company') {
    // A water company: a drop inside a ring.
    disc(R, '#e8eef0'); ring(R * 0.84, R * 0.09, '#1c6f8e');
    ctx.fillStyle = '#1c6f8e'; ctx.beginPath();
    ctx.moveTo(0, -R * 0.52); ctx.bezierCurveTo(R * 0.12, -R * 0.2, R * 0.42, R * 0.02, R * 0.42, R * 0.22);
    ctx.arc(0, R * 0.22, R * 0.42, 0, Math.PI); ctx.bezierCurveTo(-R * 0.42, R * 0.02, -R * 0.12, -R * 0.2, 0, -R * 0.52); ctx.fill();
    ctx.fillStyle = '#e8eef0'; ctx.beginPath(); ctx.ellipse(-R * 0.16, R * 0.18, R * 0.07, R * 0.13, 0.4, 0, 7); ctx.fill();
  } else if (badge === 'roci') {
    // The old horse's ship: a lance across a round shield, one star at the point.
    disc(R, '#d9d3c3'); disc(R * 0.88, '#35302b');
    ctx.strokeStyle = '#d9d3c3'; ctx.lineWidth = R * 0.09; ctx.beginPath(); ctx.moveTo(-R * 0.62, R * 0.5); ctx.lineTo(R * 0.55, -R * 0.55); ctx.stroke();
    ctx.fillStyle = '#d9d3c3'; ctx.beginPath(); ctx.moveTo(R * 0.7, -R * 0.7); ctx.lineTo(R * 0.46, -R * 0.4); ctx.lineTo(R * 0.4, -R * 0.62); ctx.closePath(); ctx.fill();
    ring(R * 0.58, R * 0.05, '#b7432f'); star(-R * 0.3, -R * 0.22, R * 0.2, '#d9d3c3');
  } else {
    // A yard mark: a sphere with two rings.
    disc(R, '#d6d2c6'); disc(R * 0.88, '#40382f');
    ctx.strokeStyle = '#d6d2c6'; ctx.lineWidth = R * 0.07;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.36, 0, 7); ctx.stroke();
    for (const t of [-0.35, 0.35]) { ctx.beginPath(); ctx.ellipse(0, t * R * 0.3, R * 0.7, R * 0.16, 0, 0, 7); ctx.stroke(); }
  }
  ctx.restore();
}

/** Paint a decal. Lettering takes the shape of its own text: the result says how wide and high it ends up
 *  (model units), at most the spec's `w` by `h`. */
function paint(d: DecalSpec, seed: number): { map: THREE.CanvasTexture; w: number; h: number } | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d')!;
  let w = d.w, h = d.h;
  if (d.badge) {
    cv.width = cv.height = 512;
    paintBadge(ctx, 512, d.badge);
    rough(ctx, 512, 512, seed);
    h = w;
  } else {
    const face = (p: number) => `${d.wide ? 800 : 700} ${p}px "Arial Narrow", "Helvetica Neue", "Avenir Next Condensed", Arial, sans-serif`;
    const spacing = d.wide ? 0.1 : 0.06;
    const text = d.text!;
    // Measure at a fixed size to find the lettering's shape, then size the canvas to it.
    ctx.font = face(100);
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${100 * spacing}px`;
    const aspect = ctx.measureText(text).width / 116;   // across / up, with a little margin round the caps
    if (h * aspect > w) h = w / aspect; else w = h * aspect;
    const ch = 128, cw = Math.round(ch * aspect);
    cv.width = cw; cv.height = ch;
    if (d.plate) { ctx.fillStyle = d.plate; ctx.fillRect(0, 0, cw, ch); }
    ctx.fillStyle = d.ink ?? '#ebe5d3';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const px = ch / 1.16;
    ctx.font = face(px);
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px * spacing}px`;
    ctx.fillText(text, cw / 2, ch / 2 + px * 0.04);
    rough(ctx, cw, ch, seed);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { map: t, w, h };
}

// ---- Laying on the hull

/** Build one decal mesh, or null if the shot misses the hull. `hull` is everything the shot may hit. */
function lay(d: DecalSpec, hull: THREE.Object3D[], seed: number): THREE.Mesh | null {
  const painted = paint(d, seed);
  if (!painted) return null;
  const { map } = painted;
  const dir = new THREE.Vector3(...d.dir).normalize();
  const up = new THREE.Vector3(...d.up).normalize();
  const right = new THREE.Vector3().crossVectors(dir, up).normalize();   // a viewer looking along `dir`, head towards `up`
  const { w, h } = painted;
  const nx = Math.max(6, Math.round(w / 0.02)), ny = d.badge ? 8 : 3;
  const at = new THREE.Vector3(...d.at);
  const hits: (number | null)[] = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      _v.copy(at).addScaledVector(right, (i / nx - 0.5) * w).addScaledVector(up, (j / ny - 0.5) * h);
      _ray.set(_v, dir);
      _ray.far = 6;
      const hit = _ray.intersectObjects(hull, false)[0];
      hits.push(hit ? hit.distance : null);
    }
  }
  const real = hits.filter((x): x is number => x !== null);
  if (real.length < hits.length * 0.8) return null;
  // Fittings and plate relief make single points jump. A point that stands out from the median of its own
  // neighbours by more than a hair is pulled back to it; a smooth swell (a dome) passes untouched.
  const slack = 0.003 * Math.max(1, w / 0.2);
  const lift = 0.0009 * Math.max(1, w / 0.15);
  const at2 = (i: number, j: number) => hits[Math.min(ny, Math.max(0, j)) * (nx + 1) + Math.min(nx, Math.max(0, i))];
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const near: number[] = [];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const v = at2(i + di, j + dj); if (v !== null) near.push(v); }
      near.sort((x, y) => x - y);
      const med = near[Math.floor(near.length / 2)];
      const own = at2(i, j);
      // A point nearer the viewer than its neighbours is a fitting to ride over; clamp it, and one farther is a gap.
      const t = own === null ? med : Math.min(Math.max(own, med - slack), med + slack * 0.25);
      _v.copy(at).addScaledVector(right, (i / nx - 0.5) * w).addScaledVector(up, (j / ny - 0.5) * h).addScaledVector(dir, t - lift);
      pos.push(_v.x, _v.y, _v.z);
      uv.push(i / nx, j / ny);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, e = c + 1;
      idx.push(a, b, e, a, e, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map, transparent: true, alphaTest: 0.04, depthWrite: false, roughness: 0.62, metalness: 0,
    side: THREE.DoubleSide,   // (no polygon offset: the depth buffer may be reversed, which flips its sign; the lift above is enough)
  });
  const m = new THREE.Mesh(geo, mat);
  m.name = 'decal';
  m.renderOrder = 2;
  return m;
}

/** Lay every decal of `list` on `root` (a prepared model, in its own units). */
export function addDecals(root: THREE.Object3D, list: DecalSpec[]) {
  root.updateMatrixWorld(true);
  const hull: THREE.Object3D[] = [];
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh && o.name !== 'decal') hull.push(o); });
  list.forEach((d, i) => {
    const m = lay(d, hull, 17 + i * 31);
    if (m) root.add(m);
    else console.warn('A hull decal missed the hull:', d.text ?? d.badge);
  });
}

// ---- Where each ship carries its marks. Model axes: nose -Z, up +Y, starboard +X.


/** Marks per ship id (the name a body or a scenario actor goes by). Registry numbers are invented. */
export const DECALS: Record<string, DecalSpec[]> = {
  // The Donnager-class battleship: name on both flanks, a registry on the back of the bow, a navy disc each side.
  donnager: [
    { text: 'DONNAGER', at: [0.5, 0.045, -0.2], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.2, h: 0.04, wide: true },
    { text: 'DONNAGER', at: [-0.5, 0.045, -0.2], dir: [1, 0, 0], up: [0, 1, 0], w: 0.2, h: 0.04, wide: true },
    { text: 'MCRN  BB-0417', at: [0, 0.5, -0.39], dir: [0, -1, 0], up: [1, 0, 0], w: 0.1, h: 0.024 },
    { badge: 'mars', at: [0.5, 0.04, 0.17], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.07, h: 0.07 },
    { badge: 'mars', at: [-0.5, 0.04, 0.17], dir: [1, 0, 0], up: [0, 1, 0], w: 0.07, h: 0.07 },
  ],
  // The Canterbury: the old company ice hauler, name on the command module and on the engineering block.
  canterbury: [
    { text: 'CANTERBURY', at: [0.3, 0.03, -0.44], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.1, h: 0.012, wide: true },
    { text: 'CANTERBURY', at: [-0.3, 0.03, -0.44], dir: [1, 0, 0], up: [0, 1, 0], w: 0.1, h: 0.012, wide: true },
    { badge: 'company', at: [0.3, 0.01, 0.33], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.05, h: 0.05 },
    { badge: 'company', at: [-0.3, 0.01, 0.33], dir: [1, 0, 0], up: [0, 1, 0], w: 0.05, h: 0.05 },
    { text: 'PKW  CT-2310', at: [0.3, -0.045, 0.38], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.09, h: 0.012 },
    { text: 'PKW  CT-2310', at: [-0.3, -0.045, 0.38], dir: [1, 0, 0], up: [0, 1, 0], w: 0.09, h: 0.012 },
  ],
  // The Rocinante: her name on both flanks, a badge of her own, a registry on the back.
  rocinante: [
    { text: 'ROCINANTE', at: [0.6, -0.02, -0.1], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.3, h: 0.04, wide: true },
    { text: 'ROCINANTE', at: [-0.6, -0.02, -0.1], dir: [1, 0, 0], up: [0, 1, 0], w: 0.3, h: 0.04, wide: true },
    { badge: 'roci', at: [0.6, -0.02, 0.2], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.12, h: 0.12 },
    { badge: 'roci', at: [-0.6, -0.02, 0.2], dir: [1, 0, 0], up: [0, 1, 0], w: 0.12, h: 0.12 },
  ],
  // The Tachi, before she was the Rocinante: the same hull in navy marks.
  tachi: [
    { text: 'TACHI', at: [0.6, -0.02, -0.1], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.3, h: 0.04, wide: true },
    { text: 'TACHI', at: [-0.6, -0.02, -0.1], dir: [1, 0, 0], up: [0, 1, 0], w: 0.3, h: 0.04, wide: true },
    { badge: 'mars', at: [0.6, -0.02, 0.2], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.12, h: 0.12 },
    { badge: 'mars', at: [-0.6, -0.02, 0.2], dir: [1, 0, 0], up: [0, 1, 0], w: 0.12, h: 0.12 },
  ],
  // The UN flagship and its sister.
  agathaking: [
    { text: 'AGATHA KING', at: [0.6, -0.005, -0.02], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.26, h: 0.026, wide: true },
    { text: 'AGATHA KING', at: [-0.6, -0.005, -0.02], dir: [1, 0, 0], up: [0, 1, 0], w: 0.26, h: 0.026, wide: true },
    { badge: 'un', at: [0.6, -0.005, 0.14], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.06, h: 0.06 },
    { badge: 'un', at: [-0.6, -0.005, 0.14], dir: [1, 0, 0], up: [0, 1, 0], w: 0.06, h: 0.06 },
  ],
  thomasprince: [
    { text: 'THOMAS PRINCE', at: [0.6, -0.005, -0.02], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.3, h: 0.026, wide: true },
    { text: 'THOMAS PRINCE', at: [-0.6, -0.005, -0.02], dir: [1, 0, 0], up: [0, 1, 0], w: 0.3, h: 0.026, wide: true },
    { badge: 'un', at: [0.6, -0.005, 0.18], dir: [-1, 0, 0], up: [0, 1, 0], w: 0.06, h: 0.06 },
    { badge: 'un', at: [-0.6, -0.005, 0.18], dir: [1, 0, 0], up: [0, 1, 0], w: 0.06, h: 0.06 },
  ],
  // Tycho Station: name round the upper dome, a yard mark below it.
  tycho: [
    { text: 'TYCHO STATION', at: [3, 0.5, 0], dir: [-1, 0, 0], up: [0, 1, 0], w: 1.4, h: 0.15, wide: true, ink: '#2a2622' },
    { text: 'TYCHO STATION', at: [-3, 0.5, 0], dir: [1, 0, 0], up: [0, 1, 0], w: 1.4, h: 0.15, wide: true, ink: '#2a2622' },
    { badge: 'yard', at: [0, 0.62, 3], dir: [0, 0, -1], up: [0, 1, 0], w: 0.3, h: 0.3 },
  ],
};
