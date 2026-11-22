# Leviathan Wakes (book 1): set pieces for the Rocinante scenarios

Read `README.md` first for the source tags (W, F, SS/GS, B&N/AL, RPG, R) and the A/B/C grades. All spoilers. **No chapter pointers** (not obtainable; see README). Everything is in my own words. Engine facts are tagged E.

## 1. Facts that every set piece shares

### In-story time
No public source gives dates or durations for the book's events. The only number found is that Julie Mao was locked in a locker "over a week" in the opening (GS, grade C). Treat all in-story times as **unknown (?)**. The scenarios will need invented-but-plausible durations, and each must be marked "invented" in the file.

### The ships (as given by public sources)

| Ship | Class / role | Length | Armament, drive | Source and grade |
|---|---|---|---|---|
| **Canterbury** | Ice hauler of the Pur'n'Kleen Water Company; Saturn rings to Ceres run | 500 m in `src/data.ts` (E); no public source found to check it | Not given. Tow-ship; carried ice for Ceres' water (B&N says the show ties this to Ceres' shortage [show]) | Role: W, F, GS = A. Length: ? |
| **Scopuli** | Small freight vessel with Mars registry, bait ship; used by OPA-linked crew including Julie Mao | ? (our `freighter`, 100 m, is a stand-in) | Beacon found aboard has Martian navy markings (W, B) | B |
| **Knight** | Shuttle that carries Holden's five to the Scopuli and survives the Canterbury's loss | ? | Not given. F says debris from the explosion nearly destroyed it | Name: F only (C). Role: W (shuttle) |
| **Anubis** | Amun-Ra-class stealth frigate (Protogen/Mao-Kwikowski); destroys Scopuli and Canterbury | not given in F; fan sites give about 150 m (our `stealth` is 150 m, E) | F: internal spine railgun (S-24), four retractable PDCs, two missile bays, fifteen breaching pods, nuclear missiles; crew about 50 (100 for boarding). Drive must be off for stealth to work | F (C: figures look RPG/wiki-derived). Event role A |
| **Other Amun-Ra ships** | F: six attack the Donnager; **Osiris** is the last, guarding Thoth Station. F also says nine were built | as above | as above | F only (C). B&N/AL say that in the book the attackers "never really form a fleet" and that the show built them into one: **conflict with F's "six ships, 24 missiles"**. Unresolved |
| **Donnager** | Martian (MCRN) battleship, Donnager class | 475.5 m (F, fan profile; matches `traffic.ts`) | F: 2 spinal railguns (4 mounts), 6 forward and 8 aft missile launchers, 44 40 mm PDCs, 4 Epstein drives; crew 2,086; hangar for 8 escorts (12 in the show, per a search snippet of the wiki) | Existence, role, fate: A. Numbers: C (likely RPG/show-derived) |
| **Tachi, later Rocinante** | MCRN Corvette-class light frigate, a Donnager escort; taken by Holden's crew and renamed | 46 m (RPG sheet, fan breakdown; E uses 46 m); another RPG sheet says 45 m | F: 6 40 mm PDCs and 2 torpedo launchers (20 torpedoes), 4 recon drones (names in F look show-only). RPG: 6 PDC, 2 torpedo tubes. A fan wiki snippet says a light keel railgun was fitted later (WS). Crew can be 30 per F | Origin as Tachi: A. Specs: C. **Check the railgun**: our `corvette.glb` carries a roof railgun; the sources found disagree about whether the book ship has one |
| **Guy Molinari** | OPA ship used in the Thoth assault | `traffic.ts` has Molinari at 100 m (E) | OPA freighter carrying boarders | F (B for role) |
| **Eros Station** | Station inside asteroid 433 Eros | Asteroid about 34 km long, per real survey data (the engine has radius 17 km) | | Real asteroid: A |

Drive notes (F, grade C): thrust-to-weight "presumably over 3" for the best military drives, "around 2.6" for most; the same page quotes a thrust of about 6.4 MN at 18,900 km/s exhaust speed, which is a fan-physics model, not text.

### Accelerations
No public source gives a book acceleration for any flight here. **[R, unverified]**: the books speak of ordinary Belter and hauler transits at a fraction of a gee, hard military burns at several gees with the crew in couches and drugged, and Eros's post-change motion as impossible for any human ship. Do not use those as numbers. Brachistochrone transit times at assumed accelerations, computed here for E3.1.d (`t = 2 sqrt(D/a)`, flip at half way, `D` in AU):

