// Bounce light for the places you walk around. Each room gets a grid of light probes; every
// probe takes a tiny all-round picture of the room and keeps it as the light arriving there
// from each side. Surfaces and people then pick up the light of the probes nearest them, so
// daylight comes back off white walls, neon tints the floor near it, and corners stay dark.
//
// Taking the pictures is slow (each is the room drawn six times), so it is done ahead of time:
// `bun tools/bake-probes.ts` fills every interior's probes in a headless browser and saves them
// in assets/probes/, a few kilobytes each, and docking just loads the file. If a file is missing
// or no longer fits the rooms (the layout changed), the pictures are taken on the spot instead:
// the room you arrive in while the screen is dark, the rest a slice a frame, nearest room first.

import * as THREE from 'three';
import { LightProbeGridWebGL } from 'three/addons/lighting/LightProbeGridWebGL.js';
import ceresProbes from '../assets/probes/ceres.bin';
import tychoProbes from '../assets/probes/tycho.bin';
import ganymedeProbes from '../assets/probes/ganymede.bin';
import medinaProbes from '../assets/probes/medina.bin';

/** The saved probes of each interior. */
const SAVED: Record<string, string> = { ceres: ceresProbes, tycho: tychoProbes, ganymede: ganymedeProbes, medina: medinaProbes };
/** With ?bake in the address the saved probes are ignored and taken afresh, with more care
 *  (finer pictures and a second bounce), for tools/bake-probes.ts to save. */
export const BAKING = new URLSearchParams(location.search).has('bake');
/** First four bytes of a probe file, then: how many grids, each grid's three probe counts,
 *  then each grid's texture as half floats. All 16-bit numbers. */
const MAGIC = [0x5442, 0x5052]; // "BTRP"

/** Fetch an interior's saved probes, or null if there are none to be had. */
export async function savedProbes(id: string): Promise<ArrayBuffer | null> {
  if (BAKING || !SAVED[id]) return null;
  try {
    const r = await fetch(SAVED[id]);
    return r.ok ? await r.arrayBuffer() : null;
  } catch { return null; }
}

{
  // three.js picks the grid that lights a surface by stepping half a probe spacing out along the
  // surface's normal. Our rooms share thin walls and the probes are metres apart, so that step can
  // land a crate's back face in the room next door and light it with that room's neon. Step out
  // only a few centimetres instead: enough to put each wall in the room it faces.
  // (Only the first match, which is the which-grid test. The lookup itself keeps its half step.)
  const from = 'vec3 samplePos = worldPos + worldNormal * spacing * 0.5;';
  const chunk = THREE.ShaderChunk.lightprobes_pars_fragment;
  if (!chunk.includes(from)) console.warn('probes: three.js changed its probe shader; rooms may leak light');
  THREE.ShaderChunk.lightprobes_pars_fragment = chunk.replace(from, 'vec3 samplePos = worldPos + worldNormal * min( spacing * 0.5, vec3( 0.06 ) );')
    // Probe textures have one level, and saying so lets the graphics card skip the lookups for
    // every grid but the one in use (it cannot skip a lookup that has to work out its own level).
    .replace(/= texture\( probesSH, (vec3\(.*?\) \/ atlasDepth \)) \);/g, '= textureLod( probesSH, $1, 0.0 );');
}

/** A box of probes: its corners in metres and how many probes along each side. */
export interface ProbeBox { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; nx: number; ny: number; nz: number }

/** Probes need float textures that can be drawn to, and a spare texture slot per room. */
export function canBounce(renderer: THREE.WebGLRenderer, rooms = 8): boolean {
  const gl = renderer.getContext();
  return renderer.capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float') && gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) >= rooms + 8;
}

interface Job { grid: LightProbeGridWebGL; mid: THREE.Vector3; n: number; next: number; pass: number; hide: THREE.Object3D[] }

/** A probe ignores anything smaller than this (m), and anything further than this from its room. */
const SMALL = 0.7, NEAR = 30;

export class Bounce {
  private jobs: Job[] = [];
  private now: Job | null = null;
  private hide: THREE.Object3D[] = [];
  private shadows: THREE.LightShadow[] = [];
  /** What a probe has been costing lately (ms), so a slice can be sized to the time allowed. */
  private each = 2;
  private primed = false;
  /** True once every probe has been filled in. */
  done = false;

