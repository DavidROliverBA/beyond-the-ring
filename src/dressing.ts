// Each station's own wear, clutter and wayfinding, laid on top of what every room gets
// (see wear.ts). The positions are worked out by hand from each station's floor plan in
// interior.ts. Solid things ask the place for clear floor first and are simply left out if
// someone is standing there, so none of this can trap a person or block a door.
//
// A note on signs with arrows: someone walking towards +z has -x on their right. The comments
// by each sign say who reads it and which way they are facing.

import * as THREE from 'three';
import { CELL, Dress, Signs, tally, bin, catwalk, drums, hang, hose, lampPost, lights, post, rail, stack, stand, strip, type Site } from './wear';

const PI = Math.PI, DARK = 0x2d3238, STEEL = 0x596168, HAZ = 0xd9a514, CLEAR = 'rgba(0,0,0,0)';
const lay = new THREE.Matrix4().makeRotationX(-PI / 2);

/** Lettering painted on the floor, the right way up for someone facing `yaw` (a walker's yaw). */
function floorSign(k: Site, s: Signs, x: number, z: number, yaw: number, w: number, h: number, lines: string[], color = 'rgba(235,235,225,0.55)') {
  s.add(k.frame(x, 0.03, z, yaw).multiply(lay), w, h, lines, color, CLEAR);
}

/** A sign fixed flat to a wall (or anything upright), facing `yaw`. */
function wallSign(k: Site, s: Signs, x: number, y: number, z: number, yaw: number, w: number, h: number, lines: string[], color = '#ffd9a0', bg = 'rgba(10,12,16,0.85)') {
  s.add(k.frame(x, y, z, yaw), w, h, lines, color, bg);
}

/** Chevrons painted on the floor from one point to another, pointing the way. */
function chevrons(k: Site, d: Dress, x0: number, z0: number, x1: number, z1: number, color: number, alpha = 0.5, every = 2.4, size = 1.1) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(len / every)), yaw = Math.atan2(-(x1 - x0), -(z1 - z0));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    d.decal(k.frame(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, yaw), size, size, 0, 0.026, 0, CELL.arrow, color, alpha, { flat: true });
  }
}

/** A box of warning stripes on the floor round something. `gap` leaves the +z side open in the middle. */
function hazardBox(k: Site, d: Dress, x0: number, z0: number, x1: number, z1: number, gap = 0, alpha = 0.85) {
  const w = 0.32;
  strip(k, d, x0, z0, x1, z0, w, CELL.hazard, 0xffffff, alpha);
  strip(k, d, x0, z0, x0, z1, w, CELL.hazard, 0xffffff, alpha);
  strip(k, d, x1, z0, x1, z1, w, CELL.hazard, 0xffffff, alpha);
  if (gap) { const m = (x0 + x1) / 2; strip(k, d, x0, z1, m - gap, z1, w, CELL.hazard, 0xffffff, alpha); strip(k, d, m + gap, z1, x1, z1, w, CELL.hazard, 0xffffff, alpha); }
  else strip(k, d, x0, z1, x1, z1, w, CELL.hazard, 0xffffff, alpha);
}

/** A tool cart: a tray on wheels with a box of tools and a push bar. Solid. */
function cart(k: Site, d: Dress, x: number, z: number, yaw: number, color = 0xc8662a): boolean {
  if (!tally('cart', k.clear(x, z, 0.9))) return false;
  const M = k.frame(x, 0, z, yaw);
  d.box(M, 1.2, 0.06, 0.65, 0, 0.3, 0, DARK);
  d.box(M, 1.2, 0.06, 0.65, 0, 0.85, 0, DARK);
  for (const [px, pz] of [[-0.56, -0.28], [0.56, -0.28], [-0.56, 0.28], [0.56, 0.28]]) { d.tube(M, 0.02, 0.85, px, 0.5, pz, 'y', STEEL); d.tube(M, 0.07, 0.05, px, 0.07, pz, 'z', 0x15171a); }
  d.box(M, 0.6, 0.3, 0.4, -0.2, 1.03, 0, color);
  d.box(M, 0.3, 0.16, 0.3, 0.38, 0.96, 0.05, 0x4a6a7a);
  d.box(M, 0.5, 0.35, 0.45, 0.1, 0.5, 0, 0x6a7078);
  d.tube(M, 0.018, 0.65, 0.68, 1.02, 0, 'z', STEEL);
  for (const pz of [-0.3, 0.3]) d.bar(M, 0.016, [0.58, 0.85, pz], [0.68, 1.02, pz], STEEL);
  const yawed = Math.abs(Math.sin(yaw)) > 0.7;
  k.block(x, z, yawed ? 0.7 : 1.3, yawed ? 1.3 : 0.7);
  return true;
}

/**
 * A directory pillar: a post with a lettered board on each listed face. Each face is given
 * as the yaw it faces and its lines. Solid.
 */
function totem(k: Site, d: Dress, s: Signs, spots: [number, number][], faces: [number, string[]][], o: { w?: number; h?: number; thick?: number; color?: string; cap?: number; tall?: number; body?: number; bg?: string } = {}): boolean {
  const w = o.w ?? 0.62, h = o.h ?? 1.5, thick = o.thick ?? w, tall = o.tall ?? 3.1;
  const at = spots.find(([x, z]) => k.clear(x, z, 0.75));
  if (!tally('totem', !!at) || !at) return false;
  const [x, z] = at, M = k.frame(x, 0, z);
  d.box(M, w + 0.06, tall, thick + 0.06, 0, tall / 2, 0, o.body ?? 0x14181c);
  d.box(M, w + 0.2, 0.25, thick + 0.2, 0, 0.125, 0, DARK);
  d.box(M, w + 0.12, 0.07, thick + 0.12, 0, tall + 0.02, 0, o.cap ?? 0xffb347, { glow: 1.4 });
  for (const [yaw, lines] of faces) {
    const turned = Math.abs(Math.sin(yaw)) > 0.7, out = (turned ? w : thick) / 2 + 0.035;
    s.add(k.frame(x, tall - 0.15 - h / 2, z, yaw).multiply(new THREE.Matrix4().makeTranslation(0, 0, out)), (turned ? thick : w) - 0.02, h, lines, o.color ?? '#ffd9a0', o.bg ?? 'rgba(8,10,14,0.95)');
  }
  k.block(x, z, w + 0.1, thick + 0.1);
  return true;
}

