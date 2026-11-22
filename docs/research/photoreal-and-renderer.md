# Photoreal bar and renderer decision (E1.1, E1.2, E4.1)

Date: 2026-11-22. three.js r187, bun, TypeScript. Research note for the decision gate in `docs/BACKLOG.md` E1.2.d. Nothing in the game was changed.

**Evidence labels.** *Verified* means fetched or measured this session from the source named. *Spike* means a figure from `docs/WEBGPU-SPIKE.md` on branch `webgpu-spike` (headless Chrome 159, Apple M5, 1,400 x 800 unless stated). *Estimate* is my own judgement, mainly person-days. *Unverified* means from memory or a page I could not fetch. Person-day figures are all estimates.

## 0. Short answer

- **Stay on WebGL (three r187).** Take reversed-Z first, then spend the effort on content and a handful of renderer-neutral shaders. Nothing found makes a replatform necessary to reach the bar in section 1.
- **The one real reason to leave WebGL is path-traced stills, and that does not need a migration.** three-gpu-pathtracer has deprecated its WebGL tracer and now needs WebGPU (verified). A separate WebGPU "studio" page that loads the same GLBs can make film-grade stills while the game stays on WebGL.
- **Replatforming to an engine loses more than it gains in the browser.** Unity's HDRP does not run on the web build, Godot's web export is WebGL 2 only, and Unreal's web target is unverified here and probably absent. A native build is the only route to a higher ceiling, and it costs months.
- **Gate for David:** approve the plan in section 4, and set the triggers that would reopen a WebGPU or native move.

## 1. What "photoreal" means here (E1.1)

### 1.1 Definition

Photoreal for this project means: **from a fixed camera and exposure, the game frame and a reference photograph agree on the physical cues a viewer reads first, and an informed viewer cannot point to the cue that is wrong.** It does not mean pixel match. It does not mean path-traced realtime. It is judged per target, with the checklist beside each one below, using side-by-side frames kept in `docs/studies/` (E1.1.c).

Two bars, because they cost very different amounts:

| Bar | Where | How it is rendered | Cost |
|---|---|---|---|
| **Live** | Flight, walking, tours | Realtime raster, the current game renderer | Fixed by the frame budget in 1.3 |
| **Still** | Photo mode (P) | Same scene, more time per frame: supersampling, accumulation, or path tracing | Seconds per image, no frame budget |

Sorting each target into one of these is the most useful thing this note does for the plan. Several cues below (soft ambient occlusion in a dock, bounce light in a hull recess, sun glint on foil) are cheap to approximate live and exact in a still.

### 1.2 Ten reference targets

Real photographs first. IDs marked *verified* came back from `images-api.nasa.gov` this session. NASA media is generally free to use, but ESA-originated frames (Rosetta OSIRIS) carry ESA's licence, so check each at the source before anything is shipped or put in `CREDITS.md`. Film stills are copyrighted: keep them out of the repo and use them only for private side-by-side judging.

