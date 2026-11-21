// The star map: a page (M) showing where everything is, with a course plotter.
//
// The chart is a plan view from above the ecliptic with a logarithmic scale outward from the star:
// Sol runs from Mercury to Neptune, a hundred times further, and a plain scale would crush the inner
// planets into the Sun. Angles are true. Moons, stations and ships gather round their planet and
// spread out as you zoom in. Pick a place, and the map draws the true route there (a straight line in
// space, so it bends on this chart), marks where the ship will turn end over end to slow down, and
// says how long it will take; PLOT COURSE hands it to the autopilot.

import * as THREE from 'three';
import { planTrip } from './course';

export interface MapThing {
  id: string; name: string; sub: string; desc: string; kind: string;
  pos: THREE.Vector3; radius: number; indent: boolean; parent?: string; nav: boolean;
  to?: { space: string; gate: string };
}
export interface MapHost {
  space(): { id: string; name: string; things: MapThing[]; maxSpeed: number };
  ship(): { pos: THREE.Vector3; fwd: THREE.Vector3; speed: number };
  viewpoint(th: MapThing): THREE.Vector3;
  plot(th: MapThing): void;
  target(): MapThing | null;
  status(): string;
  dist(units: number): string;
  speed(v: number): string;
  canOpen(): boolean;
}
export interface StarMap { open(): void; close(): void; toggle(): void; isOpen(): boolean }

const CSS = `
#map { position: fixed; inset: 0; z-index: 22; display: none; background: radial-gradient(ellipse at 55% 50%, #07101d 0%, #02050b 80%); color: #cfe3f2; font: 12px/1.45 ui-monospace, "SF Mono", Menlo, monospace; }
body.map-open #map { display: flex; }
body.map-open #hud, body.map-open #labels { visibility: hidden; }
#map-side { width: 280px; flex: none; display: flex; flex-direction: column; padding: 14px 12px; border-right: 1px solid rgba(143,220,255,0.18); background: rgba(3,8,16,0.7); }
#map-title { font-size: 11px; letter-spacing: 0.22em; color: #8fdcff; margin: 0 4px 2px; }
#map-sub { font-size: 10px; color: #6f8aa0; margin: 0 4px 10px; letter-spacing: 0.06em; }
#map-filter { background: rgba(0,0,0,0.4); border: 1px solid rgba(143,220,255,0.25); border-radius: 3px; color: #fff; font: inherit; padding: 5px 8px; margin: 0 2px 8px; outline: none; }
#map-filter:focus { border-color: #8fdcff; }
#map-list { overflow-y: auto; flex: 1; }
.map-row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 6px; border-radius: 3px; cursor: pointer; white-space: nowrap; }
.map-row:hover { background: rgba(143,220,255,0.12); }
.map-row.sel { background: rgba(143,220,255,0.24); color: #fff; }
.map-row.kid { padding-left: 18px; color: #9fb6c8; }
.map-row .d { color: #6f8aa0; flex: none; }
.map-row .n { overflow: hidden; text-overflow: ellipsis; }
.map-more { padding: 6px; color: #6f8aa0; font-size: 11px; }
#map-stage { position: relative; flex: 1; min-width: 0; }
#map-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; }
#map-canvas.drag { cursor: grabbing; }
#map-status { position: absolute; top: 14px; left: 18px; font-size: 11px; letter-spacing: 0.14em; color: #ffb25a; pointer-events: none; }
#map-close { position: absolute; top: 10px; right: 14px; background: rgba(143,220,255,0.12); border: 1px solid rgba(143,220,255,0.3); color: #8fdcff; font: inherit; padding: 4px 10px; border-radius: 3px; cursor: pointer; }
#map-close:hover { background: rgba(143,220,255,0.28); color: #fff; }
#map-card { position: absolute; right: 16px; bottom: 16px; width: 300px; padding: 12px 14px; background: rgba(4,10,20,0.88); border: 1px solid rgba(143,220,255,0.28); border-radius: 4px; display: none; }
#map-card h3 { margin: 0; font-size: 15px; font-weight: 400; letter-spacing: 0.12em; color: #fff; text-transform: uppercase; }
#map-card .k { font-size: 10px; color: #ffb25a; letter-spacing: 0.1em; margin-bottom: 6px; }
#map-card p { margin: 6px 0; color: #a9bfd0; font: 12px/1.45 -apple-system, "Helvetica Neue", sans-serif; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
#map-card .row { display: flex; justify-content: space-between; color: #8aa3b6; }
#map-card .row b { color: #cfe3f2; font-weight: 400; }
#map-plot { margin-top: 10px; width: 100%; background: rgba(255,178,90,0.16); border: 1px solid rgba(255,178,90,0.55); color: #ffcf8f; font: inherit; letter-spacing: 0.16em; padding: 8px; border-radius: 3px; cursor: pointer; }
#map-plot:hover { background: rgba(255,178,90,0.34); color: #fff; }
#map-hint { position: absolute; left: 18px; bottom: 14px; font-size: 10px; color: #5f788c; letter-spacing: 0.06em; pointer-events: none; }
#map-btn { position: absolute; left: 16px; bottom: 18px; pointer-events: auto; background: rgba(143,220,255,0.12); border: 1px solid rgba(143,220,255,0.3); color: #8fdcff; font: 11px ui-monospace, Menlo, monospace; letter-spacing: 0.14em; padding: 5px 10px; border-radius: 3px; cursor: pointer; }
#map-btn:hover { background: rgba(143,220,255,0.28); color: #fff; }
body:not(.started) #map-btn, body.walking #map-btn { display: none; }
`;

