// Wear and clutter for the places you walk around: grime, scuffs and stains, pipes and ducts,
// railings, bins, crates, signposts and strings of lights. Our own geometry and textures, all
// drawn here by script.
//
// Hundreds of small things would be hundreds of draw calls if each were its own mesh, so
// everything is written straight into a few big meshes per room instead: one for solid things,
// one for things up near the ceiling (which cast no shadow), one for things that glow, one for
// flat stains and markings (cut from a single sheet of pictures), and one sheet of signs for
// the whole station.

import * as THREE from 'three';
import { rng } from './textures';

/** `?wear=off` in the address leaves all of this out, for before-and-after comparisons. */
export const WEAR_ON = typeof location === 'undefined' || new URLSearchParams(location.search).get('wear') !== 'off';

// ------------------------------------------------------------ the builder

/** Which picture on the sheet of stains and markings (see `sheet`). */
export const CELL = {
  drips: 0, blotch: 1, oil: 2, path: 3, scuff: 4, hatch: 5, vent: 6, hazard: 7,
  litter: 8, line: 9, chips: 10, arrow: 11, smudge: 12, posters: 13, tag: 14, rust: 15,
} as const;

interface Turn { rx?: number; ry?: number; rz?: number }
interface Put extends Turn { /** Glows: how bright (1 is the plain colour). */ glow?: number; /** Up out of reach: casts no shadow. */ high?: boolean }

class Buf {
  pos: number[] = []; nor: number[] = []; col: number[] = []; uv: number[] = [];
  mesh(mat: THREE.Material, alpha = false): THREE.Mesh | null {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, alpha ? 4 : 3));
    if (this.uv.length) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return new THREE.Mesh(g, mat);
  }
}

const BOX = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
const TUBE = new THREE.CylinderGeometry(1, 1, 1, 6).toNonIndexed();
const BALL = new THREE.IcosahedronGeometry(1, 0);
const _c = new THREE.Color(), _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _n = new THREE.Matrix3();
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _v = new THREE.Vector3();
const ID = new THREE.Matrix4();

let sheetTex: THREE.CanvasTexture | undefined;
const GRID = 4, PX = 256;

/** The sheet of stains and markings: sixteen pictures on one texture. Most are white with
 *  see-through edges and take their colour from whoever uses them. */
