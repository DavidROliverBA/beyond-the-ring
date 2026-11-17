# Study: "Above the Clouds" (earth.plus360degrees.com)

Studied 2026-11-17 for ideas for version 2. The site is an Earth Day 2018 piece by plus360degrees: a short guided film over the Earth, with music and on-screen lines of text, plus a free orbit mode.

**Copyright:** the site's own code is obfuscated and has no licence, so none of it, and none of its textures or music, goes into this repo. What we take are the techniques, and these come from published sources we can credit: GPU Gems 3 chapter 13 (screen-space god rays) and John Chapman's 2013 "Pseudo Lens Flare" article. We write our own versions.

## What it is built from

- three.js r90 (2018), GreenSock (TweenMax/TimelineMax) for every camera move and fade, PxLoader for loading, stats.js.
- About 170 KB of its own code, behind a string-table obfuscator. Decoded working copy kept in the session scratchpad only.

## How the Earth is made

Simple, and older than ours:

| Layer | How |
|---|---|
| Ground | Phong material: colour, bump, specular maps. Octahedron sphere, tilted 23°. |
| Clouds | Lambert material, transparent PNG, a shell 0.3 units above the ground, turning slowly. |
| City lights | Its own shell with additive blending, tinted amber `#f1ba3c`. The lights can be flickered off and on as a story beat. |
| Atmosphere | Two fresnel shells: an inner glow on the lit side and an outer back-face rim, slightly offset towards the sun. |
| Lightning | 20 small planes on the cloud shell, each playing an 8×8 flipbook of a storm flash, moved to a random place every 7 or 11 seconds. |
| Sky | A six-sided skybox, rotated 50°. |
| Close-ups | No real flyover: flat high-resolution continent images on planes, with the camera panning across them. |

Beyond the Ring already does better on the planet itself: real maps, night lights masked to the dark side, cloud decks, an atmosphere shell, true scale.

## Where it is better than us: the camera

The whole look comes from treating the screen as a film camera. Each frame:

1. **Colour pass** into a buffer.
2. **Lens ghosts and halo** (Chapman): threshold the bright parts, mirror them through the centre of the screen, add a ring-shaped halo with chromatic offset, blur at half resolution.
3. **God rays** (GPU Gems 3): render a second, low-resolution pass where the sun is a bright sphere and everything else is black (using camera layers), then blur it radially from the sun's screen position (100 samples, decay 0.96). Add the result on top. Rays only appear where the Earth's edge cuts across the sun.
4. **Main chain:** anti-aliasing by supersampling → bloom → light blur (driven up to soften cuts between shots) → film grain and scan lines → lens blend (ghosts × a lens-dirt texture + a starburst that **turns as the camera turns**) → colour grade (blue gamma lifted to 1.32 for a cold space look) → heavy vignette → god rays added → a fade-to-black pass for scene changes.

## Where it is better than us: telling a story

- Eleven scripted camera shots on a GreenSock timeline, with a progress bar.
- Lines of text timed to the music, fading in and out.
- Music and ambience tracks, a mute button and subtitles.
- A screenshot button that saves the canvas as a JPEG.
- A blur and fade to black between shots, done in post-processing.

## Candidates for version 2

In order of payoff for effort:

1. **Camera look pass.** Sun god rays where planets and ships cross the sun, lens ghosts and a halo, a lens-dirt texture and a starburst that turns with the camera. Make our own dirt and starburst textures by script. Fits our current `EffectComposer` (WebGL). The occlusion pass needs care with our log-depth patch and true-scale cameras.
2. **Film finish.** Light grain, vignette and a colour grade per place: cold blue for open space, warm for Ceres, green for Medina. Can be one pass.
3. **Cinematic tour mode.** Scripted shot lists per system (Sol arrival, Saturn rings, the ring gate, docking at Tycho) with timed captions and fades. Could become the start-screen background and a source for article pictures. Doesn't need GreenSock: a small keyframe timeline of our own will do.
4. **Lightning on the night side.** *Done 2026-11-17 (`src/lightning.ts`).* Flipbook flashes on cloud decks, seen from orbit. Cheap and very alive. We'd draw our own sprite sheet by script.
5. **Photo mode.** Hide the HUD, pause, adjust exposure and depth of field, save a PNG. Pairs with the roadmap's path-tracer idea.

Things not to copy: Phong materials, the skybox (our star field is better), flat-image close-ups.

## Next demos to study

To compare with this one: something with physical atmosphere scattering seen from orbit, volumetric clouds, and a large-scale space scene with good lighting.
