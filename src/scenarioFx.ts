// Effects for the scenario engine (E3.2.c): torpedoes and their trails, point-defence (PDC) tracer bursts, railgun
// slugs with a lingering trail, hull impacts, breaches with venting gas, secondary explosions, nuclear and
// ordinary fireballs, debris. Every picture is a pure function of the scenario time, so a seek lands on the
// same frame each time (anything random comes from a hash of the event and the index, never from a running
// generator). Everything is additive, in colours well above 1, so the bloom pass gives the flashes their halo.
// Positions are metres in the scenario's frame (the root group is scaled to the scene), so the shaders do their
// geometry in metres, and keep the logdepth chunks so they sort right in either depth scheme.
//
// Draw calls: one for the points (glows, sparks, trails, gas, embers), one for the instanced tracer streaks,
// one for the instanced hull chunks, a small pool of fireball meshes. Three point lights, always present (so the
// scene's shaders compile once and do not change mid-film), are lent to the brightest flashes.
//
// Drive flares are the ships' own `DrivePlume`s, switched by the player.

import * as THREE from 'three';
import { SOL_UNIT } from './traffic';
import type { EventDef, Vec } from './scenario';
import type { Sfx } from './sound';

type V3 = THREE.Vector3;

const POINT_V = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float aSize; attribute vec4 aCol;
uniform float uFocal; uniform float uUnit;
varying vec4 vCol;
void main() {
  vCol = aCol;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // aSize is in metres; mv is in scene units (the root is scaled), so convert, then to pixels.
  gl_PointSize = clamp(aSize * uUnit * uFocal / max(-mv.z, 1e-30), 1.5, 260.0);
  #include <logdepthbuf_vertex>
}`;
const POINT_F = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec4 vCol;
void main() {
  #include <logdepthbuf_fragment>
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = exp(-d * d * 3.5) * (1.0 - smoothstep(0.8, 1.0, d));
  gl_FragColor = vec4(vCol.rgb * vCol.a * a, 1.0);
}`;

// A streak: a quad from A to B (metres), turned to face the camera, `width` metres across but never under two pixels.
// `uv.y` runs from the tail (0) to the head (1); `aW.y` is how sharply the brightness rises towards the head.
const STREAK_V = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute vec3 iA; attribute vec3 iB; attribute vec4 iCol; attribute vec2 iW;
uniform float uFocal; uniform float uUnit;
varying vec4 vCol; varying vec2 vUv; varying float vSharp;
void main() {
  vec3 a = (modelViewMatrix * vec4(iA, 1.0)).xyz / uUnit;
  vec3 b = (modelViewMatrix * vec4(iB, 1.0)).xyz / uUnit;
  vec3 axis = b - a, mid = 0.5 * (a + b);
  vec3 side = cross(axis, mid);
  float l = length(side);
  side = l > 1e-9 ? side / l : vec3(1.0, 0.0, 0.0);
  float along = position.y + 0.5;
  vec3 p = mix(a, b, along);
  float z = max(-p.z, 1e-6);
  float w = max(iW.x, 2.2 * z / uFocal);
  p += side * position.x * w * 2.0;
  vCol = iCol; vUv = vec2(position.x * 2.0, along); vSharp = iW.y;
  gl_Position = projectionMatrix * vec4(p * uUnit, 1.0);
  #include <logdepthbuf_vertex>
}`;
const STREAK_F = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec4 vCol; varying vec2 vUv; varying float vSharp;
void main() {
  #include <logdepthbuf_fragment>
  float across = exp(-vUv.x * vUv.x * 2.6);
  float head = pow(clamp(vUv.y, 0.0, 1.0), vSharp) * (1.0 - 0.15 * smoothstep(0.9, 1.0, vUv.y));
  gl_FragColor = vec4(vCol.rgb * vCol.a * across * head, 1.0);
}`;

