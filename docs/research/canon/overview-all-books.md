# Books 2-9 and the novellas: set-piece list

Shorter than `leviathan-wakes.md`. Sources: Wikipedia plot sections (W, grade B for order, via digest), Fables (F), Memory's Legion page on Wikipedia (W). No chapters, no accelerations, no in-story durations for any item (see README). Ratings: D = documentation (A/B/C: positions, ships, weapons as the public record gives them; nothing is better than B here), F = feasibility in the current engine (high / med / low). "Models" lists what exists in `assets/models/` (battleship, corvette, dreadnought, freighter, hauler, medina, person, racer, ring, stealth, survey, tycho). Claims marked [R] are from the researcher's memory and unverified. Everything below spoils the series.

Recurring ship facts: Rocinante is the 46 m Corvette-class (see the Leviathan Wakes file for sources and the railgun question). Later books lean on the Behemoth (the former generation ship Nauvoo, W) and on Laconian warships (big, new designs, no public dimensions found). No source found gives any of their lengths. Treat sizes as ? and choose them by looking, marking "invented".

## Book 2. Caliban's War (W, B)
Key facts: Ganymede (Belt's farm moon) under Earth-Mars truce; kidnapping and soldier attack; the Roci delivers relief; a stowaway alien soldier hunted aboard the Roci; Avasarala and Bobbie race in a racing pinnace to the Roci; a combined Martian and UN fleet destroys Nguyen's fleet; the Io battle; Holden kills Nguyen aboard his flagship; Venus structure leaves for deep space.

| Set piece | Ships | D | F |
|---|---|---|---|
| Ganymede: opening attack, the Roci's relief run (E3.3.e) | Roci, relief craft, Mao's yacht | B | med (Ganymede is in `data.ts` with a dome photo; no soldier or marine models) |
| Stowaway hunt aboard the Roci, killed by the exhaust (W) | Roci | C | low (interior only) |
| Bobbie takes Mao's yacht; racing-pinnace dash to the Roci (E3.3.f) | yacht, pinnace (`racer.glb`) | B | high: two small ships, a rendezvous |
| Fleet battle over Io; Nguyen's flagship (E3.3.f) | Martian and UN warships (`battleship`, `dreadnought`), Roci | B/C | med: large, needs many ships; Io is in `data.ts` |
| Protomolecule site on Io | none | C | med (a place) |
| Venus structure leaves for deep space | Venus | B | med |

## Book 3. Abaddon's Gate (W, B)
Key facts: the Ring built beyond Uranus; a wormhole; a Slow Zone with a speed limit (W gives 600 m/s; the zone slows any ship above that); Ring Station; the Behemoth (OPA warship, ex-Nauvoo) later Medina Station; the Roci flies into the Ring after software seizure and the fleets open fire; marine attack on the station; the limit drops and many die; the final fight aboard the Behemoth.

| Set piece | Ships | D | F |
|---|---|---|---|
| Behemoth's approach and the transit of the Ring (E3.3.g) | Behemoth, Roci, fleets, the `ring` model | B | high for the transit (ring model and a gate dive exist: `gateShot`); the Behemoth needs a ship model (`medina.glb` is the station, a stand-in) |
| Fleets open fire; the Roci flees into the Ring | UN, Martian, OPA | B | med |
| Slow Zone: the speed limit hits; ships brake; survivors | many | B | med (visual of deceleration; sound off) |
| Medina as waystation (E3.3.g) | `medina.glb` | B | high |
| Behemoth interior fight (E3.3.h) | | C | low |

## Book 4. Cibola Burn (W, B)
Key facts: Ilus/New Terra; First Landing colonists and Royal Charter Energy (RCE) ships; the Edward Israel and Barbapiccola in orbit; shuttle attacks; an explosion; alien defences disable power; orbiting ships slowly fall; life-support bubbles move colonists off the Barbapiccola.

| Set piece | Ships | D | F |
|---|---|---|---|
| Ilus approach and landing (E3.3.i) | Roci, Edward Israel (`survey.glb`, in `data.ts`), Barbapiccola (`freighter.glb`, in `data.ts`) | B | med: new planet environment (E3.4.b); ships and shuttle exist |
| Orbit rescue: bubbles and airlocks between falling ships | Roci, Israel, Barbapiccola | B | med |
| The ground sequences | | C | low |

## Book 5. Nemesis Games (W, B)
Key facts: Roci in maintenance at Tycho, crew apart; Alex and Bobbie find stolen Martian ships (the Free Navy) at an asteroid cluster; Free Navy attacks Tycho, seizes Medina, ambushes a Martian convoy; asteroids with stealth coating hit Earth; Alex and Bobbie save the Martian prime minister in the Razorback; Marco's trap with a booby-trapped ship and a fake distress call; Naomi warns the Roci.

| Set piece | Ships | D | F |
|---|---|---|---|
| Crew apart; the Roci in repair at Tycho (E3.3.j) | Tycho, Roci | B | high |
| Razorback and the Martian convoy run, with Free Navy disguised ships | Razorback (`racer.glb`, in `data.ts`), Martian warships | B | med |
| Rocks on Earth (E3.3.j) | Earth, asteroid models | B | med-high: Earth exists; many tracks plus a impact and ground effect |
| The trap ship and the Roci | Roci, trap ship | B | med |

## Book 6. Babylon's Ashes (W, B)
Key facts: the Free Navy (stolen Martian ships) holds the Belt; the Azure Dragon disabled; Fred Johnson's death during hard manoeuvres; the combined fleet takes Medina using thousands of unmanned craft carried by the ice hauler Giambattista; Bobbie sabotages the railgun reactor; Marco rushes back; Naomi works out that ships vanish at the gates if mass follows mass; Marco's fleet vanishes in the Ring. W does not mention Pallas.

| Set piece | Ships | D | F |
|---|---|---|---|
| Roci vs Azure Dragon (E3.3.k) | Roci, Free Navy ship | B | med |
| Ambush on the way to Tycho | Roci, Free Navy | B | med |
| The Medina assault: decoy craft, rail guns, retake (E3.3.k) | hauler, drones, warships, `medina.glb`, Ring | B | med-low: hundreds of actors (E3.2.h) |
| Free Navy vanishes into the Ring | warships, `ring.glb` | B | high for the visual |

(The backlog's "defence of Earth" rests on the Nemesis Games rock strikes; W gives limited Earth-defence content in book 6.)

## Books 7-9

### Persepolis Rising (W, B)
Key facts: 28 years later; Laconia built ships from protomolecule tech; battleship Heart of the Tempest takes Medina; magnetic weapon destroys the Slow Zone railguns; resistance on Medina, the Roci crew steals codes; the Tempest destroys the combined fleets in Sol (all nearby people black out for minutes); Medina evacuation, ambush; Gathering Storm (stolen gunship); Clarissa dies.

| Set piece | D | F |
|---|---|---|
| The Tempest takes Medina (E3.3.l) | B | med: needs a Laconian warship model (none) |
| Sol fleets destroyed by the Tempest | B/C | med-low: a one-sided battle, many targets |
| Medina evacuation escape | B | med |

### Tiamat's Wrath (W, B)
Key facts: dead-system survey; antimatter strike collapses a neutron star into a black hole; alien tendrils destroy parts of the Slow Zone, Medina Station and the Typhoon dreadnought; Bobbie's bomb run on the Tempest; Naomi's fleet raids the Laconian shipyards.

| Set piece | D | F |
|---|---|---|
| Tendril attack on the Slow Zone, Medina and the Typhoon (E3.3.l) | B | med: tendril effect new |
| Bobbie's EVA bomb run | B | low-med |
| Shipyard raid | B | low (new shipyard; many ships) |
Note: W confirms Tempest and Typhoon are separate ships (the backlog says "the Typhoon"; check).

### Leviathan Falls (W, B)
Key facts: dark gods attacks; chase of Duarte and Teresa; New Egypt, Freehold, the Adro diamond; the Roci's final voyages; Ring Station dive; slow-zone battle among ships under Duarte's control; Holden destroys the station, the gates collapse; Alex takes the Roci to Nieuwestadt; an epilogue 1,000 years on.

| Set piece | D | F |
|---|---|---|
| The Roci's dash through the Ring; the Gathering Storm's sacrifice (E3.3.m) | B | med |
| Slow-zone battle | B/C | med |
| Ring Station and the gates' end | B | med: the ring model exists; a station interior does not |
Decision for E3.3.n: the late books' ships are largely invented; stop at book 6 until the engine has the combat tools, then do Medina (the same location in books 3, 5, 6, 7, 8) as the recurring stage.

## Novellas and stories (W, Memory's Legion page)

| Work | Time | Set piece | D | F |
|---|---|---|---|---|
| Drive | about 150 years before book 1 | Solomon Epstein's test flight | B | med: a lone craft; no Mars launch site model |
| The Butcher of Anderson Station | before book 1 | UN raid on Anderson Station in the Belt (Fred Johnson) | B | low-med (new station) |
| The Churn | before book 1 | Baltimore (Amos) | B | none (ground) |
| The Last Flight of the Cassandra | during book 1; RPG-only, five pages | not found in public sources | ? | ? |
| Gods of Risk | between books 2-3 | Mars | B | none |
| The Vital Abyss | between books 3-4 | small OPA station | B | none |
| Strange Dogs | between books 6-7 | Laconia ground | B | none |
| Auberon | between books 7-8 | Auberon colony | B | none |
| The Sins of Our Fathers | after book 9 | Jannah colony | B | none |
Only Drive, the Butcher raid and the Cassandra story are ship or space events; the rest are ground stories.

## Recommended build order (feasibility times value)

1. Book 1: Canterbury (SP1), Roci to Tycho (SP3), Anubis (SP6), Donnager (SP2), Thoth (SP7), Eros and Venus (SP8).
2. Book 3: the transit of the Ring (high feasibility, uses the ring and gate dive).
3. Book 2: the pinnace dash and the Io battle.
4. Book 5: Tycho and the convoy run.
5. Book 6: Medina assault (needs the performance work in E3.2.h).
6. Books 7-9 only after combat effects and large actor counts work (E3.3.n).

## Not established (books 2-9)
Chapters; any acceleration in g; in-story durations; ship lengths for the Behemoth, Free Navy and Laconian ships; the exact moment of each event in the calendar; formation and range details of every battle; whether Pallas is a site in book 6 (W silent); the Cassandra story's contents.
