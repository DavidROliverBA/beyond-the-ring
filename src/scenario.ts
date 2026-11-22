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
import { buildModel, modelLength, type ShipModel } from './ships';
import { DrivePlume } from './plume';
import { SOL_UNIT } from './traffic';
import type { Shot } from './tour';
import { createFx, type Cue } from './scenarioFx';
import type { Sfx } from './sound';
import { G0, transit, transitAt } from './transit';

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
  /** Grows from `from` of her size at `t0` to her whole size at `t1` (seconds), about her origin; before `t0` she is at `from`. */
  grow?: { t0: number; t1: number; from: number };
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
  | { t: number; type: 'accel'; dir: Vec; g: number; turn?: number }
  /** A wreck: the velocity she has (or `vel`), turning end over end on `spin` (radians a second about each axis) with a slower wobble across it. */
  | { t: number; type: 'tumble'; from?: Vec | 'here'; vel?: Vec | 'here'; spin: Vec; wobble?: number }
  /** Keep station on another actor, `offset` metres from her (in the frame), easing in over `ease` seconds from wherever she is.
   *  Her nose points at `aim` (another actor) or takes the target's own heading if `match`, or stays as it was.
   *  The target must be listed before her in `actors`. For escorts, attackers on a run, and a boat leaving a hangar. */
  | { t: number; type: 'follow'; target: string; offset?: Vec; ease?: number; aim?: string; match?: boolean };

export type EventDef =
  /** A torpedo or missile launched at `t` that reaches `to` at time `hit`, accelerating steadily from rest on the launcher (shape and speed invented). */
  | { t: number; type: 'fire'; weapon: 'torpedo' | 'missile'; from: string; to: string; hit: number; count?: number; invented?: boolean;
      /** A name the PDC streams can aim along. */ id?: string;
      /** Missile `k` is shot down at this time (0 or missing: it gets through), and bursts in a small flash instead of hitting. */ killed?: (number | 0)[];
      /** Fireball size of a warhead that gets through, metres. */ warhead?: number }
  /** The target is struck at `t`. `nuke` is the flash and shell; `fireball` an ordinary ship-killing blast; `destroy` removes the actor. */
  | { t: number; type: 'hit'; target: string; fx: 'nuke' | 'fireball'; damage: 'destroy'; radius?: number }
  /** Wreckage thrown from an actor's place at `t`. */
  | { t: number; type: 'debris'; from: string; n: number; seed: number; speed?: number; chunks?: number; scale?: number }
  /** Sound cue: space is quiet here: the score fades out for `dur` seconds. */
  | { t: number; type: 'silence'; dur: number }
  /** A stream of point-defence rounds from `from` (at `mounts`, metres from her middle, in turn), in bursts of `burst` seconds a `gap` apart,
   *  at actor `at` (a share `hitRate` land on her hull) or along the line of the missiles named `missile` (the `id` of a `fire` event). Round speed invented. */
  | { t: number; type: 'pdc'; from: string; dur: number; at?: string; missile?: string; mounts?: Vec[]; rate?: number; burst?: number; gap?: number; hitRate?: number; spread?: number; speed?: number }
  /** A railgun slug fired at `to` from `from` (`mount` metres from her middle), `count` times `gap` seconds apart. Slug speed invented. */
  | { t: number; type: 'rail'; from: string; to: string; mount?: Vec; speed?: number; count?: number; gap?: number; hit?: boolean; size?: number }
  /** A strike on a hull: a flash and sparks at `at` (metres from her middle, in her own axes; her nose is -z). */
  | { t: number; type: 'impact'; target: string; at: Vec; size?: number }
  /** A hole in the hull: fire at it, then air venting for `dur` seconds, with plating and ice in the plume. */
  | { t: number; type: 'breach'; target: string; at: Vec; dur: number; size?: number }
  /** A secondary explosion on a hull: a fireball of `size` metres and torn plating (the ship is not lost). */
  | { t: number; type: 'blast'; target: string; at: Vec; size?: number }
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
  /** What the sound is: `ship` is the camera inside the ship `id` (the hull carries her own guns, her drive and what strikes her);
   *  `exterior` is outside, where space is silent and only the score plays. Default: `ship` for pov shots, `exterior` otherwise. */
  hear?: 'ship' | 'exterior';
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
    /** Pin the film to a body in the scene instead: the frame's origin is that body's centre (it follows the body as it goes round the star)
     *  and, if `sunward`, the frame's +x points at the star, so the sky and the light are the same every time whatever the date. `origin` is the fallback. */
    body?: { id: string; sunward?: boolean };
    seed: number;
  };
  time: { duration: number; storyMinutes?: number; scale: 'real' | 'compressed'; note?: string };
  actors: ActorDef[];
  tracks: Record<string, Leg[]>;
  events: EventDef[];
  shots: ScnShot[];
  captions: Caption[];
  /** Where the viewer can jump to: a start time and a short name (our words), the first at 0. */
  chapters?: { t: number; title: string }[];
  /** Choices made where the sources disagree. */
  notes?: string[];
}

