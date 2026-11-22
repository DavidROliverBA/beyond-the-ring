// The control strip shown while a Rocinante voyage plays (E3.5, E3.2.b): play/pause, a scrub bar with chapter marks and the time,
// previous/next chapter, speed and Exit. Space pauses, arrows seek 5 s, [ ] jump chapter, Esc hands the ship back.
// The keys are taken in the capture phase only while a film plays and no panel is open, so every other key still reaches the game
// (where it ends the voyage, as before).

import type { Scenario } from './scenario';
import { chapterAt, clampT, fmtTime, nextChapterT, prevChapterT, saveResume } from './scenarioNav';

export interface BarHost {
  scenario(): Scenario | null;
  time(): number;
  paused(): boolean;
  speed(): number;
  setPaused(on: boolean): void;
  setSpeed(x: number): void;
  seek(t: number): void;
  exit(): void;
}

const SPEEDS = [0.5, 1, 2];
/** Panels that own the keys while open: the strip stands aside. */
const PANELS = ['help-open', 'map-open', 'voyages-open', 'settings-open', 'scncard-open', 'nav-open', 'info-open', 'photo'];

const CSS = `
#scnbar { position: fixed; left: 50%; bottom: 10px; transform: translateX(-50%); z-index: 25; display: none; flex-wrap: wrap; align-items: center; gap: 4px 6px;
  width: min(760px, calc(100vw - 20px)); box-sizing: border-box; padding: 6px 8px 7px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; backdrop-filter: blur(6px);
  font: 12px/1 -apple-system, "Helvetica Neue", sans-serif; color: #cfe3f2; user-select: none; -webkit-user-select: none; }
body.scn-play.started #scnbar { display: flex; }
body.photo #scnbar { display: none; }
body.scn-play.cine #scnbar:not(.awake):not(.paused) { opacity: 0.3; }
body.scn-play.cine #scnbar { transition: opacity 0.5s; }
body.scn-play.cine #scnbar:hover, body.scn-play.cine #scnbar:focus-within { opacity: 1; }
body.help-open #scnbar, body.settings-open #scnbar, body.scncard-open #scnbar { z-index: 20; }
#scnbar .chap { flex: 1 0 100%; font: 10px/1.2 ui-monospace, Menlo, monospace; letter-spacing: 0.14em; text-transform: uppercase; color: #7f98ab; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 2px 2px; }
#scnbar .chap b { color: var(--cyan); font-weight: 500; }
#scnbar button { display: flex; align-items: center; justify-content: center; gap: 5px; min-width: 32px; height: 30px; padding: 0 8px; background: none; border: 0; border-radius: 4px; color: #cfe3f2; font: inherit; cursor: pointer; white-space: nowrap; }
#scnbar button:hover { background: rgba(143,220,255,0.14); color: #fff; }
#scnbar button:focus-visible { outline: 2px solid var(--cyan); outline-offset: -2px; }
#scnbar button i { font-style: normal; font-size: 14px; color: var(--cyan); }
#scnbar button.on { background: rgba(143,220,255,0.22); color: #fff; }
#scnbar .play { min-width: 38px; }
#scnbar .time { font: 11px ui-monospace, Menlo, monospace; color: #9fb6c8; min-width: 78px; text-align: center; letter-spacing: 0.04em; }
#scnbar .scrub { position: relative; flex: 1 1 140px; height: 30px; cursor: pointer; touch-action: none; min-width: 120px; }
#scnbar .scrub:focus-visible { outline: 2px solid var(--cyan); }
#scnbar .track { position: absolute; left: 0; right: 0; top: 13px; height: 4px; border-radius: 2px; background: rgba(143,220,255,0.2); }
#scnbar .fill { position: absolute; left: 0; top: 13px; height: 4px; border-radius: 2px; background: var(--cyan); width: 0; }
#scnbar .tick { position: absolute; top: 9px; width: 2px; height: 12px; margin-left: -1px; background: rgba(255,196,110,0.85); border-radius: 1px; pointer-events: none; }
#scnbar .knob { position: absolute; top: 9px; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 2px rgba(143,220,255,0.6); pointer-events: none; }
#scnbar .spd { font: 11px ui-monospace, Menlo, monospace; min-width: 36px; }
#scnbar .exit { margin-left: 2px; border: 1px solid rgba(255,196,110,0.5); color: #ffd9a0; }
#scnbar .exit:hover { background: rgba(255,170,60,0.16); }
@media (max-width: 700px) {
  #scnbar { bottom: 8px; padding: 6px; }
  #scnbar .scrub { order: 5; flex: 1 0 100%; height: 34px; }
  #scnbar .track, #scnbar .fill { top: 15px; } #scnbar .tick, #scnbar .knob { top: 11px; }
  #scnbar .time { order: 4; flex: 1; text-align: right; }
  #scnbar .exit span { display: none; }
  #scnbar button { height: 36px; min-width: 36px; }
  body.scn-play.cine #banner { bottom: 128px; }
}
@media (max-aspect-ratio: 1/1) and (min-width: 701px) { body.scn-play.cine #banner { bottom: 84px; } }
`;

