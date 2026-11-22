# Backlog

The working tracker for Beyond the Ring. It is meant to be read and edited by any session or agent, so the state of the work lives here and not in anyone's head. `ROADMAP.md` keeps the long-form reasoning and research (WebGPU, hosting); this file keeps what is to be done, what is in hand and what is finished.

Created 2026-11-22. Constraints are unchanged: free tools and services only, unofficial and non-commercial, everything borrowed is credited in `CREDITS.md`.

## How to use this file

**Status marks** (used on every epic, task and subtask):

| Mark | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | In progress. Put the branch and your agent name or session beside it, e.g. `[~] (branch real-bodies, agent B)` |
| `[x]` | Done. Add the date and the commit, e.g. `[x] 2026-11-25 abc1234` |
| `[?]` | Needs research before it can be planned. A research task produces a written note in `docs/research/` and then turns into `[ ]` tasks |
| `[!]` | Blocked. Say on what |
| `[-]` | Dropped or shelved. Say why and who decided |

**Kinds** are tagged in brackets: **[build]** straightforward work, **[research]** find out first, **[rework]** replaces something already built, **[replatform]** changes the technology underneath. Anything tagged research or replatform has a decision gate: write the finding down, then David decides.

**IDs** are stable: epics `E1`, `E2`; tasks `E1.3`; subtasks `E1.3.b`. Never renumber. New items take the next free number. Cross-reference by ID.

**Rules for agents**
1. Before starting, read this file, `docs/ROADMAP.md`, `docs/HAND-TEST.md` and the memory file `expanse-explorer.md`. Pick an item, mark it `[~]` with your branch and name, and commit that edit first so a parallel agent sees the claim.
2. Work on a branch. Do not push half-finished work to `main`.
3. When a task changes what a person can see or do, add a line to `docs/HAND-TEST.md` for David to check by hand. Headless tests prove little about feel.
4. When you finish, tick the item, date it, add the commit, and list any new follow-up tasks under the same epic. Do not delete finished items; they are the record of what has been made.
5. Anything borrowed (textures, models, data, text) goes in `CREDITS.md` with source, author and licence **before** it ships. Check the licence at the source, never from memory.
6. Ordered by priority inside each epic, not by number. The "Suggested order" at the end is the cross-epic sequence.

## Baseline: what already exists (so nobody rebuilds it)

- [x] Sol at true scale (1 unit = 1/1000 AU, log-depth buffer, floating origin); ships, stations and planets at real size ratios (2026-11-21)
- [x] Ring space at true scale with a ring model, gates and traffic (2026-11-20/21)
- [x] Interiors: Ceres concourse, Tycho, Medina, Ganymede, with skinned crowds, probe-baked bounce light, collision
- [x] Flight and walking, photo mode, sound synthesis
- [x] Tours: shot types, continuous camera, film grade, letterbox and lower thirds, gate dive, score and whooshes (2026-11-22)
- [x] Traffic with sidestep and keep-out; Blender procedural ship pipeline with meshopt GLBs
- [x] Public repo, live on here.now (`silken-marvel-d95y`)
- Unbuilt and still open from earlier work: depth of field, motion blur, adaptive exposure; hull names and insignia decals; interface gap-analysis fixes (hint overlap, stale start-screen controls, banner and label collision, clipped destination list, settings panel); far ring-space gates are still a plain hoop; hauler, battleship and tycho GLBs not rebuilt at true size.

---

## E1. Photorealism for every object

**Goal:** every object that can be seen, from a planet to a person to a bolt on a hull, looks like a photograph or a film still, in line with the film-look grade already built. Today the planets use real maps; the ships, stations and people are procedural and stylised.

**Why it is a backlog and not a task:** photorealism at this scale is mostly a content and pipeline problem, and parts of it may not be reachable on the current renderer.

