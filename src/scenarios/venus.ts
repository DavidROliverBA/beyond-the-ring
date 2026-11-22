// "Eros and Venus" (Leviathan Wakes, the ending): the protomolecule-ridden asteroid Eros is turned away from Earth and falls into Venus
// with the Rocinante behind it; then something begins to grow where it struck. Research: docs/research/canon/leviathan-wakes.md, SP8 and SP9.
// All lengths are metres, times are seconds of film. The frame is pinned to VENUS (its centre is the origin, +x points at the Sun), so the
// real planet, atmosphere and sunlight are the backdrop whatever date the sim is on; Eros and the Rocinante are actors in that frame.
//
// What the sources give (the note's grades) and what we made up:
//  - Eros ends up hitting Venus: B (Wikipedia and an aggregator agree). The order (taken over, heads for Earth, turned, impact, towers): B.
//  - Where it comes from and which side of Venus it strikes: the note has nothing. The approach direction, the impact point (on the Sun side so
//    it can be seen) and the whole course are INVENTED. The start is somewhere about 1 AU from Eros's own orbit in the story; we do not draw that.
//  - Eros's acceleration: "a rate no human ship can match" (W, per digest), no figure. We give it no drive plume (the note suggests
//    "acceleration with no visible plume"). The film is a TIME-LAPSE: the dive is far faster than any real ship, and the captions say by how much
//    it outruns a 3 g ship, from src/transit.ts. Its own acceleration is invented, and nothing in the film is to scale in time.
//  - The Rocinante's chase is C (the note: "the ships and missiles chase"). She trails Eros and breaks off before the impact. Her offset, the
//    breaking-off and every acceleration are invented. The missiles launched at Eros (GS, C, which conflicts with W) are NOT shown: unresolved.
//  - Miller and Julie: the story of why the course changes is an interior one and is not drawn. The bend is just a bend, at an invented moment.
//  - The impact flash is drawn FAR larger than a 34 km rock's real blast, so it reads at this distance. Its size is invented.
//  - The epilogue (SP9, grade C): two crystalline towers grow at the impact site (GS, grade C; W says only "a vast structure"). Their number is
//    from GS; their shape, height (2,000 km), how fast they grow and where they stand are INVENTED. A time-jump caption says so.
//  - Venus's clouds turn on the real planet's own rotation, so the impact site slides slowly under the camera; the towers are not tied to it.
//  - Eros's size (34 km, the real asteroid's length) is from our body data (E). Its shape here is a made-up peanut.
// No book text is used; captions are written fresh.

import type { Scenario, ScnShot, Vec } from '../scenario';
import { VENUS_R, interceptAccel, lapseFactor, len, pushed, surfacePoint, tripRange, unit, type V } from './lwEnding';

const Z: Vec = [0, 0, 0];
const S = (s: Partial<ScnShot> & Pick<ScnShot, 't0' | 'id' | 'secs'>): ScnShot => ({ from: Z, to: Z, ...s });

// ---- Eros's course. Frame: Venus at the origin, +x at the Sun, y up. All invented.
const T_BEND = 46, T_HIT = 122;
const P0: V = [2.0e8, 2.0e7, -3.0e8];
const V0: V = [-0.9e6, 0, 2.4e6];
const IMPACT: V = surfacePoint([0.78, 0.22, -0.58], VENUS_R);
const P1: V = [P0[0] + V0[0] * T_BEND, P0[1] + V0[1] * T_BEND, P0[2] + V0[2] * T_BEND];
const DIVE = interceptAccel(P1, V0, IMPACT, T_HIT - T_BEND);
export const DIVE_DISTANCE = len([IMPACT[0] - P1[0], IMPACT[1] - P1[1], IMPACT[2] - P1[2]]);
/** How many times faster than a 3 g ship the last stretch of the dive is. */
export const DIVE_LAPSE = lapseFactor(DIVE_DISTANCE, T_HIT - T_BEND, 3);
const REAL_MIN = Math.round(Math.sqrt((2 * DIVE_DISTANCE) / (3 * 9.80665)) / 60);

