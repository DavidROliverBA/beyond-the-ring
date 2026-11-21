// Tour mode: a camera film through a system, one place after another. It plays behind the start
// screen, and on demand with T in flight. The camera works the way a film camera does: it never stops
// between places (each flight sets off at the speed the last sweep ended with), it turns on a damped
// spring so every turn eases in and out and leans a little into the bend, it breathes a little as a
// hand-held camera would, the lens widens for speed and lengthens for the portrait, and the subject is
// placed off the centre of the frame, not dead in the middle. Each place is placed relative to the star so
// it is lit from the side, not flat on.

import * as THREE from 'three';

type V3 = THREE.Vector3;
interface Target { id: string; name: string; desc?: string; sub?: string; kind: string; pos: V3; radius: number; normal?: V3 }

/** A shot: where the camera starts and ends, as distance (in the subject's radii), azimuth from
 *  the sunward side and elevation (radians), and how long it lasts. */
export interface Shot {
  id: string; from: [number, number, number]; to: [number, number, number]; secs: number; caption?: string;
  /** Seconds of flight from wherever the camera was to the start of this shot (none: a cut through black). */
  travel?: number;
  /** The lens for this shot, degrees of view (long for a portrait, wide for a skim). */
  fov?: number;
  /** Frame it from the face of the subject (a gate), not from the side the star is on. */
  axis?: boolean;
  /** Once the shot is done, carry on through the middle of the subject (a gate) before the next stage. */
  dive?: boolean;
}

/** How a shot is staged. */
export type ShotStyle = 'sweep' | 'reveal' | 'skim' | 'track' | 'pull';

/** A shot that looks at its subject from the usual side, `dist` radii away: used by the voyages.
 *   sweep  – round its lit side, about 150 degrees, the way a camera crew would
 *   reveal – start behind it with the star on its far edge, and move round into the light
 *   skim   – low and fast over the surface, the planet filling the frame
 *   track  – alongside, side-on, as if keeping pace (for ships)
 *   pull   – start close on a detail and pull back to show how big it is */
export const look = (id: string, secs = 8, travel = 7, caption?: string, side = 1, style: ShotStyle = 'sweep'): Shot => {
  switch (style) {
    case 'reveal': return { id, from: [3.7, side * 2.7, 0.16], to: [2.7, side * 0.7, 0.2], secs, travel, caption, fov: 34 };
    case 'skim': return { id, from: [1.3, side * -1.6, 0.05], to: [1.3, side * 1.1, 0.06], secs: Math.min(secs, 7), travel, caption, fov: 58 };
    case 'track': return { id, from: [2.5, side * 1.5, 0.02], to: [2.1, side * 1.1, 0.05], secs, travel, caption, fov: 42 };
    case 'pull': return { id, from: [1.7, side * 0.9, 0.14], to: [6.5, side * 0.5, 0.22], secs, travel, caption, fov: 44 };
    default: return { id, from: [3.8, side * -1.3, 0.28], to: [2.9, side * 1.3, 0.12], secs, travel, caption, fov: 40 };
  }
};

/** The Ring, or a gate: seen face on, then a dive through its middle into whatever is on the other side. */
export const gateShot = (id: string, caption?: string, secs = 7, travel = 8, dive = true): Shot =>
  ({ id, from: [5.2, -0.45, 0.1], to: [3.4, 0.35, 0.03], secs, travel, caption, fov: 42, axis: true, dive });

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
export function genericShots(things: Target[], travel = 8, max = 8): Shot[] {
  const pick = things.filter((t) => ['star', 'planet', 'station', 'artifact', 'dwarf'].includes(t.kind) && t.radius > 0).slice(0, max);
  return pick.map((t, i): Shot => {
    const s = i % 2 ? -1 : 1;
    const tr = travel;
    return t.kind === 'star'
      ? { id: t.id, from: [9, 0.3, 0.15], to: [6, -0.2, 0.05], secs: 9, travel: tr, fov: 34 }
      : { id: t.id, from: [3.6, s * 1.0, 0.25], to: [2.5, s * 0.6, 0.1], secs: 10, travel: tr, fov: 40 };
  });
}


