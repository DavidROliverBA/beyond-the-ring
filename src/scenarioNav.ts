// Pure logic for the scenario controls: chapters, time text, the spoiler guard and the "where you left off" store.
// No DOM here, so the tests can run it (tools/scenarioNav.test.ts).

export interface Chapter { t: number; title: string }

/** Index of the chapter playing at `t` (the last one that has begun); -1 before the first, or with none. */
export function chapterAt(ch: readonly Chapter[], t: number): number {
  let k = -1;
  for (let i = 0; i < ch.length; i++) if (ch[i].t <= t + 1e-6) k = i;
  return k;
}

/** Where the "previous chapter" key goes: the start of this chapter, or the one before if you are within `slack` s of its start. Never below 0. */
export function prevChapterT(ch: readonly Chapter[], t: number, slack = 2): number {
  const k = chapterAt(ch, t);
  if (k < 0) return 0;
  if (t - ch[k].t > slack) return ch[k].t;
  return k > 0 ? ch[k - 1].t : 0;
}

/** Where "next chapter" goes: the next chapter's start, or null if this is the last (the caller then goes to the end or stays). */
export function nextChapterT(ch: readonly Chapter[], t: number): number | null {
  for (const c of ch) if (c.t > t + 1e-6) return c.t;
  return null;
}

/** 83.4 -> "1:23". */
export function fmtTime(s: number): string {
  const n = Math.max(0, Math.floor(s));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

export const clampT = (t: number, dur: number) => Math.min(dur, Math.max(0, t));

// ---------------------------------------------------------------- spoiler guard

export interface Guard { hide: boolean; upTo: number }
export const DEFAULT_GUARD: Guard = { hide: false, upTo: 1 };

/** Scenarios that may be listed: all of them, or only those from books up to `upTo`. */
export function visibleScenarios<T extends { book: number }>(list: readonly T[], g: Guard): T[] {
  return g.hide ? list.filter((s) => s.book <= g.upTo) : [...list];
}

// ---------------------------------------------------------------- stores (localStorage, injected so tests need no browser)

export interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void }
const browserStore = (): Store | null => { try { return localStorage; } catch { return null; } };

export const GUARD_KEY = 'beyond-ring.scn.guard';
export const RESUME_KEY = 'beyond-ring.scn.resume';

export function loadGuard(st: Store | null = browserStore()): Guard {
  try {
    const r = JSON.parse(st?.getItem(GUARD_KEY) ?? 'null') as Partial<Guard> | null;
    if (!r || typeof r !== 'object') return { ...DEFAULT_GUARD };
    return { hide: r.hide === true, upTo: Number.isFinite(r.upTo) && (r.upTo as number) >= 1 ? Math.floor(r.upTo as number) : 1 };
  } catch { return { ...DEFAULT_GUARD }; }
}
export function saveGuard(g: Guard, st: Store | null = browserStore()): void {
  try { st?.setItem(GUARD_KEY, JSON.stringify(g)); } catch { /* private window: forget */ }
}

/** Not worth offering a resume before this many seconds in, or within this many of the end. */
export const RESUME_MIN = 5, RESUME_TAIL = 5;

export function loadResume(st: Store | null = browserStore()): Record<string, number> {
  try {
    const r = JSON.parse(st?.getItem(RESUME_KEY) ?? 'null') as Record<string, unknown> | null;
    const out: Record<string, number> = {};
    if (r && typeof r === 'object') for (const [k, v] of Object.entries(r)) if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v;
    return out;
  } catch { return {}; }
}

/** Remember where `id` was left (seconds into a film `dur` long). Too early or too near the end clears it instead. */
export function saveResume(id: string, t: number, dur: number, st: Store | null = browserStore()): void {
  try {
    const all = loadResume(st);
    if (t < RESUME_MIN || t > dur - RESUME_TAIL) delete all[id]; else all[id] = Math.round(t * 10) / 10;
    st?.setItem(RESUME_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}
export const clearResume = (id: string, st: Store | null = browserStore()) => saveResume(id, 0, 1, st);