| # | Reference | What a viewer reads | What it demands technically | Live or still |
|---|---|---|---|---|
| 1 | **Whole Earth, Sun behind the camera.** Apollo 17, `as17-148-22727` (verified) | Cloud texture and brightness, ocean darker and bluer than land, thin blue limb, no stars in frame | Cloud layer separate from the surface with its own shading; ocean specular but no glint (Sun is behind); Rayleigh-blue limb that is thin (the lit atmosphere is under 2% of the radius); exposure set for a sunlit disc, so no visible stars | Live |
| 2 | **Orbital sunset limb.** ISS, `iss023e057948` (verified: "edge-on limb view" over the Indian Ocean) | Layered bands from orange at the horizon to blue, airglow line, dark ground below, clouds lit from beneath | Multiple-scattering atmosphere that reddens along long paths (the current raymarch is a start; a precomputed model such as Bruneton's is the proper one); terminator softness; cloud shadowing in low sun; bloom on the thin bright band | Live |
| 3 | **Earth at night from the station.** ISS, `iss035e017673` (verified: "city lights and portions of the ISS") | Warm sodium points, cities as clusters not blobs, dark ocean, faint airglow, station hull catching light | City lights as sub-pixel points with bloom, not a painted texture; no light on the cloud tops except moonlight; the hull lit only by the Earth and the Sun (earthshine) | Live |
| 4 | **Saturn backlit and ring shadow.** Cassini, `PIA08329` "In Saturn's Shadow" (verified), plus any Cassini frame of the ring shadow on the globe | Rings glow when backlit and the planet is a dark disc ringed by a bright thin atmosphere; ring shadow lies across the globe | Forward-scatter phase function on the ring particles (brightness depends on Sun angle, so it cannot be a fixed texture); ring shadow on the planet and the planet's shadow on the rings; haze ring at the limb; very dark disc against a bright ring needs HDR bloom without washing the frame | Live |
| 5 | **Hard-lit airless world.** Apollo 8 Earthrise, `as08-14-2383` (verified) | Black sky, no fill, razor shadow edges, grey regolith with strong opposition brightening, a lit Earth as the only colour | Single directional light, no ambient fill (the planned E1.5.d "sun-only" rule); earthshine as a weak second light; surface relief from displacement and normal maps; opposition surge in the Moon's material (brightens when the Sun is behind the viewer); no atmosphere at all | Live |
| 6 | **Backlit haze on a small world.** New Horizons, `PIA19931` "Pluto in Twilight" (verified) | Thin blue haze layers lit from behind around a dark disc, ridged terrain at the limb | Forward-scatter in a very thin atmosphere with distinct layers; the dark side lit only by faint light; displacement visible at the limb, which means true silhouette geometry or parallax, not just a normal map | Live |
| 7 | **Irregular small body in raw sunlight.** Rosetta OSIRIS, e.g. `PIA19040` "Dark Side of Comet 67P" (verified exists; ESA-originated, so check the licence) | A non-spherical body, hard terminator, rough boulder-scale shading, deep black shadows, near-black albedo | A real shape model (E1.3.e), low albedo (about 0.05), a self-shadowing terminator on displacement geometry, shadow maps with enough resolution at true scale | Live |
| 8 | **The Sun.** SDO visible-light image (unverified ID: pick from sdo.gsfc.nasa.gov) | Limb darkening, granulation, sunspots, no glare disc in a good exposure | Limb-darkened emissive disc, granulation texture, a corona that fades out smoothly; an exposure model, because the Sun is 5 to 6 stops brighter than a lit planet and must clip or be tamed deliberately | Live |
| 9 | **Real spacecraft hull in sunlight.** An ISS or Shuttle-era exterior photo (unverified ID: pick one at images.nasa.gov; I could not find a clean match through the search API) | Specular streaks on foil and radiators, panel seams, thermal blanket creases, soot and streaks at thrusters, hard black shadows with a faint blue earthshine fill | Hull material: anisotropic or clearcoat metal, wrinkled foil normal maps, panel-line relief, grime streaks driven by geometry; sun glint reading as a small bright specular lobe; earthshine as a coloured low-level fill; micro-detail that survives at 5 m distance | Live (material), still (the glint and bounce detail) |
| 10 | **A film-grade ship hero shot.** The Expanse (the Rocinante, Donnager, a station exterior) and a classic of the genre such as 2001 or Interstellar for the lighting; frames chosen by David, kept private (unverified: no frame chosen yet) | One hard key light, deep shadow, small lit detail, believable scale from tiny details and dust, a lens that adds flare and a little grain | Everything in target 9, plus: lens flare tied to the real Sun, depth of field and motion blur at close range (E1.4.h), consistent scale cues (windows, rivets, human-height details), plume and RCS effects. This is where "film look" (the existing grade) meets materials | Live for the grade, still for the finish |

**Not chosen, deliberately.** Mars and Jupiter. Both are covered by cues already in 1 and 4 (a thin atmosphere limb, banding, storm shading). Add them as targets 11 and 12 after the first comparison round, not before.

**Interiors.** None of the ten is an interior. The reference there is a real photograph of the real kind of place (ISS Unity node for corridors, a hospital or shipyard for a dock), and the cue to test is bounce light and contact shadow. The spike showed GTAO barely changes Tycho at default settings (1 ms, difference "slight"), so the interior bar is lower priority than the exterior one and is mostly a materials and lighting-art problem.

### 1.3 Realistic performance budget

Figures labelled *spike* are measured costs, not targets.

**What the spike measured (GPU frame cost, post chain on):**

| Scene | Classic WebGL, log depth (today) | Classic WebGL, reversed-Z | WebGPU, reversed-Z |
|---|---|---|---|
| Sol, 24 ships, 1,400 x 800 | 1.64 ms | 1.39 ms | 1.48 ms |
| Sol low orbit, Retina 2,800 x 1,600 | 4.97 ms | 4.00 ms | 1.57 ms |
| Tycho, 1,400 x 800 | 14.08 ms | 4.72 ms | 5.42 ms |
| Tycho, Retina | 18.30 ms | 11.24 ms | 6.93 ms |

**Proposed budget (a proposal for David to accept or change):**

| Machine | Target | GPU budget | What it implies |
|---|---|---|---|
| David's Mac (Apple Silicon, Retina) | 60 fps | 12 ms of GPU, leaving about 4 ms for the game's JS | Open space has room: the Retina Sol figures are 1.6 to 5 ms, so there are 7 ms spare for a better atmosphere, god rays, depth of field and flares. Interiors do not: today's Tycho at Retina is 18 ms. Reversed-Z brings it to 11 ms, which is already the whole budget. So interiors need either a render-scale cap (about 0.8 at Retina) or WebGPU, and any AO added there must be paid for the same way |
| A mid laptop (integrated GPU) | 30 fps floor at 1080p, 1x pixel ratio | 25 ms | **Unmeasured. No such machine has been tested.** I assume roughly one quarter of the M5's throughput. A quality tier switch is needed: AO off, half-resolution bloom and rays, no depth of field |
| Download | First view under about 30 MB, rest lazy-loaded | not applicable | `dist/` is 116 MB today (measured: `du -sh dist`; the roadmap quoted 97 MB). Raw `assets/` is 505 MB. KTX2 and lazy loading by system (E1.7.b, E1.7.c) are the lever. Not a renderer question |
| Stills | None | Seconds to minutes per image | Offloads the cues that are expensive live (path-traced bounce light, soft shadows, glint) |

Reference costs for screen-space AO, so it can be priced: N8AO states 0.70 ms (Medium) and 2.0 ms (Ultra) at 1080p on an Apple M5 Max (verified from its README, 2.1 notes). The spike's GTAO node cost about 1 ms in Tycho. Neither number is for a mid laptop.

## 2. Renderer options (E1.2, E4.1)

### 2.1 What the spike already settled

(From `docs/WEBGPU-SPIKE.md`, spike measurements. I did not re-run it.)

- True-scale depth passes on WebGPU with reversed-Z, 0 wrong pixels at 20 m, 5 km and low Earth orbit. It also passes on three's WebGL 2 fallback, but only where `EXT_clip_control` exists (Chrome has it; Safari's WebGL was not tested).
- WebGPU's matrix maths runs in 32 bits on the card, so the camera's real position of about 1,000 units from the Sun makes the ship vanish. Fix: `renderer.highPrecision = true` (documented as incompatible with instanced and skinned meshes) or a floating origin. The game already has a floating origin (BACKLOG baseline), so this is partly in hand.
- Parity migration: **6 to 9 working days** (spike estimate), mostly the light probes (2 to 3 days) and the lens and ray passes (1 to 2).
- `WebGPURenderer` costs more JavaScript per draw (Tycho 5.1 ms against 3.0 ms). It wins where pixels dominate (Retina, 1.6 to 2.5 times faster than classic with the same depth method). Safari was not tested; headless Chrome only.
- Classic WebGL with reversed-Z is the fastest thing measured in Tycho at normal resolution. Most of the headline speed-up is the depth method, which WebGL can have.