  /** `aim` sets the lights as they are when you stand at a spot (they follow you about), and
   *  `skip` lists what should not be in the probes' pictures: people, who move, and fake shade.
   *  `bounces` is how many extra times light is followed off a surface (each doubles the work). */
  constructor(private scene: THREE.Scene, boxes: ProbeBox[], private aim: (at: THREE.Vector3) => void, skip: THREE.Object3D[], private bounces = BAKING ? 1 : 0) {
    for (const b of boxes) {
      const grid = new LightProbeGridWebGL(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0, b.nx, b.ny, b.nz);
      grid.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
      grid.updateBoundingBox();
      scene.add(grid);
      this.jobs.push({ grid, mid: grid.position, n: b.nx * b.ny * b.nz, next: 0, pass: 0, hide: [] });
    }
    this.hide = skip.filter((o) => o.visible);
    // A probe's picture is the whole scene drawn six times, so leave out what cannot matter to
    // it: small props, and things well away from its room. This is most of the cost.
    scene.updateMatrixWorld(true);
    const ball = new THREE.Sphere(), under = new Set<THREE.Object3D>();
    for (const o of skip) o.traverse((c) => under.add(c));
    scene.traverse((o) => {
      if (!o.visible || under.has(o)) return;
      // Stars and wire frames are drawn a pixel wide however far off they are. In a picture
      // eight pixels across that makes them enormous lamps, so they stay out too.
      if ((o as THREE.Points).isPoints || (o as THREE.Line).isLine) this.hide.push(o);
      const l = o as THREE.DirectionalLight;
      if (l.isLight && l.castShadow) this.shadows.push(l.shadow);
      const m = o as THREE.Mesh;
      if (!m.isMesh || (m as THREE.InstancedMesh).isInstancedMesh) return;
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      ball.copy(m.geometry.boundingSphere!).applyMatrix4(m.matrixWorld);
      if (ball.radius < SMALL) { this.hide.push(m); return; }
      for (const j of this.jobs) if (j.grid.boundingBox.distanceToPoint(ball.center) - ball.radius > NEAR) j.hide.push(m);
    });
    this.done = !this.jobs.length;
  }

  /** How many probes there are, and how many pictures are still to take (for tests). */
  get count(): number { return this.jobs.reduce((s, j) => s + j.n, 0); }
  get left(): number { return this.jobs.reduce((s, j) => s + Math.max(0, this.bounces + 1 - j.pass) * j.n - j.next, 0); }

  /** Use probes saved earlier by `save`. False (and nothing changed) if they are not for
   *  these grids, which means the rooms have changed since and the file needs baking again. */
  load(file: ArrayBuffer): boolean {
    if (this.primed || file.byteLength < 6 || file.byteLength % 2) return false;
    const d = new Uint16Array(file);
    if (d[0] !== MAGIC[0] || d[1] !== MAGIC[1] || d[2] !== this.jobs.length) return false;
    let at = 3 + this.jobs.length * 3;
    const sizes = this.jobs.map((j, i) => {
      const r = j.grid.resolution, ok = d[3 + i * 3] === r.x && d[4 + i * 3] === r.y && d[5 + i * 3] === r.z;
      return ok ? r.x * r.y * 7 * (r.z + 2) * 4 : -1;
    });
    if (sizes.includes(-1) || at + sizes.reduce((a, b) => a + b, 0) !== d.length) return false;
    this.jobs.forEach((j, i) => {
      const r = j.grid.resolution, t = new THREE.Data3DTexture(d.slice(at, at + sizes[i]), r.x, r.y, 7 * (r.z + 2));
      t.format = THREE.RGBAFormat; t.type = THREE.HalfFloatType;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.needsUpdate = true;
      j.grid.texture = t;
      j.pass = this.bounces + 1;
      at += sizes[i];
    });
    this.primed = this.done = true;
    return true;
  }

