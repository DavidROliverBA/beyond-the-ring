// A comet's coma and tails. The nucleus is an ordinary lumpy body; around it there is a pale haze,
// a straight blue tail of ionised gas that points directly away from the Sun, and a wider, curved,
// yellow-white tail of dust that lags behind. Lengths are in scene units (1 unit is 1/1000 AU).

import * as THREE from 'three';
import { glowSprite } from './ships';

const TAIL_V = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const TAIL_F = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 colour; uniform float power; uniform float streaks;
varying vec2 vUv;
float h(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  #include <logdepthbuf_fragment>
  float x = abs(vUv.x - 0.5) * 2.0, along = vUv.y;
  // Dense at the head and the centre, thinning to nothing at the sides and the far end.
  float body = pow(max(1.0 - x, 0.0), 1.6) * pow(max(1.0 - along, 0.0), 1.25) * smoothstep(0.0, 0.04, along);
  // Fine streaks along the tail, as the show and the photographs have it.
  float st = mix(1.0, 0.55 + 0.9 * h(floor(vUv.x * streaks)), 0.55);
  gl_FragColor = vec4(colour * body * st * power, 1.0);
}`;

/** A long tapering ribbon along +z whose far end bends towards `bend` (in widths) sideways. */
function ribbon(w0: number, w1: number, bend: number): THREE.BufferGeometry {
  const N = 24, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const v = i / N, w = w0 + (w1 - w0) * v, off = bend * v * v;
    pos.push(-w / 2 + off, 0, v, w / 2 + off, 0, v);
    uv.push(0, v, 1, v);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** `tail` and `coma` in scene units; `away` is the unit vector from the Sun through the comet. */
export function makeComet(tail: number, coma: number, away: THREE.Vector3): THREE.Group {
  const g = new THREE.Group();
  const holder = new THREE.Group();
  holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), away);
  g.add(holder);
  const mk = (geo: THREE.BufferGeometry, colour: number, power: number, streaks: number, rot: number, len: number) => {
    const mat = new THREE.ShaderMaterial({
      uniforms: { colour: { value: new THREE.Color(colour) }, power: { value: power }, streaks: { value: streaks } },
      vertexShader: TAIL_V, fragmentShader: TAIL_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.z = rot;
    m.scale.set(1, 1, len);
    m.frustumCulled = false;
    holder.add(m);
  };
  // Ion tail: narrow, straight, blue. Two crossed ribbons so it reads from any side.
  const ion = ribbon(coma * 0.4, tail * 0.035, 0);
  mk(ion, 0x6fb4ff, 0.9, 14, 0, tail);
  mk(ion, 0x6fb4ff, 0.9, 14, Math.PI / 2, tail);
  // Dust tail: broad, curved back along the orbit, pale yellow.
  const dust = ribbon(coma * 0.8, tail * 0.17, tail * 0.1);
  mk(dust, 0xffe6b0, 0.6, 9, 0, tail * 0.8);
  mk(ribbon(coma * 0.8, tail * 0.1, 0), 0xffe6b0, 0.3, 9, Math.PI / 2, tail * 0.7);
  // The coma: a faint haze round the nucleus that thins as you fly into it.
  const haze = glowSprite(0xbfe0ff, coma * 2, 0.5);
  const base = 0.5, wp = new THREE.Vector3();
  haze.onBeforeRender = (_r, _s, cam) => {
    haze.getWorldPosition(wp);
    const d = cam.position.distanceTo(wp);
    (haze.material as THREE.SpriteMaterial).opacity = base * THREE.MathUtils.clamp(d / (coma * 1.2), 0.04, 1);
  };
  g.add(haze);
  return g;
}