const KIND = {
  star: { c: '#ffc46b', r: 7 }, planet: { c: '#7fd0ff', r: 3.6 }, moon: { c: '#9fc3d6', r: 2.1 }, dwarf: { c: '#a5b4d6', r: 3 },
  asteroid: { c: '#8a96a6', r: 2 }, station: { c: '#c79bff', r: 3.4 }, ship: { c: '#7dffb0', r: 2.4 }, artifact: { c: '#ffd45a', r: 3.6 }, gate: { c: '#4f9cff', r: 1.7 },
} as Record<string, { c: string; r: number }>;
const LABELLED = new Set(['star', 'planet', 'dwarf', 'station', 'artifact']);

export function createMap(host: MapHost): StarMap {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const root = document.createElement('div');
  root.id = 'map';
  root.innerHTML = `
    <div id="map-side"><div id="map-title">STAR MAP</div><div id="map-sub"></div>
      <input id="map-filter" type="text" placeholder="Find a place…" autocomplete="off" spellcheck="false">
      <div id="map-list"></div></div>
    <div id="map-stage"><canvas id="map-canvas"></canvas><div id="map-status"></div>
      <button id="map-close">CLOSE · M</button>
      <div id="map-card"><div class="k"></div><h3></h3><p></p>
        <div class="row"><span>Distance</span><b id="mc-dist"></b></div>
        <div class="row"><span>Trip</span><b id="mc-trip"></b></div>
        <button id="map-plot">PLOT COURSE</button></div>
      <div id="map-hint">drag to move · wheel to zoom · click a place · double-click or Enter plots the course · F finds your ship · M or Esc closes</div></div>`;
  document.body.append(root);
  const btn = document.createElement('button');
  btn.id = 'map-btn';
  btn.textContent = 'MAP · M';
  document.getElementById('hud')?.append(btn);

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const canvas = $<HTMLCanvasElement>('#map-canvas'), ctx = canvas.getContext('2d')!;
  const filter = $<HTMLInputElement>('#map-filter'), listEl = $<HTMLElement>('#map-list');
  const card = $<HTMLElement>('#map-card');

  let isOpen = false, raf = 0, listClock = 0;
  let W = 1, H = 1, dpr = 1;
  let zoom = 1, panX = 0, panY = 0;
  let selected: MapThing | null = null, hovered: MapThing | null = null;
  let things: MapThing[] = [], listed: MapThing[] = [], byId = new Map<string, MapThing>(), kids = new Map<string, MapThing[]>();
  let r0 = 1, rmax = 1, Rpx = 300;
  const markers: { t: MapThing; x: number; y: number }[] = [];

  const rho = (p: THREE.Vector3) => Math.hypot(p.x, p.z);
  /** Chart position (before pan and zoom) of a place in space. */
  const chart = (p: THREE.Vector3): [number, number] => {
    const r = (Rpx * Math.log(1 + rho(p) / r0)) / Math.log(1 + rmax / r0), a = Math.atan2(p.z, p.x);
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const screen = (c: [number, number]): [number, number] => [W / 2 + c[0] * zoom + panX, H / 2 + c[1] * zoom + panY];

  function layout() {
    const sp = host.space();
    // Everything is drawn; the list holds the places you can name (the other gates turn up when you search).
    things = sp.things;
    listed = things.filter((t) => t.nav);
    byId = new Map(things.map((t) => [t.id, t]));
    kids = new Map();
    for (const t of things) if (t.parent && byId.has(t.parent)) kids.set(t.parent, [...(kids.get(t.parent) ?? []), t]);
    for (const [pid, list] of kids) { const pp = byId.get(pid)!.pos; list.sort((a, b) => a.pos.distanceTo(pp) - b.pos.distanceTo(pp)); }
    const top = things.filter((t) => !t.parent && t.kind !== 'gate' && rho(t.pos) > 0).map((t) => rho(t.pos)).sort((a, b) => a - b);
    rmax = Math.max(1e-9, ...things.map((t) => rho(t.pos)), rho(host.ship().pos));
    // The ring space is a million kilometres across with Medina a few kilometres from its centre: a far smaller
    // inner scale there, or they would sit on top of each other.
    r0 = sp.id === 'slow' ? rmax * 3e-5 : (top[Math.floor(top.length * 0.1)] ?? rmax * 0.01);
    $('#map-sub').textContent = `${sp.name} · ${listed.length.toLocaleString()} places${things.length > listed.length ? ` · ${(things.length - listed.length).toLocaleString()} uncharted gates` : ''}`;
    if (selected && !byId.has(selected.id)) selected = null;
  }

  /** Where a place is drawn, with moons and the like gathered round their planet. */
  function place(t: MapThing): [number, number] | null {
    const par = t.parent ? byId.get(t.parent) : null;
    if (!par) return screen(chart(t.pos));
    const open = zoom >= 2.2 || selected === t || selected === par || hovered === par || hovered === t || (selected?.parent === par.id);
    if (!open) return null;
    const sibs = kids.get(par.id)!, idx = sibs.indexOf(t);
    const [px, py] = screen(chart(par.pos));
    const a = Math.atan2(t.pos.z - par.pos.z, t.pos.x - par.pos.x), off = (13 + 7 * idx) * (1 + 0.35 * Math.log2(zoom + 1));
    return [px + Math.cos(a) * off, py + Math.sin(a) * off];
  }

  // ------------------------------------------------------------------ drawing
  const NICE = [1, 2, 5];
  function ringValues(): number[] {
    const out: number[] = [];
    for (let k = -12; k <= 12; k++) for (const m of NICE) { const v = m * 10 ** k; if (v >= r0 * 0.4 && v <= rmax * 1.001) out.push(v); }
    while (out.length > 9) out.splice(out.length % 2 ? 1 : 2, 1);
    return out;
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const [ox, oy] = screen([0, 0]);
    // Distance rings.
    ctx.font = '10px ui-monospace, Menlo, monospace';
    for (const v of ringValues()) {
      const r = (Rpx * Math.log(1 + v / r0)) / Math.log(1 + rmax / r0) * zoom;
      ctx.strokeStyle = 'rgba(143,220,255,0.10)'; ctx.setLineDash([2, 5]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      if (r > 40 && r < Math.max(W, H) * 2) { ctx.fillStyle = 'rgba(143,220,255,0.35)'; ctx.fillText(host.dist(v), ox + r * 0.7071 + 4, oy + r * 0.7071 - 3); }
    }
    // Planet orbits as faint circles.
    for (const t of things) {
      if (t.parent || t.kind === 'gate' || t.kind === 'star' || t.kind === 'ship') continue;
      const r = (Rpx * Math.log(1 + rho(t.pos) / r0)) / Math.log(1 + rmax / r0) * zoom;
      if (r < 4) continue;
      ctx.strokeStyle = t === selected ? 'rgba(143,220,255,0.35)' : 'rgba(143,220,255,0.07)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.stroke();
    }

    // Course.
    const sh = host.ship(), tgt = selected ?? host.target();
    if (tgt) drawCourse(tgt, sh, tgt === host.target() && selected === null);

    // Places.
    markers.length = 0;
    const placed: [number, number, number, number][] = [];
    const order = [...things].sort((a, b) => (a.kind === 'gate' ? 0 : 1) - (b.kind === 'gate' ? 0 : 1));
    const label: { t: MapThing; x: number; y: number; pri: number }[] = [];
    for (const t of order) {
      const p = place(t);
      if (!p) continue;
      const [x, y] = p;
      if (x < -40 || y < -40 || x > W + 40 || y > H + 40) continue;
      markers.push({ t, x, y });
      const k = KIND[t.kind] ?? KIND.planet;
      // A gate nobody has charted is a faint spark; a charted one is amber and a little larger.
      const charted = t.kind !== 'gate' || t.nav;
      if (!charted) ctx.globalAlpha = 0.4;
      drawMarker(t.kind, x, y, t.kind === 'gate' && t.nav ? 2.6 : k.r, t.kind === 'gate' && t.nav ? '#ffb25a' : k.c, t === selected || t === hovered);
      ctx.globalAlpha = 1;
      if (t === selected || t === hovered) label.push({ t, x, y, pri: 0 });
      else if (LABELLED.has(t.kind) || (t.kind === 'gate' && t.nav && zoom > 1.4) || (t.parent && zoom >= 2.2)) label.push({ t, x, y, pri: t.kind === 'star' ? 1 : t.parent ? 4 : 2 });
    }
    label.sort((a, b) => a.pri - b.pri);
    ctx.font = '11px ui-monospace, Menlo, monospace';
    for (const l of label) {
      const wd = ctx.measureText(l.t.name).width, bx = l.x + 8, by = l.y - 11;
      if (l.pri > 0 && placed.some((q) => bx < q[0] + q[2] && bx + wd > q[0] && by < q[1] + q[3] && by + 13 > q[1])) continue;
      placed.push([bx, by, wd, 13]);
      ctx.fillStyle = l.t === selected ? '#fff' : l.pri === 4 ? 'rgba(190,215,235,0.7)' : 'rgba(215,235,250,0.92)';
      ctx.fillText(l.t.name, bx, by + 10);
    }

    // The ship.
    const [sx, sy] = screen(chart(sh.pos));
    const ahead = sh.pos.clone().addScaledVector(sh.fwd, Math.max(rho(sh.pos) * 0.01, 1e-6));
    const [ax, ay] = screen(chart(ahead));
    const ang = Math.atan2(ay - sy, ax - sx);
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
    ctx.fillStyle = '#ffffff'; ctx.shadowColor = '#8fdcff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, 5.5); ctx.lineTo(-3, 0); ctx.lineTo(-6, -5.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff'; ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.fillText('ROCINANTE', sx + 10, sy + 16);
  }

  function drawMarker(kind: string, x: number, y: number, r: number, c: string, hot: boolean) {
    ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 1.2;
    if (kind === 'star') {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, 'rgba(255,196,107,0.9)'); g.addColorStop(1, 'rgba(255,196,107,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 4, 0, 7); ctx.fill(); ctx.fillStyle = c;
    }
    ctx.beginPath();
    if (kind === 'station') ctx.rect(x - r, y - r, r * 2, r * 2);
    else if (kind === 'ship') { ctx.moveTo(x, y - r - 1); ctx.lineTo(x + r + 1, y + r); ctx.lineTo(x - r - 1, y + r); ctx.closePath(); }
    else if (kind === 'artifact') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
    else ctx.arc(x, y, r, 0, Math.PI * 2);
    if (kind === 'gate') { ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1; } else ctx.fill();
    if (hot) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, Math.PI * 2); ctx.stroke(); }
  }

  function tripOf(t: MapThing) {
    const sh = host.ship(), vp = host.viewpoint(t), D = vp.distanceTo(sh.pos);
    return { vp, D, trip: planTrip(D, t.radius, host.space().maxSpeed) };
  }

  function drawCourse(t: MapThing, sh: { pos: THREE.Vector3 }, live: boolean) {
    const { vp, D, trip } = tripOf(t);
    if (D <= 0) return;
    const N = 80, pts: [number, number][] = [];
    for (let i = 0; i <= N; i++) pts.push(screen(chart(sh.pos.clone().lerp(vp, i / N))));
    ctx.strokeStyle = live ? 'rgba(255,178,90,0.95)' : 'rgba(255,178,90,0.75)'; ctx.lineWidth = live ? 2 : 1.6; ctx.setLineDash(live ? [] : [7, 5]);
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
    // Where the ship turns round: burn up to here, flip, burn the other way.
    const f = Math.min(1, trip.flipAt / D);
    const [fx, fy] = screen(chart(sh.pos.clone().lerp(vp, f)));
    ctx.strokeStyle = '#ffb25a'; ctx.fillStyle = '#ffb25a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(fx, fy, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx - 3, fy - 3); ctx.lineTo(fx + 3, fy + 3); ctx.moveTo(fx + 3, fy - 3); ctx.lineTo(fx - 3, fy + 3); ctx.stroke();
    ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.fillText('FLIP', fx + 9, fy + 4);
  }

  // ------------------------------------------------------------------ list and card
  function fillList() {
    const q = filter.value.trim().toLowerCase();
    const sh = host.ship();
    const rows: MapThing[] = q ? things.filter((t) => t.name.toLowerCase().includes(q) || t.sub.toLowerCase().includes(q)) : listed;
    const cap = 90;
    listEl.innerHTML = '';
    for (const t of rows.slice(0, cap)) {
      const row = document.createElement('div');
      row.className = 'map-row' + (t.parent ? ' kid' : '') + (t === selected ? ' sel' : '');
      row.innerHTML = `<span class="n"></span><span class="d"></span>`;
      (row.firstChild as HTMLElement).textContent = t.name;
      (row.lastChild as HTMLElement).textContent = host.dist(Math.max(0, t.pos.distanceTo(sh.pos) - (t.kind === 'gate' ? 0 : t.radius)));
      row.onclick = () => { select(t, true); };
      row.ondblclick = () => plotTo(t);
      listEl.append(row);
    }
    if (rows.length > cap) { const m = document.createElement('div'); m.className = 'map-more'; m.textContent = `${(rows.length - cap).toLocaleString()} more — type to search`; listEl.append(m); }
  }

  function select(t: MapThing | null, focus = false) {
    selected = t;
    if (t && focus) {
      zoom = Math.max(zoom, t.parent ? 4 : 2.5);
      const p = t.parent ? screen(chart(byId.get(t.parent)!.pos)) : screen(chart(t.pos));
      panX += W / 2 - p[0]; panY += H / 2 - p[1];
    }
    updateCard();
    fillList();
  }

  function updateCard() {
    const t = selected;
    card.style.display = t ? 'block' : 'none';
    if (!t) return;
    const { D, trip } = tripOf(t);
    card.querySelector('.k')!.textContent = t.sub;
    card.querySelector('h3')!.textContent = t.name;
    card.querySelector('p')!.textContent = t.desc;
    $('#mc-dist').textContent = host.dist(Math.max(0, D));
    $('#mc-trip').textContent = D < t.radius * 2 ? 'you are here' : `about ${Math.round(trip.eta)} s · top ${host.speed(trip.vPeak)}`;
  }

  function plotTo(t: MapThing) {
    host.plot(t);
    close();
  }

  // ------------------------------------------------------------------ view
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    Rpx = 0.46 * Math.min(W, H);
  }
  function home() { zoom = 1; panX = panY = 0; }
  function findShip() {
    const [x, y] = chart(host.ship().pos);
    zoom = Math.max(zoom, 3); panX = -x * zoom; panY = -y * zoom;
  }
  function pick(mx: number, my: number): MapThing | null {
    let best: MapThing | null = null, bd = 144;
    for (const m of markers) { const d = (m.x - mx) ** 2 + (m.y - my) ** 2; if (d < bd) { bd = d; best = m.t; } }
    return best;
  }

  let drag: { x: number; y: number; px: number; py: number; moved: boolean } | null = null;
  canvas.addEventListener('mousedown', (e) => { drag = { x: e.offsetX, y: e.offsetY, px: panX, py: panY, moved: false }; canvas.classList.add('drag'); });
  addEventListener('mousemove', (e) => {
    if (!isOpen) return;
    const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (drag) {
      if (Math.hypot(mx - drag.x, my - drag.y) > 4) drag.moved = true;
      panX = drag.px + (mx - drag.x); panY = drag.py + (my - drag.y);
    } else if (mx >= 0 && my >= 0 && mx <= W && my <= H) hovered = pick(mx, my);
  });
  addEventListener('mouseup', (e) => {
    if (!drag) return;
    const was = drag; drag = null; canvas.classList.remove('drag');
    if (!was.moved) { const r = canvas.getBoundingClientRect(); select(pick(e.clientX - r.left, e.clientY - r.top)); }
  });
  canvas.addEventListener('dblclick', (e) => { const t = pick(e.offsetX, e.offsetY); if (t) plotTo(t); });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const z2 = Math.min(800, Math.max(0.55, zoom * Math.exp(-e.deltaY * 0.0016)));
    const mx = e.offsetX - W / 2, my = e.offsetY - H / 2;
    panX = mx - ((mx - panX) / zoom) * z2; panY = my - ((my - panY) / zoom) * z2;
    zoom = z2;
  }, { passive: false });
  filter.addEventListener('input', fillList);
  $('#map-close').addEventListener('click', () => close());
  $('#map-plot').addEventListener('click', () => { if (selected) plotTo(selected); });
  btn.addEventListener('click', () => toggle());
  addEventListener('resize', () => { if (isOpen) resize(); });

  function frame() {
    if (!isOpen) return;
    raf = requestAnimationFrame(frame);
    draw();
    $('#map-status').textContent = host.status();
    if ((listClock += 1) % 40 === 0) { updateCard(); fillListDistances(); }
  }
  function fillListDistances() {
    const sh = host.ship();
    const rows = listEl.querySelectorAll('.map-row');
    const q = filter.value.trim().toLowerCase();
    const shown = (q ? things.filter((t) => t.name.toLowerCase().includes(q) || t.sub.toLowerCase().includes(q)) : listed).slice(0, rows.length);
    rows.forEach((row, i) => { const t = shown[i]; if (t) (row.lastChild as HTMLElement).textContent = host.dist(Math.max(0, t.pos.distanceTo(sh.pos) - (t.kind === 'gate' ? 0 : t.radius))); });
  }

  function open() {
    if (isOpen || !host.canOpen()) return;
    document.exitPointerLock();
    layout();
    isOpen = true;
    document.body.classList.add('map-open');
    resize(); home();
    select(host.target());
    fillList();
    filter.value = '';
    raf = requestAnimationFrame(frame);
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    cancelAnimationFrame(raf);
    document.body.classList.remove('map-open');
    filter.blur();
  }
  function toggle() { isOpen ? close() : open(); }

  // Keys: while the map is open it has the keyboard to itself.
  addEventListener('keydown', (e) => {
    const typing = e.target instanceof HTMLInputElement;
    if (!isOpen) {
      if (e.code === 'KeyM' && !e.metaKey && !e.ctrlKey && host.canOpen() && !typing) { e.preventDefault(); e.stopImmediatePropagation(); open(); }
      return;
    }
    if (e.code === 'Escape' || (e.code === 'KeyM' && !typing)) { e.preventDefault(); e.stopImmediatePropagation(); if (typing && filter.value) { filter.value = ''; fillList(); } else close(); return; }
    if (e.code === 'Enter' && selected) { e.preventDefault(); e.stopImmediatePropagation(); plotTo(selected); return; }
    if (!typing) {
      if (e.code === 'KeyF') findShip();
      else if (e.code === 'Home') home();
      else if (e.code === 'Slash') { e.preventDefault(); filter.focus(); }
      e.stopImmediatePropagation();
    } else e.stopImmediatePropagation();
  }, true);

  return { open, close, toggle, isOpen: () => isOpen };
}