| D | 0.1 g | 0.3 g | 1 g | 3 g |
|---|---|---|---|---|
| 0.3 AU | 5.0 d, 210 km/s | 2.9 d, 363 km/s | 1.6 d, 663 km/s | 0.9 d, 1149 km/s |
| 1 AU | 9.0 d, 383 km/s | 5.2 d, 663 km/s | 2.9 d, 1211 km/s | 1.7 d, 2098 km/s |
| 2 AU | 12.8 d, 542 km/s | 7.4 d, 938 km/s | 4.0 d, 1713 km/s | 2.3 d, 2967 km/s |
| 4 AU | 18.1 d, 766 km/s | 10.4 d, 1327 km/s | 5.7 d, 2422 km/s | 3.3 d, 4196 km/s |
| 8 AU | 25.6 d, 1083 km/s | 14.8 d, 1876 km/s | 8.1 d, 3426 km/s | 4.7 d, 5934 km/s |

Speeds are the peak, at the flip. Note `src/course.ts` `planTrip` is a presentation autopilot (it fixes a watchable duration and derives `a`); it is **not** a physical solver. E3.1.d needs a new pure function (`transit(D, a, flipSecs)` returning time, peak speed, flip time), to be shared with the map.

## 2. Order of the book's Roci-relevant action (per W, GS, F; grade B overall)

1. Prologue (Julie Mao, trapped, finds a changed figure aboard her ship). Not a Roci event.
2. Canterbury, out of Saturn's rings for Ceres, answers a distress signal from the Scopuli. Five of her crew go in the Knight shuttle (Holden, Naomi Nagata, Alex Kamal, Amos Burton, Shed Garvey).
3. Scopuli is empty and the beacon on it is Martian. A stealth ship destroys the Canterbury with nuclear missiles; the Knight survives.
4. Holden broadcasts a claim that Mars did it. A Martian battleship, the Donnager, picks the survivors up; Fred Johnson of the OPA offers support (GS).
5. Donnager is attacked by stealth ships. Shed is killed in the fight. The Donnager's captain (Yao) scuttles her. Holden's group escapes in the frigate Tachi; a Martian lieutenant (Kelly) dies of wounds (GS). Later Holden learns from a chip that Earth built the ships (W).
6. The group goes to Tycho, Fred Johnson's yard. Tachi becomes Rocinante. Fred asks them to find Polanski, a suspected OPA contact on Eros.
7. Eros: Holden's crew and Miller (a Ceres detective, the book's other viewpoint) meet at Polanski's room. They find Julie's body. A fake radiation alert herds people into shelters; this spreads infection. The crew escapes the station.
8. They follow coordinates from Julie's phone to an asteroid, find the Anubis abandoned and a Protogen recording, and the Roci destroys the Anubis.
9. Miller learns of Thoth Station; the OPA, with the Roci and the Molinari, attack it. The Osiris is the guard ship and is beaten. Dresden is captured, then killed by Miller.
10. OPA and Miller plan to deal with Eros; the protomolecule takes control of Eros, which accelerates toward Earth; the Roci and others pursue; Miller persuades Julie to steer for Venus. Eros hits Venus.
11. Epilogue: towers grow on Venus.

**Differences from the show (B&N/AL, W):** the show adds a Donnager boarding fight and has Holden persuading the Martians to rescue his crew; builds the attackers into a named fleet (the book does not, per AL); has Alex fly the Tachi out of the hangar; shows Havelock attacked on Ceres (in the book he transfers out); and gives Phoebe Station a central role as a place and in the Donnager interrogation. The Shed death is nearly the same on page and screen (AL, B&N). Rocinante's later missions in sources (Eros incident, Thoth assault) are in the book.

## 3. Set pieces

Format per entry: **when** (in-story), **where**, **ships**, **aboard**, **order**, **accelerations**, **documentation A/B/C**, **feasibility**.

