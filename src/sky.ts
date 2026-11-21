// The sky as seen from Sol: 23,000 real stars (HYG database, brightest to magnitude 7.4) in their true
// places and colours, over the Milky Way. Scene axes: the planets' plane is x-z with y up, so the
// ecliptic is the equator of the scene. Equatorial J2000 -> ecliptic is a turn of 23.44 degrees about
// x, and ecliptic -> scene is (x, y, z) = (X, Z, -Y), a proper rotation (no mirror image).
// Other star systems get the same sky turned at random, since from there it would look different.

import * as THREE from 'three';
import starsUrl from '../assets/stars/stars.bin';

const OBLIQUITY = (23.4392911 * Math.PI) / 180;
const EPS_C = Math.cos(OBLIQUITY), EPS_S = Math.sin(OBLIQUITY);

/** Equatorial (right ascension in hours, declination in degrees) to a direction in the scene. */
function toScene(raH: number, decDeg: number, out: THREE.Vector3): THREE.Vector3 {
  const a = (raH * 15 * Math.PI) / 180, d = (decDeg * Math.PI) / 180;
  const xq = Math.cos(d) * Math.cos(a), yq = Math.cos(d) * Math.sin(a), zq = Math.sin(d);
  const xe = xq, ye = yq * EPS_C + zq * EPS_S, ze = -yq * EPS_S + zq * EPS_C;
  return out.set(xe, ze, -ye);
}

/** Colour of a star from its B-V index: a blackbody at the temperature it implies (Ballesteros 2012),
 *  pulled part way to white because starlight looks paler to the eye than its true colour. */
export function starColour(ci: number, out = new THREE.Color()): THREE.Color {
  const T = 4600 * (1 / (0.92 * ci + 1.7) + 1 / (0.92 * ci + 0.62));
  const t = Math.min(400, Math.max(10, T / 100));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => Math.min(1, Math.max(0, v / 255));
  const pale = 0.4;
  return out.setRGB(c(r) * (1 - pale) + pale, c(g) * (1 - pale) + pale, c(b) * (1 - pale) + pale, THREE.SRGBColorSpace);
}