const BALL_V = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
const BALL_F = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCol; uniform float uRim;
varying vec3 vN; varying vec3 vV;
void main() {
  #include <logdepthbuf_fragment>
  float f = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
  // uRim 0: a glowing ball, brightest in the middle. uRim 1: a thin bright shell, brightest at the edge.
  float k = mix(0.04 + pow(f, 2.2), pow(1.0 - f, 3.0), uRim);
  gl_FragColor = vec4(uCol * k, 1.0);
}`;

const ballMat = (rim: number) => new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Color(0) }, uRim: { value: rim } },
  vertexShader: BALL_V, fragmentShader: BALL_F,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
});

/** Where an actor is. */
export interface Pose { p: V3; v: V3; q: THREE.Quaternion }

/** A sound that goes with something on screen. `who` is the ship whose hull carries it; `pos`/`r` let a ship near enough feel it too. */
export interface Cue { t: number; kind: Sfx | 'duck'; vol: number; who: string | null; pos?: V3; r?: number; dur?: number; rate?: number; burst?: number; gap?: number }

export interface FxOptions {
  root: THREE.Group;
  renderer: THREE.WebGLRenderer;
  events: EventDef[];
  seed: number;
  /** Where an actor is and how it moves at time t; false if there is no such actor. */
  stateAt(id: string, t: number, out: Pose): boolean;
  /** An actor's length in metres. */
  sizeOf(id: string): number;
}

const MAX_POINTS = 12000, MAX_STREAKS = 1800, TRAIL = 240, TRAIL_STEP = 0.02;
const BALLS = 4, SHELLS = 2, MAX_ROUND_FLIGHT = 2.2;
const _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _q2 = new THREE.Quaternion(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _mm = new THREE.Matrix4(), _d = new THREE.Vector3(), _pu = new THREE.Vector3(), _pw = new THREE.Vector3();
const _pose: Pose = { p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion() };
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** A repeatable number in [0, 1) from three integers: the same answer every time, whatever order frames are drawn in. */
function hash(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
/** A direction on the unit sphere from three integers. */
function sphere(a: number, b: number, c: number, out: V3): V3 {
  const u = hash(a, b, c) * 2 - 1, th = hash(a, b, c + 101) * Math.PI * 2, w = Math.sqrt(1 - u * u);
  return out.set(w * Math.cos(th), u, w * Math.sin(th));
}

interface Missile { id?: string; from: string; to: string; k: number; t0: number; tHit: number; tEnd: number; p0: V3; p1: V3; killed: boolean }
/** A bright event with a place: it draws a glow and sparks and lends a light. Attached to a ship (`ship` + `local`) or fixed in space. */
interface Flash {
  t: number; kind: 'spark' | 'fire' | 'kill' | 'muzzle' | 'rail'; size: number; L: number; dur: number; seed: number; sparks: number;
  ship?: string; local: V3; pos0: V3; vel0: V3; nrm: V3;
}
interface Chunk { tb: number; p0: V3; v: V3; axis: V3; rate: number; q0: THREE.Quaternion; sx: number; sy: number; sz: number }
interface Ember { tb: number; p0: V3; v: V3; size: number }
interface Gas { t: number; dur: number; size: number; ship: string; local: V3; n: number; p0: V3[]; d: V3[]; v0: V3[]; seed: number }
interface Round { muz: V3; dir: V3; dist: number; speed: number; ti: number; endLocal: V3 | null; ship: string | null }
interface Rail { t: number; speed: number; muz: V3; dir: V3; dist: number; hit: boolean }
interface Pdc { e: Extract<EventDef, { type: 'pdc' }>; rounds: Map<number, Round>; ix: number; rpb: number; cycle: number }
interface Blast { t: number; pos: V3; vel: V3; radius: number; nuke: boolean }

export function createFx(o: FxOptions) {
  const missiles: Missile[] = [], flashes: Flash[] = [], chunks: Chunk[] = [], embers: Ember[] = [], gases: Gas[] = [], rails: Rail[] = [], pdcs: Pdc[] = [], blasts: Blast[] = [];
  const cues: Cue[] = [];
  const byId = new Map<string, Missile[]>();

  const pose = (id: string, t: number, out: Pose = { p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion() }) => { o.stateAt(id, t, out); return out; };
  /** A place on a ship (metres from her middle, in her own axes) at time t. */
  const worldOf = (id: string, local: V3, t: number, out: V3) => { o.stateAt(id, t, _pose); return out.copy(local).applyQuaternion(_pose.q).add(_pose.p); };
  const vec = (a: Vec | undefined, d: V3 = new THREE.Vector3()) => (a ? new THREE.Vector3(...a) : d);

  /** Missile position at time t (metres). */
  const missileAt = (m: Missile, t: number, out: V3) => { const f = Math.max(0, Math.min(1, (t - m.t0) / (m.tHit - m.t0))); return out.copy(m.p0).lerp(m.p1, f * f); };

  const addFlash = (f: Partial<Flash> & Pick<Flash, 't' | 'kind' | 'size' | 'L' | 'dur'>) => {
    const full: Flash = { seed: flashes.length * 7 + 1, sparks: 24, local: new THREE.Vector3(), pos0: new THREE.Vector3(), vel0: new THREE.Vector3(), nrm: new THREE.Vector3(0, 1, 0), ...f };
    if (full.ship) {
      o.stateAt(full.ship, full.t, _pose);
      full.pos0 = full.local.clone().applyQuaternion(_pose.q).add(_pose.p);
      full.vel0 = _pose.v.clone();
      full.nrm = full.local.clone().applyQuaternion(_pose.q).normalize();
      if (full.nrm.lengthSq() < 0.5) full.nrm.set(0, 1, 0);
    }
    flashes.push(full);
    return full;
  };
  /** A point on a ship's hull facing `towards` (a direction in the frame), in her own axes, metres. Her body is long and narrow: an ellipsoid. */
  const hullPoint = (id: string, t: number, towards: V3, jitter: number, seed: number, out: V3) => {
    const len = o.sizeOf(id);
    o.stateAt(id, t, _pose);
    const a = len * 0.5, b = len * 0.14;
    _d.copy(towards).normalize().applyQuaternion(_q2.copy(_pose.q).invert());
    _d.x += (hash(seed, 1) - 0.5) * jitter; _d.y += (hash(seed, 2) - 0.5) * jitter; _d.z += (hash(seed, 3) - 0.5) * jitter;
    _d.normalize();
    const k = 1 / Math.sqrt((_d.x / b) ** 2 + (_d.y / b) ** 2 + (_d.z / a) ** 2);
    return out.copy(_d).multiplyScalar(k);
  };

  const debrisCloud = (id: string, t: number, n: number, seed: number, speed: number, nChunks: number, scale: number) => {
    const pos = new THREE.Vector3(), vel = new THREE.Vector3();
    o.stateAt(id, t, _pose); pos.copy(_pose.p); vel.copy(_pose.v);
    for (let i = 0; i < n + nChunks; i++) {
      const d = new THREE.Vector3(hash(seed, i, 1) * 2 - 1, (hash(seed, i, 2) * 2 - 1) * 0.7, hash(seed, i, 3) * 2 - 1).normalize();
      const k = hash(seed, i, 4);
      if (i < n) embers.push({ tb: t, p0: pos, v: vel.clone().addScaledVector(d, speed * (0.08 + 0.92 * k * k)), size: (3 + hash(seed, i, 5) * 9) * scale });
      else chunks.push({
        tb: t, p0: pos, v: vel.clone().addScaledVector(d, speed * 0.6 * (0.08 + 0.92 * k * k)),
        axis: new THREE.Vector3(hash(seed, i, 6) - 0.5, hash(seed, i, 7) - 0.5, hash(seed, i, 8) - 0.5).normalize(), rate: 0.2 + hash(seed, i, 9) * 1.2,
        q0: new THREE.Quaternion().setFromEuler(new THREE.Euler(hash(seed, i, 10) * 6, hash(seed, i, 11) * 6, hash(seed, i, 12) * 6)),
        sx: (4 + hash(seed, i, 13) * 16) * scale, sy: (2 + hash(seed, i, 14) * 9) * scale, sz: (4 + hash(seed, i, 15) * 20) * scale,
      });
    }
  };
  /** Lumps of plating torn off by an explosion on the hull. */
  const plating = (f: Flash, size: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const d = new THREE.Vector3(hash(f.seed, i, 41) - 0.5, hash(f.seed, i, 42) - 0.5, hash(f.seed, i, 43) - 0.5).normalize().add(f.nrm).normalize();
      chunks.push({
        tb: f.t, p0: f.pos0.clone(), v: f.vel0.clone().addScaledVector(d, 10 + hash(f.seed, i, 44) * 90),
        axis: new THREE.Vector3(hash(f.seed, i, 45) - 0.5, hash(f.seed, i, 46) - 0.5, hash(f.seed, i, 47) - 0.5).normalize(), rate: 0.3 + hash(f.seed, i, 48) * 1.5,
        q0: new THREE.Quaternion().setFromEuler(new THREE.Euler(hash(f.seed, i, 49) * 6, hash(f.seed, i, 50) * 6, 0)),
        sx: size * (0.05 + hash(f.seed, i, 51) * 0.2), sy: size * (0.02 + hash(f.seed, i, 52) * 0.08), sz: size * (0.06 + hash(f.seed, i, 53) * 0.25),
      });
    }
  };

  let ev = 0;
  for (const e of o.events) {
    ev++;
    if (e.type === 'fire') {
      const n = e.count ?? 1;
      for (let i = 0; i < n; i++) {
        const pa = pose(e.from, e.t), pb = pose(e.to, e.hit);
        const p0 = pa.p.clone(), p1 = pb.p.clone();
        const dir = p1.clone().sub(p0).normalize();
        // Side by side a little: launchers a few metres apart.
        const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        const k = i - (n - 1) / 2;
        p0.addScaledVector(side, k * 14).addScaledVector(dir, o.sizeOf(e.from) * 0.3);
        const killed = !!e.killed?.[i];
        // A hit lands on the hull facing the shooter; a missile shot down just flies on its line.
        const hp = hullPoint(e.to, e.hit, p0.clone().sub(p1), 0.6, ev * 31 + i, new THREE.Vector3());
        hp.x += k * 6; hp.y += k * 3;
        const hitWorld = hp.clone().applyQuaternion(pb.q).add(p1);
        const tEnd = killed ? (e.killed![i] as number) : e.hit;
        const m: Missile = { id: e.id, from: e.from, to: e.to, k: i, t0: e.t + i * 0.2, tHit: e.hit, tEnd, p0, p1: hitWorld, killed };
        missiles.push(m);
        if (e.id) { const l = byId.get(e.id) ?? []; l.push(m); byId.set(e.id, l); }
        addFlash({ t: m.t0, kind: 'muzzle', size: 14, L: 30, dur: 0.6, pos0: p0.clone(), vel0: pa.v.clone() });
        cues.push({ t: m.t0, kind: 'launch', vol: 0.85, who: e.from });
        if (killed) {
          const at = new THREE.Vector3();
          missileAt(m, tEnd, at);
          addFlash({ t: tEnd, kind: 'kill', size: 26, L: 8, dur: 0.7, seed: ev * 17 + i, sparks: 18, pos0: at });
        } else {
          addFlash({ t: e.hit, kind: 'fire', size: e.warhead ?? 22, L: 26, dur: 2.4, seed: ev * 19 + i, sparks: 40, ship: e.to, local: hp });
          cues.push({ t: e.hit, kind: 'impact', vol: 1, who: e.to, pos: hitWorld, r: 900 });
        }
      }
    } else if (e.type === 'hit') {
      const pa = pose(e.target, e.t);
      const radius = e.radius ?? (e.fx === 'nuke' ? 450 : o.sizeOf(e.target) * 0.7);
      blasts.push({ t: e.t, pos: pa.p.clone(), vel: pa.v.clone(), radius, nuke: e.fx === 'nuke' });
      cues.push({ t: e.t, kind: 'boom', vol: e.fx === 'nuke' ? 1.4 : 1.1, who: e.target, pos: pa.p.clone(), r: e.fx === 'nuke' ? 3000 : radius * 6 });
      cues.push({ t: e.t, kind: 'duck', vol: 1, who: null, dur: e.fx === 'nuke' ? 9 : 6 });
    } else if (e.type === 'debris') {
      debrisCloud(e.from, e.t, e.n, e.seed, e.speed ?? 220, e.chunks ?? 56, e.scale ?? 1);
    } else if (e.type === 'silence') {
      cues.push({ t: e.t, kind: 'duck', vol: 1, who: null, dur: e.dur });
    } else if (e.type === 'impact') {
      const f = addFlash({ t: e.t, kind: 'spark', size: e.size ?? 12, L: 14, dur: 0.8, seed: ev * 13, sparks: 34, ship: e.target, local: vec(e.at) });
      cues.push({ t: e.t, kind: 'impact', vol: Math.min(1.2, 0.4 + (e.size ?? 12) / 40), who: e.target, pos: f.pos0, r: 500 });
    } else if (e.type === 'blast') {
      const sz = e.size ?? 40;
      const f = addFlash({ t: e.t, kind: 'fire', size: sz, L: 30, dur: 3.6, seed: ev * 11, sparks: 60, ship: e.target, local: vec(e.at) });
      plating(f, sz, 10);
      cues.push({ t: e.t, kind: 'boom', vol: Math.min(1.2, 0.5 + sz / 120), who: e.target, pos: f.pos0, r: sz * 8 });
    } else if (e.type === 'breach') {
      const local = vec(e.at);
      const nrm = local.clone().normalize();
      const nn = Math.max(24, Math.min(130, Math.round(e.dur * 16)));
      const g: Gas = { t: e.t, dur: e.dur, size: e.size ?? 14, ship: e.target, local, n: nn, p0: [], d: [], v0: [], seed: ev * 23 };
      for (let j = 0; j < nn; j++) {
        const tb = e.t + (e.dur * (j + hash(g.seed, j, 1))) / nn;
        o.stateAt(e.target, tb, _pose);
        g.p0.push(local.clone().applyQuaternion(_pose.q).add(_pose.p));
        const jit = new THREE.Vector3(hash(g.seed, j, 2) - 0.5, hash(g.seed, j, 3) - 0.5, hash(g.seed, j, 4) - 0.5).multiplyScalar(0.7);
        g.d.push(nrm.clone().add(jit).normalize().applyQuaternion(_pose.q));
        g.v0.push(_pose.v.clone());
      }
      gases.push(g);
      const f = addFlash({ t: e.t, kind: 'fire', size: g.size * 1.3, L: 16, dur: 2.2, seed: ev * 29, sparks: 36, ship: e.target, local });
      plating(f, 3, 8);
      cues.push({ t: e.t, kind: 'breach', vol: 1, who: e.target, pos: f.pos0, r: 600, dur: Math.min(e.dur, 8) });
    } else if (e.type === 'pdc') {
      const rate = e.rate ?? 55, burst = e.burst ?? 0.4, gap = e.gap ?? 0.3;
      pdcs.push({ e, rounds: new Map(), ix: ev, rpb: Math.max(1, Math.round(rate * burst)), cycle: burst + gap });
      cues.push({ t: e.t, kind: 'pdc', vol: 0.9, who: e.from, dur: e.dur, rate, burst, gap });
    } else if (e.type === 'rail') {
      const n = e.count ?? 1, speed = e.speed ?? 14000;
      for (let k = 0; k < n; k++) {
        const tk = e.t + k * (e.gap ?? 0.5);
        const pa = pose(e.from, tk);
        const muz = vec(e.mount).applyQuaternion(pa.q).add(pa.p);
        const pt = pose(e.to, tk);
        let flight = pt.p.distanceTo(muz) / speed;
        pose(e.to, tk + flight, pt);
        const hitLocal = hullPoint(e.to, tk + flight, muz.clone().sub(pt.p), 0.5, ev * 41 + k, new THREE.Vector3());
        const end = hitLocal.clone().applyQuaternion(pt.q).add(pt.p);
        flight = end.distanceTo(muz) / speed;
        const hit = e.hit !== false;
        rails.push({ t: tk, speed, muz, dir: end.clone().sub(muz).normalize(), dist: end.distanceTo(muz), hit });
        addFlash({ t: tk, kind: 'rail', size: 26, L: 36, dur: 0.5, pos0: muz.clone(), vel0: pa.v.clone() });
        cues.push({ t: tk, kind: 'rail', vol: 1, who: e.from });
        if (hit) {
          addFlash({ t: tk + flight, kind: 'spark', size: e.size ?? 30, L: 28, dur: 1.2, seed: ev * 43 + k, sparks: 60, ship: e.to, local: hitLocal });
          cues.push({ t: tk + flight, kind: 'impact', vol: 1.1, who: e.to, pos: end, r: 700 });
        }
      }
    }
  }
  cues.sort((a, b) => a.t - b.t);

  // ---- points: trails, heads, glows, sparks, gas, embers, all in one draw
  const posA = new Float32Array(MAX_POINTS * 3), sizeA = new Float32Array(MAX_POINTS), colA = new Float32Array(MAX_POINTS * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posA, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizeA, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aCol', new THREE.BufferAttribute(colA, 4).setUsage(THREE.DynamicDrawUsage));
  const pointMat = new THREE.ShaderMaterial({
    uniforms: { uFocal: { value: 1000 }, uUnit: { value: SOL_UNIT } },
    vertexShader: POINT_V, fragmentShader: POINT_F,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const points = new THREE.Points(geo, pointMat);
  points.frustumCulled = false;
  o.root.add(points);
  let n = 0;
  const put = (p: V3, size: number, rr: number, g: number, b: number, a: number) => {
    if (n >= MAX_POINTS) return;
    posA[n * 3] = p.x; posA[n * 3 + 1] = p.y; posA[n * 3 + 2] = p.z;
    sizeA[n] = size;
    colA[n * 4] = rr; colA[n * 4 + 1] = g; colA[n * 4 + 2] = b; colA[n * 4 + 3] = a;
    n++;
  };

  // ---- streaks: instanced quads
  const quad = new THREE.PlaneGeometry(1, 1);
  const sgeo = new THREE.InstancedBufferGeometry();
  sgeo.index = quad.index;
  sgeo.setAttribute('position', quad.getAttribute('position'));
  const iA = new Float32Array(MAX_STREAKS * 3), iB = new Float32Array(MAX_STREAKS * 3), iCol = new Float32Array(MAX_STREAKS * 4), iW = new Float32Array(MAX_STREAKS * 2);
  const mk = (a: Float32Array, k: number) => new THREE.InstancedBufferAttribute(a, k).setUsage(THREE.DynamicDrawUsage);
  sgeo.setAttribute('iA', mk(iA, 3)); sgeo.setAttribute('iB', mk(iB, 3)); sgeo.setAttribute('iCol', mk(iCol, 4)); sgeo.setAttribute('iW', mk(iW, 2));
  sgeo.instanceCount = 0;
  const streakMat = new THREE.ShaderMaterial({
    uniforms: { uFocal: { value: 1000 }, uUnit: { value: SOL_UNIT } },
    vertexShader: STREAK_V, fragmentShader: STREAK_F,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const streaks = new THREE.Mesh(sgeo, streakMat);
  streaks.frustumCulled = false;
  o.root.add(streaks);
  let ns = 0;
  const streak = (a: V3, b: V3, width: number, sharp: number, r: number, g: number, bl: number, alpha: number) => {
    if (ns >= MAX_STREAKS) return;
    iA[ns * 3] = a.x; iA[ns * 3 + 1] = a.y; iA[ns * 3 + 2] = a.z;
    iB[ns * 3] = b.x; iB[ns * 3 + 1] = b.y; iB[ns * 3 + 2] = b.z;
    iCol[ns * 4] = r; iCol[ns * 4 + 1] = g; iCol[ns * 4 + 2] = bl; iCol[ns * 4 + 3] = alpha;
    iW[ns * 2] = width; iW[ns * 2 + 1] = sharp;
    ns++;
  };

  // ---- fireballs and shells (a few in a pool; a nuclear one also has a shell)
  const balls = Array.from({ length: BALLS }, () => new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), ballMat(0)));
  const shells = Array.from({ length: SHELLS }, () => new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), ballMat(1)));
  for (const m of [...balls, ...shells]) { m.visible = false; m.frustumCulled = false; o.root.add(m); }
  // Lights: one for the nuclear flash, two lent to the brightest of everything else. Always in the scene (at nothing),
  // so the scene's shaders never change under the film.
  const lamp = new THREE.PointLight(0xffe2c0, 0, 9000 * SOL_UNIT, 0);
  const lights = [new THREE.PointLight(0xffc890, 0, 1400 * SOL_UNIT, 0), new THREE.PointLight(0xffc890, 0, 1400 * SOL_UNIT, 0)];
  o.root.add(lamp, ...lights);

  // ---- hull chunks: lumps that catch the sun
  const chunkMat = new THREE.MeshStandardMaterial({ color: 0x5b6066, roughness: 0.75, metalness: 0.4 });
  const chunkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), chunkMat, Math.max(1, chunks.length));
  chunkMesh.frustumCulled = false;
  chunkMesh.count = 0;
  o.root.add(chunkMesh);

  let calls = 0, lastRounds = 0;
  const fp = new THREE.Vector3();

  /** Round `i` of a PDC stream: fixed once computed, from the closed-form tracks, so a seek gives the same answer. */
  function round(pd: Pdc, i: number): Round {
    const had = pd.rounds.get(i);
    if (had) return had;
    const e = pd.e, c = Math.floor(i / pd.rpb), idx = i % pd.rpb;
    const ti = e.t + c * pd.cycle + idx / (e.rate ?? 55);
    const speed = e.speed ?? 2800;
    const mounts = e.mounts ?? [[0, 0, 0]];
    const pa = pose(e.from, ti);
    const muz = vec(mounts[i % mounts.length] as Vec).applyQuaternion(pa.q).add(pa.p);
    const aim = new THREE.Vector3();
    let ship: string | null = null, endLocal: V3 | null = null;
    if (e.at) {
      const pt = pose(e.at, ti);
      let fl = pt.p.distanceTo(muz) / speed;
      pose(e.at, ti + fl, pt);
      fl = pt.p.distanceTo(muz) / speed;
      pose(e.at, ti + fl, pt);
      if (hash(pd.ix, i, 1) < (e.hitRate ?? 0.4)) {
        endLocal = hullPoint(e.at, ti + fl, muz.clone().sub(pt.p), 0.9, pd.ix * 131 + i, new THREE.Vector3());
        aim.copy(endLocal).applyQuaternion(pt.q).add(pt.p);
        ship = e.at;
      } else {
        // Wide of her: a few hull-widths off, and on past.
        aim.copy(pt.p).add(sphere(pd.ix, i, 5, new THREE.Vector3()).multiplyScalar(o.sizeOf(e.at) * (0.15 + hash(pd.ix, i, 6) * 0.3)));
      }
    } else {
      const ms = byId.get(e.missile ?? '') ?? [];
      const m = ms[(hash(pd.ix, i, 7) * ms.length) | 0] ?? ms[0];
      if (m) {
        let fl = 0.5;
        for (let it = 0; it < 3; it++) { missileAt(m, ti + fl, aim); fl = aim.distanceTo(muz) / speed; }
        aim.add(sphere(pd.ix, i, 8, new THREE.Vector3()).multiplyScalar(14));
      } else aim.copy(muz).add(new THREE.Vector3(0, 0, -3000));
    }
    const dir = aim.clone().sub(muz);
    const range = dir.length();
    dir.normalize();
    const sc = e.spread ?? 0.004;
    dir.x += (hash(pd.ix, i, 9) - 0.5) * sc * 2; dir.y += (hash(pd.ix, i, 10) - 0.5) * sc * 2; dir.z += (hash(pd.ix, i, 11) - 0.5) * sc * 2;
    dir.normalize();
    const r: Round = { muz, dir, dist: Math.min(endLocal ? range : range * 1.4 + 300, speed * MAX_ROUND_FLIGHT), speed, ti, endLocal, ship };
    pd.rounds.set(i, r);
    return r;
  }

  /** A churning fireball: smaller puffs thrown out and cooling at different rates, each a different shade. */
  function puffs(base: V3, size: number, tau: number, dur: number, seed: number) {
    const grow = 1 - Math.exp(-tau * 3);
    for (let k = 0; k < 7; k++) {
      sphere(seed, k, 91, _pu);
      const lag = hash(seed, k, 92) * 0.5, c = Math.exp(-Math.max(0, tau - lag) / (0.6 + hash(seed, k, 93) * 0.9)) * (1 - smoothstep(dur * 0.6, dur, tau));
      if (tau < lag * 0.3 || c < 0.01) continue;
      _pw.copy(base).addScaledVector(_pu, size * (0.2 + 0.7 * hash(seed, k, 94)) * grow);
      const hot = hash(seed, k, 96);
      put(_pw, size * (0.5 + 0.6 * hash(seed, k, 95)) * (0.6 + 0.8 * grow), (2.4 + hot) * c, (0.7 + 1.1 * hot * c) * c, (0.15 + 0.5 * hot * c * c) * c, 0.8);
    }
  }

  const api = {
    update(t: number, camera: THREE.PerspectiveCamera, pxHeight: number) {
      calls++;
      n = 0; ns = 0;
      const focal = pxHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
      pointMat.uniforms.uFocal.value = focal; streakMat.uniforms.uFocal.value = focal;

      // ---- torpedoes
      for (const m of missiles) {
        if (t < m.t0 || t > m.tEnd) continue;
        for (let k = 0; k < TRAIL; k++) {
          const tau = t - m.t0 - k * TRAIL_STEP;
          if (tau < 0) break;
          const f = 1 - k / TRAIL;
          missileAt(m, m.t0 + tau, _p);
          put(_p, 2.5 + 7 * f, 1.0 * f * 2.0, 0.62 * f * 2.0, 0.28 * f * 2.0, 0.4 * f * f);
        }
        missileAt(m, t, _p);
        put(_p, 9, 3.2, 2.6, 2.0, 1);
        put(_p, 22, 1.4, 0.8, 0.4, 0.7);
      }

      // ---- PDC bursts: dotted lines of bright rounds
      lastRounds = 0;
      for (const pd of pdcs) {
        const e = pd.e;
        if (t < e.t || t > e.t + e.dur + MAX_ROUND_FLIGHT) continue;
        const rate = e.rate ?? 55;
        const c0 = Math.max(0, Math.floor((t - MAX_ROUND_FLIGHT - e.t) / pd.cycle)), c1 = Math.min(Math.ceil(e.dur / pd.cycle) - 1, Math.floor((t - e.t) / pd.cycle));
        for (let c = c0; c <= c1; c++) {
          for (let idx = 0; idx < pd.rpb; idx++) {
            const ti = e.t + c * pd.cycle + idx / rate;
            if (ti > t) break;
            if (ti > e.t + e.dur || ti + MAX_ROUND_FLIGHT < t) continue;
            const r = round(pd, c * pd.rpb + idx);
            const tau = t - ti, travelled = r.speed * tau;
            if (tau < 0.05) put(r.muz, 7, 3.4, 2.4, 1.2, 0.9 * (1 - tau / 0.05));
            if (travelled > r.dist) {
              // Arrived: a hit on a hull is a spark; a miss is just gone.
              const ta = tau - r.dist / r.speed;
              if (r.ship && r.endLocal && ta < 0.16) {
                worldOf(r.ship, r.endLocal, t, _p);
                const f = 1 - ta / 0.16;
                put(_p, 9 + 6 * f, 3.2 * f, 2.6 * f, 1.6 * f, 1);
              }
              continue;
            }
            const head = _p.copy(r.dir).multiplyScalar(travelled).add(r.muz);
            const tail = _p2.copy(r.dir).multiplyScalar(Math.max(0, travelled - 34)).add(r.muz);
            lastRounds++;
            streak(tail, head, 1.3, 1.4, 3.4, 2.5, 1.2, 1);
          }
        }
      }

      // ---- railgun slugs
      for (const rl of rails) {
        const tau = t - rl.t;
        if (tau < 0) continue;
        const flight = rl.dist / rl.speed;
        if (tau > flight + 1.2) continue;
        const run = Math.min(rl.speed * tau, rl.hit ? rl.dist : rl.dist * 3);
        const head = _p.copy(rl.dir).multiplyScalar(run).add(rl.muz);
        if (tau < flight) streak(_p2.copy(rl.dir).multiplyScalar(Math.max(0, run - rl.speed * 0.045)).add(rl.muz), head, 2.2, 2.2, 1.6, 3.2, 7, 1.6);
        // What it leaves in the air: a thin blue line from the muzzle that fades in about a second.
        const fade = Math.exp(-tau / 0.55) * (tau < flight ? 1 : Math.exp(-(tau - flight) / 0.35));
        streak(rl.muz, head, 1.4, 0.6, 0.15, 0.45, 1.3, 0.5 * fade);
      }

      // ---- flashes: glows, sparks, and the two lent lights
      let top0 = 0, top1 = 0, p0i = -1, p1i = -1;
      flashes.forEach((f, i) => {
        const tau = t - f.t;
        if (tau < 0 || tau > f.dur) return;
        const base = f.ship ? worldOf(f.ship, f.local, t, fp) : fp.copy(f.pos0).addScaledVector(f.vel0, tau);
        let I = 0, cr = 3, cg = 2, cb = 1.2, size = f.size, life = 0.5, sp = 400;
        switch (f.kind) {
          case 'spark': I = Math.exp(-tau / 0.08); cr = 4; cg = 3.2; cb = 2.2; size = f.size * (1.3 + 3 * tau); life = 0.7; sp = 200 + f.size * 20; break;
          case 'fire': I = Math.exp(-tau / 0.7) * (1 - smoothstep(f.dur * 0.7, f.dur, tau)); cr = 3.2; cg = 1.5 + 1.5 * Math.exp(-tau / 0.25); cb = 0.5 + 2 * Math.exp(-tau / 0.12); size = f.size * (0.8 + 1.6 * (1 - Math.exp(-tau * 2.5))); life = 2.2; sp = 40 + f.size * 6; break;
          case 'kill': I = Math.exp(-tau / 0.1); cr = 4; cg = 4; cb = 4; size = f.size * (0.8 + 2 * tau); life = 0.6; sp = 220; break;
          case 'muzzle': I = Math.exp(-tau / 0.18); cr = 3.4; cg = 2.2; cb = 1.1; size = f.size * (0.7 + tau); break;
          case 'rail': I = Math.exp(-tau / 0.1); cr = 1.8; cg = 3.2; cb = 6; size = f.size * (0.8 + 2 * tau); break;
        }
        if (I > 0.003) put(base, size, cr * I, cg * I, cb * I, 1);
        if (f.kind === 'fire' && f.size >= 20) puffs(base, f.size, tau, f.dur, f.seed);
        if (f.sparks && f.kind !== 'muzzle' && f.kind !== 'rail' && tau < life) {
          const sf = Math.exp(-tau / (life * 0.45));
          for (let k = 0; k < f.sparks; k++) {
            sphere(f.seed, k, 61, _s);
            if (f.ship) _s.addScaledVector(f.nrm, 1.2 * hash(f.seed, k, 63));
            _p.copy(f.pos0).addScaledVector(f.vel0, tau).addScaledVector(_s, sp * (0.2 + hash(f.seed, k, 62)) * tau * (1 - 0.35 * tau / life));
            put(_p, 2.5 + hash(f.seed, k, 64) * 4, 2.6 * sf, 1.6 * sf * sf, 0.8 * sf ** 3, 0.9);
          }
        }
        const Li = f.L * I;
        if (Li > top0) { top1 = top0; p1i = p0i; top0 = Li; p0i = i; } else if (Li > top1) { top1 = Li; p1i = i; }
      });
      const place = (light: THREE.PointLight, ix: number, I: number) => {
        if (ix < 0) { light.intensity = 0; return; }
        const f = flashes[ix], tau = t - f.t;
        const w = f.ship ? worldOf(f.ship, f.local, t, fp) : fp.copy(f.pos0).addScaledVector(f.vel0, tau);
        // Stand the lamp a little off the hull so it lights the plating, not the inside of it.
        light.position.copy(w).addScaledVector(f.nrm, Math.max(8, f.size * 0.6));
        light.intensity = I;
        light.distance = Math.max(500, f.size * 18) * SOL_UNIT;
      };
      place(lights[0], p0i, top0); place(lights[1], p1i, top1);

      // ---- breaches: fire at the hole, a plume of air, ice glinting in it
      for (const g of gases) {
        const tau0 = t - g.t;
        if (tau0 < 0 || tau0 > g.dur + 3.2) continue;
        const on = tau0 < g.dur ? 1 : Math.exp(-(tau0 - g.dur) / 0.8);
        worldOf(g.ship, g.local, t, _p);
        const fl = 0.75 + 0.25 * hash(g.seed, Math.floor(t * 14), 3);
        if (tau0 < g.dur + 1.5) put(_p, g.size * 1.2 * fl, 2.6 * on * fl, 1.0 * on * fl, 0.28 * on * fl, 1);
        for (let j = 0; j < g.n; j++) {
          const tb = g.t + (g.dur * (j + hash(g.seed, j, 1))) / g.n, a = t - tb;
          if (a < 0 || a > 3.2) continue;
          _p.copy(g.p0[j]).addScaledVector(g.v0[j], a).addScaledVector(g.d[j], (35 + 70 * hash(g.seed, j, 5)) * a);
          const k = a / 3.2, f = (1 - k) * (1 - k);
          const glint = hash(g.seed, j, Math.floor(t * 6)) > 0.93 ? 3.5 : 1;
          put(_p, g.size * (0.25 + 1.5 * k), 0.30 * f * glint, 0.34 * f * glint, 0.4 * f * glint, 1);
        }
      }

      // ---- fireballs and shells
      let bi = 0, si = 0, lamp0 = 0;
      for (const b of blasts) {
        const tau = t - b.t;
        if (tau < 0 || tau > (b.nuke ? 17 : 9)) continue;
        const pos = _s.copy(b.pos).addScaledVector(b.vel, tau);
        if (b.nuke) {
          const I = (14 * Math.exp(-tau / 0.3) + 0.7 * Math.exp(-tau / 2.5)) * (1 - smoothstep(9, 16, tau));
          const Rc = b.radius * (1 - Math.exp(-tau * 3)) * (1 + tau / 14) + 1;
          const warm = smoothstep(0, 4, tau);
          const col = new THREE.Color(1, 0.96 - 0.4 * warm, 0.88 - 0.7 * warm).multiplyScalar(I);
          const bl = balls[bi++ % BALLS]; bl.visible = true; bl.position.copy(pos); bl.scale.setScalar(Rc);
          { const bu = (bl.material as THREE.ShaderMaterial).uniforms; bu.uCol.value.copy(col); bu.uRim.value = 0.85 * smoothstep(0.2, 2.5, tau); }
          const Rs = 100 + 260 * tau, fade = (1 - smoothstep(6, 17, tau)) * smoothstep(0, 0.25, tau);
          const sh = shells[si++ % SHELLS]; sh.visible = fade > 0.001; sh.position.copy(pos); sh.scale.setScalar(Rs);
          (sh.material as THREE.ShaderMaterial).uniforms.uCol.value.set(0.35, 0.6, 1.0).multiplyScalar(1.0 * fade * Math.exp(-tau / 9));
          put(pos, Rc * 5 + 300, col.r * 0.35, col.g * 0.35, col.b * 0.35, 1);
          lamp.position.copy(pos);
          lamp0 += 60 * Math.exp(-tau / 0.8) + 2.5 * Math.exp(-tau / 5);
          const sd = Math.floor(b.t * 7);
          for (let k = 0; k < 150; k++) {
            sphere(sd, k, 71, _p2);
            const rr = (250 + hash(sd, k, 72) * 1400) * tau * (1 - 0.5 * tau / 17);
            _p.copy(pos).addScaledVector(_p2, rr + Rc * 0.4);
            const f = Math.exp(-tau / 1.8);
            put(_p, 5 + hash(sd, k, 73) * 11, 2.4 * f, 1.5 * f * f, 0.7 * f * f * f, 0.9);
          }
        } else {
          // An ordinary ship-killing fireball: orange, quick, no blue shell, a churn of sparks round it.
          const Rc = b.radius * (1 - Math.exp(-tau * 1.6)) + 2;
          const I = (6 * Math.exp(-tau / 0.5) + 1.2 * Math.exp(-tau / 3)) * (1 - smoothstep(5, 9, tau));
          const warm = smoothstep(0, 3, tau);
          const col = new THREE.Color(1, 0.8 - 0.45 * warm, 0.5 - 0.42 * warm).multiplyScalar(I);
          const bl = balls[bi++ % BALLS]; bl.visible = true; bl.position.copy(pos); bl.scale.setScalar(Rc);
          { const bu = (bl.material as THREE.ShaderMaterial).uniforms; bu.uCol.value.copy(col); bu.uRim.value = 0.25 * smoothstep(0.2, 2.5, tau); }
          put(pos, Rc * 3.2 + 40, col.r * 0.3, col.g * 0.3, col.b * 0.3, 1);
          const sd = Math.floor(b.t * 5) + 3;
          puffs(pos, b.radius * 1.3, tau, 9, sd);
          for (let k = 0; k < 90; k++) {
            sphere(sd, k, 81, _p2);
            const rr = (60 + hash(sd, k, 82) * 520) * tau * (1 - 0.4 * tau / 9);
            _p.copy(pos).addScaledVector(_p2, rr + Rc * 0.5);
            const f = Math.exp(-tau / 1.6);
            put(_p, 4 + hash(sd, k, 83) * 9, 2.4 * f, 1.3 * f * f, 0.5 * f * f * f, 0.9);
          }
        }
      }
      for (let k = bi; k < BALLS; k++) balls[k].visible = false;
      for (let k = si; k < SHELLS; k++) shells[k].visible = false;
      lamp.intensity = lamp0;

      // ---- debris: embers (points) and chunks
      for (const em of embers) {
        const tau = t - em.tb;
        if (tau < 0) continue;
        const heat = Math.exp(-tau / 5);
        _p.copy(em.p0).addScaledVector(em.v, tau);
        put(_p, em.size, 0.12 + 2.2 * heat, 0.1 + 1.2 * heat * heat, 0.1 + 0.4 * heat * heat * heat, 0.35 + 0.65 * heat);
      }
      let ci = 0;
      for (const c of chunks) {
        const tau = t - c.tb;
        if (tau < 0) continue;
        _p.copy(c.p0).addScaledVector(c.v, tau);
        _q.copy(c.q0).multiply(_q2.setFromAxisAngle(c.axis, c.rate * tau));
        _mm.compose(_p, _q, _s.set(c.sx, c.sy, c.sz));
        chunkMesh.setMatrixAt(ci++, _mm);
      }
      chunkMesh.count = ci;
      chunkMesh.instanceMatrix.needsUpdate = true;

      geo.setDrawRange(0, n);
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (geo.attributes.aCol as THREE.BufferAttribute).needsUpdate = true;
      sgeo.instanceCount = ns;
      for (const k of ['iA', 'iB', 'iCol', 'iW'] as const) (sgeo.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
    },
    /** Every sound the events call for, in time order (the player decides which are heard). */
    cues,
    /** Show every part of the effects, so the renderer compiles every shader before the film needs it; undo with the returned function. */
    prewarm(): () => void {
      const all = [...balls, ...shells, points, streaks, chunkMesh];
      const was = all.map((m) => m.visible);
      const cnt = chunkMesh.count, inst = sgeo.instanceCount, dr = geo.drawRange.count;
      all.forEach((m) => { m.visible = true; });
      chunkMesh.count = 1; sgeo.instanceCount = 1; geo.setDrawRange(0, 1);
      return () => { all.forEach((m, i) => { m.visible = was[i]; }); chunkMesh.count = cnt; sgeo.instanceCount = inst; geo.setDrawRange(0, dr); };
    },
    stats: () => ({ points: n, streaks: ns, chunks: chunkMesh.count, missiles: missiles.length, flashes: flashes.length, gases: gases.length, rounds: lastRounds, calls }),
    dispose() {
      o.root.remove(points, streaks, chunkMesh, lamp, ...lights, ...balls, ...shells);
      geo.dispose(); pointMat.dispose(); sgeo.dispose(); quad.dispose(); streakMat.dispose();
      for (const m of [...balls, ...shells]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      chunkMesh.geometry.dispose(); chunkMat.dispose(); chunkMesh.dispose();
    },
  };
  return api;
}
