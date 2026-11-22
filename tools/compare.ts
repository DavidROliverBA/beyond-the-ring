// Comparison harness (E1.1.c): fixed camera positions and fixed exposure for the reference targets in
// docs/research/photoreal-and-renderer.md, so a shading change can be judged before and after.
//
//   bun tools/compare.ts --port 5250 --label after [--only earth-full,saturn-back] [--ref DIR] [--out DIR]
//
// Serve a build first (`bun run build`, then any static server on a copy of dist). It needs Playwright and a
// Chromium that can run WebGL: set PLAYWRIGHT to the module path if it is not installed here, and CHROME to
// the browser binary. Frames go to docs/studies/compare/<label>_<id>.jpg plus a contact sheet
// docs/studies/compare/sheet_<label>.jpg. Reference photographs are NEVER committed: the table below gives
// IDs and links only. With --ref DIR holding <id>.jpg files (any you fetched yourself), a second sheet
// sheet_<label>_vs_ref.jpg puts each reference beside the game frame; write it outside the repo (--refout).
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface Target {
  id: string;
  /** Number in the research note's table of ten. */
  n: number;
  title: string;
  /** Reference photograph (ID or link only, never the file). */
  ref: string;
  body: string;
  /** Camera distance from the body's centre, in body radii. */
  dist: number;
  /** Angle at the body between the Sun and the camera: 0 = Sun behind the camera, 180 = looking at the Sun past the body. */
  phase: number;
  /** Degrees above the body's equatorial (or ring) plane. */
  elev: number;
  /** Axial tilt about z, radians: rings and the elevation use the tilted pole. */
  tilt?: number;
  /** 'sunTangent': look along the horizon towards the Sun instead of at the centre. */
  look?: 'center' | 'sunTangent';
  /** Degrees to pitch the view down from a sunTangent look. */
  pitch?: number;
  exposure: number;
  note: string;
}

export const TARGETS: Target[] = [
  { id: 'earth-full', n: 1, title: 'Whole Earth, Sun behind camera', ref: 'NASA Apollo 17 AS17-148-22727', body: 'earth', dist: 5.2, phase: 8, elev: 12, tilt: 0.41, exposure: 1, note: 'cloud layer, blue ocean, thin blue limb' },
  { id: 'earth-glint', n: 1, title: 'Earth, ocean glint', ref: 'any NASA frame of sun glint on the ocean (e.g. ISS Earth observations)', body: 'earth', dist: 3.2, phase: 62, elev: 8, tilt: 0.41, exposure: 1, note: 'specular sun glint on water, gibbous phase' },
  { id: 'earth-limb', n: 2, title: 'Orbital sunset limb', ref: 'NASA ISS iss023e057948', body: 'earth', dist: 1.062, phase: 90, elev: 0, look: 'sunTangent', pitch: -14, exposure: 1, note: 'orange to blue layers, horizon sunset' },
  { id: 'earth-night', n: 3, title: 'Earth at night', ref: 'NASA ISS iss035e017673', body: 'earth', dist: 1.35, phase: 172, elev: 20, look: 'center', exposure: 1.6, note: 'city lights, dark ocean, airglow' },
  { id: 'saturn-back', n: 4, title: 'Saturn backlit', ref: 'NASA Cassini PIA08329 In Saturn\'s Shadow', body: 'saturn', dist: 5.5, phase: 165, elev: 6, tilt: 0.47, exposure: 1, note: 'rings glow, dark disc, bright thin limb' },
  { id: 'saturn-shadow', n: 4, title: 'Saturn, ring shadow on the globe', ref: 'any Cassini frame of the ring shadow on the globe', body: 'saturn', dist: 4.2, phase: 25, elev: 14, tilt: 0.47, exposure: 1, note: 'ring shadow across the globe; planet shadow on rings' },
  { id: 'moon-hard', n: 5, title: 'Hard-lit airless world', ref: 'NASA Apollo 8 as08-14-2383 (Earthrise)', body: 'luna', dist: 4, phase: 90, elev: 10, exposure: 1, note: 'black sky, razor terminator, no fill' },
  { id: 'pluto-twilight', n: 6, title: 'Backlit haze on a small world', ref: 'NASA New Horizons PIA19931', body: 'pluto', dist: 4, phase: 168, elev: 6, exposure: 1.4, note: 'thin blue haze around a dark disc' },
  { id: 'comet-67p', n: 7, title: 'Small body in raw sunlight', ref: 'ESA Rosetta OSIRIS, NASA PIA19040 (licence: check at source)', body: '67p', dist: 6, phase: 70, elev: 10, exposure: 1, note: 'hard terminator, near-black albedo' },
  { id: 'sun', n: 8, title: 'The Sun', ref: 'NASA SDO visible-light image (pick at sdo.gsfc.nasa.gov)', body: 'sun', dist: 3.2, phase: 0, elev: 0, exposure: 0.5, note: 'limb darkening, granulation, no glare disc' },
];

const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i].replace(/^--/, ''), process.argv[i + 1]);
const port = args.get('port') ?? '5250';
const label = args.get('label') ?? 'shot';
const out = resolve(args.get('out') ?? join(import.meta.dir, '..', 'docs', 'studies', 'compare'));
const refDir = args.get('ref');
const refOut = args.get('refout');
const only = args.get('only')?.split(',');
const [W, H] = (args.get('size') ?? '1280x720').split('x').map(Number);
const mode = args.get('mode') ?? '';
mkdirSync(out, { recursive: true });

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errs: string[] = [];
page.on('pageerror', (e: Error) => errs.push(e.message));
await page.goto(`http://localhost:${port}/?debug${mode}`);
await page.waitForSelector('#launch:not([disabled])', { timeout: 120000 });
await page.click('#launch');
await page.waitForTimeout(2500);
await page.evaluate(() => document.exitPointerLock());
await page.keyboard.press('Comma'); await page.keyboard.press('Comma'); // time paused: every frame the same sky
await page.keyboard.press('KeyV'); // out of the chase view: no ship in frame
await page.keyboard.press('KeyO'); // orbit lines off
// Photo mode (P) swallows other keys and stops the camera easing to the ship's heading, so each shot goes: place, ease, P, expose, shoot, P.
await page.addStyleTag({ content: '#photo-bar{display:none!important}' });
await page.waitForTimeout(500);

