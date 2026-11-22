// The camera look: what a real lens and film add on top of the render.
//   - God rays: the sun's light streaking past whatever is in front of it. A radial blur of only the
//     very brightest pixels towards the sun's place on screen (after GPU Gems 3, chapter 13). Planets
//     and ships in front are dark in the image already, so they block the rays without a second render.
//   - Lens ghosts and halo: bright light reflecting between lens elements, mirrored through the centre
//     of the frame (after John Chapman's "Pseudo Lens Flare", 2013). The source is the bloom pass's own
//     blurred bright image, so the ghosts come out soft. A smudge of lens dirt and a starburst that
//     turns with the camera make them catch the light like glass.
//   - Film finish: a colour grade for each place, a vignette and fine grain, applied after tone mapping.
// Our own implementations of published techniques; the dirt and starburst textures are drawn here.

import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const FULL_V = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// ---------------------------------------------------------------- god rays
// Worked out at a quarter of the screen's resolution from the bloom's half-size bright image: rays are
// soft anyway, and this is about sixteen times less work than marching the full-size picture.
const RAYS = {
  uniforms: {
    tSrc: { value: null as THREE.Texture | null },
    sun: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: FULL_V,
  fragmentShader: /* glsl */ `
    uniform sampler2D tSrc; uniform vec2 sun;
    varying vec2 vUv;
    const int N = 40;
    void main() {
      // March from this pixel towards the sun, adding up light that is far brighter than anything lit.
      vec2 step = (vUv - sun) / float(N) * 0.92;
      vec2 uv = vUv;
      float decay = 1.0;
      vec3 acc = vec3(0.0);
      for (int i = 0; i < N; i++) {
        uv -= step;
        vec3 s = texture2D(tSrc, uv).rgb;
        float l = max(max(s.r, s.g), s.b);
        acc += s * smoothstep(1.1, 2.0, l) * decay;
        decay *= 0.95;
      }
      gl_FragColor = vec4(acc * 0.035, 1.0);
    }`,
};

class RaysPass extends Pass {
  target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  quad: FullScreenQuad;
  mat: THREE.ShaderMaterial;
  constructor(private src: () => THREE.Texture | null) {
    super();
    this.needsSwap = false;
    this.mat = new THREE.ShaderMaterial({ ...RAYS, uniforms: THREE.UniformsUtils.clone(RAYS.uniforms) });
    this.quad = new FullScreenQuad(this.mat);
  }
  setSize(w: number, h: number) { this.target.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2)); }
  render(renderer: THREE.WebGLRenderer) {
    this.mat.uniforms.tSrc.value = this.src();
    renderer.setRenderTarget(this.target);
    this.quad.render(renderer);
  }
}

