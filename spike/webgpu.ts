// WebGPU go/no-go spike (docs/ROADMAP.md section 1). One page, three renderers, chosen in the address:
//   ?r=webgpu   WebGPURenderer on WebGPU
//   ?r=webgl2   WebGPURenderer on its WebGL 2 fallback
//   ?r=classic  the game's WebGLRenderer with its scaled logarithmic depth (the reference)
// and what to do with it:
//   scene=depth (default) the true-scale depth test; stop=20m|5km|leo; view=beauty|id|truth|check
//   scene=sol|tycho|medina  benchmark scenes; bench=1 measures them
//   depth=reversed|log|custom|plain  (WebGPURenderer only)   hp=1 high-precision matrices
//   float=1 slide the world so the camera sits at the origin   post=1 bloom and film finish
// Results land on window.__spike for the Playwright scripts in the scratchpad.

import * as THREE from 'three';
import * as GPU from 'three/webgpu';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { loadModels, buildModel } from '../src/ships';
import { loadPeople } from '../src/skinned';
import { buildInterior } from '../src/interior';
import { buildWorld, M, KM, type Kit, type Stop, type View, type World } from './world';
import * as tsl from './tsl';
import * as glsl from './glsl';

const q = new URLSearchParams(location.search);
const R = (q.get('r') ?? 'webgpu') as 'webgpu' | 'webgl2' | 'classic';
const DEPTH = (q.get('depth') ?? 'reversed') as 'reversed' | 'log' | 'custom' | 'plain';
const SCENE = (q.get('scene') ?? 'depth') as 'depth' | 'sol' | 'tycho' | 'medina';
const STOP = (q.get('stop') ?? '20m') as Stop;
const VIEW = (q.get('view') ?? 'beauty') as View | 'check';
const HP = q.get('hp') === '1', FLOAT = q.get('float') === '1', POST = q.get('post') === '1', BENCH = q.get('bench') === '1';
const AA = q.get('aa') !== '0';
const classic = R === 'classic';

const out: Record<string, unknown> = { ready: false, r: R, depth: classic ? 'game log (LOGK)' : DEPTH, scene: SCENE, stop: STOP, hp: HP, float: FLOAT, post: POST };
(globalThis as any).__spike = out;
const hud = document.getElementById('hud')!;
const say = (s: string) => { hud.textContent = s; };
const warnings: string[] = [];
const keep = (kind: string) => (...a: unknown[]) => { const s = a.map(String).join(' '); if (warnings.length < 40 && !warnings.includes(s)) warnings.push(kind + ': ' + s.slice(0, 300)); };
const cw = console.warn, ce = console.error;
console.warn = (...a) => { keep('warn')(...a); cw(...a); };
console.error = (...a) => { keep('error')(...a); ce(...a); };
out.warnings = warnings;

// Links to the useful combinations, for trying by hand.
{
  const menu = document.getElementById('menu')!;
  const link = (label: string, s: string) => `<a href="?${s}">${label}</a>`;
  menu.innerHTML = [
    link('WebGPU reversed-Z, 20 m', 'r=webgpu&depth=reversed&hp=1'),
    link('… floating origin', 'r=webgpu&depth=reversed&float=1'),
    link('… depth check', 'r=webgpu&depth=reversed&hp=1&view=check&aa=0'),
    link('… low orbit, with post', 'r=webgpu&depth=reversed&hp=1&stop=leo&post=1'),
    link('WebGPU scaled log depth (TSL)', 'r=webgpu&depth=custom&hp=1'),
    link('WebGPU stock log depth (fails)', 'r=webgpu&depth=log&hp=1&view=check&aa=0'),
    link('WebGPU plain depth (fails)', 'r=webgpu&depth=plain&hp=1&view=check&aa=0'),
    link('WebGL 2 fallback, reversed-Z', 'r=webgl2&depth=reversed&hp=1'),
    link('Classic WebGL (the game today)', 'r=classic'),
    link('Bench Sol', `r=${R}&scene=sol&post=1&bench=1&hp=1`),
    link('Bench Tycho', `r=${R}&scene=tycho&post=1&bench=1`),
    link('Bench Medina', `r=${R}&scene=medina&post=1&bench=1`),
  ].join('<br>');
}

