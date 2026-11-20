// The true-scale test scene for the WebGPU spike: the Sun, Earth with its cloud deck and storm
// cells, Luna, and the Rocinante (46 m) a few metres from the camera. One scene unit is 1/1000 AU,
// exactly as in the game, and nothing is re-centred unless asked: the camera really does sit
// about 1,000 units from the origin looking at a ship 0.0000003 units long.
//
// Only classes from three's shared core are used here, so the same scene runs on the classic
// WebGLRenderer and on WebGPURenderer.

import * as THREE from 'three';
import { buildModel } from '../src/ships';
import earthHi from '../assets/tex/earth_hi.jpg';
import earthNight from '../assets/tex/earth_night_hi.jpg';
import earthClouds from '../assets/tex/earth_clouds_hi.jpg';
import moonHi from '../assets/tex/moon_hi.jpg';

/** Scene units per metre (1 unit = 1/1000 AU). */
export const M = 1000 / 149597870700;
export const KM = M * 1000;
export const EARTH_R = 0.04259, SUN_R = 4.65, LUNA_R = 0.01161;
export const CLOUD_K = 1.012, CELL_K = 1.002;   // the game's cloud deck and its lightning cells
export const NEAR = 1e-9, FAR = 4e6;

export type Stop = '20m' | '5km' | 'leo';
export type View = 'beauty' | 'id' | 'truth';