const STAR_V = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
attribute float size;
attribute vec3 tint;
uniform float scale;
varying vec3 vTint;
void main() {
  vTint = tint;
  gl_PointSize = size * scale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const STAR_F = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
varying vec3 vTint;
void main() {
  #include <logdepthbuf_fragment>
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(vTint * a * a, 1.0);
}`;

// The Milky Way map is galactic: centre in the middle, longitude growing to the left, north at the
// bottom (found by matching its bright points to the catalogue). Each pixel of the dome looks up
// its own place in that map, so it lines up with the stars exactly.
const DOME_V = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const DOME_F = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform sampler2D map; uniform float gain;
uniform mat3 toGalactic;
varying vec3 vDir;
void main() {
  #include <logdepthbuf_fragment>
  vec3 g = toGalactic * normalize(vDir);
  float l = atan(g.y, g.x), b = asin(clamp(g.z, -1.0, 1.0));
  vec2 uv = vec2(fract(0.5 - l / 6.28318530718), 0.5 - b / 3.14159265359);
  gl_FragColor = vec4(texture2D(map, uv).rgb * gain, 1.0);
  #include <colorspace_fragment>
}`;

/** Scene direction -> galactic direction (columns of the scene->ecliptic->equatorial->galactic chain). */
function galacticMatrix(): THREE.Matrix3 {
  // Equatorial -> galactic (J2000), rows are the galactic x, y, z axes in equatorial coordinates.
  const EQ_TO_GAL = [
    -0.0548755604, -0.8734370902, -0.4838350155,
    0.4941094279, -0.44482963, 0.7469822445,
    -0.867666149, -0.1980763734, 0.4559837762,
  ];
  // Scene -> equatorial: (x, y, z) -> ecliptic (X, Y, Z) = (x, -z, y), then turn by the obliquity.
  const m = new THREE.Matrix3();
  const rows: number[][] = [];
  for (let r = 0; r < 3; r++) {
    const [gx, gy, gz] = [EQ_TO_GAL[r * 3], EQ_TO_GAL[r * 3 + 1], EQ_TO_GAL[r * 3 + 2]];   // galactic axis r in equatorial
    // Same axis in ecliptic: inverse obliquity turn about X.
    const ex = gx, ey = gy * EPS_C + gz * EPS_S, ez = -gy * EPS_S + gz * EPS_C;
    // ... and in the scene: x = X, y = Z, z = -Y.
    rows.push([ex, ez, -ey]);
  }
  m.set(rows[0][0], rows[0][1], rows[0][2], rows[1][0], rows[1][1], rows[1][2], rows[2][0], rows[2][1], rows[2][2]);
  return m;
}

export interface Sky {
  group: THREE.Group;
  /** Sol shows the true sky; every other system gets it turned at random. */
  setSystem(id: string): void;
}

export function makeSky(loadTex: (url: string, srgb?: boolean) => Promise<THREE.Texture>, milkyWayUrl: string, R = 1e6): Sky {
  const group = new THREE.Group();
  const inner = new THREE.Group();              // turned per system; the dome and stars share it
  group.add(inner);

  // Milky Way.
  const domeMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: null }, gain: { value: 1.7 }, toGalactic: { value: galacticMatrix() } },
    vertexShader: DOME_V, fragmentShader: DOME_F, side: THREE.BackSide, depthWrite: false,
  });
  const dome = new THREE.Mesh<THREE.SphereGeometry, THREE.Material>(new THREE.SphereGeometry(R * 0.9, 64, 32), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, depthWrite: false, fog: false }));
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  inner.add(dome);
  void loadTex(milkyWayUrl, false).then((t) => {
    t.minFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    t.wrapS = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    domeMat.uniforms.map.value = t;
    dome.material = domeMat;
  });

  // The stars.
  const starMat = new THREE.ShaderMaterial({
    uniforms: { scale: { value: 1 } }, vertexShader: STAR_V, fragmentShader: STAR_F,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  void (async () => {
    const buf = await (await fetch(starsUrl)).arrayBuffer();
    const n = buf.byteLength / 6, v = new DataView(buf);
    const pos = new Float32Array(n * 3), tint = new Float32Array(n * 3), size = new Float32Array(n);
    const dir = new THREE.Vector3(), col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const ra = (v.getUint16(i * 6, true) / 65535) * 24, dec = (v.getInt16(i * 6 + 2, true) / 32767) * 90;
      const mag = v.getUint8(i * 6 + 4) / 25 - 1.5, ci = v.getInt8(i * 6 + 5) / 40;
      toScene(ra, dec, dir).multiplyScalar(R);
      pos.set([dir.x, dir.y, dir.z], i * 3);
      starColour(ci, col);
      // Brightness climbs steeply with magnitude: the faintest are barely there, the brightest glow.
      // Above 1 the bloom picks the star up (Sirius, Canopus, Arcturus, Vega).
      const lum = Math.min(3.5, 0.06 * Math.pow(10, 0.2 * (6.5 - mag)));
      tint.set([col.r * lum, col.g * lum, col.b * lum], i * 3);
      size[i] = Math.max(1.3, Math.min(7.5, 1.3 + (5.8 - mag) * 0.62));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const pts = new THREE.Points(geo, starMat);
    pts.frustumCulled = false;
    // Point sizes are in device pixels: keep stars the same apparent size on a Retina screen.
    pts.onBeforeRender = () => { starMat.uniforms.scale.value = Math.min(devicePixelRatio, 2); };
    inner.add(pts);
  })().catch((e) => console.warn('The star catalogue did not load.', e));

  const q = new THREE.Quaternion();
  return {
    group,
    setSystem(id) {
      if (id === 'sol') { inner.quaternion.identity(); return; }
      let h = 7;
      for (const c of id) h = (h * 131 + c.charCodeAt(0)) >>> 0;
      const r = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
      q.set(r() - 0.5, r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      inner.quaternion.copy(q);
    },
  };
}