const canvas = document.getElementById('view') as HTMLCanvasElement;
const W = innerWidth, Hh = innerHeight, DPR = Math.min(devicePixelRatio, 2);

async function main() {
  // ---------------------------------------------------------------- renderer
  let renderer: THREE.WebGLRenderer | GPU.WebGPURenderer;
  let finish: () => Promise<void>;
  if (classic) {
    glsl.patchLogDepth();
    const r = renderer = new THREE.WebGLRenderer({ canvas, antialias: AA, logarithmicDepthBuffer: true });
    const gl = r.getContext();
    finish = async () => { gl.finish(); };
    out.backend = 'WebGLRenderer (WebGL 2)';
  } else {
    if (R === 'webgpu' && !(navigator as any).gpu) throw new Error('This browser has no navigator.gpu (WebGPU is unavailable).');
    const r = renderer = new GPU.WebGPURenderer({
      canvas, antialias: AA, forceWebGL: R === 'webgl2',
      reversedDepthBuffer: DEPTH === 'reversed', logarithmicDepthBuffer: DEPTH === 'log',
    });
    await r.init();
    const be = r.backend as any;
    out.backend = be.isWebGPUBackend ? 'WebGPURenderer (WebGPU)' : 'WebGPURenderer (WebGL 2 fallback)';
    out.reversed = r.reversedDepthBuffer;
    if (R === 'webgpu' && !be.isWebGPUBackend) throw new Error('Asked for WebGPU but the renderer fell back to WebGL 2.');
    if (be.isWebGPUBackend) {
      const info = be.device?.adapterInfo ?? (await (navigator as any).gpu.requestAdapter())?.info;
      out.adapter = info ? `${info.vendor} ${info.architecture} ${info.description ?? ''}`.trim() : 'unknown';
      finish = () => be.device.queue.onSubmittedWorkDone();
    } else {
      const gl = be.gl as WebGL2RenderingContext;
      finish = async () => { gl.finish(); };
    }
    r.highPrecision = HP;
  }
  renderer.setPixelRatio(DPR);
  renderer.setSize(W, Hh, false);
  renderer.setClearColor(0x000003, 1);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  say('loading models…');
  await Promise.all([loadModels(), SCENE === 'tycho' || SCENE === 'medina' ? loadPeople() : null]);

  // ---------------------------------------------------------------- scene
  let scene: THREE.Scene, camera: THREE.PerspectiveCamera, world: World | null = null;
  let tick: (t: number, dt: number) => void = () => {};
  if (SCENE === 'depth' || SCENE === 'sol') {
    const kit: Kit = classic
      ? { nightOnly: (m) => glsl.nightOnly(m), atmosphere: glsl.atmosphere }
      : { nightOnly: tsl.nightOnly as Kit['nightOnly'], atmosphere: tsl.atmosphere as unknown as Kit['atmosphere'] };
    world = buildWorld(kit, classic ? glsl.LOGK : 1);
    scene = world.scene; camera = world.camera;
    camera.aspect = W / Hh;
    world.place(STOP, FLOAT);
    if (SCENE === 'sol') {
      // Traffic: two dozen ships of every class within a few tens of kilometres, as around a busy port.
      const kinds = ['corvette', 'battleship', 'dreadnought', 'hauler', 'racer', 'freighter', 'stealth', 'survey'] as const;
      const size: Record<string, number> = { corvette: 46, battleship: 500, dreadnought: 600, hauler: 300, racer: 30, freighter: 200, stealth: 60, survey: 120 };
      let seed = 5;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      for (let i = 0; i < 24; i++) {
        const k = kinds[i % kinds.length], g = buildModel(k);
        const box = new THREE.Box3().setFromObject(g), s = box.getSize(new THREE.Vector3());
        const holder = new THREE.Group();
        holder.add(g);
        holder.scale.setScalar((size[k] * M) / Math.max(s.x, s.y, s.z));
        const d = (0.4 + rand() * 30) * KM;
        holder.position.copy(world.eye).addScaledVector(fwd, d).addScaledVector(right, (rand() - 0.5) * d * 1.4).addScaledVector(up, (rand() - 0.5) * d * 0.7);
        holder.quaternion.setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6));
        world.root.add(holder);
      }
      scene.updateMatrixWorld(true);
    }
    world.show(VIEW === 'check' ? 'id' : VIEW);
  } else {
    const it = await buildInterior(SCENE);
    scene = it.scene;
    camera = new THREE.PerspectiveCamera(72, W / Hh, 0.08, 12000 * (classic ? glsl.LOGK : 1));
    // Stand where the game puts you on arrival (main.ts, the walk camera).
    const place = it.places[+(q.get('place') ?? 0)] ?? it.spawn, eye = 1.7;
    camera.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), place.yaw);
    if (it.curveR) {
      const Rr = it.curveR, th = place.x / Rr;
      camera.position.set((Rr - eye) * Math.sin(th), -(Rr - eye) * Math.cos(th), place.z);
      camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), th));
    } else camera.position.set(place.x, eye, place.z);
    out.place = place.name;
    tick = (t, dt) => it.tick(t, dt, camera.position);
    if (!classic) {
      // The hologram adverts are a ShaderMaterial, which WebGPURenderer cannot draw: use the TSL port.
      let swapped = 0;
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.ShaderMaterial;
        if (m && m.isShaderMaterial && m.uniforms?.map) { (o as THREE.Mesh).material = tsl.hologram(m.uniforms.map.value); swapped++; }
      });
      out.hologramsSwapped = swapped;
    }
  }
  camera.updateProjectionMatrix();
  if (!classic && DEPTH === 'custom') tsl.applyLogDepth(scene);

  // ---------------------------------------------------------------- post chain
  let draw: () => void;
  if (POST && classic) {
    const r = renderer as THREE.WebGLRenderer;
    const composer = new EffectComposer(r, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    composer.setPixelRatio(DPR);
    composer.setSize(W, Hh);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, Hh), 0.32, 0.4, 1.0));
    composer.addPass(new OutputPass());
    draw = () => composer.render();
  } else if (POST) {
    const post = tsl.postChain(renderer as GPU.WebGPURenderer, scene, camera);
    draw = () => post.render();
  } else draw = () => renderer.render(scene, camera);

  // ---------------------------------------------------------------- the depth check
  // Draw the scene in flat colours twice: once trusting the depth buffer, once in an order worked
  // out by hand (see world.ts). Any pixel that differs is a depth mistake.
  const grab = () => {
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(canvas, 0, 0);
    return g.getImageData(0, 0, c.width, c.height);
  };
  if (world && VIEW === 'check') {
    const rr = renderer as any;
    renderer.toneMapping = THREE.NoToneMapping;
    world.show('truth');
    world.drawTruth(rr);
    world.drawTruth(rr);
    await finish();
    const truth = grab();
    world.show('id');
    world.draw(rr);
    world.draw(rr);
    await finish();
    const got = grab();
    let bad = 0, shipPx = 0, lit = 0;
    const over = document.getElementById('over') as HTMLCanvasElement;
    over.width = got.width; over.height = got.height; over.style.display = 'block';
    const og = over.getContext('2d')!, img = og.createImageData(got.width, got.height);
    for (let i = 0; i < got.data.length; i += 4) {
      const d = Math.max(Math.abs(got.data[i] - truth.data[i]), Math.abs(got.data[i + 1] - truth.data[i + 1]), Math.abs(got.data[i + 2] - truth.data[i + 2]));
      const wrong = d > 40;
      if (wrong) bad++;
      if (truth.data[i] + truth.data[i + 1] + truth.data[i + 2] > 12) lit++;
      // The ship is the only thing drawn in soft in-between colours (its surface directions).
      const [r, g, b] = [truth.data[i], truth.data[i + 1], truth.data[i + 2]];
      if ([r, g, b].some((v) => v > 20 && v < 235)) shipPx++;
      img.data[i] = wrong ? 255 : got.data[i] * 0.45; img.data[i + 1] = wrong ? 0 : got.data[i + 1] * 0.45; img.data[i + 2] = wrong ? 0 : got.data[i + 2] * 0.45; img.data[i + 3] = 255;
    }
    og.putImageData(img, 0, 0);
    const total = got.width * got.height;
    out.check = { wrongPixels: bad, wrongPercent: +(100 * bad / total).toFixed(4), pixels: total, shipPixels: shipPx, drawnPixels: lit };
    say(`${out.backend}  depth: ${out.depth}  stop: ${STOP}\nDEPTH CHECK: ${bad} wrong pixels of ${total} (${(100 * bad / total).toFixed(3)}%)  [ship covers ${shipPx}]\nwrong pixels are painted red`);
    out.ready = true;
    return;
  }

  // ---------------------------------------------------------------- benchmark
  // Warm up (first frames compile shaders and upload textures; WebGPU compiles in the background).
  const t0 = performance.now();
  for (let i = 0; i < 4; i++) { tick(i * 0.016, 0.016); draw(); await finish(); await new Promise((r) => setTimeout(r, 50)); }
  out.warmMs = Math.round(performance.now() - t0);
  const info = renderer.info as any;
  if (BENCH) {
    say('measuring…');
    await new Promise((r) => setTimeout(r, 1500));
    for (let i = 0; i < 6; i++) { draw(); await finish(); }
    out.calls = info.render.drawCalls ?? info.render.calls;
    out.triangles = info.render.triangles;
    const cpu: number[] = [], all: number[] = [];
    const N = 12;
    for (let k = 0; k < 12; k++) {
      await finish();
      const a = performance.now();
      for (let i = 0; i < N; i++) draw();
      const b = performance.now();
      await finish();
      const c = performance.now();
      cpu.push((b - a) / N); all.push((c - a) / N);
    }
    cpu.sort((x, y) => x - y); all.sort((x, y) => x - y);
    out.bench = { frameMs: +all[2].toFixed(2), cpuMs: +cpu[2].toFixed(2), medianMs: +all[6].toFixed(2) };
  }

  // ---------------------------------------------------------------- show it
  let last = performance.now(), frames = 0, fpsT = last, fps = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    tick(now / 1000, dt);
    draw();
    frames++;
    if (now - fpsT > 500) { fps = frames * 1000 / (now - fpsT); frames = 0; fpsT = now; }
    const b = out.bench as { frameMs: number; cpuMs: number } | undefined;
    say(`${out.backend}${out.adapter ? '  [' + out.adapter + ']' : ''}\ndepth: ${out.depth}${HP ? '  high-precision matrices' : ''}${FLOAT ? '  floating origin' : ''}${POST ? '  post chain' : ''}\nscene: ${SCENE}${world ? ' / ' + STOP : ''}   ${fps.toFixed(0)} fps` +
      (b ? `\nBENCH: ${b.frameMs} ms a frame (${b.cpuMs} ms of it in JavaScript), ${out.calls} draws, ${out.triangles} triangles` : '') +
      (warnings.length ? `\n${warnings.length} warnings (see console)` : ''));
    requestAnimationFrame(loop);
  };
  draw();
  await finish();
  out.ready = true;
  requestAnimationFrame(loop);
}

main().catch((e) => { out.error = String(e?.message ?? e); out.ready = true; say('FAILED: ' + out.error); console.error(e); });
