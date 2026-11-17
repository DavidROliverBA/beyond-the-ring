// Bounce light for the places you walk around. Each room gets a grid of light probes; every
// probe takes a tiny all-round picture of the room and keeps it as the light arriving there
// from each side. Surfaces and people then pick up the light of the probes nearest them, so
// daylight comes back off white walls, neon tints the floor near it, and corners stay dark.
//
// The pictures are taken once per interior, a few per frame, nearest room first.

import * as THREE from 'three';
import { LightProbeGridWebGL } from 'three/addons/lighting/LightProbeGridWebGL.js';

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
  private per = 2;
  private primed = false;
  /** True once every probe has been filled in. */
  done = false;
  /** Time spent and probes filled so far (for tests). */
  stats = { ms: 0, probes: 0, calls: 0 };

  /** `aim` sets the lights as they are when you stand at a spot (they follow you about), and
   *  `skip` lists what should not be in the probes' pictures: people, who move, and fake shade.
   *  `bounces` is how many extra times light is followed off a surface. */
  constructor(private scene: THREE.Scene, boxes: ProbeBox[], private aim: (at: THREE.Vector3) => void, skip: THREE.Object3D[], private bounces = 1) {
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
      // sixteen pixels across that makes them enormous lamps, so they stay out too.
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
          // Every room gets its first pass before any gets its second, so the second sees
          // the neighbours' light through the doors.
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
        const count = Math.min(this.per, j.n - j.next), t1 = performance.now();
        try {
          j.grid.bake(renderer, scene, { cubemapSize: 16, near: 0.05, far, start: j.next, count, pass: j.pass });
        } finally {
          show(j.hide, true);
        }
        j.next += count;
        if (j.next >= j.n) { j.next = 0; j.pass++; this.now = null; }
        // Settle on as many probes per go as fit the time allowed (each go has a fixed cost
        // too, so never fewer than two).
        const t2 = performance.now(), each = (t2 - t1) / count;
        this.stats.ms += t2 - t1; this.stats.probes += count; this.stats.calls++;
        this.per = Math.max(2, Math.min(64, Math.floor((ms * 0.8) / Math.max(each, 0.05))));
        if (t2 - t0 + each * 2 > ms) return false;
      }
    } finally {
      show(this.hide, true);
      for (const sh of this.shadows) sh.autoUpdate = true;
      scene.matrixWorldAutoUpdate = true;
    }
  }
}