  /** The filled probes as a file for `load` (used by the bake tool; reads back from the graphics card). */
  save(renderer: THREE.WebGLRenderer): Uint16Array {
    const gl = renderer.getContext() as WebGL2RenderingContext, parts: Uint16Array[] = [];
    const head = [...MAGIC, this.jobs.length];
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    for (const j of this.jobs) {
      const r = j.grid.resolution, depth = 7 * (r.z + 2), layer = new Float32Array(r.x * r.y * 4), out = new Uint16Array(layer.length * depth);
      const rt = (j.grid as unknown as { _renderTarget: THREE.WebGL3DRenderTarget })._renderTarget;
      const tex = (renderer.properties.get(rt.texture) as { __webglTexture: WebGLTexture }).__webglTexture;
      for (let z = 0; z < depth; z++) {
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex, 0, z);
        gl.readPixels(0, 0, r.x, r.y, gl.RGBA, gl.FLOAT, layer);
        for (let i = 0; i < layer.length; i++) out[z * layer.length + i] = THREE.DataUtils.toHalfFloat(layer[i]);
      }
      head.push(r.x, r.y, r.z);
      parts.push(out);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    renderer.resetState();
    const file = new Uint16Array(head.length + parts.reduce((a, p) => a + p.length, 0));
    file.set(head);
    let at = head.length;
    for (const p of parts) { file.set(p, at); at += p.length; }
    return file;
  }

  /** Switch the bounce light off and on (for before-and-after tests). */
  show(on: boolean) { for (const j of this.jobs) j.grid.visible = on; }

  /** Make the (empty) probe textures, so shaders compiled from now on already count on them. */
  prime(renderer: THREE.WebGLRenderer) {
    if (this.primed) return;
    this.primed = true;
    for (const j of this.jobs) {
      // three.js would make these full floats. Half floats are plenty for light, are quicker
      // to read, and blend smoothly on phones, which full floats do not.
      const r = j.grid.resolution, g = j.grid as unknown as { _renderTarget: THREE.WebGL3DRenderTarget };
      g._renderTarget = new THREE.WebGL3DRenderTarget(r.x, r.y, 7 * (r.z + 2), {
        format: THREE.RGBAFormat, type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false,
      });
      j.grid.texture = g._renderTarget.texture as unknown as THREE.Data3DTexture;
      renderer.initRenderTarget(g._renderTarget);
    }
  }

  /** Take probe pictures for about `ms` milliseconds, starting with the room nearest `cam`.
   *  `far` is how far a probe sees. Returns true when there is nothing left to do. */
  step(renderer: THREE.WebGLRenderer, ms: number, cam: THREE.Vector3, far: number): boolean {
    if (this.done) return true;
    this.prime(renderer);
    const t0 = performance.now(), scene = this.scene;
    const show = (list: THREE.Object3D[], on: boolean) => { for (const o of list) o.visible = on; };
    show(this.hide, false);
    // The baker redraws every shadow map and re-places every object each time it is called.
    // Our shadow map follows you about and is only for nearby props, and nothing a probe can
    // see has moved, so keep both as they are rather than pay for them per call. (A shadow map
    // that has never been drawn is still drawn the once, or it would shade everything.)
    for (const sh of this.shadows) sh.autoUpdate = sh.map === null;
    scene.matrixWorldAutoUpdate = false;
    try {
      for (;;) {
        if (!this.now) {
          // Nearest room first. (With extra bounces, every room gets its first pass before
          // any gets its second, so the second sees the neighbours' light through the doors.)
          let best: Job | null = null, bd = Infinity;
          for (const j of this.jobs) {
            const d = j.pass * 1e9 + j.mid.distanceToSquared(cam);
            if (j.pass <= this.bounces && d < bd) { best = j; bd = d; }
          }
          if (!best) { this.done = true; return true; }
          this.now = best;
        }
        const j = this.now;
        this.aim(j.mid);
        show(j.hide, false);
        // As many probes as should fit in the time left, going by what they have been costing.
        const room = ms - (performance.now() - t0);
        const count = Math.min(Math.max(1, Math.floor(room / this.each)), 32, j.n - j.next), t1 = performance.now();
        try {
          j.grid.bake(renderer, scene, { cubemapSize: BAKING ? 16 : 8, near: 0.05, far, start: j.next, count, pass: j.pass });
        } finally {
          show(j.hide, true);
        }
        j.next += count;
        if (j.next >= j.n) { j.next = 0; j.pass++; this.now = null; }
        const t2 = performance.now();
        this.each = this.each * 0.7 + ((t2 - t1) / count) * 0.3;
        if (t2 - t0 + this.each > ms) return false;
      }
    } finally {
      show(this.hide, true);
      for (const sh of this.shadows) sh.autoUpdate = true;
      scene.matrixWorldAutoUpdate = true;
    }
  }
}