### 2.2 What I checked this session

| Claim | Result | Source |
|---|---|---|
| three r187 is current | `latest` on npm is 0.187.0, published 2026-10-30 | npm registry |
| WebGPU browser reach | 86.83% full plus 3.32% partial. Chrome and Edge full; Safari and Firefox "partial": enabled by default only on macOS 26 Tahoe or later (Safari), and Windows plus macOS 26 on Apple Silicon (Firefox). iOS Safari 26 and up full | caniuse data file, fetched today |
| WebGL 2 reach | 97.29% | caniuse data file |
| three-gpu-pathtracer | v0.0.28 (2026-11-02). **`WebGLPathTracer` deprecated since v0.0.25; the project "requires WebGPU"**; only MeshStandardMaterial and MeshPhysicalMaterial are traced; the WebGPU tracer is marked "not yet stable"; peer `three >= 0.187.0`, MIT | its README and release notes |
| N8AO | v2.1.0, three `>=0.137`, requires WebGL 2, "not yet compatible with WebGPU"; works with logarithmic depth and orthographic cameras; 2.1 fixed half-resolution with reversed depth buffers; npm lists ISC, the GitHub repo lists CC0 (a discrepancy: confirm the licence file before crediting) | README, npm |
| `postprocessing` (pmndrs) | 6.39.6, Zlib, **peer `three >= 0.168 < 0.188`**. N8AO and the Takram atmosphere package both need it as a peer, so adopting either pins three at 0.187 until that range moves | npm |
| realism-effects (SSGI/SSR for WebGL) | MIT, last npm release 2023-05-12, last push 2024-02-04. Effectively dormant | npm, GitHub |
| three r187 has TSL post nodes | `GTAONode`, `SSGINode`, `SSRNode`, `TRAANode`, `DepthOfFieldNode`, `MotionBlur`, `GodraysNode`, `LensflareNode`, `lensDirt`, `BloomNode`, `RecurrentDenoiseNode` in `examples/jsm/tsl/display`; and `webgpu_renderer_pathtracer`, `webgpu_postprocessing_ssgi`, `webgpu_sky` examples | GitHub contents API at tag r187 |
| WebGL equivalents in r187 examples | GTAO, SSAO, SSR, DoF, god rays, lens flares, contact shadows all exist as `webgl_*` examples | GitHub contents API at tag r187 |
| Takram atmosphere | `@takram/three-atmosphere` 0.19.1, MIT, Bruneton precomputed scattering, "from space it represents Earth's atmosphere", GLSL for WebGL plus a WebGPU/TSL document. Peer deps list React and R3F, but the README has a "Vanilla Three.js" section. Built for Earth; other planets need their own parameters | README, npm |
| Babylon.js | 9.37.1, Apache-2.0. Core exposes `useReverseDepthBuffer`, `useLargeWorldRendering` and `floatingOriginMode`; has SSR, SSAO2, TAA, depth of field, motion blur, IBL shadows, reflective shadow map GI; `@babylonjs/addons` 9.37.1 contains an `atmosphere` module. No path tracer found in the package | tarballs unpacked and listed |
| Unity web | Unity 6 manual feature table: WebGL **Built-in yes, URP yes, HDRP no**. Needs WebGL 2 and WebAssembly; no managed threads; Unity Personal free to US$200,000 revenue and funding, Pro US$2,310 per seat per year (2026) | docs.unity3d.com and unity.com, fetched today |
| Godot web | Godot 4 web export is WebGL 2 with the Compatibility renderer only; Forward+ and Mobile not available; "currently does not support WebGPU"; C# projects cannot export to web; WebGPU proposal #6646 still open; MIT. Latest 4.7.2 (2026-08-18). Double-precision large worlds need a custom build with `precision=double` | godot-docs source, GitHub |
| Tauri | Apache-2.0 per the GitHub API (my memory says dual Apache/MIT, unconfirmed), actively developed | GitHub API |
| Unreal | **Unverified.** Epic's pages returned 403 to curl. From memory: HTML5 target was removed with UE5, a third-party WebAssembly route exists, and the licence is royalty-free for non-commercial hobby use under Epic's terms. Re-check before it matters | n/a |

