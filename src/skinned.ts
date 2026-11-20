// People with a skeleton (2026-11-17). One body made in Blender (tools/blender/person.py)
// with three clips: idle, walk and lope. The clips are blended by weight and faded into one
// another, after the three.js "skinning blending" example (MIT). Two rules keep it believable:
//   - walk and lope are both one-second cycles, so they can be mixed by weight and stay in step;
//   - the playback speed comes from how fast the person moves, so the feet don't slide.

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import personGlb from '../assets/models/person.glb';
import { CIVIL, HAIR, NEON, NEON_HAIR, SKIN, STREET, WORK } from './people';

type Rand = () => number;
const pick = <T,>(r: Rand, a: T[]): T => a[Math.floor(r() * a.length)];

let file: GLTF | null = null;

/** With ?debug in the address, walkers report where they are and what they're doing (for tests). */
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
const debugList: { name: string; get: () => { x: number; z: number; yaw: number; state: string; leg: number } }[] = [];
export const debugging = DEBUG;
if (DEBUG) (globalThis as unknown as { __walkers: typeof debugList }).__walkers = debugList;

// The body arrives as one mesh per material, named `part` or `part@tag` (see person.py). The part
// says which palette colour paints it; a tag marks an optional piece (a hair style, the jacket,
// the cap, long sleeves or bare forearms). Each person keeps the untagged pieces plus the tags
// chosen for them, merged into a single mesh with a per-vertex part number: one draw call per
// person, coloured from a small palette. People who chose the same pieces share one geometry.
const PARTS = ['skin', 'shirt', 'trousers', 'boots', 'hair', 'eyes', 'jacket', 'cap', 'stubble', 'lips'] as const;
type Part = (typeof PARTS)[number];
const ROUGH: Record<Part, number> = { skin: 0.72, shirt: 0.85, trousers: 0.88, boots: 0.55, hair: 0.9, eyes: 0.2, jacket: 0.7, cap: 0.85, stubble: 0.75, lips: 0.55 };
let base: THREE.MeshStandardMaterial | null = null;
const pieces: { geo: THREE.BufferGeometry; tag: string }[] = [];
const wardrobe = new Map<string, THREE.BufferGeometry>();
/** Which of the file's two shapes is which build (the file names them). */
const build = { heavy: 0, curvy: 1 };

function mergeBody(scene: THREE.Group) {
  const parts: THREE.SkinnedMesh[] = [];
  scene.traverse((n) => { if ((n as THREE.SkinnedMesh).isSkinnedMesh) parts.push(n as THREE.SkinnedMesh); });
  for (const m of parts) {
    const g = m.geometry.clone();
    const [part, tag = ''] = (m.material as THREE.Material).name.split('@');
    const n = g.attributes.position.count;
    // The baked shade arrives as a vertex colour; one number per vertex is all it holds.
    const col = g.attributes.color;
    const shade = new Float32Array(n).fill(1);
    if (col) for (let i = 0; i < n; i++) shade[i] = col.getX(i);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
    g.setAttribute('shade', new THREE.BufferAttribute(shade, 1));
    g.setAttribute('part', new THREE.BufferAttribute(new Float32Array(n).fill(Math.max(0, PARTS.indexOf(part as Part))), 1));
    pieces.push({ geo: g, tag });
  }
  const first = parts[0];
  build.heavy = first.morphTargetDictionary?.heavy ?? 0;
  build.curvy = first.morphTargetDictionary?.curvy ?? 1;
  const body = new THREE.SkinnedMesh(bodyFor(['crop', 'sleeve']), new THREE.MeshStandardMaterial());
  body.name = 'body';
  body.bind(first.skeleton, first.bindMatrix);
  first.parent!.add(body);
  for (const m of parts) m.removeFromParent();
  base = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 });
}

/** Builds on offer: how much of the `heavy` and `curvy` shapes (below zero is a slighter frame). */
const HEAVY = [-0.4, 0, 0.45, 1], CURVY = [0, 0.75];

