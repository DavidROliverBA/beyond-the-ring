// Bounce light for the places you walk around. Each room gets a grid of light probes; every
// probe takes a tiny all-round picture of the room and keeps it as the light arriving there
// from each side. Surfaces and people then pick up the light of the probes nearest them, so
// daylight comes back off white walls, neon tints the floor near it, and corners stay dark.
//
// Taking the pictures is slow (each is the room drawn six times), so it is done ahead of time:
// `bun tools/bake-probes.ts` fills every interior's probes in a headless browser and saves them
// in assets/probes/, a few kilobytes each, and docking just loads the file. If a file is missing
// or no longer fits the rooms (the layout changed), the interior goes without bounce light, lit
// as it was before there were probes, until the tool is run again.

import * as THREE from 'three';
import { LightProbeGridWebGL } from 'three/addons/lighting/LightProbeGridWebGL.js';
import ceresProbes from '../assets/probes/ceres.bin';
import tychoProbes from '../assets/probes/tycho.bin';
import ganymedeProbes from '../assets/probes/ganymede.bin';
import medinaProbes from '../assets/probes/medina.bin';

/** The saved probes of each interior. */
const SAVED: Record<string, string> = { ceres: ceresProbes, tycho: tychoProbes, ganymede: ganymedeProbes, medina: medinaProbes };
/** With ?bake in the address the saved probes are ignored and taken afresh while the screen
 *  is dark, for tools/bake-probes.ts to save. */
export const BAKING = new URLSearchParams(location.search).has('bake');
/** A probe file is all 16-bit numbers: these two, a fingerprint of the probe boxes (two
 *  numbers), how many grids, each grid's three probe counts, then each grid's texture as
 *  half floats. */
const MAGIC = [0x5442, 0x5052]; // "BTRP"

