// Effects for the scenario engine (E3.2.c, first slice): a torpedo and its trail, a nuclear flash with its shell
// and a flash of light on the nearby ships, and the debris thrown out. Every picture is a pure function of the
// scenario time, so a seek lands on the same frame each time. Everything is additive, in colours well above 1,
// so the bloom pass gives the flash its halo. Positions are metres in the scenario's frame (the root group is
// scaled to the scene), and the shaders keep the logdepth chunks so they sort right in either depth scheme.
//
// Drive flares are the ships' own `DrivePlume`s, switched by the player.

import * as THREE from 'three';
import { glowSprite } from './ships';
import { rng } from './textures';
import { SOL_UNIT } from './traffic';
import type { EventDef } from './scenario';

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
  gl_PointSize = clamp(aSize * uUnit * uFocal / max(-mv.z, 1e-30), 1.5, 120.0);
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

interface Missile { t0: number; tHit: number; p0: V3; p1: V3 }
interface Blast { t: number; pos: V3; vel: V3; radius: number }
interface Cloud { t: number; pos: V3; vel: V3; n: number; seed: number; speed: number }

export interface FxOptions {
  root: THREE.Group;
  renderer: THREE.WebGLRenderer;
  events: EventDef[];
  seed: number;
  /** Where an actor is and how it moves at time t; false if there is no such actor. */
  stateAt(id: string, t: number, p: V3, v: V3): boolean;
}

