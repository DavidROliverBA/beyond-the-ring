// "The run to Eros" (Leviathan Wakes): the Rocinante flies from Tycho Station to Eros and arrives at the asteroid's station. Research:
// docs/research/canon/leviathan-wakes.md, SP4 (documentation grade B for the order, C for geography; the exterior only: the interior scenes,
// Polanski's room, Julie's body, the alarms and the escape, are deferred to E3.4.c and are NOT shown). All lengths are metres, times are
// seconds of film. The frame is a pinned place near Eros; its sky and Sun are the real ones for that distance from the Sun.
//
// What the note says, and what is invented (nothing below is canon unless marked):
//  - Order (B): Fred Johnson sends them to Eros; the Rocinante makes the trip; they dock at Eros station. That is all this film shows. The note gives
//    no route, date, acceleration or duration, and it could not confirm where the books put Eros (some sources say the Belt, it says so itself).
//  - The place: the real asteroid 433 Eros in our own data is at 1.458 AU, and Tycho at 2.95 AU. We use both as they stand in src/data.ts, so
//    the gap (computed below, about 2.3 AU) is the real distance between those two pinned places. If the books put Eros elsewhere, this is wrong.
//    The frame is lifted off the plane, so the real Eros of the Sol scene is not in shot.
//  - The flight time is honest physics on invented inputs: 0.3 g (the note's "about 0.3 g" is an unverified assumption, R) and a ten-minute
//    turn-over. `transit()` turns those into days and a peak speed; the captions print them. INVENTED: the 0.3 g, the turn-over.
//  - Compression: the long leg is drawn as 400 km in 72 s with the same shape (burn, flip, brake), worked out by `accelFor`. That film leg is NOT
//    physical and is said so. The last 4 km is drawn at the real 0.3 g and takes its real time.
//  - The rock: our procedural Eros (src/eros.ts), the real 34.4 km length and the real proportions, not the NEAR Shoemaker shape model. Its
//    craters are seeded, not the real ones; the biggest stands for the real crater Psyche. It does not spin here (the real day is about 5 hours).
//  - FICTIONAL DRESSING on the real shape ('eros-station' model, src/ships.ts): the story's Eros station is a hollowed-out asteroid with lit works
//    on its surface and a spaceport. No source gives a layout, so the domes, the pads with their glow, the towers and the docking spar are all
//    ours. The docking cradle (a lit disc at the end of a 1.8 km spar) is about 250 m across, a size chosen to read from far away.
//  - Where the Rocinante docks (the spar's cradle), the approach direction, and the holds are invented. Nobody is shown and there is no dialogue.
//    Miller reaches Eros by another ship (the note); that is not drawn.
// No book text and no show dialogue or audio is used; captions are written fresh.

import type { Scenario, ScnShot, Vec } from '../scenario';
import { AU, DAY, G0, accelFor, transit } from '../transit';
import { sparAxis, sparDock } from '../eros';

const Z: Vec = [0, 0, 0];
const S = (s: Partial<ScnShot> & Pick<ScnShot, 't0' | 'id' | 'secs'>): ScnShot => ({ from: Z, to: Z, ...s });

export const EROS_LEN = 34400;                          // real long axis, metres

// ---- the honest flight (invented inputs, real maths)
const FROM = { au: 2.95, angle: 0.25 };                 // Tycho in src/data.ts
const TO = { au: 1.458, angle: 1.1 };                   // Eros in src/data.ts
export const EROS_GAP_AU = Math.hypot(FROM.au * Math.cos(FROM.angle) - TO.au * Math.cos(TO.angle), FROM.au * Math.sin(FROM.angle) - TO.au * Math.sin(TO.angle));
const REAL_G = 0.3, REAL_FLIP = 600;
export const EROS_FLIGHT = transit(EROS_GAP_AU * AU, REAL_G * G0, REAL_FLIP);
const days = (EROS_FLIGHT.time / DAY).toFixed(1);
const peak = Math.round(EROS_FLIGHT.peakSpeed / 1000);

