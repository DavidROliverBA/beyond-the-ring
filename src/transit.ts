// Honest flip-and-burn timing (BACKLOG E3.1.d): push at constant acceleration for the first part of the
// trip, turn the ship end for end with the drive off (the flip), then push the other way to stop at the
// target. Pure maths in SI units, no three.js, so the scenario engine, the map and the tests share it.
//
// This is physics, not presentation: it is NOT src/course.ts planTrip, which fixes a watchable duration and
// derives an acceleration. Here the acceleration is the input and the time is the answer.
//
// With a burn time `tb` at acceleration `a`, a flip of `f` seconds coasting at the peak speed `v = a tb`:
//   distance D = a tb^2 + a tb f   =>   tb = (-f + sqrt(f^2 + 4 D / a)) / 2,   time T = 2 tb + f.
// With f = 0 this is the classic brachistochrone T = 2 sqrt(D / a), peak speed sqrt(a D), at the half-way point.

export const G0 = 9.80665;          // standard gravity, m/s^2
export const AU = 1.495978707e11;   // metres
export const DAY = 86400;           // seconds

export interface Transit {
  distance: number;      // m
  accel: number;         // m/s^2 during each burn
  flip: number;          // s, drive off, turning
  /** Seconds of each burn. */
  burn: number;
  /** Whole trip, seconds. */
  time: number;
  /** Speed at the flip, m/s. */
  peakSpeed: number;
  /** Time the first burn ends and the flip begins, s. */
  flipStart: number;
  /** Time the flip ends and the braking burn begins, s. */
  flipEnd: number;
  /** Distance along the line when the flip begins and ends, m. */
  flipAtDistance: number;
  flipEndDistance: number;
}

export interface TransitState {
  /** Distance travelled along the line, m. */
  s: number;
  /** Speed, m/s (never negative: the ship does not reverse). */
  v: number;
  /** 'accelerate' | 'flip' | 'decelerate' | 'rest' (before the start or after arrival). */
  phase: 'rest' | 'accelerate' | 'flip' | 'decelerate';
  /** Is the drive burning? */
  thrust: boolean;
}

/** Rest-to-rest transit of `distance` metres at `accel` m/s^2, with `flip` seconds of drive-off turning in the middle. */
export function transit(distance: number, accel: number, flip = 0): Transit {
  if (!(distance >= 0) || !(accel > 0) || !(flip >= 0)) throw new RangeError('transit needs distance >= 0, accel > 0, flip >= 0');
  const burn = (-flip + Math.sqrt(flip * flip + (4 * distance) / accel)) / 2;
  const peakSpeed = accel * burn;
  const flipAtDistance = 0.5 * accel * burn * burn;
  return { distance, accel, flip, burn, time: 2 * burn + flip, peakSpeed, flipStart: burn, flipEnd: burn + flip,
    flipAtDistance, flipEndDistance: flipAtDistance + peakSpeed * flip };
}

/** Where the ship is `t` seconds after the start. Exact at every phase boundary, clamped to rest at the ends. */
export function transitAt(tr: Transit, t: number): TransitState {
  const { accel: a, burn: tb, flip: f, distance: D, peakSpeed: vm } = tr;
  if (t <= 0) return { s: 0, v: 0, phase: 'rest', thrust: false };
  if (t < tb) return { s: 0.5 * a * t * t, v: a * t, phase: 'accelerate', thrust: true };
  if (t < tb + f) return { s: tr.flipAtDistance + vm * (t - tb), v: vm, phase: 'flip', thrust: false };
  if (t < tr.time) { const r = tr.time - t; return { s: D - 0.5 * a * r * r, v: a * r, phase: 'decelerate', thrust: true }; }
  return { s: D, v: 0, phase: 'rest', thrust: false };
}

/** Convenience for the common case: distance in AU, acceleration in g, result in days and km/s. */
export function transitAU(au: number, g: number, flipSecs = 0): { days: number; peakKms: number; flipDays: number } {
  const tr = transit(au * AU, g * G0, flipSecs);
  return { days: tr.time / DAY, peakKms: tr.peakSpeed / 1000, flipDays: (tr.flipStart + tr.flip / 2) / DAY };
}

/** The acceleration that covers `distance` metres rest to rest in `time` seconds with `flip` seconds of drive-off turning in the middle
 *  (the inverse of `transit`). Used to squeeze a long, honestly timed flight into a short film: the film leg keeps the shape of the flight
 *  (burn, flip, brake) but not its size. Pure maths, SI units. */
export function accelFor(distance: number, time: number, flip = 0): number {
  const tb = (time - flip) / 2;
  if (!(distance > 0) || !(tb > 0) || !(flip >= 0)) throw new RangeError('accelFor needs distance > 0, time > flip >= 0');
  return distance / (tb * (tb + flip));
}