const MAX_POINTS = 3200;
const TRAIL = 240, TRAIL_STEP = 0.02;
const EMBERS = 380, CHUNKS = 56, SPARKS = 150;
const _p = new THREE.Vector3(), _q2 = new THREE.Quaternion(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _mm = new THREE.Matrix4();
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function createFx(o: FxOptions) {
  const missiles: Missile[] = [], blasts: Blast[] = [], clouds: Cloud[] = [];
  const r = rng(o.seed);
  for (const e of o.events) {
    if (e.type === 'fire') {
      const n = e.count ?? 1;
      for (let i = 0; i < n; i++) {
        const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), v = new THREE.Vector3();
        o.stateAt(e.from, e.t, p0, v);
        o.stateAt(e.to, e.hit, p1, v);
        // Side by side a little: launchers a few metres apart, aimed a few tens of metres apart on the target.
        const dir = p1.clone().sub(p0).normalize(), side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        const k = i - (n - 1) / 2;
        p0.addScaledVector(side, k * 14);
        p1.addScaledVector(side, k * 70).addScaledVector(new THREE.Vector3(0, 1, 0), k * 10);
        missiles.push({ t0: e.t + i * 0.2, tHit: e.hit, p0, p1 });
      }
    } else if (e.type === 'hit' && e.fx === 'nuke') {
      const pos = new THREE.Vector3(), vel = new THREE.Vector3();
      o.stateAt(e.target, e.t, pos, vel);
      blasts.push({ t: e.t, pos, vel, radius: e.radius ?? 450 });
    } else if (e.type === 'debris') {
      const pos = new THREE.Vector3(), vel = new THREE.Vector3();
      o.stateAt(e.from, e.t, pos, vel);
      clouds.push({ t: e.t, pos, vel, n: e.n, seed: e.seed, speed: e.speed ?? 220 });
    }
  }

  // ---- points: trails, heads, sparks, embers, all in one draw
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

  // ---- the blast
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20), ballMat(0));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), ballMat(1));
  const halo = glowSprite(0xffffff, 1, 1);
  for (const m of [ball, shell, halo]) { m.visible = false; m.frustumCulled = false; o.root.add(m); }
  // A flash of light on whatever is near: a lamp with a cut-off and no fall-off (the usual inverse-square clamps in these tiny units).
  const lamp = new THREE.PointLight(0xffe2c0, 0, 9000 * SOL_UNIT, 0);
  if (blasts.length) o.root.add(lamp);
  // And a flash at the launcher when a torpedo leaves, enough to show a dark hull for a moment.
  const muzzle = new THREE.PointLight(0xffb070, 0, 1500 * SOL_UNIT, 0);
  if (missiles.length) o.root.add(muzzle);

  // ---- debris: ember points, and chunks of hull that catch the sun
  const chunkMat = new THREE.MeshStandardMaterial({ color: 0x5b6066, roughness: 0.75, metalness: 0.4 });
  const chunks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), chunkMat, CHUNKS * Math.max(1, clouds.length));
  chunks.frustumCulled = false;
  chunks.count = 0;
  if (clouds.length) o.root.add(chunks);
  interface Bit { d: V3; speed: number; size: number; axis: V3; rate: number; q0: THREE.Quaternion; sx: number; sy: number; sz: number }
  const bits: Bit[][] = clouds.map((c) => {
    const rr = rng(c.seed + 1);
    return Array.from({ length: c.n + CHUNKS }, () => {
      // Out in all directions, a little more along the length of the ship than across it.
      const u = rr() * 2 - 1, a = rr() * Math.PI * 2, w = Math.sqrt(1 - u * u);
      const d = new THREE.Vector3(w * Math.cos(a), u * 0.7, w * Math.sin(a)).normalize();
      const k = rr();
      return { d, speed: c.speed * (0.08 + 0.92 * k * k), size: 3 + rr() * 9, axis: new THREE.Vector3(rr() - 0.5, rr() - 0.5, rr() - 0.5).normalize(), rate: 0.2 + rr() * 1.2, q0: new THREE.Quaternion().setFromEuler(new THREE.Euler(rr() * 6, rr() * 6, rr() * 6)), sx: 4 + rr() * 16, sy: 2 + rr() * 9, sz: 4 + rr() * 20 };
    });
  });
  const sparks = blasts.map(() => Array.from({ length: SPARKS }, () => {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, w = Math.sqrt(1 - u * u);
    return { d: new THREE.Vector3(w * Math.cos(a), u, w * Math.sin(a)), speed: 250 + r() * 1400, size: 5 + r() * 11 };
  }));

  let calls = 0;
  const api = {
    update(t: number, camera: THREE.PerspectiveCamera, pxHeight: number) {
      calls++;
      n = 0;
      pointMat.uniforms.uFocal.value = pxHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));

      for (const m of missiles) {
        if (t < m.t0 || t > m.tHit) continue;
        const Tf = m.tHit - m.t0;
        const at = (tau: number, out: V3) => { const f = tau / Tf; return out.copy(m.p0).lerp(m.p1, f * f); };
        for (let k = 0; k < TRAIL; k++) {
          const tau = t - m.t0 - k * TRAIL_STEP;
          if (tau < 0) break;
          const f = 1 - k / TRAIL;
          at(tau, _p);
          put(_p, 2.5 + 7 * f, 1.0 * f * 2.0, 0.62 * f * 2.0, 0.28 * f * 2.0, 0.4 * f * f);
        }
        at(t - m.t0, _p);
        put(_p, 9, 3.2, 2.6, 2.0, 1);
        put(_p, 22, 1.4, 0.8, 0.4, 0.7);
      }

      let mz = 0;
      for (const m of missiles) { const tau = t - m.t0; if (tau >= 0 && tau < 3) { muzzle.position.copy(m.p0); mz = Math.max(mz, 30 * Math.exp(-tau / 0.7)); } }
      muzzle.intensity = mz;

      let lamp0 = 0, any = false;
      blasts.forEach((b, i) => {
        const tau = t - b.t;
        if (tau < 0 || tau > 17) return;
        any = true;
        const I = (14 * Math.exp(-tau / 0.3) + 0.7 * Math.exp(-tau / 2.5)) * (1 - smoothstep(9, 16, tau));
        const Rc = b.radius * (1 - Math.exp(-tau * 3)) * (1 + tau / 14) + 1;
        const warm = smoothstep(0, 4, tau);
        const col = new THREE.Color(1, 0.96 - 0.4 * warm, 0.88 - 0.7 * warm).multiplyScalar(I);
        const pos = _s.copy(b.pos).addScaledVector(b.vel, tau);
        ball.visible = true; ball.position.copy(pos); ball.scale.setScalar(Rc);
        { const bu = (ball.material as THREE.ShaderMaterial).uniforms; bu.uCol.value.copy(col); bu.uRim.value = 0.85 * smoothstep(0.2, 2.5, tau); }
        const Rs = 100 + 260 * tau, fade = (1 - smoothstep(6, 17, tau)) * smoothstep(0, 0.25, tau);
        shell.visible = fade > 0.001; shell.position.copy(pos); shell.scale.setScalar(Rs);
        (shell.material as THREE.ShaderMaterial).uniforms.uCol.value.set(0.35, 0.6, 1.0).multiplyScalar(1.0 * fade * Math.exp(-tau / 9));
        halo.visible = true; halo.position.copy(pos); halo.scale.setScalar(Rc * 5 + 300);
        const hm = halo.material as THREE.SpriteMaterial;
        hm.color.copy(col).multiplyScalar(0.35); hm.opacity = 1;
        lamp.position.copy(pos);
        lamp0 = 60 * Math.exp(-tau / 0.8) + 2.5 * Math.exp(-tau / 5);
        for (const sp of sparks[i]) {
          const rr = sp.speed * tau * (1 - 0.5 * tau / 17);
          if (rr < 0) continue;
          _p.copy(pos).addScaledVector(sp.d, rr + Rc * 0.4);
          const f = Math.exp(-tau / 1.8);
          put(_p, sp.size, 2.4 * f, 1.5 * f * f, 0.7 * f * f * f, 0.9);
        }
      });
      if (!any) { ball.visible = shell.visible = halo.visible = false; }
      lamp.intensity = any ? lamp0 : 0;

      let ci = 0;
      clouds.forEach((c, i) => {
        const tau = t - c.t;
        if (tau < 0) return;
        const heat = Math.exp(-tau / 5);
        const list = bits[i];
        for (let k = 0; k < c.n; k++) {
          const b = list[k];
          _p.copy(c.pos).addScaledVector(c.vel, tau).addScaledVector(b.d, b.speed * tau);
          // Glowing at first, then a dull red-grey spark that is still just visible against the dark.
          put(_p, b.size, (0.12 + 2.2 * heat) , (0.1 + 1.2 * heat * heat), (0.1 + 0.4 * heat * heat * heat), 0.35 + 0.65 * heat);
        }
        for (let k = 0; k < CHUNKS; k++) {
          const b = list[c.n + k];
          _p.copy(c.pos).addScaledVector(c.vel, tau).addScaledVector(b.d, b.speed * 0.6 * tau);
          _q.copy(b.q0).multiply(_q2.setFromAxisAngle(b.axis, b.rate * tau));
          _mm.compose(_p, _q, _s.set(b.sx, b.sy, b.sz));
          chunks.setMatrixAt(ci++, _mm);
        }
      });
      chunks.count = ci;
      chunks.instanceMatrix.needsUpdate = true;

      geo.setDrawRange(0, n);
      (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
      (geo.attributes.aCol as THREE.BufferAttribute).needsUpdate = true;
    },
    stats: () => ({ points: n, chunks: chunks.count, missiles: missiles.length, blasts: blasts.length, calls }),
    dispose() {
      o.root.remove(points, ball, shell, halo, lamp, muzzle, chunks);
      geo.dispose(); pointMat.dispose();
      ball.geometry.dispose(); (ball.material as THREE.Material).dispose();
      shell.geometry.dispose(); (shell.material as THREE.Material).dispose();
      halo.material.dispose();
      chunks.geometry.dispose(); chunkMat.dispose(); chunks.dispose();
    },
  };
  return api;
}
