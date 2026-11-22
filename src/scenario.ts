// The scenario engine (E3.2): a scripted, watchable sequence of ships, weapons and cameras, played from a file.
//
// A scenario is plain data (see `src/scenarios/`): a frame (where in the system it happens), actors (ships,
// each with the source it rests on and how sure we are), a track of closed-form legs for each actor, events
// (fire, hit, debris, ...), shots for the director and captions in our own words. Every leg is a pure function
// of time, so the player can pause, seek to any second and land on exactly the same picture every time.
//
// All the scenario's numbers are metres, in a frame whose axes are the scene's. The whole scenario hangs on one
// root group scaled to the scene (1 unit = 1/1000 AU), so a 46 m ship and a 5 km range keep their precision.
//
// Orientation follows the ship models: the nose is -Z and the drive is at the tail (+Z), so a burn points the
// nose where she is going, and the flip turns her end for end about her own up axis.

import * as THREE from 'three';
import { buildModel, type ShipModel } from './ships';
import { DrivePlume } from './plume';
import { SOL_UNIT } from './traffic';
import type { Shot } from './tour';
import { createFx } from './scenarioFx';

type V3 = THREE.Vector3;
export type Vec = [number, number, number];
/** How well the public record supports a claim: A two good sources agree, B one or two related, C weak or show/RPG-derived, ? unknown. */
export type Conf = 'A' | 'B' | 'C' | '?';

export interface ActorDef {
  id: string; name: string; model: ShipModel;
  /** True length, metres. */
  len: number;
  faction?: 'civil' | 'mcrn' | 'opa' | 'unn' | 'protogen' | 'unknown';
  /** How sure we are this is the ship the book means. */
  confidence: Conf;
  /** A different ship's model, used because we have no better. */
  standin?: boolean;
  /** Numbers or details made up for the film. */
  invented?: boolean;
  /** No drive glow, no lights worth the name. */
  stealth?: boolean;
  /** The drive: `burn` scales the plume. Leave it out for a ship with a cold drive. */
  plume?: { burn: number };
  /** Present only between these times (seconds); the default is the whole film. */
  life?: [number, number];
  crew?: number;
  note?: string;
}

/** One stretch of an actor's track. Each is closed-form: the state at any time inside it comes from a formula.
 *  `here` means "where the leg before leaves off". Legs are listed in time order; the last one carries on (holds) after it ends. */
export type Leg =
  /** Sit still, facing `face` (a direction) or as she was. */
  | { t: number; type: 'hold'; at?: Vec | 'here'; face?: Vec | 'here' }
  /** A rest-to-rest flip-and-burn: push at `g` for the first part, coast through the flip (the drive is off while she
   *  turns end for end), push the other way to stop. The length of the leg comes from the distance and `g`. */
  | { t: number; type: 'burn'; from?: Vec | 'here'; to: Vec; g: number; flip?: number }
  /** Drift at a steady velocity (the one she has, or `vel`), turning slowly if `spin` (radians a second about each axis). */
  | { t: number; type: 'coast'; from?: Vec | 'here'; vel?: Vec | 'here'; face?: Vec; spin?: Vec }
  /** Keep the velocity she has, turn her nose to `dir` at `turn` rad/s, then push at `g` along it. */
  | { t: number; type: 'accel'; dir: Vec; g: number; turn?: number };

export type EventDef =
  /** A torpedo or missile launched at `t` that reaches `to` at time `hit`, accelerating steadily from rest on the launcher (shape and speed invented). */
  | { t: number; type: 'fire'; weapon: 'torpedo' | 'missile'; from: string; to: string; hit: number; count?: number; invented?: boolean }
  /** The target is struck at `t`. `nuke` is the flash and shell; `destroy` removes the actor. */
  | { t: number; type: 'hit'; target: string; fx: 'nuke'; damage: 'destroy'; radius?: number }
  /** Wreckage thrown from an actor's place at `t`. */
  | { t: number; type: 'debris'; from: string; n: number; seed: number; speed?: number }
  /** Sound cue: space is quiet here (not played yet, E3.2.e). */
  | { t: number; type: 'silence'; dur: number }
  | { t: number; type: 'hail'; from: string; to: string; caption?: string };