// ------------------------------------------------------------------ Tycho

export function dressTycho(k: Site, d: Dress, s: Signs) {
  const ORANGE = 0xc8662a, BLUE = 0x6fa8ff, GREEN = 0x4dbf8a;

  // Docking bay 7: a marked berth, a fuel hose, catwalks along both walls and cargo by the door.
  d.group('Docking bay 7');
  strip(k, d, -20, 2.9, 20, 2.9, 0.45, CELL.hazard, 0xffffff, 0.9);
  hazardBox(k, d, -5.6, 7, 5.6, 33.3, 1.7);
  chevrons(k, d, 0, 38.6, 0, 50.6, 0xe8e4d8, 0.45);
  for (const [x, z, sz] of [[-2, 12, 3.6], [2.4, 23, 4.4], [-1, 28.5, 3], [-17.2, 32.3, 3.2], [17.2, 32.3, 3.2], [11.5, 31.5, 3]]) d.decal(k.frame(x, 0, z, x * 3), sz, sz * 0.8, 0, 0.024, 0, CELL.oil, 0x0a0908, 0.6, { flat: true });
  hose(k, d, [[-17.6, 32.3], [-13, 33.6], [-8.5, 31.2], [-5, 30.6], [-3, 29.2]], 0x1c1f22, 0.06);
  catwalk(k, d, -22, 5, 47, 6, 1, { ladder: 46.4 });
  catwalk(k, d, 22, 5, 47, 6, -1, { ladder: 46.4 });
  stack(k, d, -9.5, 50.2);
  stack(k, d, 9.8, 50.2, { n: 4 });
  drums(k, d, -13.5, 50.9, 4);
  cart(k, d, 8.5, 35.5, 0.3);
  cart(k, d, -7.6, 12.5, PI / 2);
  // Read by someone in the bay walking to the door (facing +z).
  wallSign(k, s, 0, 4.5, 51.94, PI, 10, 1.15, ['↑ RING A · SECTION 7', 'WORKSHOP · BLAUWE BLOME · OPERATIONS · YARD GALLERY'], '#e08a4a');
  floorSign(k, s, 0, 37, 0, 7, 1.1, ['BAY 7 · DECK 2']);

  // Ring corridor: coloured lines on the floor that lead somewhere, signs hung at the
  // junctions, section numbers on the walls. (The corridor runs with the spin, towards +z.)
  d.group('Ring corridor');
  const line = (x0: number, z0: number, x1: number, z1: number, c: number) => strip(k, d, x0, z0, x1, z1, 0.26, CELL.line, c, 0.85, { y: 0.027, per: 1.6 });
  line(-0.55, 52.3, -0.55, 95.7, ORANGE);
  line(0.45, 52.3, 0.45, 65, BLUE); line(0.45, 65, 2.9, 65, BLUE);
  line(0.85, 52.3, 0.85, 85, GREEN); line(0.85, 85, 2.9, 85, GREEN);
  // Front: people heading up the corridor from the bay (facing +z, east on their left).
  // Back: people heading back to the bay (facing -z, east on their right).
  hang(k, d, s, 0, 2.95, 58.4, PI, 3.6, 0.52, ['← BLAUWE BLOME · OPS     WORKSHOP →', '↑ YARD GALLERY'], ['↑ DOCKING BAY 7'], 3.6, '#e08a4a');
  hang(k, d, s, 0, 2.95, 80.5, PI, 3.6, 0.52, ['← OPERATIONS', '↑ YARD GALLERY'], ['← WORKSHOP     BLAUWE BLOME →', '↑ DOCKING BAY 7'], 3.6, '#e08a4a');
  // Facing the west wall, spinward (+z) is to your left; facing the east wall, to your right.
  for (const [z, n] of [[55.6, '07'], [75, '08'], [90.5, '09']] as const) wallSign(k, s, -2.97, 1.85, z, PI / 2, 2.1, 0.52, [`RING A · SEC ${n}`, '← SPINWARD · DECK 2'], '#4a5862', CLEAR);
  for (const [z, n] of [[58, '07'], [70.5, '08'], [91, '09']] as const) wallSign(k, s, 2.97, 1.85, z, -PI / 2, 2.1, 0.52, [`RING A · SEC ${n}`, 'DECK 2 · SPINWARD →'], '#4a5862', CLEAR);
  bin(k, d, 2.45, 61.6, 0x8a9198, 0.15);
  bin(k, d, -2.45, 73, 0x8a9198, 0.15);
  bin(k, d, 2.45, 89.5, 0x8a9198, 0.15);

  // The bar: rings and spills round the tables, empties behind the counter.
  d.group('Blauwe Blome');
  for (const [x, z] of [[8, 62], [8, 69], [14, 70], [20, 68], [14, 64], [18, 60.2]]) d.decal(k.frame(x, 0, z, x), 2.6, 2.6, 0, 0.024, 0, CELL.blotch, 0x140c08, 0.4, { flat: true });
  stack(k, d, 24, 60.6, { n: 2, need: 0.7, cols: [0x4a6a7a, 0x6a5a48] });
  bin(k, d, 4, 72.8, 0x55504a, 0.4);

  // Workshop: the drive bell stands inside a warning box, with oil, hoses and tools round it.
  d.group('Engineering workshop');
  hazardBox(k, d, -19.4, 64.6, -12.6, 71.4);
  for (const [x, z, sz] of [[-12.4, 66, 3], [-18.6, 72, 3.6], [-22, 60, 2.6], [-9, 74.5, 3]]) d.decal(k.frame(x, 0, z, z), sz, sz, 0, 0.024, 0, CELL.oil, 0x0a0908, 0.6, { flat: true });
  hose(k, d, [[-23.2, 59.4], [-21, 62], [-19.6, 64.2], [-18, 65.6]], 0xb8483a);
  hose(k, d, [[-23.2, 76.6], [-20.5, 74.5], [-18.4, 72.6], [-17.6, 70.6]], 0x1c1f22);
  cart(k, d, -10.5, 70.5, PI / 2);
  cart(k, d, -21.5, 66, 0, 0x4a6a7a);
  drums(k, d, -7, 57.3, 3);
  stack(k, d, -27.3, 62.5, { n: 3, cols: [0x6a7078, 0x4a6a7a, 0xc8662a] });
  if (k.clear(-27.9, 74, 0.6)) {
    // Gas bottles chained in a rack against the wall.
    const M = k.frame(-28.25, 0, 74);
    for (let i = 0; i < 4; i++) { d.tube(M, 0.13, 1.4, 0, 0.7, -0.6 + i * 0.4, 'y', [0x3f6f8a, 0x9a4a32, 0x3f6f8a, 0x6a7078][i]); d.tube(M, 0.05, 0.14, 0, 1.47, -0.6 + i * 0.4, 'y', DARK); }
    d.box(M, 0.04, 0.05, 1.8, 0.16, 1.0, 0, STEEL);
    k.block(-28.25, 74, 0.4, 1.8);
  }

  d.group('Operations');
  bin(k, d, 21.6, 77.4, 0x8a9198, 0.1);
  wallSign(k, s, 3.03, 1.85, 90.5, PI / 2, 2.1, 0.52, ['OPERATIONS', 'RING A · SEC 09'], '#7a8a96', CLEAR);

  // Yard gallery: a handrail on the parapet under the window, and viewers to look through.
  d.group('Yard gallery');
  for (let x = -18; x < 18; x += 3) {
    const M = k.frame(x + 1.5, 0, 113.05);
    d.tube(M, 0.04, 3, 0, 1.12, 0, 'x', 0xc9ced3);
    d.tube(M, 0.025, 0.14, -1.5, 1.06, 0, 'y', STEEL);
    d.decal(k.frame(x + 1.5, 0.5, 113.13, PI), 3, 1.0, 0, 0, 0, CELL.scuff, 0x1c2024, 0.35);
  }
  for (const x of [-8, 0.6, 8]) {
    if (!k.clear(x, 112.2, 0.55)) continue;
    const M = k.frame(x, 0, 112.2);
    d.tube(M, 0.05, 1.25, 0, 0.625, 0, 'y', DARK);
    d.tube(M, 0.14, 0.06, 0, 0.03, 0, 'y', DARK);
    d.box(M, 0.24, 0.2, 0.5, 0, 1.36, 0.05, 0x8a9198, { rx: -0.12 });
    for (const sx of [-0.07, 0.07]) d.tube(M, 0.05, 0.08, sx, 1.38, -0.22, 'z', 0x15171a, { rx: -0.12 });
    k.block(x, 112.2, 0.3, 0.5);
  }
  // Read by someone in the gallery walking back to the corridor (facing -z).
  wallSign(k, s, 0, 3.75, 96.06, 0, 7, 0.55, ['↑ RING CORRIDOR · OPERATIONS · BLAUWE BLOME · DOCKING BAY 7'], '#e08a4a');
  wallSign(k, s, -11, 1.9, 96.03, 0, 3, 0.6, ['YARD GALLERY', 'RING A · SEC 10 · DECK 2'], '#4a5862', CLEAR);
  bin(k, d, -18.9, 97.2, 0x8a9198, 0.1);
  bin(k, d, 18.9, 97.2, 0x8a9198, 0.1);
}