if (BAKING) {
  // Taking the probes uses three.js's own shader, one grid per room, with two changes.
  // three.js picks the grid that lights a surface by stepping half a probe spacing out along the
  // surface's normal. Our rooms share thin walls and the probes are metres apart, so that step can
  // land a crate's back face in the room next door and light it with that room's neon. Step out
  // only a few centimetres instead: enough to put each wall in the room it faces.
  // (Only the first match, which is the which-grid test. The lookup itself keeps its half step.)
  const from = 'vec3 samplePos = worldPos + worldNormal * spacing * 0.5;';
  const chunk = THREE.ShaderChunk.lightprobes_pars_fragment;
  if (!chunk.includes(from)) console.warn('probes: three.js changed its probe shader; rooms may leak light');
  THREE.ShaderChunk.lightprobes_pars_fragment = chunk.replace(from, 'vec3 samplePos = worldPos + worldNormal * min( spacing * 0.5, vec3( 0.06 ) );')
    .replace(/= texture\( probesSH, (vec3\(.*?\) \/ atlasDepth \)) \);/g, '= textureLod( probesSH, $1, 0.0 );');
} else {
  // Showing them uses our own, for speed. three.js looks the probes up for every pixel, with a
  // texture per room; on a laptop that nearly halved the frame rate in the busy places (the
  // lookups are slow in bulk, however few). Bounce light changes slowly across a surface, so
  // ours is worked out at the corners of each triangle and blended across it instead, which
  // costs next to nothing. Big surfaces are cut into panels a few metres across so they have
  // corners to work it out at (see `plane` in interior.ts).
  // All the rooms of an interior share one texture (and one "grid" as far as three.js knows):
  // the first few slices list the rooms (corners, probe counts and where each one's data
  // starts), a corner finds the room it is in from that list, and looks its light up once.
  // three.js still hands the shader a grid's box and probe counts; ours carry the texture's
  // size (in probesMin) and the number of rooms (in probesResolution.x) instead.
  THREE.ShaderChunk.shadowmap_pars_vertex += /* glsl */`
#if NUM_LIGHT_PROBE_GRIDS > 0
uniform highp sampler3D probesSH[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesMin[ NUM_LIGHT_PROBE_GRIDS ];
uniform vec3 probesResolution[ NUM_LIGHT_PROBE_GRIDS ];
varying vec3 vProbeLight;

vec3 roomProbeIrradiance( vec3 worldPos, vec3 n ) {
	int rooms = int( probesResolution[ 0 ].x );
	vec3 size = probesMin[ 0 ];
	// A few centimetres out along the normal puts each wall in the room it faces.
	vec3 at = worldPos + n * 0.06;
	vec3 lo, hi, res;
	float start = - 1.0;
	for ( int i = 0; i < 16; i ++ ) {
		if ( i >= rooms ) break;
		vec4 a = texelFetch( probesSH[ 0 ], ivec3( 0, 0, i ), 0 );
		vec4 b = texelFetch( probesSH[ 0 ], ivec3( 1, 0, i ), 0 );
		if ( all( greaterThanEqual( at, a.xyz ) ) && all( lessThanEqual( at, b.xyz ) ) ) {
			lo = a.xyz; hi = b.xyz; start = a.w;
			res = texelFetch( probesSH[ 0 ], ivec3( 2, 0, i ), 0 ).xyz;
			break;
		}
	}
	if ( start < 0.0 ) return vec3( 0.0 );
	// Read half a probe spacing out from the surface, between the probes' centres.
	vec3 range = hi - lo;
	vec3 uvw = clamp( ( worldPos + n * range / res * 0.5 - lo ) / range, 0.5 / res, 1.0 - 0.5 / res );
	vec2 uv = uvw.xy * res.xy / size.xy;
	// Seven blocks of slices, each with a spare slice at both ends.
	float pad = res.z + 2.0, z = start + 1.0 + uvw.z * res.z;
	vec4 s0 = textureLod( probesSH[ 0 ], vec3( uv, z / size.z ), 0.0 );
	vec4 s1 = textureLod( probesSH[ 0 ], vec3( uv, ( z + pad ) / size.z ), 0.0 );
	vec4 s2 = textureLod( probesSH[ 0 ], vec3( uv, ( z + 2.0 * pad ) / size.z ), 0.0 );
	vec4 s3 = textureLod( probesSH[ 0 ], vec3( uv, ( z + 3.0 * pad ) / size.z ), 0.0 );
	vec4 s4 = textureLod( probesSH[ 0 ], vec3( uv, ( z + 4.0 * pad ) / size.z ), 0.0 );
	vec4 s5 = textureLod( probesSH[ 0 ], vec3( uv, ( z + 5.0 * pad ) / size.z ), 0.0 );
	vec4 s6 = textureLod( probesSH[ 0 ], vec3( uv, ( z + 6.0 * pad ) / size.z ), 0.0 );
	vec3 c0 = s0.xyz, c1 = vec3( s0.w, s1.xy ), c2 = vec3( s1.zw, s2.x ), c3 = s2.yzw, c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy ), c6 = vec3( s4.zw, s5.x ), c7 = s5.yzw, c8 = s6.xyz;
	// The same sum three.js does: light from nine directions, weighed by the way the surface faces.
	float x = n.x, y = n.y, zz = n.z;
	vec3 r = c0 * 0.886227;
	r += c1 * 2.0 * 0.511664 * y;
	r += c2 * 2.0 * 0.511664 * zz;
	r += c3 * 2.0 * 0.511664 * x;
	r += c4 * 2.0 * 0.429043 * x * y;
	r += c5 * 2.0 * 0.429043 * y * zz;
	r += c6 * ( 0.743125 * zz * zz - 0.247708 );
	r += c7 * 2.0 * 0.429043 * x * zz;
	r += c8 * 0.429043 * ( x * x - y * y );
	return max( r, vec3( 0.0 ) );
}
#endif
`;
  THREE.ShaderChunk.shadowmap_vertex += /* glsl */`
#if NUM_LIGHT_PROBE_GRIDS > 0
	{
		vec4 probeAt = vec4( transformed, 1.0 );
		#ifdef USE_INSTANCING
			probeAt = instanceMatrix * probeAt;
		#endif
		#ifdef HAS_NORMAL
			vec3 probeFacing = inverseTransformDirection( transformedNormal, viewMatrix );
		#else
			vec3 probeFacing = vec3( 0.0, 1.0, 0.0 );
		#endif
		vProbeLight = roomProbeIrradiance( ( modelMatrix * probeAt ).xyz, probeFacing );
	}
#endif
`;
  THREE.ShaderChunk.lightprobes_pars_fragment = /* glsl */`
#if NUM_LIGHT_PROBE_GRIDS > 0
varying vec3 vProbeLight;
#endif
`;
  // In the lighting itself, swap three.js's pick-a-grid-then-look-up for the blended light.
  const use = THREE.ShaderChunk.lights_fragment_begin, theirs = /vec3 probeWorldPos[\s\S]*?getLightProbeGridIrradiance[\s\S]*?#pragma unroll_loop_end/;
  if (!theirs.test(use)) console.warn('probes: three.js changed its lighting shader; expect shader errors');
  THREE.ShaderChunk.lights_fragment_begin = use.replace(theirs, 'irradiance += vProbeLight;');
}