/** A shot reuses the tour's `Shot` (`id` is the actor looked at; `from`/`to` are [distance in the actor's radii, azimuth from the
 *  sunward side, elevation]; `secs` its length; `fov`), with a start time and a mode.
 *   orbit  – round the actor, framed on the sun like the tour's sweeps (default)
 *   static – from a fixed point `at` (metres), a long lens on the actor
 *   pov    – from the actor (`offset` metres, in the frame) looking at the actor `look`
 *   chase  – behind the actor along her heading, `back` metres and `up` metres */
export interface ScnShot extends Pick<Shot, 'id' | 'from' | 'to' | 'secs' | 'fov' | 'caption'> {
  t0: number;
  mode?: 'orbit' | 'static' | 'pov' | 'chase';
  at?: Vec; look?: string; offset?: Vec; back?: number; up?: number;
}

export interface Caption { t: number; dur: number; title: string; text: string }

export interface Scenario {
  id: string; title: string;
  book: number; bookTitle: string;
  /** One line for the card, in our words. */
  spoiler: string;
  /** Where in the research notes this rests. */
  sources: string[];
  frame: {
    space: 'sol';
    /** The place, pinned: `au` from the star at `angle` radians round the system (the planets' own angle), `lift` scene units above the plane.
     *  It does not depend on where the planets are when the film starts, so the sky behind is the same every time. */
    origin: { au: number; angle: number; lift?: number };
    seed: number;
  };
  time: { duration: number; storyMinutes?: number; scale: 'real' | 'compressed'; note?: string };
  actors: ActorDef[];
  tracks: Record<string, Leg[]>;
  events: EventDef[];
  shots: ScnShot[];
  captions: Caption[];
  chapters?: string[];
  /** Choices made where the sources disagree. */
  notes?: string[];
}

// ------------------------------------------------------------------ the legs

const G0 = 9.80665;
const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Where a ship is, how fast she is going, which way she points and how hard the drive is working. */
export interface State { p: V3; v: V3; q: THREE.Quaternion; thrust: number }
const newState = (): State => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), thrust: 0 });

/** The quaternion that points the nose (-Z) along `d`. */
const _o = new THREE.Vector3(), _x = new THREE.Vector3(1, 0, 0);
function facing(d: V3, out = new THREE.Quaternion()): THREE.Quaternion {
  _m.lookAt(_o, d, Math.abs(d.y) > 0.98 * d.length() ? _x : UP);
  return out.setFromRotationMatrix(_m);
}

/** Time a rest-to-rest burn of `distance` metres at `g` takes, with `flip` seconds of turning in the middle. */
export function burnTime(distance: number, g: number, flip = 8): number {
  const a = g * G0, ta = (-flip + Math.sqrt(flip * flip + 4 * distance / a)) / 2;
  return 2 * ta + flip;
}

interface Compiled { t: number; eval(tau: number, out: State): void }