// ------------------------------------------------------------------ Ceres

export function dressCeres(k: Site, d: Dress, s: Signs, W: number, Z0: number, Z1: number, planters: [number, number, number][]) {
  const PALE = '#d8d0c0';

  // Dock 14: a marked berth, a catwalk, drums and sacks, and rails funnelling people to customs.
  d.group('Dock 14');
  strip(k, d, -16, 2.9, 16, 2.9, 0.45, CELL.hazard, 0xffffff, 0.85);
  hazardBox(k, d, -5.6, 3.8, 5.6, 29.3, 1.7, 0.8);
  chevrons(k, d, 0, 33.4, 0, 39, 0xe8e0c8, 0.45, 1.9, 1.0);
  for (const [x, z, sz] of [[-2, 9, 4], [2.6, 19, 4.6], [-1.2, 24.5, 3.4], [-12, 12, 3.4], [12.5, 26, 3.6], [8, 34, 3], [-9, 30, 2.8]]) d.decal(k.frame(x, 0, z, x * 2), sz, sz * 0.85, 0, 0.024, 0, CELL.oil, 0x080604, 0.65, { flat: true });
  catwalk(k, d, -18, 4, 36, 5, 1, { ladder: 35.4, color: 0x6a5a4a });
  drums(k, d, -9.5, 38.9, 4);
  drums(k, d, 10, 38.9, 3);
  stack(k, d, 16.2, 22.5, { sacks: true, cols: [0x9a8a6a, 0x8a7a5a, 0xa89878] });
  stack(k, d, -16.2, 14.5, { n: 4 });
  cart(k, d, 7.5, 12, 0.2, 0x7a6a3a);
  hose(k, d, [[13.4, 12.6], [10, 14.5], [6, 13.2], [3.1, 15]], 0x1c1f22, 0.06);
  rail(k, d, -1.9, 34.8, -1.9, 39.2, { color: 0x8a7a3a });
  rail(k, d, 1.9, 34.8, 1.9, 39.2, { color: 0x8a7a3a });
  // Read by someone in the dock walking to the tunnel (facing +z).
  wallSign(k, s, 0, 4.5, 39.94, PI, 9.5, 1.15, ['↑ CUSTOMS · THE MEDINA MARKET', 'TUBE · BLUE FROG · STAR HELIX · THE CONCOURSE'], '#ffb347');
  wallSign(k, s, -17.96, 2.1, 37.6, PI / 2, 3, 0.62, ['LEVEL 1 · DOCKS', 'SEC 14 · SPINWARD'], PALE, CLEAR);

  // Customs tunnel: a scanner arch to walk through, a line to wait behind and a desk.
  d.group('Customs tunnel');
  {
    const M = k.frame(0, 0, 45);
    for (const sx of [-2.02, 2.02]) {
      d.box(M, 0.26, 2.72, 0.3, sx, 1.36, 0, 0x3a3f46);
      d.box(M, 0.03, 2.2, 0.08, sx - Math.sign(sx) * 0.14, 1.3, 0, 0x2df0ff, { glow: 1.3 });
      k.block(sx, 45, 0.26, 0.3);
    }
    d.box(M, 4.3, 0.24, 0.3, 0, 2.66, 0, 0x3a3f46);
    d.box(M, 0.08, 0.08, 0.04, 1.7, 2.66, -0.16, 0x4dff9a, { glow: 1.6 });
    // Front: arriving from the dock (facing +z). Back: leaving for the dock.
    s.add(k.frame(0, 2.66, 45, PI).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.152)), 3, 0.2, ['CERES CUSTOMS · WALK THROUGH · DO NOT STOP'], '#8fdcff', 'rgba(4,14,22,0.95)');
    s.add(k.frame(0, 2.66, 45, 0).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.152)), 3, 0.2, ['↑ DOCK 14 · DEPARTURES'], '#ffb347', 'rgba(4,14,22,0.95)');
    strip(k, d, -1.9, 43.4, 1.9, 43.4, 0.5, CELL.line, HAZ, 0.8, { per: 1.5 });
    floorSign(k, s, 0, 42.8, PI, 3.2, 0.36, ['WAIT BEHIND THE LINE'], 'rgba(217,165,20,0.75)');
    // The desk, against the east wall.
    const D = k.frame(1.78, 0, 54.6);
    d.box(D, 0.7, 1.05, 1.9, 0, 0.525, 0, 0x3a342e);
    d.box(D, 0.76, 0.05, 1.96, 0, 1.07, 0, 0x2a2622);
    d.box(D, 0.04, 0.36, 0.5, -0.2, 1.3, 0.3, 0x15171a);
    d.box(D, 0.01, 0.3, 0.44, -0.225, 1.3, 0.3, 0x7fe0ff, { glow: 1.2 });
    k.block(1.78, 54.6, 0.7, 1.9);
  }
  // Facing the west wall, the market (+z) is to your left.
  wallSign(k, s, -2.47, 1.95, 56.4, PI / 2, 2.6, 0.55, ['LEVEL 2 · CUSTOMS', '← THE MEDINA · DOCK 14 →'], PALE, CLEAR);

  // The Medina: a directory in the middle, signs over every way out, bins, sacks, and the
  // mess a market makes.
  d.group('The Medina');
  totem(k, d, s, [[0, 88], [1.6, 87.2], [-1.6, 89], [0, 90.6], [2.2, 80], [-2, 79]], [
    // Each face is read by someone looking the other way; left and right are theirs.
    [PI, ['LEVEL 3', '↑ HYDROPONICS', '↑ CONCOURSE', 'TUBE →', '← BLUE FROG', '← STAR HELIX']],
    [0, ['LEVEL 3', '↑ CUSTOMS', '↑ DOCK 14', '← TUBE', 'BLUE FROG →', 'STAR HELIX →']],
    [PI / 2, ['LEVEL 3', '↑ TUBE', '← HYDROPONICS', '← CONCOURSE', 'DOCK 14 →']],
    [-PI / 2, ['LEVEL 3', '↑ BLUE FROG', '↑ STAR HELIX', 'CONCOURSE →', '← DOCK 14']],
  ], { w: 0.9 });
  wallSign(k, s, 0, 3.56, 103.93, PI, 5.6, 0.5, ['↑ HYDROPONICS · THE CONCOURSE · HOMES'], '#7fe0a0');
  wallSign(k, s, 0, 3.56, 60.07, 0, 5.6, 0.5, ['↑ CUSTOMS · DOCK 14 · ALL SHIPS'], '#ffb347');
  wallSign(k, s, -21.93, 3.62, 80, PI / 2, 4.6, 0.5, ['↑ TUBE · ALL DISTRICTS'], '#dfe8f2');
  wallSign(k, s, 21.93, 3.56, 71, -PI / 2, 3.4, 0.45, ['↑ THE BLUE FROG · BAR'], '#6fa8ff');
  wallSign(k, s, 21.93, 3.56, 93, -PI / 2, 3.4, 0.45, ['↑ STAR HELIX · SECURITY'], '#dfe8f2');
  wallSign(k, s, -21.95, 2.0, 88.5, PI / 2, 3, 0.6, ['LEVEL 3 · SEC 14-C'], PALE, CLEAR);
  wallSign(k, s, 21.95, 2.0, 84.5, -PI / 2, 3, 0.6, ['LEVEL 3 · SEC 14-D'], PALE, CLEAR);
  for (const [x, z] of [[-17.5, 69.5], [17.6, 69.2], [-2.6, 74.4], [9.4, 86.4], [-11.2, 94.6], [17.2, 95.4], [-17.2, 87.4], [3.4, 101.6], [-19.6, 76.2], [19.6, 88.6], [-6, 62], [8, 62.2]]) bin(k, d, x, z, 0x55504a, 0.85);
  // Sacks and boxes of stock beside the stalls.
  const stalls: [number, number][] = [[-15, 66], [-15, 96], [15, 66], [-5, 76], [6, 84], [-8, 92], [14, 98], [-14, 84]];
  stalls.forEach(([x, z], i) => stack(k, d, x + (i % 2 ? 2.9 : -2.9), z - 0.5, { n: 2 + (i % 2), sacks: i % 3 === 0, need: 0.85, cols: [0x8a7a5a, 0x7a5a3a, 0x9a8a6a, 0x55634a] }));
  // Damp patches under the pipes that cross the ceiling, and leaves under the tree.
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) d.decal(k.frame(-18 + k.w() * 36, 0, 64 + i * 9 + (k.w() - 0.5)), 3 + k.w() * 3, 1.6, 0, 0.023, 0, CELL.blotch, 0x0c0a08, 0.45, { flat: true });
  for (let i = 0; i < 5; i++) d.decal(k.frame(Math.cos(i * 1.3) * 3, 0, 70 + Math.sin(i * 1.3) * 3, i), 1.8, 1.8, 0, 0.025, 0, CELL.litter, 0x7a8a4a, 0.8, { flat: true });

  // Tube station: a line and a rail at the platform edge, a route map, bins.
  d.group('Tube station');
  strip(k, d, -45, 83.5, -23, 83.5, 0.5, CELL.line, HAZ, 0.9, { per: 2 });
  floorSign(k, s, -34, 82.7, PI, 9, 0.42, ['MIND THE SPIN · STAND BEHIND THE LINE'], 'rgba(217,165,20,0.75)');
  // (The floor beyond the edge is already out of bounds, so these rails need no block of their own.)
  for (const [a, b] of [[-45.4, -41.6], [-38.6, -35.4], [-32.6, -29.4], [-26.4, -23]]) rail(k, d, a, 84.2, b, 84.2, { solid: false, color: 0x8a7a3a, kick: 0.1 });
  wallSign(k, s, -34, 2.4, 72.07, 0, 9.6, 0.5, ['DOCKS ●━━ THE MEDINA ◉ ━━● GOVERNOR\'S QUARTER ━━● ROSSE BUURT'], '#dfe8f2', 'rgba(6,8,12,0.9)');
  wallSign(k, s, -22.07, 3.62, 80, -PI / 2, 4.6, 0.5, ['↑ THE MEDINA · DOCKS · CONCOURSE'], '#ffd9a0');
  wallSign(k, s, -45.95, 2.0, 77, PI / 2, 3, 0.6, ['LEVEL 3 · TUBE', 'SEC 14-B'], PALE, CLEAR);
  bin(k, d, -23.4, 73.2, 0x55504a, 0.7);
  bin(k, d, -44.6, 82.4, 0x55504a, 0.7);
  bin(k, d, -30, 73.2, 0x55504a, 0.5);

  d.group('The Blue Frog');
  for (const [x, z] of [[27, 65], [27, 71], [27, 77], [33, 68], [33, 75], [38, 70]]) d.decal(k.frame(x, 0, z, x), 2.6, 2.6, 0, 0.024, 0, CELL.blotch, 0x0c0808, 0.5, { flat: true });
  stack(k, d, 40.6, 64.2, { n: 2, need: 0.7, cols: [0x4a4a6a, 0x5a4a3a] });
  bin(k, d, 23.2, 79, 0x3a3648, 0.8);

  d.group('Star Helix station house');
  d.decal(k.frame(22.02, 1.7, 99.9, PI / 2), 1.3, 1.3, 0, 0, 0, CELL.posters, 0xffffff, 0.95);
  d.decal(k.frame(22.02, 1.7, 86.3, PI / 2), 1.3, 1.3, 0, 0, 0, CELL.posters, 0xffffff, 0.95);
  bin(k, d, 23, 100.9, 0x6a7078, 0.3);

  // Hydroponics: wet floor along the racks, hoses from the tanks.
  d.group('Hydroponics');
  for (let row = 0; row < 4; row++) for (let j = 0; j < 4; j++) d.decal(k.frame(-10.5 + row * 7 + (k.w() - 0.5) * 2, 0, 111 + j * 4.6 + k.w(), PI / 2), 4, 2.2, 0, 0.023, 0, CELL.blotch, 0x0a0c0a, 0.5, { flat: true });
  for (const sx of [-1, 1]) {
    hose(k, d, [[sx * 12.1, 126.2], [sx * 9.4, 127.9], [sx * 6.4, 127], [sx * 4.8, 124.4], [sx * 5.2, 121]], 0x2f6f4f);
    d.tube(k.frame(sx * 13.5, 0, 127), 0.09, 1.5, 0, 5.25, 0, 'y', 0x4a6a8a, { high: true });
  }
  wallSign(k, s, 0, 3.56, 129.93, PI, 6, 0.5, ['↑ THE CONCOURSE · HOMES · SCHOOL 14 · CLINIC'], '#dfeeff');
  wallSign(k, s, 0, 3.56, 104.07, 0, 5, 0.5, ['↑ THE MEDINA · TUBE · DOCKS'], '#ffd9a0');

  // The Concourse: a clean street, so only what people leave: paths worn along both sides, a
  // little dirt along the gutter, bins by the planters and a directory every sixty metres.
  d.group('The Concourse');
  for (const sx of [-1, 1]) strip(k, d, sx * 2.7, Z0 + 0.8, sx * 2.7, Z1 - 3, 2.6, CELL.path, 0x353a40, 0.2, { per: 5 });
  for (let z = Z0 + 6; z < Z1 - 6; z += 7 + k.w() * 6) d.decal(k.frame((k.w() - 0.5) * 1.2, 0, z, k.w() * 6), 1.6 + k.w() * 2, 1.2 + k.w(), 0, 0.024, 0, CELL.blotch, 0x1a1c1e, 0.3, { flat: true });
  planters.forEach(([px, pz, pl], i) => {
    if (i % 2 === 0) bin(k, d, px, pz - pl / 2 - 0.65, 0x8a9298, 0.2);
    d.decal(k.frame(px - Math.sign(px) * 0.95, 0, pz, PI / 2), pl, 1.0, 0, 0.024, 0, CELL.blotch, 0x2a2418, 0.3, { flat: true });
  });
  // Front: walking away from the entrance (facing +z). Back: walking home towards it.
  const len = Z1 - Z0;
  for (const off of [6.5, 62, 122, 171]) {
    const here = Math.round(off / 10) * 10;
    // The first stands to one side of the way in; the rest stand in the gutter down the middle.
    const spots: [number, number][] = off < 10 ? [[5.7, Z0 + off], [-5.7, Z0 + off + 1]] : [[0, Z0 + off], [0.3, Z0 + off + 2.5], [-0.3, Z0 + off - 2.5], [0, Z0 + off + 5]];
    totem(k, d, s, spots, [
      [PI, ['THE CONCOURSE', 'LEVEL 3 · SPINWARD', `↑ HOMES ${14 + Math.round(off / 12)}–88`, off < 100 ? '↑ SCHOOL 14 · CLINIC' : '↑ PARK END', `↓ MARKET ${here + 30} m`]],
      [0, ['THE CONCOURSE', 'LEVEL 3', `↑ MARKET ${here + 30} m`, '↑ TUBE · DOCKS', `↓ STREET END ${Math.round((len - off) / 10) * 10} m`]],
    ], { w: 0.95, thick: 0.14, h: 1.3, tall: 2.5, color: '#e6f2ff', bg: 'rgba(28,40,52,0.96)', body: 0x8e989e, cap: 0x9fe0ff });
  }
}