### 2.3 Options compared

Effort is in person-days of focused work, my estimate, for "the game as it is today, looking the same, running and tested". The photoreal gains then come on top. "Survives" refers to the codebase at 11.5k lines of TypeScript (`src/`), plus the Blender pipeline and assets.

| Option | Licence and cost | What survives | True scale and depth precision | Browser reach | Effort (days) | Risk |
|---|---|---|---|---|---|---|
| **A. Stay on WebGL, add libraries** (N8AO or three's GTAO pass, three's WebGL examples, Takram atmosphere, reversed-Z) | MIT, ISC or CC0, Zlib, MIT. Free | Everything | Log depth works today. Reversed-Z with a float depth target gave 0 wrong pixels and cut Tycho from 14.1 to 4.7 ms (spike). Needs a real-game check, including Safari. A canvas cannot have a float depth buffer, so any pass drawn straight to the screen needs the same treatment | WebGL 2: 97.3% | Reversed-Z 1. AO pass 0.5 to 1. Earth atmosphere upgrade 2 to 3. Other shaders 2 | Low. Main risk is the `postprocessing` peer cap holding three at r187. Realism-effects is dormant, so do not depend on it |
| **B. WebGPU with TSL** (`WebGPURenderer`) | MIT. Free | All assets, scene code, ships, interiors, people, data. The seven custom shader sites and the composer are rewritten (spike has ports for five of them) | Passes with reversed-Z; needs `highPrecision` or the floating origin; the WebGL 2 fallback needs `EXT_clip_control` or a second depth path | About 87% full plus 3% partial; Safari only on macOS 26 and up by default; falls back to WebGL 2 otherwise | 6 to 9 for parity (spike). Plus about 3 to 5 for the first new features (GTAO tuned, SSR, god rays rebuilt) | Medium. The node pipeline still changes between releases (pin the version). Probes are the biggest item and the least certain. Headless tests are Chromium-only |
| **C. Babylon.js** | Apache-2.0. Free | Blender GLBs, textures, data tables, simulation logic (`data.ts`, voyages, tour logic). **Not** the renderer, all 11.5k lines of scene code that touch three's API, the shader sites, probes, composer | Has the pieces: reverse depth, floating origin, 64-bit matrices. Unproven at this scale for this scene | Same WebGPU/WebGL 2 situation as B | 30 to 50 (a rewrite of the render-facing code: ships, interiors, people, camera, photo mode) | High. A full port to gain features three can mostly reach. Babylon has built-in SSR, SSAO2, TAA, an atmosphere addon, but no path tracer |
| **D. Unity web export** | Personal free under US$200k revenue and funding; Pro US$2,310 per seat per year | Blender GLBs, textures, data. Everything else is rewritten in C# | **HDRP, the photoreal pipeline, does not run on the web build; only Built-in and URP.** Precision in Unity is 32-bit; large worlds need a floating-origin script | WebGL 2 (desktop browsers); mobile limited; no managed threads | 60 to 90 | High. Web build is the weakest version of the engine. A download of tens of MB for the runtime alone (unverified size) |
| **E. Unreal** | Unverified; I could not read Epic's terms. Free for hobby use as far as I remember | Blender GLBs only (via Datasmith or glTF import), data | UE5 has large world coordinates (double precision) in the editor (unverified here) | Official web target: **unverified, probably none** | 60 to 100 | Very high. Web delivery is the obstacle, not the renderer |
| **F. Godot web** | MIT, free | GLBs, data | Web is Compatibility renderer, WebGL 2, **no Forward+, no WebGPU**; double-precision needs a custom export template | WebGL 2 only; Safari has "several issues" per the docs | 40 to 60 | High, for a result visually below what three already gives |
| **G. Godot native** (Forward+ with Metal, Vulkan, D3D12) | MIT, free | GLBs, data | Double-precision build (`precision=double`, custom compile) | A downloadable Mac and Windows app; no browser | 40 to 60 plus a separate web build, which would be option F or the existing three build | High. A second codebase to keep unless the web build is dropped |
| **H. Native Swift/Metal** | Free tooling; the Apple Developer team already exists | GLBs, textures, data model. Rewrite everything else | Full control: float or double on the CPU, reversed-Z, any depth scheme | Mac (and iOS with more work) only | 100+ (estimate; a full engine for this scene is months) | Very high. Highest ceiling, highest cost, one platform. The web build would stay as the "light version" the BACKLOG imagines |
| **I. Tauri shell around the existing web build** | Apache-2.0 / MIT, free | Everything | Same as the web build, since it uses the system web view | Mac and Windows app. On macOS it uses WKWebView, so WebGPU follows Safari's setting (unverified) | 2 to 4 | Low. Removes download limits and gives local texture storage; does **not** change the renderer or its ceiling |

