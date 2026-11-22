// "The Canterbury" (Leviathan Wakes): the ice hauler is destroyed while the shuttle Knight is away, and the shuttle survives.
// Research: docs/research/canon/leviathan-wakes.md, SP1. All lengths are metres, times are seconds of film.
//
// Choices where the sources disagree or say nothing (the note's recommended reading is used):
//  - Debris from the blast also finishing the Scopuli (a wiki digest says so, grade C): NOT shown. The Scopuli drifts on.
//  - Canterbury length 500 m comes from our own data, not a source. Knight and Scopuli sizes are unknown: stand-ins.
//  - One stealth ship (Anubis) fires, with two torpedoes. The note grades order and ships B; missile counts, ranges, timings: invented.
//  - Time is compressed. No source gives any duration. The whole thing is meant to read as a few hours squeezed into three minutes.
//  - All accelerations are invented: hauler 0.25 g, shuttle 1 g then 2.5 g to escape (no source gives any).
// No book text is used; captions are written fresh.

import type { Scenario } from '../scenario';

export const CANTERBURY: Scenario = {
  id: 'lw-canterbury',
  title: 'The Canterbury',
  book: 1, bookTitle: 'Leviathan Wakes',
  spoiler: 'A ship is destroyed, and the survivors learn what kind of trouble they are in.',
  sources: ['docs/research/canon/leviathan-wakes.md#sp1'],
  frame: {
    space: 'sol',
    // The lane from Saturn's rings to Ceres, well outside the Belt. No source gives a place; the angle sits between the two worlds' own.
    origin: { au: 6.1, angle: 2.9 },
    seed: 7,
  },
  time: { duration: 190, storyMinutes: 180, scale: 'compressed', note: 'Invented: no public source gives the length of the encounter.' },
  actors: [
    { id: 'cant', name: 'Canterbury', model: 'hauler', len: 500, faction: 'civil', confidence: 'B', plume: { burn: 1.6 }, note: 'Role and fate A. Length 500 m is the engine\'s, unchecked.' },
    { id: 'scopuli', name: 'Scopuli', model: 'freighter', len: 100, faction: 'unknown', confidence: 'B', standin: true, note: 'Size unknown; our freighter stands in.' },
    { id: 'knight', name: 'Knight', model: 'racer', len: 25, faction: 'civil', confidence: 'C', standin: true, plume: { burn: 1.2 }, life: [64, 190], crew: 5, note: 'Name from one aggregator only. Racer model stands in for a shuttle.' },
    { id: 'anubis', name: 'Anubis', model: 'stealth', len: 150, faction: 'protogen', confidence: 'B', stealth: true, note: 'Which ship did it: A. Armament: C (looks RPG-derived).' },
  ],
  tracks: {
    // Flip and burn: she comes in from 2.4 km and stops. Invented distance and g.
    cant: [{ t: 0, type: 'burn', from: [-2400, 0, 0], to: [0, 0, 0], g: 0.25, flip: 9 }],
    // A dark, silent hull, turning slowly.
    scopuli: [{ t: 0, type: 'coast', from: [1700, 60, -150], vel: [0, 0, 0], face: [0.3, 0, -1], spin: [0.004, 0.02, 0.003] }],
    knight: [
      // Out of the hauler's side to the Scopuli, hold there while the crew looks round, then back.
      { t: 64, type: 'burn', from: [0, -75, 0], to: [1650, -10, -130], g: 1, flip: 3 },
      { t: 92, type: 'hold', face: 'here' },
      { t: 130, type: 'burn', from: 'here', to: [90, -190, 60], g: 1, flip: 3 },
      // The torpedoes hit while she is on the way back. She turns and runs from the blast.
      { t: 140, type: 'accel', dir: [1, 0.12, 0.05], g: 2.5, turn: 0.9 },
    ],
    anubis: [{ t: 0, type: 'hold', at: [-4800, 700, 2300], face: [4800, -700, -2300] }],
  },
  events: [
    { t: 127, type: 'fire', weapon: 'torpedo', from: 'anubis', to: 'cant', hit: 140, count: 2, invented: true },
    { t: 140, type: 'hit', target: 'cant', fx: 'nuke', damage: 'destroy', radius: 450 },
    { t: 140, type: 'debris', from: 'cant', n: 360, seed: 3, speed: 230 },
    { t: 140, type: 'silence', dur: 10 },
    { t: 98, type: 'hail', from: 'knight', to: 'cant', caption: 'The Scopuli is empty.' },
  ],
  shots: [
    { t0: 0, id: 'cant', from: [2.8, 1.2, 0.05], to: [2.2, 0.8, 0.08], secs: 24, fov: 40 },
    { t0: 24, id: 'cant', from: [3.4, -1.0, 0.35], to: [2.5, -1.6, 0.1], secs: 18, fov: 36 },
    { t0: 42, id: 'cant', mode: 'static', at: [2600, -300, 1200], from: [0, 0, 0], to: [0, 0, 0], secs: 22, fov: 22 },
    { t0: 64, id: 'knight', mode: 'chase', back: 70, up: 14, from: [0, 0, 0], to: [0, 0, 0], secs: 26, fov: 50 },
    { t0: 90, id: 'scopuli', from: [2.8, 0.9, 0.2], to: [2.2, 1.6, 0.1], secs: 22, fov: 38 },
    { t0: 112, id: 'knight', mode: 'pov', look: 'cant', offset: [0, 3, -9], from: [0, 0, 0], to: [0, 0, 0], secs: 15, fov: 28 },
    { t0: 127, id: 'anubis', mode: 'static', at: [-4330, 840, 2120], from: [0, 0, 0], to: [0, 0, 0], secs: 5, fov: 36 },
    { t0: 132, id: 'cant', mode: 'static', at: [-1300, 420, 900], from: [0, 0, 0], to: [0, 0, 0], secs: 8, fov: 30 },
    { t0: 140, id: 'cant', mode: 'static', at: [6200, 700, 1400], from: [0, 0, 0], to: [0, 0, 0], secs: 14, fov: 20 },
    { t0: 154, id: 'knight', mode: 'chase', back: 110, up: 18, from: [0, 0, 0], to: [0, 0, 0], secs: 22, fov: 36 },
    { t0: 176, id: 'knight', from: [14, 0.8, 0.1], to: [20, 1.7, 0.25], secs: 14, fov: 38 },
  ],
  captions: [
    { t: 1, dur: 9, title: 'The Canterbury', text: 'An ice hauler out of Saturn\'s rings, bound for Ceres, braking to answer a call for help.' },
    { t: 26, dur: 9, title: 'Flip and burn', text: 'Half the trip she pushes, half she brakes. In between, the whole ship has to turn round.' },
    { t: 65, dur: 10, title: 'The Knight', text: 'A shuttle with five aboard crosses to the silent ship that sent the call.' },
    { t: 100, dur: 10, title: 'Nobody home', text: 'The Scopuli is empty. The one odd thing aboard is a beacon, and it carries Martian markings.' },
    { t: 128, dur: 9, title: 'A shadow behind them', text: 'A ship with no lights and a cold drive has been watching. Its missiles are already running.' },
    { t: 142, dur: 10, title: 'Gone', text: 'The Canterbury is vaporised. Space carries no sound, so there is none here.' },
    { t: 160, dur: 11, title: 'The Knight', text: 'The shuttle burns away from the wreckage. Who did this will be the question from now on.' },
  ],
  chapters: [
    { t: 0, title: 'An ice hauler on the way' },
    { t: 26, title: 'Flip and burn' },
    { t: 64, title: 'The Knight crosses over' },
    { t: 90, title: 'The empty Scopuli' },
    { t: 127, title: 'A shadow behind them' },
    { t: 140, title: 'The Canterbury is gone' },
    { t: 154, title: 'The shuttle burns away' },
  ],
  notes: [
    'Order of events: B (Wikipedia, aggregator, study guide agree). Positions, weapons, timings, accelerations: invented.',
    'The Anubis is shown with two torpedoes and no breaching pods; the research note gives armament only at grade C.',
  ],
};
