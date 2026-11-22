// "The Donnager" (Leviathan Wakes): the Martian battleship and her escorts are attacked by stealth ships; the battleship is lost,
// and the Tachi (the corvette that will become the Rocinante) slips away from her hangar. Research: docs/research/canon/leviathan-wakes.md, SP2.
// All lengths are metres, times are seconds of film. The frame is the Donnager's: her nose points +x, and the other ships hold positions
// relative to her (`follow`), so the whole fight drifts together and the camera can work close in.
//
// Choices where the sources disagree or say nothing (the note's recommended reading is used each time):
//  - How many attackers. One aggregator (F, grade C) says six Amun-Ra ships and 24 missiles; a book-aware reviewer says the attackers
//    "never really form a fleet" (grade B). Recommended reading: fewer than the show's fleet. We show FOUR, an invented number, and the
//    Donnager and her escorts get three of them (F: "guns kill three", grade C): one to her railgun, one crippled by point defence,
//    and the last two caught in her scuttling. (F says the last two die with her; kept.)
//  - A boarding fight inside the Donnager is show-only (the note: grade C, unsettled) and is NOT shown. No breaching pods either.
//  - Shed's death and the dying lieutenant are interior scenes and are not shown; the film stays outside the hull.
//  - The railgun: F gives the Donnager a spinal railgun (grade C, looks RPG-derived). Used; the attackers' railguns are used only as a
//    guess from the Amun-Ra entry (grade C). The Tachi carries PDCs only here (the note could not confirm a railgun on the book ship).
//  - Escort count (two, plus the Tachi) is invented; the note gives only "up to 8 hangared" (C).
//  - Time is compressed: the note has no figure for the battle's length. Weapon speeds (PDC rounds 2.8 km/s, railgun slugs 15 km/s),
//    ranges, missile flights and every acceleration are invented. The Tachi's 2.5 g and 3 g burns are invented.
//  - Where it happens: "the Belt region, no coordinates" (note). The pin below is an arbitrary spot in the Belt.
//  - The Donnager's size (475 m) is F's and our `traffic.ts` agrees; her armament counts are not drawn exactly (we show a handful of PDC mounts).
// No book text and no show dialogue or audio is used; captions are written fresh.

import type { Scenario, ScnShot, Vec } from '../scenario';

const Z: Vec = [0, 0, 0];
/** A shot with the boring parts filled in. */
const S = (s: Partial<ScnShot> & Pick<ScnShot, 't0' | 'id' | 'secs'>): ScnShot => ({ from: Z, to: Z, ...s });

// Donnager hull stations, in her own axes (nose is -z; x is her left, y up): tops and sides, metres.
const DONN_PDC: Vec[] = [[-50, 70, -130], [50, 72, -70], [-45, -70, 50], [42, 74, 120], [0, 82, -20], [62, -40, -160], [-60, 30, 170]];

