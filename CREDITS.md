# Credits and licences

This project stands on other people's work. Everything that is not original to it is listed here with its source, its author and its licence.

## The Expanse

*The Expanse* is the creation of **James S. A. Corey** (the pen name of Daniel Abraham and Ty Franck). The novels are published by Orbit Books. The television series was produced by Alcon Television Group.

This is an unofficial, non-commercial fan project. It is not affiliated with, authorised by or endorsed by the authors, their publishers, the producers or the distributors of the series. All rights in *The Expanse*, including its names, places, ships, characters and story, remain with their owners. Nothing in this repository's licence grants any right to that material.

What this project does and does not use:

- It uses **names and ideas** from the books and series (ships, stations, places, the ring gates) so that fans can find the things they know.
- It contains **no** footage, stills, artwork, logos, music, sound, design drawings or text taken from the books, the series or any licensed game.
- The descriptive text in the game is newly written for this project.
- The ship and station models are new, built by script (see `tools/blender`). They are impressions made from memory, not copies of the production designs. The Rocinante model was reshaped by eye from publicly shared promotional stills and fan-wiki images of the ship as a visual reference only; no image, texture, logo or marking from the show is used, and the hand-built mesh is original to this project. The Ceres concourse (a street under a vaulted ceiling with terraced housing) was likewise laid out with a publicly shared still as a visual reference for proportion and mood only; its geometry, textures, signs and brand names are all original to this project.

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

NASA material is used in line with NASA's media guidelines. Its use here does not imply any endorsement by NASA.

Every other body in the game (Io, Titan, Pluto, the small moons and all worlds beyond the Ring) is painted by the project's own code.

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

## Software

- [three.js](https://threejs.org) — MIT licence. Rendering, post-processing and model loading.
  - The skinned people's clip blending (`src/skinned.ts`) follows the three.js example [webgl_animation_skinning_blending](https://threejs.org/examples/#webgl_animation_skinning_blending) (MIT). The body and its clips are our own, made by `tools/blender/person.py`.
- [Bun](https://bun.sh) — MIT licence. Development server and bundler.
- [TypeScript](https://www.typescriptlang.org) — Apache 2.0 licence.
- [Blender](https://www.blender.org) — GPL. Used as a tool to build the models in `assets/models`; the models themselves are original to this project.

## Made with

The code, models and text were written with [Claude Code](https://claude.com/claude-code) (Anthropic's Claude), directed by the repository's owner.

## This project's own work

The source code, the modelling scripts in `tools/blender` and the models in `assets/models` are released under the MIT licence in `LICENSE`. That licence covers only this project's original work. It does not cover the third-party assets above, which keep their own licences, or anything belonging to *The Expanse*.