/** Every default shot is a flight, so the tour never cuts. */
const flights = (a: Shot[]): Shot[] => a.map((s) => ({ ...s, travel: s.travel ?? 8, fov: s.fov ?? 40 }));

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
  /** The ids of the place being shown and the next `n` after it, so their surfaces can be ready before we get there. */
  ahead(n: number): string[];
  /** Move the camera; returns false once there is nothing to show. `aside` frames the subject off to the right,
   *  clear of the start screen's text. */
  update(dt: number, camera: THREE.PerspectiveCamera, aside?: boolean): boolean;
}

const _cam = new THREE.PerspectiveCamera();
const _p1 = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _qe = new THREE.Quaternion();
const _look = new THREE.Vector3(), _e = new THREE.Euler(), _qs = new THREE.Quaternion(), _ax = new THREE.Vector3(), _rel = new THREE.Vector3();
/** Position added to a flight so that it sets off at the speed the last move ended with: starts with that slope, and is gone, with no slope, at the end. */
const mom = (u: number) => u * (1 - u) * (1 - u);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function createTour(
  cut: (t: Target, caption: string) => void,
  dark: (on: boolean) => void,
  hooks: { leg?: () => void } = {},
): Tour {
  let shots: Shot[] = [], list: Target[] = [], sun: V3 | null = null, i = 0, t = 0, blacked = false;
  let once = false, end: (() => void) | undefined;
  // A flight between two shots: from where the camera was, along an arc, to the start of the next.
  type Leg = { t: number; dur: number; d0: number; dir0: V3; spin: THREE.Quaternion; m: number; v0: V3; fov0: number };
  let leg: Leg | null = null;
  // The dive through a gate once its shot is done.
  type Dive = { t: number; dur: number; lat0: V3; d0: number; v0: V3; c: V3; n: V3; r: number; fov0: number };
  let dive: Dive | null = null;
  const dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), toSun = new THREE.Vector3(), right = new THREE.Vector3();
  const ease = (x: number) => x * x * (3 - 2 * x);
  // A sweep round a subject starts at speed (as the flight in arrives) and, if a flight follows, carries on at that speed.
  const sweepRest = (x: number) => x + x * x - x * x * x;
  const target = () => list.find((x) => x.id === shots[i]?.id);

  // The camera's own state: orientation on a critically damped spring (so turns ease in and out), the lens, the sway.
  const qB = new THREE.Quaternion(), w = new THREE.Vector3();
  let haveQ = false, fovCur = 40, baseFov = 0, st = 0, camRef: THREE.PerspectiveCamera | null = null, pending = false;
  // How fast the subject is moving across the camera's view, so a flight can set off at that speed.
  const vRel = new THREE.Vector3(), lastRel = new THREE.Vector3();
  let hasRel = false;

  /** Where the camera stands `k` (0..1) of the way through a shot. */
  const shotPos = (shot: Shot, tg: Target, k: number, out: V3): V3 => {
    const [d0, a0, e0] = shot.from, [d1, a1, e1] = shot.to;
    const dist = d0 + (d1 - d0) * k, az = a0 + (a1 - a0) * k, el = e0 + (e1 - e0) * k;
    // Frame the shot around the direction to the star, so azimuth 0 is full daylight (a gate: round its face).
    if (shot.axis && tg.normal) toSun.copy(tg.normal).normalize();
    else if (sun && sun.distanceToSquared(tg.pos) > 1e-12) toSun.copy(sun).sub(tg.pos).normalize();
    else toSun.set(0, 0, 1);
    right.crossVectors(up, toSun).normalize();
    dir.copy(toSun).multiplyScalar(Math.cos(az) * Math.cos(el))
      .addScaledVector(right, Math.sin(az) * Math.cos(el))
      .addScaledVector(up, Math.sin(el)).normalize();
    return out.copy(tg.pos).addScaledVector(dir, tg.radius * dist);
  };

  /** Off-centre: the subject sits towards one side of the frame (the way the camera is coming from), not in the middle. */
  const lead = (shot: Shot) => -Math.sign(shot.to[1] - shot.from[1] || 1) * 0.1;

  const begin = (camera?: THREE.PerspectiveCamera) => {
    t = 0;
    const tg = target(), shot = shots[i];
    leg = null; dive = null; havePrev = false;
    if (!tg) return;
    if (camera && shot.travel) {
      // Fly there with the subject ahead the whole way, so it grows from a point into the shot. The path swings round
      // to the side the shot starts on while the distance closes smoothly (steady growth on screen), and it sets off
      // at the speed the last sweep ended with.
      const p1 = shotPos(shot, tg, 0, new THREE.Vector3()), p0 = camera.position.clone();
      const dir0 = p0.clone().sub(tg.pos), d0 = Math.max(dir0.length(), 1e-30), dir1 = p1.clone().sub(tg.pos).normalize();
      dir0.divideScalar(d0);
      // The turn round the subject should end at the speed the sweep starts at (if the two go the same way).
      const cosT = Math.min(1, dir0.dot(dir1)), theta = Math.acos(cosT);
      let m = 0;
      if (theta > 1e-3) {
        const a = shotPos(shot, tg, 0, new THREE.Vector3()).sub(tg.pos).normalize(), b = shotPos(shot, tg, 0.02, new THREE.Vector3()).sub(tg.pos).normalize();
        const rate = a.angleTo(b) / (0.02 * shot.secs);
        const along = _d.copy(dir1).multiplyScalar(cosT).sub(dir0);
        if (along.dot(b.sub(a)) > 0) m = Math.min(2.5, (rate * shot.travel) / theta);
      }
      leg = { t: 0, dur: shot.travel, d0, dir0, spin: new THREE.Quaternion().setFromUnitVectors(dir0, dir1), m, v0: hasRel ? vRel.clone() : new THREE.Vector3(), fov0: fovCur };
      hooks.leg?.();
    }
    hasRel = false;
    // (On a flight the caption waits until we arrive.)
    if (!leg && !pending) { haveQ = false; cut(tg, shot.caption ?? tg.desc ?? tg.sub ?? ''); }
  };

  /** Turn the camera towards `qT` on a critically damped spring, so a turn eases in and out with no jolt. It also follows
   *  the speed the target itself is turning at (so tracking a subject that moves across the view has no lag), and a big
   *  turn is capped to a slow, film-like pan rather than a whip. */
  const qPrev = new THREE.Quaternion(), wT = new THREE.Vector3();
  let havePrev = false;
  const steer = (dt: number, qT: THREE.Quaternion) => {
    if (!haveQ) { qB.copy(qT); w.set(0, 0, 0); haveQ = true; havePrev = false; }
    // How fast is the target turning?
    if (havePrev && dt > 1e-4) {
      _qe.copy(qT).multiply(_q.copy(qPrev).invert());
      if (_qe.w < 0) { _qe.x *= -1; _qe.y *= -1; _qe.z *= -1; _qe.w *= -1; }
      const a = 2 * Math.acos(Math.min(1, _qe.w)), sn = Math.sqrt(Math.max(1e-12, 1 - _qe.w * _qe.w));
      _ax.set(_qe.x / sn, _qe.y / sn, _qe.z / sn).multiplyScalar(a / dt);
      if (_ax.length() > 1.4) _ax.setLength(1.4);
      wT.lerp(_ax, 0.25);
    } else wT.set(0, 0, 0);
    qPrev.copy(qT); havePrev = true;
    _qe.copy(qT).multiply(_q.copy(qB).invert());
    if (_qe.w < 0) { _qe.x *= -1; _qe.y *= -1; _qe.z *= -1; _qe.w *= -1; }
    const ang = 2 * Math.acos(Math.min(1, _qe.w)), sn = Math.sqrt(Math.max(1e-12, 1 - _qe.w * _qe.w));
    const err = _rel.set(_qe.x / sn, _qe.y / sn, _qe.z / sn).multiplyScalar(ang);   // the turn still to make, as a rotation vector
    const w0 = 2.3, cap = 1.1;
    const n = Math.max(1, Math.ceil(dt / 0.012)), h = dt / n;
    for (let k = 0; k < n; k++) {
      // (The pan may only speed up gently: a film head starts to move, it does not jump to speed.)
      _qs.identity();
      _ax.copy(err).multiplyScalar(w0 * w0).addScaledVector(_d.copy(wT).sub(w), 2 * w0);
      if (_ax.length() > 1.9) _ax.setLength(1.9);
      w.addScaledVector(_ax, h);
      if (w.length() > cap + wT.length()) w.setLength(cap + wT.length());
      const a = w.length() * h;
      if (a > 1e-9) { _qe.setFromAxisAngle(_d.copy(w).normalize(), a); qB.premultiply(_qe).normalize(); }
      err.addScaledVector(w, -h).addScaledVector(wT, h);
    }
  };

  const tour: Tour = {
    active: false,
    start(spaceId, things, sunPos, opt = {}) {
      list = things;
      sun = sunPos;
      once = !!opt.once;
      end = opt.end;
      leg = null; dive = null; haveQ = false; hasRel = false; st = 0;
      shots = (opt.shots ?? flights(spaceId === 'sol' ? SOL : spaceId === 'slow' ? SLOW : genericShots(things))).filter((s) => things.some((x) => x.id === s.id));
      i = 0;
      tour.active = shots.length > 0;
      if (tour.active) { pending = !!opt.flyIn; begin(); }
      return tour.active;
    },
    ahead(n) { return tour.active ? shots.slice(i, i + n + 1).map((x) => x.id) : []; },
    stop() {
      tour.active = false;
      leg = null; dive = null;
      end = undefined;
      if (blacked) { dark(false); blacked = false; }
      if (camRef && baseFov) { camRef.fov = baseFov; camRef.updateProjectionMatrix(); }
      baseFov = 0;
    },
    update(dt, camera, aside = false) {
      if (!tour.active) return false;
      camRef = camera;
      if (!baseFov) { baseFov = camera.fov; fovCur = camera.fov; }
      if (pending) { pending = false; begin(camera); }
      const shot = shots[i], tg = target();
      if (!shot || !tg) { tour.stop(); return false; }
      st += dt;
      let fovT = shot.fov ?? 40, yaw = 0, pitch = 0, snapTo: V3 | null = null;
      const asideYaw = aside ? 0.34 : 0, asidePitch = aside ? 0.08 : 0;

      if (dive) {
        // Through the middle of the gate, faster and faster, the lens widening: the film fills the view, and we cut on it.
        dive.t += dt;
        const u = Math.min(1, dive.t / dive.dur);
        const axial = dive.d0 + (-0.7 * dive.r - dive.d0) * (u * u);
        const lat = (1 - ease(Math.min(1, u / 0.6))) ** 2;
        camera.position.copy(dive.c).addScaledVector(dive.n, axial).addScaledVector(dive.lat0, lat).addScaledVector(dive.v0, dive.dur * mom(u));
        snapTo = _look.copy(dive.c).addScaledVector(dive.n, -3 * dive.r);
        fovT = dive.fov0 + (88 - dive.fov0) * (u * u);
        if (u > 0.78 && !blacked) { dark(true); blacked = true; }
        if (u >= 1) {
          const done = end;
          tour.stop();
          done?.();
          return false;
        }
      } else if (leg) {
        leg.t += dt;
        const u = Math.min(1, leg.t / leg.dur), e = ease(u);
        const p1 = shotPos(shot, tg, 0, _p1), d1 = Math.max(p1.distanceTo(tg.pos), 1e-30);
        // Direction round the subject: from the way we came in to the way the shot starts; it begins at rest and
        // arrives at the speed the sweep starts at.
        const e2 = (3 * u * u - 2 * u * u * u) + leg.m * (u * u * u - u * u);
        _q.identity().slerp(leg.spin, e2);
        const dirNow = _d.copy(leg.dir0).applyQuaternion(_q);
        const dist = Math.exp(Math.log(leg.d0) + (Math.log(d1) - Math.log(leg.d0)) * e);
        camera.position.copy(tg.pos).addScaledVector(dirNow, dist).addScaledVector(leg.v0, leg.dur * mom(u));
        snapTo = tg.pos;
        // Off-centre as we arrive. The lens widens through the flight for speed and settles to the shot's own.
        const f = ease(clamp01((u - 0.45) / 0.55));
        yaw = lead(shot) * f + asideYaw * f; pitch = asidePitch * f;
        fovT = leg.fov0 + (fovT - leg.fov0) * e + 12 * Math.sin(Math.PI * u) * (1 - 0.3 * u);
        if (u >= 1) { leg = null; cut(tg, shot.caption ?? tg.desc ?? tg.sub ?? ''); }
      } else {
        t += dt;
        // Fade to black over the last half second only where the next place is a cut, not a flight.
        const next = shots[i + 1] ?? (once ? undefined : shots[0]);
        const lastOnce = once && i === shots.length - 1;
        const flows = !!next?.travel && !lastOnce;
        const wantDark = t > shot.secs - 0.55 && !next?.travel && !lastOnce && !shot.dive;
        if (wantDark !== blacked && !dive) { dark(wantDark); blacked = wantDark; }
        if (t >= shot.secs) {
          if (shot.dive && tg.normal) {
            // Carry on through the gate.
            const c = tg.pos.clone(), n = tg.normal.clone().normalize(), rel = camera.position.clone().sub(c);
            const d0 = rel.dot(n);
            dive = { t: 0, dur: 5.2, lat0: rel.addScaledVector(n, -d0), d0, v0: hasRel ? vRel.clone() : new THREE.Vector3(), c, n, r: tg.radius, fov0: fovCur };
            hasRel = false;
            hooks.leg?.();
            return tour.update(0, camera, aside);
          }
          if (lastOnce) {
            const done = end;
            tour.stop();
            done?.();
            return false;
          }
          i = (i + 1) % shots.length;
          begin(next?.travel ? camera : undefined);
          return tour.update(0, camera, aside);
        }
        const k = Math.min(1, t / shot.secs);
        // Linear while a flight follows (so it keeps moving); eased to rest where the film stops.
        shotPos(shot, tg, flows || shot.dive ? k : sweepRest(k), camera.position);
        snapTo = tg.pos;
        yaw = lead(shot) + asideYaw; pitch = asidePitch;
        fovT = fovT * (1.04 - 0.08 * k);                       // a slow push in
        // Remember how fast we are moving across the subject, to set off at that speed.
        _rel.copy(camera.position).sub(tg.pos);
        if (hasRel && dt > 0) vRel.lerp(_d.copy(_rel).sub(lastRel).divideScalar(dt), 0.25); else vRel.set(0, 0, 0);
        lastRel.copy(_rel); hasRel = true;
      }

      // Where we are looking, on the spring.
      _cam.position.copy(camera.position); _cam.up.set(0, 1, 0); _cam.lookAt(snapTo ?? tg.pos);
      if (yaw) _cam.rotateY(yaw);
      if (pitch) _cam.rotateX(pitch);
      steer(dt, _cam.quaternion);
      // Hand-held: a slow breathing sway, and a lean into the turn.
      const bank = THREE.MathUtils.clamp(-_ax.set(0, 1, 0).applyQuaternion(qB).dot(w) * 0.07, -0.09, 0.09);
      _e.set(0.0013 * (Math.sin(st * 0.7) + 0.5 * Math.sin(st * 1.9 + 2)), 0.0016 * (Math.sin(st * 0.9 + 1.3) + 0.6 * Math.sin(st * 2.1 + 0.4)), bank + 0.0012 * Math.sin(st * 0.5 + 0.7), 'YXZ');
      camera.quaternion.copy(qB).multiply(_qs.setFromEuler(_e));
      // The lens.
      fovCur = fovT;
      if (Math.abs(camera.fov - fovCur) > 0.02) { camera.fov = fovCur; camera.updateProjectionMatrix(); }
      camera.updateMatrixWorld();
      return true;
    },
  };
  return tour;
}
