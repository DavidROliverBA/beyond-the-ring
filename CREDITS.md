# Credits and licences

This project stands on other people's work. Everything that is not original to it is listed here with its source, its author and its licence.

## The Expanse

*The Expanse* is the creation of **James S. A. Corey** (the pen name of Daniel Abraham and Ty Franck). The novels are published by Orbit Books. The television series was produced by Alcon Television Group.

This is an unofficial, non-commercial fan project. It is not affiliated with, authorised by or endorsed by the authors, their publishers, the producers or the distributors of the series. All rights in *The Expanse*, including its names, places, ships, characters and story, remain with their owners. Nothing in this repository's licence grants any right to that material.

What this project does and does not use:

- It uses **names and ideas** from the books and series (ships, stations, places, the ring gates) so that fans can find the things they know.
- It contains **no** footage, stills, artwork, logos, music, sound, design drawings or text taken from the books, the series or any licensed game.
- The descriptive text in the game is newly written for this project.
- The ship and station models are new, built by script (see `tools/blender`). They are impressions made from memory, not copies of the production designs. The Rocinante model was reshaped by eye from publicly shared promotional stills and fan-wiki images of the ship as a visual reference only; no image, texture, logo or marking from the show is used, and the hand-built mesh is original to this project. The Ceres concourse (a street under a vaulted ceiling with terraced housing) was likewise laid out with a publicly shared still as a visual reference for proportion and mood only; its geometry, textures, signs and brand names are all original to this project. The wear and clutter in the interiors (stains, markings, signs, railings, stalls and lights) are likewise drawn and built by script here (`src/wear.ts`, `src/dressing.ts`); nothing in them comes from elsewhere.

- Hull names, registry marks and badges (`src/decals.ts`) are drawn by script: lettering in a system sans face, and badges (a red disc with chevron, a blue disc with three stars, a water drop in a ring, a lance and shield, a sphere with rings) designed for this project. The registry numbers are invented. No insignia, lettering style or number from the series is used.

If you are a rights holder and would like something changed or removed, please open an issue on this repository and it will be dealt with promptly.

## Planet and moon maps (`assets/tex`)

All maps have been resized and recompressed for use in a browser. Further changes are noted.

