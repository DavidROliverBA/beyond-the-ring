// Planning a trip the way the autopilot flies it: burn towards the target, coast while the ship turns
// end over end, then burn the other way to arrive at rest. The autopilot (main.ts) and the map share
// this, so the map's flip marker and arrival time are what the ship will really do.

export const FLIP_SECS = 5.5;          // the ship turning end over end, drive off
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export interface Trip {
  /** How hard the drive burns, in scene units per second per second. */
  a: number;
  /** Fastest speed on the way. */
  vPeak: number;
  /** How far along the line the flip begins. */
  flipAt: number;
  /** About how long the whole trip takes, in seconds. */
  eta: number;
}

/** `D` distance to the viewpoint, `R` the target's radius, `vmax` the speed limit here. All in scene units. */
export function planTrip(D: number, R: number, vmax: number): Trip {
  // A hop takes ten seconds or so, a crossing of the system about half a minute; the flip takes its share
  // and the two burns each last half of what is left. That fixes how hard to burn.
  const T = clamp(9 + 4.2 * Math.log10(Math.max(D / R, 1.5)), 10, 40);
  const t1 = (T - FLIP_SECS) / 2;
  const a = D / (t1 * (t1 + FLIP_SECS));
  const vPeak = Math.min(vmax, a * t1);
  const dBurn = (vPeak * vPeak) / (2 * a);
  const flipAt = Math.max(0, D - dBurn - vPeak * FLIP_SECS * 1.08);
  const cruise = Math.max(0, flipAt - dBurn) / Math.max(vPeak, 1e-30);
  return { a, vPeak, flipAt, eta: (2 * vPeak) / a + cruise + FLIP_SECS };
}
