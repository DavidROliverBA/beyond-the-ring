// The settings panel (BACKLOG E5.1, E4.7): picture quality, sound, the film look on tours, and reduced motion.
// Opened with U or the Settings buttons; remembered in localStorage (guarded: a private window just forgets).

export interface Settings {
  /** Picture resolution as a share of the screen's own: 0.5, 0.75 or 1. */
  scale: number;
  /** Loudness 0..1. */
  volume: number;
  /** Widescreen bars, colour grade and anamorphic streaks on tours and voyages. */
  film: boolean;
  /** Sun glare (ghost discs, halo, starburst, rays) while you fly freely. Off by default: tours and voyages keep their own. */
  flares: boolean;
  /** No camera sway on tours, no film grain, no flashes or fades: calmer. Starts from the system setting. */
  reduced: boolean;
}

const KEY = 'btr-settings';
const reduceQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

export function defaults(): Settings {
  return { scale: 1, volume: 1, film: true, flares: false, reduced: !!reduceQuery?.matches };
}

export function load(): Settings {
  const s = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    if (raw && typeof raw === 'object') {
      if ([0.5, 0.75, 1].includes(raw.scale as number)) s.scale = raw.scale as number;
      if (typeof raw.volume === 'number' && raw.volume >= 0 && raw.volume <= 1) s.volume = raw.volume;
      if (typeof raw.film === 'boolean') s.film = raw.film;
      if (typeof raw.flares === 'boolean') s.flares = raw.flares;
      if (typeof raw.reduced === 'boolean') s.reduced = raw.reduced;
    }
  } catch { /* nothing stored, or storage is blocked */ }
  return s;
}

