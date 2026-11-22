// The card that opens "The Rocinante's voyages": a spoiler warning, then the sequences to choose from.
// Esc or a click outside closes it; Enter or a click on a row starts that sequence.

import type { Scenario } from './scenario';

const CSS = `
#scncard { position: fixed; inset: 0; z-index: 22; display: none; align-items: center; justify-content: center; background: rgba(1,4,10,0.62); backdrop-filter: blur(3px); font: 13px/1.45 -apple-system, "Helvetica Neue", sans-serif; color: #cfe3f2; }
body.scncard-open #scncard { display: flex; }
#scncard-box { width: min(520px, 92vw); background: rgba(4,10,20,0.95); border: 1px solid rgba(143,220,255,0.3); border-radius: 5px; padding: 18px 20px 14px; }
#scncard h2 { margin: 0 0 10px; font: 400 13px ui-monospace, Menlo, monospace; letter-spacing: 0.24em; color: #8fdcff; text-transform: uppercase; }
#scncard .warn { margin: 0 0 12px; padding: 8px 10px; border: 1px solid rgba(255,196,110,0.55); border-radius: 3px; background: rgba(255,170,60,0.08); color: #ffd9a0; font: 11px/1.5 ui-monospace, Menlo, monospace; letter-spacing: 0.08em; }
#scncard .warn b { display: block; letter-spacing: 0.2em; color: #ffc46e; margin-bottom: 2px; }
.scnrow { padding: 9px 10px; border-radius: 4px; cursor: pointer; border: 1px solid transparent; }
.scnrow:hover, .scnrow.sel { background: rgba(143,220,255,0.12); border-color: rgba(143,220,255,0.3); }
.scnrow b { display: block; font-weight: 500; color: #fff; letter-spacing: 0.04em; }
.scnrow small { color: #7f98ab; font: 10px ui-monospace, Menlo, monospace; letter-spacing: 0.08em; }
.scnrow span { display: block; color: #9fb6c8; font-size: 12px; }
#scncard .foot { margin-top: 10px; color: #6f8aa0; font: 10px ui-monospace, Menlo, monospace; letter-spacing: 0.08em; }
`;

export interface ScenarioCard { open(): void; close(): void; isOpen(): boolean }

export function createScenarioCard(list: Scenario[], go: (s: Scenario) => void): ScenarioCard {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const root = document.createElement('div');
  root.id = 'scncard'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'The Rocinante\'s voyages');
  root.innerHTML = '<div id="scncard-box"><h2>The Rocinante\'s voyages</h2><div class="warn"><b>SPOILERS FOR LEVIATHAN WAKES</b>These sequences re-enact events from the novel, including battles and the loss of ships, in our own words. Unofficial, non-commercial fan work.</div><div id="scn-list"></div><div class="foot">Click or Enter to watch · any key hands the ship back · Esc closes</div></div>';
  document.body.append(root);
  const listEl = root.querySelector('#scn-list') as HTMLElement;
  let isOpen = false, sel = 0;

  function fill() {
    listEl.innerHTML = '';
    list.forEach((s, n) => {
      const row = document.createElement('div');
      row.className = 'scnrow' + (n === sel ? ' sel' : '');
      row.innerHTML = '<b></b><small></small><span></span>';
      (row.querySelector('b') as HTMLElement).textContent = s.title;
      (row.querySelector('small') as HTMLElement).textContent = `Book ${s.book} · ${s.bookTitle} · ${Math.round(s.time.duration / 60 * 10) / 10} min`;
      (row.querySelector('span') as HTMLElement).textContent = s.spoiler;
      row.onclick = () => { close(); go(s); };
      row.onmouseenter = () => { sel = n; listEl.querySelectorAll('.scnrow').forEach((r, m) => r.classList.toggle('sel', m === n)); };
      listEl.append(row);
    });
  }
  function open() {
    if (isOpen) return;
    document.exitPointerLock();
    sel = 0; fill();
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
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.code === 'Escape' || e.code === 'KeyT') close();
    else if (e.code === 'Enter') { const s = list[sel]; close(); if (s) go(s); }
    else if (e.code === 'ArrowDown') { sel = (sel + 1) % list.length; fill(); }
    else if (e.code === 'ArrowUp') { sel = (sel + list.length - 1) % list.length; fill(); }
  }, true);
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
  return { open, close, isOpen: () => isOpen };
}
