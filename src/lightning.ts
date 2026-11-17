// Lightning in the night-side clouds, seen from orbit: storm cells that flicker in short bursts.
// Each cell is a soft glow on the cloud deck (all of them one instanced draw), brighter than white
// so the bloom catches it. Cells only fire where it's dark: on the day side the sun drowns them out.

import * as THREE from 'three';

let glow: THREE.Texture | null = null;
function glowTexture() {
  if (glow) return glow;
  const S = 64, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  // A small hot core lighting the cloud around it, fading fast: light scattering through cloud.
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.07, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.12)');
  grd.addColorStop(0.65, 'rgba(255,255,255,0.03)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  glow = new THREE.CanvasTexture(cv);
  return glow;
}

interface Cell { next: number; pulses: number; on: number; k: number }

/**
 * Put storm cells on a cloud deck. `deck` is the cloud mesh (cells turn with it), `R` its radius,
 * `sunDir` the direction from the planet towards its star. Returns the per-frame update.
 */
export function addLightning(deck: THREE.Mesh, R: number, sunDir: THREE.Vector3, rand: () => number, count = 60): (dt: number) => void {
  const size = R * 0.12;   // a flash lights up a few hundred kilometres of cloud
  const mat = new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const quads = new THREE.InstancedMesh(new THREE.PlaneGeometry(size, size), mat, count);
  quads.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  quads.frustumCulled = false;
  const ups: THREE.Vector3[] = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1), sc = new THREE.Vector3(), spin = new THREE.Quaternion();
  for (let i = 0; i < count; i++) {
    // Storms gather in the tropics: bias latitude towards the equator.
    const lat = (rand() - 0.5) * Math.PI * 0.75 * (0.4 + rand() * 0.6), lon = rand() * Math.PI * 2;
    const up = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
    ups.push(up);
    // Every cell a different size and shape, turned at random about its own centre.
    q.setFromUnitVectors(z, up).multiply(spin.setFromAxisAngle(z, rand() * Math.PI * 2));
    const k = 0.5 + rand();
    sc.set(k * (0.7 + rand() * 0.6), k, 1);
    m.compose(up.clone().multiplyScalar(R * 1.002), q, sc);
    quads.setMatrixAt(i, m);
    quads.setColorAt(i, new THREE.Color(0, 0, 0));
  }
  deck.add(quads);

  const cells: Cell[] = Array.from({ length: count }, () => ({ next: rand() * 8, pulses: 0, on: 0, k: 0 }));
  const c = new THREE.Color(), n = new THREE.Vector3(), deckQ = new THREE.Quaternion();
  return (dt: number) => {
    deck.getWorldQuaternion(deckQ);
    let changed = false;
    for (let i = 0; i < count; i++) {
      const cell = cells[i];
      cell.next -= dt;
      if (cell.on > 0) {
        cell.on -= dt;
        if (cell.on <= 0) {
          cell.k = 0;
          // Strikes come in quick runs of a few flickers, then the cell goes quiet for a while.
          if (cell.pulses > 0) { cell.pulses--; cell.next = 0.05 + rand() * 0.15; } else cell.next = 2 + rand() * 9;
        }
      } else if (cell.next <= 0) {
        n.copy(ups[i]).applyQuaternion(deckQ);
        if (n.dot(sunDir) < -0.08) {
          if (cell.pulses === 0) cell.pulses = Math.floor(rand() * 4);
          cell.on = 0.06 + rand() * 0.12;
          cell.k = 0.6 + rand() * 1.4;
        } else cell.next = 1 + rand() * 4;
      } else continue;
      c.setRGB(0.75 * cell.k, 0.82 * cell.k, cell.k);
      quads.setColorAt(i, c);
      changed = true;
    }
    if (changed && quads.instanceColor) quads.instanceColor.needsUpdate = true;
  };
}