// ---------------------------------------------------------------- lens ghosts
const LENS = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tBright: { value: null as THREE.Texture | null },
    tDirt: { value: null as THREE.Texture | null },
    tStar: { value: null as THREE.Texture | null },
    tRays: { value: null as THREE.Texture | null },
    rays: { value: 0 },
    starTurn: { value: 0 },
    aspect: { value: 1 },
    amount: { value: 0 },
    streak: { value: 0 },
  },
  vertexShader: FULL_V,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse, tBright, tDirt, tStar, tRays; uniform float starTurn, aspect, amount, rays, streak;
    varying vec2 vUv;
    vec3 bright(vec2 uv) { return texture2D(tBright, uv).rgb; }
    // A touch of colour fringing on the halo, as real glass splits light.
    vec3 fringe(vec2 uv, vec2 dir) {
      float d = 0.006;
      return vec3(bright(uv - dir * d).r, bright(uv).g, bright(uv + dir * d).b);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb += texture2D(tRays, vUv).rgb * rays;
      // Anamorphic streak: bright lights stretched sideways into a cool blue line, as through a cinema lens.
      if (streak > 0.001) {
        vec3 st = vec3(0.0);
        for (int i = -14; i <= 14; i++) {
          float fi = float(i);
          vec3 b = bright(vUv + vec2(fi * 0.022 / aspect * 1.6, 0.0));
          float l = max(max(b.r, b.g), b.b);
          st += b * smoothstep(0.25, 1.2, l) * exp(-abs(fi) * 0.17);
        }
        c.rgb += st * vec3(0.30, 0.55, 1.0) * 0.07 * streak;
      }
      if (amount <= 0.001) { gl_FragColor = c; return; }
      vec2 tc = vec2(1.0) - vUv;                 // ghosts appear mirrored through the centre
      vec2 gv = (vec2(0.5) - tc) * 0.37;
      vec3 g = vec3(0.0);
      vec3 tint[4];
      tint[0] = vec3(1.0, 0.82, 0.62); tint[1] = vec3(0.55, 0.85, 1.0); tint[2] = vec3(0.8, 1.0, 0.7); tint[3] = vec3(1.0, 0.6, 0.9);
      for (int i = 1; i < 5; i++) {
        vec2 o = tc + gv * float(i);
        if (o.x < 0.0 || o.y < 0.0 || o.x > 1.0 || o.y > 1.0) continue;
        float w = pow(1.0 - length(vec2(0.5) - o) / 0.7071, 8.0);
        g += bright(o) * w * tint[i - 1];
      }
      vec2 hv = normalize(gv + 1e-6) * 0.42;
      vec2 ho = tc + hv;
      float hw = pow(1.0 - length(vec2(0.5) - fract(ho)) / 0.7071, 6.0);
      g += fringe(fract(ho), normalize(gv + 1e-6)) * hw * 0.6;
      // Dirt on the glass catches the light; the starburst spins with the view.
      vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
      float cs = cos(starTurn), sn = sin(starTurn);
      vec2 sp = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y) * 0.9 + 0.5;
      float glass = 0.25 + texture2D(tDirt, vUv).r * 1.2 + texture2D(tStar, sp).r * 0.6;
      gl_FragColor = vec4(c.rgb + g * glass * amount, c.a);
    }`,
};

// ---------------------------------------------------------------- film finish
const FINISH = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    gain: { value: new THREE.Vector3(1, 1, 1) },
    lift: { value: new THREE.Vector3(0, 0, 0) },
    gamma: { value: new THREE.Vector3(1, 1, 1) },
    vignette: { value: 0.35 },
    grain: { value: 0.025 },
    grainK: { value: 1 },
    time: { value: 0 },
    aspect: { value: 1 },
    cine: { value: 0 },
  },
  vertexShader: FULL_V,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec3 gain, lift, gamma; uniform float vignette, grain, grainK, time, aspect, cine;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      // Colour fringing towards the corners, as real glass splits light (only in the film look).
      vec2 ca = (vUv - 0.5) * 0.0042 * cine;
      vec4 c = texture2D(tDiffuse, vUv);
      if (cine > 0.001) c.rgb = vec3(texture2D(tDiffuse, vUv - ca).r, c.g, texture2D(tDiffuse, vUv + ca).b);
      vec3 x = clamp(c.rgb, 0.0, 1.0);
      x = x * gain + lift * (1.0 - x);
      // The film grade: cool teal in the shadows, warm in the highlights, a little more contrast.
      float lum = dot(x, vec3(0.299, 0.587, 0.114));
      x = mix(x, x * mix(vec3(0.90, 1.02, 1.10), vec3(1.08, 1.0, 0.92), smoothstep(0.15, 0.8, lum)), 0.55 * cine);
      x = mix(x, x * x * (3.0 - 2.0 * x), 0.30 * cine);
      x = pow(max(x, vec3(0.0)), 1.0 / gamma);
      float r = length((vUv - 0.5) * vec2(aspect, 1.0));
      x *= mix(1.0, smoothstep(1.05, 0.35, r), vignette + 0.22 * cine);
      x += (hash(vUv * 1024.0 + fract(time) * 97.0) - 0.5) * (grain + 0.02 * cine) * grainK;
      gl_FragColor = vec4(x, c.a);
    }`,
};

/** How each place is graded: [gain, lift, gamma] in display colour. */
type Grade = [THREE.Vector3Tuple, THREE.Vector3Tuple, THREE.Vector3Tuple];
const GRADES: Record<string, Grade> = {
  space:    [[0.97, 1.0, 1.06], [0.0, 0.004, 0.012], [1.0, 1.0, 1.04]],   // cold, deep blacks with a blue lift
  ceres:    [[1.06, 1.0, 0.92], [0.012, 0.006, 0.0], [1.03, 1.0, 0.97]],  // warm, dusty
  tycho:    [[1.0, 1.02, 1.02], [0.0, 0.006, 0.008], [1.0, 1.0, 1.0]],    // clean, a little teal
  medina:   [[0.98, 1.05, 0.94], [0.004, 0.01, 0.0], [1.0, 1.03, 0.98]],  // farm green
  ganymede: [[0.98, 1.0, 1.05], [0.0, 0.004, 0.01], [1.0, 1.0, 1.03]],    // cool dome light
};