const V3 = THREE.Vector3;
const tex = (url: string, colour = true) => {
  const t = new THREE.TextureLoader().load(url);
  if (colour) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

/** What the two renderers do differently: Earth's night lights, and the air. */
export interface Kit {
  /** Make the city lights show only on the night side. */
  nightOnly(mat: THREE.MeshStandardMaterial, night: THREE.Texture, sunDir: THREE.Vector3): void;
  /** The air shell's material. `cam` is filled in each frame: the camera relative to the planet. */
  atmosphere(R: number, beta: THREE.Vector3, sunDir: THREE.Vector3, cam: THREE.Vector3, strength: number): THREE.Material;
}

export interface World {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Everything hangs off this, so the whole world can be slid to put the camera at the origin. */
  root: THREE.Group;
  ship: THREE.Object3D;
  place(stop: Stop, floating: boolean): void;
  show(view: View): void;
  /** Draw the picture the depth buffer should give, worked out without trusting it. */
  drawTruth(renderer: { autoClear: boolean; clear(): void; clearDepth(): void; render(s: THREE.Scene, c: THREE.Camera): void }): void;
  draw(renderer: { autoClear: boolean; render(s: THREE.Scene, c: THREE.Camera): void }): void;
  /** Every material the scene can show, in any view. */
  materials(): THREE.Material[];
  /** Camera position in world units (kept in JavaScript's 64-bit numbers). */
  eye: THREE.Vector3;
}

/** `farK` multiplies every far plane: the classic renderer's patched depth needs far scaled by its K. */
export function buildWorld(kit: Kit, farK = 1): World {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  scene.add(root);
  const camera = new THREE.PerspectiveCamera(60, 1, NEAR, FAR);
  scene.add(camera);

  // Where things are: the Sun at the origin, Earth one AU out at the game's angle.
  const earthPos = new V3(Math.cos(4.0), 0, Math.sin(4.0)).multiplyScalar(1000);
  const sunDir = earthPos.clone().negate().normalize();          // from Earth towards the Sun
  const side = new V3().crossVectors(new V3(0, 1, 0), sunDir).normalize();

  // Every body has a beauty material and a flat "which object is this" colour for the depth check.
  // (The hand-ordered picture has its own copies with the depth test off, rather than flipping the
  // switch on shared ones: a renderer may not rebuild a shader when only that switch changes.)
  interface Part { o: THREE.Mesh; beauty: THREE.Material; flat: THREE.Material; blind: THREE.Material; order: number }
  const parts: Part[] = [];
  const flat = (c: number, side: THREE.Side = THREE.FrontSide) => new THREE.MeshBasicMaterial({ color: c, side, toneMapped: false });
  const blind = (m: THREE.Material) => { const b = m.clone(); b.depthTest = false; b.depthWrite = false; return b; };
  const add = (o: THREE.Mesh, id: number, order: number) => { const f = flat(id); parts.push({ o, beauty: o.material as THREE.Material, flat: f, blind: blind(f), order }); root.add(o); return o; };

  const sunMat = new THREE.MeshBasicMaterial();
  sunMat.color.setScalar(1.7);
  add(new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 128, 64), sunMat), 0xffff00, 0);
  root.add(new THREE.PointLight(0xffffff, 3.4, 0, 0));
  root.add(new THREE.AmbientLight(0x8fa0c0, 0.16));

  const luna = add(new THREE.Mesh(new THREE.SphereGeometry(LUNA_R, 64, 32), new THREE.MeshStandardMaterial({ map: tex(moonHi), roughness: 1 })), 0x808080, 1);
  luna.position.copy(earthPos).addScaledVector(side, -2.2).addScaledVector(sunDir, -1.3);

  const night = tex(earthNight);
  const earthMat = new THREE.MeshStandardMaterial({ map: tex(earthHi), roughness: 1, metalness: 0, emissive: 0xffffff, emissiveMap: night, emissiveIntensity: 1.5 });
  kit.nightOnly(earthMat, night, sunDir);
  const earth = add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 128, 64), earthMat), 0x0000ff, 2);
  earth.position.copy(earthPos);
  earth.rotation.y = 2.2;

  // Clouds 76 km up and storm cells 13 km above those: the layers most likely to fight for depth
  // when the planet is seen from tens of thousands of kilometres away.
  const cloudMat = new THREE.MeshStandardMaterial({ alphaMap: tex(earthClouds, false), transparent: true, roughness: 1, depthWrite: false });
  const clouds = add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * CLOUD_K, 96, 48), cloudMat), 0x00ffff, 3);
  clouds.position.copy(earthPos);

  const cellGeo = new THREE.PlaneGeometry(EARTH_R * 0.05, EARTH_R * 0.05);
  const cellMat = new THREE.MeshBasicMaterial({ color: 0xbfd0ff, transparent: true, opacity: 0.0, depthWrite: false });
  const cellFlat = flat(0xff00ff), cellBlind = blind(cellFlat);
  const cells: THREE.Mesh[] = [];
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 400; i++) {
    const y = rand() * 2 - 1, a = rand() * Math.PI * 2, q = Math.sqrt(1 - y * y);
    const up = new V3(q * Math.cos(a), y, q * Math.sin(a));
    const cell = new THREE.Mesh(cellGeo, cellMat);
    cell.position.copy(earthPos).addScaledVector(up, EARTH_R * CLOUD_K * CELL_K);
    cell.quaternion.setFromUnitVectors(new V3(0, 0, 1), up);
    root.add(cell);
    cells.push(cell);
    parts.push({ o: cell, beauty: cellMat, flat: cellFlat, blind: cellBlind, order: 4 });
  }

  // The air: the game's scattering shell.
  const tint = new THREE.Color('#5aa8ff');
  const beta = new V3(tint.r, tint.g, tint.b).multiplyScalar(220 / Math.max(tint.r, tint.g, tint.b));
  const camRel = new V3();
  const airMat = kit.atmosphere(EARTH_R, beta, sunDir, camRel, 1.3);
  const air = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.015, 96, 48), airMat);
  air.position.copy(earthPos);
  root.add(air);

  // The Rocinante, scaled so the hull is 46 m long.
  const ship = new THREE.Group();
  const hull = buildModel('corvette');
  const box = new THREE.Box3().setFromObject(hull), size = box.getSize(new V3());
  hull.position.copy(box.getCenter(new V3())).negate();
  const fit = new THREE.Group();
  fit.add(hull);
  fit.scale.setScalar((46 * M) / Math.max(size.x, size.y, size.z));
  ship.add(fit);
  root.add(ship);
  const shipBeauty = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const shipFlat = new THREE.MeshNormalMaterial();
  const shipHide: THREE.Object3D[] = [];
  ship.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) shipBeauty.set(m, m.material); else if ((o as THREE.Sprite).isSprite) shipHide.push(o);
  });
  const shipR = 23 * M;

  const eye = new V3();
  const tight = camera.clone();
  let floating = false;

  const w: World = {
    scene, camera, root, ship, eye,
    materials: () => [...new Set([...parts.flatMap((p) => [p.beauty, p.flat, p.blind]), shipFlat, airMat, ...[...shipBeauty.values()].flat()])],
    place(stop, float) {
      floating = float;
      // Along which direction we look, where the ship is, and how far back the camera sits.
      const shipAt = new V3(), look = new V3(), up = new V3(0, 1, 0);
      let back = 20 * M, drop = 0.42;
      if (stop === 'leo') {
        // 400 km up, just past the terminator, looking along the ground towards sunrise.
        const out = sunDir.clone().multiplyScalar(Math.cos(1.92)).addScaledVector(side, Math.sin(1.92));
        shipAt.copy(earthPos).addScaledVector(out, EARTH_R + 400 * KM);
        look.copy(sunDir).addScaledVector(out, -sunDir.dot(out)).normalize();
        up.copy(out);
        drop = 0.3;
      } else {
        // 18,000 km out on the night side, with Earth and the Sun about forty degrees apart.
        const out = sunDir.clone().multiplyScalar(Math.cos(2.44)).addScaledVector(side, Math.sin(2.44));
        shipAt.copy(earthPos).addScaledVector(out, 0.12);
        const toEarth = out.clone().negate();
        look.copy(toEarth).add(sunDir).normalize();
        if (stop === '5km') { back = 5000 * M; drop = 0.05; }
      }
      // The camera sits `back` behind the ship and a little above, so the ship is low in the frame.
      const right = new V3().crossVectors(look, up).normalize();
      const trueUp = new V3().crossVectors(right, look).normalize();
      eye.copy(shipAt).addScaledVector(look, -back * Math.cos(drop)).addScaledVector(trueUp, back * Math.sin(drop));
      const m = new THREE.Matrix4().lookAt(new V3(), look, trueUp);
      camera.quaternion.setFromRotationMatrix(m);
      // Nose away from us and a quarter turn off, so we see the hull's length.
      ship.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new V3(), look.clone().addScaledVector(right, 0.9).normalize(), trueUp));
      ship.position.copy(shipAt);
      if (floating) { camera.position.set(0, 0, 0); root.position.copy(eye).negate(); } else { camera.position.copy(eye); root.position.set(0, 0, 0); }
      camRel.copy(eye).sub(earthPos);
      (airMat as THREE.Material).side = camRel.length() < EARTH_R * 1.015 ? THREE.BackSide : THREE.FrontSide;
      camera.near = NEAR; camera.far = FAR * farK;
      camera.updateProjectionMatrix();
      scene.updateMatrixWorld(true);
      // A second camera in the same place whose near and far planes hug the ship: ordinary depth
      // is exact over so short a range, so it gives the right answer for the hull.
      const d = eye.distanceTo(shipAt);
      tight.copy(camera);
      tight.near = Math.max(d - shipR * 1.2, shipR * 0.02) * 0.5;
      tight.far = (d + shipR * 1.2) * 2 * farK;
      tight.updateProjectionMatrix();
    },
    show(view) {
      const truth = view === 'truth', beauty = view === 'beauty';
      for (const p of parts) {
        p.o.material = beauty ? p.beauty : truth ? p.blind : p.flat;
        p.o.renderOrder = truth ? p.order : 0;
      }
      air.visible = beauty;
      for (const s of shipHide) s.visible = beauty;
      for (const [m, mat] of shipBeauty) m.material = beauty ? mat : shipFlat;
    },
    draw(renderer) {
      for (const p of parts) p.o.visible = true;
      ship.visible = true;
      renderer.autoClear = true;
      renderer.render(scene, camera);
    },
    drawTruth(renderer) {
      // Far to near with the depth test off: Sun, Luna, Earth, clouds, storm cells. All are convex
      // and drawn front faces only, so painting them in that order is exact.
      for (const p of parts) p.o.visible = true;
      ship.visible = false;
      renderer.autoClear = true;
      renderer.render(scene, camera);
      // Then the ship on top, with depth it can trust.
      for (const p of parts) p.o.visible = false;
      ship.visible = true;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, tight);
      renderer.autoClear = true;
      for (const p of parts) p.o.visible = true;
    },
  };
  void luna; void clouds; void cells;
  return w;
}
