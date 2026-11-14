// Procedural planet surfaces. Everything is painted onto canvases from seeded
// 3D noise sampled on a sphere, so the maps wrap without a seam. Painting can
// be spread over many frames so a large map never stalls the flight.

export type Stop = [number, string];

export interface TexSpec {
  style: 'rock' | 'gas' | 'terran' | 'ice' | 'lava' | 'star';
  palette: Stop[];
  seed: number;
  scale?: number;
  bands?: number;
  turb?: number;
  sea?: number;
  caps?: number;
  clouds?: number;
  spot?: boolean;
  /** Crater density, 0..1. */
  craters?: number;
  /** Storm ovals on gas giants, 0..1. */
  storms?: number;
  /** Settlement lights on the night side, 0..1. */
  lights?: number;
  /** Crack colour for ice, glow colour for lava. */
  accent?: string;
  ocean?: [string, string];
}

export interface Maps {
  color: HTMLCanvasElement;
  bump?: HTMLCanvasElement;
  rough?: HTMLCanvasElement;
  lights?: HTMLCanvasElement;
  clouds?: HTMLCanvasElement;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Noise {
  private p = new Uint8Array(512);
  /** Set by `cell`: the random value of the nearest feature. */
  cellRnd = 0;

  constructor(seed: number) {
    const r = rng(seed * 2654435761 + 17);
    const a = new Uint8Array(256);
    for (let i = 0; i < 256; i++) a[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    for (let i = 0; i < 512; i++) this.p[i] = a[i & 255];
  }

  /** Value noise in 0..1. */
  n3(x: number, y: number, z: number): number {
    let X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    const fx = x - X, fy = y - Y, fz = z - Z;
    X &= 255; Y &= 255; Z &= 255;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
    const p = this.p;
    const A = p[X] + Y, B = p[X + 1] + Y;
    const AA = p[A] + Z, AB = p[A + 1] + Z, BA = p[B] + Z, BB = p[B + 1] + Z;
    const x00 = p[AA] + (p[BA] - p[AA]) * u;
    const x10 = p[AB] + (p[BB] - p[AB]) * u;
    const x01 = p[AA + 1] + (p[BA + 1] - p[AA + 1]) * u;
    const x11 = p[AB + 1] + (p[BB + 1] - p[AB + 1]) * u;
    const y0 = x00 + (x10 - x00) * v;
    const y1 = x01 + (x11 - x01) * v;
    return (y0 + (y1 - y0) * w) / 255;
  }

  fbm(x: number, y: number, z: number, oct: number): number {
    let sum = 0, amp = 1, tot = 0, f = 1;
    for (let i = 0; i < oct; i++) {
      sum += amp * this.n3(x * f, y * f, z * f);
      tot += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return sum / tot;
  }

  /**
   * Scattered round features (craters, storms, city clusters). Returns the distance to the
   * nearest one in units of its own radius; 9 when there is none in reach.
   */
  cell(x: number, y: number, z: number, freq: number, density: number): number {
    const px = x * freq, py = y * freq, pz = z * freq;
    const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz);
    const p = this.p, lim = density * 255;
    let best = 9;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cx = ix + dx, cy = iy + dy, cz = iz + dz;
          const h = p[p[p[cx & 255] + (cy & 255)] + (cz & 255)];
          if (h > lim) continue;
          const ex = cx + p[h + 1] / 255 - px, ey = cy + p[h + 2] / 255 - py, ez = cz + p[h + 3] / 255 - pz;
          const size = p[h + 4] / 255;
          const r = 0.18 + 0.62 * size * size;
          const d = Math.sqrt(ex * ex + ey * ey + ez * ez) / r;
          if (d < best) {
            best = d;
            this.cellRnd = p[h + 5] / 255;
          }
        }
      }
    }
    return best;
  }
}

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lut(stops: Stop[]): Uint8Array {
  const out = new Uint8Array(256 * 3);
  const s = stops.map(([t, c]) => [t, ...hex(c)]);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let k = 0;
    while (k < s.length - 2 && t > s[k + 1][0]) k++;
    const a = s[k], b = s[Math.min(k + 1, s.length - 1)];
    const f = b[0] === a[0] ? 0 : Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])));
    for (let c = 0; c < 3; c++) out[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * f;
  }
  return out;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Bowl with a raised rim: −1 at the centre, a little above zero at the edge. */
const craterShape = (d: number) => (d < 0.8 ? -(1 - (d / 0.8) ** 2) : d < 1.3 ? 0.4 * (1 - Math.abs(d - 1) / 0.3) : 0);