export const DONNAGER: Scenario = {
  id: 'lw-donnager',
  title: 'The Donnager',
  book: 1, bookTitle: 'Leviathan Wakes',
  spoiler: 'A battleship is destroyed, and the ship that will be the Rocinante escapes.',
  sources: ['docs/research/canon/leviathan-wakes.md#sp2'],
  frame: {
    space: 'sol',
    // Somewhere in the Belt, on the Donnager's inbound course. No source gives a place.
    origin: { au: 2.6, angle: 1.3 },
    seed: 21,
  },
  time: { duration: 200, storyMinutes: 40, scale: 'compressed', note: 'Invented: no public source gives the length of the battle.' },
  actors: [
    { id: 'donn', name: 'Donnager', model: 'battleship', len: 475, faction: 'mcrn', confidence: 'A', plume: { burn: 1 }, crew: 2086, note: 'Existence, role and fate A. Length 475 m: F, matches our traffic data. Crew and armament C.' },
    { id: 'esc1', name: 'Escort', model: 'corvette', len: 46, faction: 'mcrn', confidence: 'C', plume: { burn: 1 }, invented: true, note: 'Escort count and fates invented; the note says only that up to eight escorts were hangared.' },
    { id: 'esc2', name: 'Escort', model: 'corvette', len: 46, faction: 'mcrn', confidence: 'C', plume: { burn: 1 }, invented: true },
    { id: 'roci', name: 'Tachi', model: 'corvette', len: 46, faction: 'mcrn', confidence: 'A', plume: { burn: 1.4 }, crew: 5, note: 'The Tachi, a Donnager escort, later the Rocinante. Origin A; our corvette model carries a roof railgun the note could not confirm (unused here).' },
    { id: 'atk1', name: 'Attacker one', model: 'stealth', len: 150, faction: 'protogen', confidence: 'B', stealth: true, invented: true, note: 'Stealth attackers: role B. How many: invented (F says six, a reviewer says no fleet).' },
    { id: 'atk2', name: 'Attacker two', model: 'stealth', len: 150, faction: 'protogen', confidence: 'B', stealth: true, invented: true },
    { id: 'atk3', name: 'Attacker three', model: 'stealth', len: 150, faction: 'protogen', confidence: 'B', stealth: true, invented: true },
    { id: 'atk4', name: 'Attacker four', model: 'stealth', len: 150, faction: 'protogen', confidence: 'B', stealth: true, invented: true },
  ],
  tracks: {
    // Under way along her heading (+x) at a steady push; invented g.
    donn: [
      { t: 0, type: 'hold', at: [0, 0, 0], face: [1, 0, 0] },
      { t: 1, type: 'accel', dir: [1, 0, 0], g: 0.05 },
    ],
    esc1: [{ t: 0, type: 'follow', target: 'donn', offset: [1100, 160, 650], match: true }],
    esc2: [
      { t: 0, type: 'follow', target: 'donn', offset: [-300, -150, -900], match: true },
      { t: 94, type: 'tumble', spin: [0.1, 0.35, 0.05] },
    ],
    // In the hangar (hidden inside the hull), out through the belly, then the run.
    roci: [
      { t: 0, type: 'follow', target: 'donn', offset: [80, -50, 0], match: true },
      { t: 127, type: 'follow', target: 'donn', offset: [95, -120, 0], ease: 2.5, match: true },
      { t: 130, type: 'accel', dir: [0.1, -0.5, -0.85], g: 2.5, turn: 1.2 },
      { t: 140, type: 'coast' },
      { t: 149, type: 'accel', dir: [0.1, -0.5, -0.85], g: 3, turn: 0.3 },
    ],
    atk1: [{ t: 0, type: 'follow', target: 'donn', offset: [-3500, 1800, -4800], aim: 'donn' }],
    atk2: [
      { t: 0, type: 'follow', target: 'donn', offset: [3800, -900, 5200], aim: 'donn' },
      { t: 60, type: 'follow', target: 'donn', offset: [2200, -300, 3000], ease: 25, aim: 'donn' },
      { t: 130, type: 'follow', target: 'donn', offset: [350, 250, 750], ease: 18, aim: 'donn' },
    ],
    atk3: [
      { t: 0, type: 'follow', target: 'donn', offset: [-1500, 700, 6000], aim: 'donn' },
      { t: 50, type: 'follow', target: 'donn', offset: [-500, 150, 1500], ease: 24, aim: 'donn' },
      { t: 78.5, type: 'tumble', spin: [0.06, 0.25, 0.04] },
    ],
    atk4: [
      { t: 0, type: 'follow', target: 'donn', offset: [5200, 1100, -3600], aim: 'donn' },
      { t: 80, type: 'follow', target: 'donn', offset: [2500, 500, -1800], ease: 20, aim: 'donn' },
      { t: 120, type: 'follow', target: 'donn', offset: [-500, 150, -650], ease: 15, aim: 'donn' },
    ],
  },
  events: [
    // -- the first salvo: three missiles, two shot down, one gets through
    { t: 26, type: 'fire', weapon: 'missile', from: 'atk1', to: 'donn', hit: 38, count: 3, id: 'm1', killed: [35.4, 36.6, 0], warhead: 30, invented: true },
    { t: 31, type: 'pdc', from: 'donn', missile: 'm1', dur: 5.5, mounts: DONN_PDC, rate: 60, burst: 0.45, gap: 0.25 },
    { t: 38.1, type: 'breach', target: 'donn', at: [30, 72, -40], dur: 9, size: 16 },
    // -- her answer: two railgun slugs and the first attacker is gone
    { t: 40, type: 'rail', from: 'donn', to: 'atk1', mount: [0, 0, -200], count: 2, gap: 0.55, speed: 15000, size: 36 },
    { t: 41, type: 'hit', target: 'atk1', fx: 'fireball', damage: 'destroy', radius: 130 },
    { t: 41, type: 'debris', from: 'atk1', n: 160, seed: 11, speed: 200, chunks: 22, scale: 0.6 },
    // -- the escorts take a volley
    { t: 46, type: 'fire', weapon: 'missile', from: 'atk2', to: 'esc1', hit: 56, count: 4, id: 'm2', killed: [51.4, 52.2, 0, 0], warhead: 20, invented: true },
    { t: 48.5, type: 'pdc', from: 'esc1', missile: 'm2', dur: 3.5, mounts: [[2, 6, -10], [-2, 6, 6]], rate: 50, spread: 0.01 },
    { t: 56.2, type: 'hit', target: 'esc1', fx: 'fireball', damage: 'destroy', radius: 60 },
    { t: 56.2, type: 'debris', from: 'esc1', n: 90, seed: 12, speed: 130, chunks: 18, scale: 0.25 },
    // -- the attackers' guns find the battleship
    { t: 58, type: 'rail', from: 'atk2', to: 'donn', mount: [0, 0, -60], count: 3, gap: 0.5, speed: 15000, size: 44 },
    { t: 59.3, type: 'blast', target: 'donn', at: [20, 62, -120], size: 45 },
    { t: 59.6, type: 'breach', target: 'donn', at: [-50, 45, 60], dur: 10, size: 18 },
    { t: 62, type: 'fire', weapon: 'missile', from: 'atk3', to: 'donn', hit: 72, count: 2, id: 'm3', killed: [68.5, 0], warhead: 30, invented: true },
    { t: 66, type: 'pdc', from: 'donn', missile: 'm3', dur: 4, mounts: DONN_PDC, rate: 60 },
    // -- the third attacker comes close and is shredded by the battleship's cannons
    { t: 70, type: 'pdc', from: 'donn', at: 'atk3', dur: 8.5, mounts: DONN_PDC, rate: 60, burst: 0.5, gap: 0.2, hitRate: 0.55 },
    { t: 72.1, type: 'blast', target: 'donn', at: [-40, 20, 140], size: 40 },
    { t: 78.5, type: 'breach', target: 'atk3', at: [10, 12, -30], dur: 12, size: 18 },
    { t: 78.6, type: 'blast', target: 'atk3', at: [0, 10, 20], size: 38 },
    { t: 78.6, type: 'impact', target: 'atk3', at: [15, 0, -50], size: 22 },
    // -- another escort is crippled
    { t: 84, type: 'fire', weapon: 'missile', from: 'atk4', to: 'esc2', hit: 94, count: 3, id: 'm4', killed: [91.5, 0, 0], warhead: 18, invented: true },
    { t: 88, type: 'pdc', from: 'esc2', missile: 'm4', dur: 4, mounts: [[2, 6, -10], [-2, 6, 6]], rate: 50, spread: 0.01 },
    { t: 94.1, type: 'breach', target: 'esc2', at: [0, 5, -8], dur: 14, size: 6 },
    { t: 97.5, type: 'blast', target: 'esc2', at: [0, 0, 10], size: 14 },
    // -- the battleship alone, and hammered
    { t: 96, type: 'pdc', from: 'donn', at: 'atk2', dur: 12, mounts: DONN_PDC, rate: 55, hitRate: 0.08, burst: 0.4, gap: 0.45 },
    { t: 104, type: 'rail', from: 'atk2', to: 'donn', mount: [0, 0, -60], count: 2, gap: 0.6, speed: 15000, size: 44 },
    { t: 106, type: 'breach', target: 'donn', at: [58, 10, -140], dur: 12, size: 20 },
    { t: 108, type: 'fire', weapon: 'missile', from: 'atk4', to: 'donn', hit: 119, count: 3, id: 'm5', killed: [114.5, 0, 0], warhead: 34, invented: true },
    { t: 110, type: 'blast', target: 'donn', at: [-10, 76, 30], size: 55 },
    { t: 112, type: 'pdc', from: 'donn', missile: 'm5', dur: 5, mounts: DONN_PDC, rate: 60 },
    { t: 117, type: 'blast', target: 'donn', at: [40, -60, -60], size: 50 },
    { t: 119.2, type: 'breach', target: 'donn', at: [-55, 0, 120], dur: 13, size: 22 },
    { t: 123, type: 'blast', target: 'donn', at: [0, 80, -170], size: 60 },
    // -- the Tachi's run, with a missile after her that her own cannons stop
    { t: 132, type: 'fire', weapon: 'missile', from: 'atk4', to: 'roci', hit: 139, count: 2, id: 'm6', killed: [136.8, 137.6], warhead: 16, invented: true },
    { t: 134, type: 'pdc', from: 'roci', missile: 'm6', dur: 3.2, mounts: [[3, 4, -10], [-3, 4, 2]], rate: 55, spread: 0.01 },
    // -- the scuttling: fire from end to end, then the ship goes, and the last two attackers with her
    { t: 143.5, type: 'blast', target: 'donn', at: [0, 40, -180], size: 70 },
    { t: 144.4, type: 'blast', target: 'donn', at: [30, -30, -100], size: 80 },
    { t: 145.2, type: 'blast', target: 'donn', at: [-20, 50, 0], size: 90 },
    { t: 146, type: 'blast', target: 'donn', at: [0, 0, 90], size: 100 },
    { t: 146.8, type: 'blast', target: 'donn', at: [20, 30, 170], size: 90 },
    { t: 148.2, type: 'hit', target: 'donn', fx: 'fireball', damage: 'destroy', radius: 650 },
    { t: 148.2, type: 'debris', from: 'donn', n: 400, seed: 13, speed: 250, chunks: 110, scale: 3 },
    { t: 148.5, type: 'hit', target: 'atk2', fx: 'fireball', damage: 'destroy', radius: 120 },
    { t: 148.5, type: 'debris', from: 'atk2', n: 80, seed: 14, speed: 220, chunks: 14, scale: 0.6 },
    { t: 148.7, type: 'hit', target: 'atk4', fx: 'fireball', damage: 'destroy', radius: 120 },
    { t: 148.7, type: 'debris', from: 'atk4', n: 80, seed: 15, speed: 220, chunks: 14, scale: 0.6 },
    { t: 148.2, type: 'silence', dur: 11 },
  ],
  shots: [
    S({ t0: 0, id: 'donn', from: [1.5, 0.9, 0.2], to: [1.25, 1.3, 0.12], secs: 16, fov: 38 }),
    S({ t0: 16, id: 'esc1', mode: 'chase', back: 170, up: 40, secs: 12, fov: 42 }),
    // Inside the battleship: her own guns, and what strikes her, come through the hull.
    S({ t0: 28, id: 'donn', mode: 'pov', offset: [0, 88, -110], look: 'atk1', secs: 14, fov: 28 }),
    S({ t0: 42, id: 'donn', mode: 'static', at: [-1500, 600, -1400], secs: 8, fov: 28 }),
    S({ t0: 50, id: 'esc1', mode: 'static', at: [300, 120, -300], secs: 12, fov: 30 }),
    S({ t0: 62, id: 'donn', from: [1.8, -1.0, 0.3], to: [1.4, -1.5, 0.4], secs: 8, fov: 34 }),
    S({ t0: 70, id: 'atk3', mode: 'static', at: [-200, 500, 900], secs: 14, fov: 30 }),
    S({ t0: 84, id: 'esc2', mode: 'pov', offset: [0, 5, -14], look: 'atk4', secs: 12, fov: 34 }),
    S({ t0: 96, id: 'donn', from: [1.4, 2.2, 0.25], to: [1.1, 2.8, 0.3], secs: 16, fov: 36 }),
    S({ t0: 112, id: 'donn', mode: 'static', at: [900, -300, -700], secs: 14, fov: 30 }),
    S({ t0: 126, id: 'roci', mode: 'chase', back: 90, up: 25, secs: 6, fov: 44 }),
    S({ t0: 132, id: 'roci', mode: 'pov', offset: [0, 15, -30], look: 'donn', secs: 18.5, fov: 40 }),
    S({ t0: 150.5, id: 'donn', mode: 'static', at: [-1500, -950, -2100], secs: 7.5, fov: 30, hear: 'exterior' }),
    S({ t0: 158, id: 'roci', mode: 'chase', back: 140, up: 20, secs: 22, fov: 40 }),
    S({ t0: 180, id: 'roci', from: [10, 0.8, 0.2], to: [16, 1.6, 0.3], secs: 20, fov: 34 }),
  ],
  captions: [
    { t: 1, dur: 12, title: 'The Donnager', text: 'A Martian battleship, close to half a kilometre long, with escorts around her and the Canterbury\'s survivors aboard.' },
    { t: 24, dur: 10, title: 'No warning', text: 'The attackers are stealth ships: cold and dark, with no drive to give them away. The first sign is a salvo already on its way.' },
    { t: 32, dur: 7, title: 'Point defence', text: 'Cannons along the hull throw walls of fire at the missiles. Most are stopped. One is not.' },
    { t: 40, dur: 8, title: 'The railgun', text: 'The battleship answers with her main gun. A slug crosses the gap in a fraction of a second.' },
    { t: 51, dur: 9, title: 'The escorts', text: 'The smaller ships take the next volleys, and go one by one.' },
    { t: 63, dur: 9, title: 'Closing in', text: 'Hit after hit. Fire and air stream from the hull while the crew fight from sealed sections.' },
    { t: 98, dur: 12, title: 'Alone', text: 'The Donnager cannot win this fight. Everything that can still be done is to buy time.' },
    { t: 120, dur: 10, title: 'The Tachi', text: 'One of her escort corvettes slips out of the hangar bay, with Holden\'s crew aboard.' },
    { t: 140, dur: 9, title: 'Scuttled', text: 'Her captain chooses to destroy her. The nearest attackers go with her. Space carries no sound, so there is none.' },
    { t: 160, dur: 12, title: 'Away', text: 'The Tachi runs. She will not keep that name for long.' },
  ],
  chapters: ['The Donnager and the Tachi'],
  notes: [
    'Attackers shown: four (invented). The note\'s two readings: six ships and 24 missiles (F, grade C) against "never a fleet" (reviewer, grade B). We take the smaller number.',
    'No boarding fight, no breaching pods, no interior scenes: the boarding is show-only (unsettled) and the film stays outside the hull.',
    'All weapon speeds, ranges, timings and accelerations are invented. The Donnager\'s guns are drawn as a handful of PDC mounts and one railgun, not her listed 44 cannons.',
  ],
};
