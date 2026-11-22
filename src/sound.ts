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
/** Sounds of a fight, as heard from inside a hull (a ship's own guns, what strikes her, her drive). */
export type Sfx = 'pdc' | 'launch' | 'impact' | 'rail' | 'boom' | 'breach' | 'roar';
export interface SfxOptions { dur?: number; rate?: number; burst?: number; gap?: number }
export type Ping = 'engage' | 'plot' | 'open' | 'close' | 'dock' | 'undock' | 'gate' | 'arrive' | 'select';

export interface Sound {
  /** Call from a click or key press (browsers won't start audio before one). */
  start(): void;
  update(s: SoundState, dt: number): void;
  ping(p: Ping): void;
  /** A soft ambient score under a tour: it swells in and fades out. */
  score(on: boolean): void;
  /** The rush as the camera sets off on a flight; `strength` 0..1. */
  whoosh(strength?: number): void;
  /** A sound from a fight (see `Sfx`); the caller has already judged it audible from where the camera is. `vol` is 0..1.3. */
  sfx(kind: Sfx, vol?: number, o?: SfxOptions): void;
  /** The scenario's mix, each frame. `ship`: the camera is inside a hull, so her drive and hum come through; outside (false) nothing but the score is heard,
   *  because the books' space is quiet. `drive` is her drive level 0..1. Pass null when no scenario is playing. */
  scene(h: { ship: boolean; drive: number } | null): void;
  /** Fade the score out for `secs` seconds (a big event: let the silence do the work), then bring it back slowly. */
  duck(secs: number): void;
  /** How many of each fight sound have been played (for tests). */
  readonly played: Record<string, number>;
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
  let noise: AudioBuffer, brownNoise: AudioBuffer;
  let hullBus: GainNode | null = null;
  let hearing: { ship: boolean; drive: number } | null = null;
  let duckUntil = 0;
  const played: Record<string, number> = {};
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
    noise = whiteBuf; brownNoise = brownBuf;
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

  // The score: four slow chords of soft pads that overlap, through a long echo, as a film's strings would.
  const CHORDS = [
    [73.4, 220, 293.7, 349.2, 440], [58.3, 233.1, 293.7, 349.2, 466.2], [87.3, 220, 261.6, 349.2, 440], [65.4, 196, 261.6, 329.6, 392],
  ];
  let scoreOn = false, scoreBus: GainNode | null = null, scoreTimer = 0, chordN = 0;
  function playChord() {
    if (!ctx || !scoreBus) return;
    const t = ctx.currentTime, dur = 13;
    CHORDS[chordN++ % CHORDS.length].forEach((f, i) => {
      for (const det of [-7, 6]) {
        const o = ctx!.createOscillator(), g = ctx!.createGain();
        o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.value = f; o.detune.value = det;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(i === 0 ? 0.16 : 0.05, t + 4.5);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(scoreBus!);
        o.start(t); o.stop(t + dur + 0.2);
      }
    });
  }
  function buildScore(c: AudioContext) {
    scoreBus = c.createGain(); scoreBus.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.4;
    const dly = c.createDelay(2), fb = c.createGain(), wet = c.createGain();
    dly.delayTime.value = 0.62; fb.gain.value = 0.42; wet.gain.value = 0.55;
    scoreBus.connect(lp);
    lp.connect(master);
    lp.connect(dly); dly.connect(fb).connect(dly); dly.connect(wet).connect(master);
  }

