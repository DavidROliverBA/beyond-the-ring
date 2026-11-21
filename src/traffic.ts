// Ships on routes. Each one flies a straight line from a spot near one port to a spot near
// another: it burns toward the goal, flips at the half-way point and burns to a stop, waits
// a while as if docking, then picks its next destination. Ships are their true size (tens to
// a few hundred metres), so from far off they are only a glint at the stern; the model
// appears when it would be a pixel or more across.
//
// Positions are kept in doubles on the objects (the renderer works them out relative to the
// camera) and glints are stored relative to their fleet's origin, so nothing jitters.

import * as THREE from 'three';
import { buildModel, type ShipModel } from './ships';
import { rng } from './textures';

type V3 = THREE.Vector3;

/** Lengths in metres. */
const KINDS: { model: ShipModel; m: number; w: number }[] = [
  { model: 'racer', m: 25, w: 6 },
  { model: 'corvette', m: 46, w: 4 },
  { model: 'freighter', m: 100, w: 6 },
  { model: 'survey', m: 120, w: 1.6 },
  { model: 'stealth', m: 150, w: 0.4 },
  { model: 'hauler', m: 300, w: 2.5 },
  { model: 'battleship', m: 475, w: 0.35 },
  { model: 'dreadnought', m: 800, w: 0.15 },
];

/** A place ships go: a shell round a point, in scene units. */
export interface Port {
  pos: V3;
  inner: number;
  outer: number;
}

export interface Fleet {
  ports: Port[];
  n: number;
  /** Only these models. */
  only?: ShipModel[];
  /** For a fleet that keeps to one small place: how big that place is. Seen from so far off that
   *  the whole place is a pixel or two, its glints dim with distance, or a hundred of them piled
   *  on one spot would blaze like a star. */
  knot?: number;
}

export const M_PER_UNIT = 149597870700 / 1000; // 1 scene unit is 1/1000 AU
export const SOL_UNIT = 1 / M_PER_UNIT;        // scene units per metre in Sol

interface Craft {
  g: THREE.Group;
  fleet: number;
  len: number;
  port: number;
  from: V3;
  to: V3;
  t0: number;
  dur: number;
  hold: number;
  qa: THREE.Quaternion;
  qb: THREE.Quaternion;
  pos: V3;
  /** Scene units a second, worked out each tick. */
  vel: V3;
  tint: THREE.Color;
  model: ShipModel;
  name: string;
}

/** What the map needs to know about a ship under way: `pos` and `vel` stay live. */
export interface CraftInfo { name: string; model: ShipModel; len: number; pos: V3; vel: V3; fleet: number }

const NAMES = ['Cassiopeia', 'Anubis', 'Rosalind', 'Kestrel', 'Meridian', 'Ananke', 'Tamsin', 'Orpheus', 'Halcyon', 'Valkyrie', 'Marduk', 'Pelican', 'Sojourner', 'Calypso', 'Borealis', 'Wayfarer', 'Lodestar', 'Ceto', 'Amity', 'Gannet', 'Ixion', 'Perdita', 'Vesper', 'Skylark', 'Narwhal', 'Zephyr', 'Corsair', 'Tern', 'Argo', 'Mistral', 'Thessaly', 'Ondine'];
const LABEL: Record<string, string> = { racer: 'Racer', corvette: 'Corvette', freighter: 'Freighter', survey: 'Survey ship', stealth: 'Stealth ship', hauler: 'Ice hauler', battleship: 'Warship', dreadnought: 'Capital ship' };

const _up = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _flip = new THREE.Quaternion().setFromAxisAngle(_up, Math.PI);
const _d = new THREE.Vector3();
const _p = new THREE.Vector3();