### E1.1 [x] 2026-11-22 research note: docs/research/photoreal-and-renderer.md [research] Define "photoreal" and set a measurable bar
- [ ] E1.1.a Pick 10 reference shots (real NASA photos for planets and moons, film stills for ships) and write them to `docs/research/photoreal-targets.md`
- [ ] E1.1.b Decide the performance budget: target frame rate and GPU (David's Mac, and a mid laptop) so the bar is realistic
- [ ] E1.1.c Capture side-by-side comparison frames (game vs reference) from fixed camera positions; keep them in `docs/studies/` and re-shoot after each milestone

### E1.2 [x] 2026-11-22 DECIDED by David: stay on WebGL (three r187); reversed-Z first; bounded WebGPU stills trial in parallel; no migration, engine or native move now (docs/research/photoreal-and-renderer.md) [research] Renderer decision: stay on WebGL, or replatform
- [ ] E1.2.a Re-read the WebGPU spike (`docs/WEBGPU-SPIKE.md`, branch `webgpu-spike`) and list which photoreal features it would enable (GTAO, SSGI, compute crowds, path-traced stills) versus what WebGL can do with libraries
- [ ] E1.2.b [research] Survey of alternatives to a browser three.js build: Unreal/Unity WebGL export, Godot web, Babylon.js, a native app (Tauri or Swift/Metal) with the web build as the light version. Record cost, licence, loss of the browser reach, and what of the codebase survives
- [x] E1.2.c Reversed-Z on WebGL: done 2026-11-22 (branch reversed-z, see log). Falls back to the old log depth where EXT_clip_control is missing; `?logdepth` forces the old scheme
- [ ] E1.2.e Bounded WebGPU stills trial (3–5 days): a separate page rendering path-traced stills of ships and interiors with the WebGPU path tracer; does not touch the game. Decide after: keep as a photo-mode export or drop
- [ ] E1.2.f Verify reversed-Z on Safari and Firefox (EXT_clip_control); David to hand-test
- [ ] E1.2.d Decision note and gate for David: stay, migrate to WebGPU, or move platform. Nothing in E1.3 onwards that is renderer-specific starts before this, except the renderer-neutral content work marked (neutral)

### E1.3 Planets, moons and small bodies
- [ ] E1.3.a [research] Best open data for each body: NASA Blue Marble and Black Marble (Earth), LRO and LROC (Moon), MOLA and HiRISE (Mars), MESSENGER (Mercury), Magellan (Venus), Juno, Cassini, New Horizons (Pluto), OSIRIS-REx (Bennu), Hayabusa2, Rosetta (67P), Dawn (Ceres, Vesta). Licence and resolution for each; list in the research note
- [ ] E1.3.b Displacement and normal maps from elevation data where it exists, so terminators and limbs show real relief (neutral)
- [ ] E1.3.c Earth: clouds as a separate moving layer, city lights, ocean specular and sun glint, atmosphere scattering that matches photographs at the limb and from orbit
- [ ] E1.3.d Gas and ice giants: banding, storms and rings with proper shadowing and forward-scatter brightening; Saturn's ring-on-planet shadow
- [ ] E1.3.e Irregular bodies (Eros, Psyche, Ida, Halley, 67P, Bennu): replace spheres with real shape models (NASA 3D Resources, JPL, ESA), with true albedo maps
- [ ] E1.3.f Sun: limb darkening, corona, granulation texture
- [ ] E1.3.g Where a texture is limited by resolution (Moon 18 MB, Mars 10 MB already large), add tiled streaming or KTX2 and LOD by distance; budget for download size

### E1.4 Ships and stations
- [ ] E1.4.a [research] Reference gathering for each hero vessel: Rocinante, Donnager, Canterbury, Agatha King, Tycho, Medina, Behemoth, Nauvoo, Pella, Razorback, Mormon ships, MCRN and UNN classes. Note what the books give (lengths, drive, look) as the authority; the show's design where the books are silent, credited as fan homage
- [ ] E1.4.b [rework] Hull material pass: panel lines, weathering, scorch, micrometeorite pitting, real-metal roughness, emissive windows; the existing hero-ship pass (branch `hero-ships`) is the starting point
- [ ] E1.4.c [rework] Rebuild hauler, battleship and tycho GLBs at true size with the same pass (outstanding)
- [ ] E1.4.d Hull names, insignia and registry decals (outstanding)
- [ ] E1.4.e Station exteriors: spin structures, docking arms, solar and radiator arrays, real-world detail density
- [ ] E1.4.f Real spacecraft in Sol: use real models for the ISS, Tiangong, JWST, Hubble, Voyager, Cassini, Parker, Perseverance etc. (see E2)
- [ ] E1.4.g Engine and reaction-control effects, exhaust and plume; extend the existing plume shader
- [ ] E1.4.h Camera effects that sell scale: depth of field, motion blur, lens flares tied to real light sources, adaptive exposure (outstanding from tours)

### E1.5 Lighting and look
- [ ] E1.5.a Per-interior HDR environments (shelved 2026-11-19; reopen if E1.2 allows)
- [ ] E1.5.b Ambient occlusion and contact shadows (ROADMAP Phase A step 3)
- [ ] E1.5.c Path-traced stills for photo mode (`three-gpu-pathtracer`)
- [ ] E1.5.d Sun-only lighting in open space: hard light, deep shadow, correct earthshine and ringshine

### E1.6 People and interiors
- [ ] E1.6.a [rework] Better people: hand-built topology, baked occlusion, skin and cloth shaders (ROADMAP step 11)
- [ ] E1.6.b Interior materials move from scans to full PBR sets with trim sheets and decals; wear driven by use patterns
- [ ] E1.6.c Faces and hands where the player can get close; decide whether to stop at "believable at conversation distance"

### E1.7 Asset pipeline for photoreal content
- [ ] E1.7.a [research] Free asset sources and their licences: Poly Haven, ambientCG, NASA 3D Resources, ESA, Sketchfab CC0 only if checked; record each in `CREDITS.md`
- [ ] E1.7.b KTX2 and Draco/meshopt in one repeatable `bun` pipeline, with an asset budget table (download size per system, load time on a typical connection)
- [ ] E1.7.c Lazy-load by system so the first view arrives fast; show what is left to download

---

## E2. Real objects: find out what we know

**Goal:** when the player comes across a real object in Sol (a planet, moon, asteroid, comet, probe, telescope, station, landing site), they can open an information panel and learn what science has found, with sources and links. Fictional objects (the Rocinante, Medina) are marked clearly as fiction and, where it helps, linked to the real thing they resemble.

**Agencies and sources to consider** (David confirmed 2026-11-22: ESA, the European Space Agency): NASA (Solar System Exploration, NSSDC, PDS, JPL Small-Body Database, JPL Horizons, Eyes on the Solar System, NASA Image and Video Library), ESA (science and technology pages, Gaia, Rosetta, Hera, JUICE), JAXA (Hayabusa2), ISRO, CNSA, USGS Astrogeology (Gazetteer of Planetary Nomenclature through the IAU), Minor Planet Center, IAU. Wikipedia and Wikidata for connective facts, with the licence kept.

### E2.1 [x] 2026-11-22 research note: docs/research/real-data-sources.md; six open questions for David [research] Sources, licences and shape of the data
- [ ] E2.1.a Per source: what is free to use, in what form (API, bulk download, scraped page), the exact attribution wording, and whether text may be copied or only facts used. NASA media is usually public domain but individual items may carry third-party credits; ESA web text may not be copied; images are editorial/education use with credit 'ESA', CC BY-SA 3.0 IGO only on marked assets (see docs/research/real-data-sources.md). Write the findings to `docs/research/real-data-sources.md`
- [ ] E2.1.b Decide online or offline: ship a curated static dataset (fast, safe, no calls) or fetch live from the agencies (always current, but depends on their APIs and adds a network call). Recommended default: curated static dataset built by a script, with a link out to the live page; no runtime calls to third parties
- [ ] E2.1.c Privacy: no calls that carry user information; no analytics

### E2.2 Data model and build script
- [x] 2026-11-22 E2.2.a (branch real-facts, 5f2e7d3, thin slice: Earth and Luna only, not merged) Schema `Fact` with value, unit, source name, source URL, date retrieved, licence; schema `Entity` with id, name, kind (planet, moon, asteroid, comet, probe, station, site), real or fictional, links
- [x] 2026-11-22 E2.2.b (branch real-facts, 5f2e7d3, thin slice: Earth and Luna only, not merged) A build script `tools/build-facts.ts` that pulls from JPL SBDB and Horizons and the curated lists and writes `assets/data/facts.json`; re-runnable and versioned, with a diff of what changed
- [x] 2026-11-22 E2.2.c (branch real-facts, 5f2e7d3, thin slice: Earth and Luna only, not merged) Tests: every fact has a source and a date; no entity without a licence line

### E2.3 What appears in the game
- [ ] E2.0 Decisions recorded 2026-11-22 (David, on my recommendation): panel labelled AI-assisted with a Sources list, never 'NASA says'; no ESA images (facts and links only); JAXA facts and links only; date control 'today' only for now; ISRO/CNSA deferred; NASA 3D: rely on media guidelines and note the licence conflict in CREDITS.md
- [x] 2026-11-22 E2.3.a (branch real-facts, 5f2e7d3, thin slice: Earth and Luna only, not merged) Info panel: open from the aim card or a key (`I`), shows the name, a one-sentence summary, key numbers (size, mass, orbit, day, temperature, discoveries), a short "what we know", "what we do not know", missions that visited, and links
- [x] 2026-11-22 E2.3.b (branch real-facts, 5f2e7d3, thin slice: Earth and Luna only, not merged) A "Real" or "Fiction" badge on every object so it is never unclear
- [ ] E2.3.c For fiction objects, a "based on" link to the real equivalent (Tycho station to O'Neill cylinders, Ceres concourse to real Ceres data)
- [ ] E2.3.d Missions layer: real probes at their true trajectories or last known positions, with launch dates and what they found
- [ ] E2.3.e Landing sites and surface features (Apollo sites, Curiosity, Perseverance, Schiaparelli) as markers visible at close range
- [ ] E2.3.f Search and a "Discover" list: browse by agency, by mission, by kind; a "what is that?" shortcut on any object
- [ ] E2.3.g Accessibility: all of this readable on a phone and by screen reader

### E2.4 Real objects as geometry
- [ ] E2.4.a Add the real objects missing from Sol: ISS, Tiangong, JWST (at Earth–Sun L2), Hubble, Voyager 1 and 2, Pioneer, New Horizons, Parker Solar Probe, Juno, Cassini (final position), OSIRIS-REx, Hayabusa2; true size, true shape where an open model exists (E1.4.f)
- [ ] E2.4.b Real small-body catalogue: use JPL SBDB orbits so the asteroids, comets and dwarfs sit where they are on a chosen date; add a date control, with "today" as the default

### E2.5 Content care
- [ ] E2.5.a Write in our own words. Do not copy agency prose; summarise facts and link. Where we quote, keep it short and attribute
- [ ] E2.5.b `CREDITS.md` entry per source, and a visible credits link in the game for the data
- [ ] E2.5.c Review pass for accuracy before release; mark each fact as verified by a person or not

---

## E3. Tours that follow the Rocinante: the books' voyages and battles

**Goal:** a new kind of tour that follows the Rocinante (the Roci) and her crew through their travels and fights as the novels tell them, re-enacting the major space battles and voyages as scripted, watchable sequences with the cinematic tour look already built. The existing tours are about places. These are about events.

**Source material and rights:** the novels by James S. A. Corey (the nine main books: *Leviathan Wakes*, *Caliban's War*, *Abaddon's Gate*, *Cibola Burn*, *Nemesis Games*, *Babylon's Ashes*, *Persepolis Rising*, *Tiamat's Wrath*, *Leviathan Falls*, plus the novellas and stories). This is a fan project. Re-enact events and use our own words; **do not reproduce text from the books** in captions or narration beyond a few words, and do not use show audio, music or screenshots. Keep the unofficial and non-commercial notice. Check the project's stance on spoilers: each tour shows a spoiler warning.

### E3.1 [x] 2026-11-22 notes: docs/research/canon/ (book 1 detailed, books 2-9 overview; no chapter refs, needs someone with the books) [research] Canon and timeline
- [ ] E3.1.a Build a canon timeline per book from the novels themselves: where the Roci is, who is aboard, what ships and stations are present, what happens, in what order, over what real durations. Write to `docs/research/canon/<book>.md`. Mark each claim with a book and chapter reference (a pointer, not a quote)
- [ ] E3.1.b List the set pieces per book and rate each by how well the book describes it (positions, ships, weapons) and how feasible it is to build
- [ ] E3.1.c Resolve differences between book and show: books are the authority; where the show differs, record both and use the book
- [ ] E3.1.d Orbital timing: for each voyage, compute the real transit with brachistochrone at the book's accelerations (Epstein drive), so the flights are physically honest; reuse and extend the existing flight maths

### E3.2 [build] Scenario engine (the technical core)
This is the piece that makes a battle different from a camera tour: many moving actors on scripted or simulated paths, events, and a director.
- [ ] E3.2.a Scenario file format (JSON or TypeScript): actors (ships with class, faction, position), keyed paths or brachistochrone legs, events (fire, hit, explode, dock, hail), timeline, and camera shots. One file per sequence in `src/scenarios/`
- [ ] E3.2.b Actor playback: ships follow authored paths with correct flip-and-burn orientation, using the existing traffic and flight code; deterministic, seekable, pausable, with a scrubber for development
- [ ] E3.2.c Weapons and effects: point-defence cannon (PDC) tracers and bursts, torpedoes and railgun slugs with trails, impacts, hull breach, explosions, debris, decompression venting, drive flares, EM and laser glints
- [ ] E3.2.d Damage model for show only: hull sections lost, fires, venting, tumbling wrecks
- [ ] E3.2.e Sound for combat: PDC bursts, impacts through the hull (not in space, so for interior and ship cameras), drive roars, silent exterior shots where the book is clear that space is quiet (extend `src/sound.ts`)
- [ ] E3.2.f Director: shot list per scenario that follows the Roci with the cinematic camera (follow, over the shoulder, long lens from a distance, cockpit, POV from other ships); reuse the tour spring, fov, bars and grade
- [ ] E3.2.g Tour menu: a new "The Rocinante's voyages" section, separate from place tours, with a spoiler warning and a chapter list
- [ ] E3.2.h Performance: many actors and effects at once; budget and test on a mid GPU; instanced tracers and particles

### E3.3 Set pieces, by book (each is a scenario; build in this order of value and feasibility)
**Book 1, Leviathan Wakes**
- [ ] E3.3.a The *Canterbury* destroyed and the *Knight* shuttle escape
- [ ] E3.3.b The *Donnager* battle: the Roci's escape from the stealth ships
- [ ] E3.3.c The Roci's flight from Tycho to Eros; Eros and Phoebe sequences
- [ ] E3.3.d Venus and the Ring creation event; final approach to Eros's crash

**Book 2, Caliban's War**
- [ ] E3.3.e Ganymede: the opening attack and the Roci's role
- [ ] E3.3.f The Roci's run with the Martian marines, and the Io protomolecule site

**Book 3, Abaddon's Gate**
- [ ] E3.3.g The *Behemoth* approach and the transit of the Ring; Medina station; the fight in the slow zone
- [ ] E3.3.h Pursuit and the final resolution

**Book 4, Cibola Burn**
- [ ] E3.3.i Ilus and the landing; the ground and orbit sequences

**Book 5, Nemesis Games**
- [ ] E3.3.j The crew apart; the Roci's dash; Earth under attack by thrown rocks

**Book 6, Babylon's Ashes**
- [ ] E3.3.k The Free Navy battles and the defence of Earth

**Books 7–9, Persepolis Rising, Tiamat's Wrath, Leviathan Falls**
- [ ] E3.3.l The Laconian fleet and the *Typhoon*; the siege of Medina
- [ ] E3.3.m The Roci's last voyages through the Ring and beyond
- [ ] E3.3.n Decide how far to go with the late books once the earlier scenarios prove the engine

### E3.4 Content the scenarios need
- [ ] E3.4.a Ship classes beyond what exists: Martian (MCRN) frigates and cruisers, the *Donnager*-class battleship, *Behemoth*, *Typhoon* and Laconian ships, Free Navy ships, OPA ships, civilian traffic. Rebuild at true size with the E1.4 pass
- [ ] E3.4.b Environments: Eros, Phoebe, Io, Ganymede, Venus, Ilus, the slow zone, the Laconia system, each with their real or fictional geography
- [ ] E3.4.c Crew and characters: voices are not provided (no show audio, no AI voices of actors); captions in our own words; decide whether interior cutaways of the Roci are worthwhile

### E3.5 Tour experience
- [ ] E3.5.a Chapter selector and "resume where you left off"
- [ ] E3.5.b "Watch" mode (hands off) and "Fly alongside" mode (the player flies a ship nearby while the scenario plays)
- [ ] E3.5.c Photo mode and recorded clip export for scenarios
- [ ] E3.5.d Spoiler guard: an opening card listing which books are covered and a toggle to hide the later ones

---

## E4. Platform and replatform candidates

Things that may need research and a big change. None starts without a decision gate.

- [ ] E4.1 [research] [replatform] Renderer (see E1.2): WebGPU, native, or a game engine; feed the decision from E1, E2 and E3 needs (many actors in E3.2.h, path tracing in E1.5.c, large textures in E1.3)
- [ ] E4.2 [research] [replatform] Simulation core split from rendering: a deterministic engine in TypeScript (or WASM) that can run headless, so scenarios and orbits are testable and the renderer is swappable
- [ ] E4.3 [research] Asset streaming and storage: where large textures and models live (a CDN or here.now limits), progressive loading, caching
- [ ] E4.4 [research] [replatform] Hosting: here.now now; revisit Cloudflare Pages or GitHub Pages if the size or traffic changes (see ROADMAP section 3)
- [ ] E4.5 Cross-browser and device matrix: Chrome, Safari, Firefox; Mac, Windows, iPad; touch controls; a low-power mode
- [ ] E4.6 Testing: a repeatable visual regression harness (the Playwright contact sheets already exist), and a real-GPU run on David's machine recorded in `docs/HAND-TEST.md`
- [ ] E4.7 Accessibility and localisation: captions, reduced motion (the tour sway and grain), colour contrast, keyboard-only play, language files

---

## E5. Interface and quality (carried over)

- [ ] E5.1 Interface gap-analysis fixes: hint overlap, stale start-screen controls, banner and label collision, clipped destination list, settings panel
- [ ] E5.2 Smoother tours on a real GPU: texture upload hitches of 60–275 ms at each stop (consider KTX2 and progressive mips, E1.7.b)
- [ ] E5.3 Far ring-space gates: use the ring model rather than a plain hoop
- [ ] E5.4 Sound: positional audio, per-room reverb, footsteps, ventilation and crowd murmur (parked at David's request; synthesised or CC0 only)
- [ ] E5.5 Hand-test pass by a person on a real display and speakers (`docs/HAND-TEST.md`)

---

## Suggested order

1. **Decisions first, all research:** E1.1, E1.2 (renderer decision), E2.1 (sources and licences), E3.1 (canon timeline for book 1). These are cheap and shape everything.
2. **A thin vertical slice of each theme:** E2.2–E2.3 for one object (Earth and the Moon), E3.2 with one scenario (E3.3.a, the *Canterbury*) built end to end, E1.3 for Earth.
3. **Then widen:** more real objects, more scenarios, more photoreal passes.
4. **Replatform only when a slice proves the current renderer is the limit,** not before.

## Log

Newest first. One line per piece of work finished, so a new session can see the history without reading git.

- 2026-11-22 E2 thin slice on branch real-facts (5f2e7d3): facts schema and validation (src/facts.ts), build script reading cached NSSDCA pages (tools/build-facts.ts), info panel on Earth and Luna with Real badge, Fiction badge on ships/stations/gates/artefacts. I already meant inspect, so I now does both on Earth and Luna. Not merged.
- 2026-11-22 Reversed-Z on the WebGL renderer (replaces log depth): same pictures, Tycho dock about 1.55x faster in headless Retina (63 to 41 ms). Fallback and `?logdepth` kept.
- 2026-11-22 Research notes written for E1.1, E1.2, E2.1, E3.1 (three agents). Decisions pending.
- 2026-11-22 Backlog created. Cinematic tours (letterbox, film look, momentum camera, gate dive, score) shipped earlier the same day.