const done: Target[] = [];
for (const t of TARGETS) {
  if (only && !only.includes(t.id)) continue;
  const ok = await page.evaluate((t) => {
    const d = (globalThis as any).__dbg;
    const th = d.space.things.find((x: any) => x.id === t.body);
    if (!th) return false;
    const V = th.pos.constructor;
    const sun = new V(0, 0, 0);
    const toSun = th.pos.lengthSq() < 1e-9 ? new V(1, 0, 0) : sun.clone().sub(th.pos).normalize();   // (standing on the Sun: pick a side)
    const axis = new V(-Math.sin(t.tilt ?? 0), Math.cos(t.tilt ?? 0), 0);
    // Rotate the Sun direction about the pole by the phase angle, then lift it out of the equator.
    const ph = (t.phase * Math.PI) / 180, el = (t.elev * Math.PI) / 180;
    const flat = toSun.clone().addScaledVector(axis, -toSun.dot(axis)).normalize();
    const side = new V().crossVectors(axis, flat).normalize();
    const around = flat.clone().multiplyScalar(Math.cos(ph)).addScaledVector(side, Math.sin(ph));
    const dir = around.multiplyScalar(Math.cos(el)).addScaledVector(axis, Math.sin(el)).normalize();
    d.ship.pos.copy(th.pos).addScaledVector(dir, th.radius * t.dist);
    d.ship.prev.copy(d.ship.pos);
    d.ship.speed = 0;
    let look = th.pos.clone().sub(d.ship.pos).normalize();
    if (t.look === 'sunTangent') {
      const up = d.ship.pos.clone().sub(th.pos).normalize();
      const s = sun.clone().sub(d.ship.pos).normalize();
      const tan = s.addScaledVector(up, -s.dot(up)).normalize();
      const p = (t.pitch ?? 0) * Math.PI / 180;
      look = tan.multiplyScalar(Math.cos(p)).addScaledVector(up, Math.sin(p)).normalize();
    }
    d.faceShip(look);
    d.renderer.toneMappingExposure = t.exposure;
    return true;
  }, t);
  if (!ok) { console.log('missing body', t.body); continue; }
  await page.waitForTimeout(3000); // the camera eases to the heading; textures settle, the LOD repaints
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(300);
  await page.evaluate((e: number) => { (globalThis as any).__dbg.renderer.toneMappingExposure = e; }, t.exposure);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `${label}_${t.id}.jpg`), type: 'jpeg', quality: 90 });
  await page.keyboard.press('KeyP');
  done.push(t);
}
console.log(errs.length ? errs.slice(0, 3) : 'no page errors');
await browser.close();

// Contact sheet, assembled in a browser page so there is no image library to install.
async function sheet(file: string, withRef: boolean) {
  const b2 = await chromium.launch({ headless: true, executablePath: process.env.CHROME });
  const cols = withRef ? 2 : 2, cw = withRef ? 640 : 640;
  const cells = done.map((t) => {
    const img = `data:image/jpeg;base64,${readFileSync(join(out, `${label}_${t.id}.jpg`)).toString('base64')}`;
    let refImg = '';
    if (withRef && refDir) {
      for (const ext of ['jpg', 'jpeg', 'png']) {
        const f = join(refDir, `${t.id}.${ext}`);
        if (existsSync(f)) refImg = `<img src="data:image/${ext === 'png' ? 'png' : 'jpeg'};base64,${readFileSync(f).toString('base64')}">`;
      }
      if (!refImg) refImg = '<div class="none">no reference file</div>';
    }
    return `<figure><div class="pair"><img src="${img}">${refImg}</div><figcaption>${t.n}. ${t.title} <i>(${label}${withRef ? ' | ref: ' + t.ref : ''})</i></figcaption></figure>`;
  }).join('');
  const pg = await b2.newPage({ viewport: { width: withRef ? 1400 : 1320, height: 800 } });
  await pg.setContent(`<style>body{margin:0;background:#111;color:#ddd;font:13px system-ui}main{display:grid;grid-template-columns:repeat(${withRef ? 1 : cols},1fr);gap:8px;padding:8px}
  figure{margin:0}.pair{display:flex;gap:4px}.pair img{flex:1;min-width:0;width:100%;object-fit:cover;aspect-ratio:16/9;background:#000}.none{flex:1;display:grid;place-items:center;background:#000;color:#777}figcaption{padding:3px 0}</style><main>${cells}</main>`);
  await pg.waitForTimeout(800);
  await pg.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 88 });
  await b2.close();
}
await sheet(join(out, `sheet_${label}.jpg`), false);
if (refDir && refOut) { mkdirSync(refOut, { recursive: true }); await sheet(join(refOut, `sheet_${label}_vs_ref.jpg`), true); }
writeFileSync(join(out, `${label}_targets.json`), JSON.stringify(done.map(({ id, n, title, ref, body }) => ({ id, n, title, ref, body })), null, 1));
console.log('wrote', done.length, 'frames to', out);
