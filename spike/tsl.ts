// The game's custom shaders, rewritten in TSL (three's node shading language) for WebGPURenderer.
// Each one sits beside a note of where the GLSL original lives, so the two can be read together.

import * as THREE from 'three/webgpu';
import {
  Fn, If, Loop, Discard, float, vec2, vec3, vec4, uniform, texture, uv, time,
  positionLocal, positionView, normalWorld, cameraFar,
  dot, length, sqrt, exp, max, min, normalize, pow, log2, smoothstep, mix, sin, cos, fract, floor, step, atan, clamp,
  pass, renderOutput, screenUV,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

// TSL's own typings are loose about what a node is; this keeps the ports readable.
type N = any;

// ------------------------------------------------------------------ depth
// The game's depth trick (main.ts, the LOGK patch): store log2(1 + distance * K) so that a ship
// metres away and a star a thousand units away both get usable depth. three's own WebGPU
// logarithmic depth cannot be used as it is: it clamps the near plane to 0.000001 units, which
// here is 150 m, and everything nearer than that lands on depth zero.
export const LOGK = 1e9;
export const logDepth = (): N => {
  const w = positionView.z.negate();
  return log2(w.mul(LOGK).add(1)).div(log2(cameraFar.mul(LOGK).add(1)));
};

/** Give every material in a scene the scaled logarithmic depth. Classic materials keep the
 *  property when the renderer turns them into node materials. */
export function applyLogDepth(root: THREE.Object3D) {
  const node = logDepth();
  root.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) (m as N).depthNode = node;
  });
}

// ------------------------------------------------------------------ night lights
// main.ts nightOnly(): an onBeforeCompile patch that fades the city lights where the sun reaches.
// In TSL it is one line on the same material, no string surgery. (The GLSL used smoothstep with
// its edges the wrong way round, which WGSL leaves undefined, so it is written the right way here.)
export function nightOnly(mat: THREE.MeshStandardMaterial, night: THREE.Texture, sunDir: THREE.Vector3) {
  const lit = dot(normalWorld, uniform(sunDir));
  (mat as N).emissiveNode = texture(night).rgb.mul(mat.emissiveIntensity).mul(smoothstep(-0.2, 0.1, lit).oneMinus());
}

// ------------------------------------------------------------------ atmosphere
// main.ts ATMO_V / ATMO_F: single scattering marched per pixel through the air shell, worked in
// the planet's own units (radius 1) with the camera passed in relative to the planet.
const TOP = 1.015, H = (TOP - 1) / 6, MIE = 0.12;

/** Entry and exit distances along a ray through a sphere of radius r at the origin. */
const hit = Fn(([o, d, r]: N[]) => {
  const b = dot(o, d), c = dot(o, o).sub(r.mul(r)), h = b.mul(b).sub(c);
  const res = vec2(1e9, -1e9).toVar();
  If(h.greaterThanEqual(0), () => {
    const s = sqrt(h);
    res.assign(vec2(b.negate().sub(s), b.negate().add(s)));
  });
  return res;
});

/** Air between a point and the top of the atmosphere, towards the sun. */
const depthTo = Fn(([p, d]: N[]) => {
  const t = hit(p, d, float(TOP));
  const l = t.y.div(4), od = float(0).toVar();
  Loop(4, ({ i }: N) => {
    const q = p.add(d.mul(l.mul(float(i).add(0.5))));
    od.addAssign(exp(length(q).sub(1).div(H).negate()));
  });
  return od.mul(l);
});

export function atmosphere(R: number, beta: THREE.Vector3, sunDir: THREE.Vector3, cam: THREE.Vector3, strength: number): THREE.Material {
  const uBeta = uniform(beta), uSun = uniform(sunDir), uCam = uniform(cam), uR = uniform(R), uK = uniform(strength);
  const colour = Fn(() => {
    const o = uCam.div(uR), d = normalize(positionLocal.div(uR).sub(o));
    const ta = hit(o, d, float(TOP)), tp = hit(o, d, float(1));
    const t0 = max(ta.x, 0), t1 = ta.y.toVar();
    If(tp.x.greaterThan(0), () => { t1.assign(min(t1, tp.x)); });      // stop at the ground
    If(t1.lessThanEqual(t0), () => { Discard(); });
    const STEPS = 14;
    const ds = t1.sub(t0).div(STEPS), odView = float(0).toVar();
    const sumR = vec3(0).toVar(), sumM = float(0).toVar();
    Loop(STEPS, ({ i }: N) => {
      const p = o.add(d.mul(t0.add(ds.mul(float(i).add(0.5)))));
      const dens = exp(length(p).sub(1).div(H).negate()).mul(ds);
      odView.addAssign(dens);
      If(hit(p, uSun, float(1)).x.lessThanEqual(0), () => {            // not in the planet's shadow
        const odSun = depthTo(p, uSun);
        const att = exp(uBeta.add(MIE * 0.02).mul(odView.add(odSun)).negate());
        sumR.addAssign(att.mul(dens));
        sumM.addAssign(att.g.mul(dens));
      });
    });
    const mu = dot(d, uSun), g = 0.76;
    const phaseR = mu.mul(mu).add(1).mul(0.0597);
    const phaseM = mu.mul(mu).add(1).mul(0.119 * (1 - g * g)).div(pow(mu.mul(-2 * g).add(1 + g * g), 1.5).mul(2 + g * g));
    return sumR.mul(uBeta).mul(phaseR).add(sumM.mul(MIE * 0.02).mul(phaseM)).mul(6.8).mul(uK);
  });
  const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  mat.colorNode = colour();
  return mat;
}