### 2.4 Reading the table

1. **No alternative beats staying for the browser game.** Engine web exports are weaker than three.js at this exact job (Unity HDRP absent; Godot WebGL 2 only; Unreal unverified), and each costs 30 to 100 days for a first parity version.
2. **The only option that raises the ceiling is native (G or H)**, and it forks the codebase. It is justified only if the project becomes a downloadable game, which is not what BACKLOG or ROADMAP say today.
3. **WebGPU (B) is a real upgrade path but it is not an urgent one.** Its realised gain in the spike was small once reversed-Z is on WebGL. Its genuine unlocks (SSGI, compute crowds, path-traced stills, large Retina frames) are all listed in section 3 as the "wait" group, and one of them, stills, can be had without a migration.
4. **The depth work is no longer a blocker anywhere.** Reversed-Z passed on WebGPU and on classic WebGL; floating origin is already in the game. That removes the original reason to fear the choice.

## 3. Photoreal gains: renderer-neutral or not

Ordered by value for the cost, within each group. "Neutral" means the work is the same on WebGL, WebGPU and any native or engine route, or it is written so the port is trivial.

### 3.1 Do now (renderer-neutral)

| Rank | Gain | Why it is neutral | Effort (days, estimate) | Serves target |
|---|---|---|---|---|
| 1 | **Hull material and weathering pass** (panel relief, foil, streaks, pitting, trim sheets, decals, names and insignia) E1.4.b, E1.4.d | Pure content in the Blender pipeline to GLB with PBR maps. Survives every option | 5 to 10, ongoing | 9, 10 |
| 2 | **Real relief and data for bodies**: displacement and normal from elevation, true shape models for small bodies, KTX2, lazy loading (E1.3.b, E1.3.e, E1.7) | Data and pipeline, renderer-independent | 4 to 8 | 5, 6, 7 |
| 3 | **Sun-only lighting rule** with a weak earthshine and ringshine second light (E1.5.d) | A light rig, not a pipeline | 1 | 5, 9, 10 |
| 4 | **Planet shading models**: Saturn ring forward-scatter and ring-on-planet shadow, Earth ocean specular and sun glint, cloud layer shading, Sun limb darkening, opposition brightening (E1.3.c, d, f) | Custom shader maths, ports in an hour or two each (spike measured 15 min to 1.5 h per site). Write the maths as small functions to keep the port cheap | 3 to 5 | 1, 3, 4, 8 |
| 5 | **Reversed-Z on WebGL.** Shelved 2026-11-21; E1.2.c says reopen only if it blocks a feature | Not a photoreal feature itself, but it **buys the frame budget the others need**: Tycho 14.1 to 4.7 ms. It is also step one of any WebGPU move (spike). My view: it now meets the E1.2.c test indirectly, because without it there is no budget for AO in interiors | 1 | all interiors |
| 6 | **Atmosphere upgrade** to a precomputed multiple-scattering model for Earth, tuned to targets 1 and 2 | The maths and the precomputed tables carry to TSL (Takram documents both). First pass on WebGL | 2 to 3 | 1, 2 |
| 7 | **A photo-mode finish**: supersampling or frame accumulation for stills, bigger bloom, film grain at export size | Uses the renderer you have; no dependence | 1 to 2 | all stills |
| 8 | **Comparison harness** (E1.1.c): fixed camera, fixed exposure, side-by-side output | Test tooling only | 1 to 2 | all |

