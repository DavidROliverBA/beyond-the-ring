// Pure helpers for the book's ending scenarios (lw-anubis, lw-venus): no three.js, so the tests can check them.
// Honest where it can be (the real transit times come from src/transit.ts), and plain about where the film is a time-lapse.

import { AU, G0, transit } from '../transit';

export type V = [number, number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k];
export const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: V): V => mul(a, 1 / len(a));

/** Venus's radius, metres (the scene's body is 0.04045 units of 1/1000 AU; NASA gives 6051.8 km). */
export const VENUS_R = 6.0518e6;

/** Where a ship at `p1` with velocity `v1` must push, and how hard, to be at `target` after `T` seconds: constant acceleration, one direction.
 *  p(T) = p1 + v1 T + A T^2 / 2, so A = 2 (target - p1 - v1 T) / T^2. */
export function interceptAccel(p1: V, v1: V, target: V, T: number): { dir: V; g: number } {
  const A = mul(sub(target, add(p1, mul(v1, T))), 2 / (T * T));
  return { dir: unit(A), g: len(A) / G0 };
}

/** Position after `t` seconds of constant acceleration `a` (m/s^2, along unit `dir`) from `p0` and `v0`. */
export function pushed(p0: V, v0: V, dir: V, a: number, t: number): V {
  return add(add(p0, mul(v0, t)), mul(dir, 0.5 * a * t * t));
}

/** How many times faster than a ship at `realG` the film moves: a rest-to-rest push over `distance` metres that takes `filmSecs` on screen
 *  would take sqrt(2 d / a) seconds at `realG` (accelerating all the way, no flip), so the time-lapse is that over `filmSecs`. */
export function lapseFactor(distance: number, filmSecs: number, realG: number): number {
  return Math.sqrt((2 * distance) / (realG * G0)) / filmSecs;
}

/** The whole trip's honest time in days, rest to rest with a flip at the middle (src/transit.ts), for a ship at `g` over `au` AU. */
export function tripDays(au: number, g: number): number {
  return transit(au * AU, g * G0, 0).time / 86400;
}

/** "about 1.4 to 2.0 days" and the like, from `tripDays`, to one decimal. */
export function tripRange(auLow: number, auHigh: number, g: number): string {
  const a = tripDays(auLow, g), b = tripDays(auHigh, g);
  return `about ${a.toFixed(1)} to ${b.toFixed(1)} days`;
}

/** A point on a sphere of radius `r` about the origin, in direction `dir`. */
export function surfacePoint(dir: V, r: number): V { return mul(unit(dir), r); }

/** Closest the straight-line-plus-push path comes to the origin over `t0..t1`, sampled; metres. For checking a ship clears a planet. */
export function closestToOrigin(p0: V, v0: V, dir: V, a: number, t0: number, t1: number, steps = 400): number {
  let m = Infinity;
  for (let i = 0; i <= steps; i++) m = Math.min(m, len(pushed(p0, v0, dir, a, t0 + ((t1 - t0) * i) / steps)));
  return m;
}
