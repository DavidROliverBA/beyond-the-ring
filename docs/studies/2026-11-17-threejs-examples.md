# Study: six three.js examples

Studied 2026-11-17. All are official three.js examples (MIT). Our installed three.js is r187, which already includes everything below except the third-party libraries named in section 2.

| Example | What it teaches | Worth it for v2? |
|---|---|---|
| [lightprobes_sponza](https://threejs.org/examples/#webgl_lightprobes_sponza) | Bounce light baked at runtime into a grid of light probes | **Yes, first.** Biggest realism gain for interiors, no new assets |
| [loader_3dtiles](https://threejs.org/examples/#webgl_loader_3dtiles) | Physical sky and atmosphere, volumetric clouds, streamed real terrain | Atmosphere: **yes, as a trial**. Real terrain: parked (keys and terms) |
| [loader_gltf](https://threejs.org/examples/#webgl_loader_gltf) | `compileAsync` before showing a model; framing the camera to fit | **Yes, small.** Removes the stutter when docking and entering rooms |
| [loader_texture_ultrahdr](https://threejs.org/examples/#webgl_loader_texture_ultrahdr) | HDR environments as small JPEGs (gain maps) | **Yes.** The cheap route to the per-room lighting in roadmap step 2 |
| [panorama_cube](https://threejs.org/examples/#webgl_panorama_cube) | A cube skybox from one strip image | Minor: window views and a 360° photo export |
| [watch](https://threejs.org/examples/#webgl_watch) | A product shot: HDR lighting, physical glass, TAA, an eased camera intro, hands driven by the real clock | **Yes, as a ship viewer** in Tycho's bay |

## 1. Light probe grid (lightprobes_sponza)

`LightProbeGridWebGL` (in `three/addons/lighting/`) places a 3D grid of probes in a room. Each probe renders a tiny 32 px cubemap of what it sees and stores it as irradiance. Every material in the grid then picks up indirect light from the nearest probes. The example bakes 4 probes per frame, so the page never freezes, and runs a second pass for a second bounce.

What it would give us:
- Daylight in the Concourse bouncing off white walls onto the street and the people.
- Neon in Tycho and Ceres spilling colour onto floors and walls nearby.
- Dark corners that are actually dark, so less need for the fake wall-base shading.

How to apply it:
- One grid per room, sized from the room bounds already in `Kit`. A baker spreads the work over the first second after docking.
- Bake once per interior, re-bake only if lights change.
- `Kit` already knows every room, so this is mostly plumbing.

Risks:
- Check it with our log-depth shader patch. It should be fine because interiors are metre-scale scenes, but the patch is global.
- Leaks through thin walls. Use probe spacing of about 2 m and test the Tycho corridors.

This partly replaces roadmap step 4 (Blender baked lightmaps), at a fraction of the effort. `LightMapper.js` and `DynamicLighting.js` are also in r187 and worth a look afterwards.

## 2. Physical atmosphere and clouds (loader_3dtiles)

The example combines Takram's `three-geospatial` packages (MIT):
- `three-atmosphere`: precomputed scattering (Bruneton), sky, aerial perspective, sun and sky light.
- `three-clouds`: volumetric clouds with shadows.
- Lens flare and dithering effects.
- On top of all that, Cesium's 3D Tiles streaming real terrain.

It also uses `renderer.setEffects()` and `outputBufferType: HalfFloatType`, the new built-in post-processing hook in WebGLRenderer.

For us:
- **Atmosphere seen from orbit** for Earth, Mars and Titan: a proper blue limb, a red sunset terminator, haze. A big step up from our fresnel shell. A spike is needed first: the library works in metres in an Earth-centred frame, and our units are 1/1000 AU with log depth. Translate per planet with a world-to-planet matrix and scale the atmosphere constants for Mars and Titan.
- **Volumetric clouds**: only close to a planet. Later.
- **3D Tiles real terrain**: parked. It needs an API key (Cesium ion or Google), and the terms limit caching and redistribution. That clashes with "free, public repo". Cesium ion's Mars and Moon tiles are worth a second look if a "land on Mars" feature ever comes up.

## 3. Load without stutter (loader_gltf)

`await renderer.compileAsync(model, camera, scene)` compiles shaders off the critical path before the model is added. We currently compile on first draw, which is why the frame hitches when you dock or step through a door. Apply it:
- to each interior scene on `buildInterior` (compile the whole scene before switching),
- to ship models at start-up.

Also from this example: fit the camera to a bounding box. Useful for the ship viewer below.

## 4. UltraHDR environments (loader_texture_ultrahdr)

`UltraHDRLoader` reads JPEGs that carry an HDR gain map. A 2k environment is a few hundred KB instead of several MB as `.hdr`. That makes per-place environment lighting affordable:
- a hangar HDRI for Tycho's bay,
- a warm market one for Ceres,
- a daylight one for the Concourse.

Poly Haven HDRIs are CC0; convert with Google's `ultrahdr_app` or similar, and credit them in `CREDITS.md`. Even better for space scenes, render our own environment from the scene with `CubeCamera` and save it.

## 5. Cube panoramas (panorama_cube)

A simple six-tile skybox from one strip image. Small uses:
- **Window views** in interiors: a pre-rendered cube of Ceres' surface or the Tycho yard behind a window plane, instead of painted backdrops.
- **360° photo mode**: render a `CubeCamera` from where the player stands and export the strip, or an equirectangular image for a 360 viewer.

## 6. Hero object (watch)

A product-shot recipe:
- an HDR environment with `backgroundBlurriness` for a soft studio backdrop,
- `MeshPhysicalMaterial` glass (clearcoat, iridescence, additive) over metal,
- `TAARenderPass` for a crisp still,
- a soft directional shadow (`shadow.radius`),
- an eased camera fly-in (tween) before handing over to orbit controls,
- hands rotated from `new Date()` every frame.

For us:
- **Ship viewer**: from Tycho's bay or the start screen, orbit the Rocinante (or any Blender model) under a hangar HDRI with TAA and a fly-in. Doubles as a showcase for the article and the README.
- **Physical glass** for cockpit canopies, station windows and helmet visors.
- **Live clocks**: station screens and the HUD could show Ceres local time, or ship time, from the real clock.

## Suggested order, merged with the earlier studies

1. ~~Skinned people~~ done 2026-11-17, in every interior.
2. ~~`compileAsync` when docking and at start-up~~ done 2026-11-17 (`warm()` in `src/main.ts`): the 175 ms freeze on first turning round in Ceres is gone; the work now happens behind the docking fade.
3. Light probe grid in interiors, starting with the Concourse.
4. UltraHDR environments per place.
5. ~~Camera look pass~~ done 2026-11-17 (`src/look.ts`): quarter-resolution god rays and lens ghosts from the bloom's bright image, dirt and a turning starburst, per-place grade, vignette, grain; about 1 ms a frame.
6. ~~Ship viewer~~ done 2026-11-19 as inspect mode (I): orbit and zoom round whatever you aim at, under the scene's own lighting. Physical glass and TAA not done.
7. ~~Spike: Takram atmosphere for Earth at true scale.~~ Done differently 2026-11-17: our own per-pixel single-scattering shader on the existing shell (O'Neil, GPU Gems 2 ch. 16), in planet units so true scale is no problem, ~1 ms a frame. Takram's library was skipped: it needs the pmndrs postprocessing pipeline and metre-scale ECEF coordinates.
