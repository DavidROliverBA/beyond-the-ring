// Spin gravity on foot. A station that makes its gravity by turning is a rotating room, and
// two things follow for anyone walking in it. Our own design; the sums are the real ones.
//
// 1. Weight depends on which way you run. You are held to the floor only because you go round
//    with it. Run the way the station turns ("spinward") and you go round faster, so you are
//    heavier; run against it and you are lighter. Run against it as fast as the floor itself
//    moves and you would weigh nothing. Walking along the axis changes nothing.
// 2. Anything that leaves the floor is carried sideways. Each stride is a small hop, and a hop
//    lands a little spinward of where a straight line would put it. On the floor itself there
//    is no sideways push at all: the pull is only up or down.
//
// The first is large in a small drum (Medina's floor moves at about 29 m/s, and you can run at
// 18) and far too small to feel on Ceres, which is 470 km in radius. The second is millimetres
// a stride everywhere. So two things are turned up for show, and `?spin=real` in the address
// turns them back down to the true figures: Ceres is felt as if it were a much smaller wheel
// (`feelR`), and the sideways carry is multiplied by DRIFT_SHOW. `?spin=off` removes it all.

/** How a place spins. The floor plan is flat (or a drum); spinward is a direction on it. */
export interface Spin {
  /** Metres from the spin axis to the floor. */
  R: number;
  /** Gravity standing still on the floor, in Earth gravities. */
  g: number;
  /** The radius used for what you feel; the same as R unless the truth is too faint to notice. */
  feelR: number;
  /** Which way the floor is moving, as a unit direction on the floor plan. */
  sx: number;
  sz: number;
}

const mode = new URLSearchParams(globalThis.location?.search ?? '').get('spin');
/** False with `?spin=off`: walking is as it was before any of this. */
export const SPIN_ON = mode !== 'off';
/** True with `?spin=real`: nothing turned up for show. */
export const SPIN_REAL = mode === 'real';
/** How many times the true sideways carry of a stride is shown. */
const DRIFT_SHOW = SPIN_REAL ? 1 : 25;
/** How much of each hop the eyes follow: the neck and knees soak up the rest. */
const HEAD_SHARE = 0.5;
/** The foot is on the floor this long between hops, seconds. */
const CONTACT = 0.25;

export interface Feel {
  /** Your weight now against your weight standing still (1 = no change). */
  weight: number;
  /** Seconds from one footfall to the next. */
  step: number;
  /** How far the eyes rise at the top of a stride, metres. */
  rise: number;
  /** Speed at which strides carry you spinward, metres a second. */
  drift: number;
}

/** What spin does to someone moving over the floor at (vx, vz) metres a second. */
export function feel(s: Spin, vx: number, vz: number): Feel {
  const R = SPIN_REAL ? s.R : s.feelR, g0 = s.g * 9.81;
  // How fast the floor itself is going round, and how fast you are going round with it.
  const rim = Math.sqrt(g0 * R);
  const round = Math.max(0.28 * rim, rim + vx * s.sx + vz * s.sz);
  // Weight goes as the square of that. (The floor of 0.28 keeps a little weight on your feet
  // however fast you run against the spin, so there is always something to push off.)
  const weight = Math.min(3, (round * round) / (rim * rim));
  const speed = Math.hypot(vx, vz);
  // Each stride is a hop: higher the faster you go, and it lasts longer the less you weigh.
  const hop = Math.min(0.16, 0.006 * speed * speed);
  const g = g0 * weight;
  const step = Math.sqrt((8 * hop) / g) + CONTACT;
  // Seen from outside, a hop is a straight line across a corner of the circle while the floor
  // goes round the arc. The line is the shorter way, so you land ahead of where you left.
  // Only a run has both feet off the floor: a walk always has one down, and is not carried.
  const air = Math.min(1, Math.max(0, (speed - 4.5) / 3.5));
  const up = Math.sqrt(2 * g * hop) * air * air * (3 - 2 * air);
  const a = 2 * Math.atan2(up, round);
  const drift = (DRIFT_SHOW * R * (a - Math.sin(a))) / step;
  return { weight, step, rise: hop * HEAD_SHARE, drift };
}
