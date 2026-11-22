// A toolbar along the top: every thing the keys do, as a button that is always on screen, so no menu is a dead end.
// Each button sends the same key the game already listens for, so the toolbar can never disagree with the keyboard.

type Btn = { code: string; label: string; tip: string; key: string; only?: 'fly' | 'walk'; overlay?: string; icon: string };

const BTNS: Btn[] = [
  { code: 'KeyN', label: 'Places', tip: 'Destinations and places', key: 'N', overlay: 'nav-open', icon: '☰' },
  { code: 'KeyM', label: 'Map', tip: 'Star map: where everything is, and plot a course', key: 'M', only: 'fly', overlay: 'map-open', icon: '✦' },
  { code: 'KeyT', label: 'Voyages', tip: 'Guided tours and the Rocinante\'s story', key: 'T', only: 'fly', overlay: 'voyages-open', icon: '▶' },
  { code: 'KeyI', label: 'Info', tip: 'Facts about what you aim at', key: 'I', overlay: 'info-open', icon: 'ⓘ' },
  { code: 'KeyX', label: 'Brake', tip: 'Flip and burn to a stop', key: 'X', only: 'fly', icon: '■' },
  { code: 'KeyL', label: 'Dock', tip: 'Dock at a station and go aboard', key: 'L', only: 'fly', icon: '⏏' },
  { code: 'KeyV', label: 'View', tip: 'Cockpit or chase view', key: 'V', only: 'fly', icon: '◉' },
  { code: 'KeyO', label: 'Orbits', tip: 'Orbit lines on or off', key: 'O', only: 'fly', icon: '◌' },
  { code: 'KeyP', label: 'Photo', tip: 'Photo mode (click again to leave)', key: 'P', icon: '◎' },
  { code: 'KeyK', label: 'Sound', tip: 'Sound on or off', key: 'K', icon: '♪' },
  { code: 'KeyU', label: 'Settings', tip: 'Picture quality, volume, film look', key: 'U', overlay: 'settings-open', icon: '⚙' },
  { code: 'KeyH', label: 'Keys', tip: 'All the keys', key: 'H', overlay: 'help-open', icon: '?' },
];
// Full-screen panels. Opening one button's panel first closes whichever other one is open.
const OVERLAYS = ['help-open', 'map-open', 'voyages-open', 'settings-open', 'scncard-open'];

function press(code: string, type: 'keydown' | 'keyup') {
  // On the page body, not the window: an event aimed at the window runs the game's own handler before the panels' capture handlers, and a panel then undoes it.
  document.body.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }));
}

export function initToolbar(): void {
  const bar = document.getElementById('toolbar');
  if (!bar) return;
  const body = document.body;
  const style = document.createElement('style'); style.textContent = TOOLBAR_CSS; document.head.append(style);
  const els = new Map<Btn, HTMLButtonElement>();
  for (const b of BTNS) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `tb${b.only ? ` ${b.only}-only` : ''}`;
    el.dataset.k = b.code;
    el.title = `${b.tip} (${b.key})`;
    el.setAttribute('aria-label', `${b.tip} (${b.key})`);
    el.innerHTML = `<i aria-hidden="true">${b.icon}</i><span>${b.label}</span>`;
    el.addEventListener('click', () => {
      el.blur(); // so Space and Enter go to the game, not to the button
      const open = OVERLAYS.filter((c) => body.classList.contains(c));
      const own = b.overlay && body.classList.contains(b.overlay);
      // Your own panel open: Esc closes it (T, M, H are toggles too, but U and Info are not).
      if (own && OVERLAYS.includes(b.overlay!)) { press('Escape', 'keydown'); press('Escape', 'keyup'); return; }
      // Another panel open: close it first, then do this.
      if (open.length) { press('Escape', 'keydown'); press('Escape', 'keyup'); }
      setTimeout(() => { press(b.code, 'keydown'); setTimeout(() => press(b.code, 'keyup'), 30); }, open.length ? 60 : 0);
    });
    bar.append(el); els.set(b, el);
  }
  // A tour or voyage is running: the Voyages button becomes Stop.
  const sync = () => {
    for (const [b, el] of els) {
      let on = !!b.overlay && body.classList.contains(b.overlay);
      let label = b.label, tip = b.tip;
      if (b.code === 'KeyT' && (body.classList.contains('voyage') || body.classList.contains('cine'))) { on = true; label = 'Stop'; tip = 'Stop the tour and take back the controls'; }
      if (b.code === 'KeyP' && body.classList.contains('photo')) { on = true; label = 'Exit photo'; }
      el.classList.toggle('on', on);
      el.querySelector('span')!.textContent = label;
      el.title = `${tip} (${b.key})`;
      el.setAttribute('aria-pressed', b.overlay || b.code === 'KeyP' ? String(on) : 'false');
    }
  };
  new MutationObserver(sync).observe(body, { attributes: true, attributeFilter: ['class'] });
  sync();
}

export const TOOLBAR_CSS = `
#toolbar { position: fixed; left: 50%; top: 8px; transform: translateX(-50%); z-index: 30; display: none; gap: 2px; padding: 3px; max-width: calc(100vw - 16px);
  background: var(--panel); border: 1px solid var(--line); border-radius: 6px; backdrop-filter: blur(6px); pointer-events: auto; overflow-x: auto; scrollbar-width: none; }
#toolbar::-webkit-scrollbar { display: none; }
body.started #toolbar { display: flex; }
body.walking #toolbar .fly-only { display: none; }
body:not(.walking) #toolbar .walk-only { display: none; }
body.photo #toolbar .tb:not([data-k=KeyP]) { display: none; }
body.cine #toolbar, body.voyage:not(.voyages-open) #toolbar { opacity: 0.35; transition: opacity 0.4s; }
body.cine #toolbar:hover, body.cine #toolbar:focus-within, body.voyage #toolbar:hover, body.voyage #toolbar:focus-within { opacity: 1; }
#toolbar .tb { display: flex; align-items: center; gap: 6px; background: none; border: 0; border-radius: 4px; padding: 6px 10px; color: #cfe3f2; font: 12px/1 -apple-system, "Helvetica Neue", sans-serif; cursor: pointer; white-space: nowrap; }
#toolbar .tb i { font-style: normal; font-size: 13px; width: 14px; text-align: center; color: var(--cyan); }
#toolbar .tb:hover { background: rgba(143, 220, 255, 0.14); color: #fff; }
#toolbar .tb:focus-visible { outline: 2px solid var(--cyan); outline-offset: -2px; }
#toolbar .tb.on { background: rgba(143, 220, 255, 0.22); color: #fff; }
body.help-open #toolbar, body.settings-open #toolbar, body.map-open #toolbar, body.voyages-open #toolbar, body.scncard-open #toolbar { z-index: 40; }
/* Make room under the bar for the corner panels */
#info { margin-top: 38px; }
@media (max-width: 1150px) { #loc { margin-top: 38px; } #nav { top: 136px; } }
@media (max-width: 700px) {
  #toolbar { left: 0; right: 0; top: 0; transform: none; max-width: none; border-radius: 0; border-width: 0 0 1px; justify-content: flex-start; }
  #toolbar .tb span { display: none; }
  #toolbar .tb { padding: 8px 9px; } #toolbar .tb i { font-size: 16px; width: 18px; }
  #toolbar .tb.on span, #toolbar .tb[data-k=KeyT].on span, #toolbar .tb[data-k=KeyP].on span { display: inline; }
  #loc { margin-top: 40px; } #info { margin-top: 40px; }
  #card, #nav { margin-top: 36px; }
}
`;
