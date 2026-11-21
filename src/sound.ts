// Sound, made in the browser with the Web Audio API: no recordings, so nothing to license or download.
// Space is silent, so what you hear is the ship: the drive through the hull, the hiss of thrusters as she
// turns end over end, the hum of her systems; the gates and the Ring add a low swell; on foot there is the
// room's air handling and your footsteps. Small tones answer the controls. K turns it all off and on.

export interface SoundState {
  /** Drive level 0..1. */
  engine: number;
  /** The ship is turning end over end or round (the thrusters fire). */
  turning: boolean;
  walking: boolean;
  /** Walking speed, m/s. */
  pace: number;
  /** In the ring space. */
  ring: boolean;
  /** Where on foot: a bigger, emptier place hums lower. */
  place?: string;
}
export type Ping = 'engage' | 'plot' | 'open' | 'close' | 'dock' | 'undock' | 'gate' | 'arrive' | 'select';

export interface Sound {
  /** Call from a click or key press (browsers won't start audio before one). */
  start(): void;
  update(s: SoundState, dt: number): void;
  ping(p: Ping): void;
  toggle(): boolean;
  readonly on: boolean;
  /** Loudness of what is playing now, 0..1 (for tests). */
  level(): number;
}

const KEY = 'btr-sound';

export function createSound(): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let on = true;
  try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* private window: stay on */ }

  const nodes = {} as {
    drive: GainNode; driveLP: BiquadFilterNode; sub: GainNode; hiss: GainNode; hum: GainNode; swell: GainNode; room: GainNode; roomLP: BiquadFilterNode;
  };
  let stepClock = 0;
  let noise: AudioBuffer;
  let meter: AnalyserNode;

  function brown(c: AudioContext, secs: number, white = false) {
    const b = c.createBuffer(1, c.sampleRate * secs, c.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = white ? w : (last + 0.02 * w) / 1.02;
      d[i] = white ? w * 0.5 : last * 3.5;
    }
    return b;
  }
  const loop = (c: AudioContext, buf: AudioBuffer) => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };

  function build(c: AudioContext) {
    master = c.createGain();
    master.gain.value = on ? 0.55 : 0;
    master.connect(c.destination);
    meter = c.createAnalyser(); meter.fftSize = 512; master.connect(meter);
    const brownBuf = brown(c, 3), whiteBuf = brown(c, 2, true);
    noise = whiteBuf;
    const gain = (v = 0) => { const g = c.createGain(); g.gain.value = v; g.connect(master); return g; };

    // The drive, felt through the hull: a roar of low noise, and a deep tone under it.
    nodes.drive = gain();
    nodes.driveLP = c.createBiquadFilter(); nodes.driveLP.type = 'lowpass'; nodes.driveLP.frequency.value = 200;
    loop(c, brownBuf).connect(nodes.driveLP).connect(nodes.drive);
    nodes.sub = gain();
    for (const [f, t] of [[38, 'sine'], [57, 'triangle']] as const) { const o = c.createOscillator(); o.type = t; o.frequency.value = f; o.connect(nodes.sub); o.start(); }

    // Thrusters: bursts of hiss.
    nodes.hiss = gain();
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.7;
    loop(c, whiteBuf).connect(bp).connect(nodes.hiss);

    // The ship's own hum: fans and pumps, always there in flight.
    nodes.hum = gain();
    for (const [f, v] of [[55, 0.5], [82.4, 0.25], [110.4, 0.12]] as const) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = c.createGain(); g.gain.value = v; o.connect(g).connect(nodes.hum); o.start();
    }
    const air = c.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 140;
    const ag = c.createGain(); ag.gain.value = 0.6;
    loop(c, brownBuf).connect(air).connect(ag).connect(nodes.hum);

    // Gates and the Ring: a slow, wide swell.
    nodes.swell = gain();
    for (const [f, d] of [[48, 0], [48.7, 0], [72.3, 0], [96.6, 0.4]] as const) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f + d;
      const g = c.createGain(); g.gain.value = 0.35; o.connect(g).connect(nodes.swell); o.start();
      const lfo = c.createOscillator(); lfo.frequency.value = 0.07 + f / 2000; const lg = c.createGain(); lg.gain.value = 0.15; lfo.connect(lg).connect(g.gain); lfo.start();
    }

    // On foot: air handling.
    nodes.room = gain();
    nodes.roomLP = c.createBiquadFilter(); nodes.roomLP.type = 'lowpass'; nodes.roomLP.frequency.value = 420;
    loop(c, brownBuf).connect(nodes.roomLP).connect(nodes.room);
  }

  const env = (g: GainNode, t: number, peak: number, attack: number, decay: number) => {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };

  function tone(freqs: number[], dur: number, gainV = 0.12, type: OscillatorType = 'sine', gap = 0.09) {
    if (!ctx) return;
    freqs.forEach((f, i) => {
      const t = ctx!.currentTime + i * gap, o = ctx!.createOscillator(), g = ctx!.createGain();
      o.type = type; o.frequency.value = f;
      env(g, t, gainV, 0.01, dur);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + dur + 0.1);
    });
  }
  function sweep(from: number, to: number, secs: number, vol: number) {
    if (!ctx) return;
    const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; s.loop = true;
    f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + secs * 0.5); f.frequency.exponentialRampToValueAtTime(from, t + secs);
    env(g, t, vol, secs * 0.4, secs * 0.6);
    s.connect(f).connect(g).connect(master);
    s.start(t); s.stop(t + secs + 0.2);
  }
  function step(vol: number) {
    if (!ctx) return;
    const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise;
    f.type = 'lowpass'; f.frequency.value = 500 + Math.random() * 400;
    env(g, t, vol, 0.004, 0.07);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random()); s.stop(t + 0.12);
  }

  const api: Sound = {
    get on() { return on; },
    level() {
      if (!ctx) return 0;
      const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d);
      return Math.sqrt(d.reduce((a, v) => a + v * v, 0) / d.length);
    },
    start() {
      if (!ctx) {
        try { ctx = new AudioContext(); build(ctx); } catch { ctx = null; return; }
      }
      if (ctx.state === 'suspended') void ctx.resume();
    },
    toggle() {
      on = !on;
      try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
      if (ctx) master.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.1);
      if (on) { api.start(); tone([660, 880], 0.18, 0.08); }
      return on;
    },
    update(s, dt) {
      if (!ctx || !on) return;
      const t = ctx.currentTime, k = 0.25;
      const flying = !s.walking;
      nodes.drive.gain.setTargetAtTime(flying ? 0.5 * s.engine ** 1.2 : 0, t, k);
      nodes.driveLP.frequency.setTargetAtTime(160 + 700 * s.engine, t, k);
      nodes.sub.gain.setTargetAtTime(flying ? 0.22 * s.engine : 0, t, k);
      nodes.hiss.gain.setTargetAtTime(flying && s.turning ? 0.1 : 0, t, 0.15);
      nodes.hum.gain.setTargetAtTime(flying ? 0.09 : 0, t, 0.6);
      nodes.swell.gain.setTargetAtTime(s.ring && flying ? 0.1 : 0, t, 1.5);
      nodes.room.gain.setTargetAtTime(s.walking ? 0.22 : 0, t, 0.5);
      nodes.roomLP.frequency.setTargetAtTime(s.place === 'medina' ? 260 : 420, t, 0.5);
      if (s.walking && s.pace > 0.4) {
        stepClock += dt * s.pace;
        if (stepClock > 1.3) { stepClock = 0; step(0.18 + Math.min(0.2, s.pace * 0.03)); }
      } else stepClock = 1.2;
    },
    ping(p) {
      if (!ctx || !on) return;
      switch (p) {
        case 'engage': tone([520, 780, 1040], 0.22, 0.09); break;
        case 'plot': tone([440, 660, 990], 0.3, 0.1, 'triangle'); break;
        case 'open': tone([700], 0.1, 0.06); break;
        case 'close': tone([500], 0.1, 0.05); break;
        case 'select': tone([900], 0.06, 0.04); break;
        case 'arrive': tone([660, 520], 0.4, 0.07, 'sine', 0.18); break;
        case 'dock': sweep(120, 900, 1.2, 0.25); tone([110], 0.5, 0.2); break;
        case 'undock': sweep(900, 120, 1.2, 0.25); break;
        case 'gate': sweep(150, 5000, 2.2, 0.4); tone([55, 110], 1.6, 0.18, 'sine', 0.05); break;
      }
    },
  };
  return api;
}
