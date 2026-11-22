# E2.1 Real data sources: what may be reused, and how

Research for BACKLOG task E2.1 (epic E2, "Real objects: find out what we know"). Written 2026-11-22.

## How this was checked

Every licence and terms page below was fetched with `curl` on 2026-11-22 and read as text locally. Two live APIs (JPL SBDB, JPL Horizons, plus NASA's Image and Video Library) were also called once to see real responses and headers. Where a page could not be fetched (bot challenge, 404, 500) I say so, and either used an Internet Archive snapshot (dated) or label the point **unverified**. Nothing here is legal advice; the project is a free, non-commercial fan game, which is the most permissive case for almost every source below.

One thing to know up front: the BACKLOG says "NASA media is usually public domain; ESA content is often CC BY-SA 3.0 IGO". The first is roughly right. The second is **misleading**: ESA's general web text is not CC-licensed at all, and only some images carry a CC licence (see ESA below).

## Summary table

| Source | Facts | Text | Images | 3D | Terms in one line |
|---|---|---|---|---|---|
| NASA (nasa.gov, science.nasa.gov, NSSDC, PDS) | Yes | Generally not copyrighted; still write our own | Generally not copyrighted, except marked third-party items | Yes (NASA 3D Resources) | Credit NASA as source, never imply endorsement, no NASA logos |
| JPL SBDB / Horizons APIs | Yes | n/a | n/a | n/a | Public JSON APIs, no key, no documented numeric rate limit |
| NASA Image and Video Library | n/a | Captions: facts only | Same as NASA media; check `secondary_creator` | n/a | JSON API, CORS open |
| ESA website | Yes (facts are not owned) | Copyright ESA; no right to copy or make derivatives | Education/editorial use with credit; not commercial; CC only where marked | Not offered as a set (unverified) | Credit "ESA", some items CC BY-SA 3.0 IGO, partner items need separate rights |
| ESA Gaia / PSA data | Yes | n/a | n/a | n/a | Must acknowledge; licence wording not confirmed (unverified) |
| JAXA | Yes | Copyright JAXA | Source credit required; **no modification of any kind**, no commercial use | No | Strictest of the lot for images |
| USGS Astrogeology | Yes | US public domain unless marked | Public domain unless marked | Some PDS-derived shape/maps | Credit requested |
| IAU Gazetteer (hosted by USGS) | Names and coordinates yes | n/a | n/a | n/a | No licence text found on the pages I could read (unverified) |
| Minor Planet Center | Yes | n/a | n/a | n/a | Asks for an acknowledgement sentence; no licence stated |
| Wikidata | Yes | n/a | n/a | n/a | CC0 |
| Wikipedia | Facts yes | CC BY-SA 4.0 (copyleft) | Per-file licence | Per-file | Avoid copying prose; link instead |

## NASA

### Rules that apply to all NASA media

Source: the NASA Images and Media Usage Guidelines page (`https://www.nasa.gov/nasa-brand-center/images-and-media/`, the old `/multimedia/guidelines/` address redirects here).

- NASA content (images, audio, video, and files used for 3D models such as textures and polygon data) is generally not subject to copyright in the United States. Use for education and information, including computer graphical simulations and Internet web pages, is explicitly permitted, and personal pages are covered. A free non-commercial game fits that.
- NASA should be acknowledged as the source. The page asks for acknowledgement but gives no fixed wording. Suggested wording for CREDITS.md: "Image: NASA/JPL-Caltech" using the credit line on each item, plus "Source: NASA".
- Use must not state or imply NASA endorsement. The page says this for commercial use; JPL's own policy (below) says it for all uses. The current CREDITS.md line "Its use here does not imply any endorsement by NASA" is the right idea; keep it and extend it to ESA and JAXA.
- Third-party material: NASA sometimes publishes copyrighted images from other parties with permission. These are marked with the holder's name and NASA's use gives you no rights. Gotcha: the marking is in the caption, not in the file metadata. Our fetch script must record the credit line and refuse any item whose credit names a non-NASA holder without a human decision.
- Logos: the NASA insignia (meatball), logotype (worm) and seal are not public domain and need prior approval (JPL page). Never use them in the game. Photos that include the meatball on a spacecraft are fine as photos but should not be cropped into a logo.
- Identifiable people: relevant only for commercial use. Not an issue here, but keep astronaut photos out of promotional material.
- NFTs and cryptocurrency: NASA does not want its material used for them. Not relevant, but note it if the game ever sells anything.
- **New section on AI-generated content (read at source on 2026-11-22).** The same page now has a section on "super intelligence (SI) applications" referencing an executive order dated 2026-09-29. In my reading it says: do not attribute information in AI-generated output directly to NASA; no phrases like "according to NASA" in such products; do not show NASA insignia with AI-generated imagery; AI products are encouraged to carry a marking saying they are AI-generated; you may factually say a tool includes NASA source material, without implying NASA reviewed or permitted it. This is a **gotcha for E2.3**, because the game text is written with Claude. It is a policy for how NASA data is used in AI products, and whether a human-reviewed game's info panel counts is a judgement call. I could not verify how NASA applies it. See open questions.

### Solar System Exploration (science.nasa.gov/solar-system)

- Form: ordinary web pages. No API. Pages sit under the NASA guidelines above, so facts and our own summaries are fine. The site was moved from solarsystem.nasa.gov to science.nasa.gov (the old address redirects).
- Use as: a "learn more" link target, and a reference for hand-written summaries. Do not scrape prose into the dataset.
- Unverified: whether any text blocks on these pages carry their own third-party copyright notices. Check per page when linking.

### NSSDC (nssdc.gsfc.nasa.gov) and the Planetary Data System

- NSSDC Master Catalog (`/nmc/`) is useful for official spacecraft facts: launch date, COSPAR/NSSDC ID, mission status. Form: web pages and a search interface. I found no machine API.
- PDS (pds.nasa.gov) archives mission data: shape models, global maps, SPICE kernels. Form: bulk download per archive node. Data is NASA-produced and generally public, but individual archives can carry their own citation requirements (they usually give a DOI to cite).
- I could not fetch a stated policy page for either (the two policy URLs I tried returned 404). **Unverified:** explicit licence wording for NSSDC and PDS. Treat as covered by the NASA media guidelines and cite the DOI or dataset name given on each archive page.

### JPL Small-Body Database (SBDB) API

- Docs: `https://ssd-api.jpl.nasa.gov/doc/sbdb.html` (API version 1.3 on that page). Single object: `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=433&phys-par=1`. Bulk query: `https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=full_name,H,diameter,a,e&sb-kind=a&sb-class=MBA&limit=100`. Returns JSON. No API key. I called both on 2026-11-22 and both worked (the query reported about 1.4 million matching bodies).
- Licence: no explicit licence statement on the API page. The data is produced by a NASA centre (JPL/CNEOS); treat as NASA content under the guidelines above and credit "NASA/JPL Small-Body Database". Unverified: no separate JPL data licence page found (the URL I guessed was a 404).
- Rate limit: none documented in the API docs. The docs only list HTTP 503 as the response to overload. Be polite: one request at a time, a short sleep, cache to disk. Our script makes about 40 calls total, so this is not an issue.
- Response had no `access-control-allow-origin` header for `sbdb.api` in my header check (the NASA IVL API did have one). Browser calls from the game would probably fail CORS, which fits the no-runtime-calls decision. Unverified for all endpoints.
- Gotchas found while testing:
  - Diameter is `null` for Pluto, Eris, Haumea, Makemake and Arrokoth in SBDB. Use curated values (from the mission papers or Wikidata) for these and record the source.
  - Eros "diameter" 16.84 km is a volume-equivalent sphere; the triaxial extent (34.4 x 11.2 x 11.2 km) is a separate `extent` field. Keep the field `notes` text, which says what the value means.
  - Rotation period is in hours; Mathilde reports about 418 h. Fields carry `ref` citations, so copy the reference into the fact record.
  - Numbered-object SPK IDs follow `20000000 + number` (Ceres 20000001, Bennu 20101955). Comets are in the 1000000 range (Halley 1000036, 67P 1000012).
  - `1I/'Oumuamua` is kind `au` (SBDB has an "interstellar" kind), so any filter on `an`/`cn` will miss it.

### JPL Horizons API

- Docs: `https://ssd-api.jpl.nasa.gov/doc/horizons.html` (version 1.3, 2025 June). Endpoint: `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='-31'&EPHEM_TYPE='VECTORS'&CENTER='500@10'&...`. I got a valid Voyager 1 state vector relative to the Sun for 2026-11-22.
- Covers planets, moons, small bodies and many spacecraft (Voyager 1 is `-31`). Ephemeris types: observer, vectors, elements, SPK (binary file), close-approach.
- Output is a text block inside JSON, not parsed fields. Parse with care and keep the "source" line (e.g. the trajectory solution name) as the fact's source note.
- Gotcha: errors are returned with HTTP 200 and the message in the payload, so check the content. Other documented codes: 400, 405, 500, 503.
- Rate limit: none documented. TLIST allows up to 10,000 discrete times per request. The docs ask for an optional email address that is used only for follow-up on problems; **do not send David's address**. Leave it out.
- Spacecraft coverage ends when tracking ends, and some old probes (Pioneer) may have little or no trajectory. Unverified for each probe in our list; the build script should report "no ephemeris" rather than fail.
- Also available: planetary ephemeris files (DE series SPK) at `ssd.jpl.nasa.gov/planets/eph_export.html` if the game ever wants a bulk offline source instead of many API calls. Not examined further.

### NASA Image and Video Library (images.nasa.gov, API at images-api.nasa.gov)

- Form: JSON REST API. `https://images-api.nasa.gov/search?q=Ceres%20Dawn&media_type=image&page_size=1` worked with no key. Responses carry `nasa_id`, `center`, `date_created`, `description`, and **`secondary_creator`** (e.g. "NASA/JPL-Caltech/UCLA/MPS/DLR/IDA" for a Dawn image) which is the credit line to record. The response header included `access-control-allow-origin: *`.
- The API docs PDF (7 pages) gives search parameters. It does not state a rate limit or licence. Licence is the NASA media guidelines above.
- Gotcha: some library items are third-party or partner material. Check `secondary_creator` against an allow-list of NASA centres and JPL/mission teams. DLR, MPS, IDA (the Dawn co-credits above) are mission partners and the images are still distributed by NASA, but record the credit anyway.
- Descriptions often contain a `photojournal.jpl.nasa.gov` link, which is a good "more" link for the info panel.

### JPL image policy (relevant to images on jpl.nasa.gov and photojournal)

Page: `https://www.jpl.nasa.gov/jpl-image-use-policy/`. In short: images on JPL public sites may be used for any purpose without permission, unless noted. Use the credit line "Courtesy NASA/JPL-Caltech" unless the caption says otherwise. Do not claim or imply endorsement by Caltech, JPL or NASA. NASA logos need written approval. Some items are owned by outside organisations and are marked in the caption. This is a little stricter than the NASA page on credit (JPL requires a credit line; NASA's asks for acknowledgement).

### NASA 3D Resources (nasa3d.arc.nasa.gov, GitHub `nasa/NASA-3D-Resources`)

- Form: web catalogue plus a GitHub mirror (5 GB; I read the file tree, 1,583 entries, via the API). Formats include `.glb`, `.blend`, `.stl`, `.3ds`, `.max`, plus textures and images.
- Terms: the site says all assets are free to download and use and points at the NASA media guidelines. The README says "free and without copyright". **Conflict to resolve:** the repo's `meta.json` says "NASA Open Source Agreement Version 1.3", and GitHub reports no licence file. For a non-commercial game both readings allow use. Record the media guidelines as the licence and note the discrepancy.
- Third-party risk: contributors include outside firms (the README lists, for example, Ball Aerospace and DigitalSpace Corporation). Unverified whether any individual model carries restrictions. Check each model's readme/page before shipping. The Rosetta model is hosted here even though Rosetta is an ESA mission; unverified whether ESA design rights apply to the mesh.
- What is there that matters to us (all `.glb` unless noted): ISS (versions A to E, high-res and IGOAL), JWST (A, B), Hubble (A, B), Voyager (A, B), Pioneer 10, Parker Solar Probe, Juno (A, B), Cassini-Huygens (A, B, with and without Huygens), Galileo (and `.stl`), Dawn, Rosetta, OSIRIS-REx, 1999 RQ36 (Bennu), Perseverance, Ingenuity, Curiosity, Kepler, Spitzer, Stardust, Deep Impact/EPOXI, Ulysses, MESSENGER, Magellan, MRO, LRO, MAVEN, Apollo Lunar Module. Asteroid shapes as `.stl` under "3D Printing": Eros, Itokawa, Vesta (several), Toutatis, Geographos, Kleopatra, Golevka, Mithra, DART. Not present (by directory name): New Horizons, Pioneer 11, Hayabusa2, Tiangong, Gaia, JUICE, Hera, Arrokoth, Ryugu.
- Gotcha: models are made for visualisation and vary in polygon count and scale. Run each through our meshopt pipeline and check real-world size against the mission fact sheet.

### Eyes on the Solar System

Page: `science.nasa.gov/eyes`. Real-time 3D viewer built from NASA trajectory data. I found no licence or data-use statement on the page that I fetched. **Unverified.** It is useful as a comparison and as a link target ("see it live in Eyes"); do not copy its assets. The README of NASA 3D Resources lists "Eyes on the Solar System" as a contributor, so some Eyes models are in the NASA 3D mirror under the terms above.

## ESA (European Space Agency)

### What the terms pages actually say

Two documents matter, and they differ.

1. **General terms** (`https://www.esa.int/terms-and-conditions`, fetched live). The website contents are for personal and non-commercial use. ESA grants permission to download and copy for personal non-commercial use, but does **not** grant the right to resell, redistribute, compile, or make derivative works from material on the site. All material is protected by copyright, owned by ESA or the credited provider. The ESA logo may not be modified or used without written authorisation. Consequence: do not copy ESA prose into the game, and do not bundle ESA web text in the dataset. Facts (dates, numbers, names) are not owned and can be restated in our words with a source link.
2. **Images and videos terms** (title: "Terms and conditions of use of images and videos available on the ESA website"). The live URL that the general page points to was not reachable on 2026-11-22; every address I tried returned a 404 page. I read the Internet Archive snapshot of 2024-12-31 / 2025-01-12 instead. **Treat as unverified for today.** Key points in the snapshot:
   - Educational, editorial and informational use is free and needs no separate permission, on conditions. Examples they give include exhibitions, documentaries, school books and social media.
   - You must credit ESA's copyright, naming the photographer or illustrator if given. Their examples: "Photo: (c)ESA", "Image: ESA/NASA - SOHO/LASCO".
   - Items marked with another copyright holder need that holder's separate approval. Items that ESA co-owns with partners are called out the same way.
   - Do not state or imply ESA endorsement of any product, ideology and so on, and keep it away from topics such as violence, which matters for a game with a sci-fi war plot (see open questions).
   - Some items are under a Creative Commons licence. The snapshot calls it "CC-BY-SA-NC-3.0-IGO" in the text but links to the CC BY-SA 3.0 IGO licence page. That mismatch is a gotcha: **do not assume NC or not-NC from the page; read the licence line on each asset.**
   - No commercial use (entertainment, advertisement, merchandising). A game that is free and non-commercial is probably education/information, but "entertainment" is on their list of commercial examples. Ambiguous. Unverified how ESA would classify a free fan game.
   - Contacts: spaceinimages@esa.int for images, spaceinvideos@esa.int for videos.

So the BACKLOG shorthand "ESA is often CC BY-SA 3.0 IGO" is true only of a subset of assets. The default is "ESA copyright, editorial use with credit". Exceptions to watch for:

- CC BY-SA 3.0 IGO items (for example some mission imagery marked as such on the asset page). ShareAlike applies to adaptations, so a texture derived from one must be released under the same licence. The project already ships CC BY-SA 3.0 and 4.0 items, so the pattern exists in CREDITS.md. IGO versions have extra terms about disputes and immunities; read the licence text before use.
- Partner-owned images (NASA/ESA joint items are common; the credit line shows both). The NASA half may be free, but ESA's terms still apply to the joint item as presented on esa.int. Safer to take the NASA-hosted copy and use NASA's terms when the same image exists there.
- Third-party credits in videos (end credits, not captions).

### Gaia, Rosetta, Hera, JUICE

- Gaia: data is available through the Gaia Archive (cosmos.esa.int). The credits page asks users to acknowledge the people and institutes involved and gives per-release credit and citation instructions (fetched). I did not confirm the licence text for the data. **Unverified.** Gaia is star data; for the game it only matters as the stars background (the HYG catalogue already in use is derived partly from Hipparcos, an ESA catalogue). Gaia also published asteroid data (DR3 solar-system objects); not needed for v1.
- Rosetta (comet 67P): science data is in ESA's Planetary Science Archive (PSA, cosmos.esa.int/web/psa). I could not read a copyright page for PSA (the URL I tried was a 404). Rosetta images on esa.int are under the image terms above; the OSIRIS and NAVCAM imagery are sometimes marked CC BY-SA 3.0 IGO on the asset page (unverified for each). A shape model for 67P exists from the mission teams; unverified licence and availability, so for v1 use the NASA-hosted Rosetta spacecraft model only if its terms check out and show 67P as procedural.
- Hera, JUICE: mission pages and images fall under the ESA terms above. No downloadable 3D models verified. Both are in flight or in cruise, so facts are about mission plans and need a retrieval date; JUICE's and Hera's positions can be taken from Horizons if tracked (unverified).
- ESA multimedia: browse at `esa.int/ESA_Multimedia/Images`. No documented API found. A per-image page has a copyright line. Treat the credit line as data and keep it in the fact record.

## JAXA (Hayabusa2 and others)

- Terms of use fetched at `https://global.jaxa.jp/policy.html` (the older `jaxa.jp/policy_e.html` is a 404). The Materials on the site may be used for non-commercial purposes if the source is shown.
- Credit wording they suggest: "Provided by Japan Aerospace Exploration Agency (JAXA)" or "Courtesy of JAXA"; short forms "Provided by JAXA" or "JAXA" if space is tight. Where another organisation owns an item, credit that one (for example "Provided by NASA/JAXA").
- **No modification of any of the materials is allowed**, and the terms give examples: cropping, changing the aspect ratio, changing colours, flipping, or mounting inside another image. This rules out using JAXA images as game textures (we resize, recompress, change colour), and rules out cropped thumbnails. Hotlinking or linking out is fine. Commercial use needs written permission.
- Do not use JAXA material in a way that implies JAXA support or promotes anyone. Links to the JAXA site must be clearly labelled as such.
- The JAXA Digital Archives have their own "Copyright Information"; I did not read it. **Unverified.**
- Practical position: use facts only (Ryugu size, dates, sample mass), with a link to the Hayabusa2 page. Do not include JAXA pictures. For a Ryugu shape, look at the published shape model data (Watanabe et al., 2019) and check the licence of whichever archive hosts it; **unverified.**
- ISRO and CNSA were not fetched. **Unverified.** Assume facts only, no media, until checked.

## USGS Astrogeology and the IAU Gazetteer

- USGS copyright and credits page (`usgs.gov/information-policies-and-instructions/copyrights-and-credits`). The live address returned an empty bot-challenge reply to curl, so this is from an Internet Archive snapshot of 2026-01-05. It says USGS-authored data and information are in the US public domain, but not every image on USGS sites is; some are third-party and marked as copyrighted. It asks for credit, with an example format "Credit: U.S. Geological Survey Department of the Interior/USGS". The USGS identifier (logo) is a trademark and needs permission.
- Astrogeology Science Center produces global maps and mosaics (Mars, Moon, Mercury, icy moons) from NASA mission data, often hosted on the Astropedia and PDS. These are what several CREDITS.md maps already derive from (the Europa and the Ganymede maps list USGS). Licence per product: **check the product page**; unverified in general.
- IAU Gazetteer of Planetary Nomenclature (`planetarynames.wr.usgs.gov`, USGS-hosted for the IAU Working Group for Planetary System Nomenclature). Form: web search plus nightly KML and shapefile downloads for each body (the GIS Downloads page lists more than fifty targets, including Ceres, Vesta, Eros, Bennu, Didymos, Dimorphos and the large moons). Names are IAU decisions; coordinates are in the IAU system with all bodies treated as spheres except Mars. During my fetches most gazetteer pages (including Home and Download) returned HTTP 500; the GIS Downloads page loaded from the Internet Archive. I found **no licence or rate-limit statement**, so this is unverified. Names and feature coordinates are facts, so the risk is low. Record the retrieval date and the nomenclature page URL. The site is live and updated often (it showed newly approved names the week I looked), which is a reason to re-run the build periodically.
- Gotcha: nomenclature is decided body by body, and some names are only "provisional". Show feature names with their IAU status where the data has it.

## Minor Planet Center (MPC)

- `minorplanetcenter.net` blocked plain curl on the `/data` page (HTTP 403). I read an Internet Archive copy (2026-01-04) and the live `MPCORB.html` page.
- What is offered: bulk files, updated daily, e.g. `MPCORB.DAT.gz` (orbits for all asteroids), `NEA.txt`, `PHA.txt`, `Distant.txt` (TNOs, Centaurs, SDOs), with JSON versions (`mpcorb_extended.json.gz`). Documentation: "Export Format for Minor-Planet Orbits" and the Extended MPCORB manual.
- Terms: no licence stated. The page asks that research publications thank the MPC with this sentence (quoted here because exact wording is what they ask for): "This research has made use of data and/or services provided by the International Astronomical Union's Minor Planet Center." A game is not a research publication, but copying it into CREDITS.md costs nothing.
- Rate limits for web services: not read. **Unverified.** Bulk files avoid the question.
- For this project SBDB already gives orbits in a friendlier JSON, so MPC is a cross-check and the best source for the identity and designation of objects (names, discovery circumstances come through SBDB too). The MPC's operating funds come from a NASA grant (per its About page), which does not change its terms.

## Wikidata and Wikipedia

- **Wikidata** structured data is CC0 (public domain). Source: Wikidata:Licensing, fetched. No attribution is required; credit is still good practice. Free API (`wikidata.org/w/api.php`, SPARQL endpoint). Rate limits: the Wikimedia User-Agent policy page exists and says to send a descriptive User-Agent; I did not extract numeric limits, so **unverified**. Do not put any personal contact details into the User-Agent beyond a project name and repository URL. Gotchas: values can be wrong or vandalised, units differ per statement, and references are often missing. Treat as a hint for connective facts (Q-id, alternative names, discovery date, image links) and cross-check anything shown as a number against the agency source.
- **Wikipedia** text is CC BY-SA (4.0 for current text) and also GFDL unless noted. Source: Wikipedia:Reusing Wikipedia content, fetched. Reuse needs a hyperlink or author list, an indication of changes, and copyleft: derived text must be released under the same licence. Prefer not to copy prose; link to the article. Images and other media have **their own licence per file**, shown on the file page; many NASA images on Wikipedia are public domain, many others are not.
- The existing credits for the Ganymede and Callisto maps (Wikimedia Commons, CC BY-SA 3.0) are the pattern to follow for any Commons image.

## Cross-cutting gotchas

1. **Credit lines inside agency media.** NASA and ESA pages repeat the agency's name as a source while the real copyright holder is a partner or contractor. Store the full credit line with every media fact and compare it to an allow-list.
2. **Endorsement.** All three agencies (NASA, ESA, JAXA) forbid implying endorsement. Our CREDITS.md already has the sentence for NASA; add ESA and JAXA. Do not use any agency logo.
3. **Derivative rules differ.** NASA: adapt freely. ESA: images may be used with credit; CC items follow ShareAlike; website text has no derivative right. JAXA: no modification at all. Wikipedia: ShareAlike.
4. **Photos of live missions.** Facts about active missions (Voyager, Juno, JUICE, Hera) change. Store a retrieval date and show it in the panel.
5. **AI-product language from NASA** (above). Handle before E2.3 ships.
6. **Sites that block scripts.** USGS, MPC and NASA Eyes may serve empty or 403 replies to scripts. Our build script should keep the downloaded source (or a hash) in a versioned cache, and fail loudly rather than write an empty fact.
7. **Naming.** Use the IAU/MPC names exactly; keep the common name too ('Oumuamua, Bennu).

## Recommended curated dataset design

This follows E2.1.b: a static `assets/data/facts.json` built by a script, no runtime calls to third parties, and links out to live pages.

### Files

- `tools/build-facts.ts` (Bun, TypeScript). Reads `tools/facts/entities.yaml` (the hand-curated list), calls JPL SBDB and Horizons for numeric data, optionally reads Wikidata for connective fields, and writes `assets/data/facts.json` plus `assets/data/facts.changes.md` (a diff versus the last build).
- `tools/facts/cache/` holds raw API responses, one file per call, so a rebuild is offline-repeatable and diffable. Commit the cache, since agency pages change or vanish.
- `tools/facts/text/<id>.md` holds our own written summaries (short, with a reviewer field), because we do not copy agency prose.

### Schema (TypeScript, matching E2.2.a)

```ts
type Licence =
  | "NASA-media"        // NASA Images and Media Usage Guidelines
  | "JPL-image"         // JPL Image Use Policy
  | "US-PD"             // US government public domain (USGS etc.)
  | "CC0"               // Wikidata
  | "CC-BY-SA-4.0" | "CC-BY-SA-3.0-IGO" | "CC-BY-4.0"
  | "ESA-editorial"     // ESA images/videos terms: credit, no commercial use
  | "JAXA-nomod"        // JAXA: credit, no modification
  | "facts-only"        // numbers/dates restated in our words; source linked
  | "own";              // written for this project

interface Fact {
  key: string;                 // "diameter_km", "orbital_period_d", "launch_date"
  value: number | string | null;
  unit?: string;
  note?: string;               // e.g. "volume-equivalent sphere"
  source: { name: string; url: string; ref?: string };  // ref = paper/dataset cited by the source
  retrieved: string;           // ISO date
  licence: Licence;
  credit?: string;             // exact credit line if media or quoted
  verified: "script" | "human" | "unverified";  // BACKLOG E2.5.c
  asOf?: string;               // date the value is valid for (live missions)
}

interface Entity {
  id: string;                  // "ceres", "voyager-1"
  name: string;
  altNames: string[];
  kind: "star" | "planet" | "dwarf" | "moon" | "asteroid" | "comet" | "probe" | "station" | "telescope" | "site";
  reality: "real" | "fiction";
  basedOn?: string;            // for fiction objects: id of the real object (E2.3.c)
  ids: { sbdb?: string; spk?: number; horizons?: string; naif?: number; cospar?: string; wikidata?: string; mpc?: string };
  summary: { text: string; licence: "own"; reviewedBy?: string; reviewedOn?: string };
  facts: Fact[];
  links: { label: string; url: string; agency: string }[];   // out to live pages
  media?: { file: string; credit: string; licence: Licence; sourceUrl: string; modified: boolean }[];
  model?: { file: string; sourceUrl: string; licence: Licence; credit: string; notes?: string };
  missions?: string[];         // entity ids
}
```

### Rules for the build script and tests (E2.2.c)

- A fact without `source.url`, `retrieved` or `licence` fails the build. An entity with no `summary.licence` or any media without a `credit` fails.
- Media with `licence: "JAXA-nomod"` must have `modified: false`. Any ESA item must record whether the asset page showed a CC licence or ESA copyright.
- The script has an allow-list of credit strings (NASA, JPL, USGS, specific mission teams). An unknown credit makes the item "needs human decision" and it is not written to `facts.json`.
- Diff output lists new, changed, removed facts, so a reviewer can mark `verified: "human"`.
- The script writes `CREDITS-data.md` rows (one per source used) so CREDITS.md stays in step.
- Live-mission values carry `asOf`, and the panel shows "as of <date>".
- Sources used at build time only. No runtime calls. This satisfies E2.1.c (privacy): the game makes no request carrying user data, and the only network contact is the link a user chooses to click.

### Text policy

- Our own words, short, with the facts attributed in a "Sources" line (source name and URL, not "according to NASA"; see the AI-language question below).
- Quotations: none planned. If one is needed, keep it under about 15 words with the source named.
- Fiction objects: `reality: "fiction"` and a visible badge; `basedOn` links to the real equivalent.

## Starter list: about 40 real objects

IDs: SBDB checked live on 2026-11-22 (names resolved; SPK IDs shown where I saw them). Horizons IDs and other items marked (to check) are from general knowledge and must be confirmed by the build script. "3D" says whether an open shape or model exists that I found.

### Star and planets

| # | Object | Best source for facts | 3D / shape |
|---|---|---|---|
| 1 | Sun | NASA Science (Sun page) + Horizons (10) | Sphere; texture already in project |
| 2 | Mercury | NASA fact sheet (NSSDC planetary fact sheets) + Horizons (199) | Sphere + map; MESSENGER model (glb) |
| 3 | Venus | NSSDC fact sheet + Horizons (299) | Sphere; Magellan model (glb) |
| 4 | Earth | NSSDC fact sheet + Horizons (399) | Sphere |
| 5 | Mars | NSSDC fact sheet + Horizons (499) | Sphere; MRO, MAVEN, rovers in NASA 3D |
| 6 | Jupiter | NSSDC fact sheet + Horizons (599) | Sphere; Juno model |
| 7 | Saturn | NSSDC fact sheet + Horizons (699) | Sphere; Cassini model |
| 8 | Uranus | NSSDC fact sheet + Horizons (799) | Sphere |
| 9 | Neptune | NSSDC fact sheet + Horizons (899) | Sphere |

### Major moons

| # | Object | Best source | 3D / shape |
|---|---|---|---|
| 10 | Moon | NSSDC, LRO data, Horizons (301) | LRO-based displacement already used (SVS CGI Moon Kit); NASA 3D has lunar terrain |
| 11 | Phobos | NASA/Horizons (401); mission papers | Texture in NASA 3D "Images and Textures"; shape model on PDS (to check) |
| 12 | Deimos | same (402) | Texture in NASA 3D |
| 13 | Io | NASA Science + Horizons (501) | Sphere; map not verified |
| 14 | Europa | NASA Science + Horizons (502) | Sphere; texture already used |
| 15 | Ganymede | NASA Science + Horizons (503); ESA JUICE page for context | Sphere |
| 16 | Callisto | same (504) | Sphere |
| 17 | Titan | NASA Science + Horizons (606); Huygens | Texture in NASA 3D |
| 18 | Enceladus | NASA Science + Horizons (602) | Sphere; texture already used |
| 19 | Triton | NASA Science + Horizons (801); Voyager 2 | Sphere |
| 20 | Charon | NASA Science + Horizons (901); New Horizons | Sphere |

### Dwarf planets, asteroids, comets

| # | Object | Best source | 3D / shape |
|---|---|---|---|
| 21 | Pluto | SBDB 134340 (diameter is null there; use New Horizons papers), Horizons (999) | Sphere |
| 22 | Ceres | SBDB 1 (spk 20000001, D 939.4 km); Dawn | Sphere; map already used |
| 23 | Eris | SBDB 136199 (no diameter in SBDB) | Sphere |
| 24 | Haumea | SBDB 136108 (rot 3.92 h; ellipsoid; no SBDB diameter) | Ellipsoid, build from literature |
| 25 | Makemake | SBDB 136472 (no SBDB diameter) | Sphere |
| 26 | Vesta | SBDB 4 (spk 20000004, D 522.8 km); Dawn | STL in NASA 3D "3D Printing" (several) |
| 27 | Pallas | SBDB 2 (D 513 km) | Sphere/ellipsoid; DAMIT shapes exist, licence unverified |
| 28 | Eros | SBDB 433 (D 16.84 km volume-equivalent; extent 34.4 x 11.2 x 11.2) | STL in NASA 3D |
| 29 | Itokawa | SBDB 25143 (D 0.33 km) | STL in NASA 3D |
| 30 | Bennu | SBDB 101955 (D 0.484 km); OSIRIS-REx | `.glb` in NASA 3D ("1999 RQ36 asteroid") and STL |
| 31 | Ryugu | SBDB 162173 (D 0.896 km); JAXA facts only | No open model found; shape data in published papers (licence unverified) |
| 32 | Didymos / Dimorphos | SBDB 65803 (D 0.78 km); DART | DART STL in NASA 3D; shape models from the DART team (to check) |
| 33 | Arrokoth | SBDB 486958 (no SBDB diameter; use New Horizons papers) | No open model verified |
| 34 | Halley (1P) | SBDB 1P (D 11 km); Giotto and Vega imagery (ESA, Soviet) | No open model; use procedural |
| 35 | 67P/Churyumov-Gerasimenko | SBDB 67P (D 3.4 km, rot 12.76 h); Rosetta (ESA) | Shape model exists from the Rosetta teams; licence not verified |

### Probes, stations, telescopes

| # | Object | Best source | 3D / shape |
|---|---|---|---|
| 36 | Voyager 1 (and 2) | NSSDC + Horizons (-31, -32) | `.glb` NASA 3D (Voyager A, B) |
| 37 | Cassini (final position: Saturn atmosphere, 2017) | NSSDC; Horizons (-82) to check | `.glb` NASA 3D (Cassini-Huygens) |
| 38 | Juno | NSSDC + Horizons (-61) to check | `.glb` NASA 3D (A, B) |
| 39 | New Horizons | NSSDC + Horizons (-98) to check | None found in NASA 3D; build procedurally |
| 40 | Parker Solar Probe | NSSDC + Horizons (-96) to check | `.glb` NASA 3D |
| 41 | Pioneer 10 | NSSDC; Horizons coverage doubtful | `.glb` NASA 3D (Pioneer 11 not found) |
| 42 | OSIRIS-REx | NSSDC | `.glb` NASA 3D |
| 43 | Hayabusa2 | JAXA mission page (facts only) | No open model found |
| 44 | Rosetta / Philae | ESA mission page + NSSDC | Rosetta `.glb` in NASA 3D (rights to confirm) |
| 45 | JUICE and Hera | ESA mission pages (facts); Horizons if tracked | None verified |
| 46 | International Space Station | NASA ISS pages + NSSDC | `.glb` in NASA 3D (five variants) |
| 47 | Tiangong | Facts only (CNSA/CMSA; not fetched, unverified) | None found; build procedurally from public dimensions |
| 48 | James Webb Space Telescope (Sun-Earth L2) | NASA Webb pages | `.glb` in NASA 3D (A, B) |
| 49 | Hubble | NASA Hubble pages (ESA is a partner; credit both) | `.glb` in NASA 3D (A, B) |
| 50 | Perseverance and Ingenuity (landing site: Jezero Crater) | NASA Mars 2020 + USGS names | `.glb` in NASA 3D |

That is 50 rows, a little over the "about 40" asked for; items 1 to 9 can be skipped for v1 if the list should shrink, since the planets are already in the game. A sensible v1 core is rows 10 to 46 (the interesting things the player can fly to) plus the eight planets as they already exist.

Also worth later: 'Oumuamua (SBDB 1I; interstellar kind), Apophis (SBDB 99942), Hale-Bopp (SBDB C/1995 O1), Psyche, Lutetia, Mathilde, Ida, Gaspra, Phaethon (all resolved live in SBDB), Apollo landing sites (names from the Gazetteer; NASA 3D has landing-site 3D prints), Gaia (ESA; at Sun-Earth L2).

## Suggested next steps

1. Decide the AI-language and ESA questions below, because they affect how the info panel is worded.
2. Build `tools/build-facts.ts` for SBDB and Horizons first (no licence doubt there) and the 20 or so objects that have NASA 3D models.
3. Add the credit lines for NASA, JPL, ESA, JAXA, MPC and Wikidata to CREDITS.md as sources are used (BACKLOG rule 5).
4. Verify per asset, before shipping any ESA or JAXA media: use the asset's own credit and licence line.

## Open questions for David

1. NASA's media page now has a section on AI-generated products that says not to attribute information to NASA ("according to NASA") and to mark AI-generated output. The game text is written with Claude and reviewed by you. Do you want us to (a) treat the panel as AI-assisted and label it, with a plain "Sources" list and no "NASA says", or (b) treat it as human-authored since you review it? I could not confirm how NASA applies it.
2. ESA images are "education, editorial, information" and exclude commercial use such as "entertainment". Is a free fan game close enough to educational, or should ESA media be left out and only linked? Also the ESA terms bar association with violence; the game has a story about wars. Recommend: no ESA images in the game, ESA facts and links only, unless you decide otherwise.
3. JAXA forbids any modification of images. OK to carry JAXA facts and links only, with no JAXA pictures?
4. Should the research on ISRO and CNSA (Tiangong, Chandrayaan, Chang'e) be done as a follow-up? I did not fetch their terms.
5. NASA 3D Resources lists two licence statements (without copyright vs NASA Open Source Agreement). Fine to rely on the NASA media guidelines and note the discrepancy, or do you want a written query to `arc-special-proj@lists.nasa.gov`?
6. Do you want a date control (E2.4.b) to need Horizons ephemerides for spacecraft at a chosen date, or only today's date? That decides whether the bundled data is one state vector per object or a time series (a larger file).
