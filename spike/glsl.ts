// The classic-WebGL half of the spike: the same two shaders the game uses (copied from main.ts so
// the spike does not have to import the game's entry file), for side-by-side comparison with the
// TSL ports in tsl.ts.

import * as THREE from 'three';

const ATMO_TOP = 1.015;
const ATMO_V = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vP;
void main() {
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const ATMO_F = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 beta;
uniform vec3 sunDir; uniform vec3 cam; uniform float R; uniform float strength;
varying vec3 vP;
const float TOP = ${ATMO_TOP};
const float H = (TOP - 1.0) / 6.0;
const float MIE = 0.12;
vec2 hit(vec3 o, vec3 d, float r) {
  float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
float depthTo(vec3 p, vec3 d) {
  vec2 t = hit(p, d, TOP);
  float l = t.y / 4.0, od = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 q = p + d * (l * (float(i) + 0.5));
    od += exp(-(length(q) - 1.0) / H);
  }
  return od * l;
}
void main() {
  #include <logdepthbuf_fragment>
  vec3 o = cam / R, d = normalize(vP / R - o);
  vec2 ta = hit(o, d, TOP), tp = hit(o, d, 1.0);
  float t0 = max(ta.x, 0.0), t1 = ta.y;
  if (tp.x > 0.0) t1 = min(t1, tp.x);
  if (t1 <= t0) discard;
  const int N = 14;
  float ds = (t1 - t0) / float(N), odView = 0.0;
  vec3 sumR = vec3(0.0); float sumM = 0.0;
  for (int i = 0; i < N; i++) {
    vec3 p = o + d * (t0 + ds * (float(i) + 0.5));
    float dens = exp(-(length(p) - 1.0) / H) * ds;
    odView += dens;
    if (hit(p, sunDir, 1.0).x > 0.0) continue;
    float odSun = depthTo(p, sunDir);
    vec3 att = exp(-(beta + MIE * 0.02) * (odView + odSun));
    sumR += att * dens;
    sumM += att.g * dens;
  }
  float mu = dot(d, sunDir);
  float phaseR = 0.0597 * (1.0 + mu * mu);
  float g = 0.76, phaseM = 0.119 * (1.0 - g * g) * (1.0 + mu * mu) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  vec3 col = (sumR * beta * phaseR + sumM * MIE * 0.02 * phaseM) * 6.8 * strength;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function atmosphere(R: number, beta: THREE.Vector3, sunDir: THREE.Vector3, cam: THREE.Vector3, strength: number): THREE.Material {
  const uniforms = { beta: { value: beta }, sunDir: { value: sunDir }, cam: { value: cam }, R: { value: R }, strength: { value: strength } };
  return new THREE.ShaderMaterial({ uniforms, vertexShader: ATMO_V, fragmentShader: ATMO_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
}

export function nightOnly(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #if NUM_POINT_LIGHTS > 0
        totalEmissiveRadiance *= smoothstep(0.1, -0.2, dot(normal, normalize(pointLights[0].position + vViewPosition)));
      #endif`);
  };
  mat.customProgramCacheKey = () => 'night-only';
}

/** The game's depth patch (main.ts): scale the distance before taking its logarithm. */
export const LOGK = 1e9;
export function patchLogDepth() {
  THREE.ShaderChunk.logdepthbuf_vertex = THREE.ShaderChunk.logdepthbuf_vertex.replace('1.0 + gl_Position.w', `1.0 + gl_Position.w * ${LOGK.toExponential(1)}`);
}
