import * as THREE from 'three';
import { SOL_UNIT, makeTraffic, type Fleet, type Port } from './traffic';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  AU, GATE_COUNT, NAMED, SLOW_RADIUS, SOL, gateName, genSystem,
  type BeltSpec, type BodySpec, type Kind, type SystemSpec,
} from './data';
import { Noise, mapKinds, paintBody, paintRing, rng, type Maps } from './textures';
import { buildModel, glowSprite, glowTex, loadModels, playerShip, ROCI_UNIT, tickShipLights, type ShipModel } from './ships';
import { buildInterior, type Interior, type Point } from './interior';
import { BAKING, canBounce, savedProbes } from './probes';
import { loadPeople } from './skinned';
import { SPIN_ON, feel } from './spin';
import { createLook } from './look';
import { addLightning } from './lightning';
import { makeComet } from './comet';
import { createTour, genericShots, type Voyage } from './tour';
import { VOYAGES, createVoyageMenu } from './voyages';
import { FLIP_SECS, planTrip } from './course';
import { createMap } from './starmap';
import { makeSky } from './sky';
import { PHOTOS, STARS, type PhotoSet } from './photos';

type V3 = THREE.Vector3;
const V3 = THREE.Vector3;
const ZERO = new V3();
const _Z = new V3(0, 0, 1);
const TAU = Math.PI * 2;
const $ = (id: string) => document.getElementById(id)!;
const pause = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// ---------------------------------------------------------------- renderer

// Ships here are metres across in a world measured in thousandths of an AU, so the stock
// logarithmic depth (which works on 1 + distance) cannot separate them. Scale the distance
// first, and give every camera a far plane scaled to match.
const LOGK = 1e9;
THREE.ShaderChunk.logdepthbuf_vertex = THREE.ShaderChunk.logdepthbuf_vertex.replace('1.0 + gl_Position.w', `1.0 + gl_Position.w * ${LOGK.toExponential(1)}`);

const canvas = $('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000003);
const camera = new THREE.PerspectiveCamera(60, 1, 1e-9, 4e6 * LOGK);
const walkCam = new THREE.PerspectiveCamera(72, 1, 0.08, 12000 * LOGK);
/** How far a light probe sees when the bake tool takes them (scaled like every far plane). */
const PROBE_FAR = 400 * LOGK;

// Everything is drawn into a float buffer first, so lamps, drives and city lights
// can be brighter than white and bleed a little, the way they do on film.
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
const renderPass = new RenderPass(scene, camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.4, 1.0);
// Render, bloom, then the lens: sun rays and ghosts from the bloom's bright image, tone mapping, film finish.
const look = createLook(bloom);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(look.rays);
composer.addPass(look.lens);
composer.addPass(new OutputPass());
composer.addPass(look.finish);
function draw(s: THREE.Scene, c: THREE.Camera) {
  renderPass.scene = s;
  renderPass.camera = c;
  // (With ?debug the counts of what was drawn are kept for the whole frame, not just its last pass.)
  if (!renderer.info.autoReset) renderer.info.reset();
  composer.render();
}

/** Get a scene ready to show without hitches: upload every texture and compile every shader now,
 *  while the screen is still dark, instead of on the first frame each thing comes into view.
 *  Shaders are compiled for the off-screen buffer the scene is really drawn into (it skips tone
 *  mapping, which happens in the last pass), or they would not be the ones used. */
async function warm(s: THREE.Scene, c: THREE.Camera) {
  const seen = new Set<THREE.Texture>();
  s.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture && !seen.has(v)) { seen.add(v); renderer.initTexture(v); }
    }
  });
  renderer.setRenderTarget(composer.renderTarget1);
  const done = renderer.compileAsync(s, c);
  renderer.setRenderTarget(null);
  await done;
}

// A dim studio stands in for all the light bouncing around, so metal has something to reflect.
const envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
// Out in space it is different: black sky with the star in it. Metal facing away from the star
// reflects dark, and metal facing it picks up a broad glint, which is what gives hulls their contrast.
// (The room above is kept for the interiors.) The star's patch is turned to face the star each frame.
const spaceEnv = (() => {
  const e = new THREE.Scene();
  e.background = new THREE.Color(0x05070d);
  const sunPatch = new THREE.Mesh(new THREE.SphereGeometry(4.2, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.94, 0.82).multiplyScalar(16) }));
  sunPatch.position.set(0, 0, 10);
  e.add(sunPatch);
  // A faint band of galaxy-light all round, so nothing is a perfect mirror of black.
  const band = new THREE.Mesh(new THREE.TorusGeometry(10, 1.4, 8, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.62, 0.8).multiplyScalar(0.35) }));
  band.rotation.x = Math.PI / 2.6;
  e.add(band);
  return new THREE.PMREMGenerator(renderer).fromScene(e, 0.05).texture;
})();
scene.environment = spaceEnv;
scene.environmentIntensity = 1;
// Planets, moons and rocks must not pick up that studio: it lit night sides like day. A material's
// envMapIntensity doesn't scale scene.environment, so they get their own black environment instead.
const NO_ENV = new THREE.PMREMGenerator(renderer).fromScene(new THREE.Scene(), 0).texture;