function sheet(): THREE.CanvasTexture {
  if (sheetTex) return sheetTex;
  const c = document.createElement('canvas');
  c.width = c.height = GRID * PX;
  const x = c.getContext('2d')!;
  const r = rng(4242);
  const S = PX;
  const cell = (i: number, draw: () => void) => {
    x.save();
    x.translate((i % GRID) * S, Math.floor(i / GRID) * S);
    x.beginPath(); x.rect(0, 0, S, S); x.clip();
    draw();
    x.restore();
  };
  const soft = (cx: number, cy: number, rad: number, a: number, col = '255,255,255') => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.6, `rgba(${col},${a * 0.5})`); g.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = g; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  };
  // 0 Drips: streaks running down from the top edge.
  cell(CELL.drips, () => {
    for (let i = 0; i < 26; i++) {
      const px = 14 + r() * (S - 28), len = 50 + r() * 190, w = 2 + r() * 9;
      const g = x.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, `rgba(255,255,255,${0.35 + r() * 0.4})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(px, 0, w, len);
    }
    const top = x.createLinearGradient(0, 0, 0, 40);
    top.addColorStop(0, 'rgba(255,255,255,0.5)'); top.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = top; x.fillRect(8, 0, S - 16, 40);
    // Fade the sides so neighbouring drips do not show a seam.
    x.globalCompositeOperation = 'destination-out';
    for (const [x0, x1] of [[0, 22], [S, S - 22]]) { const g = x.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(Math.min(x0, x1), 0, 22, S); }
    x.globalCompositeOperation = 'source-over';
  });
  // 1 A patch of floor grime.
  cell(CELL.blotch, () => { for (let i = 0; i < 22; i++) soft(64 + r() * 128, 64 + r() * 128, 22 + r() * 44, 0.2 + r() * 0.25); });
  // 2 An oil stain: a darker middle with a ragged ring.
  cell(CELL.oil, () => {
    for (let i = 0; i < 9; i++) soft(88 + r() * 80, 88 + r() * 80, 30 + r() * 40, 0.5);
    for (let i = 0; i < 40; i++) soft(128 + (r() - 0.5) * 190, 128 + (r() - 0.5) * 190, 3 + r() * 9, 0.6);
  });
  // 3 A worn path: a soft band running top to bottom.
  cell(CELL.path, () => {
    const g = x.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.3, 'rgba(255,255,255,0.55)'); g.addColorStop(0.5, 'rgba(255,255,255,0.8)'); g.addColorStop(0.7, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${r() * 0.35})`; x.fillRect(r() * S, r() * S, 2 + r() * 10, 2 + r() * 26); }
    x.globalCompositeOperation = 'source-over';
  });
  // 4 Scuffs along the foot of a wall: boot marks and trolley scrapes, thickest at the bottom.
  cell(CELL.scuff, () => {
    const g = x.createLinearGradient(0, S, 0, S * 0.25);
    g.addColorStop(0, 'rgba(255,255,255,0.6)'); g.addColorStop(0.35, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    x.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const py = S - r() * r() * S * 0.8, px = r() * S, len = 8 + r() * 46;
      x.strokeStyle = `rgba(255,255,255,${0.25 + r() * 0.5})`; x.lineWidth = 1 + r() * 3.5;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + len, py + (r() - 0.5) * 8); x.stroke();
    }
  });
  // 5 A maintenance hatch: plate, bolts, a handle and a warning stripe.
  cell(CELL.hatch, () => {
    x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(10, 10, S - 20, S - 20);
    x.fillStyle = '#8c949b'; x.fillRect(16, 16, S - 32, S - 32);
    x.fillStyle = '#a2a9af'; x.fillRect(22, 22, S - 44, S - 44);
    x.strokeStyle = 'rgba(0,0,0,0.45)'; x.lineWidth = 3; x.strokeRect(34, 34, S - 68, S - 68);
    x.fillStyle = '#3a4046';
    for (const [bx, by] of [[28, 28], [S - 28, 28], [28, S - 28], [S - 28, S - 28], [S / 2, 28], [S / 2, S - 28]]) { x.beginPath(); x.arc(bx, by, 5, 0, 7); x.fill(); }
    x.fillStyle = '#2d3238'; x.fillRect(S / 2 - 34, S / 2 + 20, 68, 12);
    for (let i = 0; i < 9; i++) { x.fillStyle = i % 2 ? '#1c1f22' : '#e0b020'; x.beginPath(); x.moveTo(44 + i * 19, 48); x.lineTo(63 + i * 19, 48); x.lineTo(53 + i * 19, 70); x.lineTo(34 + i * 19, 70); x.fill(); }
    x.fillStyle = '#2d3238'; x.font = '600 20px ui-monospace, Menlo, monospace'; x.textAlign = 'center';
    x.fillText('SERVICE ACCESS', S / 2, 104); x.font = '600 15px ui-monospace, Menlo, monospace'; x.fillText('AUTHORISED CREW ONLY', S / 2, 126);
    for (let i = 0; i < 30; i++) soft(20 + r() * (S - 40), 20 + r() * (S - 40), 6 + r() * 16, 0.12, '40,30,20');
  });
  // 6 An air vent: a frame and dark slats, with dust streaked below it.
  cell(CELL.vent, () => {
    x.fillStyle = '#6f777e'; x.fillRect(12, 40, S - 24, 150);
    x.fillStyle = '#15181b'; x.fillRect(24, 52, S - 48, 126);
    x.fillStyle = '#596168';
    for (let i = 0; i < 8; i++) x.fillRect(24, 56 + i * 15.5, S - 48, 7);
    for (let i = 0; i < 16; i++) { const px = 24 + r() * (S - 60), len = 20 + r() * 44; const g = x.createLinearGradient(0, 190, 0, 190 + len); g.addColorStop(0, 'rgba(30,24,18,0.4)'); g.addColorStop(1, 'rgba(30,24,18,0)'); x.fillStyle = g; x.fillRect(px, 190, 4 + r() * 8, len); }
  });
  // 7 Warning stripes, chipped. Repeats left to right.
  cell(CELL.hazard, () => {
    x.fillStyle = '#d9a514'; x.fillRect(0, 48, S, 160);
    x.fillStyle = '#1b1c1e';
    for (let i = -2; i < 6; i++) { x.beginPath(); x.moveTo(i * 64, 208); x.lineTo(i * 64 + 32, 208); x.lineTo(i * 64 + 112, 48); x.lineTo(i * 64 + 80, 48); x.fill(); }
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 150; i++) { x.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`; x.fillRect(r() * S, 48 + r() * 160, 2 + r() * 14, 2 + r() * 7); }
    x.fillStyle = 'rgba(0,0,0,1)'; x.fillRect(0, 0, S, 48); x.fillRect(0, 208, S, 48);
    x.globalCompositeOperation = 'source-over';
  });
  // 8 Litter: scraps of paper, wrappers, a cup or two.
  cell(CELL.litter, () => {
    const cols = ['#d8d4c8', '#c9c2ae', '#b9463a', '#3f7fa8', '#d8b23a', '#e8e6e0', '#6a8a5a'];
    for (let i = 0; i < 26; i++) {
      x.save();
      x.translate(30 + r() * (S - 60), 30 + r() * (S - 60)); x.rotate(r() * 6.28);
      x.fillStyle = cols[Math.floor(r() * cols.length)];
      const w = 6 + r() * 20, h = 4 + r() * 14;
      if (r() < 0.2) { x.beginPath(); x.arc(0, 0, 5 + r() * 4, 0, 7); x.fill(); x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.arc(0, 0, 3, 0, 7); x.fill(); }
      else { x.beginPath(); x.moveTo(-w / 2, -h / 2); x.lineTo(w / 2, -h / 2 + r() * 4); x.lineTo(w / 2 - r() * 4, h / 2); x.lineTo(-w / 2 + r() * 3, h / 2 - r() * 3); x.fill(); }
      x.restore();
    }
  });
  // 9 A painted line, worn through in places. Repeats top to bottom.
  cell(CELL.line, () => {
    x.fillStyle = '#fff'; x.fillRect(64, 0, 128, S);
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 110; i++) { x.fillStyle = `rgba(0,0,0,${0.25 + r() * 0.7})`; x.fillRect(60 + r() * 136, r() * S, 3 + r() * 22, 2 + r() * 12); }
    x.globalCompositeOperation = 'source-over';
  });
  // 10 Chipped paint: flecks down to the primer.
  cell(CELL.chips, () => {
    for (let i = 0; i < 90; i++) {
      const px = 128 + (r() - 0.5) * (r() * 220), py = 128 + (r() - 0.5) * (r() * 220);
      x.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.5})`;
      x.beginPath(); x.ellipse(px, py, 2 + r() * 9, 1.5 + r() * 6, r() * 3, 0, 7); x.fill();
    }
  });
  // 11 A chevron painted on the floor, pointing up the picture, worn.
  cell(CELL.arrow, () => {
    x.fillStyle = '#fff';
    x.beginPath(); x.moveTo(128, 30); x.lineTo(226, 150); x.lineTo(180, 150); x.lineTo(128, 88); x.lineTo(76, 150); x.lineTo(30, 150); x.fill();
    x.beginPath(); x.moveTo(128, 112); x.lineTo(226, 232); x.lineTo(180, 232); x.lineTo(128, 170); x.lineTo(76, 232); x.lineTo(30, 232); x.fill();
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.7})`; x.fillRect(r() * S, r() * S, 2 + r() * 16, 2 + r() * 8); }
    x.globalCompositeOperation = 'source-over';
  });
  // 12 A smudge where hands and shoulders touch a door frame.
  cell(CELL.smudge, () => {
    for (let i = 0; i < 16; i++) { x.save(); x.translate(128, 128); x.scale(0.55, 1); soft((r() - 0.5) * 60, (r() - 0.5) * 150, 30 + r() * 50, 0.22); x.restore(); }
  });
  // 13 Notices pasted on a wall, some torn.
  cell(CELL.posters, () => {
    const cols = ['#d9d2bd', '#c7533f', '#3f7fa8', '#d6b23e', '#e4e0d6', '#5f8f6a'];
    for (const [px, py, w, h, a] of [[18, 22, 96, 132, -0.04], [124, 14, 110, 84, 0.05], [130, 108, 84, 120, -0.02], [30, 164, 84, 70, 0.07]]) {
      x.save(); x.translate(px + w / 2, py + h / 2); x.rotate(a);
      x.fillStyle = cols[Math.floor(r() * cols.length)]; x.fillRect(-w / 2, -h / 2, w, h);
      x.fillStyle = 'rgba(20,20,24,0.75)'; x.fillRect(-w / 2 + 8, -h / 2 + 8, w - 16, 14);
      for (let j = 0; j < (h - 40) / 9; j++) { x.fillStyle = 'rgba(20,20,24,0.45)'; x.fillRect(-w / 2 + 8, -h / 2 + 32 + j * 9, (w - 16) * (0.5 + r() * 0.5), 3); }
      x.globalCompositeOperation = 'destination-out';
      if (r() < 0.6) { x.beginPath(); x.moveTo(w / 2, h / 2); x.lineTo(w / 2 - 20 - r() * 30, h / 2); x.lineTo(w / 2, h / 2 - 20 - r() * 40); x.fill(); }
      x.globalCompositeOperation = 'source-over';
      x.restore();
    }
  });
  // 14 A sprayed tag.
  cell(CELL.tag, () => {
    x.strokeStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round'; x.shadowColor = '#fff'; x.shadowBlur = 5;
    x.lineWidth = 11;
    x.beginPath(); x.arc(128, 104, 62, 0.5, 5.9); x.stroke();
    x.beginPath(); x.moveTo(96, 140); x.lineTo(128, 60); x.lineTo(160, 140); x.moveTo(108, 112); x.lineTo(150, 112); x.stroke();
    x.lineWidth = 6;
    x.beginPath(); x.moveTo(30, 206); x.bezierCurveTo(80, 180, 110, 236, 150, 204); x.bezierCurveTo(180, 184, 200, 226, 232, 198); x.stroke();
    x.shadowBlur = 0;
    for (let i = 0; i < 9; i++) { const px = 70 + r() * 120; x.fillStyle = 'rgba(255,255,255,0.7)'; x.fillRect(px, 150 + r() * 20, 3, 14 + r() * 40); }
  });
  // 15 A rust-brown water stain running down.
  cell(CELL.rust, () => {
    for (let i = 0; i < 14; i++) {
      const px = 60 + r() * 136, len = 90 + r() * 160, w = 5 + r() * 18;
      const g = x.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, `rgba(${120 + r() * 50},${60 + r() * 30},24,${0.4 + r() * 0.35})`); g.addColorStop(1, 'rgba(120,60,24,0)');
      x.fillStyle = g; x.fillRect(px, 0, w, len);
    }
    soft(128, 6, 80, 0.5, '90,50,24');
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return (sheetTex = t);
}

interface Set4 { solid: Buf; high: Buf; glow: Buf; decal: Buf }

/** Collects boxes, tubes and flat markings and turns them into a few meshes per room. */
export class Dress {
  private sets = new Map<string, Set4>();
  private now: Set4 = this.group('all');
  /** How many separate things have been added (for the record). */
  count = 0;

  /** Things added from here on belong to this room (so rooms out of sight are not drawn). */
  group(key: string): Set4 {
    let s = this.sets.get(key);
    if (!s) this.sets.set(key, (s = { solid: new Buf(), high: new Buf(), glow: new Buf(), decal: new Buf() }));
    return (this.now = s);
  }

  private push(src: THREE.BufferGeometry, M: THREE.Matrix4, sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number, o: Put) {
    _e.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, 'YXZ');
    _l.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
    _m.multiplyMatrices(M, _l);
    _n.getNormalMatrix(_m);
    const b = o.glow ? this.now.glow : o.high ? this.now.high : this.now.solid;
    _c.set(color).multiplyScalar(o.glow ?? 1);
    const P = src.getAttribute('position'), N = src.getAttribute('normal');
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m);
      b.pos.push(_v.x, _v.y, _v.z);
      _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize();
      b.nor.push(_v.x, _v.y, _v.z);
      b.col.push(_c.r, _c.g, _c.b);
    }
    this.count++;
  }

  /** A box (w, h, d) centred at (x, y, z) in the frame `M`. */
  box(M: THREE.Matrix4, w: number, h: number, d: number, x: number, y: number, z: number, color: number, o: Put = {}) {
    this.push(BOX, M, w, h, d, x, y, z, color, o);
  }

  /** A round bar of radius `r` and length `len`, centred at (x, y, z), lying along `axis`. */
  tube(M: THREE.Matrix4, r: number, len: number, x: number, y: number, z: number, axis: 'x' | 'y' | 'z', color: number, o: Put = {}) {
    this.push(TUBE, M, r, len, r, x, y, z, color, axis === 'x' ? { ...o, rz: Math.PI / 2 } : axis === 'z' ? { ...o, rx: Math.PI / 2 } : o);
  }

  /** A bar from one point to another (for struts, hoses and hanging wires). */
  bar(M: THREE.Matrix4, r: number, a: [number, number, number], b: [number, number, number], color: number, o: Put = {}) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    // Turn the bar's own up (y) to point along the line.
    const ry = Math.atan2(dx, dz), rx = Math.acos(Math.max(-1, Math.min(1, dy / len)));
    this.push(TUBE, M, r, len, r, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, color, { ...o, rx, ry });
  }

  /** A rough ball (sacks, lanterns, bulbs). */
  ball(M: THREE.Matrix4, rx: number, ry: number, rz: number, x: number, y: number, z: number, color: number, o: Put = {}) {
    this.push(BALL, M, rx, ry, rz, x, y, z, color, o);
  }

  /**
   * A flat marking from the sheet, `w` by `h`, centred at (x, y, z). As given it stands upright
   * facing +z of the frame; `flat` lays it on the floor instead (its top towards -z, then turned
   * by `ry`). Big ones are cut into pieces about 3 m across so bounce light has corners to land on.
   */
  decal(M: THREE.Matrix4, w: number, h: number, x: number, y: number, z: number, cell: number, color: number, alpha = 1, o: Turn & { flat?: boolean; /** Repeat the picture this many times across / up. */ ru?: number; rv?: number } = {}) {
    _e.set((o.flat ? -Math.PI / 2 : 0) + (o.rx ?? 0), o.ry ?? 0, o.rz ?? 0, 'YXZ');
    _l.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(1, 1, 1));
    _m.multiplyMatrices(M, _l);
    _n.getNormalMatrix(_m);
    _v.set(0, 0, 1).applyMatrix3(_n).normalize();
    const nx = _v.x, ny = _v.y, nz = _v.z;
    _c.set(color);
    const b = this.now.decal, pad = 3 / (GRID * PX);
    const u0 = (cell % GRID) / GRID + pad, u1 = (cell % GRID + 1) / GRID - pad;
    const v1 = 1 - Math.floor(cell / GRID) / GRID - pad, v0 = 1 - (Math.floor(cell / GRID) + 1) / GRID + pad;
    const ru = o.ru ?? 1, rv = o.rv ?? 1;
    // Pieces: at least one per repeat of the picture, and none wider than about 3 m.
    const cut = (len: number, rep: number) => rep * Math.max(1, Math.ceil(len / rep / 3));
    const cu = cut(w, ru), cv = cut(h, rv);
    const corner = (i: number, j: number) => {
      _v.set(-w / 2 + (w * i) / cu, -h / 2 + (h * j) / cv, 0).applyMatrix4(_m);
      b.pos.push(_v.x, _v.y, _v.z);
      b.nor.push(nx, ny, nz);
      b.col.push(_c.r, _c.g, _c.b, alpha);
    };
    const frac = (t: number) => { const f = t - Math.floor(t); return f; };
    for (let i = 0; i < cu; i++) for (let j = 0; j < cv; j++) {
      // Where this piece sits within one repeat of the picture.
      const a0 = frac((i * ru) / cu), a1 = a0 + ru / cu, b0 = frac((j * rv) / cv), b1 = b0 + rv / cv;
      const U = (t: number) => u0 + (u1 - u0) * t, V = (t: number) => v0 + (v1 - v0) * t;
      for (const [ci, cj, tu, tv] of [[0, 0, a0, b0], [1, 0, a1, b0], [1, 1, a1, b1], [0, 0, a0, b0], [1, 1, a1, b1], [0, 1, a0, b1]] as const) {
        corner(i + ci, j + cj);
        b.uv.push(U(tu), V(tv));
      }
    }
    this.count++;
  }

  /** The finished meshes. Those in `skip` are stains and glows the light probes should not count as surfaces. */
  build(): { meshes: THREE.Mesh[]; skip: THREE.Mesh[] } {
    const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.2 });
    const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const decalMat = new THREE.MeshStandardMaterial({ map: sheet(), vertexColors: true, transparent: true, depthWrite: false, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const meshes: THREE.Mesh[] = [], skip: THREE.Mesh[] = [];
    for (const [key, s] of this.sets) {
      const solid = s.solid.mesh(solidMat), high = s.high.mesh(solidMat), glow = s.glow.mesh(glowMat), decal = s.decal.mesh(decalMat, true);
      if (solid) { solid.name = `wear:${key}`; meshes.push(solid); }
      if (high) { high.name = `wear-high:${key}`; high.userData.noShadow = true; meshes.push(high); }
      if (glow) { glow.name = `wear-glow:${key}`; meshes.push(glow); }
      if (decal) { decal.name = `wear-marks:${key}`; decal.renderOrder = 2; meshes.push(decal); skip.push(decal); }
    }
    return { meshes, skip };
  }
}

// ------------------------------------------------------------------ signs

/** Every wayfinding sign in a station, lettered on one or two shared textures and drawn together. */
export class Signs {
  private sheets: { c: HTMLCanvasElement; x: CanvasRenderingContext2D; buf: Buf; px: number; py: number; row: number }[] = [];
  private static SIZE = 2048;

  private room(pw: number, ph: number) {
    let s = this.sheets[this.sheets.length - 1];
    const S = Signs.SIZE;
    if (s && s.px + pw > S) { s.px = 0; s.py += s.row + 4; s.row = 0; }
    if (!s || s.py + ph > S) {
      const c = document.createElement('canvas');
      c.width = c.height = S;
      this.sheets.push((s = { c, x: c.getContext('2d')!, buf: new Buf(), px: 0, py: 0, row: 0 }));
    }
    const at = { s, x: s.px, y: s.py };
    s.px += pw + 4; s.row = Math.max(s.row, ph);
    return at;
  }

  /**
   * A sign `w` by `h` metres, centred at the frame `M` and facing its +z. `lines` are lettered
   * in the same face as the rest of the station's signs; `back` letters the other side too.
   */
  add(M: THREE.Matrix4, w: number, h: number, lines: string[], color = '#ffd9a0', bg = 'rgba(10,12,16,0.85)', o: { back?: string[]; align?: CanvasTextAlign; y?: number } = {}) {
    const pw = Math.min(1024, Math.max(128, Math.round((w >= 5 ? 110 : w >= 1.5 ? 170 : 260) * w / 32) * 32)), ph = Math.max(24, Math.round((pw * h) / w));
    const face = (text: string[], flip: boolean) => {
      const { s, x: px, y: py } = this.room(pw, ph), x = s.x;
      x.save();
      x.beginPath(); x.rect(px, py, pw, ph); x.clip();
      x.fillStyle = bg; x.fillRect(px, py, pw, ph);
      let size = (ph / text.length) * 0.62;
      const font = (p: number) => `600 ${p}px ui-monospace, Menlo, monospace`;
      x.font = font(size);
      const widest = Math.max(...text.map((l) => x.measureText(l).width));
      if (widest > pw * 0.92) size *= (pw * 0.92) / widest;
      x.font = font(size);
      x.fillStyle = color; x.textAlign = o.align ?? 'center'; x.textBaseline = 'middle';
      text.forEach((l, i) => x.fillText(l, o.align === 'left' ? px + pw * 0.04 : px + pw / 2, py + ((i + 0.5) * ph) / text.length));
      x.restore();
      const S = Signs.SIZE, u0 = px / S, u1 = (px + pw) / S, v1 = 1 - py / S, v0 = 1 - (py + ph) / S;
      _n.getNormalMatrix(M);
      const sg = flip ? -1 : 1;
      _v.set(0, 0, sg).applyMatrix3(_n).normalize();
      const nx = _v.x, ny = _v.y, nz = _v.z;
      for (const [cx, cy] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) {
        _v.set((cx - 0.5) * w * sg, (cy - 0.5) * h + (o.y ?? 0), flip ? -0.012 : 0.012).applyMatrix4(M);
        s.buf.pos.push(_v.x, _v.y, _v.z);
        s.buf.nor.push(nx, ny, nz);
        s.buf.col.push(1, 1, 1);
        s.buf.uv.push(cx ? u1 : u0, cy ? v1 : v0);
      }
    };
    face(lines, false);
    if (o.back) face(o.back, true);
  }

  build(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const s of this.sheets) {
      const t = new THREE.CanvasTexture(s.c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      const m = s.buf.mesh(new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.02 }));
      if (m) { m.name = 'wear-signs'; m.renderOrder = 3; out.push(m); }
    }
    return out;
  }
}

// ------------------------------------------------------------ what a place offers

/** What the dressing needs from the place it is dressing (the Kit in interior.ts). */
export interface Site {
  /** A frame at a spot on the floor: +y up, turned by `yaw`. In a drum it follows the hull. */
  frame(x: number, y: number, z: number, yaw?: number): THREE.Matrix4;
  /** Open floor with `r` of elbow room, away from people, the lines walkers pace, doors, counters and reading posts. */
  clear(x: number, z: number, r: number): boolean;
  /** A straight line of open floor that nobody is standing on or pacing along. */
  lineClear(x0: number, z0: number, x1: number, z1: number): boolean;
  free(x: number, z: number): boolean;
  /** Make a patch of floor solid. */
  block(x: number, z: number, w: number, d: number): void;
  /** The dice for wear: its own, so nothing here moves the furniture or the people. */
  w: () => number;
}

const STEEL = 0x596168, DARK = 0x2d3238;

/** How many of each solid thing found room, and how many were left out because someone or
 *  something was in the way (shown as __wear with ?debug, for tests). */
export const TALLY: Record<string, [placed: number, left: number]> = {};
export function tally(kind: string, ok: boolean): boolean {
  const t = (TALLY[kind] ??= [0, 0]);
  t[ok ? 0 : 1]++;
  return ok;
}

/** The nearest clear spot to (x, z) within about `reach` metres, or nothing. */
export function seek(k: Site, x: number, z: number, r: number, reach = 1.8): [number, number] | null {
  if (k.clear(x, z, r)) return [x, z];
  for (let i = 1; i <= 18; i++) {
    const a = i * 2.4, d = (reach * i) / 18, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (k.clear(px, pz, r)) return [px, pz];
  }
  return null;
}

/** A railing between two points: posts, a handrail and a knee rail. Solid if it runs square to the walls. */
export function rail(k: Site, d: Dress, x0: number, z0: number, x1: number, z1: number, o: { h?: number; color?: number; solid?: boolean; y?: number; high?: boolean; kick?: number } = {}): boolean {
  const len = Math.hypot(x1 - x0, z1 - z0), h = o.h ?? 1.05, col = o.color ?? STEEL, y = o.y ?? 0, solid = o.solid ?? y === 0;
  if (solid && !tally('rail', k.lineClear(x0, z0, x1, z1))) return false;
  const yaw = Math.atan2(-(z1 - z0), x1 - x0), n = Math.max(1, Math.ceil(len / 3.6)), put = { high: o.high };
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, L = len / n, M = k.frame(x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t, yaw);
    d.tube(M, 0.035, L, 0, h, 0, 'x', col, put);
    d.tube(M, 0.022, L, 0, h * 0.52, 0, 'x', col, put);
    if (o.kick) d.box(M, L, o.kick, 0.03, 0, o.kick / 2 + 0.02, 0, col, put);
    for (const px of i === 0 ? [-L / 2, 0, L / 2] : [0, L / 2]) d.tube(M, 0.03, h, px, h / 2, 0, 'y', col, put);
  }
  if (solid) k.block((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) + 0.1, Math.abs(z1 - z0) + 0.1);
  return true;
}

/**
 * A catwalk along a wall, high up: grating, brackets back to the wall, a railing on the open
 * edge and a ladder down at one end. Nobody can climb it (the floor you walk on is flat), so
 * it is scenery: somewhere for the eye to go, and a reason for the pipes.
 */
export function catwalk(k: Site, d: Dress, x: number, z0: number, z1: number, y: number, side: 1 | -1, o: { ladder?: number; color?: number } = {}) {
  const col = o.color ?? STEEL, wide = 1.5, n = Math.ceil((z1 - z0) / 3);
  for (let i = 0; i < n; i++) {
    const L = (z1 - z0) / n, M = k.frame(x + side * wide / 2, 0, z0 + (i + 0.5) * L);
    d.box(M, wide, 0.07, L, 0, y, 0, 0x3d444b, { high: true });
    d.box(M, 0.06, 0.16, L, side * wide / 2, y - 0.08, 0, col, { high: true });
    // A bracket under each bay, from the outer edge down to the wall.
    d.bar(M, 0.035, [side * wide / 2, y - 0.1, 0], [-side * wide / 2, y - 1.3, 0], col, { high: true });
    d.box(M, 0.08, 1.5, 0.12, -side * wide / 2 + side * 0.04, y - 0.7, 0, col, { high: true });
  }
  rail(k, d, x + side * wide, z0, x + side * wide, z1, { y, high: true, color: col, kick: 0.12 });
  if (o.ladder !== undefined) {
    const M = k.frame(x + side * (wide + 0.12), 0, o.ladder);
    for (const s of [-0.22, 0.22]) d.tube(M, 0.025, y + 1.1, 0, (y + 1.1) / 2, s, 'y', col);
    for (let ry = 0.3; ry < y + 0.9; ry += 0.3) d.tube(M, 0.016, 0.44, 0, ry, 0, 'z', col);
    // Safety hoops round the upper half.
    for (let ry = 2.6; ry < y + 0.9; ry += 0.9) for (const [a, b] of [[[0, ry, -0.24], [side * 0.5, ry, -0.2]], [[side * 0.5, ry, -0.2], [side * 0.5, ry, 0.2]], [[side * 0.5, ry, 0.2], [0, ry, 0.24]]] as [number, number, number][][]) d.bar(M, 0.014, a, b, 0xd9a514);
  }
}

/** A bin with a little spilled round it. Solid. Returns false if there was no room. */
export function bin(k: Site, d: Dress, x: number, z: number, color = 0x4a5258, litter = 0.6): boolean {
  const at = seek(k, x, z, 0.6);
  if (!tally('bin', !!at) || !at) return false;
  [x, z] = at;
  const M = k.frame(x, 0, z, k.w() * 6);
  d.tube(M, 0.27, 0.82, 0, 0.41, 0, 'y', color);
  d.tube(M, 0.29, 0.06, 0, 0.84, 0, 'y', DARK);
  d.box(M, 0.3, 0.02, 0.1, 0, 0.88, 0, 0x0c0d0e);
  if (litter > 0) d.decal(M, 1.5, 1.5, 0.2, 0.025, 0.3, CELL.litter, 0xffffff, litter, { flat: true });
  d.decal(M, 1.3, 1.3, 0, 0.02, 0, CELL.blotch, 0x1a1410, 0.5, { flat: true });
  k.block(x, z, 0.5, 0.5);
  return true;
}

/** A small stack of crates or sacks. Solid. */
export function stack(k: Site, d: Dress, x: number, z: number, o: { n?: number; cols?: number[]; sacks?: boolean; need?: number } = {}): boolean {
  const at = seek(k, x, z, o.need ?? 1.1, 1.4);
  if (!tally('stack', !!at) || !at) return false;
  [x, z] = at;
  const cols = o.cols ?? [0x8a5a3a, 0x4a6a7a, 0x7a7468, 0xb08a2e, 0x55634a], w = k.w;
  const M = k.frame(x, 0, z, (w() - 0.5) * 0.6);
  const n = o.n ?? 3;
  for (let i = 0; i < n; i++) {
    const s = 0.5 + w() * 0.25, lx = (i % 2 ? 0.34 : -0.34) + (w() - 0.5) * 0.1, lz = (i < 2 ? -0.3 : 0.32) + (w() - 0.5) * 0.1, col = cols[Math.floor(w() * cols.length)];
    if (o.sacks) { d.ball(M, s * 0.6, s * 0.36, s * 0.45, lx, s * 0.3, lz, col, { ry: w() * 3 }); if (w() < 0.6) d.ball(M, s * 0.55, s * 0.32, s * 0.42, lx * 0.6, s * 0.85, lz * 0.7, cols[Math.floor(w() * cols.length)], { ry: w() * 3 }); }
    else {
      d.box(M, s * 1.15, s, s, lx, s / 2, lz, col, { ry: (w() - 0.5) * 0.3 });
      // A band and a label, so they read as cargo and not as blocks.
      d.box(M, s * 1.17, s * 0.08, s * 1.02, lx, s * 0.75, lz, DARK);
      if (w() < 0.5) d.box(M, s * 0.9, s * 0.7, s * 0.8, lx + (w() - 0.5) * 0.1, s + s * 0.35, lz, cols[Math.floor(w() * cols.length)], { ry: (w() - 0.5) * 0.5 });
    }
  }
  k.block(x, z, 1.5, 1.4);
  return true;
}

/** A row of drums against something. Solid. */
export function drums(k: Site, d: Dress, x: number, z: number, n = 3, along: 'x' | 'z' = 'x', cols = [0x3f6f8a, 0x9a4a32, 0x6a7078, 0xc8a02e]): boolean {
  const L = n * 0.7;
  if (!k.clear(x, z, 0.6) || !k.clear(x + (along === 'x' ? L / 2 : 0), z + (along === 'z' ? L / 2 : 0), 0.5) || !k.clear(x - (along === 'x' ? L / 2 : 0), z - (along === 'z' ? L / 2 : 0), 0.5)) return tally('drums', false);
  tally('drums', true);
  const M = k.frame(x, 0, z, along === 'x' ? 0 : Math.PI / 2);
  for (let i = 0; i < n; i++) {
    const lx = (i - (n - 1) / 2) * 0.7, col = cols[Math.floor(k.w() * cols.length)];
    d.tube(M, 0.3, 0.95, lx, 0.475, 0, 'y', col);
    for (const y of [0.3, 0.65]) d.tube(M, 0.315, 0.04, lx, y, 0, 'y', DARK);
    d.tube(M, 0.28, 0.02, lx, 0.96, 0, 'y', 0x1c1f22);
  }
  d.decal(M, L + 1.2, 1.8, 0, 0.022, 0.1, CELL.oil, 0x0c0a08, 0.55, { flat: true });
  k.block(x, z, along === 'x' ? L : 0.6, along === 'x' ? 0.6 : L);
  return true;
}

export type Arm = [text: string, way: 'l' | 'r', color?: string];
/**
 * A signpost with finger boards. It is read from the side it `faces` (a yaw: the boards face
 * that way); 'l' and 'r' are the reader's left and right, and the board is lettered on the
 * back for people coming the other way, with its arrow turned to match.
 */
export function post(k: Site, d: Dress, s: Signs, x: number, z: number, faces: number, arms: Arm[], o: { h?: number; lamp?: number; solid?: boolean; w?: number } = {}): boolean {
  if (o.solid !== false && !tally('post', k.clear(x, z, 0.6))) return false;
  const h = o.h ?? 3, M = k.frame(x, 0, z, faces), bw = o.w ?? 1.7;
  d.tube(M, 0.055, h, 0, h / 2, 0, 'y', DARK);
  d.tube(M, 0.14, 0.08, 0, 0.04, 0, 'y', DARK);
  arms.forEach(([text, way, color], i) => {
    const y = h - 0.3 - i * 0.34, off = (way === 'r' ? 1 : -1) * (bw / 2 + 0.05);
    // The reader looks back along the frame's +z, so their right is its +x.
    const B = k.frame(x, y, z, faces).multiply(new THREE.Matrix4().makeTranslation(off, 0, 0));
    d.box(B, bw, 0.28, 0.03, 0, 0, 0, 0x14181c);
    s.add(B, bw - 0.06, 0.24, [way === 'r' ? `${text} →` : `← ${text}`], color ?? '#ffd9a0', 'rgba(10,12,16,0.9)', { back: [way === 'r' ? `← ${text}` : `${text} →`] });
  });
  if (o.lamp) { d.ball(M, 0.13, 0.16, 0.13, 0, h + 0.14, 0, o.lamp, { glow: 1.6 }); d.tube(M, 0.16, 0.03, 0, h + 0.01, 0, 'y', DARK); }
  if (o.solid !== false) k.block(x, z, 0.2, 0.2);
  return true;
}

/** A sign hung from the ceiling on two rods, lettered on both sides. `faces` is the yaw its front faces. */
export function hang(k: Site, d: Dress, s: Signs, x: number, y: number, z: number, faces: number, w: number, h: number, front: string[], back: string[] | undefined, ceil: number, color = '#ffd9a0') {
  const M = k.frame(x, y, z, faces);
  d.box(M, w + 0.1, h + 0.1, 0.05, 0, 0, 0, 0x14181c, { high: true });
  for (const sx of [-w / 2 + 0.2, w / 2 - 0.2]) d.tube(M, 0.014, Math.max(0.05, ceil - y - h / 2), sx, (ceil - y + h / 2) / 2, 0, 'y', DARK, { high: true });
  const F = M.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.026));
  s.add(F, w, h, front, color, 'rgba(10,12,16,0.92)');
  if (back) s.add(k.frame(x, y, z, faces + Math.PI).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.026)), w, h, back, color, 'rgba(10,12,16,0.92)');
}

/** A string of small coloured bulbs sagging between two points (x, y, z each, in floor terms). */
export function lights(k: Site, d: Dress, a: [number, number, number], b: [number, number, number], cols: number[], o: { sag?: number; every?: number; glow?: number; size?: number } = {}) {
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(3, Math.round(len / (o.every ?? 0.9))), sag = o.sag ?? len * 0.07, size = o.size ?? 0.06;
  let prev: [number, number, number] | null = null, pm: THREE.Matrix4 | null = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t);
    const M = k.frame(x, y, z);
    if (i > 0 && i < n) d.ball(M, size, size * 1.3, size, 0, -size * 1.2, 0, cols[i % cols.length], { glow: o.glow ?? 1.5, high: true });
    // The wire, as short straight pieces. Each is drawn in the frame of its own start, so in a
    // drum it follows the curve of the hull.
    if (prev && pm) {
      const inv = pm.clone().invert(), end = new THREE.Vector3().setFromMatrixPosition(M).applyMatrix4(inv);
      d.bar(pm, 0.008, [0, 0, 0], [end.x, end.y, end.z], 0x15171a, { high: true });
    }
    prev = [x, y, z]; pm = M;
  }
}

/** A lamp post with a warm lantern (it glows; it is not a real light). */
export function lampPost(k: Site, d: Dress, x: number, z: number, h: number, color: number, o: { arm?: number; yaw?: number; solid?: boolean; glow?: number } = {}): boolean {
  if (o.solid !== false && !k.clear(x, z, 0.5)) return false;
  const M = k.frame(x, 0, z, o.yaw ?? 0), arm = o.arm ?? 0;
  d.tube(M, 0.06, h, 0, h / 2, 0, 'y', DARK);
  d.tube(M, 0.13, 0.25, 0, 0.125, 0, 'y', DARK);
  if (arm) d.tube(M, 0.035, arm, arm / 2, h - 0.05, 0, 'x', DARK);
  d.box(M, 0.3, 0.05, 0.3, arm, h - 0.02, 0, DARK);
  d.ball(M, 0.16, 0.2, 0.16, arm, h - 0.24, 0, color, { glow: o.glow ?? 1.5 });
  if (o.solid !== false) k.block(x, z, 0.2, 0.2);
  return true;
}

/** A hose or cable lying on the floor through the given points. */
export function hose(k: Site, d: Dress, pts: [number, number][], color = 0x1c1f22, r = 0.045) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z))), n = Math.max(4, Math.round(curve.getLength() / 0.6));
  const ps = curve.getPoints(n);
  for (let i = 0; i < n; i++) {
    const a = ps[i], b = ps[i + 1], M = k.frame(a.x, 0, a.z);
    const inv = M.clone().invert(), e = new THREE.Vector3().setFromMatrixPosition(k.frame(b.x, 0, b.z)).applyMatrix4(inv);
    d.bar(M, r, [0, r, 0], [e.x, e.y + r, e.z], color);
  }
}

/** A strip of marking along the floor from one point to another (a painted line, a worn path, warning stripes). */
export function strip(k: Site, d: Dress, x0: number, z0: number, x1: number, z1: number, wide: number, cell: number, color: number, alpha: number, o: { y?: number; per?: number } = {}) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(len / 3)), L = len / n;
  // Turn the picture's "up" (the floor decal's -z) to run along the line.
  const yaw = Math.atan2(-(x1 - x0), -(z1 - z0));
  const across = cell === CELL.hazard;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, M = k.frame(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, yaw);
    // Warning stripes repeat across the picture, so they are laid sideways along the line.
    if (across) d.decal(M, L, wide * 1.6, 0, o.y ?? 0.022, 0, cell, color, alpha, { flat: true, ry: Math.PI / 2, ru: Math.max(1, Math.round(L / (o.per ?? wide * 1.6))) });
    else d.decal(M, wide, L, 0, o.y ?? 0.022, 0, cell, color, alpha, { flat: true, rv: Math.max(1, Math.round(L / (o.per ?? wide * 2))) });
  }
}

/** A market stand under a striped awning, with produce, a lantern and a sign. Solid counter. */
export function stand(k: Site, d: Dress, s: Signs, x: number, z: number, yaw: number, name: string, c1: number, c2: number, o: { lamp?: number } = {}): boolean {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  if (!tally('stand', k.clear(x, z, 1.5) && k.free(x + fx * 1.6, z + fz * 1.6))) return false;
  const M = k.frame(x, 0, z, yaw);
  d.box(M, 2.6, 0.9, 0.8, 0, 0.45, 0, 0x6a5a48);
  d.box(M, 2.7, 0.05, 0.9, 0, 0.92, 0, 0x8a7a64);
  for (const px of [-1.3, 1.3]) for (const pz of [-0.9, 0.55]) d.tube(M, 0.035, 2.5, px, 1.25, pz, 'y', 0x4a4038);
  // The awning: stripes of two colours, sloping to the front.
  for (let i = 0; i < 8; i++) d.box(M, 0.36, 0.03, 1.9, -1.26 + i * 0.36, 2.52, -0.1, i % 2 ? c1 : c2, { rx: 0.12 });
  for (let i = 0; i < 8; i++) d.box(M, 0.36, 0.2, 0.02, -1.26 + i * 0.36, 2.3, 0.84, i % 2 ? c1 : c2);
  // Produce in trays on the counter and crates beside it.
  const veg = [0xc0392b, 0xe08a2e, 0x7aa83a, 0xd8c23a, 0x8a4a7a, 0x4a8a3a];
  for (let i = 0; i < 4; i++) {
    const px = -0.95 + i * 0.63;
    d.box(M, 0.55, 0.1, 0.6, px, 1.0, 0, 0x4a4038);
    for (let j = 0; j < 5; j++) d.ball(M, 0.09, 0.08, 0.09, px + (k.w() - 0.5) * 0.36, 1.1, (k.w() - 0.5) * 0.4, veg[(i + Math.floor(k.w() * 2)) % veg.length]);
  }
  d.box(M, 0.6, 0.4, 0.5, 1.75, 0.2, 0.1, 0x7a6248);
  d.box(M, 0.55, 0.35, 0.45, 1.72, 0.58, 0.12, 0x6a5440, { ry: 0.2 });
  s.add(k.frame(x, 2.05, z, yaw).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.87)), 2.3, 0.3, [name], '#ffe9b8', 'rgba(30,22,14,0.9)');
  const lamp = o.lamp ?? 0xffd9a0;
  for (const px of [-0.9, 0, 0.9]) { d.ball(M, 0.07, 0.1, 0.07, px, 2.12, 0.6, lamp, { glow: 1.5 }); d.tube(M, 0.006, 0.3, px, 2.35, 0.6, 'y', DARK); }
  d.decal(M, 3.4, 2.6, 0, 0.022, 0.9, CELL.path, 0x2a2018, 0.3, { flat: true, ry: Math.PI / 2 });
  k.block(x, z, Math.abs(fx) > 0.7 ? 0.9 : 2.7, Math.abs(fx) > 0.7 ? 2.7 : 0.9);
  return true;
}

// ----------------------------------------------------- the pass over rooms

type Side = 'n' | 's' | 'e' | 'w';
/** As much of a room as the wear pass needs to know (the Kit's rooms fit this). */
export interface WRoom {
  name: string; x0: number; z0: number; x1: number; z1: number; h: number;
  o: { open?: boolean; calm?: boolean; wall: string; floor: string };
  openings: { side: Side; a: number; b: number; y0: number; y1: number; glass: boolean }[];
}
/** How worn a station is, and in what colours. */
export interface Style {
  /** 0 spotless … 1 filthy. */
  grime: number;
  /** The colour of its dirt. */
  dirt: number;
  /** Paths worn into the floor: their colour (lighter than a dark floor, darker than a pale one) and strength. */
  worn: number; wornA: number;
  /** How often water has run down the walls (0 … 1). */
  drips: number;
  /** Litter along the walls and notices pasted up (0 … 1). */
  litter: number; posters: number;
  /** Colours of pipes and ducts. */
  pipes: number[]; duct: number;
  /** Rooms (by name) with their own grime level. */
  rooms?: Record<string, number>;
}
/** A sign already on a wall: where, and how big. Wall fittings keep clear of these. */
export interface Taken { x: number; y: number; z: number; w: number; h: number }

/**
 * The wear every room gets: grime and scuffs along the foot of the walls, worn floor through
 * the doors and down the corridors, stains, hatches and vents, pipes and ducts overhead.
 * Flat-floored places only.
 */
export function wearRooms(k: Site, d: Dress, rooms: WRoom[], st: Style, taken: Taken[]) {
  const w = k.w;
  for (const room of rooms) {
    const { x0, z0, x1, z1, h } = room;
    d.group(room.name);
    if (room.o.open) continue;
    const g = st.rooms?.[room.name] ?? st.grime * (room.o.calm ? 0.4 : 1);
    const wide = x1 - x0, deep = z1 - z0, area = wide * deep, corridor = Math.min(wide, deep) <= 6.5;
    // A frame on a wall: x runs along it, y up, z out into the room.
    const onWall = (side: Side, along: number, y: number) =>
      side === 'n' ? k.frame(along, y, z0, 0) : side === 's' ? k.frame(along, y, z1, Math.PI) : side === 'w' ? k.frame(x0, y, along, Math.PI / 2) : k.frame(x1, y, along, -Math.PI / 2);
    const inFront = (side: Side, along: number, out: number): [number, number] =>
      side === 'n' ? [along, z0 + out] : side === 's' ? [along, z1 - out] : side === 'w' ? [x0 + out, along] : [x1 - out, along];
    // Whether a stretch of wall is already spoken for: a door, a window, or a sign.
    const busy = (side: Side, a: number, b: number, ya: number, yb: number) => {
      for (const q of room.openings) if (q.side === side && q.a < b + 0.3 && q.b > a - 0.3 && q.y0 < yb && q.y1 > ya) return true;
      for (const t of taken) {
        const [dist, along] = side === 'n' ? [t.z - z0, t.x] : side === 's' ? [z1 - t.z, t.x] : side === 'w' ? [t.x - x0, t.z] : [x1 - t.x, t.z];
        if (dist > -0.3 && dist < 0.6 && along - t.w / 2 < b + 0.25 && along + t.w / 2 > a - 0.25 && t.y - t.h / 2 < yb + 0.1 && t.y + t.h / 2 > ya - 0.1) return true;
      }
      return false;
    };

    // Stains on the floor.
    for (let i = 0, n = Math.round((area / 34) * (0.3 + g)); i < n; i++) {
      const s = 1.4 + w() * 3, x = x0 + 1 + w() * (wide - 2), z = z0 + 1 + w() * (deep - 2);
      d.decal(ID, s, s * (0.6 + w() * 0.6), x, 0.021, z, w() < 0.25 ? CELL.oil : CELL.blotch, st.dirt, (0.25 + w() * 0.35) * (0.4 + g * 0.6), { flat: true, ry: w() * 6.28 });
    }

    for (const side of ['n', 's', 'e', 'w'] as Side[]) {
      const [lo, hi] = side === 'n' || side === 's' ? [x0, x1] : [z0, z1];
      const n = Math.max(1, Math.round((hi - lo) / 3)), L = (hi - lo) / n;
      for (let i = 0; i < n; i++) {
        const a = lo + i * L, b = a + L, mid = (a + b) / 2;
        const door = room.openings.some((q) => q.side === side && !q.glass && q.a < b && q.b > a);
        const [fx, fz] = inFront(side, mid, 0.75), open = k.free(fx, fz);
        if (!door && w() < 0.3 + g * 0.65) d.decal(onWall(side, mid, 0.45), L, 0.9, 0, 0, 0.02, CELL.scuff, st.dirt, 0.25 + g * 0.55 * (0.5 + w() * 0.5));
        if (!door && w() < st.drips * (0.25 + g * 0.5)) {
          const hh = Math.min(h * 0.55, 1.4 + w() * 2.4), ww = 1 + w() * 1.4;
          if (!busy(side, mid - ww / 2, mid + ww / 2, h - hh, h)) d.decal(onWall(side, mid, h - hh / 2), ww, hh, 0, 0, 0.02, w() < 0.4 ? CELL.rust : CELL.drips, w() < 0.4 ? 0xffffff : st.dirt, 0.35 + g * 0.45);
        }
        if (door) continue;
        const roll = w();
        if (roll < 0.1 && open && !busy(side, mid - 0.5, mid + 0.5, 0.15, 1.15)) d.decal(onWall(side, mid, 0.65), 0.9, 0.9, 0, 0, 0.022, CELL.hatch, 0xffffff, 1);
        else if (roll < 0.19 && h > 3.1 && !busy(side, mid - 0.55, mid + 0.55, 2.0, 2.8)) d.decal(onWall(side, mid, Math.min(2.45, h - 0.75)), 1.0, 1.0, 0, 0, 0.022, CELL.vent, 0xffffff, 1);
        else if (roll < 0.19 + st.posters * 0.2 && open && !busy(side, mid - 0.8, mid + 0.8, 1.0, 2.4)) {
          if (w() < 0.5) d.decal(onWall(side, mid, 1.7), 1.3, 1.3, 0, 0, 0.02, CELL.posters, 0xffffff, 0.95);
          else d.decal(onWall(side, mid, 1.6), 1.7, 1.7, 0, 0, 0.02, CELL.tag, [0xd9d4c8, 0xc8662a, 0x7fb8d8, 0xb8483a][Math.floor(w() * 4)], 0.6);
        }
        if (w() < 0.12 + g * 0.2) d.decal(onWall(side, mid + (w() - 0.5), 1 + w() * Math.min(1.6, h - 2)), 1.2, 1.2, 0, 0, 0.018, CELL.chips, st.dirt, 0.3 + g * 0.3, { rz: w() * 6 });
        if (open && w() < st.litter * 0.3) { const [lx, lz] = inFront(side, mid, 0.7); d.decal(ID, 1.5, 1.5, lx, 0.024, lz, CELL.litter, 0xffffff, 0.9, { flat: true, ry: w() * 6.28 }); }
      }
    }

    // Doors: smudged frames, and floor worn down by everyone who has ever come through.
    for (const q of room.openings) {
      if (q.glass || q.y0 > 0) continue;
      const mid = (q.a + q.b) / 2;
      for (const e of [q.a - 0.3, q.b + 0.3]) d.decal(onWall(q.side, e, 1.15), 0.6, 1.5, 0, 0, 0.021, CELL.smudge, st.dirt, 0.3 + g * 0.5);
      const [cx, cz] = inFront(q.side, mid, 2.4), [ex, ez] = inFront(q.side, mid, 0);
      strip(k, d, ex, ez, cx + (cx - ex) * 0.9, cz + (cz - ez) * 0.9, (q.b - q.a) * 0.85, CELL.path, st.worn, st.wornA);
    }

    if (corridor) {
      const alongZ = deep >= wide, len = alongZ ? deep : wide, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, half = Math.min(wide, deep) / 2;
      // The middle of the floor, worn by feet.
      if (alongZ) strip(k, d, cx, z0 + 0.2, cx, z1 - 0.2, half * 0.9, CELL.path, st.worn, st.wornA * 0.8);
      else strip(k, d, x0 + 0.2, cz, x1 - 0.2, cz, half * 0.9, CELL.path, st.worn, st.wornA * 0.8);
      // Services along the ceiling: an air duct down one side, pipes and a cable tray down the
      // other, hung on brackets, with a vent in the duct every so often.
      const M = alongZ ? k.frame(cx, 0, cz, 0) : k.frame(cx, 0, cz, Math.PI / 2), off = half - 0.75, top = h - 0.02;
      const n = Math.ceil(len / 3), L = len / n;
      for (let i = 0; i < n; i++) {
        const lz = -len / 2 + (i + 0.5) * L;
        d.box(M, 0.55, 0.32, L - 0.04, off, top - 0.2, lz, st.duct, { high: true });
        d.box(M, 0.6, 0.36, 0.06, off, top - 0.2, lz + L / 2, DARK, { high: true });
        if (i % 2 === 0) d.box(M, 0.34, 0.03, 0.7, off, top - 0.375, lz, 0x15181b, { high: true });
        st.pipes.forEach((c, j) => d.tube(M, 0.055 - j * 0.012, L, -off - 0.2 + j * 0.17, top - 0.14 - (j % 2) * 0.05, lz, 'z', c, { high: true }));
        d.box(M, 0.34, 0.035, L, -off + 0.45, top - 0.3, lz, 0x3d444b, { high: true });
        for (const c of [-0.1, 0, 0.1]) d.tube(M, 0.018, L, -off + 0.45 + c, top - 0.26, lz, 'z', 0x15171a, { high: true });
        d.box(M, 0.9, 0.04, 0.05, -off + 0.15, top - 0.34, lz - L / 2 + 0.1, DARK, { high: true });
        for (const hx of [-off - 0.3, -off + 0.6]) d.tube(M, 0.012, 0.34, hx, top - 0.17, lz - L / 2 + 0.1, 'y', DARK, { high: true });
      }
    } else {
      // A big room: pipes high along the two longer walls, and here and there a conduit coming
      // down to a junction box at hand height.
      const sides: Side[] = wide >= deep ? ['n', 's'] : ['w', 'e'];
      for (const side of sides) {
        const [lo, hi] = side === 'n' || side === 's' ? [x0, x1] : [z0, z1];
        const y = h - (h >= 5 ? 0.55 : 0.2), n = Math.ceil((hi - lo) / 3), L = (hi - lo) / n;
        for (let i = 0; i < n; i++) {
          const a = lo + i * L, mid = a + L / 2;
          if (busy(side, a, a + L, y - 0.3, y + 0.3)) continue;
          const M = onWall(side, mid, y);
          if (h >= 5) {
            st.pipes.forEach((c, j) => d.tube(M, 0.085 - j * 0.02, L, 0, -j * 0.2, 0.16 + (j % 2) * 0.1, 'x', c, { high: true }));
            d.box(M, 0.06, 0.2 * st.pipes.length + 0.1, 0.34, -L / 2 + 0.2, -0.1 * (st.pipes.length - 1), 0.17, DARK, { high: true });
          } else {
            for (const c of [0, 0.05, 0.1]) d.tube(M, 0.02, L, 0, -c, 0.05, 'x', 0x15171a, { high: true });
          }
          if (w() < 0.22 && y > 3 && !busy(side, mid - 0.4, mid + 0.4, 1.1, y)) {
            const [fx, fz] = inFront(side, mid, 0.7);
            if (!k.free(fx, fz)) continue;
            d.tube(M, 0.03, y - 1.75, 0, -(y - 1.75) / 2, 0.06, 'y', st.pipes[0], { high: true });
            d.box(M, 0.38, 0.5, 0.14, 0, -(y - 1.5), 0.07, 0x4a5258);
            d.box(M, 0.3, 0.06, 0.02, 0, -(y - 1.62), 0.145, 0xd9a514);
            d.box(M, 0.05, 0.05, 0.03, 0.1, -(y - 1.42), 0.15, 0x4dff9a, { glow: 1.4 });
          }
        }
      }
    }
  }
}
