// "The run to Tycho" (Leviathan Wakes): the Tachi, the Martian corvette Holden's crew escaped in, flies to Fred Johnson's yard at Tycho
// Station, and is renamed the Rocinante there. Research: docs/research/canon/leviathan-wakes.md, SP3 (documentation grade B: the order is
// certain, there are no numbers). All lengths are metres, times are seconds of film. The frame is Tycho's: the station sits at the middle.
//
// What the note says, and what is invented (nothing below is canon unless marked):
//  - Order (B): they go to Tycho; the Tachi becomes the Rocinante; Fred Johnson meets them and sets the Polanski / Eros errand.
//    That is all the film shows. The note gives no route, no date, no acceleration and no duration.
//  - The flight time is honest physics on invented inputs. Where she starts is the spot the Donnager film is pinned to (2.6 AU, angle 1.3);
//    Tycho is where our own data has it (2.95 AU, angle 0.25). The gap between them (computed below) and the 0.3 g push are ours: the note
//    only suggests "about 0.3 g, a few days" as an assumption (R, unverified). `transit()` turns that into days and a peak speed; the
//    captions print those numbers. INVENTED: distance, 0.3 g, the length of the turn-over (10 minutes).
//  - Compression: nine days cannot be watched. The long leg is drawn as 150 km in 70 s with the same shape (burn, flip, brake), its
//    acceleration worked out by `accelFor`. That film leg is NOT physical and is said so in the captions. The last 3 km, the approach,
//    is drawn at the real 0.3 g and takes its real time (about a minute).
//  - Where she docks, and the bays: our Tycho model has ten equatorial bays; the choice of one is ours. Nobody is shown; no dialogue.
//  - The rename: the note says the naming is "covered in many sources, date unknown". We swap the hull name during a cut inside the stay,
//    `invented: true` for the moment. Kelly (the Martian lieutenant) dies in the Donnager sequence and is not mentioned.
//  - The stop is a short hold with a slow camera; Fred Johnson is named in a caption only (the note: he meets them, grade B).
//  - Eros: NOT built in this film (see the backlog: no Eros station model, and the Sol scene's Eros is a rock in a far orbit). The last
//    caption only points at the next errand. Phoebe (SP5) is backstory in the book and is not shown.
// No book text and no show dialogue or audio is used; captions are written fresh.

import type { Scenario, ScnShot, Vec } from '../scenario';
import { AU, DAY, G0, accelFor, transit } from '../transit';

const Z: Vec = [0, 0, 0];
const S = (s: Partial<ScnShot> & Pick<ScnShot, 't0' | 'id' | 'secs'>): ScnShot => ({ from: Z, to: Z, ...s });

// ---- the honest flight (invented inputs, real maths)
const FROM = { au: 2.6, angle: 1.3 };   // the Donnager film's pin
const TO = { au: 2.95, angle: 0.25 };   // Tycho in src/data.ts
const REAL_AU = Math.hypot(FROM.au * Math.cos(FROM.angle) - TO.au * Math.cos(TO.angle), FROM.au * Math.sin(FROM.angle) - TO.au * Math.sin(TO.angle));
const REAL_G = 0.3, REAL_FLIP = 600;
export const TYCHO_FLIGHT = transit(REAL_AU * AU, REAL_G * G0, REAL_FLIP);
const days = (TYCHO_FLIGHT.time / DAY).toFixed(1);
const peak = Math.round(TYCHO_FLIGHT.peakSpeed / 1000);

// ---- the film legs (metres, in Tycho's frame; the station is at the middle, its equator the x-z plane, bay mouth at +x)
const dir = (a: Vec): Vec => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const A = dir([1, 0.28, -0.55]);                                     // the way she comes in from, near the bay's side
const at = (m: number): Vec => [A[0] * m, A[1] * m, A[2] * m];
const BAY: Vec = [575, 0, 0];
const MID: Vec = [3575, 0, 0];                                       // 3 km straight out from the bay mouth
const FAR = at(150000);
const FILM_T = 74, FILM_FLIP = 7;
const FILM_G = accelFor(Math.hypot(FAR[0] - MID[0], FAR[1] - MID[1], FAR[2] - MID[2]), FILM_T, FILM_FLIP) / G0;
const T2 = FILM_T + 4;                                               // the approach starts after a short hold
const APPROACH = transit(3000, REAL_G * G0, 8);                      // honest, at the same 0.3 g
const T_END = T2 + APPROACH.time;                                    // she is on her berth
const SWAP = 150;                                                    // the cut during which the hull is repainted and renamed