### 3.2 Cheap to do now but throwaway on migration (decide per feature)

| Gain | WebGL now | On a migration |
|---|---|---|
| Ambient occlusion and contact shadows (E1.5.b) | N8AO (0.7 ms at 1080p Medium on M5 Max, per its README) or three's `GTAOPass`. About 0.5 to 1 day | Replaced by `GTAONode`, 0.5 to 1 day. Low waste. Note the `postprocessing` peer cap on three |
| Depth of field, motion blur, adaptive exposure (E1.4.h) | three's WebGL passes plus own exposure code in `look.ts` | The post chain is rewritten as a node graph (spike: about 1 hour for bloom and finish) |
| God rays and lens ghosts | Already built in `look.ts` | Spike: 1 to 1.5 days to port, because `BloomNode` keeps its blur levels private |

### 3.3 Wait (renderer-dependent)

| Gain | Why it waits | Cheapest honest route |
|---|---|---|
| **Path-traced stills** (E1.5.c) | three-gpu-pathtracer is WebGPU only now (verified), traces only Standard and Physical materials (so no custom atmosphere, ring or night-light shaders), and is marked unstable. Its behaviour at true scale is **unknown** and would need a local, rescaled scene | A separate WebGPU page loading the same GLBs and interior builders with stand-in materials, for ships, stations and interiors only. **3 to 5 days** for a proof (estimate). Planets and atmosphere stay raster |
| **Screen-space GI and reflections** (SSGI, SSR) | `SSGINode` and `SSRNode` exist in r187's TSL set; the WebGL option, realism-effects, is dormant since 2024. The spike did not try SSGI | Wait for a target to fail on bounce light (section 4 gate) |
| **Compute crowds and GPU-driven traffic** (1,000+ actors, E3.2.h) | The spike did not attempt it, and found `WebGPURenderer` costs more JS per draw | Decide when scenarios need more than the current crowd counts, measured |
| **TRAA, temporal antialiasing and denoise** | A WebGPU-side post chain | With the migration if it happens |
| **Per-interior HDR / baked probe replacement** | Probes were the costliest port in the spike (2 to 3 days, high risk) and `LightProbeGridWebGL` is WebGL-only | Keep on WebGL; reassess if SSGI replaces the need for them |