/** A number that changes if any probe box moves, grows or gets a different count of probes. */
function fingerprint(boxes: ProbeBox[]): [number, number] {
  let h = 2166136261;
  for (const b of boxes) for (const v of [b.x0, b.x1, b.y0, b.y1, b.z0, b.z1, b.nx, b.ny, b.nz]) {
    for (const c of v.toFixed(3)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  }
  return [h & 0xffff, (h >>> 16) & 0xffff];
}

/** Whether a saved probe file was made for exactly these boxes. */
export function fits(file: ArrayBuffer | null | undefined, boxes: ProbeBox[]): file is ArrayBuffer {
  if (!file || file.byteLength < 10 || file.byteLength % 2) return false;
  const d = new Uint16Array(file), [f0, f1] = fingerprint(boxes);
  if (d[0] !== MAGIC[0] || d[1] !== MAGIC[1] || d[2] !== f0 || d[3] !== f1 || d[4] !== boxes.length) return false;
  let size = 5 + boxes.length * 3;
  for (const b of boxes) size += b.nx * b.ny * 7 * (b.nz + 2) * 4;
  return size === d.length;
}

/** Fetch an interior's saved probes, or null if there are none to be had. */
export async function savedProbes(id: string): Promise<ArrayBuffer | null> {
  if (!SAVED[id]) return null;
  try {
    const r = await fetch(SAVED[id]);
    return r.ok ? await r.arrayBuffer() : null;
  } catch { return null; }
}


/** A box of probes: its corners in metres and how many probes along each side. */
export interface ProbeBox { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; nx: number; ny: number; nz: number }

/** Probes need 3D textures. (Taking them, which only the bake tool does, also needs float
 *  textures that can be drawn to.) */
export function canBounce(renderer: THREE.WebGLRenderer): boolean {
  return renderer.capabilities.isWebGL2 && (!BAKING || renderer.extensions.has('EXT_color_buffer_float'));
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
  private boxes: ProbeBox[];
  /** In the game: the one grid holding every room's saved probes. */
  private one: LightProbeGridWebGL | null = null;
  private primed = false;
  /** True once every probe has been filled in. */
  done = false;

  /** `aim` sets the lights as they are when you stand at a spot (they follow you about), and
   *  `skip` lists what should not be in the probes' pictures: people, who move, and fake shade.
   *  `bounces` is how many extra times light is followed off a surface (each doubles the work). */
  constructor(private scene: THREE.Scene, boxes: ProbeBox[], private aim: (at: THREE.Vector3) => void, skip: THREE.Object3D[], private bounces = 1) {
    this.boxes = boxes;
    // Only the bake tool needs a grid per room and the list of what to leave out; in the game
    // the saved probes go into one grid (see load).
    if (!BAKING) return;
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
  }

  /** How many probes there are, and how many pictures are still to take (for tests). */
  get count(): number { return this.boxes.reduce((s, b) => s + b.nx * b.ny * b.nz, 0); }
  get left(): number { return this.jobs.reduce((s, j) => s + Math.max(0, this.bounces + 1 - j.pass) * j.n - j.next, 0); }

  /** Use probes saved earlier by `save`. False (and nothing changed) if they were not made
   *  for these boxes, which means the rooms have changed since and need baking again. */
  load(file: ArrayBuffer): boolean {
    const boxes = this.boxes, N = boxes.length;
    if (this.one || N > 16 || !fits(file, boxes)) return false;
    const d = new Uint16Array(file), half = THREE.DataUtils.toHalfFloat;
    // One texture for all the rooms: a slice per room listing it, then each room's slices.
    const W = Math.max(3, ...boxes.map((b) => b.nx)), H = Math.max(...boxes.map((b) => b.ny));
    const D = N + boxes.reduce((a, b) => a + 7 * (b.nz + 2), 0);
    const out = new Uint16Array(W * H * D * 4);
    let at = 5 + N * 3, z0 = N;
    boxes.forEach((b, i) => {
      out.set([b.x0, b.y0, b.z0, z0, b.x1, b.y1, b.z1, 0, b.nx, b.ny, b.nz, 0].map(half), i * W * H * 4);
      const depth = 7 * (b.nz + 2);
      for (let z = 0; z < depth; z++) for (let y = 0; y < b.ny; y++) {
        const from = at + (z * b.ny + y) * b.nx * 4;
        out.set(d.subarray(from, from + b.nx * 4), ((z0 + z) * H + y) * W * 4);
      }
      at += b.nx * b.ny * depth * 4;
      z0 += depth;
    });
    const t = new THREE.Data3DTexture(out, W, H, D);
    t.format = THREE.RGBAFormat; t.type = THREE.HalfFloatType;
    t.minFilter = t.magFilter = new URLSearchParams(location.search).get('px') === 'nearest' ? THREE.NearestFilter : THREE.LinearFilter;
    t.needsUpdate = true;
    // As far as three.js knows this is one grid; its box and counts carry what our shader wants.
    const grid = this.one = new LightProbeGridWebGL(1, 1, 1, N, 1, 1);
    grid.texture = t;
    grid.boundingBox.min.set(W, H, D);
    this.scene.add(grid);
    this.primed = this.done = true;
    return true;
  }

  /** The filled probes as a file for `load` (used by the bake tool; reads back from the graphics card). */
  save(renderer: THREE.WebGLRenderer): Uint16Array {
    const gl = renderer.getContext() as WebGL2RenderingContext, parts: Uint16Array[] = [];
    const head = [...MAGIC, ...fingerprint(this.boxes), this.jobs.length];
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
  show(on: boolean) { if (this.one) this.one.visible = on; }

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

  /** (Bake tool only.) Take probe pictures for about `ms` milliseconds, starting with the room nearest `cam`.
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
          j.grid.bake(renderer, scene, { cubemapSize: 16, near: 0.05, far, start: j.next, count, pass: j.pass });
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
