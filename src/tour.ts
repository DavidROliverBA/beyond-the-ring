// Tour mode: a slow camera film through a system, one body at a time, with a fade at each cut.
// It plays behind the start screen, and on demand with T in flight. Each shot drifts the camera
// past its subject, placed relative to the star so the subject is lit from the side, not flat on.

import * as THREE from 'three';

type V3 = THREE.Vector3;
interface Target { id: string; name: string; desc?: string; sub?: string; kind: string; pos: V3; radius: number }

/** A shot: where the camera starts and ends, as distance (in the subject's radii), azimuth from
 *  the sunward side and elevation (radians), and how long it lasts. */
export interface Shot {
  id: string; from: [number, number, number]; to: [number, number, number]; secs: number; caption?: string;
  /** Seconds of flight from wherever the camera was to the start of this shot (none: a cut through black). */
  travel?: number;
}

/** A shot that looks at its subject from the usual side, `dist` radii away: used by the voyages. */
export const look = (id: string, secs = 8, travel = 7, caption?: string, side = 1): Shot =>
  ({ id, from: [3.8, side * 0.9, 0.25], to: [2.6, side * 0.5, 0.1], secs, travel, caption });

/** A leg of a voyage: where it is, and what to look at there (or a few of the system's own bodies). */
export interface Stage { space: string; shots: Shot[] | 'generic' }
export interface Voyage { id: string; name: string; blurb: string; from: string[]; stages: Stage[] }

const SOL: Shot[] = [
  { id: 'earth', from: [3.4, 0.9, 0.25], to: [2.4, 0.55, 0.12], secs: 11, caption: 'Thirty billion people, most of them on Basic.' },
  { id: 'luna', from: [4.5, 1.2, 0.3], to: [3.0, 0.8, 0.1], secs: 9 },
  { id: 'sun', from: [9, 0.3, 0.15], to: [6, -0.2, 0.05], secs: 9 },
  { id: 'mars', from: [3.6, -1.0, 0.2], to: [2.5, -0.6, 0.35], secs: 10 },
  { id: 'tycho', from: [5, 0.8, 0.4], to: [3.2, 1.3, 0.2], secs: 10 },
  { id: 'ceres', from: [4, 0.9, -0.1], to: [2.7, 0.5, 0.15], secs: 9 },
  { id: 'jupiter', from: [3.2, 1.1, 0.15], to: [2.2, 0.7, 0.05], secs: 11 },
  { id: 'saturn', from: [4.6, 0.7, 0.42], to: [3.2, 0.35, 0.22], secs: 12 },
  { id: 'ring', from: [5, 0.6, 0.2], to: [2.6, 0.2, 0.05], secs: 11 },
];

/** The ring space: the station, Medina, then out to the wall for two of the gates (seen from inside). */
const SLOW: Shot[] = [
  { id: 'station', from: [5.5, 0.9, 0.25], to: [3.6, 0.4, 0.1], secs: 10 },
  { id: 'medina', from: [4.2, 1.0, 0.25], to: [2.8, 0.5, 0.1], secs: 11 },
  { id: 'g0', from: [7, 0.5, 0.2], to: [3, 0.15, 0.05], secs: 11, caption: 'The way home: a thousand kilometres across, and behind it the Sun.' },
  { id: 'g412', from: [5, -0.7, 0.15], to: [2.4, -0.2, 0.05], secs: 10 },
];

/** Any other system: the star, then its planets, stations and oddities, alternating sides. */
export function genericShots(things: Target[], travel = 0, max = 8): Shot[] {
  const pick = things.filter((t) => ['star', 'planet', 'station', 'artifact', 'dwarf'].includes(t.kind) && t.radius > 0).slice(0, max);
  return pick.map((t, i): Shot => {
    const s = i % 2 ? -1 : 1;
    const tr = i > 0 ? travel : 0;
    return t.kind === 'star'
      ? { id: t.id, from: [9, 0.3, 0.15], to: [6, -0.2, 0.05], secs: 9, travel: tr }
      : { id: t.id, from: [3.6, s * 1.0, 0.25], to: [2.5, s * 0.6, 0.1], secs: 10, travel: tr };
  });
}

export interface StartOptions {
  /** Shots to play instead of the system's own. */
  shots?: Shot[];
  /** Play through once and stop (calling `end`), rather than round and round. */
  once?: boolean;
  end?: () => void;
  /** Fly to the first shot from where the camera is, rather than start at it. */
  flyIn?: boolean;
}

export interface Tour {
  active: boolean;
  /** True if there is something to show. */
  start(spaceId: string, things: Target[], sunPos: V3 | null, opt?: StartOptions): boolean;
  stop(): void;
  /** Move the camera; returns false once there is nothing to show. */
  /** `aside` frames the subject off to the right, clear of the start screen's text. */
  update(dt: number, camera: THREE.PerspectiveCamera, aside?: boolean): boolean;
}

const _cam = new THREE.PerspectiveCamera();