// --------------------------------------------------------------- Ganymede

export function dressGanymede(k: Site, d: Dress, s: Signs) {
  d.group('dome');
  const WARM = 0xffe2b0, SOIL = 0x33241a;

  // The pad: warning stripes round its edge, scorching under the ship, soil trodden onto the deck.
  const PX = 0, PZ = 38, PR = 14.6;
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * PI * 2;
    d.decal(k.frame(PX + PR * Math.cos(a), 0, PZ + PR * Math.sin(a), Math.atan2(-Math.cos(a), -Math.sin(a))), (PI * 2 * PR) / 32, 0.62, 0, 0.05, 0, CELL.hazard, 0xffffff, 0.85, { flat: true, ru: 6 });
  }
  d.decal(k.frame(0, 0, 31), 9, 12, 0, 0.045, 0, CELL.oil, 0x070605, 0.55, { flat: true });
  for (const [x, z, sz] of [[-2.5, 25.5, 4], [2.2, 24.6, 3.4], [0.4, 27.6, 3], [-6, 28, 3], [5, 44, 3.6], [8.6, 47.6, 3]]) d.decal(k.frame(x, 0, z, x), sz, sz, 0, 0.046, 0, CELL.blotch, SOIL, 0.7, { flat: true });
  // The path down the middle, packed hard by feet and wheels.
  strip(k, d, 0, 22.6, 0, -53, 3.6, CELL.path, 0x1e150e, 0.4, { per: 7 });

  // Low lights down both sides of the path, and the irrigation mains beside them with a
  // valve at every few rows.
  for (let z = 17.4, i = 0; z > -52; z -= 4.8, i++) {
    for (const sx of [-1, 1]) {
      const M = k.frame(sx * 2.3, 0, z);
      if (i % 2 === 0) { d.box(M, 0.12, 0.62, 0.12, 0, 0.31, 0, DARK); d.box(M, 0.15, 0.09, 0.15, 0, 0.66, 0, WARM, { glow: 1.5 }); }
      d.tube(M, 0.07, 4.8, sx * 0.42, 0.12, 0, 'z', 0x3f6f8a);
      d.tube(M, 0.03, 0.5, sx * 0.42, 0.36, 1.2, 'y', 0x3f6f8a);
      d.box(M, 0.22, 0.05, 0.05, sx * 0.42, 0.63, 1.2, 0xb8483a);
      d.decal(M, 1.4, 1.4, sx * 0.5, 0.024, 1.2, CELL.blotch, 0x120c08, 0.55, { flat: true });
    }
    // Row numbers on stakes, read from the path.
    if (i % 3 === 0) for (const sx of [-1, 1]) {
      d.box(k.frame(sx * 2.42, 0, z + 2.4), 0.04, 0.5, 0.04, 0, 0.25, 0, 0x8a7a64);
      wallSign(k, s, sx * 2.42 - sx * 0.03, 0.6, z + 2.4, -sx * PI / 2, 0.42, 0.22, [`ROW ${String(Math.max(1, 31 - Math.round((z + 54.4) / 2.4))).padStart(2, '0')}`], '#e8e0c8', 'rgba(40,50,36,0.95)');
    }
  }

  // A gate where the path leaves the pad, with strings of lights off to the hut and the tanks.
  const gz = [20.6, 19.7, 21.4].find((z) => k.clear(-3.4, z, 0.45) && k.clear(3.4, z, 0.45));
  if (gz !== undefined) {
    const M = k.frame(0, 0, gz);
    for (const sx of [-3.4, 3.4]) { d.tube(M, 0.08, 3.5, sx, 1.75, 0, 'y', 0x8a9198); d.tube(M, 0.16, 0.2, sx, 0.1, 0, 'y', DARK); k.block(sx, gz, 0.25, 0.25); }
    d.box(M, 7, 0.5, 0.1, 0, 3.3, 0, 0x2a3a30);
    // Front: coming off the pad (facing -z). Back: coming in from the fields.
    s.add(k.frame(0, 3.3, gz, 0).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.052)), 6.8, 0.44, ['DOME 7 · FIELD ROWS 01–30 · FAR AIRLOCK'], '#7fe0a0', 'rgba(4,14,8,0.92)');
    s.add(k.frame(0, 3.3, gz, PI).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.052)), 6.8, 0.44, ['LANDING PAD · ← TANKS · CONTROL →'], '#7fe0a0', 'rgba(4,14,8,0.92)');
    const COLS = [WARM, 0xffb060, WARM, 0x9fe0b0, WARM, 0xff9ab0];
    lampPost(k, d, -14, 21.6, 3.7, WARM, { solid: k.clear(-14, 21.6, 0.5) });
    lampPost(k, d, 14.5, 21.8, 3.7, WARM, { solid: k.clear(14.5, 21.8, 0.5) });
    lights(k, d, [-3.4, 3.5, gz], [-14, 3.7, 21.6], COLS);
    lights(k, d, [-14, 3.7, 21.6], [-25.6, 3.7, 24.2], COLS);
    lights(k, d, [3.4, 3.5, gz], [14.5, 3.7, 21.8], COLS);
    lights(k, d, [14.5, 3.7, 21.8], [24.4, 5.6, 25], COLS);
    lights(k, d, [-3.4, 3.5, gz], [3.4, 3.5, gz], COLS, { sag: 0.25 });
  }
  // A low fence between the pad and the first rows.
  rail(k, d, -13, 22.9, -5.9, 22.9, { color: 0x8a9198, h: 0.95 });
  rail(k, d, 5.9, 22.9, 13, 22.9, { color: 0x8a9198, h: 0.95 });
  // Read coming off the pad (facing -z): the tanks are to the right, the hut to the left.
  post(k, d, s, 7.8, 24.6, 0, [['WATER TANKS', 'r', '#9fe0ff'], ['CONTROL · AIRLOCK', 'l', '#7fe0a0']], { h: 2.7, lamp: WARM, w: 1.9 });

  // The control hut: lit windows, a door with a lamp over it, a mast with a beacon.
  {
    const M = k.frame(-30, 0, 27);
    for (const x of [-2.6, 0, 2.6]) { d.box(M, 1.4, 0.95, 0.05, x, 2.05, 3.01, DARK); d.box(M, 1.25, 0.8, 0.05, x, 2.05, 3.03, 0xffe2a8, { glow: 1.25 }); }
    d.box(M, 0.06, 2.15, 1.05, 4.52, 1.08, -1.2, 0x2a3036);
    d.box(M, 0.05, 0.8, 1.0, 4.52, 2.05, 1.2, DARK); d.box(M, 0.05, 0.66, 0.86, 4.54, 2.05, 1.2, 0xffe2a8, { glow: 1.25 });
    d.box(M, 0.2, 0.1, 0.3, 4.62, 2.5, -1.2, WARM, { glow: 1.6 });
    d.tube(M, 0.035, 3, -3.4, 5.4, -2, 'y', 0x8a9198);
    d.ball(M, 0.1, 0.1, 0.1, -3.4, 6.95, -2, 0xff4a3a, { glow: 1.8 });
    d.box(M, 0.9, 0.5, 0.7, 2.6, 4.15, 1.4, 0x8a9198);
    d.decal(k.frame(-25.4, 0, 25.8, 0), 3, 3, 0, 0.024, 0, CELL.path, SOIL, 0.6, { flat: true });
  }
  // The tanks: a beacon on each, a pipe joining them, damp soil at their feet.
  for (const x of [26, 31, 36]) {
    const M = k.frame(x, 0, 26);
    d.ball(M, 0.1, 0.1, 0.1, 0, 6.12, 0, 0xff4a3a, { glow: 1.8 });
    d.tube(M, 0.03, 0.14, 0, 6.05, 0, 'y', DARK);
    if (x < 36) d.tube(M, 0.09, 5, 2.5, 0.45, 2.15, 'x', 0x3f6f8a);
    d.tube(M, 0.09, 0.5, 0, 0.45, 2.05, 'z', 0x3f6f8a);
    d.decal(M, 5, 3, 0, 0.024, 2.6, CELL.blotch, 0x120c08, 0.6, { flat: true });
  }

  // A stand selling what the dome grows, and the crates it came in.
  if (!stand(k, d, s, 16.5, 19.4, 0, 'DOME 7 PRODUCE', 0xb8483a, 0xe8e0c8)) stand(k, d, s, -16.5, 19.6, 0, 'DOME 7 PRODUCE', 0xb8483a, 0xe8e0c8);
  const CRATE = [0x8a6a48, 0x7a6248, 0x9a7a52, 0x6a8a4a];
  stack(k, d, 7.4, 19.6, { n: 3, cols: CRATE, need: 0.9 });
  stack(k, d, -8, 19.8, { n: 2, cols: CRATE, sacks: true, need: 0.9 });
  stack(k, d, 20.6, 19.8, { n: 2, cols: CRATE, need: 0.9 });
  // In the gaps between rows (the rows are 2.4 m apart; the gaps fall half way).
  for (const [x, z] of [[4.4, -19.6], [-4.6, -34], [5, 8.8], [-4.4, -7.6], [4.6, -43.6]]) stack(k, d, x, z, { n: 2, cols: CRATE, need: 0.45, sacks: x < 0 });
  // A barrow left in a gap.
  if (k.clear(-4.6, 9, 0.5)) {
    const M = k.frame(-4.6, 0, 9, 0.5);
    d.box(M, 0.7, 0.3, 1.0, 0, 0.5, 0, 0x4a6a4a, { rx: 0.12 });
    d.tube(M, 0.2, 0.08, 0, 0.2, -0.62, 'x', 0x15171a);
    for (const sx of [-0.3, 0.3]) { d.bar(M, 0.02, [sx, 0.42, 0.3], [sx, 0.6, 1.15], 0x8a7a64); d.tube(M, 0.02, 0.4, sx, 0.2, 0.42, 'y', 0x8a7a64); }
    k.block(-4.6, 9, 0.8, 1.2);
  }

  // Small lights all round the foot of the dome.
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * PI * 2 + 0.03;
    d.box(k.frame(Math.cos(a) * 59.1, 0, Math.sin(a) * 59.1, -a), 0.12, 0.12, 0.3, 0, 1.25, 0, i % 4 ? 0xcfe8ff : WARM, { glow: 1.5 });
  }
}