export const TYCHO: Scenario = {
  id: 'lw-tycho',
  title: 'The run to Tycho',
  book: 1, bookTitle: 'Leviathan Wakes',
  spoiler: 'The ship that will be the Rocinante gets her name, and a new errand.',
  sources: ['docs/research/canon/leviathan-wakes.md#sp3'],
  frame: {
    space: 'sol',
    origin: { au: TO.au, angle: TO.angle, lift: 30 },
    seed: 33,
  },
  time: { duration: 205, storyMinutes: Math.round(TYCHO_FLIGHT.time / 60), scale: 'compressed',
    note: `Invented: the distance, the 0.3 g push and the ${REAL_FLIP / 60}-minute turn-over. About ${days} days of flight in 70 seconds; the last 3 km at true speed.` },
  actors: [
    { id: 'tycho', name: 'Tycho Station', model: 'tycho', len: 500, faction: 'opa', confidence: 'B', note: 'Role B. Size: our own data (sphere 1 km, rings about 1.7 km); the glb is built at twice this length number.' },
    { id: 'tachi', name: 'Tachi', model: 'corvette', len: 46, faction: 'mcrn', confidence: 'A', plume: { burn: 1.4 }, crew: 4, life: [0, SWAP],
      note: 'The corvette that escaped the Donnager. Four aboard (Kelly died). Length 46 m (RPG sheet). The roof railgun of our model is unconfirmed for the book ship.' },
    { id: 'roci', name: 'Rocinante', model: 'corvette', len: 46, faction: 'opa', confidence: 'A', plume: { burn: 1.4 }, crew: 4, life: [SWAP, 205], invented: true,
      note: 'Same hull, new name. When the rename happens is unknown (note); the swap is staged during a cut.' },
  ],
  tracks: {
    tycho: [{ t: 0, type: 'hold', at: [0, 0, 0], face: [0, 0, -1] }],
    // The compressed leg, then the honest one. Both are flip-and-burn: the whole ship turns end for end in the middle of each.
    tachi: [
      { t: 0, type: 'burn', from: FAR, to: MID, g: FILM_G, flip: FILM_FLIP },
      { t: T2, type: 'burn', from: MID, to: BAY, g: REAL_G, flip: 8 },
    ],
    roci: [{ t: 0, type: 'hold', at: BAY, face: [1, 0, 0] }],
  },
  events: [
    { t: 12, type: 'silence', dur: 6 },
  ],
  shots: [
    S({ t0: 0, id: 'tachi', mode: 'chase', back: 120, up: 25, secs: 16, fov: 40 }),
    S({ t0: 16, id: 'tachi', from: [6, 0.9, 0.25], to: [10, 1.6, 0.3], secs: 20, fov: 36 }),
    // The flip, seen from the side, then Tycho coming up.
    S({ t0: 36, id: 'tachi', from: [14, -1.0, 0.2], to: [8, -1.5, 0.1], secs: 20, fov: 34 }),
    S({ t0: 56, id: 'tycho', mode: 'static', at: [-9000, 2200, -14000], secs: 22, fov: 22 }),
    // Close in at true speed: the last 3 km.
    S({ t0: T2, id: 'tachi', mode: 'chase', back: 150, up: 30, secs: 16, fov: 40 }),
    S({ t0: T2 + 16, id: 'tycho', mode: 'static', at: [2400, 900, -1400], secs: 16, fov: 30 }),
    S({ t0: T2 + 32, id: 'tachi', mode: 'static', at: [1500, 90, -700], secs: T_END - T2 - 32, fov: 18 }),
    // On the berth, from outside the habitat rings and level with the gap between them. The cut at SWAP hides the new name.
    S({ t0: T_END, id: 'tachi', mode: 'static', at: [1100, 40, -380], secs: SWAP - T_END, fov: 22 }),
    S({ t0: SWAP, id: 'roci', mode: 'static', at: [760, 70, -150], secs: 22, fov: 30 }),
    S({ t0: SWAP + 22, id: 'tycho', from: [6, 0.6, 0.25], to: [10, 1.1, 0.3], secs: 33, fov: 36 }),
  ],
  captions: [
    { t: 1, dur: 11, title: 'The Tachi', text: `A stolen Martian corvette, four aboard, heading for the one place that might hide them: Tycho. Real time for this trip: about ${days} days.` },
    { t: 20, dur: 12, title: 'Honest numbers', text: `At a gentle 0.3 g, push for half the way, turn over, brake. Peak speed about ${peak} km/s. Here it is squeezed into seconds, so this leg is faster than anything real.` },
    { t: 40, dur: 10, title: 'Flip', text: 'Engine off while she turns end for end. In the real flight this would last minutes.' },
    { t: 58, dur: 14, title: 'Tycho Station', text: 'A mobile shipyard: a kilometre-wide sphere with two spinning habitat rings. Fred Johnson of the OPA runs it.' },
    { t: T2 + 2, dur: 12, title: 'True speed', text: `The last 3 km are drawn at the real 0.3 g and take their real time, about ${Math.round(APPROACH.time)} seconds.` },
    { t: T2 + 20, dur: 12, title: 'Into the bay', text: 'A crew of survivors, a warship they had no right to, and a station that asks few questions.' },
    { t: SWAP - 8, dur: 8, title: 'A new name', text: 'Here the Tachi stops being a Martian ship.' },
    { t: SWAP + 2, dur: 14, title: 'Rocinante', text: 'The corvette gets her new name. The books say it was settled at Tycho; how and when is left unshown.' },
    { t: SWAP + 24, dur: 14, title: 'An errand', text: 'Johnson has a favour to ask: find a man on Eros who may know who attacked them.' },
    { t: SWAP + 40, dur: 14, title: 'Next: Eros', text: 'That trip is not in this film.' },
  ],
  chapters: [
    { t: 0, title: 'The corvette sets out' },
    { t: 20, title: 'Flip' },
    { t: 56, title: 'Tycho comes into view' },
    { t: T2, title: 'Into the bay' },
    { t: SWAP - 8, title: 'A new name' },
    { t: SWAP + 24, title: 'An errand' },
  ],
  notes: [
    `Flight: ${REAL_AU.toFixed(2)} AU between the two pinned places, 0.3 g, ${REAL_FLIP / 60}-minute flip: ${days} days, peak ${peak} km/s. All four inputs invented; the maths is transit().`,
    `The long leg is drawn as 150 km in ${FILM_T} s (${Math.round(FILM_G)} g in the film). Not physical. Only the last 3 km runs at real speed and acceleration.`,
    'No Eros leg: no Eros station model exists, so SP4 is deferred (E3.3.c second half). Phoebe is backstory and is not shown.',
    'The bay chosen and the moment of the rename are ours. No dialogue, no interiors.',
  ],
};