  /** The hull: everything inside a ship comes through a lowpass and a little room. */
  function hull(c: AudioContext) {
    if (hullBus) return hullBus;
    hullBus = c.createGain(); hullBus.gain.value = 1;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.5;
    hullBus.connect(lp).connect(master);
    return hullBus;
  }
  /** A burst of noise through a filter with a shaped loudness. */
  function burstNoise(c: AudioContext, bus: AudioNode, t: number, from: number, to: number, type: BiquadFilterType, q: number, vol: number, attack: number, decay: number, brownish = false) {
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = brownish ? brownNoise : noise; s.loop = true;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + attack + decay);
    env(g, t, vol, attack, decay);
    s.connect(f).connect(g).connect(bus);
    s.start(t, Math.random()); s.stop(t + attack + decay + 0.1);
  }
  /** A tone that falls in pitch: the body of a thump. */
  function thump(c: AudioContext, bus: AudioNode, t: number, f0: number, f1: number, vol: number, decay: number, type: OscillatorType = 'sine') {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + decay);
    env(g, t, vol, 0.004, decay);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + decay + 0.05);
  }
  function fightSound(kind: Sfx, vol: number, o: SfxOptions) {
    const c = ctx!, bus = hull(c), t = c.currentTime + 0.01;
    switch (kind) {
      case 'pdc': {
        // A rattle: one noise source gated into rounds, with a thud under each. Bursts of `burst` seconds, `gap` apart.
        const rate = o.rate ?? 55, burst = o.burst ?? 0.4, gap = o.gap ?? 0.3, dur = Math.min(o.dur ?? 1, 12);
        const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
        src.buffer = noise; src.loop = true;
        bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.8;
        g.gain.value = 0.0001;
        const th = c.createOscillator(), tg = c.createGain();
        th.type = 'triangle'; th.frequency.value = 95;
        tg.gain.value = 0.0001;
        src.connect(bp).connect(g).connect(bus); th.connect(tg).connect(bus);
        const cyc = burst + gap, per = 1 / rate;
        for (let b = 0; b * cyc < dur; b++) {
          for (let i = 0; i * per < burst && b * cyc + i * per < dur; i++) {
            const ti = t + b * cyc + i * per;
            const a = vol * (0.22 + 0.1 * Math.random());
            g.gain.setValueAtTime(0.0001, ti);
            g.gain.linearRampToValueAtTime(a, ti + 0.002);
            g.gain.exponentialRampToValueAtTime(0.0001, ti + per * 0.8);
            tg.gain.setValueAtTime(0.0001, ti);
            tg.gain.linearRampToValueAtTime(a * 0.9, ti + 0.003);
            tg.gain.exponentialRampToValueAtTime(0.0001, ti + per * 0.9);
          }
        }
        const end = t + dur + 0.3;
        src.start(t, Math.random()); th.start(t); src.stop(end); th.stop(end);
        break;
      }
      case 'launch': {
        // A heavy thump through the deck, then the rush of the motor leaving.
        thump(c, bus, t, 90, 28, 0.55 * vol, 0.5);
        burstNoise(c, bus, t, 900, 140, 'lowpass', 0.7, 0.3 * vol, 0.02, 1.1, true);
        burstNoise(c, bus, t + 0.05, 2600, 300, 'bandpass', 1, 0.07 * vol, 0.3, 1.4);
        break;
      }
      case 'impact': {
        // Something hits the hull: a crack, a boom that rings through the structure, a metallic shiver.
        burstNoise(c, bus, t, 1800, 200, 'lowpass', 0.7, 0.5 * vol, 0.002, 0.18);
        thump(c, bus, t, 70, 24, 0.7 * vol, 0.9);
        for (const [f, d] of [[310, 0.9], [487, 0.6], [731, 0.4]] as const) thump(c, bus, t + 0.01, f, f * 0.97, 0.07 * vol, d, 'sine');
        burstNoise(c, bus, t + 0.1, 500, 90, 'lowpass', 0.5, 0.18 * vol, 0.05, 1.6, true);
        break;
      }
      case 'rail': {
        // The slug leaves: a sharp crack and a deep thump that shakes the frame.
        burstNoise(c, bus, t, 4000, 500, 'highpass', 0.7, 0.4 * vol, 0.001, 0.12);
        thump(c, bus, t, 120, 22, 0.8 * vol, 0.7);
        burstNoise(c, bus, t, 600, 60, 'lowpass', 0.6, 0.35 * vol, 0.01, 0.9, true);
        break;
      }
      case 'boom': {
        // A ship goes: a blow, and a long low roar as the frame groans and settles.
        burstNoise(c, bus, t, 2200, 80, 'lowpass', 0.6, 0.7 * vol, 0.003, 0.5);
        thump(c, bus, t, 60, 18, 1.0 * vol, 2.4);
        burstNoise(c, bus, t + 0.1, 380, 40, 'lowpass', 0.5, 0.55 * vol, 0.15, 4.2, true);
        thump(c, bus, t + 0.4, 38, 22, 0.35 * vol, 3, 'triangle');
        break;
      }
      case 'breach': {
        // Air leaving: a hiss that climbs and thins, with a low bang as the plate goes.
        thump(c, bus, t, 80, 30, 0.5 * vol, 0.5);
        burstNoise(c, bus, t, 2500, 7000, 'highpass', 0.5, 0.2 * vol, 0.08, Math.min(o.dur ?? 4, 8));
        burstNoise(c, bus, t, 300, 120, 'lowpass', 0.6, 0.3 * vol, 0.05, 2, true);
        break;
      }
      case 'roar': {
        burstNoise(c, bus, t, 120, 700, 'lowpass', 0.8, 0.5 * vol, 0.4, 1.8, true);
        thump(c, bus, t, 42, 60, 0.3 * vol, 1.8, 'triangle');
        break;
      }
    }
  }

  const api: Sound = {
    score(want) {
      if (!ctx || want === scoreOn) return;
      scoreOn = want;
      if (!scoreBus) buildScore(ctx);
      const t = ctx.currentTime;
      scoreBus!.gain.cancelScheduledValues(t);
      scoreBus!.gain.setTargetAtTime(want && t >= duckUntil ? 0.9 : 0, t, want ? 2.5 : 1.8);
      clearInterval(scoreTimer);
      if (want) { playChord(); scoreTimer = window.setInterval(() => { if (scoreOn && on) playChord(); }, 9500); }
    },
    whoosh(strength = 0.7) {
      if (!ctx || !on) return;
      sweep(180, 2800, 2.0, 0.12 * strength);
      tone([46], 1.5, 0.1 * strength, 'sine', 0);
    },
    get on() { return on; },
    get played() { return played; },
    scene(h) { hearing = h; },
    duck(secs) {
      if (!ctx || !scoreBus || !scoreOn) return;
      const t = ctx.currentTime;
      duckUntil = t + secs;
      scoreBus.gain.cancelScheduledValues(t);
      scoreBus.gain.setTargetAtTime(0, t, 0.3);
      scoreBus.gain.setTargetAtTime(0.9, t + secs, 3);
    },
    sfx(kind, vol = 1, o = {}) {
      if (!ctx || !on) return;
      played[kind] = (played[kind] ?? 0) + 1;
      fightSound(kind, vol, o);
    },
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
      // In a scenario, outside the hull there is no drive and no hum: the film's own rule is that space is silent.
      const quiet = hearing !== null && !hearing.ship;
      if (hearing && hearing.ship) s = { ...s, engine: hearing.drive };
      const flying = !s.walking && !quiet;
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
