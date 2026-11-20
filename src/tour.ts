// Tour mode: a slow camera film through a system, one body at a time, with a fade at each cut.
// It plays behind the start screen, and on demand with T in flight. Each shot drifts the camera
// past its subject, placed relative to the star so the subject is lit from the side, not flat on.

import * as THREE from 'three';

type V3 = THREE.Vector3;
interface Target { id: string; name: string; desc?: string; sub?: string; kind: string; pos: V3; radius: number }

/** A shot: where the camera starts and ends, as distance (in the subject's radii), azimuth from
 *  the sunward side and elevation (radians), and how long it lasts. */
export interface Shot { id: string; from: [number, number, number]; to: [number, number, number]; secs: number; caption?: string }

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
function genericShots(things: Target[]): Shot[] {
  const pick = things.filter((t) => ['star', 'planet', 'station', 'artifact', 'dwarf'].includes(t.kind) && t.radius > 0).slice(0, 8);
  return pick.map((t, i) => {
    const s = i % 2 ? -1 : 1;
    return t.kind === 'star'
      ? { id: t.id, from: [9, 0.3, 0.15], to: [6, -0.2, 0.05], secs: 9 }
      : { id: t.id, from: [3.6, s * 1.0, 0.25], to: [2.5, s * 0.6, 0.1], secs: 10 };
  });
}

export interface Tour {
  active: boolean;
  start(spaceId: string, things: Target[], sunPos: V3 | null): void;
  stop(): void;
  /** Move the camera; returns false once there is nothing to show. */
  /** `aside` frames the subject off to the right, clear of the start screen's text. */
  update(dt: number, camera: THREE.PerspectiveCamera, aside?: boolean): boolean;
}

export function createTour(cut: (t: Target, caption: string) => void, dark: (on: boolean) => void): Tour {
  let shots: Shot[] = [], list: Target[] = [], sun: V3 | null = null, i = 0, t = 0, blacked = false;
  const dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), toSun = new THREE.Vector3(), right = new THREE.Vector3();
  const ease = (x: number) => x * x * (3 - 2 * x);
  const target = () => list.find((x) => x.id === shots[i]?.id);
  const begin = () => {
    t = 0;
    const tg = target();
    if (tg) cut(tg, shots[i].caption ?? tg.desc ?? tg.sub ?? '');
  };

  const tour: Tour = {
    active: false,
    start(spaceId, things, sunPos) {
      list = things;
      sun = sunPos;
      shots = (spaceId === 'sol' ? SOL : spaceId === 'slow' ? SLOW : genericShots(things)).filter((s) => things.some((x) => x.id === s.id));
      i = 0;
      tour.active = shots.length > 0;
      if (tour.active) begin();
    },
    stop() {
      tour.active = false;
      if (blacked) { dark(false); blacked = false; }
    },
    update(dt, camera, aside = false) {
      if (!tour.active) return false;
      const shot = shots[i], tg = target();
      if (!shot || !tg) { tour.stop(); return false; }
      t += dt;
      // Fade to black over the last half second, and back up as the next shot starts.
      const wantDark = t > shot.secs - 0.55;
      if (wantDark !== blacked) { dark(wantDark); blacked = wantDark; }
      if (t >= shot.secs) {
        i = (i + 1) % shots.length;
        begin();
        return tour.update(0, camera, aside);
      }
      const k = ease(Math.min(1, t / shot.secs));
      const [d0, a0, e0] = shot.from, [d1, a1, e1] = shot.to;
      const dist = d0 + (d1 - d0) * k, az = a0 + (a1 - a0) * k, el = e0 + (e1 - e0) * k;
      // Frame the shot around the direction to the star, so azimuth 0 is full daylight.
      if (sun && sun.distanceToSquared(tg.pos) > 1e-12) toSun.copy(sun).sub(tg.pos).normalize();
      else toSun.set(0, 0, 1);
      right.crossVectors(up, toSun).normalize();
      dir.copy(toSun).multiplyScalar(Math.cos(az) * Math.cos(el))
        .addScaledVector(right, Math.sin(az) * Math.cos(el))
        .addScaledVector(up, Math.sin(el)).normalize();
      camera.position.copy(tg.pos).addScaledVector(dir, tg.radius * dist);
      camera.up.set(0, 1, 0);
      camera.lookAt(tg.pos);
      if (aside) { camera.rotateY(0.34); camera.rotateX(0.08); }
      camera.updateMatrixWorld();
      return true;
    },
  };
  return tour;
}