function compileLeg(leg: Leg, start: State): Compiled {
  const p0 = start.p.clone(), v0 = start.v.clone(), q0 = start.q.clone();
  const vec = (a: Vec | 'here' | undefined, d: V3) => (a === undefined || a === 'here' ? d.clone() : new THREE.Vector3(...a));
  switch (leg.type) {
    case 'hold': {
      const at = vec(leg.at, p0);
      const q = leg.face && leg.face !== 'here' ? facing(new THREE.Vector3(...leg.face).normalize()) : q0;
      return { t: leg.t, eval: (_t, o) => { o.p.copy(at); o.v.set(0, 0, 0); o.q.copy(q); o.thrust = 0; } };
    }
    case 'burn': {
      const a0 = vec(leg.from, p0), b = new THREE.Vector3(...leg.to);
      const d = b.clone().sub(a0), D = d.length(), dir = d.clone().divideScalar(D || 1);
      const fl = leg.flip ?? 8, a = leg.g * G0, ta = (-fl + Math.sqrt(fl * fl + 4 * D / a)) / 2, T = 2 * ta + fl, vm = a * ta;
      const qa = facing(dir), flipQ = new THREE.Quaternion();
      return { t: leg.t, eval: (tau, o) => {
        let s: number, v: number;
        if (tau <= 0) { s = 0; v = 0; o.thrust = 0; }
        else if (tau < ta) { s = 0.5 * a * tau * tau; v = a * tau; o.thrust = 1; }
        else if (tau < ta + fl) { s = 0.5 * a * ta * ta + vm * (tau - ta); v = vm; o.thrust = 0; }
        else if (tau < T) { const r = T - tau; s = D - 0.5 * a * r * r; v = a * r; o.thrust = 1; }
        else { s = D; v = 0; o.thrust = 0; }
        o.p.copy(a0).addScaledVector(dir, s);
        o.v.copy(dir).multiplyScalar(v);
        // Turn end for end about her own up axis while the drive is off.
        const u = smooth(clamp01((tau - ta) / fl));
        o.q.copy(qa).multiply(flipQ.setFromAxisAngle(UP, Math.PI * u));
      } };
    }
    case 'coast': {
      const a0 = vec(leg.from, p0), vel = vec(leg.vel, v0);
      const qs = leg.face ? facing(new THREE.Vector3(...leg.face).normalize()) : q0;
      const w = new THREE.Vector3(...(leg.spin ?? [0, 0, 0])), rate = w.length(), axis = rate > 0 ? w.clone().divideScalar(rate) : UP;
      return { t: leg.t, eval: (tau, o) => {
        o.p.copy(a0).addScaledVector(vel, Math.max(0, tau));
        o.v.copy(vel);
        o.q.copy(qs).multiply(_q1.setFromAxisAngle(axis, rate * Math.max(0, tau)));
        o.thrust = 0;
      } };
    }
    case 'accel': {
      const dir = new THREE.Vector3(...leg.dir).normalize(), qT = facing(dir), a = leg.g * G0;
      const ang = q0.angleTo(qT), rate = leg.turn ?? 1, tr = ang / rate;
      return { t: leg.t, eval: (tau, o) => {
        const t = Math.max(0, tau), pushed = Math.max(0, t - tr);
        o.p.copy(p0).addScaledVector(v0, t).addScaledVector(dir, 0.5 * a * pushed * pushed);
        o.v.copy(v0).addScaledVector(dir, a * pushed);
        o.q.copy(q0).slerp(qT, ang > 1e-6 ? smooth(clamp01(t / tr)) : 1);
        o.thrust = pushed > 0 ? 1 : 0;
      } };
    }
  }
}

/** One actor's whole track, resolved so that `at(t)` is exact. */
class Track {
  legs: Compiled[] = [];
  constructor(legs: Leg[], who: string) {
    if (!legs.length) throw new Error(`Scenario: ${who} has no legs`);
    const first = legs[0];
    if (first.type === 'hold' && (!first.at || first.at === 'here')) throw new Error(`Scenario: ${who} needs a place to start`);
    const st = newState();
    legs.forEach((leg, i) => {
      if (i > 0) this.legs[i - 1].eval(leg.t - this.legs[i - 1].t, st);
      const c = compileLeg(leg, st);
      this.legs.push(c);
      if (i === 0) c.eval(0, st);
    });
  }
  at(t: number, out: State): State {
    let k = 0;
    for (let i = 0; i < this.legs.length; i++) if (this.legs[i].t <= t) k = i;
    this.legs[k].eval(t - this.legs[k].t, out);
    return out;
  }
}

