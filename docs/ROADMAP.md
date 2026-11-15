# Roadmap

Ordered plan for Beyond the Ring. Written 2026-11-15 from research (sources at the end). Constraints: free tools and services only, no engine change, copyright acknowledged in `CREDITS.md`, unofficial and non-commercial.

## 1. WebGPU: when, and is it worth it?

**Recommendation: not now. Spike it after the content work (step 6 below), as a time-boxed experiment with a go/no-go gate.** Today the limit on realism is content (textures, lighting, models), not the renderer. WebGPU is a renderer change, and it costs this project more than most because of the true-scale depth work.

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

1. **PBR material pipeline.** Real texture sets (colour, normal, roughness, ambient occlusion) from ambientCG and Poly Haven (confirm Poly Haven's licence page and add to `CREDITS.md`). KTX2 compression. Convert interior and ship materials to `MeshPhysicalMaterial` where it helps (wet floors, glass, clearcoat paint). Tune the tone-mapping curve.
2. **Image-based lighting.** A small HDR environment per interior and per space scene, so metals reflect something. Sun-only lighting in open space (hard light, deep shadow, no fill). Atmosphere shader for planets and a night side with city lights.
3. **Ambient occlusion and contact shadows.** Runtime AO first (cheap trial of N8AO or realism-effects). Bake corner AO for the static parts of interiors.
4. **Baked interior lighting.** Move interior layouts into Blender (kit exists), bake lighting with Cycles into lightmaps, export GLB. Keep runtime lights only for neon and signs. This is a rebuild of the interiors from generated code to authored assets, so do one room as a trial (a Tycho corridor) before committing the rest.
5. **Hero ships and stations.** Hull panels, normal and roughness maps, weathering, windows with emissive interiors. Start with the Rocinante, Donnager and docked ships. Update the in-code fallback `corvette()` in `src/ships.ts` (still the old shape).
6. **Photo mode (optional).** Stills refined with `three-gpu-pathtracer` (WebGL 2, progressive). Untested at true scale; treat as an experiment.

### Phase B: walking inside stations

7. **Collision and movement.** 2D wall-segment and circle test with slide along walls, acceleration and deceleration, steps and ramps, crouch under pipes. No library needed for generated boxes.
8. **Instanced, behaving crowds.** One shared skinned model with per-person animation state, impostors at distance. Behaviours: lane walking with avoidance, queueing at stalls, paired conversations, glancing at the player, doors in and out.
9. **Spin-gravity physics.** Floor curving up with distance on Ceres and Medina, Coriolis drift when running, reduced gravity and longer strides near the axis. Our own design; no standard technique found.
10. **Layout and wear.** Corridors that feed plazas, service ducts, stairs and railings, wayfinding signs, trash, clutter with purpose. Neon pass for Medina's drum and Ganymede's dome.
11. **Better people.** Hand-built meshes in Blender with proper topology, baked occlusion and a normal-mapped skin shader. Last because crowds are mostly seen at a distance. No free photoreal CC0 humans exist; do not use anything with an unclear licence.

### Phase C: platform

12. **WebGPU spike** (section 1), then migrate or shelve.
13. **Hosting** (section 3), when the visuals are worth showing.

### Backlog (not scheduled)

- **Sound.** Parked at the owner's request. When revisited: synthesised or CC0 audio only, Web Audio positional sound with a convolver reverb per room, footsteps per material, ventilation and crowd murmur layers.
- Ring-space ship traffic on the Sol scale (ring space keeps ~125 m per unit for now).
- Hand-flying and hand-walking test pass by a person, not only headless Playwright.

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

### Recommendation

**Cloudflare Pages**, deployed from the public GitHub repo, with the build run in CI (`bun install && bun run build`, output `dist`). GitHub Pages is the fallback.

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