export function createTour(cut: (t: Target, caption: string) => void, dark: (on: boolean) => void): Tour {
  let shots: Shot[] = [], list: Target[] = [], sun: V3 | null = null, i = 0, t = 0, blacked = false;
  let once = false, end: (() => void) | undefined;
  // A flight between two shots: from where the camera was, along an arc, to the start of the next.
  let leg: { t: number; dur: number; p0: V3; p1: V3; c: V3; q0: THREE.Quaternion; q1: THREE.Quaternion } | null = null;
  const dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), toSun = new THREE.Vector3(), right = new THREE.Vector3();
  const ease = (x: number) => x * x * (3 - 2 * x);
  const target = () => list.find((x) => x.id === shots[i]?.id);

  /** Where the camera stands `k` (0..1) of the way through a shot. */
  const shotPos = (shot: Shot, tg: Target, k: number, out: V3): V3 => {
    const [d0, a0, e0] = shot.from, [d1, a1, e1] = shot.to;
    const dist = d0 + (d1 - d0) * k, az = a0 + (a1 - a0) * k, el = e0 + (e1 - e0) * k;
    // Frame the shot around the direction to the star, so azimuth 0 is full daylight.
    if (sun && sun.distanceToSquared(tg.pos) > 1e-12) toSun.copy(sun).sub(tg.pos).normalize();
    else toSun.set(0, 0, 1);
    right.crossVectors(up, toSun).normalize();
    dir.copy(toSun).multiplyScalar(Math.cos(az) * Math.cos(el))
      .addScaledVector(right, Math.sin(az) * Math.cos(el))
      .addScaledVector(up, Math.sin(el)).normalize();
    return out.copy(tg.pos).addScaledVector(dir, tg.radius * dist);
  };

  const begin = (camera?: THREE.PerspectiveCamera) => {
    t = 0;
    const tg = target(), shot = shots[i];
    leg = null;
    if (!tg) return;
    if (camera && shot.travel) {
      // Fly there. The arc rises above the plane of the system, which keeps it clear of most of what is in the way.
      const p1 = shotPos(shot, tg, 0, new THREE.Vector3()), p0 = camera.position.clone();
      _cam.position.copy(p1); _cam.up.set(0, 1, 0); _cam.lookAt(tg.pos); _cam.updateMatrixWorld();
      const len = p0.distanceTo(p1);
      leg = {
        t: 0, dur: shot.travel, p0, p1, c: p0.clone().add(p1).multiplyScalar(0.5).addScaledVector(up, len * 0.22),
        q0: camera.quaternion.clone(), q1: _cam.quaternion.clone(),
      };
    }
    // (On a flight the caption waits until we arrive.)
    if (!leg) cut(tg, shot.caption ?? tg.desc ?? tg.sub ?? '');
  };

  const tour: Tour = {
    active: false,
    start(spaceId, things, sunPos, opt = {}) {
      list = things;
      sun = sunPos;
      once = !!opt.once;
      end = opt.end;
      leg = null;
      shots = (opt.shots ?? (spaceId === 'sol' ? SOL : spaceId === 'slow' ? SLOW : genericShots(things))).filter((s) => things.some((x) => x.id === s.id));
      i = 0;
      tour.active = shots.length > 0;
      if (tour.active) { pending = !!opt.flyIn; begin(); }
      return tour.active;
    },
    stop() {
      tour.active = false;
      leg = null;
      end = undefined;
      if (blacked) { dark(false); blacked = false; }
    },
    update(dt, camera, aside = false) {
      if (!tour.active) return false;
      if (pending) { pending = false; begin(camera); }
      const shot = shots[i], tg = target();
      if (!shot || !tg) { tour.stop(); return false; }
      if (leg) {
        leg.t += dt;
        const u = Math.min(1, leg.t / leg.dur), e = ease(u);
        // Quadratic arc p0 -> c -> p1.
        camera.position.copy(leg.p0).multiplyScalar((1 - e) * (1 - e)).addScaledVector(leg.c, 2 * (1 - e) * e).addScaledVector(leg.p1, e * e);
        camera.quaternion.slerpQuaternions(leg.q0, leg.q1, ease(Math.min(1, u * 1.15)));
        camera.updateMatrixWorld();
        if (u >= 1) { leg = null; cut(tg, shot.caption ?? tg.desc ?? tg.sub ?? ''); }
        return true;
      }
      t += dt;
      // Fade to black over the last half second, and back up as the next shot starts (unless the next is a flight).
      const next = shots[i + 1] ?? (once ? undefined : shots[0]);
      const wantDark = t > shot.secs - 0.55 && !(next?.travel) && !(once && i === shots.length - 1);
      if (wantDark !== blacked) { dark(wantDark); blacked = wantDark; }
      if (t >= shot.secs) {
        if (once && i === shots.length - 1) {
          const done = end;
          tour.stop();
          done?.();
          return false;
        }
        i = (i + 1) % shots.length;
        begin(next?.travel ? camera : undefined);
        return tour.update(0, camera, aside);
      }
      shotPos(shot, tg, ease(Math.min(1, t / shot.secs)), camera.position);
      camera.up.set(0, 1, 0);
      camera.lookAt(tg.pos);
      if (aside) { camera.rotateY(0.34); camera.rotateX(0.08); }
      camera.updateMatrixWorld();
      return true;
    },
  };
  let pending = false;
  return tour;
}
