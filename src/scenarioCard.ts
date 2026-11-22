// The card that opens "The Rocinante's voyages": a spoiler warning, then the sequences to choose from.
// Esc or a click outside closes it; Enter or a click on a row starts that sequence.

import type { Scenario } from './scenario';
import { fmtTime, loadGuard, loadResume, saveGuard, visibleScenarios, type Guard } from './scenarioNav';

const CSS = `
#scncard { position: fixed; inset: 0; z-index: 22; display: none; align-items: center; justify-content: center; background: rgba(1,4,10,0.62); backdrop-filter: blur(3px); font: 13px/1.45 -apple-system, "Helvetica Neue", sans-serif; color: #cfe3f2; }
body.scncard-open #scncard { display: flex; }
#scncard-box { width: min(520px, 92vw); background: rgba(4,10,20,0.95); border: 1px solid rgba(143,220,255,0.3); border-radius: 5px; padding: 18px 20px 14px; max-height: 94vh; overflow-y: auto; box-sizing: border-box; }
#scncard h2 { margin: 0 0 10px; font: 400 13px ui-monospace, Menlo, monospace; letter-spacing: 0.24em; color: #8fdcff; text-transform: uppercase; }
#scncard .warn { margin: 0 0 12px; padding: 8px 10px; border: 1px solid rgba(255,196,110,0.55); border-radius: 3px; background: rgba(255,170,60,0.08); color: #ffd9a0; font: 11px/1.5 ui-monospace, Menlo, monospace; letter-spacing: 0.08em; }
#scncard .warn b { display: block; letter-spacing: 0.2em; color: #ffc46e; margin-bottom: 2px; }
.scnrow { padding: 9px 10px; border-radius: 4px; cursor: pointer; border: 1px solid transparent; }
.scnrow:hover, .scnrow.sel { background: rgba(143,220,255,0.12); border-color: rgba(143,220,255,0.3); }
.scnrow b { display: block; font-weight: 500; color: #fff; letter-spacing: 0.04em; }
.scnrow small { color: #7f98ab; font: 10px ui-monospace, Menlo, monospace; letter-spacing: 0.08em; }
.scnrow span { display: block; color: #9fb6c8; font-size: 12px; }
#scncard .guard { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; margin: 0 0 10px; color: #9fb6c8; font: 11px ui-monospace, Menlo, monospace; letter-spacing: 0.06em; }
#scncard .guard label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
#scncard .guard select { background: rgba(143,220,255,0.08); color: #cfe3f2; border: 1px solid rgba(143,220,255,0.3); border-radius: 3px; padding: 3px 4px; font: inherit; }
#scncard .guard select:disabled { opacity: 0.4; }
#scncard .none { padding: 12px 10px; color: #9fb6c8; font-size: 12px; }
.scnrow { position: relative; }
.scnrow .resume { display: inline-block; margin-top: 5px; padding: 4px 9px; border-radius: 3px; border: 1px solid rgba(143,220,255,0.4); background: rgba(143,220,255,0.08); color: #8fdcff; font: 11px ui-monospace, Menlo, monospace; letter-spacing: 0.06em; cursor: pointer; }
.scnrow .resume:hover { background: rgba(143,220,255,0.22); color: #fff; }
#scncard .foot { margin-top: 10px; color: #6f8aa0; font: 10px ui-monospace, Menlo, monospace; letter-spacing: 0.08em; }
`;

export interface ScenarioCard { open(): void; close(): void; isOpen(): boolean }

