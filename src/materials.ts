// Scanned surfaces (colour, relief and roughness) from ambientCG, all CC0.

import * as THREE from 'three';
import platesC from '../assets/pbr/plates_color.jpg';
import platesN from '../assets/pbr/plates_normal.jpg';
import platesR from '../assets/pbr/plates_rough.jpg';
import walkwayC from '../assets/pbr/walkway_color.jpg';
import walkwayN from '../assets/pbr/walkway_normal.jpg';
import walkwayR from '../assets/pbr/walkway_rough.jpg';
import darkmetalC from '../assets/pbr/darkmetal_color.jpg';
import darkmetalN from '../assets/pbr/darkmetal_normal.jpg';
import darkmetalR from '../assets/pbr/darkmetal_rough.jpg';
import rockC from '../assets/pbr/rock_color.jpg';
import rockN from '../assets/pbr/rock_normal.jpg';
import rockR from '../assets/pbr/rock_rough.jpg';
import concreteC from '../assets/pbr/concrete_color.jpg';
import concreteN from '../assets/pbr/concrete_normal.jpg';
import concreteR from '../assets/pbr/concrete_rough.jpg';
import slabC from '../assets/pbr/slab_color.jpg';
import slabN from '../assets/pbr/slab_normal.jpg';
import slabR from '../assets/pbr/slab_rough.jpg';
import dirtC from '../assets/pbr/dirt_color.jpg';
import dirtN from '../assets/pbr/dirt_normal.jpg';
import dirtR from '../assets/pbr/dirt_rough.jpg';

export type ScanName = 'plates' | 'walkway' | 'darkmetal' | 'rock' | 'concrete' | 'slab' | 'dirt';

const URLS: Record<ScanName, [color: string, normal: string, rough: string]> = {
  plates: [platesC, platesN, platesR],
  walkway: [walkwayC, walkwayN, walkwayR],
  darkmetal: [darkmetalC, darkmetalN, darkmetalR],
  rock: [rockC, rockN, rockR],
  concrete: [concreteC, concreteN, concreteR],
  slab: [slabC, slabN, slabR],
  dirt: [dirtC, dirtN, dirtR],
};

export interface Scan { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }

const loader = new THREE.TextureLoader();
const cache = new Map<string, Scan>();

/** One scanned surface. `rx`, `ry` say how many times it repeats across a mesh's own UVs. */
export function scan(name: ScanName, rx = 1, ry = rx): Scan {
  const key = `${name}:${rx}:${ry}`;
  let s = cache.get(key);
  if (!s) {
    const load = (url: string, srgb: boolean) => {
      const t = loader.load(url);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.anisotropy = 8;
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      return t;
    };
    const [c, n, r] = URLS[name];
    s = { map: load(c, true), normalMap: load(n, false), roughnessMap: load(r, false) };
    cache.set(key, s);
  }
  return s;
}
