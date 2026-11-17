// People with a skeleton (trial, 2026-11-17). One body made in Blender (tools/blender/person.py)
// with three clips: idle, walk and lope. The clips are blended by weight and faded into one
// another, after the three.js "skinning blending" example (MIT). Two rules keep it believable:
//   - walk and lope are both one-second cycles, so they can be mixed by weight and stay in step;
//   - the playback speed comes from how fast the person moves, so the feet don't slide.

import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import personGlb from '../assets/models/person.glb';
import { CIVIL, HAIR, SKIN, WORK } from './people';

type Rand = () => number;
const pick = <T,>(r: Rand, a: T[]): T => a[Math.floor(r() * a.length)];

let file: GLTF | null = null;

/** Load the body once at start-up. If it fails, interiors keep the old people. */
export async function loadPeople() {
  try {
    file = await new GLTFLoader().loadAsync(personGlb);
  } catch (e) {
    console.warn('The skinned person did not load; keeping the simple people.', e);
  }
}
export const peopleReady = () => !!file;

// One gait cycle (two steps) on Earth-normal legs, and the long Belter lope in low gravity.
const WALK = { stride: 1.45, period: 1.08 };
const LOPE = { stride: 2.35, period: 1.5 };
const FADE = 0.5;

export interface Walker {
  group: THREE.Group;
  update(dt: number): void;
}

export interface WalkerOpts {
  belter?: boolean;
  /** 0 = Earth walk, 1 = full Belter lope. Set from the local gravity. */
  lope?: number;
  /** Distance to pace each way. 0 stands still. */
  beat?: number;
  plain?: boolean;
}

export function buildWalker(r: Rand, x: number, z: number, yaw: number, o: WalkerOpts = {}): Walker | null {
  if (!file) return null;
  const root = clone(file.scene) as THREE.Group;
  const group = new THREE.Group();
  group.add(root);

  // Clothes and colouring for this person.
  const colours: Record<string, number> = {
    skin: pick(r, SKIN), hair: pick(r, HAIR), shirt: pick(r, o.plain ? CIVIL : WORK),
    trousers: pick(r, [0x23262c, 0x2f3540, 0x3b3530, 0x4a4f58, 0x1d2a38]), boots: pick(r, [0x0f0e0e, 0x2a1d14, 0x3a3a3a]),
  };
  const made = new Map<string, THREE.MeshStandardMaterial>();
  root.traverse((n) => {
    const m = n as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    const src = m.material as THREE.MeshStandardMaterial;
    let mat = made.get(src.name);
    if (!mat) {
      mat = src.clone();
      if (colours[src.name] !== undefined) mat.color.setHex(colours[src.name]);
      made.set(src.name, mat);
    }
    m.material = mat;
    m.castShadow = true;
  });

  // Belters: tall and slight. Everyone else a little variety in height and build.
  const h = (o.belter ? 1.13 : 1) * (0.93 + r() * 0.13);
  const w = (o.belter ? 0.86 : 0.95 + r() * 0.12) * h;
  group.scale.set(w, h, w);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;

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

  const beat = o.beat ?? 0;
  if (beat <= 0) return { group, update: (dt) => mixer.update(dt) };

  // Pace a line: walk to the far end, ease to a stop, stand a moment, turn round, set off again.
  const start = new THREE.Vector3(x, 0, z);
  let dir = 1, travelled = 0, state: 'stand' | 'turn' | 'walk' | 'stop' = 'stand', wait = r() * 3, turned = 0, mustTurn = false;
  const go = () => {
    // Fade from standing into the stride. Both gait clips restart together so they stay in step.
    walk.reset(); lope.reset();
    walk.weight = 1 - k; lope.weight = k;
    walk.setEffectiveTimeScale(1 / period); lope.setEffectiveTimeScale(1 / period);
    walk.play().fadeIn(FADE); lope.play().fadeIn(FADE);
    idle.fadeOut(FADE);
    state = 'walk';
  };
  const halt = () => {
    walk.fadeOut(FADE); lope.fadeOut(FADE);
    idle.enabled = true; idle.weight = 1;
    idle.fadeIn(FADE);
    state = 'stop';
  };
  // How far you travel while the stride fades out, so the stop lands on the end mark.
  const stopDist = (speed * FADE) / 2;

  const update = (dt: number) => {
    mixer.update(dt);
    // Move only as much as the legs are walking: no gliding while the stride fades in or out.
    const g = walk.getEffectiveWeight() + lope.getEffectiveWeight();
    const step = speed * Math.min(1, g) * dt;
    if (state === 'walk' || state === 'stop') {
      travelled += step;
      group.position.x += Math.sin(group.rotation.y) * step;
      group.position.z += Math.cos(group.rotation.y) * step;
    }
    if (state === 'walk' && travelled >= beat - stopDist) halt();
    else if (state === 'stop' && g < 0.01) { state = 'stand'; wait = 1.5 + r() * 3.5; mustTurn = true; }
    else if (state === 'stand' && (wait -= dt) <= 0) {
      if (mustTurn) { state = 'turn'; turned = 0; } else go();
    }
    else if (state === 'turn') {
      const a = Math.min(Math.PI - turned, dt * 3.2);
      group.rotation.y += a;
      turned += a;
      if (turned >= Math.PI - 1e-3) {
        dir = -dir; travelled = 0;
        // Correct drift so the walker paces the same line for ever.
        const end = dir > 0 ? 0 : beat;
        group.position.set(start.x + Math.sin(yaw) * end, 0, start.z + Math.cos(yaw) * end);
        group.rotation.y = dir > 0 ? yaw : yaw + Math.PI;
        go();
      }
    }
  };
  // Start some already walking.
  if (r() < 0.6) go();
  return { group, update };
}