function resize() {
  composer.setPixelRatio(Math.min(devicePixelRatio, 2));
  composer.setSize(innerWidth, innerHeight);
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = walkCam.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  walkCam.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

function canvasTex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const texLoader = new THREE.TextureLoader();
async function loadTex(url: string, srgb = true): Promise<THREE.Texture> {
  const t = await texLoader.loadAsync(url);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Roughness from a water mask: seas glint, land stays matt. */
async function waterRoughness(url: string): Promise<THREE.Texture> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d')!;
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'difference';
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'lighten';
  x.fillStyle = '#5c5c5c';
  x.fillRect(0, 0, c.width, c.height);
  const t = canvasTex(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// ----------------------------------------------------------------- shaders

// Air seen from space: single scattering, marched per pixel (after O'Neil, GPU Gems 2 ch. 16).
// Worked in the planet's own units (radius 1) with the camera passed in relative to the planet, so
// true-scale distances don't eat the float precision. Short wavelengths scatter most (a blue limb);
// light crossing a lot of air loses its blue (red at the terminator); air in shadow scatters nothing.
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
uniform vec3 beta;      // scattering per planet radius, per colour
uniform vec3 sunDir; uniform vec3 cam; uniform float R; uniform float strength;
varying vec3 vP;
const float TOP = ${ATMO_TOP};
const float H = (TOP - 1.0) / 6.0;       // scale height: the air thins by e every sixth of the shell
const float MIE = 0.12;                   // haze, a little, scattered mostly forwards
vec2 hit(vec3 o, vec3 d, float r) {       // entry and exit distances along a ray through a sphere
  float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
float depthTo(vec3 p, vec3 d) {           // air between a point and the top, towards the sun
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
  if (tp.x > 0.0) t1 = min(t1, tp.x);     // stop at the ground
  if (t1 <= t0) discard;
  const int N = 14;
  float ds = (t1 - t0) / float(N), odView = 0.0;
  vec3 sumR = vec3(0.0); float sumM = 0.0;
  for (int i = 0; i < N; i++) {
    vec3 p = o + d * (t0 + ds * (float(i) + 0.5));
    float dens = exp(-(length(p) - 1.0) / H) * ds;
    odView += dens;
    if (hit(p, sunDir, 1.0).x > 0.0) continue;   // in the planet's shadow
    float odSun = depthTo(p, sunDir);
    vec3 att = exp(-(beta + MIE * 0.02) * (odView + odSun));
    sumR += att * dens;
    sumM += att.g * dens;
  }
  float mu = dot(d, sunDir);
  float phaseR = 0.0597 * (1.0 + mu * mu);
  float g = 0.76, phaseM = 0.119 * (1.0 - g * g) * (1.0 + mu * mu) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  vec3 col = (sumR * beta * phaseR + sumM * MIE * 0.02 * phaseM) * 6.8 * strength;   // twice the sunlight: single scattering alone undersells the bright limb
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const GATE_V = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const GATE_F = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float time;
varying vec2 vUv;
void main() {
  #include <logdepthbuf_fragment>
  vec2 p = vUv - 0.5;
  float r = length(p) * 2.0;
  float a = atan(p.y, p.x);
  float swirl = sin(a * 5.0 + time * 0.9 + r * 9.0) * 0.5 + 0.5;
  float ripple = sin(r * 26.0 - time * 2.2) * 0.5 + 0.5;
  vec3 col = mix(vec3(0.01, 0.03, 0.09), vec3(0.16, 0.5, 1.0), swirl * ripple * 0.7 + 0.08);
  float alpha = 0.75 * smoothstep(1.0, 0.86, r);
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}`;

// ------------------------------------------------------------------- sky

const skyCtl = makeSky(loadTex, STARS);
const sky = skyCtl.group;
scene.add(sky);

// ----------------------------------------------------------------- world

interface Thing {
  id: string;
  name: string;
  sub: string;
  desc: string;
  kind: Kind;
  pos: V3;
  radius: number;
  range: number;
  solid: boolean;
  nav: boolean;
  indent: boolean;
  /** The body this one orbits, for the map. */
  parent?: string;
  /** A ship under way: its `pos` moves, and this is its velocity in scene units a second. */
  vel?: V3;
  label?: HTMLDivElement;
  normal?: V3;
  to?: { space: string; gate: string };
  dock?: string;
}

/** A body whose surface maps sharpen as you approach. */
interface Lod {
  spec: BodySpec;
  pos: V3;
  mat: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  clouds?: THREE.MeshStandardMaterial;
  level: number;
  photo?: PhotoSet;
  /** Whether the large photo maps are the ones on show. */
  sharp?: boolean;
}

interface Space {
  id: string;
  name: string;
  subtitle: string;
  blurb: string;
  group: THREE.Group;
  labels: HTMLDivElement;
  things: Thing[];
  /** Ships under way: not in `things`, but the map can show and chase them. */
  craft: Thing[];
  gates: Thing[];
  star?: V3;
  maxSpeed: number;
  sky: boolean;
  bound?: number;
  lods: Lod[];
  tick: (t: number, dt: number) => void;
}

/** The map's view of ships under way: a Thing whose position is the craft's own, kept live. */
function craftThings(info: { name: string; model: string; len: number; pos: V3; vel: V3 }[]): Thing[] {
  return info.map((c, i) => ({
    id: `craft${i}`, name: c.name, sub: `${c.model[0].toUpperCase()}${c.model.slice(1)} · ${Math.round(c.len / SOL_UNIT)} m`,
    desc: 'A ship under way: it burns, turns end over end, and burns to a stop, then waits a while before its next run. Plot a course and you will come alongside and fly with her.',
    kind: 'ship' as Kind, pos: c.pos, vel: c.vel, radius: c.len * 0.5, range: 0, solid: false, nav: false, indent: false,
  }));
}

const labelRoot = $('labels');

function addLabel(space: { labels: HTMLDivElement }, th: Thing, cls: string) {
  const el = document.createElement('div');
  el.className = `label ${cls}`;
  el.innerHTML = '<i></i><span></span>';
  el.querySelector('span')!.textContent = th.name;
  el.addEventListener('click', () => engage(th));
  space.labels.append(el);
  th.label = el;
}

const rockGeo = (() => {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const N = new Noise(77);
  const p = g.getAttribute('position');
  const v = new V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(0.7 + 0.6 * N.n3(v.x * 1.6 + 5, v.y * 1.6 + 5, v.z * 1.6 + 5));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
})();

/** Turn a sphere into a lumpy, stretched small body. Never bigger than the sphere, so the body's size holds. */
function lump(geo: THREE.SphereGeometry, shape: NonNullable<BodySpec['shape']>) {
  const N = new Noise(shape.seed), p = geo.getAttribute('position'), v = new V3();
  const big = Math.max(...shape.stretch), R = geo.parameters.radius;
  const [sx, sy, sz] = shape.stretch.map((x) => x / big);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = N.n3(v.x * 1.7 + 9, v.y * 1.7 + 9, v.z * 1.7 + 9) * 0.65 + N.n3(v.x * 4.1 + 3, v.y * 4.1 + 3, v.z * 4.1 + 3) * 0.35;
    const k = 1 - shape.lump * (1 - n);
    p.setXYZ(i, v.x * sx * k * R, v.y * sy * k * R, v.z * sz * k * R);
  }
  p.needsUpdate = true;
  geo.computeVertexNormals();
}

const lampMat = (c: number) => { const m = new THREE.MeshBasicMaterial({ color: c }); m.color.multiplyScalar(2); return m; };

const MODELS: Record<'platform' | 'diamond' | 'neutron', () => THREE.Group> = {
  platform: () => {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, emissive: 0x1c6f9a, metalness: 0.4, roughness: 0.25, flatShading: true });
    const r = rng(9);
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), m);
      s.scale.set(1, 3 + r() * 3, 1);
      s.position.set((r() - 0.5) * 0.9, (r() - 0.5) * 0.4, (r() - 0.5) * 0.9);
      s.rotation.set(r() * 0.6, r() * 3, r() * 0.6);
      g.add(s);
    }
    return g;
  },
  diamond: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({
      color: 0x35e08a, emissive: 0x0a5a30, metalness: 0.35, roughness: 0.08, flatShading: true,
    })));
    g.add(glowSprite(0x2fd07a, 3.4, 0.35));
    return g;
  },
  neutron: () => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), lampMat(0xffffff)));
    g.add(glowSprite(0xbfd6ff, 60));
    for (const s of [1, -1]) {
      const jet = new THREE.Mesh(
        new THREE.ConeGeometry(4, 160, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x6f9cff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      jet.position.x = s * 80;
      jet.rotation.z = s * Math.PI / 2;
      g.add(jet);
    }
    g.rotation.z = 0.5;
    return g;
  },
};

interface BuildCtx {
  spin: { o: THREE.Object3D; r: number }[];
  timed: THREE.ShaderMaterial[];
  anim: ((dt: number) => void)[];
  lods: Lod[];
  /** Use photographic maps for the real bodies of Sol. */
  photos?: boolean;
}

/** Settlement lights should only show on the night side: fade the emissive map out where the sun reaches. */
function nightOnly(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #if NUM_POINT_LIGHTS > 0
        totalEmissiveRadiance *= smoothstep(0.1, -0.2, dot(normal, normalize(pointLights[0].position + vViewPosition)));
      #endif`);
  };
  mat.customProgramCacheKey = () => 'night-only';
}

function applyMaps(l: Lod, maps: Maps) {
  const set = (m: THREE.Material, key: string, c?: HTMLCanvasElement, data = false) => {
    if (!c) return;
    const slot = m as unknown as Record<string, THREE.Texture | null>;
    slot[key]?.dispose();
    const t = canvasTex(c);
    if (data) t.colorSpace = THREE.NoColorSpace;
    slot[key] = t;
  };
  const p = l.photo;
  if (!p) set(l.mat, 'map', maps.color);
  if (l.mat instanceof THREE.MeshStandardMaterial) {
    if (!p) set(l.mat, 'bumpMap', maps.bump, true);
    if (!p) set(l.mat, 'roughnessMap', maps.rough, true);
    if (!p?.night) set(l.mat, 'emissiveMap', maps.lights);
  }
  if (l.clouds && !p?.clouds) set(l.clouds, 'map', maps.clouds);
  l.mat.needsUpdate = true;
  if (l.clouds) l.clouds.needsUpdate = true;
}

/** Put a body's photographic maps on show: the small set, or the large one with relief and water. */
async function showPhoto(l: Lod, sharp: boolean) {
  const p = l.photo!, i = sharp ? 1 : 0;
  const std = l.mat instanceof THREE.MeshStandardMaterial ? l.mat : null;
  const [color, night, clouds, normal, rough, bump] = await Promise.all([
    loadTex(p.color[i]),
    p.night ? loadTex(p.night[i]) : null,
    p.clouds ? loadTex(p.clouds[i], false) : null,
    sharp && p.normal ? loadTex(p.normal, false) : null,
    sharp && p.water ? waterRoughness(p.water) : null,
    sharp && p.bump ? loadTex(p.bump, false) : null,
  ]);
  const put = (m: THREE.Material | null | undefined, key: string, t: THREE.Texture | null, keep = false) => {
    if (!m || (keep && !t)) return;
    const slot = m as unknown as Record<string, THREE.Texture | null>;
    slot[key]?.dispose();
    slot[key] = t;
    m.needsUpdate = true;
  };
  put(l.mat, 'map', color);
  put(std, 'emissiveMap', night, true);
  put(l.clouds, 'alphaMap', clouds, true);
  if (p.normal) put(std, 'normalMap', normal);
  if (p.water) put(std, 'roughnessMap', rough);
  if (p.bump) put(std, 'bumpMap', bump);
  l.sharp = sharp;
}

async function bodyVisual(b: BodySpec, holder: THREE.Group, pos: V3, ctx: BuildCtx) {
  const R = b.radius;
  if (b.model) {
    const m = b.model in MODELS ? MODELS[b.model as keyof typeof MODELS]() : buildModel(b.model as ShipModel);
    m.scale.setScalar(b.kind === 'ship' ? R * 2 : R);
    m.rotation.y = b.yaw ?? 0;
    holder.add(m);
    if (b.spin) ctx.spin.push({ o: m, r: b.spin });
    else if (b.spin === undefined) ctx.spin.push({ o: m, r: 0.1 });
    if (m.userData.anim) ctx.anim.push(m.userData.anim);
    return;
  }
  const tex = b.tex!;
  const tilt = new THREE.Group();
  tilt.rotation.z = b.tilt ?? 0;
  holder.add(tilt);
  // A quick rough pass now; `lodTick` repaints in detail when you come close.
  const photo = ctx.photos ? PHOTOS[b.id] : undefined;
  const painted = mapKinds(tex);
  const kinds = { lights: painted.lights || !!photo?.night, clouds: painted.clouds || !!photo?.clouds };
  const maps = !photo || (painted.lights && !photo.night) ? (await paintBody(tex, 256, 128))! : null;
  const big = R >= 0.2;
  const geo = new THREE.SphereGeometry(R, big ? 128 : 64, big ? 64 : 32);
  if (b.shape) lump(geo, b.shape);
  const lod: Lod = { spec: b, pos, mat: new THREE.MeshBasicMaterial(), level: 0, photo };
  if (b.kind === 'star') {
    lod.mat.color.setScalar(1.7);
    holder.add(glowSprite(new THREE.Color(tex.palette[Math.floor(tex.palette.length / 2)][1]).lerp(new THREE.Color(0xffffff), 0.4), R * 9));
  } else {
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, bumpScale: photo?.bumpScale ?? 3 });
    if (photo?.normal) mat.normalScale.set(1.6, 1.6);
    mat.envMap = NO_ENV;
    mat.envMapIntensity = 0;
    if (kinds.lights) {
      mat.emissive = new THREE.Color(0xffffff);
      mat.emissiveIntensity = tex.style === 'lava' ? 1 : 1.5;
      if (tex.style !== 'lava') nightOnly(mat);
    }
    lod.mat = mat;
  }
  const mesh = new THREE.Mesh(geo, lod.mat);
  tilt.add(mesh);
  if (b.kind === 'comet' && b.tail) holder.add(makeComet(b.tail, b.coma ?? 0.4, pos.lengthSq() > 0 ? pos.clone().normalize() : new V3(1, 0, 0)));
  ctx.spin.push({ o: mesh, r: b.spin ?? 0.02 });
  if (kinds.clouds) {
    lod.clouds = new THREE.MeshStandardMaterial({ transparent: true, roughness: 1, depthWrite: false, envMap: NO_ENV, envMapIntensity: 0 });
    const deck = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 96, 48), lod.clouds);
    tilt.add(deck);
    ctx.spin.push({ o: deck, r: (b.spin ?? 0.02) * 1.4 });
    // Storms flicker on the night side of any planet with weather.
    if (b.kind === 'planet' && pos.lengthSq() > 0) {
      const seed = [...b.id].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7) >>> 0;
      ctx.anim.push(addLightning(deck, R * 1.012, pos.clone().negate().normalize(), rng(seed % 100000), 70));
    }
  }
  if (maps) applyMaps(lod, maps);
  if (photo) await showPhoto(lod, false);
  ctx.lods.push(lod);

  if (b.atmo) {
    const sunDir = pos.lengthSq() > 0 ? pos.clone().negate().normalize() : new V3(0, 1, 0);
    // Scattering strength per colour from the planet's air tint: Earth's blue gives roughly the real
    // Rayleigh ratios (red scatters least), a dusty tint gives Mars its butterscotch.
    const tint = new THREE.Color(b.atmo);
    const beta = new V3(tint.r, tint.g, tint.b).multiplyScalar(220 / Math.max(tint.r, tint.g, tint.b));
    const uniforms = { beta: { value: beta }, sunDir: { value: sunDir }, cam: { value: new V3() }, R: { value: R }, strength: { value: b.atmoK ?? 1 } };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: ATMO_V, fragmentShader: ATMO_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const shell = new THREE.Mesh(new THREE.SphereGeometry(R * ATMO_TOP, 96, 48), mat);
    // Each frame: where the camera is relative to this planet, and whether we're inside the air.
    const wp = new V3();
    shell.onBeforeRender = (_r, _s, cam) => {
      shell.getWorldPosition(wp);
      uniforms.cam.value.copy(cam.position).sub(wp);
      const side = uniforms.cam.value.length() < R * ATMO_TOP ? THREE.BackSide : THREE.FrontSide;
      if (mat.side !== side) { mat.side = side; mat.needsUpdate = true; }
    };
    holder.add(shell);
  }
  if (b.rings) {
    const rg = b.rings;
    const g = new THREE.RingGeometry(rg.inner, rg.outer, 128, 1);
    const p = g.getAttribute('position'), uv = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      const d = Math.hypot(p.getX(i), p.getY(i));
      uv.setXY(i, (d - rg.inner) / (rg.outer - rg.inner), 0.5);
    }
    let tex: THREE.Texture;
    if (photo?.ring) {
      tex = await loadTex(photo.ring);
      tex.wrapS = THREE.ClampToEdgeWrapping;
    } else {
      tex = new THREE.CanvasTexture(paintRing(rg.palette, rg.seed, rg.opacity, rg.gap));
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    const rmat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(g, rmat);
    ring.rotation.x = -Math.PI / 2;
    tilt.add(ring);
    // The planet throws its shadow across the rings.
    ring.updateWorldMatrix(true, false);
    const sun = pos.clone().negate().normalize().transformDirection(ring.matrixWorld.clone().invert());
    rmat.onBeforeCompile = (sh) => {
      sh.uniforms.ringSun = { value: sun };
      sh.uniforms.ringR = { value: R };
      sh.vertexShader = 'varying vec3 vRing;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vRing = position;');
      sh.fragmentShader = 'varying vec3 vRing; uniform vec3 ringSun; uniform float ringR;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float along = dot(vRing, ringSun);
        float miss = length(vRing - ringSun * along);
        diffuseColor.rgb *= along < 0.0 ? mix(0.06, 1.0, smoothstep(ringR * 0.97, ringR * 1.03, miss)) : 1.0;`);
    };
    rmat.customProgramCacheKey = () => 'ring-shadow';
  }
}

function makeBelt(b: BeltSpec, group: THREE.Group, posOf: Map<string, V3>) {
  const r = rng(b.seed);
  const pos = new Float32Array(b.dust * 3);
  const v = new V3();
  const place = () => {
    if (b.shell) {
      const y = r() * 2 - 1, a = r() * TAU, q = Math.sqrt(1 - y * y);
      v.set(q * Math.cos(a), y, q * Math.sin(a)).multiplyScalar(b.inner + (b.outer - b.inner) * r());
    } else {
      const a = b.arc ? b.arc[0] + (b.arc[1] - b.arc[0]) * r() : r() * TAU, d = b.inner + (b.outer - b.inner) * (r() + r()) / 2;
      v.set(Math.cos(a) * d, (r() + r() + r() - 1.5) * b.height, Math.sin(a) * d);
    }
    return v;
  };
  for (let i = 0; i < b.dust; i++) {
    place();
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: b.color, size: b.dustSize, sizeAttenuation: false, transparent: true, opacity: b.opacity, depthWrite: false,
  }));
  pts.frustumCulled = false;
  group.add(pts);

  const knots = (b.clusters ?? []).map((id) => posOf.get(id)).filter((p): p is V3 => !!p);
  const perKnot = 90;
  const rockMat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 1, flatShading: true, envMap: NO_ENV, envMapIntensity: 0 });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new V3(), e = new THREE.Euler();
  const put = (rocks: THREE.InstancedMesh, i: number, at: V3, size: number) => {
    e.set(r() * TAU, r() * TAU, r() * TAU);
    q.setFromEuler(e);
    s.set(size * (0.7 + r() * 0.6), size * (0.6 + r() * 0.5), size * (0.7 + r() * 0.6));
    rocks.setMatrixAt(i, m.compose(at, q, s));
  };
  if (b.rocks) {
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, b.rocks);
    for (let i = 0; i < b.rocks; i++) put(rocks, i, place(), b.size[0] + (b.size[1] - b.size[0]) * r() ** 3);
    rocks.frustumCulled = false;
    group.add(rocks);
  }
  // A knot of rocks round each named body, in the body's own coordinates so they stay put when you are close.
  for (const c of knots) {
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, perKnot);
    for (let i = 0; i < perKnot; i++) {
      const y = r() * 2 - 1, a = r() * TAU, w = Math.sqrt(1 - y * y), d = 0.004 + 0.35 * r() ** 1.5;
      v.set(w * Math.cos(a) * d, y * d * 0.5, w * Math.sin(a) * d);
      put(rocks, i, v, 1e-6 + 2.5e-4 * r() ** 2);
    }
    rocks.position.copy(c);
    rocks.frustumCulled = false;
    group.add(rocks);
  }
}

function orbitLine(center: V3, radius: number, y: number, opacity: number): THREE.LineLoop {
  const n = 256, pts: V3[] = [];
  for (let i = 0; i < n; i++) pts.push(new V3(Math.cos((i / n) * TAU) * radius, y, Math.sin((i / n) * TAU) * radius));
  const line = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x3a6a94, transparent: true, opacity, depthWrite: false }),
  );
  line.position.copy(center);
  line.userData.orbit = true;
  return line;
}

function makeGateObject(R: number, ctx: BuildCtx): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(
    new THREE.TorusGeometry(R, R * 0.06, 14, 120),
    new THREE.MeshStandardMaterial({ color: 0x3a4654, emissive: 0x0c2c48, metalness: 0.8, roughness: 0.35 }),
  ));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(R * 0.935, R * 0.012, 6, 120), lampMat(0x7fd6ff)));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } }, vertexShader: GATE_V, fragmentShader: GATE_F,
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
  });
  ctx.timed.push(mat);
  g.add(new THREE.Mesh(new THREE.CircleGeometry(R * 0.93, 96), mat));
  g.add(glowSprite(0x4fa8ff, R * 5, 0.5));
  return g;
}

const FWD_Z = new V3(0, 0, 1);

async function buildSystem(spec: SystemSpec, progress: (s: string) => void): Promise<Space> {
  const group = new THREE.Group();
  const labels = document.createElement('div');
  const things: Thing[] = [];
  const ctx: BuildCtx = { spin: [], timed: [], anim: [], lods: [], photos: spec.id === 'sol' };
  group.add(new THREE.AmbientLight(0x8fa0c0, 0.16));
  group.add(new THREE.PointLight(spec.light, 3.4, 0, 0));
  const posOf = new Map<string, V3>();

  for (const b of spec.bodies) {
    const base = b.parent ? posOf.get(b.parent)! : ZERO;
    const pos = new V3(Math.cos(b.angle) * b.orbit, b.lift ?? 0, Math.sin(b.angle) * b.orbit).add(base);
    posOf.set(b.id, pos);
    progress(b.name);
    const holder = new THREE.Group();
    holder.position.copy(pos);
    group.add(holder);
    await bodyVisual(b, holder, pos, ctx);
    if (b.orbit > 0 && b.kind !== 'ship') group.add(orbitLine(base, b.orbit, b.lift ?? 0, b.parent ? 0.14 : 0.3));
    const th: Thing = {
      id: b.id, name: b.name, sub: b.sub, desc: b.desc, kind: b.kind, pos, radius: b.radius,
      range: b.range ?? Infinity, solid: true, nav: true, indent: !!b.parent, parent: b.parent, dock: b.dock,
    };
    things.push(th);
    addLabel({ labels }, th, b.kind);
  }
  progress('belts');
  await pause();
  for (const belt of spec.belts) makeBelt(belt, group, posOf);

  const R = 0.00334;
  const gpos = new V3(Math.cos(spec.gate.angle) * spec.gate.orbit, 0, Math.sin(spec.gate.angle) * spec.gate.orbit);
  const normal = gpos.clone().negate().normalize();
  const gate = makeGateObject(R, ctx);
  gate.position.copy(gpos);
  gate.quaternion.setFromUnitVectors(FWD_Z, normal);
  group.add(gate);
  const at = (id: string) => posOf.get(id);
  const port = (id: string, inner: number, outer: number): Port[] => {
    const c = at(id);
    return c ? [{ pos: c, inner, outer }] : [];
  };
  const fleets: Fleet[] = spec.id === 'sol'
    ? [
      // Hubs: ships hop between spots in a shell round the port, in lanes, and out to the Ring.
      { ports: port('earth', 0.055, 0.32), n: 90 },
      { ports: [...port('earth', 0.06, 0.12), ...port('luna', 0.02, 0.06)], n: 25 },
      { ports: port('luna', 0.016, 0.07), n: 12 },
      { ports: port('mars', 0.03, 0.2), n: 50 },
      { ports: [...port('mars', 0.03, 0.08), ...port('phobos', 0.002, 0.01)], n: 10 },
      { ports: [...port('earth', 0.06, 0.2), ...port('mars', 0.03, 0.12)], n: 30, only: ['freighter', 'hauler', 'battleship', 'survey'] },
      { ports: port('ceres', 0.004, 0.05), n: 60 },
      { ports: [...port('ceres', 0.004, 0.02), ...port('tycho', 2e-6, 4e-5)], n: 25 },
      { ports: port('tycho', 2e-6, 6e-5), n: 70 },
      { ports: [...port('ceres', 0.01, 0.04), ...port('vesta', 0.002, 0.01), ...port('pallas', 0.002, 0.01)], n: 20, only: ['freighter', 'racer', 'survey'] },
      { ports: port('jupiter', 0.6, 2.2), n: 25 },
      { ports: port('ganymede', 0.03, 0.15), n: 30 },
      { ports: [...port('jupiter', 0.6, 1.2), ...port('ganymede', 0.03, 0.08)], n: 10 },
      { ports: port('saturn', 0.5, 2.0), n: 15 },
      { ports: port('titan', 0.03, 0.12), n: 8 },
      { ports: [...port('saturn', 0.5, 1.0), ...port('ceres', 0.01, 0.04)], n: 10, only: ['hauler', 'freighter'] },
      { ports: [{ pos: gpos.clone().addScaledVector(normal, 0.06), inner: 0.004, outer: 0.18 }], n: 40 },
    ]
    : [
      ...spec.bodies.filter((b) => b.kind === 'planet' && b.radius >= 0.02).flatMap((b) => port(b.id, b.radius * 1.6, b.radius * 6).map((p) => ({ ports: [p], n: 6 }))),
      { ports: [{ pos: gpos.clone().addScaledVector(normal, 0.05), inner: 0.004, outer: 0.15 }], n: 22 },
    ];
  const traffic = makeTraffic(fleets.filter((f) => f.ports.length), spec.id.length * 977 + spec.id.charCodeAt(spec.id.length - 1));
  group.add(traffic.group);
  ctx.anim.push((dt) => traffic.tick(dt, ship.pos, escort?.thing.pos));
  const idx = spec.id === 'sol' ? 0 : Number(spec.id.slice(4));
  const gth: Thing = {
    id: 'ring', name: spec.id === 'sol' ? 'The Ring' : 'Ring gate', sub: 'Gate to the ring space',
    desc: spec.id === 'sol'
      ? 'A thousand-kilometre hoop parked beyond Uranus, built by the thing that left Venus. Fly through the middle to reach the ring space and its thirteen hundred other doors.'
      : 'The way back. Fly through the middle to return to the ring space.',
    kind: 'gate', pos: gpos, radius: R, range: Infinity, solid: false, nav: true, indent: false,
    normal, to: { space: 'slow', gate: `g${idx}` },
  };
  things.push(gth);
  addLabel({ labels }, gth, 'gate');

  return {
    id: spec.id, name: spec.name, subtitle: spec.subtitle, blurb: spec.blurb, group, labels, things, craft: craftThings(traffic.info), gates: [gth],
    star: new V3(), maxSpeed: 5000, sky: true, lods: ctx.lods,
    tick: (t, dt) => {
      for (const s of ctx.spin) s.o.rotation.y += s.r * dt;
      for (const a of ctx.anim) a(dt);
      for (const m of ctx.timed) m.uniforms.time.value = t;
    },
  };
}

// The ring space, true to scale like everything else: a unit is 1/1000 AU, so a metre is SOL_UNIT.
// The figures are from memory of the books and show (the wiki turns automated readers away), so
// treat them as plausible rather than exact: a bubble about a million kilometres across, gates
// about a thousand kilometres across on its edge, a station about five kilometres across at the
// centre, and Medina (two kilometres long) parked a few tens of kilometres from it.
const KM = 1000 * SOL_UNIT;
const HUB_R = 2.5 * KM;
const GATE_R = 500 * KM;
/** The speed limit in here. The station's real limit is far lower (hundreds of metres a second,
 *  from memory), which would make the half-million kilometres to a gate a trip of weeks. Time is
 *  squeezed instead: at this limit the centre to a gate is under half a minute, a tenth of the
 *  speed of light on the dial, and still twenty-five thousand times slower than the drive allows
 *  outside. Close to anything the usual rule holds you to a crawl, so Medina's traffic is not a blur. */
const SLOW_LIMIT = 30000 * KM;

async function buildSlowZone(): Promise<Space> {
  const group = new THREE.Group();
  const labels = document.createElement('div');
  const things: Thing[] = [];
  const ctx: BuildCtx = { spin: [], timed: [], anim: [], lods: [] };
  // No star in here: the station at the centre is the lamp, and it reaches the walls undimmed.
  group.add(new THREE.AmbientLight(0x4a5f88, 0.5));
  group.add(new THREE.PointLight(0x7fb8ff, 3, 0, 0));

  // The station at the centre.
  const core = new THREE.Group();
  const tex = (await paintBody({ style: 'lava', palette: [[0, '#05080f'], [1, '#12203a']], seed: 808, scale: 3, accent: '#4fc0ff' }, 1024, 512))!;
  const mat = new THREE.MeshStandardMaterial({ map: canvasTex(tex.color), emissiveMap: canvasTex(tex.lights!), emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.5, metalness: 0.3 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(HUB_R, 64, 32), mat);
  core.add(ball, glowSprite(0x3f9cff, HUB_R * 9.3, 0.8));
  group.add(core);
  ctx.spin.push({ o: ball, r: 0.02 });
  const station: Thing = {
    id: 'station', name: 'Ring Station', sub: 'Artefact · centre of the ring space', kind: 'artifact',
    desc: 'The sphere at the middle of everything, five kilometres across. It holds the gates open and sets the speed limit in here — go too fast and it simply stops you.',
    pos: new V3(), radius: HUB_R, range: Infinity, solid: true, nav: true, indent: false,
  };
  things.push(station);
  addLabel({ labels }, station, 'artifact');

  // Medina, about 45 km out from the station.
  const medinaPos = new V3(41.25, 5, 18.75).multiplyScalar(KM);
  const medina = buildModel('medina');
  medina.scale.setScalar(2 * KM);
  medina.position.copy(medinaPos);
  medina.rotation.y = 0.7;
  group.add(medina);
  ctx.anim.push(medina.userData.anim);
  const mth: Thing = {
    id: 'medina', name: 'Medina Station', sub: 'Station · the only port in the ring space', kind: 'station',
    desc: 'Built as a generation ship, refitted as a warship, and now the traffic control and trading post for thirteen hundred worlds.',
    // (Its label goes once you are well away, or it would sit on top of the station's all the way to the gates.)
    pos: medinaPos, radius: 0.875 * KM, range: 5000 * KM, solid: true, nav: true, indent: false, dock: 'medina',
  };
  things.push(mth);
  addLabel({ labels }, mth, 'station');

  // The gates: one low-detail hoop and film each, drawn together. From the centre a gate is two
  // pixels across, so each also gets a dot of light; the nearest one is swapped for a full model below.
  const R = GATE_R;
  const torus = new THREE.InstancedMesh(
    new THREE.TorusGeometry(R, R * 0.06, 6, 32),
    new THREE.MeshStandardMaterial({ color: 0x56687c, emissive: 0x0d3355, metalness: 0.7, roughness: 0.4 }),
    GATE_COUNT,
  );
  const film = new THREE.InstancedMesh(
    new THREE.CircleGeometry(R * 0.94, 24),
    new THREE.MeshBasicMaterial({ color: 0x1a4a88, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
    GATE_COUNT,
  );
  // (One more dot than there are gates: the last is the station, so it can be found from the wall.)
  const dots = new Float32Array((GATE_COUNT + 1) * 3), cols = new Float32Array((GATE_COUNT + 1) * 3);
  cols.set([0.5, 0.8, 1], GATE_COUNT * 3);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new V3(1, 1, 1);
  const gates: Thing[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < GATE_COUNT; i++) {
    const y = 1 - (2 * (i + 0.5)) / GATE_COUNT, w = Math.sqrt(1 - y * y), a = i * golden;
    const pos = new V3(w * Math.cos(a), y, w * Math.sin(a)).multiplyScalar(SLOW_RADIUS);
    const normal = pos.clone().negate().normalize();
    q.setFromUnitVectors(FWD_Z, normal);
    m.compose(pos, q, one);
    torus.setMatrixAt(i, m);
    film.setMatrixAt(i, m);
    const named = NAMED.find((n) => n.idx === i);
    const c = i === 0 ? [1, 1, 1] : named ? [1, 0.72, 0.36] : [0.36, 0.62, 1];
    dots.set([pos.x, pos.y, pos.z], i * 3);
    cols.set(c, i * 3);
    torus.setColorAt(i, new THREE.Color(named ? 0xffd9a0 : 0xffffff));
    const th: Thing = {
      id: `g${i}`, name: named ? `${named.name} gate` : gateName(i),
      sub: named ? `Gate ${String(i).padStart(4, '0')} · charted` : 'Uncharted gate',
      desc: named ? named.blurb : 'Nobody has logged what is on the other side. Fly through and find out.',
      kind: 'gate', pos, radius: R, range: named ? Infinity : 0, solid: false, nav: !!named, indent: false,
      normal, to: { space: i === 0 ? 'sol' : `sys:${i}`, gate: 'ring' },
    };
    gates.push(th);
    things.push(th);
    if (named) addLabel({ labels }, th, 'gate');
  }
  // The racer that found the speed limit, still hanging where the station stopped it: a little
  // way in from the Sol gate and off to one side of the lane.
  const yq: Thing = {
    id: 'yque', name: 'Y Que', sub: 'Slingshot racer · derelict', kind: 'ship',
    desc: 'A Belter kid\'s home-built racer. He aimed it through the Sol Ring at full burn to impress a girl. The ship was stopped dead in an instant; he was not. That was how everyone learned there is a speed limit in here.',
    pos: gates[0].pos.clone().addScaledVector(gates[0].normal!, R * 3).add(new V3(0.5, 0, 0.25).multiplyScalar(R)),
    radius: 0.015 * KM, range: R * 20, solid: true, nav: true, indent: true,
  };
  const wreck = buildModel('wreck');
  wreck.scale.setScalar(0.03 * KM);
  wreck.position.copy(yq.pos);
  wreck.rotation.set(0.6, 1.1, 0.3);
  group.add(wreck);
  things.push(yq);
  addLabel({ labels }, yq, 'ship');

  // Ships, their true size. Most fuss round Medina and the station at tens of metres a second;
  // some run out to the charted gates and back, which from anywhere else is a slow drift of sparks.
  const charted = gates.filter((g) => g.nav).map((g): Port => ({ pos: g.pos.clone().addScaledVector(g.normal!, R * 3), inner: R * 0.3, outer: R * 2.5 }));
  const crowd = makeTraffic([
    { ports: [{ pos: medinaPos, inner: 1.75 * KM, outer: 8.75 * KM }], n: 80, knot: 9 * KM },
    { ports: [{ pos: medinaPos, inner: 1.75 * KM, outer: 5 * KM }, { pos: new V3(), inner: 8.75 * KM, outer: 20 * KM }], n: 25, knot: 45 * KM },
    { ports: [{ pos: medinaPos, inner: 3 * KM, outer: 12 * KM }, ...charted], n: 36, only: ['freighter', 'hauler', 'survey', 'corvette'] },
  ], 4242, SOL_UNIT, 80);
  group.add(crowd.group);
  ctx.anim.push((dt) => crowd.tick(dt, ship.pos, escort?.thing.pos));

  torus.frustumCulled = film.frustumCulled = false;
  group.add(torus, film);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(dots, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 3.2, sizeAttenuation: false, vertexColors: true, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  pts.frustumCulled = false;
  group.add(pts);

  // The gate you are nearest gets the full model: a round hoop with its lamps, the moving film,
  // and in the middle the light of the star on the far side. It also sits at its own position
  // rather than in the shared list, so it holds still as you fly through (the shared list keeps
  // places to about forty metres out here, which is fine from afar and no good close to).
  const close = makeGateObject(R, ctx);
  const halo = close.children[close.children.length - 1] as THREE.Sprite;
  const beyond = glowSprite(0xffffff, R * 0.7, 0.85);
  close.add(beyond);
  close.visible = false;
  group.add(close);
  const SWAP = R * 80;
  const gone = new THREE.Matrix4().makeScale(0, 0, 0), kept = new THREE.Matrix4();
  let shown = -1;
  const show = (i: number) => {
    if (shown >= 0) { torus.setMatrixAt(shown, kept); film.setMatrixAt(shown, kept); }
    shown = i;
    close.visible = i >= 0;
    if (i >= 0) {
      torus.getMatrixAt(i, kept);
      torus.setMatrixAt(i, gone);
      film.setMatrixAt(i, gone);
      close.position.copy(gates[i].pos);
      close.quaternion.setFromUnitVectors(FWD_Z, gates[i].normal!);
      beyond.material.color.set(i === 0 ? SOL.light : genSystem(i).light);
    }
    torus.instanceMatrix.needsUpdate = film.instanceMatrix.needsUpdate = true;
  };
  ctx.anim.push(() => {
    // Nobody is near a gate until they are near the wall, so most frames stop here.
    let best = -1, bd = SWAP * SWAP;
    if (ship.pos.length() > SLOW_RADIUS - SWAP) {
      for (let i = 0; i < GATE_COUNT; i++) {
        const d = gates[i].pos.distanceToSquared(ship.pos);
        if (d < bd) { bd = d; best = i; }
      }
    }
    if (best !== shown) show(best);
    // Its halo comes up as you close in, so the change from the far hoop is not a jump.
    if (best >= 0) halo.material.opacity = 0.5 * clamp(1.25 - 1.25 * Math.sqrt(bd) / SWAP, 0, 1);
  });

  return {
    id: 'slow', name: 'The Ring Space', subtitle: `${GATE_COUNT} gates · no stars`,
    blurb: 'A starless bubble a million kilometres across. Every light on the wall is a door to another sun.',
    group, labels, things, craft: craftThings(crowd.info), gates, maxSpeed: SLOW_LIMIT, sky: false, bound: SLOW_RADIUS + R * 5, lods: [],
    tick: (t, dt) => {
      for (const s of ctx.spin) s.o.rotation.y += s.r * dt;
      for (const a of ctx.anim) a(dt);
      for (const mt of ctx.timed) mt.uniforms.time.value = t;
    },
  };
}

// ------------------------------------------------------------------ ship

/** Your ship is about 30 m long, so the chase camera rides a few hundred metres behind it. */
// The Rocinante at her true 46 m: a model unit is about 37 m, and a scene unit is 1/1000 AU.
const SHIP_SCALE = ROCI_UNIT * SOL_UNIT;
const ship = { pos: new V3(), prev: new V3(), q: new THREE.Quaternion(), speed: 0, throttle: 0 };
let { group: shipModel, plume } = playerShip();
shipModel.scale.setScalar(SHIP_SCALE);
scene.add(shipModel);

// Motes that drift past so slow flight still reads as motion.
const DUST_N = 260, DUST_BOX = 4e-5;
const dustBase = new Float32Array(DUST_N * 3);
{
  const r = rng(5);
  for (let i = 0; i < DUST_N * 3; i++) dustBase[i] = r() * DUST_BOX;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST_N * 3), 3));
const dustMat = new THREE.PointsMaterial({ color: 0xbfd8ff, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.6, depthWrite: false });
const dust = new THREE.Points(dustGeo, dustMat);
dust.frustumCulled = false;
scene.add(dust);

// ------------------------------------------------------------------ state

let space: Space;
const cache = new Map<string, Space>();
/** The autopilot flies the way a torch ship does: burn towards the target, coast while the ship turns
 *  end over end, then burn the other way to arrive at rest. The way the ship is going stays fixed
 *  through the flip (`dir`); only the way it points changes. */
interface Auto { thing: Thing; point: V3; phase: 'cruise' | 'flip' | 'burn' | 'face'; a: number; dir: V3; t: number; q0: THREE.Quaternion }
/** Flying alongside a ship under way: whatever it does, we keep our place beside it. */
let escort: { thing: Thing; last: V3 } | null = null;

let auto: Auto | null = null;
/** Flip and burn by hand (X): the same manoeuvre to stop, then the ship turns back to the way it was pointing. */
interface Brake { phase: 'flip' | 'burn' | 'back'; t: number; dir: V3; q0: THREE.Quaternion; qFrom: THREE.Quaternion; a: number }
let brake: Brake | null = null;
/** What the drive is doing this frame, 0 (off) to 1 (full burn); the plume follows it. */
let engine = 0;
const BRAKE_SECS = 7;       // a manual burn to a stop
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);
let aimed: Thing | null = null;
let nearest: Thing | null = null;
let busy = true;
let started = false;
let chase = true;
let orbitsOn = true;
let lookYaw = 0, lookPitch = 0, freeLook = false;
let mdx = 0, mdy = 0;
const keys = new Set<string>();
const camQ = new THREE.Quaternion();
// On foot inside a station.
let walk: Interior | null = null;
let nearPoint: Point | null = null;
// (`weight` is how heavy you are just now against standing still, `eye` how high your eyes are
// and `drift` how fast your strides are carrying you spinward: all three come from spin.ts.)
const walker = { x: 0, z: 0, yaw: 0, pitch: 0, bob: 0, vx: 0, vz: 0, weight: 1, eye: 1.7, drift: 0, rise: 0 };
let lodBusy = false;

const loadingEl = $('loading');
const progress = (s: string) => (loadingEl.textContent = `Charting ${s}…`);

async function getSpace(id: string): Promise<Space> {
  const hit = cache.get(id);
  if (hit) return hit;
  let s: Space;
  if (id === 'slow') s = await buildSlowZone();
  else s = await buildSystem(id === 'sol' ? SOL : genSystem(Number(id.slice(4))), progress);
  if (id === 'sol' || id === 'slow') cache.set(id, s);
  return s;
}

function disposeSpace(s: Space) {
  s.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && m.geometry !== rockGeo) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      const any = mat as unknown as Record<string, THREE.Texture | undefined>;
      for (const k of ['map', 'emissiveMap', 'bumpMap', 'roughnessMap']) if (any[k] && any[k] !== glowTex) any[k]!.dispose();
      mat.dispose();
    }
  });
}

function enter(s: Space) {
  escort = null;
  if (space) {
    scene.remove(space.group);
    space.labels.remove();
    if (!cache.has(space.id)) disposeSpace(space);
  }
  space = s;
  scene.add(s.group);
  labelRoot.append(s.labels);
  sky.visible = s.sky;
  skyCtl.setSystem(s.id);
  auto = null;
  aimed = null;
  applyOrbits();
  buildNav();
  $('loc-name').textContent = s.name;
  $('loc-sub').textContent = s.subtitle;
}

function applyOrbits() {
  space.group.traverse((o) => {
    if (o.userData.orbit) o.visible = orbitsOn;
  });
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _a = new V3(), _b = new V3(), _c = new V3();

function faceShip(dir: V3, maxAngle = Infinity) {
  // Level out against the plane of the system, so planets arrive north-up.
  _a.set(0, 1, 0);
  if (Math.abs(_a.dot(dir)) > 0.98) _a.set(1, 0, 0).applyQuaternion(ship.q);
  _m.lookAt(ZERO, dir, _a);
  _q.setFromRotationMatrix(_m);
  if (maxAngle === Infinity) ship.q.copy(_q);
  else ship.q.rotateTowards(_q, maxAngle);
}

/** Where to park to look at something: sunward of it where there is a sun, so the lit side faces you. */
function viewpoint(th: Thing): V3 {
  if (th.kind === 'gate') {
    const side = space.id === 'slow' ? 1 : Math.sign(_a.copy(ship.pos).sub(th.pos).dot(th.normal!)) || 1;
    return th.pos.clone().addScaledVector(th.normal!, side * th.radius * 3.2);
  }
  const stand = th.radius * (th.kind === 'star' ? 4.2 : th.kind === 'artifact' ? 4.5 : th.kind === 'station' ? 3.3 : th.kind === 'ship' ? 1.9 : 3.4);
  const d = ship.pos.clone().sub(th.pos);
  if (d.lengthSq() < 1e-40) d.set(0, 0, 1);
  d.normalize();
  if (space.star && th.kind !== 'star') {
    const toSun = space.star.clone().sub(th.pos).normalize();
    d.multiplyScalar(0.3).addScaledVector(toSun, 0.7).add(_a.set(0, 0.14, 0)).normalize();
  }
  return th.pos.clone().addScaledVector(d, stand);
}

function engage(th: Thing) {
  if (busy) return;
  const point = viewpoint(th);
  brake = null;
  // Plan the trip (src/course.ts): how hard to burn so that it takes a sensible time for its length.
  const { a } = planTrip(point.distanceTo(ship.pos), th.radius, space.maxSpeed);
  escort = th.vel ? { thing: th, last: th.pos.clone() } : null;
  auto = { thing: th, point, phase: 'cruise', a, dir: new V3(), t: 0, q0: new THREE.Quaternion() };
  ship.throttle = 0;
}

function placeAt(th: Thing) {
  brake = null;
  ship.pos.copy(viewpoint(th));
  ship.prev.copy(ship.pos);
  faceShip(th.pos.clone().sub(ship.pos).normalize());
  camQ.copy(ship.q);
  ship.speed = ship.throttle = 0;
}

let bannerTimer = 0;
function banner(title: string, text: string) {
  $('banner-title').textContent = title;
  $('banner-text').textContent = text;
  $('banner').classList.add('show');
  clearTimeout(bannerTimer);
  bannerTimer = window.setTimeout(() => $('banner').classList.remove('show'), 7000);
}

async function transit(g: Thing, quiet = false) {
  if (busy || !g.to) return;
  brake = null;
  if (!quiet) stopTour();
  busy = true;
  auto = null;
  const flash = $('flash');
  flash.classList.add('on');
  await pause(450);
  loadingEl.textContent = '';
  const next = await getSpace(g.to.space);
  enter(next);
  await warm(scene, camera);
  const dest = next.things.find((t) => t.id === g.to!.gate)!;
  ship.pos.copy(dest.pos).addScaledVector(dest.normal!, dest.radius * 2.5);
  ship.prev.copy(ship.pos);
  faceShip(dest.normal!);
  camQ.copy(ship.q);
  ship.speed = Math.min(20, next.maxSpeed);
  ship.throttle = 0;
  loadingEl.textContent = '';
  await pause(200);
  flash.classList.remove('on');
  if (!quiet) banner(next.id === 'slow' ? next.name : `${next.name} system`, next.blurb);
  busy = false;
}

// --------------------------------------------------------------- controls

const locked = () => document.pointerLockElement === canvas;

canvas.addEventListener('click', () => {
  if (started && !locked()) canvas.requestPointerLock()?.catch?.(() => {});
});
document.addEventListener('mousemove', (e) => {
  if (locked()) {
    mdx += e.movementX;
    mdy += e.movementY;
  }
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button === 2) freeLook = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 2) freeLook = false;
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
  if ((e.target as HTMLElement).closest('#nav') || (e.target as HTMLElement).closest('#map')) return;
  if (walk) return;
  if (inspect.on) { inspect.dist = clamp(inspect.dist * (e.deltaY > 0 ? 1.12 : 1 / 1.12), 1.25, 12); return; }
  auto = null;
  ship.throttle = clamp(ship.throttle - Math.sign(e.deltaY) * 0.04, -0.3, 1);
}, { passive: true });

const STEER = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyX', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// Tour mode: the camera films the system shot by shot. Behind the start screen it just plays;
// in flight T starts and stops it, and any other key hands control back where you left off.
const tour = createTour(
  (t, caption) => { if (started) banner(t.name, caption); },
  (on) => $('flash').classList.toggle('on', on),
);
let tourSave: { pos: V3; q: THREE.Quaternion; space: string } | null = null;
/** The voyage being flown (T): which stage it is on. Set to null to call it off. */
let voyage: { v: Voyage; n: number } | null = null;
const tourSun = () => space.things.find((t) => t.kind === 'star')?.pos ?? (space.id === 'slow' ? ZERO : null);
function startTour() {
  if (busy || walk || tour.active) return;
  tourSave = { pos: ship.pos.clone(), q: ship.q.clone(), space: space.id };
  auto = null; brake = null; escort = null;
  ship.speed = ship.throttle = 0;
  // (The ring space has no star; its station is the lamp, so shots there are framed round it.)
  tour.start(space.id, space.things, tourSun());
}

/** A voyage: stages in one place after another, carried between them through the gates. */
function startVoyage(v: Voyage) {
  if (busy || walk || tour.active) return;
  if (!v.stages.length) { startTour(); return; }
  tourSave = { pos: ship.pos.clone(), q: ship.q.clone(), space: space.id };
  auto = null; brake = null; escort = null;
  ship.speed = ship.throttle = 0;
  voyage = { v, n: 0 };
  document.body.classList.add('voyage');
  banner(v.name, v.blurb);
  void voyageStage(voyage);
}
async function voyageStage(run: NonNullable<typeof voyage>) {
  const st = run.v.stages[run.n];
  if (space.id !== st.space) {
    const gate = space.things.find((t) => t.to?.space === st.space);
    if (!gate) { stopTour(); return; }
    await transit(gate, true);
    if (voyage !== run) return;
  }
  const next = () => {
    if (voyage !== run) return;
    if (++run.n >= run.v.stages.length) { banner(run.v.name, 'The voyage is over. Your ship is where you left her.'); stopTour(true); } else void voyageStage(run);
  };
  const shots = st.shots === 'generic' ? genericShots(space.things, 7, 4) : st.shots;
  if (!tour.start(space.id, space.things, tourSun(), { shots, once: true, flyIn: run.n === 0, end: next })) next();
}
function stopTour(keepBanner = false) {
  if (!tour.active && !tourSave && !voyage) return;
  voyage = null;
  document.body.classList.remove('voyage');
  tour.stop();
  if (!keepBanner) $('banner').classList.remove('show');
  if (tourSave) {
    if (tourSave.space === space.id) {
      ship.pos.copy(tourSave.pos);
      ship.prev.copy(tourSave.pos);
      ship.q.copy(tourSave.q);
      camQ.copy(tourSave.q);
    } else {
      // Stopped in some other place than we started: stay where we are, facing as the camera is.
      ship.q.copy(camera.quaternion);
      camQ.copy(ship.q);
    }
    tourSave = null;
  }
  shipModel.visible = chase;
}

// Inspect (I): orbit whatever you're aiming at, or the nearest ship or station. The camera eases in,
// the mouse turns it round the subject, the wheel moves closer or further. I or any flight key ends it.
const inspect = { on: false, th: null as Thing | null, yaw: 0, pitch: 0.25, dist: 3, ease: 0, from: new V3() };
function startInspect() {
  if (busy || walk || tour.active) return;
  let th = aimed;
  if (!th) {
    let bd = Infinity;
    for (const t of space.things) {
      if (t.kind !== 'ship' && t.kind !== 'station') continue;
      const d = t.pos.distanceTo(ship.pos) / Math.max(t.radius, 1e-12);
      if (d < bd) { bd = d; th = t; }
    }
  }
  if (!th) return;
  auto = null;
  ship.speed = ship.throttle = 0;
  // Start the orbit from where the camera already is, so the move in is one smooth glide.
  const off = camera.position.clone().sub(th.pos);
  Object.assign(inspect, { on: true, th, ease: 0, dist: th.kind === 'ship' ? 2.4 : 3, yaw: Math.atan2(off.x, off.z), pitch: clamp(Math.asin(off.y / off.length()), -1.2, 1.2) });
  inspect.from.copy(camera.position);
  banner(th.name, th.desc ?? th.sub ?? '');
}
function stopInspect() {
  if (!inspect.on) return;
  inspect.on = false;
  $('banner').classList.remove('show');
}
const _ip = new V3();
function inspectCamera(dt: number) {
  const th = inspect.th!;
  inspect.yaw -= mdx * 0.004;
  inspect.pitch = clamp(inspect.pitch + mdy * 0.004, -1.35, 1.35);
  mdx = mdy = 0;
  inspect.ease = Math.min(1, inspect.ease + dt / 1.4);
  const k = inspect.ease * inspect.ease * (3 - 2 * inspect.ease);
  const r = th.radius * inspect.dist;
  _ip.set(Math.sin(inspect.yaw) * Math.cos(inspect.pitch), Math.sin(inspect.pitch), Math.cos(inspect.yaw) * Math.cos(inspect.pitch)).multiplyScalar(r).add(th.pos);
  camera.position.lerpVectors(inspect.from, _ip, k);
  camera.up.set(0, 1, 0);
  camera.lookAt(th.pos);
  camera.updateMatrixWorld();
  shipModel.visible = false;
}

// Photo mode: time stands still, the HUD goes, the mouse still looks around.
let photo = false, saveShot = false;
function setPhoto(on: boolean) {
  photo = on;
  document.body.classList.toggle('photo', on);
  if (!on) renderer.toneMappingExposure = 1;
  keys.clear();
}
function savePicture() {
  const d = new Date(), p2 = (n: number) => String(n).padStart(2, '0');
  const name = `beyond-the-ring-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}.png`;
  // Called straight after a draw, before the browser clears the canvas.
  canvas.toBlob((b) => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.metaKey || e.ctrlKey) return;
  if (started && !busy && e.code === 'KeyP') { setPhoto(!photo); return; }
  // Any key but T (and the panels) ends a tour and only does that, so the ship doesn't lurch off.
  if (started && (tour.active || voyage) && !['KeyT', 'Tab', 'KeyN', 'KeyH'].includes(e.code)) { stopTour(); return; }
  if (photo) {
    if (e.code === 'BracketRight') renderer.toneMappingExposure = Math.min(4, renderer.toneMappingExposure * 1.15);
    else if (e.code === 'BracketLeft') renderer.toneMappingExposure = Math.max(0.25, renderer.toneMappingExposure / 1.15);
    else if (e.code === 'Enter') saveShot = true;
    else if (e.code === 'Escape') return;
    e.preventDefault();
    return;
  }
  keys.add(e.code);
  if (walk) {
    if (e.code === 'Tab' || e.code === 'KeyN') {
      e.preventDefault();
      document.body.classList.toggle('nav-open');
      if (document.body.classList.contains('nav-open')) document.exitPointerLock();
    } else if (e.code === 'KeyE' && nearPoint?.kind === 'exit') void undock();
    else if (e.code === 'KeyH') document.body.classList.toggle('help-open');
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    return;
  }
  if (e.code === 'KeyT') { if (tour.active || voyage) stopTour(); else voyageMenu.open(); return; }
  if (e.code === 'KeyI') { if (inspect.on) stopInspect(); else startInspect(); return; }
  if (inspect.on && (STEER.includes(e.code) || e.code === 'Escape')) stopInspect();
  // X in the middle of the autopilot's own flip and burn changes nothing: it is already doing it.
  if (e.code === 'KeyX' && auto && (auto.phase === 'flip' || auto.phase === 'burn')) return;
  if (STEER.includes(e.code)) { if (auto && (auto.phase === 'flip' || auto.phase === 'burn')) abortManoeuvre(); else auto = null; }
  switch (e.code) {
    case 'Tab':
    case 'KeyN':
      e.preventDefault();
      document.body.classList.toggle('nav-open');
      if (document.body.classList.contains('nav-open')) document.exitPointerLock();
      break;
    case 'KeyX': ship.throttle = 0; startBrake(); break;
    case 'KeyV': chase = !chase; break;
    case 'KeyO': orbitsOn = !orbitsOn; applyOrbits(); break;
    case 'KeyH': document.body.classList.toggle('help-open'); break;
    case 'KeyF': if (aimed) engage(aimed); break;
    case 'KeyL': {
      const d = dockable();
      if (d) void dock(d);
      break;
    }
    case 'KeyG': {
      const g = nearestGate();
      if (g) engage(g);
      break;
    }
  }
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());

function nearestGate(): Thing | null {
  let best: Thing | null = null, bd = Infinity;
  for (const g of space.gates) {
    const d = g.pos.distanceToSquared(ship.pos);
    if (d < bd) { bd = d; best = g; }
  }
  return best;
}

// -------------------------------------------------------------------- nav

function buildNav() {
  const list = $('nav-list');
  list.innerHTML = '';
  $('nav-title').textContent = walk ? 'PLACES' : 'DESTINATIONS';
  if (walk) {
    for (const pl of walk.places) {
      const el = document.createElement('button');
      el.className = 'nav-item';
      el.textContent = pl.name;
      el.addEventListener('click', () => Object.assign(walker, { x: pl.x, z: pl.z, yaw: pl.yaw, pitch: 0, vx: 0, vz: 0 }));
      list.append(el);
    }
    $('nav-any').style.display = 'none';
    return;
  }
  const add = (th: Thing) => {
    const el = document.createElement('button');
    el.className = `nav-item ${th.kind}${th.indent ? ' indent' : ''}`;
    el.textContent = th.dock ? `${th.name} · dock` : th.name;
    el.addEventListener('click', () => engage(th));
    list.append(el);
  };
  for (const th of space.things) if (th.nav) add(th);
  $('nav-any').style.display = space.id === 'slow' ? '' : 'none';
}

function goToGateNumber(n: number) {
  if (space.id !== 'slow' || !Number.isFinite(n)) return;
  const g = space.gates[clamp(Math.round(n), 0, GATE_COUNT - 1)];
  engage(g);
}
$('gate-go').addEventListener('click', () => goToGateNumber(Number(($('gate-num') as HTMLInputElement).value)));
$('gate-num').addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') goToGateNumber(Number(($('gate-num') as HTMLInputElement).value));
});
$('gate-random').addEventListener('click', () => {
  const n = 1 + Math.floor(Math.random() * (GATE_COUNT - 1));
  ($('gate-num') as HTMLInputElement).value = String(n);
  goToGateNumber(n);
});

// ------------------------------------------------------------- simulation

const speedFor = (th: number) => Math.sign(th) * space.maxSpeed * (Math.exp(7 * Math.abs(th)) - 1) / (Math.exp(7) - 1);

/** The closer you are to something, the slower the drive will take you, so nothing flashes past unseen. */
function speedCap(): number {
  let cap = space.maxSpeed;
  let nd = Infinity;
  nearest = null;
  for (const th of space.things) {
    const dist = th.pos.distanceTo(ship.pos);
    let c: number;
    if (th.kind === 'gate') {
      c = 0.5 * dist + th.radius * 0.4;
    } else {
      // Gentle close in, then opening up fast, so a body only holds you back while it is worth looking at.
      const d = Math.max(0, dist - th.radius), far = d / (30 * th.radius + 20);
      c = 1.2 * d * (1 + far * far) + 0.3 * th.radius + 1e-12;
    }
    if (c < cap) cap = c;
    if (th.kind !== 'gate' || th.range > 0 || dist < th.radius * 18) {
      const score = (dist - th.radius) / (th.kind === 'gate' ? 1 : Math.max(1, th.radius));
      if (score < nd) { nd = score; nearest = th; }
    }
  }
  return cap;
}

function autopilot(dt: number, cap: number) {
  const ap = auto!;
  if (ap.thing.vel) ap.point.copy(viewpoint(ap.thing));      // a moving target: aim at where it is now
  const fwd = _b.set(0, 0, -1).applyQuaternion(ship.q);
  const R = ap.thing.radius;
  if (ap.phase === 'face') {
    engine = 0;
    ship.speed *= Math.exp(-8 * dt);
    const dir = ap.thing.pos.clone().sub(ship.pos).normalize();
    faceShip(dir, 2.6 * dt);
    if (fwd.dot(dir) > 0.9997) {
      if (ap.thing.vel) ship.speed = 0;
      auto = null;
    }
    return;
  }
  if (ap.phase === 'flip') {
    // Coasting: the drive is off, the ship turns end over end and the way we are going does not change.
    ap.t += dt;
    const k = smoother(clamp(ap.t / FLIP_SECS, 0, 1));
    ship.q.copy(ap.q0).multiply(_q.setFromAxisAngle(_a.set(1, 0, 0), Math.PI * k));
    engine = 0;
    // (Small corrections by the thrusters keep the line of travel on the target.)
    ap.dir.lerp(ap.point.clone().sub(ship.pos).normalize(), 1 - Math.exp(-1.2 * dt)).normalize();
    ship.pos.addScaledVector(ap.dir, ship.speed * dt);
    if (ap.t >= FLIP_SECS) { ap.phase = 'burn'; ap.t = 0; }
    return;
  }
  if (ap.phase === 'burn') {
    // The drive now points the way we are going. Brake along the same line, at the rate that stops us
    // exactly at the viewpoint: the speed from which a steady burn of `a` just runs out there.
    const toPoint = ap.point.clone().sub(ship.pos), left = toPoint.length();
    if (left > 0) ap.dir.lerp(toPoint.divideScalar(left), 1 - Math.exp(-1.2 * dt)).normalize();
    if (left <= (ap.thing.vel ? 0.3 : 0.05) * R || ship.speed <= 0) { ship.speed = 0; engine = 0; ap.phase = 'face'; return; }
    // (In the last stretch the burn's curve asks for less speed than one frame's step can follow, so it also
    // never asks for more than three times the distance left a second: an easy final approach, no overshoot.)
    const want = Math.min(Math.sqrt(2 * ap.a * left), 3 * left);
    if (ship.speed > want) { ship.speed = Math.max(want, ship.speed - 1.5 * ap.a * dt); engine = 1; }
    else if (ap.thing.vel && ship.speed < want) { ship.speed = Math.min(want, ship.speed + ap.a * dt); engine = 1; }   // she moved: pick the pace back up
    else engine = 0;
    ship.pos.addScaledVector(ap.dir, Math.min(ship.speed * dt, left));
    return;
  }
  const to = _a.copy(ap.point).sub(ship.pos);
  const dist = to.length();
  if (dist < 0.02 * R) {
    ap.phase = 'face';
    return;
  }
  const dir = to.clone().divideScalar(dist);
  // Steer round anything solid that sits on the straight line.
  let bestT = dist;
  let aim: V3 | null = null;
  for (const th of space.things) {
    if (!th.solid || th === ap.thing) continue;
    const v = _c.copy(th.pos).sub(ship.pos);
    const t = v.dot(dir);
    if (t <= 0 || t >= bestT) continue;
    const perp = v.addScaledVector(dir, -t);
    const clear = th.radius * 1.7;
    if (perp.length() < clear) {
      bestT = t;
      if (perp.lengthSq() < (th.radius * 1e-3) ** 2) perp.set(0, 1, 0).applyQuaternion(ship.q);
      aim = th.pos.clone().addScaledVector(perp.normalize(), -clear * 1.2);
    }
  }
  const want = aim ? aim.sub(ship.pos).normalize() : dir;
  faceShip(want, 2.6 * dt);
  const align = fwd.dot(want);
  // Time to turn round? The burn needs v²/2a to stop and the flip itself coasts for FLIP_SECS.
  const need = (ship.speed * ship.speed) / (2 * ap.a) + ship.speed * FLIP_SECS * 1.08 + 0.02 * R;
  // (Only with a clear line: the flip holds the heading fixed, so it must be the heading to the target.)
  if (!aim && ship.speed * FLIP_SECS > 0.12 * R && dist <= need && align > 0.99) {
    ap.phase = 'flip';
    ap.t = 0;
    ap.dir.copy(fwd);
    ap.q0.copy(ship.q);
    engine = 0;
    return;
  }
  // Burn (or coast at the limit) towards the target. Close in, the old rule still holds the speed down.
  const vTarget = Math.min(cap, dist * 2.2) * (align > 0.9 ? 1 : align > 0.5 ? 0.2 : 0);
  if (ship.speed < vTarget) { ship.speed = Math.min(vTarget, ship.speed + ap.a * dt); engine = 1; }
  else { ship.speed += (vTarget - ship.speed) * (1 - Math.exp(-4 * dt)); engine = 0; }
  ship.speed = Math.min(ship.speed, dist / dt);
  ship.pos.addScaledVector(fwd, ship.speed * dt);
}

/** Start a flip and burn to a stop (X). Does nothing if we are hardly moving. */
function startBrake() {
  if (auto || brake || busy || walk) return;
  if (ship.speed <= 3e-7) { ship.speed = 0; return; }       // under about 45 m/s: just stop
  const fwd = new V3(0, 0, -1).applyQuaternion(ship.q);
  brake = { phase: 'flip', t: 0, dir: fwd, q0: ship.q.clone(), qFrom: ship.q.clone(), a: ship.speed / BRAKE_SECS };
  ship.throttle = 0;
}

function braking(dt: number) {
  const b = brake!;
  b.t += dt;
  if (b.phase === 'flip') {
    ship.q.copy(b.q0).multiply(_q.setFromAxisAngle(_a.set(1, 0, 0), Math.PI * smoother(clamp(b.t / FLIP_SECS, 0, 1))));
    engine = 0;
    ship.pos.addScaledVector(b.dir, ship.speed * dt);
    if (b.t >= FLIP_SECS) { b.phase = 'burn'; b.t = 0; }
  } else if (b.phase === 'burn') {
    ship.speed = Math.max(0, ship.speed - b.a * dt);
    engine = 1;
    ship.pos.addScaledVector(b.dir, ship.speed * dt);
    if (ship.speed <= 0) { b.phase = 'back'; b.t = 0; b.qFrom.copy(ship.q); engine = 0; }
  } else {
    // Turn back the way we were pointing (still carrying whatever speed is left).
    ship.q.slerpQuaternions(b.qFrom, b.q0, smoother(clamp(b.t / (FLIP_SECS * 0.8), 0, 1)));
    engine = 0;
    ship.pos.addScaledVector(b.dir, ship.speed * dt);
    if (b.t >= FLIP_SECS * 0.8) { ship.q.copy(b.q0); brake = null; }
  }
}

/** Take the helm back mid-manoeuvre: finish turning to the original heading, keeping the way we were going. */
function abortManoeuvre() {
  if (auto && (auto.phase === 'flip' || auto.phase === 'burn')) {
    brake = { phase: 'back', t: 0, dir: auto.dir.clone(), q0: auto.q0.clone(), qFrom: ship.q.clone(), a: 0 };
    auto = null;
  } else if (brake && brake.phase !== 'back') {
    brake.phase = 'back'; brake.t = 0; brake.qFrom.copy(ship.q);
  }
}

function step(dt: number) {
  if (escort) {
    // On the way to her the autopilot works in her frame, as if she stood still, so the chase always ends alongside.
    const chasing = auto?.thing === escort.thing;
    if (!chasing && (auto || brake || ship.throttle > 0 || ship.speed > 1e-9 || escort.thing.pos.distanceTo(ship.pos) > escort.thing.radius * 40)) escort = null;
  }
  ship.prev.copy(ship.pos);
  const cap = speedCap();

  const rate = 1.1 * dt;
  let yaw = 0, pitch = 0, roll = 0;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) yaw += rate;
  if (keys.has('ArrowRight') || keys.has('KeyD')) yaw -= rate;
  if (keys.has('ArrowUp')) pitch += rate;
  if (keys.has('ArrowDown')) pitch -= rate;
  if (keys.has('KeyQ')) roll += rate * 1.3;
  if (keys.has('KeyE')) roll -= rate * 1.3;
  if (freeLook) {
    lookYaw -= mdx * 0.003;
    lookPitch = clamp(lookPitch - mdy * 0.003, -1.4, 1.4);
  } else {
    yaw -= mdx * 0.0016;
    pitch -= mdy * 0.0016;
    lookYaw *= Math.exp(-6 * dt);
    lookPitch *= Math.exp(-6 * dt);
  }
  mdx = mdy = 0;

  if (auto) {
    autopilot(dt, cap);
  } else if (brake) {
    // Flipping and burning by hand: the helm is the ship's own until it has turned back.
    if (keys.has('KeyW') || keys.has('Escape')) abortManoeuvre();
    if (brake) braking(dt);
  } else {
    engine = 0;
    if (yaw) ship.q.multiply(_q.setFromAxisAngle(_a.set(0, 1, 0), yaw));
    if (pitch) ship.q.multiply(_q.setFromAxisAngle(_a.set(1, 0, 0), pitch));
    if (roll) ship.q.multiply(_q.setFromAxisAngle(_a.set(0, 0, 1), roll));
    ship.q.normalize();
    if (keys.has('KeyW')) ship.throttle = clamp(ship.throttle + 0.4 * dt, -0.3, 1);
    if (keys.has('KeyS')) ship.throttle = clamp(ship.throttle - 0.4 * dt, -0.3, 1);
    const target = clamp(speedFor(ship.throttle), -cap, cap);
    const before = ship.speed;
    ship.speed += (target - ship.speed) * (1 - Math.exp(-3.5 * dt));
    ship.speed = clamp(ship.speed, -cap, cap);
    // The drive burns while we speed up, and idles low while a throttle is set; it is off when we cut it.
    engine = ship.speed > before + Math.abs(target) * 0.002 * dt * 60 ? 1 : ship.throttle > 0.02 ? 0.22 : 0;
    ship.pos.addScaledVector(_b.set(0, 0, -1).applyQuaternion(ship.q), ship.speed * dt);
  }

  for (const th of space.things) {
    if (!th.solid) continue;
    const min = th.radius * (th.kind === 'station' ? 1.0 : 1.15);
    const d = _a.copy(ship.pos).sub(th.pos);
    if (d.lengthSq() < min * min) ship.pos.copy(th.pos).addScaledVector(d.lengthSq() ? d.normalize() : d.set(0, 1, 0), min);
  }

  const g = nearestGate();
  if (g) {
    const sp = _a.copy(ship.prev).sub(g.pos).dot(g.normal!);
    const sn = _b.copy(ship.pos).sub(g.pos).dot(g.normal!);
    if (sp !== sn && sp * sn <= 0) {
      const hit = _c.copy(ship.prev).lerp(ship.pos, sp / (sp - sn));
      if (hit.distanceTo(g.pos) < g.radius * 0.93) void transit(g);
    }
  }
  if (space.bound && ship.pos.length() > space.bound) ship.pos.setLength(space.bound);
}

// ---------------------------------------------------------------- on foot

/** The nearest place you could dock, if you are close enough to it. */
function dockable(): Thing | null {
  let best: Thing | null = null, bd = Infinity;
  for (const th of space.things) {
    if (!th.dock) continue;
    const d = th.pos.distanceTo(ship.pos);
    if (d < th.radius * 12 && d < bd) { best = th; bd = d; }
  }
  return best;
}

async function fade(work: () => Promise<void> | void) {
  busy = true;
  const flash = $('flash');
  flash.classList.add('dark', 'on');
  await pause(450);
  await work();
  loadingEl.textContent = '';
  await pause(200);
  flash.classList.remove('on');
  setTimeout(() => flash.classList.remove('dark'), 450);
  busy = false;
}

async function dock(th: Thing) {
  if (busy || walk || !th.dock) return;
  auto = null;
  brake = null;
  ship.throttle = ship.speed = 0;
  await fade(async () => {
    loadingEl.textContent = 'Docking…';
    // Bounce light comes from probes saved ahead of time (see probes.ts): fetch this place's.
    const bounce = canBounce(renderer) && !new URLSearchParams(location.search).has('nobounce');
    const it = await buildInterior(th.dock!, bounce, bounce && !BAKING ? await savedProbes(th.dock!) : null);
    it.scene.environment = envMap;
    it.scene.environmentIntensity = 0.3;
    Object.assign(walker, { x: it.spawn.x, z: it.spawn.z, yaw: it.spawn.yaw, pitch: 0, vx: 0, vz: 0 });
    // (For the bake tool the probe textures are made empty here, before the shaders are
    // compiled so they are not compiled twice, and filled once the shaders are ready.)
    if (BAKING) it.bounce?.prime(renderer);
    await warm(it.scene, walkCam);
    if (BAKING && it.bounce) {
      const here = new V3(it.spawn.x, 1.7, it.spawn.z);
      while (!it.bounce.step(renderer, 24, here, PROBE_FAR)) await pause();
    }
    walk = it;
    Object.assign(walker, { x: it.spawn.x, z: it.spawn.z, yaw: it.spawn.yaw, pitch: 0, vx: 0, vz: 0 });
    document.body.classList.add('walking');
    buildNav();
    $('loc-name').textContent = it.name;
    $('loc-sub').textContent = 'On foot';
  });
  const it = walk as Interior | null;
  if (it) banner(it.name, it.blurb);
}

async function undock() {
  if (busy || !walk) return;
  await fade(() => {
    walk = null;
    nearPoint = null;
    document.body.classList.remove('walking');
    buildNav();
    $('loc-name').textContent = space.name;
    $('loc-sub').textContent = space.subtitle;
  });
}

function walkStep(dt: number) {
  const it = walk!;
  if (locked()) {
    walker.yaw -= mdx * 0.0022;
    walker.pitch = clamp(walker.pitch - mdy * 0.0022, -1.45, 1.45);
  }
  mdx = mdy = 0;
  if (keys.has('ArrowLeft')) walker.yaw += 1.9 * dt;
  if (keys.has('ArrowRight')) walker.yaw -= 1.9 * dt;
  if (keys.has('ArrowUp')) walker.pitch = Math.min(1.45, walker.pitch + 1.2 * dt);
  if (keys.has('ArrowDown')) walker.pitch = Math.max(-1.45, walker.pitch - 1.2 * dt);
  const f = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
  const r = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  // Feet take a moment to get going and to stop: ease the velocity towards what the keys ask for.
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
  let tx = 0, tz = 0;
  if ((f || r) && !busy) {
    const v = (run ? (it.curveR ? 18 : 10) : 4.2) / Math.hypot(f, r);
    const sin = Math.sin(walker.yaw), cos = Math.cos(walker.yaw);
    tx = (-sin * f + cos * r) * v;
    tz = (-cos * f - sin * r) * v;
  }
  // Where gravity is spin, how you are moving changes how much you weigh (see spin.ts). The
  // weight follows over a third of a second or so, as your legs find out.
  const sp = SPIN_ON ? it.spin : undefined;
  const fl = sp ? feel(sp, walker.vx, walker.vz) : null;
  walker.weight += ((fl ? fl.weight : 1) - walker.weight) * (1 - Math.exp(-dt * 3));
  walker.drift = fl ? fl.drift : 0;
  // Light feet grip less, so you are slower to get going, to turn and to stop; heavy ones bite.
  const grip = clamp(Math.sqrt(walker.weight), 0.55, 1.2);
  const ease = 1 - Math.exp(-dt * (tx || tz ? 9 : 12) * grip);
  walker.vx += (tx - walker.vx) * ease;
  walker.vz += (tz - walker.vz) * ease;
  const speed = Math.hypot(walker.vx, walker.vz);
  if (speed < 0.02) walker.vx = walker.vz = 0;
  // Move in short hops so a fast run can't jump through a thin wall, sliding along whatever blocks one axis.
  const hops = Math.max(1, Math.ceil((speed * dt) / 0.2));
  for (let i = 0; i < hops; i++) {
    const dx = (walker.vx * dt) / hops, dz = (walker.vz * dt) / hops;
    if (it.free(walker.x + dx, walker.z)) walker.x += dx; else walker.vx *= 0.5;
    if (it.free(walker.x, walker.z + dz)) walker.z += dz; else walker.vz *= 0.5;
  }
  // Each stride leaves the floor for a moment and comes down a little spinward. It is a nudge
  // to where you land, not a push on your speed, and a wall simply stops it.
  if (sp && walker.drift > 0) {
    const dx = sp.sx * walker.drift * dt, dz = sp.sz * walker.drift * dt;
    if (it.free(walker.x + dx, walker.z + dz)) { walker.x += dx; walker.z += dz; }
  }
  // People are solid too: step round them rather than through.
  const [px, pz] = it.clearOfPeople(walker.x, walker.z, 0.3);
  if (it.free(px, pz)) { walker.x = px; walker.z = pz; }
  // The head bobs with each stride, more when running, not at all when standing.
  let eye: number;
  if (fl) {
    // In spin gravity each stride is a slow hop: longer and floatier the lighter you are just
    // now, short and quick when you are heavy. You also stand a little taller when light and
    // sink a little into your knees when heavy.
    if (speed > 0) walker.bob += (dt * Math.PI * 2) / fl.step;
    // (The height of the hop is eased, so pushing against a wall does not make the view judder.)
    walker.rise += (fl.rise - walker.rise) * (1 - Math.exp(-dt * 6));
    eye = 1.7 + 0.05 * clamp(1 - walker.weight, -1, 1) - Math.cos(walker.bob) * walker.rise * 0.5;
  } else {
    walker.bob += dt * speed * (run ? 1.3 : 1.9);
    eye = 1.7 + Math.sin(walker.bob) * 0.03 * Math.min(1, speed / 4);
  }
  walker.eye = eye;
  const q = walkCam.quaternion.setFromAxisAngle(_a.set(0, 1, 0), walker.yaw).multiply(_q.setFromAxisAngle(_a.set(1, 0, 0), walker.pitch));
  if (it.curveR) {
    const R = it.curveR, th = walker.x / R;
    walkCam.position.set((R - eye) * Math.sin(th), -(R - eye) * Math.cos(th), walker.z);
    q.premultiply(_q.setFromAxisAngle(_a.set(0, 0, 1), th));
  } else {
    walkCam.position.set(walker.x, eye, walker.z);
  }
  it.tick(clock, dt, walkCam.position);
  nearPoint = null;
  let bd = Infinity;
  for (const pt of it.points) {
    const d = Math.hypot(pt.x - walker.x, pt.z - walker.z);
    if (d < pt.r && d < bd) { bd = d; nearPoint = pt; }
  }
}

// Only a couple of bodies hold their large photo maps at once; the one that looks smallest gives its set back.
const SHARP_MAX = 2;
const looksBig = (x: Lod) => x.spec.radius / Math.max(1e-12, x.pos.distanceTo(ship.pos));
const sharpHeld = () => space.lods.filter((x) => x.sharp).sort((a, b) => looksBig(a) - looksBig(b));
function roomToSharpen(l: Lod, app: number) {
  if (l.sharp) return true;
  const held = sharpHeld();
  return held.length < SHARP_MAX || looksBig(held[0]) < app * 0.8;
}

/** Repaint the surface of whatever you are closest to, one body at a time, in the background. */
function lodTick() {
  if (lodBusy) return;
  let best: Lod | null = null, score = 0, want = 0;
  for (const l of space.lods) {
    const app = l.spec.radius / Math.max(1e-12, l.pos.distanceTo(ship.pos));
    const target = app > 0.06 ? 2 : app > 0.004 ? 1 : 0;
    if (target <= l.level || app <= score) continue;
    // A photo body that only lacks its large maps waits until there is room for them.
    if (l.photo && l.level >= 1 && !roomToSharpen(l, app)) continue;
    best = l; score = app; want = target;
  }
  if (!best) return;
  const l = best, sp = space, level = want;
  const w = level === 2 ? (l.spec.radius >= 0.02 && l.spec.kind !== 'star' ? 2048 : 1024) : 512;
  lodBusy = true;
  const jobs: Promise<boolean>[] = [];
  const p = l.photo;
  if (!p || (l.spec.tex!.lights && !p.night)) {
    jobs.push(paintBody(l.spec.tex!, w, w / 2, 5, () => space === sp).then((maps) => {
      if (maps && space === sp) applyMaps(l, maps);
      return !!maps;
    }));
  }
  let reached = level;
  if (p && level === 2 && !l.sharp) {
    if (roomToSharpen(l, score)) {
      const held = sharpHeld();
      if (held.length >= SHARP_MAX) {
        held[0].level = 1;
        void showPhoto(held[0], false);
      }
      jobs.push(showPhoto(l, true).then(() => true));
    } else reached = 1;
  }
  Promise.all(jobs)
    .then((ok) => { if (ok.every(Boolean)) l.level = reached; })
    .catch((e) => console.error(e))
    .finally(() => (lodBusy = false));
}

// -------------------------------------------------------------------- HUD

const fmtDist = (d: number) => {
  if (d >= 50) return `${(d / AU).toFixed(d >= 10000 ? 1 : 2)} AU`;
  const km = d * 149597.87;
  if (km >= 1e6) return `${(km / 1e6).toFixed(2)}M km`;
  if (km >= 1e5) return `${Math.round(km / 1000)}k km`;
  if (km >= 10) return `${Math.round(km).toLocaleString()} km`;
  if (km >= 1) return `${km.toFixed(1)} km`;
  return `${Math.round(km * 1000)} m`;
};
const fmtSpeed = (v: number) => {
  const kms = Math.abs(v) * 149597.87;
  const c = kms / 299792.458;
  if (c >= 0.01) return c < 10 ? `${c.toFixed(2)} c` : `${Math.round(c).toLocaleString()} c`;
  if (kms >= 1) return `${kms.toFixed(kms < 10 ? 1 : 0)} km/s`;
  return `${Math.round(kms * 1000)} m/s`;
};

const aimLabel = $('aim-label');
const tanHalf = () => Math.tan((camera.fov * Math.PI) / 360);

function screenPos(pos: V3, out: V3): boolean {
  out.copy(pos).applyMatrix4(camera.matrixWorldInverse);
  if (out.z > -camera.near) return false;
  out.copy(pos).project(camera);
  out.x = (out.x * 0.5 + 0.5) * innerWidth;
  out.y = (-out.y * 0.5 + 0.5) * innerHeight;
  return true;
}

function updateLabels() {
  const fwd = _b.set(0, 0, -1).applyQuaternion(ship.q);
  let best: Thing | null = null, bestOff = 0.09;
  const k = innerHeight / 2 / tanHalf();
  for (const th of space.things) {
    const dist = th.pos.distanceTo(camera.position);
    const shown = dist < th.range;
    if (shown || th.kind === 'gate') {
      // How far off the crosshair it is, counting anywhere on its disc as dead centre.
      const dot = _a.copy(th.pos).sub(ship.pos).normalize().dot(fwd);
      const off = Math.acos(clamp(dot, -1, 1)) - Math.atan2(th.radius, dist);
      if (off < bestOff) {
        best = th;
        bestOff = off;
      }
    }
    const el = th.label;
    if (!el) continue;
    if (!shown || !screenPos(th.pos, _c)) {
      el.style.display = 'none';
      continue;
    }
    const px = Math.max(3, (th.radius / dist) * k * 0.72);
    el.style.display = '';
    el.style.transform = `translate(${(_c.x + px + 3).toFixed(1)}px, ${(_c.y - px - 14).toFixed(1)}px)`;
    el.classList.toggle('big', px > 8);
    el.classList.toggle('aim', th === aimed);
    el.classList.toggle('target', th === auto?.thing);
  }
  aimed = best;
  const loose = aimed && !aimed.label ? aimed : auto && !auto.thing.label ? auto.thing : null;
  if (loose && screenPos(loose.pos, _c)) {
    aimLabel.style.display = 'block';
    aimLabel.textContent = loose.name;
    aimLabel.style.transform = `translate(${(_c.x + 10).toFixed(1)}px, ${(_c.y - 20).toFixed(1)}px)`;
  } else {
    aimLabel.style.display = 'none';
  }
}

let hudClock = 0;
function updateHud(dt: number) {
  hudClock += dt;
  if (hudClock < 0.1) return;
  hudClock = 0;
  if (walk) {
    $('loc-near').textContent = walk.roomAt(walker.x, walker.z);
    // Station time runs on your own clock, so a late-night visit finds the place on its night shift.
    const now = new Date();
    // Where gravity is spin, show what you weigh this moment: it moves as you run with or against the turn.
    const g = SPIN_ON && walk.spin ? ` · ${(walk.spin.g * walker.weight).toFixed(2)} g` : '';
    $('loc-sub').textContent = `On foot${g} · ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} station time`;
    const pt = nearPoint as Point | null;
    $('card').style.display = pt ? 'block' : 'none';
    if (pt) {
      $('card-name').textContent = pt.title;
      $('card-sub').textContent = walk.name;
      $('card-desc').textContent = pt.text;
      $('card-dist').textContent = '';
      $('card-key').textContent = pt.kind === 'exit' ? 'E — board and undock' : '';
    }
    $('hint').textContent = !locked() && !document.body.classList.contains('nav-open')
      ? 'Click the view to look around · Tab for places'
      : pt?.kind === 'exit' ? 'E — board your ship and undock' : '';
    return;
  }
  $('speed').textContent = fmtSpeed(ship.speed);
  ($('throttle-fill') as HTMLElement).style.width = `${Math.abs(ship.throttle) * 100}%`;
  $('throttle-fill').classList.toggle('reverse', ship.throttle < 0);
  $('mode').textContent = auto
    ? auto.phase === 'flip' ? `FLIPPING · ${auto.thing.name}` : auto.phase === 'burn' ? `BURNING TO ARRIVE · ${auto.thing.name}` : `AUTOPILOT → ${auto.thing.name}`
    : brake ? (brake.phase === 'flip' ? 'FLIPPING' : brake.phase === 'burn' ? 'BURNING TO A STOP' : 'TURNING BACK')
    : escort ? `ALONGSIDE · ${escort.thing.name}`
    : ship.throttle < 0 ? 'REVERSE' : 'MANUAL';
  $('mode').classList.toggle('auto', !!auto || !!brake || !!escort);

  const near = nearest as Thing | null;
  // (The slack is for Sol's planets; in the ring space it would be the whole bubble.)
  const close = near && near.pos.distanceTo(ship.pos) < near.radius * 10 + (space.id === 'slow' ? 0 : 30) ? near : null;
  const focus = auto?.thing ?? aimed ?? close;
  const card = $('card');
  if (focus) {
    card.style.display = 'block';
    $('card-name').textContent = focus.name;
    $('card-sub').textContent = focus.sub;
    $('card-desc').textContent = focus.desc;
    $('card-dist').textContent = fmtDist(Math.max(0, focus.pos.distanceTo(ship.pos) - (focus.solid ? focus.radius : 0)));
    const here = dockable();
    $('card-key').textContent = auto ? 'En route — any flight key takes back control'
      : focus.dock ? (focus === here ? 'L — dock and go aboard' : 'F — fly there · you can dock here')
      : focus === aimed ? 'F — fly there' : '';
  } else {
    card.style.display = 'none';
  }
  $('loc-near').textContent = near ? `near ${near.name}` : '';

  let hint = '';
  const gate = nearestGate();
  if (!locked() && !document.body.classList.contains('nav-open')) hint = 'Click the view to take the stick · Tab for destinations';
  else if (!auto && dockable()) hint = `L — dock at ${dockable()!.name} and go aboard`;
  else if (gate && !auto && gate.pos.distanceTo(ship.pos) < gate.radius * 5) hint = 'Hold W and fly through the middle of the ring';
  else if (space.id === 'slow' && ship.speed > space.maxSpeed * 0.95) hint = 'Speed limit — the station allows nothing faster in here';
  $('hint').textContent = hint;
}

// ------------------------------------------------------------------- loop

const _off = new V3(), _lookQ = new THREE.Quaternion();
let last = performance.now();
let clock = 0;

// The star map (M): where everything is, and a plotter that hands a course to the autopilot.
const voyageMenu = createVoyageMenu(
  (v) => v.from.length === 0 || v.from.includes(space.id),
  startVoyage,
  () => started && !busy && !walk && !!space && !tour.active,
);

const starMap = createMap({
  space: () => space,
  ship: () => ({ pos: ship.pos, fwd: new V3(0, 0, -1).applyQuaternion(ship.q), speed: ship.speed }),
  viewpoint: (t) => viewpoint(t as Thing),
  plot: (t) => engage(t as Thing),
  target: () => (auto?.thing ?? null) as never,
  status: () => $('mode').textContent ?? '',
  dist: (d) => fmtDist(d),
  speed: (v) => fmtSpeed(v),
  unitMetres: 1 / SOL_UNIT,
  canOpen: () => started && !busy && !walk && !!space,
});
if (new URLSearchParams(location.search).has('debug')) (globalThis as unknown as { __map: typeof starMap }).__map = starMap;

// With ?debug in the address, keep the last few thousand frame times for tests (hitch hunting).
const FRAMES: number[] | null = new URLSearchParams(location.search).has('debug') ? [] : null;
if (FRAMES) (globalThis as unknown as { __frames: number[] }).__frames = FRAMES;
// (walker is declared further down; expose it lazily for tests)
if (FRAMES) (globalThis as unknown as { __look: typeof look }).__look = look;
if (FRAMES) Object.defineProperty(globalThis, '__dbg', { get: () => ({ ship, space, faceShip, dust, sky, auto, escort }) });
// For tests: put you down somewhere else in the place you are walking, facing `yaw`.
if (FRAMES) (globalThis as unknown as { __goto: (x: number, z: number, yaw?: number) => void }).__goto = (x, z, yaw) => { walker.x = x; walker.z = z; walker.vx = walker.vz = 0; if (yaw !== undefined) walker.yaw = yaw; };
if (FRAMES) Object.defineProperty(globalThis, '__walker', { get: () => ({ ...walker, free: walk ? walk.free(walker.x, walker.z) : null, cam: walkCam.position.toArray(), up: new V3(0, 1, 0).applyQuaternion(walkCam.quaternion).toArray(), fwd: new V3(0, 0, -1).applyQuaternion(walkCam.quaternion).toArray() }) });
// The light probes too: how many are left to fill, and a switch for before-and-after tests.
if (FRAMES) Object.defineProperty(globalThis, '__bounce', { get: () => walk?.bounce });
// The place you are walking in: its open floor, places and points, for tests of where you can get to.
if (FRAMES) Object.defineProperty(globalThis, '__place', { get: () => walk && { free: walk.free, places: walk.places, points: walk.points, spawn: walk.spawn, curveR: walk.curveR } });
// How much was drawn last frame (draw calls and triangles), for before-and-after comparisons.
if (FRAMES) { renderer.info.autoReset = false; Object.defineProperty(globalThis, '__info', { get: () => ({ ...renderer.info.render }) }); }
// For tools/bake-probes.ts: the finished probes of the place you are in, as a file.
if (FRAMES) Object.assign(globalThis, { __saveProbes: () => walk?.bounce?.done ? Array.from(walk.bounce.save(renderer)) : null });


function frame(now: number) {
  requestAnimationFrame(frame);
  if (FRAMES && last) { FRAMES.push(now - last); if (FRAMES.length > 5000) FRAMES.shift(); }
  const realDt = Math.min(0.05, (now - last) / 1000);
  // In photo mode the world stops; only the camera moves.
  const dt = photo ? 0 : realDt;
  last = now;
  clock += dt;
  if (!space) return;
  if (walk) {
    walkStep(dt);
    updateHud(dt);
    look.update(dt, walk.id, walkCam, null, walkCam.aspect);
    draw(walk.scene, walkCam);
    if (saveShot) { saveShot = false; savePicture(); }
    return;
  }
  if (photo) {
    // Look around freely without steering the ship.
    lookYaw -= mdx * 0.003;
    lookPitch = clamp(lookPitch - mdy * 0.003, -1.4, 1.4);
    mdx = mdy = 0;
  }
  if (!busy && started && !tour.active && !inspect.on) step(dt);
  lodTick();

  shipModel.position.copy(ship.pos);
  shipModel.quaternion.copy(ship.q);
  shipModel.visible = chase;
  plume.update(walk || tour.active || inspect.on ? 0 : engine, clock);

  // While the ship turns end over end the camera follows slowly, so you watch her swing round.
  const turning = !!brake || (!!auto && (auto.phase === 'flip' || auto.phase === 'burn'));
  camQ.slerp(ship.q, 1 - Math.exp(-(turning ? 1.1 : 9) * dt));
  _lookQ.copy(camQ)
    .multiply(_q.setFromAxisAngle(_a.set(0, 1, 0), lookYaw))
    .multiply(_q.setFromAxisAngle(_a.set(1, 0, 0), lookPitch));
  // A little off to the side, so the plume shows as a beam and not as a glow straight at the lens.
  if (chase) _off.set(1.7, 1.4, 6.4).multiplyScalar(SHIP_SCALE);
  else _off.set(0, 0.1, -0.45).multiplyScalar(SHIP_SCALE);
  camera.position.copy(ship.pos).add(_off.applyQuaternion(_lookQ));
  camera.quaternion.copy(_lookQ);
  camera.updateMatrixWorld();
  if (inspect.on && inspect.th) inspectCamera(realDt);
  if (tour.active && tour.update(dt, camera, !started)) {
    // The tour drives the camera; the ship rides along unseen, so maps sharpen where we're looking.
    shipModel.visible = false;
    ship.pos.copy(camera.position);
    ship.prev.copy(camera.position);
  }
  sky.position.copy(camera.position);
  // The star's glint in the environment faces the star.
  if (space.star) {
    _a.copy(space.star).sub(camera.position);
    if (_a.lengthSq() > 1e-12) scene.environmentRotation.setFromQuaternion(_q.setFromUnitVectors(_Z, _a.normalize()));
  }

  const p = dustGeo.getAttribute('position') as THREE.BufferAttribute;
  const cp = camera.position, h = DUST_BOX / 2;
  for (let i = 0; i < DUST_N; i++) {
    for (let a = 0; a < 3; a++) {
      const c = a === 0 ? cp.x : a === 1 ? cp.y : cp.z;
      const v = dustBase[i * 3 + a] - c;
      p.array[i * 3 + a] = v - Math.floor(v / DUST_BOX) * DUST_BOX - h;
    }
  }
  p.needsUpdate = true;
  dust.position.copy(cp);
  dustMat.opacity = 0.6 * clamp(1 - Math.abs(ship.speed) / (DUST_BOX * 6), 0, 1);

  space.tick(clock, dt);
  tickShipLights(clock);
  // The ships under way have just moved: carry ours along with the one we are chasing or flying beside, so
  // that what is on screen has her exactly where we left her.
  if (escort) {
    _a.copy(escort.thing.pos).sub(escort.last);
    escort.last.copy(escort.thing.pos);
    ship.pos.add(_a); ship.prev.add(_a); shipModel.position.add(_a); camera.position.add(_a); sky.position.copy(camera.position);
  }
  updateLabels();
  updateHud(dt);
  look.update(dt, 'space', camera, space.things.find((t) => t.kind === 'star')?.pos ?? null, camera.aspect);
  draw(scene, camera);
  if (saveShot) { saveShot = false; savePicture(); }
}

// ------------------------------------------------------------------- boot

async function boot() {
  const want = decodeURIComponent(location.hash.slice(1));
  const id = want === 'slow' || /^sys:\d+$/.test(want) ? want : 'sol';
  loadingEl.textContent = 'Fitting out the fleet…';
  await Promise.all([loadModels(), loadPeople()]);
  // The stand-in ship made at start-up gives way to the proper model.
  scene.remove(shipModel);
  ({ group: shipModel, plume } = playerShip());
  shipModel.scale.setScalar(SHIP_SCALE);
  scene.add(shipModel);
  const s = await getSpace(id);
  enter(s);
  placeAt(s.things.find((t) => t.id === (id === 'sol' ? 'earth' : id === 'slow' ? 'station' : 'ring'))!);
  loadingEl.textContent = 'Warming up…';
  await warm(scene, camera);
  loadingEl.textContent = '';
  busy = false;
  $('launch').removeAttribute('disabled');
  // Behind the start screen, show the system off.
  startTour();
  $('launch').textContent = 'Launch';
}

$('launch').addEventListener('click', () => {
  stopTour();
  started = true;
  document.body.classList.add('started');
  banner(space.id === 'slow' ? space.name : `${space.name} system`, space.blurb);
  canvas.requestPointerLock()?.catch?.(() => {});
});

requestAnimationFrame(frame);
void boot();