// ------------------------------------------------------------------ ring gate
// main.ts GATE_V / GATE_F: the swirling film across a gate.
export function gateFilm(): THREE.Material {
  const p = uv().sub(0.5), r = length(p).mul(2), a = atan(p.y, p.x);
  const swirl = sin(a.mul(5).add(time.mul(0.9)).add(r.mul(9))).mul(0.5).add(0.5);
  const ripple = sin(r.mul(26).sub(time.mul(2.2))).mul(0.5).add(0.5);
  const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false });
  mat.colorNode = mix(vec3(0.01, 0.03, 0.09), vec3(0.16, 0.5, 1.0), swirl.mul(ripple).mul(0.7).add(0.08));
  mat.opacityNode = smoothstep(0.86, 1.0, r).oneMinus().mul(0.75);
  return mat;
}

// ------------------------------------------------------------------ hologram adverts
// interior.ts line 854: scan lines, flicker and the odd sideways glitch band over a painted sign.
export function hologram(map: THREE.Texture): THREE.Material {
  const band = step(0.985, fract(sin(floor(time.mul(2.5)).mul(91.7).add(floor(uv().y.mul(12)))).mul(43758.5)));
  const t = texture(map, uv().add(vec2(band.mul(0.04), 0)));
  const scan = sin(uv().y.mul(260).add(time.mul(7))).mul(0.18).add(0.82);
  const flick = sin(time.mul(19).add(uv().x.mul(3))).mul(0.08).add(0.92);
  const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false });
  mat.colorNode = t.rgb.mul(scan).mul(flick).mul(1.9);
  mat.opacityNode = float(0.92);
  return mat;
}

// ------------------------------------------------------------------ the post chain
// main.ts composer: render (4x MSAA, half float) -> bloom -> rays -> lens -> tone map -> film finish.
// EffectComposer does not exist on WebGPU. This is the same chain as one node graph: the scene
// pass, three's own BloomNode, tone mapping (renderOutput), then look.ts's film finish in TSL.
// God rays and lens ghosts are not ported here; see docs/WEBGPU-SPIKE.md for what they need.
export interface Post { render(): void; setScene(s: THREE.Scene, c: THREE.Camera): void }
export function postChain(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera, grade: [number[], number[], number[]] = [[0.97, 1.0, 1.06], [0.0, 0.004, 0.012], [1.0, 1.0, 1.04]]): Post {
  const scenePass = pass(scene, camera, { samples: 4 });
  const colour = scenePass.getTextureNode();
  const glow = bloom(colour, 0.32, 0.4, 1.0);
  const toned = renderOutput(colour.add(glow));
  // look.ts FINISH: grade, vignette, grain, after tone mapping.
  const gain = uniform(new THREE.Vector3(...grade[0])), lift = uniform(new THREE.Vector3(...grade[1])), gamma = uniform(new THREE.Vector3(...grade[2]));
  const vignette = uniform(0.4), grain = uniform(0.025), aspect = uniform(1.75);
  const finish = Fn(() => {
    const c = toned;
    const x = clamp(c.rgb, 0, 1).toVar();
    x.assign(x.mul(gain).add(lift.mul(x.oneMinus())));
    x.assign(pow(max(x, vec3(0)), vec3(1).div(gamma)));
    const r = length(screenUV.sub(0.5).mul(vec2(aspect, 1)));
    x.mulAssign(mix(1, smoothstep(0.35, 1.05, r).oneMinus(), vignette));
    const hash = fract(sin(dot(screenUV.mul(1024).add(fract(time).mul(97)), vec2(12.9898, 78.233))).mul(43758.5453));
    x.addAssign(hash.sub(0.5).mul(grain));
    return vec4(x, c.a);
  });
  const pipeline = new THREE.RenderPipeline(renderer);
  pipeline.outputColorTransform = false;   // renderOutput above already tone maps and converts colour
  pipeline.outputNode = finish();
  return {
    render() { const s = renderer.getSize(new THREE.Vector2()); aspect.value = s.x / s.y; pipeline.render(); },
    setScene(s, c) { scenePass.scene = s; scenePass.camera = c; },
  };
}
void cos; void vec4;
