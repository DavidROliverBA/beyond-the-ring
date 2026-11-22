// "The Anubis" (Leviathan Wakes): the Rocinante follows the coordinates from Julie's phone to a lone asteroid, finds the stealth ship
// that destroyed the Canterbury abandoned there, and destroys it. Research: docs/research/canon/leviathan-wakes.md, SP6.
// All lengths are metres, times are seconds of film.
//
// What the sources give (the note's grades) and what we made up:
//  - The order (coordinates, a lone asteroid, the Anubis found abandoned, a recording, the Rocinante destroys her): B. The outcome is A.
//  - Where it is: "a lone asteroid at coordinates from Julie's phone", no position (the note). The pin below, and the rock itself, are INVENTED:
//    a made-up peanut rock 3 km long, in no catalogue. It is out in the Belt's outer part so the sky is empty.
//  - The Anubis is "derelict, covered in biomass" (note). We have no biomass model: she is the stealth hull, dark, drifting, NOT covered. Where
//    she lies against the rock, and her slow turn, are invented.
//  - Boarding and the recording are interior scenes and are NOT shown. The film just holds the Rocinante alongside for a while. How long: invented.
//  - Who fires: a long source says the Rocinante, a snippet credits one crewman (F, WS; C). We name no one. The weapon is one torpedo (C), with
//    an ordinary ship-killing fireball, not a nuclear flash (the note says nothing of yield). Ranges, speeds and flight time: invented.
//  - All accelerations (the Rocinante at 2.5 g, flip and burn; the torpedo's) are invented. Her approach and her backing away use `burn` legs, so
//    those times come from the real flip-and-burn maths (src/transit.ts) for those invented distances and rates.
//  - Time is compressed: no source gives a duration.
// No book text is used; captions are written fresh.

import type { Scenario, ScnShot, Vec } from '../scenario';

const Z: Vec = [0, 0, 0];
const S = (s: Partial<ScnShot> & Pick<ScnShot, 't0' | 'id' | 'secs'>): ScnShot => ({ from: Z, to: Z, ...s });

const ANUBIS_AT: Vec = [2600, 300, 300];
const ALONGSIDE: Vec = [2470, 420, 20];
const STANDOFF: Vec = [8200, 1500, 4200];