// ----------------------------------------------------------------- Medina

/** A building the drum's town was given: where, how big, and which cluster it belongs to. */
export interface Built { x: number; z: number; w: number; d: number; h: number; town: number }

export function dressMedina(k: Site, d: Dress, s: Signs, built: Built[], C: number) {
  const WARM = 0xffe2b0, WOOD = 0x8a6a4a;
  const COLS = [WARM, 0xff9a6a, WARM, 0x9fe0b0, WARM, 0xffd24a, WARM, 0x8fc8ff];

  // The street from the lift: a beaten path, lamp posts, strings of lights and market stands.
  d.group('bow');
  strip(k, d, 0, -444.5, 0, -372, 4.6, CELL.path, 0xcdbb94, 0.6, { per: 7 });
  const zs: number[] = [];
  for (let z = -439; z <= -377; z += 12.4) zs.push(z);
  zs.forEach((z, i) => {
    for (const sx of [-1, 1]) lampPost(k, d, sx * 3.3, z, 4.2, WARM, { arm: 0.7, yaw: sx > 0 ? PI : 0, glow: 1.35, solid: k.clear(sx * 3.3, z, 0.5) });
    // The strings cross the street from post to post, as far as the market goes.
    if (i < 4) {
      lights(k, d, [-3.3, 4.2, z], [3.3, 4.2, zs[i + 1]], COLS, { every: 0.8 });
      lights(k, d, [3.3, 4.2, z], [-3.3, 4.2, zs[i + 1]], COLS, { every: 0.8 });
    }
  });
  const STANDS: [number, string, number, number][] = [[-431, 'ORCHARD FRUIT', 0xb8483a, 0xe8e0c8], [-424.6, 'BREAD · DRUM-MILLED', 0x3f6f8a, 0xe8e0c8], [-418.4, 'TEA & HONEY', 0x5f8f4a, 0xe8d9a0], [-412, 'SEED EXCHANGE', 0xc8862a, 0xe8e0c8], [-405, 'CIDER PRESS', 0x7a4a6a, 0xe8e0c8], [-398, 'TOOLS · MENDING', 0x55606a, 0xd8c890]];
  STANDS.forEach(([z, name, c1, c2], i) => { const sx = i % 2 ? 1 : -1; stand(k, d, s, sx * 7, z, sx > 0 ? -PI / 2 : PI / 2, name, c1, c2); });
  // Cargo that came down the lift.
  stack(k, d, 5.6, -447.4, { n: 4 });
  stack(k, d, -5.8, -447.2, { n: 3, sacks: true, cols: [0x9a8a6a, 0x8a7a5a, 0xa89878] });
  drums(k, d, -7.4, -444.2, 3, 'z');
  // The directory by the lift. Front: stepping out of the lift (facing +z, spinward on your left).
  totem(k, d, s, [[-3.8, -441.4], [3.8, -441.4], [-4.6, -439.6]], [
    [PI, ['MEDINA · BOW', '↑ MARKET STREET', '↑ FARMS · MID-DRUM', '← SPINWARD', 'ANTISPINWARD →']],
    [0, ['MEDINA · BOW', '↑ LIFT TO DOCKS', '↑ COMMAND', 'SPINWARD →', '← ANTISPINWARD']],
  ], { w: 1.0, thick: 0.16, h: 1.35, tall: 2.7, color: '#ffe9c0', bg: 'rgba(40,30,20,0.95)', body: 0x6a5a48, cap: WARM });
  // Post-and-rail fences where the street runs out into the fields.
  for (const sx of [-1, 1]) { rail(k, d, sx * 5.2, -392, sx * 5.2, -382.5, { color: WOOD, h: 0.95 }); rail(k, d, sx * 5.2, -380.5, sx * 5.2, -372, { color: WOOD, h: 0.95 }); }

  // Every building in the drum: a door, a lamp over it, and a path worn to the step.
  d.group('towns');
  for (const b of built) {
    const face = Math.floor(k.w() * 4), yaw = face * PI / 2, half = (face % 2 ? b.w : b.d) / 2, across = (face % 2 ? b.d : b.w) * (k.w() - 0.5) * 0.5;
    const M = k.frame(b.x, 0, b.z, yaw);
    d.box(M, 1.0, 2.1, 0.08, across, 1.05, half + 0.02, [0x5a4632, 0x3f5a6a, 0x6a3a32, 0x4a5a42][Math.floor(k.w() * 4)]);
    d.box(M, 1.5, 0.08, 0.7, across, 2.3, half + 0.3, 0x7a6a5a);
    d.ball(M, 0.11, 0.14, 0.11, across + 0.75, 2.0, half + 0.14, WARM, { glow: 1.5 });
    d.decal(M, 1.8, 2.4, across, 0.05, half + 1.2, CELL.path, 0xcdbb94, 0.55, { flat: true });
    if (k.w() < 0.5) d.box(M, 0.9, 0.5, 0.45, across - 1.4, 0.25, half + 0.3, 0x7a6248);
  }

  // A signpost and a lamp at each of the other places you can be put down. The boards point
  // along the drum: read facing spinward (+x), the bow is on your left.
  const WAY: [number, number, string, string][] = [[63.5, 3, 'MID-DRUM', '440 m'], [C / 2 + 3.5, -197, 'FAR SIDE', '240 m'], [-36.5, 437, 'STERN', '880 m']];
  WAY.forEach(([x, z, name, far], i) => {
    post(k, d, s, x, z, -PI / 2, [[`BOW LIFT ${far}`, 'l'], [i === 2 ? 'ENGINEERING' : 'STERN', 'r'], [name, 'r', '#9fe0ff']], { h: 3.1, lamp: WARM, w: 2 });
    stack(k, d, x + 1.6, z + 2.6, { n: 2, need: 0.8, cols: [0x8a6a48, 0x7a6248] });
  });
}