/** The body wearing the chosen optional pieces in one of the builds, made the first time someone
 *  asks for that combination. The build is worked into the vertex positions here, once, rather
 *  than blended by the graphics card on every frame for every person: in a crowd of 130 the
 *  blending cost about a millisecond a frame (measured 2026-11-19). */
function bodyFor(tags: string[], heavy = 1, curvy = 0) {
  const key = `${[...tags].sort().join(' ')}|${heavy}|${curvy}`;
  let g = wardrobe.get(key);
  if (!g) {
    g = mergeGeometries(pieces.filter((p) => !p.tag || tags.includes(p.tag)).map((p) => p.geo), false)!;
    const shapes = g.morphAttributes.position;
    if (shapes && shapes.length > 1) {
      const pos = g.attributes.position.array as Float32Array;
      const a = shapes[build.heavy].array, b = shapes[build.curvy].array;
      const h = HEAVY[heavy], c = CURVY[curvy];
      for (let i = 0; i < pos.length; i++) pos[i] += a[i] * h + b[i] * c;
    }
    g.morphAttributes = {};
    wardrobe.set(key, g);
  }
  return g;
}

/** One material per person, sharing one compiled shader: the colour and roughness come from a
 *  palette indexed by the vertex's part number. The baked shade darkens creases (armpits, under
 *  the chin, under hems and hair): fully in ambient light, partly in direct light. On skin the
 *  shade turns a little red rather than grey, as light does that has passed through flesh. */