// ------------------------------------------------------------------ the legs

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
  return transit(distance, g * G0, flip).time;
}

interface Compiled { t: number; eval(tau: number, out: State): void }

function compileLeg(leg: Leg, start: State, look: (id: string) => Track | undefined, first: boolean): Compiled {
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
      const fl = leg.flip ?? 8, tr = transit(D, leg.g * G0, fl), ta = tr.burn;
      const qa = facing(dir), flipQ = new THREE.Quaternion();
      return { t: leg.t, eval: (tau, o) => {
        const st = transitAt(tr, tau), s = st.s, v = st.v;
        o.thrust = st.thrust ? 1 : 0;
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
    case 'tumble': {
      const a0 = vec(leg.from, p0), vel = vec(leg.vel, v0);
      const w = new THREE.Vector3(...leg.spin), rate = w.length(), axis = rate > 0 ? w.clone().divideScalar(rate) : UP, wob = leg.wobble ?? 0.3;
      return { t: leg.t, eval: (tau, o) => {
        const t = Math.max(0, tau);
        o.p.copy(a0).addScaledVector(vel, t);
        o.v.copy(vel);
        o.q.copy(q0).multiply(_q1.setFromAxisAngle(axis, rate * t)).multiply(_q2.setFromAxisAngle(_x, rate * wob * t));
        o.thrust = 0;
      } };
    }
    case 'follow': {
      const tg = look(leg.target);
      if (!tg) throw new Error(`Scenario: follow of "${leg.target}", which is not listed before it`);
      const ai = leg.aim ? look(leg.aim) : undefined;
      if (leg.aim && !ai) throw new Error(`Scenario: aim at "${leg.aim}", which is not listed before it`);
      const off = new THREE.Vector3(...(leg.offset ?? [0, 0, 0])), ease = first ? 0 : (leg.ease ?? 0);
      const s0 = newState(), s1 = newState(), s2 = newState();
      tg.at(leg.t, s0);
      const rel0 = first ? new THREE.Vector3() : p0.clone().sub(s0.p).sub(off);
      const qT = new THREE.Quaternion(), dir = new THREE.Vector3();
      return { t: leg.t, eval: (tau, o) => {
        const t = leg.t + Math.max(0, tau);
        tg.at(t, s1);
        const k = ease > 0 ? smooth(clamp01(tau / ease)) : 1;
        o.p.copy(s1.p).add(off).addScaledVector(rel0, 1 - k);
        o.v.copy(s1.v);
        o.thrust = 0;
        if (ai) { ai.at(t, s2); dir.copy(s2.p).sub(o.p); if (dir.lengthSq() > 1e-6) facing(dir.normalize(), qT); else qT.copy(q0); }
        else if (leg.match) qT.copy(s1.q);
        else qT.copy(q0);
        if (first) o.q.copy(qT); else o.q.copy(q0).slerp(qT, k);
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
  constructor(legs: Leg[], who: string, look: (id: string) => Track | undefined = () => undefined) {
    if (!legs.length) throw new Error(`Scenario: ${who} has no legs`);
    const first = legs[0];
    if (first.type === 'hold' && (!first.at || first.at === 'here')) throw new Error(`Scenario: ${who} needs a place to start`);
    const st = newState();
    legs.forEach((leg, i) => {
      if (i > 0) this.legs[i - 1].eval(leg.t - this.legs[i - 1].t, st);
      const c = compileLeg(leg, st, look, i === 0);
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
  /** Where a body of the scene is now (scene units), for a film pinned to a body (`frame.body`). */
  bodyPos?(id: string): V3 | null;
  /** A lower third. */
  caption(title: string, text: string): void;
  /** Take the lower third down (a seek or the end of a caption: it must not outlive its time). */
  captionOff?(): void;
  /** The film has run to its end. */
  end(): void;
  /** The camera the film is shown through (the shaders are compiled for it before the first frame). */
  camera?: THREE.PerspectiveCamera;
  /** Compile the shaders and draw the scene once into the off-screen buffer it is really drawn into, so nothing is built mid-film. */
  warm?(scene: THREE.Scene, camera: THREE.Camera): void;
  /** A sound from the film, already judged audible from the camera's seat; `vol` 0..1.3. */
  sfx?(kind: Sfx, vol: number, o: { dur?: number; rate?: number; burst?: number; gap?: number }): void;
  /** What the camera hears each frame: `ship` inside a hull (then `drive` is her drive, 0..1), or outside, where it is silent. */
  hear?(h: { ship: boolean; drive: number }): void;
  /** The score fades out for this many seconds. */
  duck?(secs: number): void;
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
/** How far from the film's place (scene units, 1/1000 AU) the system is drawn once, off screen, before the film starts. */
const WARM_RADIUS = 1e9;
const isInside = (n: THREE.Object3D, top: THREE.Object3D) => { for (let p: THREE.Object3D | null = n; p; p = p.parent) if (p === top) return true; return false; };

export function createScenarioPlayer(o: PlayerOptions): ScenarioPlayer {
  let sc: Scenario | null = null;
  let root: THREE.Group | null = null;
  let actors = new Map<string, Actor>();
  let fx: ReturnType<typeof createFx> | null = null;
  let origin = new THREE.Vector3();
  let sunDir = new THREE.Vector3(0, 0, 1);
  let baseFov = 0, lastT = -1, cutNext = false, shotIx = -1, capIx = -2, snapCam = true, fxMs = 0, prewarmMs = 0;
  let loading = false;
  let cues: Cue[] = [], cueIx = 0, soundT = 0, hearing = { ship: false, actor: '' };
  const _st = newState();
  let rotY = 0;
  /** Put the frame where it belongs: pinned in space, or on its body (which goes round the star, so this is done every frame). */
  function place() {
    if (!sc || !root) return;
    const og = sc.frame.origin, r = og.au * 1000, bp = sc.frame.body ? o.bodyPos?.(sc.frame.body.id) : null;
    if (bp) origin.copy(bp); else origin.set(Math.cos(og.angle) * r, og.lift ?? 0, Math.sin(og.angle) * r);
    const sun = o.sunPos();
    const toSun = (sun ? _a.copy(sun).sub(origin) : _a.set(0, 0, 1)).clone();
    rotY = 0;
    if (bp && sc.frame.body?.sunward) {
      // Turn the frame about the vertical so that +x points at the star: then sunDir in the frame is +x.
      rotY = Math.atan2(-toSun.z, toSun.x);
      sunDir.set(1, 0, 0);
    } else sunDir.copy(toSun).normalize();
    root.position.copy(origin);
    root.rotation.y = rotY;
  }
  const qB = new THREE.Quaternion(), qT = new THREE.Quaternion();
  let ended = false, overlay: HTMLDivElement | null = null;
  const debug = new URLSearchParams(location.search).has('debug');

  const P: ScenarioPlayer = {
    active: false, scenario: null, time: 0, paused: false, speed: 1,

    start(s) {
      P.stop();
      sc = s; P.scenario = s;
      root = new THREE.Group();
      place();
      root.scale.setScalar(SOL_UNIT);
      actors = new Map();
      for (const d of s.actors) {
        const tr = s.tracks[d.id];
        if (!tr) throw new Error(`Scenario ${s.id}: no track for ${d.id}`);
        const g = new THREE.Group();
        g.name = d.id;
        const model = buildModel(d.model, d.name.toLowerCase());
        model.scale.setScalar(d.len / modelLength(d.model));
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
        actors.set(d.id, { def: d, track: new Track(tr, d.id, (id) => actors.get(id)?.track), g, plumes, st: newState() });
      }
      fx = createFx({
        root, renderer: o.renderer, events: s.events, seed: s.frame.seed,
        stateAt: (id, t, out) => { const ac = actors.get(id); if (!ac) return false; ac.track.at(t, _st); out.p.copy(_st.p); out.v.copy(_st.v); out.q.copy(_st.q); return true; },
        sizeOf: (id) => actors.get(id)?.def.len ?? 50,
      });
      cues = fx.cues;
      o.scene.add(root);
      // Draw every part of the film once, off screen, before it starts: compiling a shader is not enough (the driver builds its pipeline for the
      // blend and buffer state on the first real draw, and that stalls a frame at the first flash). So show everything, never culled, and draw.
      loading = false;
      if (o.warm && o.camera) {
        root.updateMatrixWorld(true);
        const saved: [THREE.Object3D, boolean, boolean][] = [];
        root.traverse((n) => { saved.push([n, n.visible, n.frustumCulled]); n.visible = true; n.frustumCulled = false; });
        const undo = fx.prewarm();
        // The rest of the system round the film's place (rocks, traffic) is drawn too, never culled, so that it is uploaded now and not
        // the first time a camera turns to it.
        const hid: THREE.Object3D[] = [], unc: THREE.Object3D[] = [];
        o.scene.traverse((n) => {
          const m = n as THREE.Mesh;
          if (!(m.isMesh || (n as THREE.Points).isPoints) || isInside(n, root!)) return;
          if (n.getWorldPosition(_tp).distanceTo(origin) > WARM_RADIUS) { if (n.visible) { n.visible = false; hid.push(n); } } else if (n.frustumCulled) { n.frustumCulled = false; unc.push(n); }
        });
        const t0 = performance.now();
        try { o.warm(o.scene, o.camera); } catch { /* an older driver: it will compile on first use */ }
        prewarmMs = performance.now() - t0;
        undo();
        for (const [n, v, c] of saved) { n.visible = v; n.frustumCulled = c; }
        for (const n of hid) n.visible = true;
        for (const n of unc) n.frustumCulled = true;
      }
      cueIx = 0; soundT = 0;
      P.active = true; P.time = 0; P.paused = false; P.speed = 1;
      lastT = -1; cutNext = false; shotIx = -1; capIx = -2; snapCam = true; ended = false; baseFov = 0;
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
      fx?.dispose(); o.hear?.({ ship: false, drive: 0 });
      fx = null; root = null; actors = new Map(); sc = null; P.scenario = null;
      overlay?.remove(); overlay = null;
      if (cam && baseFov) { cam.fov = baseFov; cam.updateProjectionMatrix(); }
      baseFov = 0;
    },

    seek(t) {
      P.time = Math.min(sc?.time.duration ?? 0, Math.max(0, t));
      // Every seek is a cut, however short: camera, drive glows, sound cues and the lower third all start fresh at the new time.
      snapCam = true; ended = false; cutNext = true;
    },

    update(dt, camera) {
      if (!P.active || !sc || !root) return false;
      cam = camera;
      if (!baseFov) baseFov = camera.fov;
      if (sc.frame.body) place();
      if (!P.paused && !loading) P.time += dt * P.speed;
      const dur = sc.time.duration;
      if (P.time >= dur) {
        P.time = dur;
        if (!ended && !P.paused) { ended = true; o.end(); return false; }
      }
      const t = P.time;
      // A jump (a seek, a stall) is a cut: the camera and drive glows must not ease across it.
      const jumped = cutNext || Math.abs(t - lastT) > 0.5 || lastT < 0;
      cutNext = false;
      lastT = t;

      for (const ac of actors.values()) {
        const d = ac.def, show = (!d.life || (t >= d.life[0] && t <= d.life[1])) && !destroyed(d.id, t);
        ac.g.visible = show;
        ac.track.at(t, ac.st);
        ac.g.position.copy(ac.st.p);
        ac.g.quaternion.copy(ac.st.q);
        if (d.grow) ac.g.scale.setScalar(d.grow.from + (1 - d.grow.from) * smooth(clamp01((t - d.grow.t0) / (d.grow.t1 - d.grow.t0))));
        for (const pl of ac.plumes) pl.update(show ? ac.st.thrust : 0, t, jumped || P.paused);
      }
      const t0 = performance.now();
      fx?.update(t, camera, o.renderer.domElement.height);
      fxMs = performance.now() - t0;
      root.updateMatrixWorld(true);

      director(t, dt, camera, jumped);
      sound(t, jumped);

      // Lower thirds: when a caption comes round, say it.
      // The caption belongs to its time: on a cut it is put up again (or taken down if none is due), and it stays up while paused.
      const ci = sc.captions.findIndex((c) => t >= c.t && t < c.t + c.dur);
      if (ci !== capIx || (jumped && ci >= 0)) {
        capIx = ci;
        if (ci >= 0) o.caption(sc.captions[ci].title, sc.captions[ci].text); else o.captionOff?.();
      }
      if (overlay) overlay.textContent = describe();
      return true;
    },

    info() {
      const ac: Record<string, unknown> = {};
      for (const a of actors.values()) ac[a.def.id] = { conf: a.def.confidence, standin: !!a.def.standin, invented: !!a.def.invented, visible: a.g.visible, p: a.st.p.toArray().map(Math.round), q: a.st.q.toArray().map((x) => +x.toFixed(3)), scale: a.g.scale.x, thrust: a.st.thrust, off: cam ? +(_c.copy(a.g.getWorldPosition(_tp)).sub(cam.position).normalize().angleTo(_r.set(0, 0, -1).applyQuaternion(cam.quaternion)) * 57.3).toFixed(1) : null };
      return { id: sc?.id, t: P.time, prewarmMs, hearing, sfxFired, shotDist: Math.round(shotDist), duration: sc?.time.duration, paused: P.paused, shot: shotIx, caption: capIx, actors: ac, fxMs, fx: fx?.stats(), camera: cam ? cam.position.toArray() : null };
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

  let sfxFired = 0, shotDist = 0;
  /** Which of the film's sounds the camera can hear, and the score's fades. Only played forward in real time: a seek or a pause is silent. */
  function sound(t: number, jumped: boolean) {
    if (!sc) return;
    const s = sc.shots[shotIx];
    const ship = !!s && (s.hear ?? (s.mode === 'pov' ? 'ship' : 'exterior')) === 'ship';
    const ha = ship && s ? actors.get(s.id) : undefined;
    hearing = { ship, actor: ship && s ? s.id : '' };
    o.hear?.({ ship, drive: ha && ha.g.visible ? ha.st.thrust : 0 });
    if (jumped || P.paused || t < soundT) {
      // Jump back or forward without a noise: skip to the first cue after now.
      cueIx = cues.findIndex((c) => c.t > t);
      if (cueIx < 0) cueIx = cues.length;
      soundT = t;
      return;
    }
    while (cueIx < cues.length && cues[cueIx].t <= t) {
      const c = cues[cueIx++];
      if (c.kind === 'duck') { o.duck?.(c.dur ?? 6); continue; }
      if (!ship || !ha) continue;
      let vol = c.vol;
      if (c.who !== s.id) {
        // Not hers: she feels it only if it is near enough to shake her.
        if (!c.pos || !c.r || (c.kind !== 'boom' && c.kind !== 'impact')) continue;
        const d = c.pos.distanceTo(ha.st.p);
        if (d > c.r) continue;
        vol *= 0.7 * Math.sqrt(1 - d / c.r);
      }
      sfxFired++;
      o.sfx?.(c.kind, vol, { dur: c.dur, rate: c.rate, burst: c.burst, gap: c.gap });
    }
    soundT = t;
  }

  /** Metres in the frame to scene units. */
  const toWorld = (m: V3, out: V3) => out.copy(m).applyAxisAngle(UP, rotY).multiplyScalar(SOL_UNIT).add(origin);

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
    shotDist = pos.distanceTo(subj);
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