### SP1. Scopuli and the Canterbury's destruction; the Knight's survival (E3.3.a)
- **When:** unknown. Likely a few hours from arrival to loss (R). Invent: 5 minutes of watch time per "Canterbury at range, shuttle crosses, blast".
- **Where:** in the Belt-bound lane from Saturn's rings to Ceres. The Canterbury is on her way when the distress call comes; no distance is given. The engine can place it on a lane between `saturn` and `ceres` at an invented point; the sky behind then reads as deep space.
- **Ships:** Canterbury (hauler 500 m, E), Scopuli (freighter 100 m stand-in, or a smaller transport), Knight (shuttle; `racer` 25 m stand-in), Anubis (stealth 150 m, silent and black).
- **Aboard:** Knight, five (above). Canterbury, a crew whose number is not in the public record.
- **Order:** Canterbury decelerates and holds off the Scopuli. Knight crosses. Crew finds Scopuli empty, finds the beacon. Knight starts back. Stealth ship's missiles hit the Canterbury; nuclear blast vaporises her (F says the debris also destroyed the Scopuli and nearly the Knight). Crew floats in the Knight. Holden's broadcast follows.
- **Accelerations:** none. Missiles: none given.
- **Documentation:** B for order and ships (W, F, GS agree). Positions/weapons C.
- **Feasibility:** **high.** Needs: Canterbury model (hauler.glb exists), Knight (stand-in), a nuclear flash effect and debris field (E3.2.c), silent cameras. No traffic needed. Good first slice.