// ------------------------------------------------------------------ the player

export interface PlayerOptions {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  /** Where the star is (it lights everything, and azimuth 0 in a shot is towards it). */
  sunPos(): V3 | null;
  /** A lower third. */
  caption(title: string, text: string): void;
  /** The film has run to its end. */
  end(): void;
}

export interface ScenarioPlayer {
  active: boolean;
  scenario: Scenario | null;
  time: number;
  paused: boolean;
  speed: number;
  start(sc: Scenario): boolean;
  stop(): void;
  /** Advance the film and put the camera on its shot; false once nothing is playing. */
  update(dt: number, camera: THREE.PerspectiveCamera): boolean;
  seek(t: number): void;
  /** What is on screen now, for the debug overlay and tests. */
  info(): Record<string, unknown>;
}

interface Actor { def: ActorDef; track: Track; g: THREE.Group; plumes: DrivePlume[]; st: State }

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _r = new THREE.Vector3(), _tp = new THREE.Vector3();
const _cq = new THREE.Quaternion(), _e = new THREE.Euler();

export function createScenarioPlayer(o: PlayerOptions): ScenarioPlayer {
  let sc: Scenario | null = null;
  let root: THREE.Group | null = null;
  let actors = new Map<string, Actor>();
  let fx: ReturnType<typeof createFx> | null = null;
  let origin = new THREE.Vector3();
  let sunDir = new THREE.Vector3(0, 0, 1);
  let baseFov = 0, lastT = -1, shotIx = -1, capIx = -2, snapCam = true, fxMs = 0;
  const qB = new THREE.Quaternion(), qT = new THREE.Quaternion();
  let ended = false, overlay: HTMLDivElement | null = null;
  const debug = new URLSearchParams(location.search).has('debug');

  const P: ScenarioPlayer = {
    active: false, scenario: null, time: 0, paused: false, speed: 1,

    start(s) {
      P.stop();
      sc = s; P.scenario = s;
      const og = s.frame.origin, r = og.au * 1000;
      origin = new THREE.Vector3(Math.cos(og.angle) * r, og.lift ?? 0, Math.sin(og.angle) * r);
      const sun = o.sunPos();
      sunDir = (sun ? _a.copy(sun).sub(origin) : _a.set(0, 0, 1)).normalize().clone();
      root = new THREE.Group();
      root.position.copy(origin);
      root.scale.setScalar(SOL_UNIT);
      actors = new Map();
      for (const d of s.actors) {
        const tr = s.tracks[d.id];
        if (!tr) throw new Error(`Scenario ${s.id}: no track for ${d.id}`);
        const g = new THREE.Group();
        const model = buildModel(d.model);
        model.scale.setScalar(d.len);
        g.add(model);
        // The model's own fixed drive glows are replaced by ones this scenario can switch.
        const plumes: DrivePlume[] = [];
        const old: THREE.Object3D[] = [];
        model.traverse((n) => { if (n instanceof DrivePlume) old.push(n); });
        for (const p of old) {
          const pp = p as unknown as { radius: number; reach: number; tint: THREE.ColorRepresentation };
          const par = p.parent ?? model;
          par.remove(p);
          if (!d.plume || d.stealth) continue;
          const np = new DrivePlume(pp.radius, pp.reach * d.plume.burn, pp.tint, false);
          np.position.copy(p.position);
          par.add(np);
          plumes.push(np);
        }
        root.add(g);
        actors.set(d.id, { def: d, track: new Track(tr, d.id), g, plumes, st: newState() });
      }
      fx = createFx({
        root, renderer: o.renderer, events: s.events, seed: s.frame.seed,
        stateAt: (id, t, p, v) => { const ac = actors.get(id); if (!ac) return false; ac.track.at(t, ac.st); p.copy(ac.st.p); v.copy(ac.st.v); return true; },
      });
      o.scene.add(root);
      P.active = true; P.time = 0; P.paused = false; P.speed = 1;
      lastT = -1; shotIx = -1; capIx = -2; snapCam = true; ended = false; baseFov = 0;
      if (debug) {
        overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;left:8px;top:8px;z-index:30;font:10px/1.35 ui-monospace,Menlo,monospace;color:#8fdcff;background:rgba(0,0,0,0.55);padding:6px 8px;white-space:pre;pointer-events:none';
        document.body.append(overlay);
      }
      return true;
    },

    stop() {
      if (!P.active && !root) return;
      P.active = false;
      if (root) o.scene.remove(root);
      fx?.dispose();
      fx = null; root = null; actors = new Map(); sc = null; P.scenario = null;
      overlay?.remove(); overlay = null;
      if (cam && baseFov) { cam.fov = baseFov; cam.updateProjectionMatrix(); }
      baseFov = 0;
    },

    seek(t) {
      P.time = Math.min(sc?.time.duration ?? 0, Math.max(0, t));
      snapCam = true; ended = false;
    },

    update(dt, camera) {
      if (!P.active || !sc || !root) return false;
      cam = camera;
      if (!baseFov) baseFov = camera.fov;
      if (!P.paused) P.time += dt * P.speed;
      const dur = sc.time.duration;
      if (P.time >= dur) {
        P.time = dur;
        if (!ended && !P.paused) { ended = true; o.end(); return false; }
      }
      const t = P.time;
      // A jump (a seek, a stall) is a cut: the camera and drive glows must not ease across it.
      const jumped = Math.abs(t - lastT) > 0.5 || lastT < 0;
      lastT = t;

      for (const ac of actors.values()) {
        const d = ac.def, show = (!d.life || (t >= d.life[0] && t <= d.life[1])) && !destroyed(d.id, t);
        ac.g.visible = show;
        ac.track.at(t, ac.st);
        ac.g.position.copy(ac.st.p);
        ac.g.quaternion.copy(ac.st.q);
        for (const pl of ac.plumes) pl.update(show ? ac.st.thrust : 0, t, jumped || P.paused);
      }
      const t0 = performance.now();
      fx?.update(t, camera, o.renderer.domElement.height);
      fxMs = performance.now() - t0;
      root.updateMatrixWorld(true);

      director(t, dt, camera, jumped);

      // Lower thirds: when a caption comes round, say it.
      const ci = sc.captions.findIndex((c) => t >= c.t && t < c.t + c.dur);
      if (ci !== capIx) { capIx = ci; if (ci >= 0) o.caption(sc.captions[ci].title, sc.captions[ci].text); }
      if (overlay) overlay.textContent = describe();
      return true;
    },

    info() {
      const ac: Record<string, unknown> = {};
      for (const a of actors.values()) ac[a.def.id] = { conf: a.def.confidence, standin: !!a.def.standin, invented: !!a.def.invented, visible: a.g.visible, p: a.st.p.toArray().map(Math.round), thrust: a.st.thrust };
      return { id: sc?.id, t: P.time, duration: sc?.time.duration, paused: P.paused, shot: shotIx, caption: capIx, actors: ac, fxMs, fx: fx?.stats(), camera: cam ? cam.position.toArray() : null };
    },
  };
  let cam: THREE.PerspectiveCamera | null = null;

  const destroyed = (id: string, t: number) => !!sc?.events.some((e) => e.type === 'hit' && e.target === id && e.damage === 'destroy' && t >= e.t);

  function describe(): string {
    if (!sc) return '';
    const shot = sc.shots[shotIx];
    const lines = [`${sc.id}  t ${P.time.toFixed(1)} / ${sc.time.duration}${P.paused ? '  PAUSED' : ''}`, `shot ${shotIx}: ${shot ? `${shot.mode ?? 'orbit'} ${shot.id}` : '-'}  fx ${fxMs.toFixed(2)} ms`];
    for (const a of actors.values()) lines.push(`${a.def.id.padEnd(9)} ${a.def.confidence}${a.def.standin ? ' standin' : ''}${a.def.invented ? ' invented' : ''}${a.g.visible ? '' : ' (hidden)'}`);
    return lines.join('\n');
  }

  /** Metres in the frame to scene units. */
  const toWorld = (m: V3, out: V3) => out.copy(m).multiplyScalar(SOL_UNIT).add(origin);

  function director(t: number, dt: number, camera: THREE.PerspectiveCamera, jumped: boolean) {
    if (!sc) return;
    let ix = -1;
    sc.shots.forEach((s, i) => { if (t >= s.t0) ix = i; });
    if (ix < 0) ix = 0;
    const s = sc.shots[ix], ac = actors.get(s.id);
    if (!ac) return;
    if (ix !== shotIx) { shotIx = ix; snapCam = true; }
    const k = clamp01((t - s.t0) / s.secs);
    const mode = s.mode ?? 'orbit';
    const rad = ac.def.len / 2;
    const subj = ac.st.p;
    const pos = _a, look = _b;
    look.copy(subj);
    if (mode === 'orbit') {
      const dist = s.from[0] + (s.to[0] - s.from[0]) * k, az = s.from[1] + (s.to[1] - s.from[1]) * k, el = s.from[2] + (s.to[2] - s.from[2]) * k;
      _r.crossVectors(UP, sunDir).normalize();
      pos.copy(sunDir).multiplyScalar(Math.cos(az) * Math.cos(el)).addScaledVector(_r, Math.sin(az) * Math.cos(el)).addScaledVector(UP, Math.sin(el)).multiplyScalar(dist * rad).add(subj);
    } else if (mode === 'static') {
      pos.set(...(s.at ?? [0, 0, 0]));
    } else if (mode === 'pov') {
      const o2 = s.offset ?? [0, 0, 0];
      pos.set(...o2).applyQuaternion(ac.st.q).add(subj);
      const tg = actors.get(s.look ?? '');
      if (tg) look.copy(tg.st.p);
      else look.copy(pos).add(_c.set(0, 0, -1).applyQuaternion(ac.st.q));
    } else {
      // Behind her along the way she is going (or points, if she is nearly still).
      const h = _c.copy(ac.st.v);
      if (h.length() < 3) h.set(0, 0, -1).applyQuaternion(ac.st.q);
      h.normalize();
      pos.copy(subj).addScaledVector(h, -(s.back ?? rad * 4)).addScaledVector(UP, s.up ?? rad);
    }
    // Slow push in and out of the lens, as the tour does.
    const fov = (s.fov ?? 40) * (1.03 - 0.06 * k);
    toWorld(pos, camera.position);
    _tp.copy(look);
    toWorld(_tp, _tp);
    camera.up.set(0, 1, 0);
    camera.lookAt(_tp);
    // A touch off the middle of the frame, as the tour places its subjects.
    if (mode !== 'pov') { _e.set(0, 0.05, 0); camera.quaternion.multiply(_cq.setFromEuler(_e)); }
    qT.copy(camera.quaternion);
    if (snapCam || jumped) { qB.copy(qT); snapCam = false; }
    else qB.slerp(qT, 1 - Math.exp(-5.5 * Math.min(dt, 0.05)));
    // Hand-held: the same slow breathing sway as the tour.
    const st = t;
    _e.set(0.0013 * (Math.sin(st * 0.7) + 0.5 * Math.sin(st * 1.9 + 2)), 0.0016 * (Math.sin(st * 0.9 + 1.3) + 0.6 * Math.sin(st * 2.1 + 0.4)), 0.0012 * Math.sin(st * 0.5 + 0.7), 'YXZ');
    camera.quaternion.copy(qB).multiply(_cq.setFromEuler(_e));
    if (Math.abs(camera.fov - fov) > 0.02) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }

  return P;
}
