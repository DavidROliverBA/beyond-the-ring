# Roadmap

Ordered plan for Beyond the Ring. Written 2026-11-15 from research (sources at the end). Constraints: free tools and services only, no engine change, copyright acknowledged in `CREDITS.md`, unofficial and non-commercial.

## 1. WebGPU: when, and is it worth it?

**Decision (2026-11-15): do the spike test only, and last, after everything else in the order below. Migrate only if the go/no-go gate passes.** Today the limit on realism is content (textures, lighting, models), not the renderer. WebGPU is a renderer change, and it costs this project more than most because of the true-scale depth work.

### Pros

| Benefit | How real is it here |
|---|---|
| Reach: WebGPU is now in Chrome, Edge, Firefox (Windows, Mac ARM) and Safari 26. About 84% of page views have full support ([Can I Use via enterno](https://enterno.io/en/s/research-webgpu-adoption-browsers-2026)). | Real, but irrelevant to a personal project on one Mac. |
| `WebGPURenderer` has an automatic WebGL 2 fallback, so unsupported browsers still run. | Real. Compute features don't work on the fallback. |
| New post-processing stack (TSL nodes, MRT, automatic pass merging) with GTAO and screen-space effects in the examples. | Real for ambient occlusion and screen-space GI/reflections, but the same effects exist for WebGL (realism-effects, N8AO), at lower quality. |
| Compute shaders: GPU crowds, GPU particles, GPU-driven culling. | The real prize for 1,000+ ships and 500+ people. Instanced skinning and impostors work in WebGL too, so it's an optimisation, not an enabler. |
| Lower CPU draw-call cost, bundles, storage buffers. | Plausible for the traffic and interiors. Not measured. |
| Direction of travel: new three.js features land there first. | Real. WebGL is in maintenance. |

### Cons

| Cost | How real is it here |
|---|---|
| **Custom GLSL must be rewritten in TSL.** This project has 7 custom shader sites (the log-depth patch, ring shadow, hologram adverts, glints, dust and others). | Large and certain. `EffectComposer` and `ShaderChunk` patches do not carry over. |
| **The log-depth patch is the foundation of true scale.** It patches `ShaderChunk.logdepthbuf_vertex`, a WebGL-only mechanism. | The biggest risk. Metre-sized ships beside 4.65-unit suns need a depth strategy that works on WebGPU (reversed-Z float depth, or per-object logarithmic depth in TSL). Unproven for this scale. |
| `EffectComposer` is not supported. Bloom and any pass must move to the new pipeline. | Medium. |
| Performance gains are not established. Forum reports show equal or worse speed after a naive swap, especially on the WebGL fallback ([thread](https://discourse.threejs.org/t/why-webgpurenderer-performance-significantly-lower-than-webglrenderer/77629)). | Real. The headline "30–50%" claims are unsourced. |
| Maturity and API churn: TSL and the node pipeline are still changing between releases (e.g. r183 render pipeline). | Real. We would pin the three.js version. |
| Browser quirks: Firefox on Intel Mac, Linux and Android is partial; Safari storage-buffer limits reported. | Low for one Mac, higher if published. |
| Testing: headless Playwright WebGPU support is patchy, so our automated checks get harder. | Medium. |

### The real benefit, honestly

For a personal project, the realistic gains are (1) a cleaner path to screen-space GI and ambient occlusion, (2) GPU-driven crowds and traffic at larger numbers, and (3) not being left on a maintenance-only renderer. None of these is needed to reach the next quality level, which comes from step 1 to 5 below.

### The best time

Do it **after** the PBR, baked-lighting and hero-asset work, because:
- Standard PBR materials (`MeshStandardMaterial`, `MeshPhysicalMaterial`) port automatically, so that content work isn't wasted.
- Only the custom shaders need rewriting, and the later we do it, the fewer new ones we'll have written.
- By then we'll know whether performance or the screen-space effects are the real limit.

### Go/no-go spike (1–2 days, on a branch)

1. Prove depth: render the Rocinante at 20 m beside Earth and the Sun on `WebGPURenderer` with no depth artefacts. **If this fails, stop and stay on WebGL.**
2. Port the 7 custom shader sites to TSL.
3. Benchmark Sol at Earth orbit, Tycho and Medina against WebGL at the same camera positions.
4. Go only if the depth test passes and at least one of the following holds: (a) frame rate is at least as good on both paths, (b) GTAO or SSGI visibly improves interiors, (c) compute crowds hit 1,000+ people at 60 fps.

## 2. Ordered work list

Each step is a shippable change. Steps may be split into smaller commits.

### Phase A: photorealism on the current renderer (WebGL)

**Status 2026-11-15:** interiors already use ambientCG PBR scans (colour, normal, roughness) and an environment map, so step 1 was largely in place. Done since: fixed a hologram-shader error that had broken interior rendering , and added a stand-in for step 3 (wall-base and ceiling-edge shade, plus contact shadows under props and people). Screen-space AO is not possible with the current log-depth renderer, which is another cost of the WebGPU question. Not started: steps 2 (per-room environments, atmosphere), 4 to 11.

1. **PBR material pipeline.** Real texture sets (colour, normal, roughness, ambient occlusion) from ambientCG and Poly Haven (confirm Poly Haven's licence page and add to `CREDITS.md`). KTX2 compression. Convert interior and ship materials to `MeshPhysicalMaterial` where it helps (wet floors, glass, clearcoat paint). Tune the tone-mapping curve.
2. **Image-based lighting.** A small HDR environment per interior and per space scene, so metals reflect something. Sun-only lighting in open space (hard light, deep shadow, no fill). Atmosphere shader for planets and a night side with city lights.
3. **Ambient occlusion and contact shadows.** Runtime AO first (cheap trial of N8AO or realism-effects). Bake corner AO for the static parts of interiors.
4. **Baked interior lighting.** Move interior layouts into Blender (kit exists), bake lighting with Cycles into lightmaps, export GLB. Keep runtime lights only for neon and signs. This is a rebuild of the interiors from generated code to authored assets, so do one room as a trial (a Tycho corridor) before committing the rest.
5. **Hero ships and stations.** Hull panels, normal and roughness maps, weathering, windows with emissive interiors. Start with the Rocinante, Donnager and docked ships. Update the in-code fallback `corvette()` in `src/ships.ts` (still the old shape).
6. **Photo mode.** *Done 2026-11-17:* P freezes time and hides the HUD, the mouse still looks around, [ and ] set exposure, Enter saves a PNG; works in flight and on foot. Path-traced stills (`three-gpu-pathtracer`) not attempted: untested at true scale and the log-depth patch is WebGL-shader specific.

**Step 5 status 2026-11-17 (branch `hero-ships`):** first pass done for every Blender-built ship, with extra work on the Rocinante, the Donnager, your own ship (the one parked in the docking bays), the Canterbury-type hauler and Tycho. All ships now share a hull texture set painted by `tools/blender/hulltex.py` (seams, hatches, vents and fasteners in relief; sheen; dirt and chipped paint) in place of the scanned plates, and carry weathering in their vertex colours (`weather()` in `tools/blender/kit.py`): dirt in recesses, soot round drives and thrusters, bright scuffed edges on raised plates, stains and streaks. Windows are framed panes showing small lit rooms from a shared sheet. The hero ships gained airlocks with ladders, cabin ports, pipe runs, grilles, lit hangar and docking-bay mouths and scattered fittings. Models are packed with meshopt, so the folder shrank from 18 MB to about 8 MB despite the added detail. The fallback `corvette()` now matches the Blender Rocinante's layout. Not done: per-ship painted markings or names, landing gear, a detail pass on the dreadnought, survey ship, freighter, racer and Medina beyond the shared textures and weathering, and the rooms behind windows are flat pictures (no parallax).

**Ceres concourse (2026-11-15):** new walkable street on Ceres (`src/concourse.ts`), reached through Hydroponics: vaulted sky-panel ceiling with ribs, seven terraces of housing each side, shopfronts, planters, bikes, public screens, a plain-clothes crowd, and daylight that blends in as you walk through the door. First pass; next would be more relief on the housing, softer shadows and denser street life.

**Bounce light in the interiors (2026-11-19):** all four interiors now get indirect light from light probe grids (three.js `LightProbeGridWebGL`, see `src/probes.ts`). This covers the interior half of step 2 and the lighting part of step 4 without rebuilding the interiors in Blender, and is a partial answer to step 3 (corners are darker because the flat fill light is cut to 45% where probes are on; the painted wall-base shade is still there).
- One box of probes per room (4 to 6 m apart, one layer under 4 m ceilings, two above), so light does not leak through the thin walls. Ceres has 585 probes, Tycho 414, Medina 288, Ganymede 100.
- The probes are taken ahead of time, not in the game: `bun tools/bake-probes.ts` (needs the dev server and Playwright) writes `assets/probes/<interior>.bin`, about 100 kB for all four. Docking loads the file; nothing is baked at run time. Taking them in the browser was tried first and cost minutes of poor frame rate.
- **Rebake whenever an interior's rooms, lights or large props change.** Each file carries a fingerprint of the probe boxes; if it does not match, that interior goes without bounce light (and says so in the console) rather than show stale light. Moved props or changed lamps are not detected, so rebake after those too.
- In the game the probe light is worked out at the corners of each triangle, not for every pixel, from one shared texture per interior (our own shader, patched into three.js's in `src/probes.ts`). three.js's stock per-pixel lookup nearly halved the frame rate in the Concourse and the Ceres market; this way costs about 1 ms a frame. Walls and floors are cut into 3 m panels so they have corners to light. The patch is tied to three.js r187's shader text and warns in the console if an upgrade breaks it.
- With bounce light on, the neon room lamps are dimmer and higher, which stops most of the burnt-out heads under them, and the Concourse's fill and key are lower.
- `?nobounce` in the address turns it off, for comparing.
- Not done: per-interior HDR environments (step 2), real ambient occlusion (step 3), Blender lightmaps (step 4, probably no longer needed).

**Tried and shelved 2026-11-19: reflections captured per room.** A cube capture from each room's centre at docking (PMREM, swapped by room) in place of the studio RoomEnvironment. The market and docks looked about the same, the daylit Concourse came out darker with a purple cast in its gutter, and docking took ~0.3 s longer. Kept the studio. Worth another look once reflections can come from the baked probe data or from per-room UltraHDR maps made offline.

### Phase B: walking inside stations

**Status 2026-11-17 (branch `skinned-people`):** every person in every interior is now one shared skinned body (`tools/blender/person.py`) with idle, walk and lope clips, coloured per person in one draw call. Walkers pace two-lane loops with walking U-turns and occasional stops; the lope blend follows each station's gravity; animation runs less often with distance and only people within 25 m cast shadows. Frame rate is the same or slightly better than the old block people. Step 8's behaviours (avoidance, queueing, conversations, glancing at the player, doors) followed on 2026-11-20; impostors are still to do. Known: heads blow out directly under the strong neon room lights (a lighting issue, same on the old people).

7. **Collision and movement.** *Done 2026-11-17:* eased acceleration and stopping, sliding along walls, short hops so running can't pass through thin obstacles, people are solid. Steps, ramps and crouching wait for interiors that have them (step 10).
8. **Instanced, behaving crowds.** One shared skinned model with per-person animation state, impostors at distance. Behaviours: lane walking with avoidance, queueing at stalls, paired conversations, glancing at the player, doors in and out. *Behaviours done 2026-11-20 (branch `crowds`):* walkers look ahead about eight times a second and step round each other and round you (to their own right when meeting head-on), slow and wait if they cannot, and turn back if the wait drags on; bystanders left standing in a walker's lane are moved out of it. People within five metres turn their heads to you now and then (two extra joints under neck and head, so the clips are untouched). Bystanders near each other close up into twos and threes, face the middle and take turns speaking, with nods, a raised hand and shifting weight. Queues of two to four form at some stalls and at the Blauwe Blome bar; the front person is served and walks off, the rest shuffle up, and the one who left rejoins the back. A few bystanders in each station with doors stroll from room to room through the doorways. All of it is given to people who were already there, with a separate dice, so there is nobody extra to draw and the rooms, lights and saved probes are unchanged. Frame time measured the same as before within run-to-run noise. Code: `src/skinned.ts` (`sense`, `route`, `manner`), `src/interior.ts` (`behave`, `direct`, `plan`). Not done: impostors or a low-detail body at distance (the distance throttling stays); walkers in a U-turn only slow down, so they can still brush you; strollers walk straight lines between points and only use doors (no route-finding round furniture, so a few never find a walk); no walking in Medina's drum; queues do not buy anything.
9. **Spin-gravity physics.** Floor curving up with distance on Ceres and Medina, Coriolis drift when running, reduced gravity and longer strides near the axis. Our own design; no standard technique found. *First pass done 2026-11-20 (branch `spin-gravity`):* on Ceres, Tycho and Medina your weight now depends on which way you move. Run the way the station turns and you are heavier (shorter, quicker strides, eyes a little lower); run against it and you are lighter (long slow bounds, eyes a little higher, slower to stop and turn). In Medina's drum, where the floor moves at about 29 m/s and you run at 18, that is 2.6 times your weight one way and about a seventh the other. Each running stride also lands a little spinward, so a run along the drum or across a street is carried sideways. The location panel shows your weight in g as it changes. The sums are the real ones (`src/spin.ts`, used from `walkStep` in `src/main.ts`; each station's radius, gravity and spin direction are in the `SPIN` table in `src/interior.ts`). Two things are turned up so they can be felt: Ceres is felt as a 1.5 km wheel, not its true 470 km, and the sideways carry is shown 25 times over (truly it is millimetres a stride). `?spin=real` shows the true figures, `?spin=off` removes it all. No camera roll. Not done: floors that visibly curve on Ceres and Tycho (the rooms are flat and the saved light probes are tied to them); gravity falling with height (nowhere to climb yet: wait for stairs in step 10); things that fall or are thrown bending sideways; station people changing their stride with direction.
10. **Layout and wear.** Corridors that feed plazas, service ducts, stairs and railings, wayfinding signs, trash, clutter with purpose. Neon pass for Medina's drum and Ganymede's dome. *First pass done 2026-11-20 (branch `layout-wear`):* every interior now has wear, clutter and wayfinding, added after the rooms are furnished and peopled, with a third dice of its own, so nothing that was already there moves. All of it is written into a few merged meshes per room (one for solid things, one for things up near the ceiling, one for things that glow, one for flat stains and markings cut from a single sheet of sixteen pictures drawn by script) plus one sheet of lettering per station, so about 1,600 to 2,000 new things in Tycho and Ceres (500 to 1,200 in the dome and the drum) cost 5 to 35 more draw calls in any one view, on top of 140 to 1,400. Frame time measured with it on and off, turn about: the same within noise in Ceres and the dome, about 3 to 6% more in Tycho and at Medina's market street. Dark stains are drawn without lighting and paint with simple matt lighting, because they lie over a lot of floor. *Every room:* scuffs and grime along the foot of the walls, drips and rust under the ceiling, smudged door frames, floor worn through every doorway and down every corridor, stains, hatches, vents, notices and tags, chipped paint; in corridors an air duct, pipes and a cable tray along the ceiling; in big rooms pipes high on the walls with conduits down to junction boxes. How much of each is set per station (Tycho light, Ceres heavy, the station house clean). *Tycho:* a marked berth with warning stripes, oil and a fuel hose in the bay, catwalks with railings and ladders along both walls, crates, drums and tool carts; coloured lines on the corridor floor that lead to the bay, the bar and Operations, hanging signs at the junctions, section numbers with the spin direction on the walls; a warning box, hoses and gas bottles round the drive bell; a handrail and viewers at the gallery window. (The old corridor sign pointed the bar and Operations the wrong way; fixed.) *Ceres:* berth markings, a catwalk, drums, sacks and rails funnelling people to customs in the dock; a scanner arch, a waiting line and a desk in the customs tunnel; in the Medina a four-sided directory, signs over every way out, about twenty bins with litter, sacks and boxes by the stalls, damp under the ceiling pipes; a yellow line and rails at the tube platform edge and a route map; wet floor and hoses in Hydroponics; on the Concourse paths worn along both sides, bins by the planters and a directory every sixty metres. *Ganymede (lights kept low under the sun):* low lights down the path, a gate with strings of coloured bulbs off to the hut and the tanks, lit windows, a door lamp and a mast beacon on the hut, beacons on the tanks, small lights round the foot of the dome, a produce stand; irrigation mains with valves, row numbers on stakes, warning stripes round the pad, scorching and trodden soil, a fence, a signpost, crates and a barrow between the rows. *Medina:* a market street from the lift with lamp posts, strings of bulbs crossing it, six produce stands, cargo by the lift, a directory, post-and-rail fences; a door, a porch lamp and a worn path at every building in the drum; a signpost and lamp at each of the other places. Solid clutter asks for clear floor first (not a door, a walker's lane, a queue's place or a reading post, nobody standing there) and is left out or moved a little if there is none; a flood of the open floor from where you arrive still reaches every place and reading post in all four. `?wear=off` leaves it all out. In Medina's drum, which is drawn as 128 flat strips, the new things stand on the strip under them and wide ground markings are laid strip by strip, or they sank into the ground between the strips' edges. The light probes were baked again. Code: `src/wear.ts` (the builder, the sheets, the pass over rooms), `src/dressing.ts` (each station), `wear`, `clear` and `frame` in `src/interior.ts`. Not done: stairs or ramps you can climb (the floor you walk on is still flat, so the catwalks are scenery; gravity falling with height waits on this); corridors re-laid to feed the plazas (no room shapes were changed); stains do not show in the wet floors' reflections; people do not use the bins, lean on the rails or stop at the directories; no lights that are really lights were added, so the bulbs glow but do not light what is near them.
11. **Better people.** Hand-built meshes in Blender with proper topology, baked occlusion and a normal-mapped skin shader. Last because crowds are mostly seen at a distance. No free photoreal CC0 humans exist; do not use anything with an unclear licence. *First pass done 2026-11-17 (branch `better-people`):* the body in `tools/blender/person.py` now has a one-piece sculpted head (no jaw ridge), hands with a thumb and four fingers, extra loops at knees, elbows and shoulders, and a wardrobe of optional pieces: six hair styles plus bald, a beard, a cap, an open jacket, long sleeves or bare forearms. Each person picks pieces and still draws as one mesh in one draw call; people with the same pieces share a geometry. Two shapes in the file (`heavy`, `curvy`) give eight builds, worked into the shared geometries at load rather than blended every frame. Ambient occlusion is baked into vertex colours and used by the palette shader, with creases on skin shading towards red. Cost: about 4% more frame time in the 130-person Concourse (more triangles per person); a low-detail body for distant people would win that back. Not done: a normal-mapped skin shader, finger bones, facial animation, cloth movement, eye whites.

### Phase C: platform

12. **Hosting on Cloudflare Pages** (section 3), once the visuals are worth showing. Config (`wrangler.toml`) is already in the repo.
13. **WebGPU spike, last** (section 1), then migrate or shelve.

### Backlog (not scheduled)

- ~~Bug: Earth's night side rendered nearly as bright as day.~~ *Fixed 2026-11-17:* the studio environment meant for ship reflections was lighting every planet, because a material's `envMapIntensity` doesn't scale `scene.environment`. Planets, clouds and rocks now carry their own black environment.
- **Sound.** Parked at the owner's request. When revisited: synthesised or CC0 audio only, Web Audio positional sound with a convolver reverb per room, footsteps per material, ventilation and crowd murmur layers.
- ~~Ring-space ship traffic on the Sol scale (ring space keeps ~125 m per unit for now).~~ *Done 2026-11-20:* the ring space is true scale like everything else. The gates (about 1,000 km across) sit on a shell 500,000 km from the Ring Station (5 km across); Medina (2 km) is parked 45 km from it; ships are their true size. Figures are from memory of the books, plausible rather than checked. The speed limit is the gameplay: 30,000 km/s (0.1 c on the dial), so the centre to a gate takes about half a minute and wall to wall under a minute, while the usual slow-down near anything keeps flight round Medina to metres a second. The nearest gate is swapped for a full model with the moving film and the far star's light in the middle. Still open: nothing happens if you try to break the limit (the drive just won't go faster), and the gates' far sides all look alike apart from that light.
- Hand-flying and hand-walking test pass by a person, not only headless Playwright. *Checklist ready: `docs/HAND-TEST.md` (2026-11-17); needs David.*

## 3. Hosting options

### What needs hosting

A static site: `bun run build` makes a `dist/` of 73 files and about 97 MB. The biggest files are the Moon (18 MB) and Mars (10 MB) textures. Everything runs in the browser; there is no server component. Assets are CC BY, CC BY-SA 3.0 (Askaniy Anpilogov et al.), CC0 and public domain, all listed in `CREDITS.md`.

### Options (limits come from third-party summaries; check each provider's page before relying on them)

| Option | Cost | Limits that matter | Fit |
|---|---|---|---|
| **Cloudflare Pages** | Free | Unmetered bandwidth for static assets, 500 builds/month ([source](https://playcode.io/blog/where-to-host-a-static-website)). I recall a 25 MiB per-file cap that the 18 MB Moon texture is under; not confirmed in the research, check it. | **Best fit.** Generous bandwidth, global CDN, custom domain. |
| **GitHub Pages** | Free | 1 GB site, about 100 GB/month soft bandwidth, 10 builds/hour ([source](https://flaviocopes.com/hosting-free-tiers/)). | Good. The repo is already on GitHub, so deploying is one Action. Heavier files cost bandwidth. |
| **Netlify free** | Free | About 100 GB/month, 300 build minutes ([source](https://cmaven.github.io/en/hosting/netlify-vercel-static-hosting-comparison/)). Pricing has moved to credits; recheck. | Works; less headroom. |
| **Vercel Hobby** | Free | 100 GB/month, non-commercial only. | Works for this non-commercial use; no advantage. |
| **Railway** (already in use for other apps) | Paid, not free | A service per app. | Not recommended: costs money for something static, and the standing rule is free for this project. |
| **here.now** (used for other sites) | Per the owner's account | Unknown for a 97 MB site. | Possible; check terms. |
| **Self-host on the Mac** | Free | Needs a tunnel and the Mac to stay on. | Only for sharing a private link. |

### Decision

**Live since 2026-11-17 on here.now** (David's personal account): https://silken-marvel-d95y.here.now/. Cloudflare Pages was dropped because the only Cloudflare login available was tied to a work email. Republish after changes: `bun run build && ~/.claude/skills/here-now/scripts/publish.sh dist --slug silken-marvel-d95y --client claude-code`. Tested before going live in Chromium, WebKit and Firefox (headless).

Earlier plan, kept for reference: **Cloudflare Pages** (chosen 2026-11-15), deployed from the public GitHub repo, with the build run in CI (`bun install && bun run build`, output `dist`). GitHub Pages is the fallback.

### Things to settle before going public

- **Visibility.** A hosted URL makes a fan project much easier to find than a repo. The project is non-commercial: no ads, no analytics that sell data, no donation button, no paid tier.
- **Licence obligations.** Keep the credits visible in the site itself (a credits link on the start screen), not only in the repo. The CC BY-SA 3.0 texture needs its attribution and the share-alike condition respected for that texture.
- **Acknowledgement is not permission.** The fan-project notice stays on the start screen. If a rights holder objects, take it down and say so in the repo.
- **Bandwidth.** Mars and Moon textures dominate; ship them as KTX2 or smaller JPEGs, and lazy-load by system, before going public.
- **Browser support.** Test on Chrome, Safari and Firefox. Today it is tested only in headless Chromium.
- **Privacy.** No analytics, no accounts. The site has nothing personal in it; keep it that way.

## Sources

- [WebGPU adoption 2026](https://enterno.io/en/s/research-webgpu-adoption-browsers-2026)
- [web.dev: WebGPU supported in major browsers](https://web.dev/blog/webgpu-supported-major-browsers)
- [three.js WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer)
- [Migrating three.js to WebGPU and the Firefox caveat](https://www.buildmvpfast.com/blog/threejs-webgl-to-webgpu-renderer-migration-2026)
- [WebGPURenderer performance thread](https://discourse.threejs.org/t/why-webgpurenderer-performance-significantly-lower-than-webglrenderer/77629)
- [Hosting free tiers, September 2026](https://flaviocopes.com/hosting-free-tiers/)
- [Where to host a static website in 2026](https://playcode.io/blog/where-to-host-a-static-website)
- [Netlify, Vercel and static hosting limits](https://cmaven.github.io/en/hosting/netlify-vercel-static-hosting-comparison/)
- [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer)
- [Needle: Blender lightmapping](https://engine.needle.tools/docs/blender/lightmapping)
- [realism-effects](https://www.npmjs.com/package/realism-effects)
