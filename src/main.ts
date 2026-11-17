import * as THREE from 'three';
import { makeTraffic, type Fleet, type Port } from './traffic';
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
import { buildModel, glowSprite, glowTex, loadModels, playerShip, type ShipModel } from './ships';
import { buildInterior, type Interior, type Point } from './interior';
import { loadPeople } from './skinned';
import { PHOTOS, STARS, type PhotoSet } from './photos';

type V3 = THREE.Vector3;
const V3 = THREE.Vector3;
const ZERO = new V3();
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

// Everything is drawn into a float buffer first, so lamps, drives and city lights
// can be brighter than white and bleed a little, the way they do on film.
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
const renderPass = new RenderPass(scene, camera);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.4, 1.0);
composer.addPass(renderPass);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function draw(s: THREE.Scene, c: THREE.Camera) {
  renderPass.scene = s;
  renderPass.camera = c;
  composer.render();
}

// A dim studio stands in for all the light bouncing around, so metal has something to reflect.
const envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envMap;
scene.environmentIntensity = 0.3;

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

const ATMO_V = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`;
const ATMO_F = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 color; uniform vec3 sunDir; uniform float strength;
varying vec3 vN; varying vec3 vV; varying vec3 vW;
void main() {
  #include <logdepthbuf_fragment>
  // Brightest at the planet's limb, thinning to nothing at the top of the air.
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  float rim = pow(1.0 - ndv, 2.6) * smoothstep(0.0, 0.17, ndv) * 1.5;
  float lit = clamp(dot(normalize(vW), sunDir) * 1.3 + 0.45, 0.06, 1.0);
  gl_FragColor = vec4(color, rim * strength * lit);
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

function makeSky(): THREE.Group {
  const g = new THREE.Group();
  const r = rng(4242);
  const R = 1e6;
  const tints = [[0.7, 0.8, 1], [1, 1, 1], [1, 0.95, 0.8], [1, 0.8, 0.6], [0.8, 0.88, 1]];
  const layer = (n: number, size: number, band: boolean, gain: number) => {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const v = new V3(), tilt = new THREE.Euler(1.05, 0, 0.4);
    for (let i = 0; i < n; i++) {
      if (band) {
        const a = r() * TAU;
        const spread = (r() + r() + r() - 1.5) * 0.22;
        v.set(Math.cos(a), spread, Math.sin(a)).normalize().applyEuler(tilt);
      } else {
        const y = r() * 2 - 1, a = r() * TAU, q = Math.sqrt(1 - y * y);
        v.set(q * Math.cos(a), y, q * Math.sin(a));
      }
      pos.set([v.x * R, v.y * R, v.z * R], i * 3);
      const t = tints[Math.floor(r() * tints.length)];
      const b = (0.25 + 0.75 * r() ** 3) * gain;
      col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true }));
    pts.frustumCulled = false;
    g.add(pts);
  };
  layer(5000, 1.4, false, 0.9);
  layer(500, 2.6, false, 1);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.9, 48, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  dome.rotation.set(1.05, 0, 0.4);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  g.add(dome);
  void loadTex(STARS).then((t) => {
    dome.material.map = t;
    dome.material.color.setScalar(0.75);
    dome.material.needsUpdate = true;
  });
  return g;
}
const sky = makeSky();
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
  gates: Thing[];
  star?: V3;
  maxSpeed: number;
  sky: boolean;
  bound?: number;
  lods: Lod[];
  tick: (t: number, dt: number) => void;
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
  const lod: Lod = { spec: b, pos, mat: new THREE.MeshBasicMaterial(), level: 0, photo };
  if (b.kind === 'star') {
    lod.mat.color.setScalar(1.7);
    holder.add(glowSprite(new THREE.Color(tex.palette[Math.floor(tex.palette.length / 2)][1]).lerp(new THREE.Color(0xffffff), 0.4), R * 9));
  } else {
    const mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, bumpScale: photo?.bumpScale ?? 3 });
    if (photo?.normal) mat.normalScale.set(1.6, 1.6);
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
  ctx.spin.push({ o: mesh, r: b.spin ?? 0.02 });
  if (kinds.clouds) {
    lod.clouds = new THREE.MeshStandardMaterial({ transparent: true, roughness: 1, depthWrite: false, envMapIntensity: 0 });
    const deck = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 96, 48), lod.clouds);
    tilt.add(deck);
    ctx.spin.push({ o: deck, r: (b.spin ?? 0.02) * 1.4 });
  }
  if (maps) applyMaps(lod, maps);
  if (photo) await showPhoto(lod, false);
  ctx.lods.push(lod);

  if (b.atmo) {
    const sunDir = pos.lengthSq() > 0 ? pos.clone().negate().normalize() : new V3(0, 1, 0);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(R * 1.015, 96, 48), new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(b.atmo) }, sunDir: { value: sunDir }, strength: { value: b.atmoK ?? 1 } },
      vertexShader: ATMO_V, fragmentShader: ATMO_F, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
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
      const a = r() * TAU, d = b.inner + (b.outer - b.inner) * (r() + r()) / 2;
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
  const rockMat = new THREE.MeshStandardMaterial({ color: b.color, roughness: 1, flatShading: true, envMapIntensity: 0 });
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
      range: b.range ?? Infinity, solid: true, nav: true, indent: !!b.parent, dock: b.dock,
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
  ctx.anim.push((dt) => traffic.tick(dt, ship.pos));
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
    id: spec.id, name: spec.name, subtitle: spec.subtitle, blurb: spec.blurb, group, labels, things, gates: [gth],
    star: new V3(), maxSpeed: 5000, sky: true, lods: ctx.lods,
    tick: (t, dt) => {
      for (const s of ctx.spin) s.o.rotation.y += s.r * dt;
      for (const a of ctx.anim) a(dt);
      for (const m of ctx.timed) m.uniforms.time.value = t;
    },
  };
}

async function buildSlowZone(): Promise<Space> {
  const group = new THREE.Group();
  const labels = document.createElement('div');
  const things: Thing[] = [];
  const ctx: BuildCtx = { spin: [], timed: [], anim: [], lods: [] };
  group.add(new THREE.AmbientLight(0x4a5f88, 0.5));
  group.add(new THREE.PointLight(0x7fb8ff, 3, 0, 0));

  // The station at the centre.
  const core = new THREE.Group();
  const tex = (await paintBody({ style: 'lava', palette: [[0, '#05080f'], [1, '#12203a']], seed: 808, scale: 3, accent: '#4fc0ff' }, 1024, 512))!;
  const mat = new THREE.MeshStandardMaterial({ map: canvasTex(tex.color), emissiveMap: canvasTex(tex.lights!), emissive: 0xffffff, emissiveIntensity: 1.6, roughness: 0.5, metalness: 0.3 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(45, 64, 32), mat);
  core.add(ball, glowSprite(0x3f9cff, 420, 0.8));
  group.add(core);
  ctx.spin.push({ o: ball, r: 0.02 });
  const station: Thing = {
    id: 'station', name: 'Ring Station', sub: 'Artefact · centre of the ring space', kind: 'artifact',
    desc: 'The sphere at the middle of everything. It holds the gates open and sets the speed limit in here — go too fast and it simply stops you.',
    pos: new V3(), radius: 45, range: Infinity, solid: true, nav: true, indent: false,
  };
  things.push(station);
  addLabel({ labels }, station, 'artifact');

  const medinaPos = new V3(330, 40, 150);
  const medina = buildModel('medina');
  medina.scale.setScalar(16);
  medina.position.copy(medinaPos);
  medina.rotation.y = 0.7;
  group.add(medina);
  ctx.anim.push(medina.userData.anim);
  const mth: Thing = {
    id: 'medina', name: 'Medina Station', sub: 'Station · the only port in the ring space', kind: 'station',
    desc: 'Built as a generation ship, refitted as a warship, and now the traffic control and trading post for thirteen hundred worlds.',
    pos: medinaPos, radius: 7, range: Infinity, solid: true, nav: true, indent: false, dock: 'medina',
  };
  things.push(mth);
  addLabel({ labels }, mth, 'station');

  // Here a unit is about 125 m: Medina is two kilometres across and the ships round it a few tens of metres to a few hundred.
  const crowd = makeTraffic([
    { ports: [{ pos: medinaPos, inner: 14, outer: 70 }], n: 80 },
    { ports: [{ pos: medinaPos, inner: 14, outer: 40 }, { pos: new V3(), inner: 70, outer: 160 }], n: 25 },
  ], 4242, 1 / 125, 80);
  group.add(crowd.group);
  ctx.anim.push((dt) => crowd.tick(dt, ship.pos));

  // The gates.
  const R = 28;
  const torus = new THREE.InstancedMesh(
    new THREE.TorusGeometry(R, R * 0.06, 8, 40),
    new THREE.MeshStandardMaterial({ color: 0x56687c, emissive: 0x0d3355, metalness: 0.7, roughness: 0.4 }),
    GATE_COUNT,
  );
  const film = new THREE.InstancedMesh(
    new THREE.CircleGeometry(R * 0.94, 32),
    new THREE.MeshBasicMaterial({ color: 0x1a4a88, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }),
    GATE_COUNT,
  );
  const dots = new Float32Array(GATE_COUNT * 3), cols = new Float32Array(GATE_COUNT * 3);
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
  // The racer that found the speed limit, still hanging where the station stopped it.
  const yq: Thing = {
    id: 'yque', name: 'Y Que', sub: 'Slingshot racer · derelict', kind: 'ship',
    desc: 'A Belter kid\'s home-built racer. He aimed it through the Sol Ring at full burn to impress a girl. The ship was stopped dead in an instant; he was not. That was how everyone learned there is a speed limit in here.',
    pos: gates[0].pos.clone().multiplyScalar(0.975).add(new V3(18, 0, 9)), radius: 1.2, range: 1500, solid: true, nav: true, indent: true,
  };
  const wreck = buildModel('wreck');
  wreck.scale.setScalar(3);
  wreck.position.copy(yq.pos);
  wreck.rotation.set(0.6, 1.1, 0.3);
  group.add(wreck);
  things.push(yq);
  addLabel({ labels }, yq, 'ship');

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

  return {
    id: 'slow', name: 'The Ring Space', subtitle: `${GATE_COUNT} gates · no stars`,
    blurb: 'A starless bubble a million kilometres across. Every light on the wall is a door to another sun.',
    group, labels, things, gates, maxSpeed: 500, sky: false, bound: SLOW_RADIUS + 160, lods: [],
    tick: (_t, dt) => {
      for (const s of ctx.spin) s.o.rotation.y += s.r * dt;
      for (const a of ctx.anim) a(dt);
    },
  };
}

// ------------------------------------------------------------------ ship

/** Your ship is about 30 m long, so the chase camera rides a few hundred metres behind it. */
const SHIP_SCALE = 2e-7;
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
let auto: { thing: Thing; point: V3; phase: 'cruise' | 'face' } | null = null;
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
const walker = { x: 0, z: 0, yaw: 0, pitch: 0, bob: 0 };
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
  if (space) {
    scene.remove(space.group);
    space.labels.remove();
    if (!cache.has(space.id)) disposeSpace(space);
  }
  space = s;
  scene.add(s.group);
  labelRoot.append(s.labels);
  sky.visible = s.sky;
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
  auto = { thing: th, point: viewpoint(th), phase: 'cruise' };
  ship.throttle = 0;
}

function placeAt(th: Thing) {
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

async function transit(g: Thing) {
  if (busy || !g.to) return;
  busy = true;
  auto = null;
  const flash = $('flash');
  flash.classList.add('on');
  await pause(450);
  loadingEl.textContent = '';
  const next = await getSpace(g.to.space);
  enter(next);
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
  banner(next.id === 'slow' ? next.name : `${next.name} system`, next.blurb);
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
  if ((e.target as HTMLElement).closest('#nav')) return;
  if (walk) return;
  auto = null;
  ship.throttle = clamp(ship.throttle - Math.sign(e.deltaY) * 0.04, -0.3, 1);
}, { passive: true });

const STEER = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyX', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.metaKey || e.ctrlKey) return;
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
  if (STEER.includes(e.code)) auto = null;
  switch (e.code) {
    case 'Tab':
    case 'KeyN':
      e.preventDefault();
      document.body.classList.toggle('nav-open');
      if (document.body.classList.contains('nav-open')) document.exitPointerLock();
      break;
    case 'KeyX': ship.throttle = 0; break;
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
      el.addEventListener('click', () => Object.assign(walker, { x: pl.x, z: pl.z, yaw: pl.yaw, pitch: 0 }));
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
    if (th.kind !== 'gate' || th.range > 0 || dist < 500) {
      const score = (dist - th.radius) / (th.kind === 'gate' ? 1 : Math.max(1, th.radius));
      if (score < nd) { nd = score; nearest = th; }
    }
  }
  return cap;
}

function autopilot(dt: number, cap: number) {
  const ap = auto!;
  const fwd = _b.set(0, 0, -1).applyQuaternion(ship.q);
  if (ap.phase === 'face') {
    ship.speed *= Math.exp(-8 * dt);
    const dir = ap.thing.pos.clone().sub(ship.pos).normalize();
    faceShip(dir, 2.6 * dt);
    if (fwd.dot(dir) > 0.9997) auto = null;
    return;
  }
  const to = _a.copy(ap.point).sub(ship.pos);
  const dist = to.length();
  if (dist < 0.02 * ap.thing.radius) {
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
  const target = Math.min(cap, dist * 2.2) * (align > 0.9 ? 1 : align > 0.5 ? 0.2 : 0);
  ship.speed += (target - ship.speed) * (1 - Math.exp(-4 * dt));
  ship.speed = Math.min(ship.speed, cap, dist / dt);
  ship.pos.addScaledVector(fwd, ship.speed * dt);
}

function step(dt: number) {
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
  } else {
    if (yaw) ship.q.multiply(_q.setFromAxisAngle(_a.set(0, 1, 0), yaw));
    if (pitch) ship.q.multiply(_q.setFromAxisAngle(_a.set(1, 0, 0), pitch));
    if (roll) ship.q.multiply(_q.setFromAxisAngle(_a.set(0, 0, 1), roll));
    ship.q.normalize();
    if (keys.has('KeyW')) ship.throttle = clamp(ship.throttle + 0.4 * dt, -0.3, 1);
    if (keys.has('KeyS')) ship.throttle = clamp(ship.throttle - 0.4 * dt, -0.3, 1);
    const target = clamp(speedFor(ship.throttle), -cap, cap);
    ship.speed += (target - ship.speed) * (1 - Math.exp(-3.5 * dt));
    ship.speed = clamp(ship.speed, -cap, cap);
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
  ship.throttle = ship.speed = 0;
  await fade(async () => {
    loadingEl.textContent = 'Docking…';
    const it = await buildInterior(th.dock!);
    it.scene.environment = envMap;
    it.scene.environmentIntensity = 0.3;
    walk = it;
    Object.assign(walker, { x: it.spawn.x, z: it.spawn.z, yaw: it.spawn.yaw, pitch: 0 });
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
  if ((f || r) && !busy) {
    const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const v = (run ? (it.curveR ? 18 : 10) : 4.2) * dt / Math.hypot(f, r);
    const sin = Math.sin(walker.yaw), cos = Math.cos(walker.yaw);
    const dx = (-sin * f + cos * r) * v, dz = (-cos * f - sin * r) * v;
    if (it.free(walker.x + dx, walker.z)) walker.x += dx;
    if (it.free(walker.x, walker.z + dz)) walker.z += dz;
    walker.bob += dt * (run ? 13 : 8);
  }
  const eye = 1.7 + Math.sin(walker.bob) * 0.03;
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
  $('mode').textContent = auto ? `AUTOPILOT → ${auto.thing.name}` : ship.throttle < 0 ? 'REVERSE' : 'MANUAL';
  $('mode').classList.toggle('auto', !!auto);

  const near = nearest as Thing | null;
  const close = near && near.pos.distanceTo(ship.pos) < near.radius * 10 + 30 ? near : null;
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

function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  if (!space) return;
  if (walk) {
    walkStep(dt);
    updateHud(dt);
    draw(walk.scene, walkCam);
    return;
  }
  if (!busy && started) step(dt);
  lodTick();

  shipModel.position.copy(ship.pos);
  shipModel.quaternion.copy(ship.q);
  shipModel.visible = chase;
  const thrust = clamp(Math.abs(ship.speed) / Math.max(1, space.maxSpeed) * 6 + Math.abs(ship.throttle), 0, 1);
  plume.scale.set(1, 1, 0.15 + thrust * 1.6 + Math.sin(clock * 40) * 0.04);
  (plume.material as THREE.MeshBasicMaterial).opacity = 0.12 + thrust * 0.45;

  camQ.slerp(ship.q, 1 - Math.exp(-9 * dt));
  _lookQ.copy(camQ)
    .multiply(_q.setFromAxisAngle(_a.set(0, 1, 0), lookYaw))
    .multiply(_q.setFromAxisAngle(_a.set(1, 0, 0), lookPitch));
  if (chase) _off.set(0, 1.5, 6.4).multiplyScalar(SHIP_SCALE);
  else _off.set(0, 0.06, -0.9).multiplyScalar(SHIP_SCALE);
  camera.position.copy(ship.pos).add(_off.applyQuaternion(_lookQ));
  camera.quaternion.copy(_lookQ);
  camera.updateMatrixWorld();
  sky.position.copy(camera.position);

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
  updateLabels();
  updateHud(dt);
  draw(scene, camera);
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
  loadingEl.textContent = '';
  busy = false;
  $('launch').removeAttribute('disabled');
  $('launch').textContent = 'Launch';
}

$('launch').addEventListener('click', () => {
  started = true;
  document.body.classList.add('started');
  banner(space.id === 'slow' ? space.name : `${space.name} system`, space.blurb);
  canvas.requestPointerLock()?.catch?.(() => {});
});

requestAnimationFrame(frame);
void boot();
