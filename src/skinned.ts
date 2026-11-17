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

/** With ?debug in the address, walkers report where they are and what they're doing (for tests). */
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');
const debugList: { name: string; get: () => { x: number; z: number; yaw: number; state: string; leg: number } }[] = [];
if (DEBUG) (globalThis as unknown as { __walkers: typeof debugList }).__walkers = debugList;

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
/** Gap between the two lanes a walker paces, the share of turns that start from a standstill,
 *  and how much they slow down in the turn. */
const LANE = 0.9, STOP_P = 0.4, TURN_PACE = 0.65;

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
  /** Which side the return lane is on: 1 or -1 (towards the walker's left or right). */
  lane?: 1 | -1;
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

  // Pace a loop of two lanes: walk to the far end, U-turn in a small arc onto the next lane,
  // walk back, U-turn again. Now and then stop at the end, stand a while, then step off into the turn.
  const lane = (o.lane ?? 1) * LANE;
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); // turning +rotation.y swings towards here
  const start = new THREE.Vector3(x, 0, z);
  const turnR = Math.abs(lane) / 2;
  const turnSpin = Math.sign(lane);
  let leg = 0, turned = 0, wait = r() * 3, pendingTurn = false, willStop = r() < STOP_P;
  let state: 'stand' | 'turn' | 'walk' | 'stop' = 'stand';
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
  const halt = () => {
    walk.fadeOut(FADE); lope.fadeOut(FADE);
    idle.enabled = true; idle.weight = 1;
    idle.fadeIn(FADE);
    state = 'stop';
  };
  const startTurn = () => { state = 'turn'; turned = 0; pace(TURN_PACE); };
  // How far you travel while the stride fades out, so the stop lands on the end mark.
  const stopDist = (speed * FADE) / 2;
  const v = new THREE.Vector3();
  const along = () => v.copy(group.position).sub(start).dot(fwd);
  const left = () => (leg === 0 ? beat - along() : along());

  const update = (dt: number) => {
    mixer.update(dt);
    // Move only as much as the legs are walking: no gliding while the stride fades in or out.
    const g = Math.min(1, walk.getEffectiveWeight() + lope.getEffectiveWeight());
    const step = speed * g * dt * (state === 'turn' ? TURN_PACE : 1);
    if (state !== 'stand') {
      group.position.x += Math.sin(group.rotation.y) * step;
      group.position.z += Math.cos(group.rotation.y) * step;
    }
    if (state === 'walk') {
      // Begin the turn (or the stop) early enough that the arc ends on the line's end mark.
      if (left() <= turnR + (willStop ? stopDist : 0)) { if (willStop) halt(); else startTurn(); }
    } else if (state === 'stop') {
      if (g < 0.01) { state = 'stand'; wait = 1.5 + r() * 3.5; pendingTurn = true; }
    } else if (state === 'stand') {
      if ((wait -= dt) <= 0) { go(); if (pendingTurn) startTurn(); pendingTurn = false; }
    } else {
      const a = Math.min(Math.PI - turned, step / turnR);
      group.rotation.y += a * turnSpin;
      turned += a;
      if (turned >= Math.PI - 1e-4) {
        // Square up on the new lane so small errors never add up.
        leg ^= 1;
        group.rotation.y = yaw + leg * Math.PI;
        const a0 = along();
        group.position.copy(start).addScaledVector(fwd, a0).addScaledVector(side, leg ? lane : 0);
        pace(1);
        willStop = r() < STOP_P;
        state = 'walk';
      }
    }
  };
  if (DEBUG) debugList.push({ name: `w${debugList.length}`, get: () => ({ x: group.position.x, z: group.position.z, yaw: group.rotation.y, state, leg }) });
  // Start some already walking.
  if (r() < 0.6) go();
  return { group, update };
}