/** Lens dirt: soft smudges and a few streaks, drawn once. */
function dirtTexture() {
  const S = 512, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    const x = r() * S, y = r() * S, rad = 4 + r() * 38, a = 0.04 + r() * 0.16;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, `rgba(255,255,255,${a})`); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 14; i++) {
    g.lineWidth = 1 + r() * 4;
    g.beginPath(); g.moveTo(r() * S, r() * S); g.quadraticCurveTo(r() * S, r() * S, r() * S, r() * S); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** A starburst: thin rays of different lengths from the centre. */
function starTexture() {
  const S = 256, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2 + (i % 2) * 0.03, len = S * (0.18 + ((i * 37) % 11) / 22);
    const grd = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = grd; g.lineWidth = i % 6 === 0 ? 2 : 1;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * len, Math.sin(a) * len); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export interface Look {
  /** Switch the whole look off (photo comparisons, slow machines). */
  enabled: boolean;
  /** 1 for the film look (tours): streaks, split-tone grade, fringing, heavier vignette and grain; it eases in and out. */
  cine: number;
  /** Sun glare (ghosts, halo, rays) in free flight. Tours keep it regardless. */
  flares: boolean;
  /** 0 turns the film grain off (reduced motion), 1 is normal. */
  grain: number;
  rays: Pass;
  lens: ShaderPass;
  finish: ShaderPass;
  /** Call each frame. `sun` is the star's world position in flight, or null on foot. */
  update(dt: number, place: string, camera: THREE.Camera, sun: THREE.Vector3 | null, aspect: number): void;
}

export function createLook(bloom: UnrealBloomPass): Look {
  const rays = new RaysPass(() => bloom.renderTargetsVertical[0]?.texture ?? null);
  const lens = new ShaderPass(LENS);
  const finish = new ShaderPass(FINISH);
  lens.uniforms.tDirt.value = dirtTexture();
  lens.uniforms.tStar.value = starTexture();
  lens.uniforms.tRays.value = rays.target.texture;
  const target: Record<'gain' | 'lift' | 'gamma', THREE.Vector3> = { gain: new THREE.Vector3(), lift: new THREE.Vector3(), gamma: new THREE.Vector3() };
  const p = new THREE.Vector3(), fwd = new THREE.Vector3(), toSun = new THREE.Vector3();
  let t = 0, rayK = 0, cineK = 0;

  return {
    rays, lens, finish, enabled: true, cine: 0, flares: false, grain: 1,
    update(dt, place, camera, sun, aspect) {
      t += dt;
      cineK += (this.cine - cineK) * (1 - Math.exp(-dt * 2.5));
      finish.uniforms.cine.value = cineK;
      finish.uniforms.grainK.value = this.grain;
      lens.uniforms.streak.value = this.enabled ? cineK : 0;
      lens.enabled = finish.enabled = this.enabled;
      // Grade: ease towards the place's look over about a second, so docking doesn't snap.
      const [gain, lift, gamma] = GRADES[place] ?? GRADES.space;
      target.gain.fromArray(gain); target.lift.fromArray(lift); target.gamma.fromArray(gamma);
      const k = 1 - Math.exp(-dt * 3);
      for (const key of ['gain', 'lift', 'gamma'] as const) (finish.uniforms[key].value as THREE.Vector3).lerp(target[key], k);
      finish.uniforms.time.value = t;
      finish.uniforms.aspect.value = aspect;
      finish.uniforms.vignette.value = sun ? 0.4 : 0.3;

      // The lens picks up the bloom's softest bright image (it has already rendered this frame).
      lens.uniforms.tBright.value = bloom.renderTargetsVertical[1]?.texture ?? null;
      lens.uniforms.aspect.value = aspect;
      // The starburst turns as the view turns, like a real one does with the lens.
      camera.getWorldDirection(fwd);
      lens.uniforms.starTurn.value = Math.atan2(fwd.x, fwd.z) * 2 + fwd.y * 2;

      // Rays only in flight, only when the sun is ahead, fading out as it leaves the frame.
      let want = 0;
      if (sun) {
        toSun.copy(sun).sub(camera.getWorldPosition(p)).normalize();
        const facing = toSun.dot(fwd);
        p.copy(sun).project(camera);
        if (facing > 0) {
          rays.mat.uniforms.sun.value.set((p.x + 1) / 2, (p.y + 1) / 2);
          want = THREE.MathUtils.clamp(1.4 - Math.hypot(p.x, p.y) * 0.8, 0, 1);
        }
      }
      rayK += (want - rayK) * (1 - Math.exp(-dt * 6));
      // In free flight the glare is off unless asked for; in a tour or film it fades up with the film look.
      const glare = this.flares ? 1 : cineK;
      lens.uniforms.rays.value = this.enabled ? rayK * glare : 0;
      rays.enabled = this.enabled && rayK * glare > 0.002;
      // Ghosts, halo and starburst come from whatever is brightest, so a bright planet raised them too. Only the star
      // should: they follow the star being in view (as the rays do), and stay faint otherwise.
      lens.uniforms.amount.value = (sun ? 0.03 + 0.27 * Math.min(1, rayK * 1.5) : 0.03) * (1 + 0.35 * cineK) * (0.1 + 0.9 * glare);
    },
  };
}