/** Which extra maps a style produces — the same set at every resolution, so swapping maps never recompiles a shader. */
export function mapKinds(t: TexSpec) {
  return {
    bump: t.style === 'rock' || t.style === 'terran' || t.style === 'ice' || t.style === 'lava',
    rough: t.style === 'terran',
    lights: t.style === 'lava' || !!t.lights,
    clouds: t.style === 'terran' && !!t.clouds,
  };
}

/**
 * Paint a body. With a `budget` (ms of work per turn) the job gives the frame back
 * regularly; `alive` lets the caller abandon a job whose body has gone.
 */
export async function paintBody(t: TexSpec, w: number, h: number, budget = Infinity, alive: () => boolean = () => true): Promise<Maps | null> {
  const N = new Noise(t.seed);
  const L = lut(t.palette);
  const sc = t.scale ?? 2;
  const kinds = mapKinds(t);
  const mk = (on: boolean) => (on ? new ImageData(w, h) : undefined);
  const img = new ImageData(w, h);
  const bumpI = mk(kinds.bump), roughI = mk(kinds.rough), lightI = mk(kinds.lights), cloudI = mk(kinds.clouds);
  const d = img.data, bd = bumpI?.data, rd = roughI?.data, ld = lightI?.data, cd = cloudI?.data;

  const cosL = new Float32Array(w), sinL = new Float32Array(w);
  for (let i = 0; i < w; i++) {
    const lon = (i / w) * Math.PI * 2;
    cosL[i] = Math.cos(lon);
    sinL[i] = Math.sin(lon);
  }
  const accent = hex(t.accent ?? (t.style === 'lava' ? '#ff7a1a' : '#6b4a32'));
  const deep = hex(t.ocean?.[0] ?? '#06203f');
  const shallow = hex(t.ocean?.[1] ?? '#1f6a96');
  const sea = t.sea ?? 0.52;
  const caps = t.caps ?? 0;
  const clouds = t.clouds ?? 0;
  const bands = t.bands ?? 8;
  const turb = t.turb ?? 0.15;
  const craters = t.craters ?? 0;
  const storms = t.storms ?? 0;
  const lights = t.lights ?? 0;
  const fine = w >= 1024;
  const spotLon = 2.2;
  let t0 = performance.now();

  for (let j = 0; j < h; j++) {
    if (budget !== Infinity && performance.now() - t0 > budget) {
      await new Promise<void>((r) => setTimeout(r, 0));
      if (!alive()) return null;
      t0 = performance.now();
    }
    const lat = ((j + 0.5) / h - 0.5) * Math.PI;
    const y = Math.sin(lat), cr = Math.cos(lat);
    for (let i = 0; i < w; i++) {
      const x = cr * cosL[i], z = cr * sinL[i];
      let r = 0, g = 0, b = 0, bump = 0.5, lr = 0, lg = 0, lb = 0;
      const o = (j * w + i) * 4;

      if (t.style === 'rock') {
        const n = N.fbm(x * sc, y * sc, z * sc, fine ? 7 : 5);
        const n2 = N.fbm(x * sc * 6 + 7, y * sc * 6, z * sc * 6, 3);
        const maria = N.fbm(x * sc * 0.45 + 9, y * sc * 0.45, z * sc * 0.45, 3);
        let tt = clamp01((n - 0.5) * 2.2 + 0.5) * 0.7 + n2 * 0.2 + (maria - 0.5) * 0.35;
        bump = 0.5 + (n - 0.5) * 0.9 + (n2 - 0.5) * 0.15;
        if (craters) {
          for (let k = 0; k < (fine ? 3 : 2); k++) {
            const freq = k === 0 ? 3.2 : k === 1 ? 8.5 : 21;
            const dist = N.cell(x, y, z, freq, 0.55 * craters);
            if (dist < 1.3) {
              const v = craterShape(dist) * (k === 0 ? 1 : k === 1 ? 0.7 : 0.45);
              bump += v * 0.22;
              tt += v * 0.13;
              if (N.cellRnd > 0.88) tt += 0.2 * (1.3 - dist);
            }
          }
        }
        const k = (clamp01(tt) * 255) | 0;
        r = L[k * 3]; g = L[k * 3 + 1]; b = L[k * 3 + 2];
        if (caps) {
          const a = clamp01((Math.abs(y) + (n - 0.5) * 0.2 - (1 - caps)) * 25);
          r += (240 - r) * a; g += (240 - g) * a; b += (245 - b) * a;
        }
        if (lights) {
          const dist = N.cell(x, y, z, 26, 0.05 + lights * 0.14);
          const hub = N.fbm(x * 3 + 50, y * 3, z * 3, 2);
          if (dist < 0.7 && hub > 0.5) {
            const a = (1 - dist / 0.7) ** 2;
            lr = 255 * a; lg = 205 * a; lb = 140 * a;
          }
        }
      } else if (t.style === 'gas') {
        const warp = (N.fbm(x * 2.5, y * 2.5, z * 2.5, 4) - 0.5) * turb + (N.fbm(x * 9, y * 9, z * 9, 3) - 0.5) * turb * 0.3;
        const band = N.n3(3.7, (y + warp) * bands + 50, 9.1);
        const detail = N.fbm(x * 5, y * 28, z * 5, fine ? 5 : 4) - 0.5;
        let tt = (band - 0.5) * 1.8 + 0.5 + detail * 0.25;
        if (storms) {
          const dist = N.cell(x, y * 2.6, z, 4.5, 0.16 * storms);
          if (dist < 1) tt += (N.cellRnd - 0.4) * (1 - dist) ** 1.5 * 0.9;
        }
        const k = (clamp01(tt) * 255) | 0;
        r = L[k * 3]; g = L[k * 3 + 1]; b = L[k * 3 + 2];
        if (t.spot) {
          let dl = Math.abs((i / w) * Math.PI * 2 - spotLon);
          if (dl > Math.PI) dl = Math.PI * 2 - dl;
          const q = (dl / 0.22) ** 2 + ((y + 0.36) / 0.085) ** 2;
          if (q < 1) {
            const a = (1 - q) * 0.85;
            r += (176 - r) * a; g += (68 - g) * a; b += (38 - b) * a;
          }
        }
      } else if (t.style === 'terran') {
        const wx = (N.fbm(x * sc * 0.7 + 3, y * sc * 0.7, z * sc * 0.7, 3) - 0.5) * 0.5;
        const raw = N.fbm((x + wx) * sc, (y + wx) * sc, (z - wx) * sc, fine ? 8 : 6);
        const hgt = clamp01((raw - 0.5) * 2.6 + 0.5);
        const alat = Math.abs(y);
        let land = 0, rough = 0.32;
        if (hgt < sea) {
          const q = (hgt / sea) ** 3;
          r = deep[0] + (shallow[0] - deep[0]) * q;
          g = deep[1] + (shallow[1] - deep[1]) * q;
          b = deep[2] + (shallow[2] - deep[2]) * q;
          bump = 0.3;
        } else {
          land = clamp01((hgt - sea) / (1 - sea));
          const k = (land * 255) | 0;
          r = L[k * 3]; g = L[k * 3 + 1]; b = L[k * 3 + 2];
          const dry = N.fbm(x * sc * 1.3 + 20, y * sc * 1.3, z * sc * 1.3, 4);
          const arid = clamp01(1 - Math.abs(alat - 0.32) / 0.24) * clamp01((dry - 0.42) * 5) * (1 - land) * 0.9;
          r += (204 - r) * arid; g += (172 - g) * arid; b += (116 - b) * arid;
          const cold = clamp01((alat + land * 0.25 - (0.8 - caps)) / 0.2) * 0.8;
          r += (150 - r) * cold; g += (144 - g) * cold; b += (132 - b) * cold;
          const ridge = 1 - Math.abs(2 * N.fbm(x * sc * 5 + 8, y * sc * 5, z * sc * 5, 3) - 1);
          bump = 0.34 + land * 0.5 + ridge * land * 0.25;
          rough = 0.95;
        }
        let ice = 0;
        if (caps) {
          ice = clamp01((alat + (hgt - 0.5) * 0.25 - (1 - caps)) * 30);
          r += (242 - r) * ice; g += (246 - g) * ice; b += (250 - b) * ice;
          rough += (0.8 - rough) * ice;
        }
        if (lights && land > 0 && ice < 0.5) {
          const city = N.fbm(x * sc * 10 + 40, y * sc * 10, z * sc * 10, 3) * N.fbm(x * sc * 2.5 + 60, y * sc * 2.5, z * sc * 2.5, 2);
          const speck = N.n3(x * 190, y * 190, z * 190);
          const a = clamp01((city - (0.34 - lights * 0.07)) * 12) * (land < 0.45 ? 1 : 0.3) * (0.35 + 0.65 * speck);
          lr = 255 * a; lg = 200 * a; lb = 120 * a;
        }
        if (rd) { rd[o] = 0; rd[o + 1] = rough * 255; rd[o + 2] = 0; rd[o + 3] = 255; }
        if (cd) {
          const cw = (N.fbm(x * sc * 0.9 + 70, y * sc * 0.9, z * sc * 0.9, 3) - 0.5) * 0.6;
          const c = N.fbm((x + cw) * sc * 1.7 + 11, (y - cw) * sc * 2.6 + 5, (z + cw) * sc * 1.7, fine ? 6 : 5);
          const a = clamp01((c - 0.5) * 4.5) * clouds;
          cd[o] = 255; cd[o + 1] = 255; cd[o + 2] = 255; cd[o + 3] = a * 255;
        }
      } else if (t.style === 'ice' || t.style === 'lava') {
        const n = clamp01((N.fbm(x * sc, y * sc, z * sc, fine ? 6 : 5) - 0.5) * 2.2 + 0.5);
        const k = (n * 255) | 0;
        r = L[k * 3]; g = L[k * 3 + 1]; b = L[k * 3 + 2];
        const r1 = 1 - Math.abs(2 * N.fbm(x * sc * 2 + 3, y * sc * 2, z * sc * 2, 4) - 1);
        const icy = t.style === 'ice';
        const edge = icy ? 0.9 : 0.86;
        let a = clamp01((r1 - edge) / (1 - edge)) * (icy ? 0.7 : 1);
        if (icy) {
          const r2 = 1 - Math.abs(2 * N.fbm(x * sc * 5 + 13, y * sc * 5, z * sc * 5, 3) - 1);
          a = Math.max(a, clamp01((r2 - 0.92) / 0.08) * 0.4);
        }
        r += (accent[0] - r) * a; g += (accent[1] - g) * a; b += (accent[2] - b) * a;
        bump = 0.5 + (n - 0.5) * 0.6 + (icy ? a * 0.25 : -a * 0.4);
        if (craters) {
          const dist = N.cell(x, y, z, 7, 0.3 * craters);
          if (dist < 1.3) {
            const v = craterShape(dist);
            bump += v * 0.2;
            const s = 1 + v * 0.12;
            r *= s; g *= s; b *= s;
          }
        }
        if (!icy) { lr = accent[0] * a; lg = accent[1] * a; lb = accent[2] * a; }
      } else {
        const n = N.fbm(x * 6, y * 6, z * 6, 5);
        const n2 = N.fbm(x * 22, y * 22, z * 22, fine ? 4 : 3);
        let tt = clamp01((n - 0.5) * 2 + 0.5) * 0.6 + n2 * 0.4;
        const dist = N.cell(x, y * 1.4, z, 7, 0.05);
        if (dist < 1) tt *= 0.35 + 0.65 * dist;
        const k = (clamp01(tt) * 255) | 0;
        r = L[k * 3]; g = L[k * 3 + 1]; b = L[k * 3 + 2];
      }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      if (bd) { const v = clamp01(bump) * 255; bd[o] = v; bd[o + 1] = v; bd[o + 2] = v; bd[o + 3] = 255; }
      if (ld) { ld[o] = lr; ld[o + 1] = lg; ld[o + 2] = lb; ld[o + 3] = 255; }
    }
  }
  const put = (im?: ImageData) => {
    if (!im) return undefined;
    const c = canvas(w, h);
    c.getContext('2d')!.putImageData(im, 0, 0);
    return c;
  };
  return { color: put(img)!, bump: put(bumpI), rough: put(roughI), lights: put(lightI), clouds: put(cloudI) };
}

/** A strip whose horizontal axis runs from the inner to the outer edge of a ring system. */
export function paintRing(palette: Stop[], seed: number, opacity: number, gap?: number): HTMLCanvasElement {
  const w = 1024;
  const c = canvas(w, 4);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, 4);
  const N = new Noise(seed);
  const L = lut(palette);
  for (let i = 0; i < w; i++) {
    const u = i / w;
    const n = N.n3(u * 38, 0.5, 0.5) * 0.5 + N.n3(u * 140, 5.5, 0.5) * 0.3 + N.n3(u * 420, 9.5, 0.5) * 0.2;
    let a = clamp01((n - 0.22) * 1.7) * opacity;
    a *= clamp01(u * 25) * clamp01((1 - u) * 25);
    if (gap !== undefined && Math.abs(u - gap) < 0.022) a *= 0.08;
    const k = (clamp01(n) * 255) | 0;
    for (let j = 0; j < 4; j++) {
      const o = (j * w + i) * 4;
      img.data[o] = L[k * 3]; img.data[o + 1] = L[k * 3 + 1]; img.data[o + 2] = L[k * 3 + 2];
      img.data[o + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function paintGlow(): HTMLCanvasElement {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return c;
}