### SP2. The Donnager picks up the survivors, then is destroyed; the Tachi escape (E3.3.b)
- **When:** unknown; the Donnager has the group aboard for some time before the fight (R: days). Battle length unknown.
- **Where:** the Donnager is on an inbound course in the Belt region. No coordinates.
- **Ships:** Donnager (battleship 475 m, E), Tachi (corvette 46 m, E) plus other escorts (up to 8 hangared), attackers: 6 Amun-Ra stealth ships (F, C) or fewer (AL says "never a fleet"). Anubis-class are about 150 m, black.
- **Aboard:** Donnager crew about 2,086 (F, C), Captain Yao, Lieutenant Kelly; Holden's four plus Shed. Tachi: Holden's crew, Kelly (dying).
- **Order (F):** attackers jam comms, fire missiles (F says 24; unverified), Donnager's guns kill three, breach pods latch on and boarders arrive, a round kills Shed (a scene both book and show share per AL), Yao scuttles the ship, the Tachi leaves the hangar just before. The last two attackers die with the Donnager (F). Whether the show's boarding fight is in the book is unsettled: AL calls the Martians' rescue of Holden's crew a deviation from the book.
- **Accelerations:** none; torpedo and PDC performance not given. Use RPG-level assumptions only, marked invented.
- **Documentation:** B for outcome and cast, C for numbers (the 6-ship/24-missile account is a single source against AL's "never a fleet").
- **Feasibility:** **medium.** Needs 6 attackers on scripted paths, PDC tracers, missile trails, impacts, the Donnager hull breach and explosion (E3.2.c/d), the Tachi's flight out. Donnager model exists (`battleship.glb`).

### SP3. Tachi/Rocinante flight to Tycho; Tycho Station (E3.3.c, first half)
- **When/where:** unknown; the route is not in the public record. Tycho in this engine is a Belt yard (E: `tycho` at 2.95 AU, `lift` 30), with its own model (`tycho.glb`) and a docked-ship sequence already in `src/data.ts`.
- **Ships:** Rocinante; Tycho.
- **Aboard:** Holden, Naomi, Alex, Amos (Kelly dead). Fred Johnson meets them.
- **Order:** arrival, docking, the ship renamed (the naming is covered in many sources; the date is unknown), the Polanski mission set.
- **Accelerations / transit:** any hop Donnager-site to Tycho is unknown; use the table in section 1 (about 0.5-2 AU at 0.3 g takes 3-7 days; invented).
- **Documentation:** B (the order is certain; no numbers).
- **Feasibility:** **high**, since Tycho, Roci and a docking leg exist. No effects needed beyond plume and lights.

### SP4. Tycho to Eros; Eros (E3.3.c, second half)
- **When/where:** Eros station in asteroid 433 Eros. In the engine, `eros` orbits at 1.458 AU (E), the real near-Earth orbit. I could not confirm where the book puts it; some sources speak of it in the Belt (R, ?). Tycho is at 2.95 AU in the engine, so a straight leg is about 1.5-4 AU depending on angles: **a few days at 0.3 g to over a week at 0.1 g**. Both bodies orbit in our engine with fixed angles; the scenario must pin them (see format sketch).
- **Ships:** Rocinante; Miller arrives separately from Ceres by another ship (not named in public sources).
- **Order:** docking, Polanski's hotel room, Julie's body and phone, the false radiation alert and shelters, escape. Interior scenes (ground) are dialogue-heavy.
- **Documentation:** B for order; C for geography.
- **Feasibility:** **medium for the approach, low for the interior.** Exterior only: an asteroid with a station dome and a docking. The engine has an asteroid (`eros`), but no Eros Station model. Interiors are deferred (E3.4.c).

### SP5. Phoebe (user's list)
- **Book:** Phoebe is **backstory** (the place where the protomolecule was found and the lab is). Sources agree (W, F, B&N): Protogen found it there. A source I could not confirm says Thoth is on Phoebe (WS, conflicting with F where Thoth is a separate Protogen station). In the show Phoebe Station is a place on screen.
- **Documentation:** C. **Feasibility:** medium-high as an establishing shot: Phoebe is in `data.ts` (86.6 Saturn radii out). Recommend a short, clearly labelled "flashback" shot, not a set piece.

### SP6. The Anubis found and destroyed (inside E3.3.c)
- **Where:** a lone asteroid at coordinates from Julie's phone (WS, GS). Not in the engine's list of bodies; would be an invented rock.
- **Ships:** Rocinante, Anubis (derelict, covered in biomass).
- **Order:** approach, board, find Protogen recording, destroy the ship with a missile (F says the Roci did; a snippet credits Amos firing it). Outcome: A. Torpedo: C.
- **Documentation:** B. **Feasibility:** **high:** one hero shot of a black ship and a torpedo.

### SP7. Thoth Station assault (not in the backlog list; propose as E3.3.c2)
- **Where:** Protogen's secret research base. **Location unknown** (a Belt station per F; one snippet says Phoebe).
- **Ships:** Osiris (Amun-Ra, last), Guy Molinari with boarders, Rocinante, other OPA ships.
- **Order (F):** Osiris emerges and fires two missiles at the Molinari; the Roci intercepts them; a close fight follows in which the Roci's PDCs destroy the Osiris's crew and systems; the station falls with little resistance (GS). Mentions of a disabled thruster on the Roci in the fight come from a search snippet (C).
- **Documentation:** B for the sequence, C for details. **Feasibility:** **medium-high**: three ships and a station model needed (Tycho or Medina stand-in), PDC and missile effects, a close fight. A good second slice after SP1-2.

### SP8. Eros under control; the Roci's chase; the fall into Venus (E3.3.d)
- **When:** unknown; Eros "accelerates at a rate no human ship can match" (W, per digest). An in-engine figure is not given by any source; the real transit Eros to Venus (about 0.7-1.5 AU) would be 1.6-5 days at 3 g, and a few hours at 100 g or more. Choose a compression for display and mark it invented.
- **Where:** Eros orbit to Earth's neighbourhood; then toward Venus (E: `venus`, 0.723 AU). Eros ends up hitting Venus (W, B).
- **Ships:** Eros (asteroid), Rocinante, missiles launched at Eros by Earth and redirected by the OPA (GS, C: conflicts with W, which says the plan was a collision with a big ship; unresolved), other ships.
- **Order:** the OPA/Miller bomb-the-ports plan; Eros changes course on its own; the ships and missiles chase; Miller persuades Julie to turn it from Earth; impact on Venus; two crystal towers grow (GS epilogue).
- **Documentation:** B for the arc, C for the chase details.
- **Feasibility:** **medium-high:** Eros, Venus (with atmosphere and clouds), the Roci, plume and missile effects. The impact flash is new (E3.2.c). The "no inertia" motion can be shown as acceleration with no visible plume.

### SP9. Venus epilogue (E3.3.d)
- Towers grow on Venus (GS, C; W: "a vast structure"). **Feasibility:** medium, since a procedural structure on a textured Venus is needed. Not the Roci's scene; use as a coda.

## 4. Ship models: have and missing

| Needed | Have in `assets/models/` (E) | Use now | Missing |
|---|---|---|---|
| Rocinante / Tachi (46 m corvette) | `corvette.glb` (Blender; there is also `playerShip()` built from it, and `ROCI` constants) | Yes | A "Tachi" (MCRN grey) paint variant; the **railgun question** above |
| Donnager (475 m battleship) | `battleship.glb` | Yes | Hangar bay and breach damage states |
| Canterbury (ice hauler) | `hauler.glb` (500 m) | Yes | Check it reads as a tug with ice cargo, not a freighter |
| Anubis, Osiris (Amun-Ra stealth) | `stealth.glb` (150 m) | Yes | Breach pods; "dark" materials |
| Scopuli | `freighter.glb` (100 m stand-in) | Stand-in | A specific small freighter |
| Knight shuttle | `racer.glb` (25 m stand-in) | Stand-in | A real shuttle model |
| Guy Molinari | `freighter.glb` | Yes | Boarding-party markings |
| Tycho station | `tycho.glb` | Yes | |
| Eros | asteroid body (real data, textured) | Yes | Station dome or ports |
| Phoebe | moon body | Yes | |
| Venus | planet with atmosphere | Yes | Towers |
| Thoth station | none | Stand-in `tycho.glb` or `medina.glb` | A Protogen research station |
| Nauvoo/Behemoth, Medina, Typhoon etc. | `medina.glb`, `dreadnought.glb` | Later books | See overview |
| Weapons | none | | Missile/torpedo, PDC tracer and nuclear flash (E3.2.c) |
| Crew | `person.glb` | Interior only | |

## 5. Feasibility summary

| Set piece | Documentation | Feasibility | Order of build |
|---|---|---|---|
| SP1 Canterbury and Knight | B | High | 1 (the vertical slice the backlog suggests) |
| SP3 Roci to Tycho | B | High | 2 (cheap) |
| SP6 Anubis kill | B | High | 3 |
| SP2 Donnager | B/C | Medium | 4 |
| SP7 Thoth | B/C | Medium-high | 5 |
| SP8 Eros and Venus | B/C | Medium-high | 6 |
| SP4 Eros interior, SP5 Phoebe, SP9 | C | Low / short | last |

## 6. Scenario file sketch for E3.2.a

One JSON file per sequence in `src/scenarios/`, plus `scenarios.json` listing them. TypeScript types in `src/scenarios/types.ts`. Design goals from the first scenarios: deterministic and seekable (closed-form legs, no stepping); every number carries its provenance; small enough to write by hand.

```jsonc
{
  "id": "lw-canterbury",
  "title": "The Canterbury",
  "book": 1, "bookTitle": "Leviathan Wakes",
  "spoiler": "A ship is destroyed.",         // card text, our words
  "sources": ["canon/leviathan-wakes.md#sp1"], // pointer to this research
  "frame": {                                  // where everything happens
    "space": "sol",
    "origin": { "body": "ceres", "offsetAu": [0.4, 0, 0.1] },  // or {"abs":[x,y,z] m}
    "pinBodies": { "saturn": {"angle": 3.6}, "ceres": {"angle": 1.2} }, // fix orbital angles so the sky is the same every time
    "unit": "m", "seed": 7
  },
  "time": { "duration": 240, "storyHours": 3, "scale": "compressed" }, // watch seconds vs story time
  "actors": [
    { "id": "cant", "name": "Canterbury", "model": "hauler", "len": 500, "faction": "civil",
      "plume": { "color": "#9fc3ff", "burn": 0.3 }, "confidence": "B", "crew": 24 },
    { "id": "knight", "name": "Knight", "model": "racer", "len": 25, "confidence": "C", "standin": true },
    { "id": "anubis", "name": "Anubis", "model": "stealth", "len": 150, "stealth": true, "confidence": "B" }
  ],
  "tracks": {                                  // legs; each is closed-form so seeking is exact
    "cant": [
      { "t": 0,  "type": "hold",  "at": {"rel": "origin", "m": [0,0,0]}, "face": "+x" },
      { "t": 20, "type": "burn",  "from": "here", "to": {"rel":"scopuli","m":[-3000,0,0]},
        "g": 0.3, "flip": "auto", "orient": "velocity" }  // brachistochrone leg: duration solved from g
    ],
    "knight": [
      { "t": 40, "type": "keyed", "points": [ {"t":40,"m":[...],"q":[...]}, {"t":70,"m":[...],"q":[...]} ], "interp": "hermite" },
      { "t": 90, "type": "ballistic", "vel": "inherit", "spin": [0,0.1,0] }
    ],
    "anubis": [ { "t": 0, "type": "keyed", "points": [...] } ]
  },
  "events": [
    { "t": 70,  "type": "hail",    "from": "cant", "to": "scopuli", "caption": "own words" },
    { "t": 118, "type": "fire",    "weapon": "torpedo", "from": "anubis", "to": "cant", "count": 2, "speed": "g:20" },
    { "t": 124, "type": "hit",     "target": "cant", "fx": "nuke", "damage": "destroy" },
    { "t": 124, "type": "debris",  "from": "cant", "n": 400, "seed": 3 },
    { "t": 130, "type": "silence", "dur": 6 }      // sound cue: space is quiet
  ],
  "shots": [                                   // the director (E3.2.f)
    { "t0": 0,   "t1": 30,  "mode": "track",       "target": "cant",  "from": [2.5, 1.5, 0.02], "to": [2.1, 1.1, 0.05], "fov": 42 },
    { "t0": 30,  "t1": 90,  "mode": "overShoulder","target": "knight","fov": 55 },
    { "t0": 110, "t1": 140, "mode": "longLens",    "target": "cant",  "dist": 4000, "fov": 18 },
    { "t0": 140, "t1": 180, "mode": "cockpit",     "target": "knight" }
  ],
  "captions": [ { "t": 5, "text": "Written fresh for this project.", "dur": 6 } ]
}
```

Notes for E3.2.a/b:
- **Leg types:** `hold`, `burn` (brachistochrone: `g`, optional `flipAt`, duration solved), `keyed` (hand-set points with Hermite or slerp, for dogfights and tumbles), `ballistic` (coast with spin), `follow` (match another actor with an offset, for escorts and boarding pods), `tumble` (wrecks). Every leg is a pure function of time, so a scrubber can seek.
- **Reference frames:** positions are `{rel: <actor|body|origin>, m: [x,y,z]}` in metres; resolve to doubles then offset for the camera, as `traffic.ts` already does. For battles the scenario's origin is a point in space (metres), not the scene's 1/1000 AU units, so 46 m ships and 500 km ranges stay accurate.
- **Pinned layout:** the engine's bodies hold fixed orbital angles (`data.ts`); the file may pin angles so the scene is repeatable (no ephemeris is needed).
- **Provenance:** every actor and event may carry `confidence` (A/B/C/?), `standin`, and `invented` flags. A developer overlay can show them. This keeps the "mark everything unverified" rule inside the data.
- **Time:** `time.scale` is `real` (1 s = 1 s) or `compressed` (story-time is longer than watch-time; the file states both so the HUD can show the real duration).
- **Events:** `fire` (`pdc` | `torpedo` | `rail` | `missile`), `hit`, `explode`, `breach`, `vent`, `dock`, `hail`, `spawn`, `despawn`, `jam`, `silence`, `drive` (thrust level), `cue` (sound).
- **Shots** reuse the `Shot` shape in `tour.ts` (`from`/`to` as `[distance in subject radii, azimuth, elevation]`, `fov`, `secs`) with two additions: `target` may be an actor, and `mode` selects follow, over-the-shoulder, long lens, cockpit or "pov of another ship". The existing spring, bars and grade stay.
- **Physics helper** needed in E3.1.d: a pure `transit(D, a, flipSecs)` returning time, peak speed and the flip time; `course.ts`'s `planTrip` is a presentation planner and should not be reused for honest durations.
- **Spoiler guard:** `book`, `spoiler` and a `chapters` list in the file feed the selector (E3.5).

## 7. What I could not establish for this book

- Any chapter or page pointer.
- Any in-story date or duration, and any acceleration in g, for any flight or battle.
- The Canterbury's crew number and exact length; the Knight's size; the Scopuli's size.
- Whether the Donnager's attackers were one ship at a time or six (F and AL differ), and the missile count.
- Whether the book Rocinante carries a railgun, and the exact PDC and torpedo counts.
- Where Thoth Station and the Anubis's asteroid are; where the book places Eros relative to the Belt.
- How Eros's acceleration is described, and whether Earth's missiles were redirected or the plan was to ram the station (W and GS disagree).
- Anything inside Fandom's pages (blocked).