// The Rocinante trails Eros, behind her late heading, then peels away to the north before the strike.
const HEAD = unit([IMPACT[0] - P1[0], IMPACT[1] - P1[1], IMPACT[2] - P1[2]]);
const BEHIND: Vec = [-HEAD[0] * 2.5e5 + 3e4, -HEAD[1] * 2.5e5 + 6e4, -HEAD[2] * 2.5e5 + 5e4];
const T_PEEL = 96;
export const PEEL = { dir: unit([-0.25, 0.95, 0.15]) as V, g: 4200 };
export const SPIRE_H = 2.0e6;
const SP1: Vec = surfacePoint([0.80, 0.30, -0.52], VENUS_R * 0.995);
const SP2: Vec = surfacePoint([0.72, 0.16, -0.66], VENUS_R * 0.995);
const out = (p: Vec): Vec => unit(p) as Vec;

export const VENUS: Scenario = {
  id: 'lw-venus',
  title: 'Eros and Venus',
  book: 1, bookTitle: 'Leviathan Wakes',
  spoiler: 'Spoils the ending of Leviathan Wakes: Eros is steered into Venus, and something starts to grow where it lands.',
  sources: ['docs/research/canon/leviathan-wakes.md#sp8', 'docs/research/canon/leviathan-wakes.md#sp9'],
  frame: {
    space: 'sol',
    // The fallback place (used only if the planet cannot be found): where Venus's own orbit sits.
    origin: { au: 0.723, angle: 2.3 },
    body: { id: 'venus', sunward: true },
    seed: 91,
  },
  time: { duration: 196, scale: 'compressed', note: 'Invented: a time-lapse of a dive no source times. The epilogue jumps ahead by an unstated time.' },
  actors: [
    { id: 'eros', name: 'Eros', model: 'asteroid', len: 34000, confidence: 'B', invented: true, note: 'Fate B (it hits Venus). Size from our body data; shape, course and speed invented. No drive plume.' },
    { id: 'roci', name: 'Rocinante', model: 'corvette', len: 46, faction: 'mcrn', confidence: 'C', plume: { burn: 1.6 }, crew: 4, invented: true, note: 'The chase is C; her place in it, and breaking off, are invented.' },
    { id: 'tower1', name: 'Tower', model: 'spire', len: SPIRE_H, confidence: 'C', invented: true, grow: { t0: 142, t1: 186, from: 0.001 }, note: 'Two towers: GS, grade C. Shape, height, place and growth invented.' },
    { id: 'tower2', name: 'Tower', model: 'spire', len: SPIRE_H * 0.8, confidence: 'C', invented: true, grow: { t0: 146, t1: 186, from: 0.001 } },
  ],
  tracks: {
    // Eros: a straight run across the sky, bending at T_BEND into a dive at the sun-side of Venus. Her nose is along her way.
    eros: [
      { t: 0, type: 'coast', from: P0, vel: V0, face: V0, spin: [0.0004, 0.0009, 0.0002] },
      { t: T_BEND, type: 'accel', dir: DIVE.dir, g: DIVE.g, turn: 30 },
      // At the strike she stops dead (so the blast and the wreckage start from the spot, not carried on into the planet).
      { t: T_HIT, type: 'hold', at: 'here', face: 'here' },
    ],
    roci: [
      { t: 0, type: 'follow', target: 'eros', offset: BEHIND, aim: 'eros' },
      { t: T_PEEL, type: 'accel', dir: PEEL.dir, g: PEEL.g, turn: 0.35 },
    ],
    tower1: [{ t: 0, type: 'hold', at: SP1, face: out(SP1) }],
    tower2: [{ t: 0, type: 'hold', at: SP2, face: out(SP2) }],
  },
  events: [
    { t: T_HIT, type: 'hit', target: 'eros', fx: 'fireball', damage: 'destroy', radius: 1.4e6 },
    { t: T_HIT, type: 'debris', from: 'eros', n: 300, seed: 5, speed: 9e5, chunks: 30, scale: 1500 },
    { t: T_HIT, type: 'silence', dur: 16 },
  ],
  shots: [
    S({ t0: 0, id: 'eros', from: [7, 0.7, 0.15], to: [5.6, 1.6, 0.25], secs: 20, fov: 38 }),
    S({ t0: 20, id: 'roci', mode: 'chase', back: 130, up: 30, secs: 24, fov: 46 }),
    S({ t0: 44, id: 'eros', from: [9, -0.4, 0.3], to: [8, 0.2, 0.4], secs: 14, fov: 36 }),
    S({ t0: 58, id: 'roci', mode: 'chase', back: 400, up: 80, secs: 22, fov: 50 }),
    S({ t0: 80, id: 'roci', mode: 'pov', offset: [0, 14, -26], look: 'eros', secs: 16, fov: 40 }),
    S({ t0: 96, id: 'roci', mode: 'chase', back: 150, up: 40, secs: 12, fov: 42 }),
    S({ t0: 108, id: 'eros', mode: 'chase', back: 1.5e5, up: 2e4, secs: 14, fov: 40 }),
    S({ t0: 122, id: 'eros', mode: 'static', at: [2.4e7, 7e6, -1.2e7], secs: 18, fov: 26 }),
    S({ t0: 140, id: 'tower1', from: [18, -1.0, 0.25], to: [14, -0.9, 0.3], secs: 30, fov: 32 }),
    S({ t0: 170, id: 'tower1', from: [40, -1.1, 0.2], to: [34, -0.8, 0.15], secs: 26, fov: 34 }),
  ],
  captions: [
    { t: 1, dur: 11, title: 'Eros', text: 'A rock thirty-four kilometres long, with something inside it that no one asked for. It is moving as no ship could.' },
    { t: 14, dur: 9, title: 'No flame', text: 'There is no drive plume to see. Nothing about how it moves fits any engine people have.' },
    { t: 24, dur: 12, title: 'The Rocinante', text: 'The Rocinante has followed it all the way, a speck beside a mountain. Her crew can only watch where it goes.' },
    { t: 47, dur: 12, title: 'A new course', text: 'It turns. The path to Earth is gone, and the rock swings inward, towards Venus.' },
    { t: 62, dur: 14, title: 'Time-lapse', text: `Not to scale in time: a ship pushing at 3 g would take about ${REAL_MIN} minutes to cover this last stretch. The film does it in ${T_HIT - T_BEND} seconds.` },
    { t: 97, dur: 10, title: 'Breaking off', text: 'The Rocinante peels away. She can follow no further.' },
    { t: 123, dur: 14, title: 'Impact', text: 'Eros strikes Venus. The flash is drawn far larger than the real blast would be, so that it can be seen. Space is silent.' },
    { t: 143, dur: 13, title: 'Afterwards', text: 'Time has jumped, by an amount no source gives. Where the rock fell, something has begun to grow out of the cloud.' },
    { t: 160, dur: 14, title: 'Two towers', text: 'Two crystalline spires climb from the planet. Their shape and height here are guesses; only the fact of them is in the story.' },
    { t: 177, dur: 14, title: 'The end of the book', text: 'The thing that took Eros has what it wanted. The story that follows is a larger one.' },
  ],
  chapters: [
    { t: 0, title: 'Eros under way' },
    { t: 24, title: 'The Rocinante follows' },
    { t: 47, title: 'A new course' },
    { t: 62, title: 'Time-lapse inward' },
    { t: 97, title: 'Breaking off' },
    { t: 123, title: 'Impact on Venus' },
    { t: 143, title: 'Afterwards: the towers' },
  ],
  notes: [
    'Order of events: B (impact on Venus: Wikipedia and an aggregator agree). Everything geometric is invented: the approach, the strike point, the speeds.',
    `The dive is a time-lapse: its last stretch is ${(DIVE_DISTANCE / 1000).toFixed(0)} km in ${T_HIT - T_BEND} s, about ${DIVE_LAPSE.toFixed(0)} times faster than a ship at 3 g. The real trip would take ${tripRange(0.3, 1.5, 3)} at 3 g for 0.3 to 1.5 AU (src/transit.ts, rest to rest); the note's own figures disagree with this and are not used.`,
    'Missiles fired at Eros (GS, C, conflicting with W) are not shown. The two towers: grade C. Their shape and size are guesses.',
  ],
};
void pushed;