// ---- the film legs (the rock at the middle, long axis along z; the docking cradle from the model)
const sc3 = (v: { x: number; y: number; z: number }, k: number): Vec => [v.x * k, v.y * k, v.z * k];
const nrm = sparAxis(), RING = sparDock();
export const DOCK: Vec = sc3(RING, EROS_LEN);            // centre of the docking cradle
const OUT: Vec = [nrm.x, nrm.y, nrm.z];                  // out along the spar
const add = (a: Vec, b: Vec, k: number): Vec => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dir = (a: Vec): Vec => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
const IN = dir([OUT[0] + 0.55, OUT[1] + 0.25, OUT[2] - 0.7]);   // the way she comes in from, a little off the spar's line
const FAR = add(DOCK, IN, 400000);
const MID = add(DOCK, OUT, 4000);                       // 4 km out along the spar
const BERTH = add(DOCK, OUT, 55);                       // hovering just above the cradle's middle
const FILM_T = 72, FILM_FLIP = 7;
const FILM_G = accelFor(Math.hypot(FAR[0] - MID[0], FAR[1] - MID[1], FAR[2] - MID[2]), FILM_T, FILM_FLIP) / G0;
const T2 = FILM_T + 4;                                  // the approach starts after a short hold
const APPROACH = transit(Math.hypot(MID[0] - BERTH[0], MID[1] - BERTH[1], MID[2] - BERTH[2]), REAL_G * G0, 8);
const T_END = T2 + APPROACH.time;                       // she is at the dock
const DURATION = Math.ceil(T_END + 26);