export const ANUBIS: Scenario = {
  id: 'lw-anubis',
  title: 'The Anubis',
  book: 1, bookTitle: 'Leviathan Wakes',
  spoiler: 'Spoils the ending of Leviathan Wakes: the crew find the stealth ship behind the attacks, abandoned, and destroy it.',
  sources: ['docs/research/canon/leviathan-wakes.md#sp6'],
  frame: {
    space: 'sol',
    // An empty place in the outer Belt. No source gives one.
    origin: { au: 3.35, angle: 5.1 },
    seed: 61,
  },
  time: { duration: 150, scale: 'compressed', note: 'Invented: no public source gives the length of any part of this.' },
  actors: [
    { id: 'rock', name: 'Asteroid', model: 'asteroid', len: 3000, confidence: '?', invented: true, note: 'The note: "would be an invented rock". 3 km, shape, spin: invented.' },
    { id: 'anubis', name: 'Anubis', model: 'stealth', len: 150, faction: 'protogen', confidence: 'B', stealth: true, note: 'Found abandoned: B. Not shown covered in growth (no model for it). Pose invented.' },
    { id: 'roci', name: 'Rocinante', model: 'corvette', len: 46, faction: 'opa', confidence: 'A', plume: { burn: 1.2 }, crew: 4, note: 'Her role in finding and destroying the Anubis: A (outcome). Torpedo: C.' },
  ],
  tracks: {
    rock: [{ t: 0, type: 'coast', from: Z, vel: Z, face: [1, 0.1, 0.3], spin: [0.0012, 0.0021, 0.0008] }],
    anubis: [{ t: 0, type: 'coast', from: ANUBIS_AT, vel: Z, face: [0.4, 0.1, -1], spin: [0.0009, 0.0016, 0.0004] }],
    roci: [
      // From 10 km out: flip and burn to stand off the Anubis; stay while the crew go across; then back away to 7 km.
      { t: 0, type: 'burn', from: [9000, 2500, 5200], to: ALONGSIDE, g: 2.5, flip: 8 },
      { t: 72, type: 'burn', from: 'here', to: STANDOFF, g: 2.5, flip: 6 },
    ],
  },
  events: [
    { t: 108, type: 'fire', weapon: 'torpedo', from: 'roci', to: 'anubis', hit: 120, count: 1, invented: true },
    { t: 120, type: 'hit', target: 'anubis', fx: 'fireball', damage: 'destroy', radius: 260 },
    { t: 120, type: 'debris', from: 'anubis', n: 200, seed: 8, speed: 140, chunks: 26, scale: 0.7 },
    { t: 120, type: 'silence', dur: 12 },
  ],
  shots: [
    S({ t0: 0, id: 'rock', from: [3.2, 0.7, 0.25], to: [2.8, 1.5, 0.3], secs: 16, fov: 40 }),
    S({ t0: 16, id: 'roci', mode: 'chase', back: 90, up: 20, secs: 22, fov: 42 }),
    S({ t0: 38, id: 'anubis', from: [5, 0.9, 0.2], to: [3.2, 1.7, 0.3], secs: 14, fov: 34 }),
    S({ t0: 52, id: 'anubis', mode: 'pov', look: 'anubis', offset: [-18, 8, -40], secs: 20, fov: 34 }),
    S({ t0: 72, id: 'roci', mode: 'chase', back: 110, up: 24, secs: 20, fov: 40 }),
    S({ t0: 92, id: 'anubis', mode: 'static', at: [4200, 1100, 2600], secs: 16, fov: 24 }),
    S({ t0: 108, id: 'roci', mode: 'static', at: [6800, 2300, 2400], secs: 12, fov: 26 }),
    S({ t0: 120, id: 'anubis', mode: 'static', at: [4300, 1000, 2300], secs: 14, fov: 24 }),
    S({ t0: 134, id: 'roci', from: [10, 0.9, 0.25], to: [14, 1.8, 0.3], secs: 16, fov: 36 }),
  ],
  captions: [
    { t: 1, dur: 13, title: 'The coordinates', text: 'Julie\'s phone gave a place: a lone rock, far from any lane. No source says where. This one is our own.' },
    { t: 18, dur: 12, title: 'Flip and burn', text: 'The Rocinante comes in fast, turns end for end, and brakes to a stop beside the rock.' },
    { t: 38, dur: 13, title: 'A ship in the dark', text: 'There she is, black on black: the stealth ship that killed the Canterbury, drifting with her drive cold.' },
    { t: 54, dur: 16, title: 'Across', text: 'A party crosses to her. What they find aboard, and what a recording there tells them, is not shown here.' },
    { t: 74, dur: 12, title: 'Backing off', text: 'Back aboard, the Rocinante pulls away from the wreck of a plan.' },
    { t: 98, dur: 9, title: 'Left behind', text: 'The crew decide the ship must not be left for anyone else to find.' },
    { t: 109, dur: 9, title: 'One torpedo', text: 'It runs straight and true across the gap.' },
    { t: 122, dur: 12, title: 'Gone', text: 'The Anubis is destroyed. Space carries no sound, so there is none here.' },
    { t: 136, dur: 12, title: 'Onward', text: 'The Rocinante turns away. What the dead ship\'s makers started is not over.' },
  ],
  chapters: [
    { t: 0, title: 'The rock' },
    { t: 18, title: 'Flip and brake' },
    { t: 38, title: 'A ship in the dark' },
    { t: 54, title: 'Across' },
    { t: 74, title: 'Backing off' },
    { t: 109, title: 'One torpedo' },
    { t: 122, title: 'The Anubis is gone' },
    { t: 136, title: 'Onward' },
  ],
  notes: [
    'Order and outcome: B and A. The place, the rock, the Anubis\'s pose, all timings and accelerations: invented.',
    'The Anubis is shown bare (the books have her covered in growth; we have no model). Boarding and the recording are interior scenes and are not shown.',
    'Who fires is left unnamed: one source says the ship, a snippet one crewman (grade C). One torpedo with an ordinary blast; the note gives no yield.',
  ],
};