export function createScenarioCard(list: Scenario[], go: (s: Scenario, at?: number) => void): ScenarioCard {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const root = document.createElement('div');
  root.id = 'scncard'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'The Rocinante\'s voyages');
  root.innerHTML = '<div id="scncard-box"><h2>The Rocinante\'s voyages</h2><div class="warn"><b id="scn-warn">SPOILERS</b>These sequences re-enact events from the novels, including battles and the loss of ships, in our own words. Unofficial, non-commercial fan work.</div><div class="guard"><label><input type="checkbox" id="scn-hide"> Hide later books</label><label>I have read up to <select id="scn-upto" aria-label="Last book you have read"></select></label></div><div id="scn-list"></div><div class="foot">Click or Enter to watch · R resumes · Esc closes this card. While a voyage plays: Space pause, arrows seek, [ ] chapters, Esc exits</div></div>';
  document.body.append(root);
  const listEl = root.querySelector('#scn-list') as HTMLElement;
  let isOpen = false, sel = 0;
  let guard: Guard = loadGuard(), resume: Record<string, number> = {}, shown: Scenario[] = [];
  const hideEl = root.querySelector('#scn-hide') as HTMLInputElement, uptoEl = root.querySelector('#scn-upto') as HTMLSelectElement, warnEl = root.querySelector('#scn-warn') as HTMLElement;
  // One option per book that has a voyage: "Book 1 · Leviathan Wakes".
  const books = [...new Map(list.map((s) => [s.book, s.bookTitle])).entries()].sort((a, b) => a[0] - b[0]);
  for (const [n, t] of books) { const o = document.createElement('option'); o.value = String(n); o.textContent = `Book ${n} · ${t}`; uptoEl.append(o); }
  const syncGuard = () => { hideEl.checked = guard.hide; uptoEl.value = String(guard.upTo); uptoEl.disabled = !guard.hide; };
  hideEl.onchange = () => { guard = { ...guard, hide: hideEl.checked }; saveGuard(guard); sel = 0; fill(); };
  uptoEl.onchange = () => { guard = { ...guard, upTo: Number(uptoEl.value) }; saveGuard(guard); sel = 0; fill(); };
  const startAt = (s: Scenario, at = 0) => { close(); go(s, at); };

  function fill() {
    listEl.innerHTML = '';
    syncGuard();
    shown = visibleScenarios(list, guard);
    const titles = [...new Set(shown.map((s) => s.bookTitle.toUpperCase()))];
    warnEl.textContent = titles.length ? `SPOILERS FOR ${titles.join(' AND ')}` : 'SPOILER GUARD ON';
    if (!shown.length) { const n = document.createElement('div'); n.className = 'none'; n.textContent = 'Nothing from the books you have chosen yet. Raise the book above, or switch the guard off.'; listEl.append(n); return; }
    shown.forEach((s, n) => {
      const row = document.createElement('div');
      row.className = 'scnrow' + (n === sel ? ' sel' : '');
      row.innerHTML = '<b></b><small></small><span></span>';
      (row.querySelector('b') as HTMLElement).textContent = s.title;
      (row.querySelector('small') as HTMLElement).textContent = `Book ${s.book} · ${s.bookTitle} · ${Math.round(s.time.duration / 60 * 10) / 10} min`;
      (row.querySelector('span') as HTMLElement).textContent = s.spoiler;
      const at = resume[s.id];
      if (at) {
        const rb = document.createElement('button');
        rb.type = 'button'; rb.className = 'resume'; rb.textContent = `Resume at ${fmtTime(at)}`;
        rb.setAttribute('aria-label', `Resume ${s.title} at ${fmtTime(at)}`);
        rb.onclick = (e) => { e.stopPropagation(); startAt(s, at); };
        row.append(rb);
      }
      row.onclick = () => startAt(s);
      row.onmouseenter = () => { sel = n; listEl.querySelectorAll('.scnrow').forEach((r, m) => r.classList.toggle('sel', m === n)); };
      listEl.append(row);
    });
  }
  function open() {
    if (isOpen) return;
    document.exitPointerLock();
    sel = 0; guard = loadGuard(); resume = loadResume(); fill();
    isOpen = true;
    document.body.classList.add('scncard-open');
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    document.body.classList.remove('scncard-open');
  }
  addEventListener('keydown', (e) => {
    if (!isOpen) return;
    // The guard's own controls keep their keys (Space on the box, arrows in the list of books).
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) { if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } else e.stopImmediatePropagation(); return; }
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === 'Escape' || e.code === 'KeyT') close();
    else if (e.code === 'Enter') { const s = shown[sel]; if (s) startAt(s); }
    else if (e.code === 'KeyR') { const s = shown[sel]; if (s && resume[s.id]) startAt(s, resume[s.id]); }
    else if (e.code === 'ArrowDown' && shown.length) { sel = (sel + 1) % shown.length; fill(); }
    else if (e.code === 'ArrowUp' && shown.length) { sel = (sel + shown.length - 1) % shown.length; fill(); }
  }, true);
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
  return { open, close, isOpen: () => isOpen };
}
