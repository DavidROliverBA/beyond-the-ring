// The drive plume of the ship you fly: a Epstein-drive exhaust, as the show draws it. Very bright and
// narrow, white-hot at the nozzle and turning blue as it thins, streaming a long way back and
// steady rather than ragged. Three soft beams cross along the axis, so from any side there is one
// facing you; looking straight down the exhaust you see the glow at the nozzle instead. The colours
// go well above 1, so the bloom pass gives it the blown-out halo a real exhaust has.
//
// Lengths are in the ship's own model units (the Rocinante is 1.24 long, 46 m), so the plume scales
// with the ship whatever size it is shown at.

import * as THREE from 'three';
import { glowSprite } from './ships';

const BEAM_V = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const BEAM_F = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float time; uniform float power; uniform float phase;
varying vec2 vUv;
void main() {
  #include <logdepthbuf_fragment>
  float along = vUv.y;                      // 0 at the nozzle, 1 at the tip
  float x = (vUv.x - 0.5) * 2.0;            // -1..1 across the beam
  // The beam opens only a little as it goes: a tight shaft, not a cone.
  float open = 0.32 + 0.68 * along;
  float g = exp(-pow(x / open, 2.0) * 3.2);
  // A steady glow with a slow ripple travelling away from the ship.
  float ripple = 0.88 + 0.07 * sin(along * 38.0 - time * 21.0 + phase) + 0.05 * sin(along * 91.0 - time * 47.0 + x * 4.0);
  float bright = g * ripple * exp(-along * 2.1) * (1.0 - smoothstep(0.78, 1.0, along));
  float core = pow(g, 4.0) * exp(-along * 5.5);                    // the hot centre line
  vec3 outer = vec3(0.16, 0.38, 1.0), mid = vec3(0.55, 0.78, 1.0), hot = vec3(1.0, 0.96, 0.9);
  vec3 col = mix(outer, mid, smoothstep(0.0, 0.55, bright)) + hot * core * 1.6;
  gl_FragColor = vec4(col * bright * power * 2.4, 1.0);
}`;

export class DrivePlume extends THREE.Group {
  private beams: THREE.Mesh[] = [];
  private mats: THREE.ShaderMaterial[] = [];
  private glow: THREE.Sprite;
  private core: THREE.Sprite;
  private level = 0;

  /** `radius` is the nozzle radius, `reach` the length at full thrust, both in model units. */
  constructor(private radius: number, private reach: number) {
    super();
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1).translate(0, 0.5, 0).rotateX(Math.PI / 2);   // along +z, from 0 to 1
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, power: { value: 0 }, phase: { value: i * 2.1 } },
        vertexShader: BEAM_V, fragmentShader: BEAM_F,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.z = (i * Math.PI) / 3;
      m.frustumCulled = false;
      this.add(m);
      this.beams.push(m);
      this.mats.push(mat);
    }
    this.glow = glowSprite(0x7fb8ff, 1, 0.9);
    this.core = glowSprite(0xffffff, 1, 1);
    this.add(this.glow, this.core);
    this.visible = false;
  }

  /** `thrust` 0..1 is what the drive is doing; `t` is the clock in seconds. */
  update(thrust: number, t: number) {
    // Light and dim over about a third of a second, never instantly.
    this.level += (thrust - this.level) * (1 - Math.exp(-9 * 0.016));
    const k = this.level;
    this.visible = k > 0.01;
    if (!this.visible) return;
    const len = this.radius * 2 + this.reach * Math.pow(k, 0.85);
    const wide = this.radius * 2.6;
    for (let i = 0; i < 3; i++) {
      this.beams[i].scale.set(wide, 1, len);
      this.mats[i].uniforms.time.value = t;
      this.mats[i].uniforms.power.value = Math.min(1, k * 1.15);
    }
    this.glow.scale.setScalar(this.radius * (8 + 10 * k));
    (this.glow.material as THREE.SpriteMaterial).opacity = 0.35 + 0.5 * k;
    this.core.scale.setScalar(this.radius * (3.2 + 3.5 * k));
    (this.core.material as THREE.SpriteMaterial).opacity = 0.5 + 0.5 * k;
  }
}