function save(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

const CSS = `
#settings { position: fixed; inset: 0; z-index: 23; display: none; align-items: center; justify-content: center; background: rgba(1,4,10,0.62); backdrop-filter: blur(3px); font: 13px/1.45 -apple-system, "Helvetica Neue", sans-serif; color: #cfe3f2; }
body.settings-open #settings { display: flex; }
#settings-box { width: min(420px, 92vw); max-height: 92vh; overflow-y: auto; background: rgba(4,10,20,0.95); border: 1px solid rgba(143,220,255,0.3); border-radius: 5px; padding: 18px 20px 14px; }
#settings h2 { margin: 0 0 12px; font: 400 13px ui-monospace, Menlo, monospace; letter-spacing: 0.24em; color: #8fdcff; text-transform: uppercase; display: flex; align-items: center; }
#settings h2 button { margin-left: auto; }
#settings .row { display: grid; grid-template-columns: 1fr auto; gap: 2px 14px; align-items: center; padding: 9px 0; border-top: 1px solid rgba(143,220,255,0.12); }
#settings .row label, #settings .row .l { color: #fff; }
#settings .row small { grid-column: 1 / -1; color: #7f98ab; font: 11px/1.4 ui-monospace, Menlo, monospace; }
#settings select, #settings button, #settings input[type=range] { font: 12px ui-monospace, Menlo, monospace; color: #8fdcff; background: rgba(143,220,255,0.12); border: 1px solid rgba(143,220,255,0.3); border-radius: 3px; padding: 4px 8px; cursor: pointer; }
#settings input[type=range] { padding: 0; width: 140px; accent-color: #8fdcff; background: none; border: 0; }
#settings input[type=checkbox] { width: 18px; height: 18px; accent-color: #8fdcff; cursor: pointer; }
#settings .foot { margin-top: 8px; color: #6f8aa0; font: 10px ui-monospace, Menlo, monospace; letter-spacing: 0.08em; }
`;

export interface SettingsPanel { open(): void; close(): void; isOpen(): boolean; readonly value: Settings; sync(): void }

/** `apply` is called with the settings at start and on every change. `sound` is read and written for the mute switch. */
export function createSettingsPanel(apply: (s: Settings) => void, sound: { readonly on: boolean; setOn(v: boolean): void }): SettingsPanel {
  const s = load();
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.append(style);
  const root = document.createElement('div');
  root.id = 'settings';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'settings-title');
  root.innerHTML = `<div id="settings-box">
    <h2><span id="settings-title">Settings</span><button type="button" id="settings-x" aria-label="Close settings">×</button></h2>
    <div class="row"><label for="set-scale">Picture quality</label>
      <select id="set-scale"><option value="1">High (full resolution)</option><option value="0.75">Medium (75%)</option><option value="0.5">Low (50%, fastest)</option></select>
      <small>Lower it if the picture stutters.</small></div>
    <div class="row"><label for="set-volume">Volume</label><input type="range" id="set-volume" min="0" max="100" step="5"></div>
    <div class="row"><label for="set-mute">Sound off (K)</label><input type="checkbox" id="set-mute"></div>
    <div class="row"><label for="set-film">Film look on tours</label><input type="checkbox" id="set-film">
      <small>Widescreen bars, colour grade and lens streaks during tours and voyages.</small></div>
    <div class="row"><label for="set-flares">Sun glare when flying</label><input type="checkbox" id="set-flares">
      <small>The ghost discs, rings and rays when the Sun is in view. Tours and voyages keep theirs either way.</small></div>
    <div class="row"><label for="set-reduced">Reduced motion</label><input type="checkbox" id="set-reduced">
      <small>No camera sway, film grain or screen flashes; fades and slides stop. Starts from your system's setting.</small></div>
    <div class="foot">Remembered on this device · U or Esc closes</div>
  </div>`;
  document.body.append(root);
  const q = <T extends HTMLElement>(id: string) => root.querySelector('#' + id) as T;
  const scale = q<HTMLSelectElement>('set-scale'), vol = q<HTMLInputElement>('set-volume'), mute = q<HTMLInputElement>('set-mute');
  const film = q<HTMLInputElement>('set-film'), flares = q<HTMLInputElement>('set-flares'), red = q<HTMLInputElement>('set-reduced');
  let isOpen = false, from: HTMLElement | null = null;

  const sync = () => { scale.value = String(s.scale); vol.value = String(Math.round(s.volume * 100)); mute.checked = !sound.on; film.checked = s.film; flares.checked = s.flares; red.checked = s.reduced; };
  const changed = () => { save(s); apply(s); };
  scale.addEventListener('change', () => { s.scale = Number(scale.value); changed(); });
  vol.addEventListener('input', () => { s.volume = Number(vol.value) / 100; changed(); });
  mute.addEventListener('change', () => { sound.setOn(!mute.checked); });
  film.addEventListener('change', () => { s.film = film.checked; changed(); });
  flares.addEventListener('change', () => { s.flares = flares.checked; changed(); });
  red.addEventListener('change', () => { s.reduced = red.checked; changed(); });
  // Follow the system's setting while the person has not chosen one here.
  let chosen = false; try { chosen = JSON.parse(localStorage.getItem(KEY) ?? 'null')?.reduced !== undefined; } catch { /* */ }
  red.addEventListener('change', () => { chosen = true; });
  reduceQuery?.addEventListener?.('change', () => { if (!chosen) { s.reduced = reduceQuery.matches; sync(); apply(s); } });

  function open() {
    if (isOpen) return;
    document.exitPointerLock();
    from = document.activeElement as HTMLElement | null;
    sync();
    isOpen = true;
    document.body.classList.add('settings-open');
    scale.focus();
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    document.body.classList.remove('settings-open');
    if (from && document.contains(from) && from !== document.body) from.focus(); else (document.activeElement as HTMLElement | null)?.blur();
    from = null;
  }
  q('settings-x').addEventListener('click', close);
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
  // While it is open the game gets no keys; Tab stays inside the box.
  addEventListener('keydown', (e) => {
    if (!isOpen) return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape' || e.code === 'KeyU') { e.preventDefault(); close(); return; }
    if (e.code === 'Tab') {
      const f = [...root.querySelectorAll<HTMLElement>('select, input, button')];
      const i = f.indexOf(document.activeElement as HTMLElement);
      const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
      e.preventDefault(); f[n].focus();
    }
  }, true);
  apply(s);
  return { open, close, isOpen: () => isOpen, value: s, sync };
}