export interface ScenarioBar { update(): void; show(sc: Scenario): void; hide(): void }

export function createScenarioBar(h: BarHost): ScenarioBar {
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const bar = document.createElement('div');
  bar.id = 'scnbar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Voyage playback');
  bar.innerHTML = `<div class="chap"></div>
    <button type="button" class="prev" title="Previous chapter ([)" aria-label="Previous chapter"><i aria-hidden="true">⏮</i></button>
    <button type="button" class="play" title="Pause or play (Space)" aria-label="Pause"><i aria-hidden="true">⏸</i></button>
    <button type="button" class="next" title="Next chapter (])" aria-label="Next chapter"><i aria-hidden="true">⏭</i></button>
    <div class="scrub" role="slider" tabindex="-1" aria-label="Position in the film" aria-valuemin="0"><div class="track"></div><div class="fill"></div><div class="knob"></div></div>
    <div class="time">0:00 / 0:00</div>
    <button type="button" class="spd" title="Speed (click to change)" aria-label="Speed">1×</button>
    <button type="button" class="exit" title="Hand the ship back (Esc)" aria-label="Exit the voyage"><i aria-hidden="true">✕</i><span>Exit</span></button>`;
  document.body.append(bar);
  const q = <T extends HTMLElement>(s: string) => bar.querySelector(s) as T;
  const chapEl = q('.chap'), playB = q('.play'), scrub = q('.scrub'), fill = q('.fill'), knob = q('.knob'), timeEl = q('.time'), spdB = q('.spd');
  let sc: Scenario | null = null, drag = false, awakeT = 0, lastSaved = -10, shownChap = -2, shownPaused: boolean | null = null, shownSpd = 0, shownTime = '', ticksFor = '';

  const dur = () => sc?.time.duration ?? 1;
  const seekTo = (t: number) => { if (!sc) return; h.seek(clampT(t, dur() - 0.5)); update(); };
  const chapters = () => sc?.chapters ?? [];

  function wake() {
    bar.classList.add('awake');
    clearTimeout(awakeT);
    awakeT = window.setTimeout(() => bar.classList.remove('awake'), 2800);
  }
  function buildTicks() {
    bar.querySelectorAll('.tick').forEach((e) => e.remove());
    for (const c of chapters()) {
      if (c.t <= 0) continue;
      const k = document.createElement('div'); k.className = 'tick'; k.style.left = `${(c.t / dur()) * 100}%`; k.title = c.title;
      scrub.append(k);
    }
    ticksFor = sc?.id ?? '';
  }
  function update() {
    if (!sc) return;
    if (ticksFor !== sc.id) buildTicks();
    const t = h.time(), p = clampT(t / dur(), 1);
    fill.style.width = `${p * 100}%`; knob.style.left = `${p * 100}%`;
    const tx = `${fmtTime(t)} / ${fmtTime(dur())}`;
    if (tx !== shownTime) { shownTime = tx; timeEl.textContent = tx; scrub.setAttribute('aria-valuenow', String(Math.round(t))); scrub.setAttribute('aria-valuemax', String(Math.round(dur()))); scrub.setAttribute('aria-valuetext', tx); }
    const ci = chapterAt(chapters(), t);
    if (ci !== shownChap) {
      shownChap = ci;
      const n = chapters().length;
      chapEl.innerHTML = ''; 
      if (ci >= 0) { const b = document.createElement('b'); b.textContent = chapters()[ci].title; chapEl.append(`Chapter ${ci + 1} of ${n} · `, b); } else chapEl.textContent = sc.title;
    }
    const pa = h.paused();
    if (pa !== shownPaused) { shownPaused = pa; bar.classList.toggle('paused', pa); playB.innerHTML = `<i aria-hidden="true">${pa ? '▶' : '⏸'}</i>`; playB.setAttribute('aria-label', pa ? 'Play' : 'Pause'); }
    if (h.speed() !== shownSpd) { shownSpd = h.speed(); spdB.textContent = `${shownSpd}×`; spdB.classList.toggle('on', shownSpd !== 1); }
    // Where you leave off is kept about once a second.
    if (Math.abs(t - lastSaved) >= 1) { lastSaved = t; saveResume(sc.id, t, dur()); }
  }
  const togglePlay = () => { h.setPaused(!h.paused()); update(); };
  const cycleSpeed = () => { const i = SPEEDS.indexOf(h.speed()); h.setSpeed(SPEEDS[(i + 1) % SPEEDS.length]); update(); };
  const prevChap = () => seekTo(prevChapterT(chapters(), h.time()));
  const nextChap = () => { const n = nextChapterT(chapters(), h.time()); if (n !== null) seekTo(n); };

  // Buttons are blurred after a click so Space and Enter go to the strip's own keys and not back to the button.
  const on = (el: HTMLElement, f: () => void) => el.addEventListener('click', () => { el.blur(); f(); wake(); });
  on(q('.prev'), prevChap); on(q('.next'), nextChap); on(playB, togglePlay); on(spdB, cycleSpeed); on(q('.exit'), () => h.exit());

  const posT = (e: PointerEvent) => { const r = scrub.getBoundingClientRect(); return clampT(((e.clientX - r.left) / Math.max(1, r.width)) * dur(), dur()); };
  scrub.addEventListener('pointerdown', (e) => { drag = true; scrub.setPointerCapture(e.pointerId); seekTo(posT(e)); e.preventDefault(); });
  scrub.addEventListener('pointermove', (e) => { if (drag) seekTo(posT(e)); });
  const up = (e: PointerEvent) => { if (drag) { drag = false; try { scrub.releasePointerCapture(e.pointerId); } catch { /* */ } } };
  scrub.addEventListener('pointerup', up); scrub.addEventListener('pointercancel', up);

  // Show on any pointer movement or touch.
  addEventListener('pointermove', () => { if (sc) wake(); }, { passive: true });
  addEventListener('pointerdown', () => { if (sc) wake(); }, { passive: true });

  addEventListener('keydown', (e) => {
    if (!sc || e.metaKey || e.ctrlKey || e.altKey) return;
    if (PANELS.some((c) => document.body.classList.contains(c))) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    let f: (() => void) | null = null;
    switch (e.code) {
      case 'Space': f = togglePlay; break;
      case 'ArrowLeft': f = () => seekTo(h.time() - 5); break;
      case 'ArrowRight': f = () => seekTo(h.time() + 5); break;
      case 'BracketLeft': f = prevChap; break;
      case 'BracketRight': f = nextChap; break;
      case 'Escape': f = () => h.exit(); break;
    }
    if (!f) return; // any other key: the game's own handler ends the voyage, as ever
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat && (e.code === 'Space' || e.code === 'Escape' || e.code.startsWith('Bracket'))) return;
    f(); wake();
  }, true);
  // Space on a focused button would click it on key-up; the keydown above already acted.
  addEventListener('keyup', (e) => { if (sc && e.code === 'Space') e.preventDefault(); }, true);

  return {
    update,
    show(s) { sc = s; shownChap = -2; shownPaused = null; shownSpd = 0; shownTime = ''; lastSaved = -10; ticksFor = ''; document.body.classList.add('scn-play'); wake(); update(); },
    hide() { if (sc) saveResume(sc.id, h.time(), dur()); sc = null; document.body.classList.remove('scn-play'); },
  };
}