export function makeTraffic(fleets: Fleet[], seed: number, unit = SOL_UNIT, vLocal = 450) {
  const r = rng(seed);
  const group = new THREE.Group();
  const crafts: Craft[] = [];
  const templates = new Map<ShipModel, THREE.Group>();
  const tpl = (m: ShipModel) => {
    let t = templates.get(m);
    if (!t) { t = buildModel(m); templates.set(m, t); }
    return t;
  };

  const pointAt = (p: Port, out: V3) => {
    // Mostly close in, a few well out; a little flattened towards the plane of the system.
    const d = p.inner + (p.outer - p.inner) * r() ** 1.6;
    const y = (r() * 2 - 1) * 0.6, a = r() * Math.PI * 2, w = Math.sqrt(1 - y * y);
    return out.set(w * Math.cos(a), y, w * Math.sin(a)).multiplyScalar(d).add(p.pos);
  };

  const pickKind = (only?: ShipModel[]) => {
    const pool = only ? KINDS.filter((k) => only.includes(k.model)) : KINDS;
    let x = r() * pool.reduce((a, k) => a + k.w, 0);
    for (const k of pool) { x -= k.w; if (x <= 0) return k; }
    return pool[0];
  };

  const plan = (c: Craft, now: number, f: Fleet) => {
    c.from.copy(c.to);
    let next = Math.floor(r() * f.ports.length);
    if (f.ports.length > 1 && next === c.port && r() < 0.7) next = (next + 1) % f.ports.length;
    c.port = next;
    pointAt(f.ports[next], c.to);
    const D = c.from.distanceTo(c.to);
    c.dur = Math.min(140, Math.max(20, D / (vLocal * unit)));
    c.t0 = now;
    c.hold = 4 + r() * 30;
    _d.copy(c.to).sub(c.from);
    if (_d.lengthSq() < 1e-30) _d.set(0, 0, -1);
    _d.normalize();
    // lookAt aims -Z at its target, which is where the models' noses are.
    _m.lookAt(new THREE.Vector3(), _d, Math.abs(_d.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : _up);
    c.qa.setFromRotationMatrix(_m);
    c.qb.copy(c.qa).multiply(_flip);
  };

  const glintOrigin: V3[] = fleets.map((f) => f.ports[0].pos.clone());
  const byFleet: Craft[][] = fleets.map(() => []);

  fleets.forEach((f, fi) => {
    for (let i = 0; i < f.n; i++) {
      const kind = pickKind(f.only);
      const g = tpl(kind.model).clone(true);
      const len = kind.m * unit * (0.85 + r() * 0.3);
      g.scale.setScalar(len);
      group.add(g);
      const c: Craft = {
        g, fleet: fi, len, port: Math.floor(r() * f.ports.length), from: new THREE.Vector3(), to: new THREE.Vector3(),
        t0: 0, dur: 1, hold: 0, qa: new THREE.Quaternion(), qb: new THREE.Quaternion(), pos: new THREE.Vector3(), vel: new THREE.Vector3(), model: kind.model,
        name: `${NAMES[Math.floor(r() * NAMES.length)]}-${100 + Math.floor(r() * 900)}`,
        tint: new THREE.Color(r() < 0.25 ? 0xffd9a8 : r() < 0.5 ? 0xffffff : 0x9fd8ff),
      };
      pointAt(f.ports[c.port], c.to);
      plan(c, 0, f);
      // Scatter them through their flights so the sky is busy from the first frame.
      c.t0 = -r() * (c.dur + c.hold);
      crafts.push(c);
      byFleet[fi].push(c);
    }
  });

  // Glints: one Points per fleet, positions relative to the fleet's first port.
  const glints = fleets.map((f, fi) => {
    const n = byFleet[fi].length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    byFleet[fi].forEach((c, i) => col.set([c.tint.r, c.tint.g, c.tint.b], i * 3));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    pts.frustumCulled = false;
    pts.position.copy(glintOrigin[fi]);
    group.add(pts);
    return { pos, geo, mat: pts.material };
  });

  let clock = 0;
  const q = new THREE.Quaternion();
  /** `focus` is the position of a craft we are flying beside: it is always drawn in full. */
  const tick = (dt: number, viewer: V3, focus?: V3) => {
    clock += dt;
    for (let fi = 0; fi < fleets.length; fi++) {
      const list = byFleet[fi], gl = glints[fi];
      const knot = fleets[fi].knot;
      if (knot) gl.mat.opacity = 0.95 * Math.min(1, Math.max(0.02, knot * 40 / Math.max(viewer.distanceTo(glintOrigin[fi]), 1e-30)));
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        let u = (clock - c.t0) / c.dur;
        if (u >= 1 && clock - c.t0 >= c.dur + c.hold) { plan(c, clock, fleets[fi]); u = 0; }
        const tt = Math.min(1, Math.max(0, u));
        const s = tt < 0.5 ? 2 * tt * tt : 1 - 2 * (1 - tt) * (1 - tt);
        _p.copy(c.pos);
        c.pos.copy(c.from).lerp(c.to, s);
        if (dt > 0) c.vel.copy(c.pos).sub(_p).divideScalar(dt);
        // Burn towards the goal, flip over about half-way, burn the other way to stop.
        const k = Math.min(1, Math.max(0, (tt - 0.4) / 0.2));
        q.copy(c.qa).slerp(c.qb, k * k * (3 - 2 * k));
        c.g.position.copy(c.pos);
        c.g.quaternion.copy(q);
        const d = viewer.distanceTo(c.pos);
        const show = c.pos === focus || c.len / Math.max(d, 1e-30) > 0.0018;
        c.g.visible = show;
        // The glint sits at the stern and goes out when the ship itself can be seen.
        const o = glintOrigin[fi];
        gl.pos[i * 3] = show ? 1e20 : c.pos.x - o.x;
        gl.pos[i * 3 + 1] = show ? 1e20 : c.pos.y - o.y;
        gl.pos[i * 3 + 2] = show ? 1e20 : c.pos.z - o.z;
      }
      gl.geo.attributes.position.needsUpdate = true;
    }
  };
  const info: CraftInfo[] = crafts.map((c) => ({ name: `${LABEL[c.model] ?? 'Ship'} ${c.name}`, model: c.model, len: c.len, pos: c.pos, vel: c.vel, fleet: c.fleet }));
  return { group, tick, count: crafts.length, info };
}