export const EROS: Scenario = {
  id: 'lw-eros',
  title: 'The run to Eros',
  book: 1, bookTitle: 'Leviathan Wakes',
  spoiler: 'Spoils the middle of Leviathan Wakes: the crew go to Eros Station on Fred Johnson\'s errand. Nothing that happens on the station is shown.',
  sources: ['docs/research/canon/leviathan-wakes.md#sp4'],
  frame: {
    space: 'sol',
    // Eros's own place in our data, lifted off the plane so the sim's real Eros is out of shot.
    origin: { au: TO.au, angle: TO.angle, lift: 30 },
    seed: 44,
  },
  time: { duration: DURATION, storyMinutes: Math.round(EROS_FLIGHT.time / 60), scale: 'compressed',
    note: `Invented: the 0.3 g push and the ${REAL_FLIP / 60}-minute turn-over. About ${days} days of flight in ${FILM_T} seconds; the last 4 km at true speed.` },
  actors: [
    { id: 'eros', name: 'Eros', model: 'eros-station', len: EROS_LEN, confidence: 'B', invented: true,
      note: 'The real asteroid 433 Eros: its length and proportions are real (JPL), the surface is our own procedural rock. The station on it is FICTIONAL DRESSING: no source gives its look.' },
    { id: 'roci', name: 'Rocinante', model: 'corvette', len: 46, faction: 'opa', confidence: 'A', plume: { burn: 1.4 }, crew: 4,
      note: 'The ship. Her flight to Eros: B. All numbers invented.' },
  ],
  tracks: {
    eros: [{ t: 0, type: 'hold', at: Z }],
    // The compressed leg, then the honest one. Both are flip-and-burn: the whole ship turns end for end in the middle of each.
    roci: [
      { t: 0, type: 'burn', from: FAR, to: MID, g: FILM_G, flip: FILM_FLIP },
      { t: T2, type: 'burn', from: MID, to: BERTH, g: REAL_G, flip: 8 },
    ],
  },
  events: [
    { t: 12, type: 'silence', dur: 6 },
  ],
  shots: [
    S({ t0: 0, id: 'roci', mode: 'chase', back: 120, up: 25, secs: 16, fov: 40 }),
    S({ t0: 16, id: 'roci', from: [6, 0.9, 0.25], to: [10, 1.6, 0.3], secs: 20, fov: 36 }),
    // The flip, seen from the side, then the rock coming up.
    S({ t0: 36, id: 'roci', from: [14, -1.0, 0.2], to: [8, -1.5, 0.1], secs: 18, fov: 34 }),
    S({ t0: 54, id: 'eros', mode: 'static', at: [-70000, 36000, -105000], secs: 22, fov: 30 }),
    // Close in at true speed: the last 4 km.
    S({ t0: T2, id: 'roci', mode: 'chase', back: 150, up: 30, secs: 18, fov: 40 }),
    S({ t0: T2 + 18, id: 'eros', from: [1.5, 0.45, 0.3], to: [1.15, 0.5, 0.35], secs: 22, fov: 34 }),
    S({ t0: T2 + 40, id: 'roci', mode: 'static', at: add(add(DOCK, OUT, 250), [1, 0, 0.3], 520), secs: T_END - T2 - 40, fov: 22 }),
    // At the ring, then the whole station from a distance.
    S({ t0: T_END, id: 'roci', mode: 'static', at: add(add(DOCK, OUT, 90), [0, 0, 1], 260), secs: 12, fov: 30 }),
    S({ t0: T_END + 12, id: 'eros', from: [1.6, 0.5, 0.25], to: [2.2, 0.8, 0.3], secs: DURATION - T_END - 12, fov: 34 }),
  ],
  captions: [
    { t: 1, dur: 11, title: 'To Eros', text: `Fred Johnson's errand takes the Rocinante from Tycho towards the asteroid Eros. Real time for this trip: about ${days} days.` },
    { t: 20, dur: 12, title: 'Honest numbers', text: `At a gentle 0.3 g, push for half the way, turn over, brake. Peak speed about ${peak} km/s. Here it is squeezed into seconds, so this leg is far faster than anything real.` },
    { t: 39, dur: 10, title: 'Flip', text: 'Engine off while she turns end for end. In the real flight this would last minutes.' },
    { t: 56, dur: 18, title: 'Eros', text: 'The real asteroid is about 34 km long and 11 km across, a long lumpy peanut. The shape here is built to those sizes, not copied from the spacecraft survey.' },
    { t: T2 + 2, dur: 14, title: 'True speed', text: `The last 4 km are drawn at the real 0.3 g and take their real time, about ${Math.round(APPROACH.time)} seconds.` },
    { t: T2 + 20, dur: 18, title: 'The station', text: 'In the story the asteroid is a hollowed-out station with a spaceport. Everything lit on its skin is our invention; no source says what it looked like.' },
    { t: T_END + 1, dur: 11, title: 'Docked', text: 'The Rocinante is at the dock. What happens inside the station is not shown here.' },
    { t: T_END + 13, dur: 12, title: 'A quiet rock', text: 'A hollowed-out rock, and a long way from anyone.' },
  ],
  chapters: [
    { t: 0, title: 'The Rocinante sets out' },
    { t: 36, title: 'Flip' },
    { t: 54, title: 'Eros comes into view' },
    { t: T2, title: 'The last four kilometres' },
    { t: T_END, title: 'At the dock' },
  ],
  notes: [
    `Flight: ${EROS_GAP_AU.toFixed(2)} AU between Tycho and Eros as our data places them, 0.3 g, ${REAL_FLIP / 60}-minute flip: ${days} days, peak ${peak} km/s. The 0.3 g, the flip and the places are assumptions (the note: where the books put Eros is unconfirmed); the maths is transit().`,
    `The long leg is drawn as 400 km in ${FILM_T} s (${Math.round(FILM_G)} g in the film). Not physical. Only the last 4 km runs at real speed and acceleration.`,
    'Eros: real length and proportions, procedural surface (src/eros.ts); no spin. The station is fictional dressing (spaceport pads, domes, towers, the docking spar).',
    'Interiors (the hotel room, the body, the alarms, the escape) are not shown. Miller arrives by another ship, not drawn.',
  ],
};