## 4. Recommendation and decision gate

### 4.1 Recommendation

**Stay on WebGL with three r187.** Execute section 3.1 in the ranked order, starting with reversed-Z (it pays for the rest) and the comparison harness (it tells us which targets still fail). In parallel, build the **WebGPU stills lab** (3.3, first row) as a bounded experiment. Do not start a migration, an engine port or a native rewrite now.

Why:
- The limit on realism is content and shading, not the renderer. Targets 1 to 8 (all planets, moons, small bodies, the Sun) are reachable with shaders and data on WebGL.
- The expensive and uncertain parts (probes, composer, crowds) are the same cost on any renderer, and the spike showed WebGPU is not faster at ordinary resolution.
- The one capability WebGL cannot give (path tracing) can be isolated in a page of its own, so the decision does not have to be taken for the whole game.
- Every other route costs 30 to 100 days and loses something verified (HDRP on web, WebGPU in Godot, the browser itself).

### 4.2 Decision gate for David (E1.2.d)

Choose one:

1. **Stay on WebGL (recommended).** Approve 3.1, the reversed-Z reopen (E1.2.c), and the stills lab experiment. Reopen WebGPU only on a trigger below.
2. **Migrate to WebGPU now** (6 to 9 days for parity, spike estimate). I do not recommend it: no measured benefit at normal resolution, and it freezes new feature work for the duration.
3. **Move platform** (native or engine). Needs David to say the project is now a downloadable game; then G or H, with the web build kept as the light version.

**Triggers that reopen the question** (write them into BACKLOG if accepted):

- A target in 1.2 still fails after the 3.1 work, and the failing cue is bounce light, soft indirect shading or screen-space reflections (the things SSGI or path tracing would supply).
- The stills lab shows path-traced ships or interiors clearly beyond the live raster, **and** David wants those in the live game, not only in stills.
- A measured need for more than the current crowd and traffic counts that batching cannot meet.
- `postprocessing`, N8AO or the Takram package stop tracking three, so staying on WebGL forces an old three.js.
- Safari on macOS 26 or later is the way David's audience actually opens the game and WebGPU is observed to be stable there (the spike did not test Safari).

**Open items I could not settle (all unverified):**

- Reversed-Z behaviour in Safari's WebGL (the `EXT_clip_control` question) and in the real game with instanced and skinned meshes.
- WebGPU inside a Tauri WKWebView.
- Unreal web support and its licence terms (Epic's site refused automated fetches).
- Behaviour of three-gpu-pathtracer at true scale, with float32 BVHs at 1,000-unit coordinates.
- Any measurement on a mid laptop.
- N8AO's licence (ISC on npm, CC0 on GitHub).
- The Sun and ISS-hull reference image IDs for targets 8 and 9; the film frames for target 10.
- Person-day figures for options C to H are rough estimates, not measurements.

## 5. Suggested BACKLOG edits (not applied)

- E1.1.a: use the table in 1.2 for the ten targets; file the final images under `docs/studies/`.
- E1.1.b: adopt the budget in 1.3 once David agrees the figures.
- E1.2.a to E1.2.d: answered by sections 2 to 4.
- E1.2.c: reopen reversed-Z (see 3.1 rank 5).
- E1.5.c: change to "path-traced stills in a separate WebGPU page" (3.3).
- New task: comparison harness first, because it decides which gaps matter.