| Files | Source | Author / credit | Licence |
|---|---|---|---|
| `sun_*`, `mercury_*`, `venus_*` (atmosphere), `earth_*` (day), `earth_night_*`, `earth_clouds_*`, `earth_normal_hi`, `earth_spec_hi`, `moon_lo`, `moon_hi`, `mars_*`, `jupiter_*`, `saturn_*`, `saturn_ring.png`, `uranus_*`, `neptune_*`, `ceres_*` (fictional surface), `stars.jpg` | [Solar System Scope textures](https://www.solarsystemscope.com/textures/) | Solar System Scope, based on NASA mission imagery | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `moon_bump_hi.jpg` | [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720), displacement map `ldem_16_uint.tif` | NASA's Scientific Visualization Studio (Lunar Reconnaissance Orbiter data) | Public domain (NASA). Converted from 16-bit TIFF to 8-bit JPEG. |
| `europa_*` | [Europa Voyager GalileoSSI global mosaic](https://commons.wikimedia.org/wiki/File:Europa_Voyager_GalileoSSI_global_mosaic.jpg) | U.S. Geological Survey / Planetary Data System / Tammy Becker | Public domain |
| `enceladus_*` | [Enceladus Color Map](https://commons.wikimedia.org/wiki/File:Enceladus_Color_Map.jpg) (PIA18435) | NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute | Public domain. Colour saturation reduced. |
| `rhea_*` | [Rhea Color Map](https://commons.wikimedia.org/wiki/File:Rhea_Color_Map.jpg) (PIA18438) | NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute | Public domain. Colour saturation reduced. |
| `iapetus_*` | [Iapetus Color Map](https://commons.wikimedia.org/wiki/File:Iapetus_Color_Map.jpg) (PIA18436) | NASA/JPL-Caltech/Space Science Institute/Lunar and Planetary Institute | Public domain |
| `ganymede_*` | [Ganymede map by Askaniy](https://commons.wikimedia.org/wiki/File:Ganymede_map_by_Askaniy.png) | Askaniy Anpilogov, USGS, Björn Jónsson, NASA/JPL-Caltech/SwRI/MSSS/Brian Swift | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |
| `callisto_*` | [Callisto map by Askaniy](https://commons.wikimedia.org/wiki/File:Callisto_map_by_Askaniy.png) | Askaniy Anpilogov, John van Vliet | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0) |

The Ganymede and Callisto files here are adaptations (resized, converted to JPEG) and are therefore offered under the same CC BY-SA 3.0 licence as the originals. The Solar System Scope files remain under CC BY 4.0.

## Stars (`assets/stars`)

| File | Source | Author | Licence |
|---|---|---|---|
| `stars.bin` | [HYG star database v4.0](https://github.com/astronexus/HYG-Database) (merges the ESA Hipparcos, Yale Bright Star and Gliese catalogues) | David Nash (astronexus.com) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |

`stars.bin` is an adaptation: the 23,354 stars brighter than magnitude 7.4, reduced to position, brightness and colour index and packed into 6 bytes a star by `tools/stars/build-catalogue.ts`. It is therefore offered under the same CC BY-SA 4.0 licence as the original. The Milky Way image behind the stars is `stars.jpg` (Solar System Scope, CC BY 4.0, above); its orientation was found by matching its bright points to this catalogue.

NASA material is used in line with NASA's media guidelines. Its use here does not imply any endorsement by NASA.

Every other body in the game (Io, Titan, Pluto, the small moons and all worlds beyond the Ring) is painted by the project's own code.

## Facts about real objects (`assets/data/facts.json`)

Numbers and launch dates in the info panel (the Sun, every planet, the moons, dwarf planets, asteroids and comets that are real and in the game) are read by `tools/build-facts.ts` from the cached NASA pages in `tools/facts-raw/`; each fact in the file carries its source name, URL, the day it was read, its licence and its credit. The summaries and "what we know / do not know" lists are our own words, drafted with AI help from those pages; they are marked "AI-assisted" in the game and are not a statement by NASA. The game links to this account from the start screen and from the foot of every info panel ("Data and sources"), generated from the facts themselves. Every entry starts as "not yet checked by a person"; a person records a review with `bun tools/review-facts.ts --approve <id> --by "<name>" --note "<what was checked>"`, which is kept in `tools/facts-reviews.json` and lapses automatically if the words or numbers change. No agency images or prose are used, and the game makes no calls to these sites.

| Data | Source | Credit | Licence |
|---|---|---|---|
| Earth and Moon bulk, orbital and atmosphere numbers | [NSSDCA Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html), [Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) | NASA Space Science Data Coordinated Archive, Goddard Space Flight Center | NASA content is generally not subject to copyright in the US ([NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)); facts only, no endorsement implied |
| Sun, Mercury, Venus, Mars (with Phobos and Deimos), Jupiter, Saturn, Uranus, Neptune, Pluto (with Charon): size, mass, orbit, spin, temperature, pressure, discovery | NSSDCA planetary fact sheets: [Sun](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html), [Mercury](https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html), [Venus](https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html), [Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html), [Jupiter](https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html), [Saturn](https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html), [Uranus](https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranusfact.html), [Neptune](https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptunefact.html), [Pluto](https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html) | NASA NSSDCA | As above |
| Amalthea, Io, Europa, Ganymede, Callisto, Himalia, Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Hyperion, Iapetus, Phoebe, Miranda, Ariel, Umbriel, Titania, Oberon, Proteus, Triton, Nereid: radius, mass, density, orbit; gravity and mean temperature for the six largest | NSSDCA satellite fact sheets: [Jovian](https://nssdc.gsfc.nasa.gov/planetary/factsheet/joviansatfact.html), [Saturnian](https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html), [Uranian](https://nssdc.gsfc.nasa.gov/planetary/factsheet/uraniansatfact.html), [Neptunian](https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptuniansatfact.html), and the [Small Worlds table](https://nssdc.gsfc.nasa.gov/planetary/factsheet/galileanfact_table.html) (last updated 2016) | NASA NSSDCA | As above |
| Asteroids, dwarf planets and comets (Ceres, Vesta, Pallas, Hygiea, Interamnia, Eunomia, Juno, Psyche, Eros, Ida, Apophis, Bennu, Ryugu, Hektor, Chiron, Haumea, Makemake, Eris, Orcus, Quaoar, Sedna, Gonggong, Halley, Hale–Bopp, 67P, Tempel 1, Swift–Tuttle, ʻOumuamua, Borisov): size, rotation, orbit, discovery; mass worked out from the catalogue’s GM | [JPL Small-Body Database API](https://ssd-api.jpl.nasa.gov/doc/sbdb.html), one cached response each in `tools/facts-raw/sbdb-*.json` | NASA/JPL Solar System Dynamics group | No separate data licence is stated on the API page; treated as NASA content under the NASA media guidelines (no endorsement implied). Where the catalogue has no diameter (Haumea, Makemake, Eris, Orcus, Quaoar, Sedna, Gonggong, ʻOumuamua, Borisov) none is shown |
| Launch dates of Apollo 8, 11 and 17, Landsat 1, Lunar Reconnaissance Orbiter, Ranger 7, Surveyor 1, Lunar Prospector, GRAIL, LADEE; Mariner 2, 4, 5, 6, 7, 9 and 10, Pioneer 10 and 11, Pioneer Venus Orbiter and Large Probe, Voyager 1 and 2, Viking 1 and 2, Mars Pathfinder, Mars Global Surveyor, 2001 Mars Odyssey, Spirit, Opportunity, Mars Reconnaissance Orbiter, Phoenix, MAVEN, InSight, Mars Science Laboratory, Mars 2020, NEAR Shoemaker, Stardust/NExT, Deep Impact, MESSENGER, Dawn, Juno, New Horizons, OSIRIS-REx, Parker Solar Probe, Psyche | [NSSDCA Master Catalog](https://nssdc.gsfc.nasa.gov/nmc/) entries, each named on its own panel. Only IDs whose page we fetched, and that name the body (or its planet), are used. On 2026-11-22 the catalogue's name search and `display.action?id=` pages (by COSPAR ID and by old NSSDC ID) returned nothing for Galileo, Cassini, Magellan, Rosetta, Hayabusa and Hayabusa2, Giotto, Ulysses or the Vega probes, so none is listed | NASA NSSDCA | As above |
| The story’s Tycho Station, Medina, Ceres Station and Ganymede, “based on” lines | Link to [Space Settlements: A Design Study](https://ntrs.nasa.gov/citations/19770014162), NASA Technical Reports Server (1975 summer study, published 1977); the O’Neill cylinder is described from general knowledge, with no text copied | NASA Ames Research Center (the study); our own words | Link only; NASA content as above. These places are fiction and are marked so |

## Surface materials (`assets/pbr`)

Colour, normal and roughness maps from [ambientCG](https://ambientcg.com) by Lennart Demes, released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). No credit is required; it is given gladly.

| Files | ambientCG asset |
|---|---|
| `plates_*` | MetalPlates004 |
| `walkway_*` | MetalWalkway010 |
| `darkmetal_*` | Metal046B |
| `rock_*` | Rock030 |
| `concrete_*` | Concrete031 |
| `slab_*` | Concrete034 |
| `dirt_*` | Ground054 |

`hull_*` and `windows.jpg` in the same folder are not from ambientCG: they are this project's own work, painted by `tools/blender/hulltex.py` (hull panel seams, hatches, vents, fasteners, dirt and scuffs; and the small lit rooms seen through ship windows), and fall under the project's MIT licence.

## Software

- [three.js](https://threejs.org) — MIT licence. Rendering, post-processing and model loading.
  - The skinned people's clip blending (`src/skinned.ts`) follows the three.js example [webgl_animation_skinning_blending](https://threejs.org/examples/#webgl_animation_skinning_blending) (MIT). The body and its clips are our own, made by `tools/blender/person.py`.
- [Bun](https://bun.sh) — MIT licence. Development server and bundler.
- [TypeScript](https://www.typescriptlang.org) — Apache 2.0 licence.
- [Blender](https://www.blender.org) — GPL. Used as a tool to build the models in `assets/models`; the models themselves are original to this project.
- [glTF-Transform](https://gltf-transform.dev) by Don McCurdy — MIT licence. Used as a tool (through `bunx`) to pack the models, with [meshoptimizer](https://meshoptimizer.org) by Arseny Kapitonenko (MIT), whose decoder ships with three.js and unpacks them in the browser.

## Made with

The code, models and text were written with [Claude Code](https://claude.com/claude-code) (Anthropic's Claude), directed by the repository's owner.

## This project's own work

The source code, the modelling scripts in `tools/blender` and the models in `assets/models` are released under the MIT licence in `LICENSE`. That licence covers only this project's original work. It does not cover the third-party assets above, which keep their own licences, or anything belonging to *The Expanse*.