function personMaterial(colours: Record<Part, number>) {
  const m = base!.clone();
  const n = PARTS.length;
  const palette = { value: PARTS.map((p) => new THREE.Color(colours[p])) };
  const rough = { value: PARTS.map((p) => ROUGH[p]) };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.palette = palette;
    sh.uniforms.pRough = rough;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float part;\nattribute float shade;\nvarying float vPart;\nvarying float vShade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPart = part;\nvShade = shade;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 palette[${n}];\nuniform float pRough[${n}];\nvarying float vPart;\nvarying float vShade;`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', [
        'int pi = int(vPart + 0.5);',
        'float fleshy = (pi == 0 || pi >= 8) ? 1.0 : 0.0;',
        'float crease = 1.0 - clamp(vShade, 0.0, 1.0);',
        'vec4 diffuseColor = vec4( palette[pi] * mix(vec3(1.0), vec3(1.0, 0.74, 0.64), crease * fleshy), opacity );',
      ].join('\n'))
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = pRough[pi];')
      .replace('#include <aomap_fragment>', [
        '#include <aomap_fragment>',
        'float pShade = 1.0 - crease * 0.9;',
        'reflectedLight.indirectDiffuse *= pShade * mix(vec3(1.0), vec3(1.05, 1.0, 0.94), fleshy);',
        'reflectedLight.indirectSpecular *= pShade;',
        'reflectedLight.directDiffuse *= mix(1.0, pShade, 0.55);',
        'reflectedLight.directSpecular *= mix(1.0, pShade, 0.55);',
      ].join('\n'));
  };
  m.customProgramCacheKey = () => 'person-palette';
  return m;
}

/** A private dice for one person's looks, seeded from where they stand. The shared dice that lays
 *  out each room is left alone, so adding choices here never moves the furniture. */
function dice(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const JACKET = [0x2a2420, 0x3a2c22, 0x1c1f24, 0x2d3338, 0x4a4034, 0x39402f, 0x4a2a24, 0x565a60, 0x23303a];
const CAP = [0x1c1f24, 0x3a3f4a, 0x6a2f2a, 0x2e3b36, 0x403a2a, 0x8a5a2a, 0x33506a];
/** Hair styles and how common each is. `tags` are the pieces of the model the style uses. */
const STYLES: { tags: string[]; share: number; cap: boolean; beard: number }[] = [
  { tags: ['crop'], share: 0.27, cap: true, beard: 0.3 },
  { tags: ['shaved'], share: 0.12, cap: true, beard: 0.35 },
  { tags: ['long'], share: 0.16, cap: false, beard: 0.04 },
  { tags: ['crop', 'pony'], share: 0.13, cap: true, beard: 0.04 },
  { tags: ['crop', 'bun'], share: 0.08, cap: false, beard: 0.06 },
  { tags: ['curls'], share: 0.17, cap: false, beard: 0.2 },
  { tags: [], share: 0.07, cap: true, beard: 0.4 },   // bald
];

/** Load the body once at start-up. If it fails, interiors keep the old people. */
export async function loadPeople() {
  try {
    file = await new GLTFLoader().loadAsync(personGlb);
    mergeBody(file.scene);
    // The clips only ever turn bones and move the hips. Dropping the tracks that hold everything
    // else still (bone sizes and positions) saves work for every person on every frame, and
    // leaves bone sizes free to differ from person to person.
    for (const c of file.animations) c.tracks = c.tracks.filter((t) => t.name.endsWith('.quaternion') || t.name === 'hips.position');
  } catch (e) {
    file = null;
    console.warn('The skinned person did not load; keeping the simple people.', e);
  }
}
export const peopleReady = () => !!file;

// One gait cycle (two steps) on Earth-normal legs, and the long Belter lope in low gravity.
const WALK = { stride: 1.45, period: 1.08 };
const LOPE = { stride: 2.35, period: 1.5 };
const FADE = 0.5;
/** Gap between the two lanes a walker paces, the share of turns that start from a standstill,
 *  and how much they slow down in the turn. */
const LANE = 0.9, STOP_P = 0.4, TURN_PACE = 0.65;
/** Getting round each other. A walker looks LOOK metres ahead; anything nearer its line than GAP
 *  is in the way, and it drifts sideways (up to SIDE metres, at DRIFT m/s) to pass. If the thing
 *  is still dead ahead inside NEAR metres it slows, and stops at STOP metres. */
const LOOK = 2.6, GAP = 0.7, SIDE = 0.75, DRIFT = 0.9, NEAR = 1.15, STOP = 0.55;
/** How fast someone following a route swings round to their next point (radians a second). */
const SWING = 2.4;
const wrapA = (a: number) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** What a person can sense of the place around them. The interior fills this in and hands it to
 *  everyone on each update (see Kit.tick in interior.ts). All positions are floor coordinates. */
export interface Around {
  /** Where you are standing. */
  px: number;
  pz: number;
  /** Look ahead for someone at (x, z) heading `yaw`. `a` is how many metres ahead the nearest
   *  person (or you) squarely in their way is, Infinity if nobody; `ls` lists how far to their
   *  left (minus for right) each of the first `n` people in front of them is, in the way or
   *  near enough to matter when stepping aside. */
  ahead(x: number, z: number, yaw: number): void;
  a: number;
  n: number;
  ls: Float32Array;
  /** Which person is being updated (set by the interior), so they do not see themselves. */
  self: number;
  free(x: number, z: number): boolean;
}

export interface Walker {
  group: THREE.Group;
  body: THREE.SkinnedMesh;
  update(dt: number, around?: Around): void;
  /** Where they are on the floor and which way they face. In a drum the model itself is wrapped
   *  round the hull, so this is the only place the flat position is kept. */
  flat: { x: number; z: number; yaw: number };
  /** What they are doing: 'stand', 'walk', 'turn', 'stop' (slowing to a halt) or 'yield' (waiting
   *  for someone to get out of the way). */
  state(): string;
  /** True from being sent somewhere until they have arrived and stopped. */
  busy(): boolean;
  /** Walk through these points and stop on the last, then turn to `face`. `polite` people only
   *  slow down for others and never step sideways (a queue). `done` is called on arrival. */
  walkTo(path: { x: number; z: number }[], o?: { face?: number; polite?: boolean; done?: () => void }): void;
  /** Pick them up and put them down somewhere else, standing. */
  setPose(x: number, z: number, yaw: number): void;
  /** Join a conversation: `slot` of `of` people who take turns speaking, one round every `period` seconds. */
  talk(slot: number, of: number, period: number): void;
}

export interface WalkerOpts {
  belter?: boolean;
  /** 0 = Earth walk, 1 = full Belter lope. Set from the local gravity. */
  lope?: number;
  /** Distance to pace each way. 0 stands still. */
  beat?: number;
  /** Which side the return lane is on: 1 or -1 (towards the walker's left or right). */
  lane?: 1 | -1;
  plain?: boolean;
  /** Clothes for the neon districts: dark streetwear, now and then a bright shirt or dyed hair. */
  street?: boolean;
}

export function buildWalker(r: Rand, x: number, z: number, yaw: number, o: WalkerOpts = {}): Walker | null {
  if (!file) return null;
  const root = clone(file.scene) as THREE.Group;
  const group = new THREE.Group();
  group.add(root);

  // Clothes and colouring for this person.
  const neonHair = o.street && r() < 0.12;
  const colours: Record<Part, number> = {
    skin: pick(r, SKIN),
    // Dyed, not lit: neon shades a little darker, so they read as hair rather than a lamp.
    hair: neonHair ? new THREE.Color(pick(r, NEON_HAIR)).multiplyScalar(0.7).getHex() : pick(r, HAIR),
    // A bright dyed shirt, not a lit sign: neon shades at about 40% so bloom leaves them alone.
    shirt: o.plain ? pick(r, CIVIL) : o.street ? (r() < 0.15 ? new THREE.Color(pick(r, NEON)).multiplyScalar(0.4).getHex() : pick(r, STREET)) : pick(r, WORK),
    trousers: pick(r, [0x23262c, 0x2f3540, 0x3b3530, 0x4a4f58, 0x1d2a38]),
    boots: pick(r, [0x0f0e0e, 0x2a1d14, 0x3a3a3a]),
    eyes: 0x060608,
    jacket: 0, cap: 0, stubble: 0, lips: 0,
  };
  // Everything below is chosen with this person's own dice (see `dice`).
  const q = dice(Math.imul(Math.round(x * 97) + 7919, 31) ^ Math.imul(Math.round(z * 89) + 104729, 17) ^ colours.skin ^ (colours.shirt << 3));
  colours.jacket = pick(q, JACKET);
  colours.cap = o.street && q() < 0.25 ? new THREE.Color(pick(q, NEON)).multiplyScalar(0.4).getHex() : pick(q, CAP);
  const skin = new THREE.Color(colours.skin);
  colours.stubble = skin.clone().lerp(new THREE.Color(colours.hair), neonHair ? 0.25 : 0.38).getHex();
  colours.lips = skin.clone().multiply(new THREE.Color(0.86, 0.62, 0.62)).getHex();

  // Hair, a beard, a cap, a jacket, sleeves.
  let roll = q();
  const style = STYLES.find((s) => (roll -= s.share) < 0) ?? STYLES[0];
  const tags = [...style.tags];
  if (q() < style.beard) tags.push('beard');
  if (style.cap && q() < 0.14) tags.push('cap');
  // Under a jacket the forearms are out of sight either way, so neither sleeve piece is drawn.
  if (q() < (o.plain ? 0.28 : 0.4)) tags.push('jacket');
  else tags.push(q() < 0.36 ? 'bare' : 'sleeve');
  let body!: THREE.SkinnedMesh;
  root.traverse((n) => { if ((n as THREE.SkinnedMesh).isSkinnedMesh) body = n as THREE.SkinnedMesh; });
  // Build: one of a few body shapes; Belters keep to the slighter ones. Height and width (below)
  // vary continuously on top.
  const heavy = o.belter ? (q() < 0.7 ? 0 : 1) : Math.min(HEAVY.length - 1, Math.floor(q() ** 1.5 * HEAVY.length));
  const curvy = q() < 0.42 ? 1 : 0;
  body.geometry = bodyFor(tags, heavy, curvy);
  body.material = personMaterial(colours);
  body.castShadow = true;
  body.receiveShadow = true;

  // Belters: tall and slight. Everyone else a little variety in height and build.
  const h = (o.belter ? 1.13 : 1) * (0.93 + r() * 0.13);
  const w = (o.belter ? 0.86 : 0.95 + r() * 0.12) * h;
  group.scale.set(w, h, w);
  // Heads keep their own width whatever the body's, and vary a little.
  const head = root.getObjectByName('head');
  if (head) {
    const k = 0.96 + q() * 0.09, across = (k * h) / w;
    head.scale.set(across, k, across);
  }
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  const flat = { x, z, yaw };

  // Two extra joints, one under the neck and one under the head, that nothing in the clips
  // touches. Turning them turns the head on top of whatever the clip is doing, with no need to
  // undo it afterwards. (The clips only turn bones, so a bone's position is ours to move.)
  const joint = (name: string) => {
    const b = root.getObjectByName(name);
    if (!b || !b.parent) return null;
    const j = new THREE.Object3D();
    j.position.copy(b.position);
    b.parent.add(j);
    j.add(b);
    b.position.set(0, 0, 0);
    return j;
  };
  const neckTurn = joint('neck'), headTurn = joint('head');

  const mixer = new THREE.AnimationMixer(root);
  const clip = (n: string) => mixer.clipAction(THREE.AnimationClip.findByName(file!.animations, n)!);
  const idle = clip('idle'), walk = clip('walk'), lope = clip('lope');

  const k = Math.min(1, Math.max(0, o.lope ?? 0));
  const period = (WALK.period + (LOPE.period - WALK.period) * k) * (0.94 + r() * 0.12) * Math.sqrt(h);
  const speed = ((WALK.stride + (LOPE.stride - WALK.stride) * k) * h) / period;
  walk.setEffectiveTimeScale(1 / period);
  lope.setEffectiveTimeScale(1 / period);

  idle.play();
  idle.time = r() * idle.getClip().duration;

  // ---- walking. Everyone can walk; who does, and where, is decided below and by the interior.
  const beat = o.beat ?? 0;
  type State = 'stand' | 'turn' | 'walk' | 'stop' | 'yield';
  let state: State = 'stand';
  /** Once someone has walked, their model follows `pos`; until then it stays where it was put. */
  let mobile = beat > 0;
  /** The line they are walking, before any sidestep (`off`, metres to their left). */
  const pos = new THREE.Vector3(x, 0, z);
  let off = 0, slow = 1, cap = Infinity, held = 0;
  const patience = 2.5 + q() * 2.5;
  const pace = (f: number) => { walk.setEffectiveTimeScale(f / period); lope.setEffectiveTimeScale(f / period); };
  const go = () => {
    // Fade from standing into the stride. Both gait clips restart together so they stay in step.
    walk.reset(); lope.reset();
    walk.weight = 1 - k; lope.weight = k;
    pace(1);
    walk.play().fadeIn(FADE); lope.play().fadeIn(FADE);
    idle.fadeOut(FADE);
    state = 'walk';
  };
  const halt = (to: State = 'stop') => {
    walk.fadeOut(FADE); lope.fadeOut(FADE);
    idle.enabled = true; idle.weight = 1;
    idle.fadeIn(FADE);
    state = to;
  };
  // How far you travel while the stride fades out, so the stop lands on the end mark.
  const stopDist = (speed * FADE) / 2;
  const striding = () => Math.min(1, walk.getEffectiveWeight() + lope.getEffectiveWeight());
  const advance = (step: number) => {
    pos.x += Math.sin(group.rotation.y) * step;
    pos.z += Math.cos(group.rotation.y) * step;
  };

  /** Look ahead. Sets `slow` (1 = carry on, 0 = stop) and `cap` (how far they may move this
   *  update, so a long step never lands on someone). With `step` 'aside' they also drift to one
   *  side of whoever is in the way: to the nearest place beside their own line that clears
   *  everyone ahead, preferring the right when it is much the same, so two people meeting
   *  head-on each go to their own right and pass. Once past, or if their own line clears the
   *  others anyway, they drift back to it. 'hold' keeps whatever sidestep they have and 'back'
   *  returns to the line regardless. The drift is only as fast as the legs are moving, so nobody
   *  slides sideways while standing. */
  const sense = (dt: number, a: Around | undefined, g: number, step: 'aside' | 'hold' | 'back') => {
    slow = 1; cap = Infinity;
    let want = 0;
    if (a) {
      const yw = group.rotation.y;
      a.ahead(group.position.x, group.position.z, yw);
      if (a.n && step !== 'back') {
        want = off;
        if (step === 'aside') {
          // Try my own line, then a gap's width either side of each person ahead. `ls` holds
          // where they are to the left of me; add `off` for where they are from my line.
          let best = Infinity;
          const tryAt = (t: number) => {
            const cost = Math.abs(t) + (t > 0 ? 0.1 : 0);
            if (cost >= best || Math.abs(t) > SIDE) return;
            for (let i = 0; i < a.n; i++) if (Math.abs(t - off - a.ls[i]) < GAP - 0.02) return;
            if (t !== 0 && !a.free(pos.x + Math.cos(yw) * t, pos.z - Math.sin(yw) * t)) return;
            best = cost; want = t;
          };
          tryAt(0);
          for (let i = 0; i < a.n; i++) { tryAt(off + a.ls[i] - GAP); tryAt(off + a.ls[i] + GAP); }
        }
      }
      if (a.a < NEAR) { slow = clamp((a.a - STOP) / (NEAR - STOP), 0, 1); cap = Math.max(0, a.a - STOP); }
    }
    const d = DRIFT * g * dt;
    off += clamp(want - off, -d, d);
  };

  // ---- pacing a loop of two lanes: walk to the far end, U-turn in a small arc onto the next
  // lane, walk back, U-turn again. Now and then stop at the end, stand a while, then step off
  // into the turn. Someone in the way: go round; if that fails, wait; if that fails, turn back.
  const lane = (o.lane ?? 1) * LANE;
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); // turning +rotation.y swings towards here
  const start = new THREE.Vector3(x, 0, z);
  const turnR = Math.abs(lane) / 2;
  const turnSpin = Math.sign(lane);
  let leg = 0, turned = 0, wait = 0, pendingTurn = false, willStop = false;
  if (beat > 0) { wait = r() * 3; willStop = r() < STOP_P; }
  const startTurn = () => { state = 'turn'; turned = 0; pace(TURN_PACE); };
  const v = new THREE.Vector3();
  const along = () => v.copy(pos).sub(start).dot(fwd);
  const left = () => (leg === 0 ? beat - along() : along());

  const lanes = (dt: number, a?: Around) => {
    // Move only as much as the legs are walking: no gliding while the stride fades in or out.
    const g = striding();
    if (state === 'walk' || state === 'yield') sense(dt, a, g, state === 'walk' ? 'aside' : 'hold');
    // A turn is on known open floor: get back on the line for it, and never quite stop in it.
    else if (state === 'turn') { sense(dt, a, g, 'back'); slow = Math.max(0.3, slow); }
    const f = state === 'turn' ? TURN_PACE * slow : state === 'walk' || state === 'yield' ? slow : 1;
    const step = speed * g * dt * f;
    if (state !== 'stand') advance(state === 'turn' ? step : Math.min(step, cap));
    if (state === 'walk') {
      if (slow < 0.25) { halt('yield'); held = 0; }
      else {
        pace(Math.max(0.35, slow));
        // Begin the turn (or the stop) early enough that the arc ends on the line's end mark.
        if (left() <= turnR + (willStop ? stopDist : 0)) { if (willStop) halt(); else startTurn(); }
      }
    } else if (state === 'yield') {
      held += dt;
      if (slow > 0.9 && held > 0.6) go();
      else if (held > patience) { go(); startTurn(); }
    } else if (state === 'stop') {
      if (g < 0.01) { state = 'stand'; wait = 1.5 + r() * 3.5; pendingTurn = true; }
    } else if (state === 'stand') {
      if ((wait -= dt) <= 0) { go(); if (pendingTurn) startTurn(); pendingTurn = false; }
    } else {
      pace(TURN_PACE * slow);
      const t = Math.min(Math.PI - turned, step / turnR);
      group.rotation.y += t * turnSpin;
      turned += t;
      if (turned >= Math.PI - 1e-4) {
        // Square up on the new lane so small errors never add up.
        leg ^= 1;
        group.rotation.y = yaw + leg * Math.PI;
        const a0 = along();
        pos.copy(start).addScaledVector(fwd, a0).addScaledVector(side, leg ? lane : 0);
        // The sidestep was measured to the left of the old heading; keep it where it is.
        off = -off;
        pace(1);
        willStop = r() < STOP_P;
        state = 'walk';
      }
    }
  };

  // ---- following a route: the interior sends some people from place to place (through doors,
  // up to a stall, forward in a queue). They swing round towards each point in turn, slowing in
  // the swing, and stop on the last.
  let path: { x: number; z: number }[] | null = null, pi = 0;
  let face: number | null = null, polite = false, done: (() => void) | undefined;
  const arrive = () => {
    // By now the stride has faded (or is fading) into standing.
    state = 'stand';
    path = null;
    const cb = done;
    done = undefined;
    cb?.();
  };
  const route = (dt: number, a?: Around) => {
    const g = striding();
    if (state === 'walk' || state === 'yield') sense(dt, a, g, !polite && state === 'walk' ? 'aside' : 'hold');
    if (state === 'walk' && path) {
      const p = path[pi], dx = p.x - pos.x, dz = p.z - pos.z, d = Math.hypot(dx, dz), last = pi === path.length - 1;
      if (d < (last ? stopDist + 0.04 : 0.5)) {
        if (last) halt(); else pi++;
        return;
      }
      const err = wrapA(Math.atan2(dx, dz) - group.rotation.y);
      group.rotation.y += clamp(err, -SWING * dt, SWING * dt);
      if (slow < 0.25) { halt('yield'); held = 0; return; }
      const f = Math.max(0.3, slow * Math.max(0.3, Math.cos(err)));
      pace(f);
      advance(Math.min(speed * g * dt * f, cap));
    } else if (state === 'stop') {
      advance(speed * g * dt);
      if (g < 0.01) arrive();
    } else if (state === 'yield') {
      held += dt;
      if (slow > 0.9 && held > 0.6) go();
      // Still blocked: this will do. Stop here.
      else if (held > patience) arrive();
    } else if (face !== null) {
      const err = wrapA(face - group.rotation.y);
      group.rotation.y += clamp(err, -1.6 * dt, 1.6 * dt);
      if (Math.abs(err) < 0.01) face = null;
    }
  };

  // ---- the head: a glance at you now and then, and the nods and small gestures of talking.
  let gaze = 0, gazeOn = false, gazeT = q() * 4;
  let chat: { slot: number; of: number; period: number; t: number; e: number; ph: number; spine: THREE.Object3D | null; upper: THREE.Object3D | null; fore: THREE.Object3D | null } | null = null;
  const manner = (dt: number, a?: Around) => {
    if (!headTurn || !neckTurn) return;
    let want = 0, nod = 0, wag = 0;
    if (a) {
      const dx = a.px - flat.x, dz = a.pz - flat.z, d2 = dx * dx + dz * dz;
      if (d2 < 36) {
        // Which way you are from where they face. Nobody looks over their shoulder.
        const b = wrapA(Math.atan2(dx, dz) - flat.yaw);
        if ((gazeT -= dt) <= 0) {
          gazeOn = !gazeOn && d2 < 25 && Math.abs(b) < 1.8 && q() < (chat ? 0.3 : state === 'stand' ? 0.7 : 0.45);
          gazeT = gazeOn ? 1.2 + q() * 2.8 : 1.5 + q() * 4;
        }
        if (gazeOn && Math.abs(b) < 2.1) want = clamp(b, -1.1, 1.1); else gazeOn = false;
      } else gazeOn = false;
    }
    if (chat) {
      const c = chat, t = (c.t += dt);
      // Whose turn it is to speak goes round the group. The speaker moves more: the head bobs
      // with the words and a hand comes up; the others nod now and then.
      const turn = (t / c.period + c.slot / c.of) % 1 < 1 / c.of;
      c.e += ((turn ? 1 : 0) - c.e) * (1 - Math.exp(-dt * 3));
      const e = c.e;
      nod = e * (0.05 * Math.sin(t * 5.3 + c.ph) + 0.03 * Math.sin(t * 2.1)) + (1 - e) * 0.09 * Math.max(0, Math.sin(t * 0.9 + c.ph)) ** 3 * Math.sin(t * 6.5);
      wag = e * 0.1 * Math.sin(t * 1.3 + c.ph);
      // Weight shifting from foot to foot.
      c.spine?.rotation.set(0, 0.06 * Math.sin(t * 0.45 + c.ph), 0.025 * Math.sin(t * 0.31 + c.ph * 2));
      if (c.fore && c.upper) {
        const lift = e * Math.max(0, Math.sin(t * 0.8 + c.ph)) * (0.7 + 0.25 * Math.sin(t * 3.1 + c.ph));
        c.fore.rotation.x = lift;
        c.upper.rotation.x = -lift * 0.3;
      }
    }
    gaze += (want - gaze) * (1 - Math.exp(-dt * 5));
    neckTurn.rotation.y = (gaze + wag) * 0.35;
    headTurn.rotation.set(nod, (gaze + wag) * 0.65, 0);
  };

  const update = (dt: number, a?: Around) => {
    mixer.update(dt);
    if (beat > 0) lanes(dt, a);
    else if (mobile) route(dt, a);
    if (mobile) {
      const yw = group.rotation.y;
      group.position.set(pos.x + Math.cos(yw) * off, 0, pos.z - Math.sin(yw) * off);
      flat.x = group.position.x; flat.z = group.position.z; flat.yaw = yw;
    }
    manner(dt, a);
  };
  let listed = false;
  const list = () => {
    if (!DEBUG || listed) return;
    listed = true;
    debugList.push({ name: `${beat > 0 ? 'w' : 'r'}${debugList.length}`, get: () => ({ x: group.position.x, z: group.position.z, yaw: group.rotation.y, state, leg }) });
  };
  if (beat > 0) list();
  // Start some already walking.
  if (beat > 0 && r() < 0.6) go();
  return {
    group, body, update, flat,
    state: () => state,
    busy: () => path !== null,
    walkTo: (p, opt = {}) => {
      if (beat > 0 || !p.length) return;
      mobile = true;
      list();
      path = p; pi = 0;
      face = opt.face ?? null; polite = !!opt.polite; done = opt.done;
      if (state !== 'walk') go();
    },
    setPose: (px, pz, pyaw) => {
      pos.set(px, 0, pz);
      off = 0;
      group.position.copy(pos);
      group.rotation.y = pyaw;
      flat.x = px; flat.z = pz; flat.yaw = pyaw;
    },
    talk: (slot, of, per) => {
      // Most people talk with a hand, one or the other.
      const hand = q() < 0.75 ? (q() < 0.6 ? 'R' : 'L') : '';
      chat = { slot, of, period: per, t: q() * 20, e: 0, ph: q() * 6.28, spine: joint('spine'), upper: hand ? joint('upperarm_' + hand) : null, fore: hand ? joint('forearm_' + hand) : null };
      idle.timeScale = 0.8 + q() * 0.4;
    },
  };
}
