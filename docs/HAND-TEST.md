# Hand test: flying and walking by a person

Headless tests check that things load, move and don't error. They can't judge how it feels. This list is for a person at a real browser, at https://silken-marvel-d95y.here.now/ or `bun run dev` (http://localhost:5180/). Try Chrome first, then Safari and Firefox if you have time.

Note what felt wrong and where. "Fine" is a useful answer too.

## 1. Start screen (2 minutes)
- [ ] The system plays behind the start text: Earth, then Luna, the Sun, Mars and on, with a fade at each cut. Subjects sit to the right of the text.
- [ ] Launch puts you at Earth with control.

## 2. Flying (5 minutes)
- [ ] Click the view, then steer with the mouse. Does it feel responsive but not twitchy?
- [ ] W/S throttle, X cut, Q/E roll, V chase/cockpit view.
- [ ] Pick a destination from the list (Tab). Does the autopilot arrive smoothly?
- [ ] Fly towards the Sun: soft rays and a faint lens halo, not a washed-out screen.
- [ ] Look at Earth's night side: dark, city lights, now and then a lightning flash in the clouds. Day side: a light blue haze, thin blue limb.
- [ ] The ship is the Rocinante (name under the speed readout). Her drive plume is a long white-blue beam, brighter with a harder burn, off when you coast. Do you see it from the chase view (V toggles chase and cockpit)?
- [ ] Pick a far destination (Tab, click Neptune). The autopilot burns, coasts, then **flips end over end** and burns the other way to arrive at rest; the readout says FLIPPING and BURNING TO ARRIVE. Does the flip look right, and does the camera follow slowly enough to watch it?
- [ ] Build up speed with W, then press X: the ship flips, burns to a stop and turns back to the way she pointed (W cancels it). Any key during an autopilot flip hands the helm back.
- [ ] **Star map (M, or the MAP button bottom left).** Planets sit at their true angles on a log scale out from the Sun; scroll to zoom (moons, stations and ships gather round their planet), drag to move, F finds your ship. Click a place (or find it in the list on the left): a dashed route appears from your ship with a FLIP marker where she will turn end over end, plus distance and trip time. PLOT COURSE (or Enter, or double-click) hands it to the autopilot. Does the ETA match the flight? Try the ring space (#slow) too, where every gate shows.
- [ ] Look up: the stars are the real sky (Orion with orange Betelgeuse, Sirius, the Southern Cross, the Milky Way as a band). Do the colours and groupings look right to you?
- [ ] **Voyages (T).** A chooser opens: Quick look, The inner system, The Belt and the giants, To the edge of Sol, Ships and stations, Rocks comets and dwarfs, Through the Ring, The new worlds. Pick one (1–8). The camera sets off towards each place facing it, so you watch it grow from a point, sweeps round its lit side, then turns to the next; there is a caption at each stop, the HUD fades out, and any key hands your ship back where you left it. Through the Ring and The new worlds go through the gates to Adro, Ilus and Laconia and come home; do the cuts at each gate feel right, and does the flight between places read as travel?
- [ ] **Map, NEARBY (M, then V or the NEARBY button).** A live plan view round your ship, to scale, with rings in kilometres and every ship under way as a green arrow with its heading. Click one (or the list on the left, nearest first) and PLOT COURSE: the autopilot chases it, flips, and brings you alongside; the readout says ALONGSIDE and you fly with her until you press W or steer. Does the chase feel right? Zoom right in and out with the wheel.
- [ ] **Small worlds.** Eros, Psyche, Ida (lumpy, elongated rocks), Halley, Hale-Bopp and the other comets (blue gas tail straight out from the Sun, yellow dust tail curving: view from the side), the dwarfs beyond Neptune, more moons round Jupiter, Saturn, Uranus and Neptune, and Trojan swarms ahead of and behind Jupiter. Are there enough, and do the comets look like comets?
- [ ] **Time (`,` slower, `.` faster).** The planets, moons and comets go round: the readout under the ship name shows elapsed time and the rate (starts at 1 hour a second). Watch Io and Luna circle; try 100 days/s and watch Mars and Earth sweep round the Sun. Park near a planet at a fast rate: you should go round with it, not be left behind. Plot a course to a planet at 1 day/s: it should still arrive alongside.
- [ ] **Sound (K to turn off and on).** A drive roar that rises with throttle, thruster hiss while turning and flipping, a quiet ship hum, a low swell in the ring space, room air and footsteps on foot, small tones for the map and autopilot, a sweep at gates and docking. Too loud, too quiet, annoying? (Headless tests only prove it plays, not how it sounds.)
- [ ] Ship traffic now moves at believable speeds (a hop across the system takes days, so those ships look nearly still); the map's trip time includes turning to face the target and settling, matching four measured flights.
- [ ] Every ship's drive now has the Rocinante's long beam, smaller on the parked and distant ones, and the red and green lights on hulls flash. Any ship that looks wrong, too bright or too dark?
- [ ] Near Tycho, aim at a ship or the station and press I: the camera glides in; move the mouse to circle it, wheel to zoom; I again to fly on. Do the new hull textures, grime and lit windows look right up close?
- [ ] P (photo mode): HUD gone, time frozen, mouse looks, [ ] exposure, Enter saves a PNG, P again to fly on.
- [ ] Fly through the Ring into the ring space, then out through a gate.

### The ring space, now at true scale
Start there directly with `#slow` on the address, or arrive through the Ring.
- [ ] At the Ring Station (5 km across): look round. The gates should be a sphere of small lights all about you, the charted ones amber with names, Sol's white.
- [ ] Tab, "Medina Station": a few seconds' hop (45 km). Ships round it should be the right size beside your own and move at a believable pace, not as a blur. Press I to circle Medina, then L to dock, and E at the lift to come back out.
- [ ] Tab, any charted gate (or type a number, or Random). The trip should take about half a minute: a quick run up to the speed limit (0.10 c on the dial, with the "Speed limit" hint), dust streaking then gone, then a long ease down as the gate grows from a dot to a hoop that fills the view. Does the wait feel right, too long, too short?
- [ ] Parked in front of a gate: it should look huge (1,000 km across; your ship is a speck). The film moves, and the glow in the middle is the colour of the star on the far side. Does the change from far dot to full hoop happen without a visible jump?
- [ ] Hold W and fly through the middle: you arrive in that system. Turn round, come back through its gate, and you should be back in front of the same gate in the ring space.
- [ ] From one gate, pick another on the far side of the list: the autopilot should cross in under a minute and steer round the Ring Station if it is in the way.
- [ ] Fly by hand near the wall: G takes you to the nearest gate; F to whatever is under the crosshair. Try to fly out between the gates: you should be held just outside the wall.
- [ ] Look back from a gate: the station and Medina's traffic should be a small knot of lights in the middle of the dark.
- [ ] T for the tour here: station, Medina, the Sol gate, the Adro gate.

## 3. Docking and walking (10 minutes)
- [ ] Dock at Ceres (L when close). No freeze when the screen comes back, nor when you first turn round.
- [ ] Walk (W A S D, Shift to run). Starting and stopping should feel eased, not instant. You slide along walls and step round people.
- [ ] Concourse entrance: people walk both ways, turn round in a small arc, sometimes stop and stand. Do they look natural from a few metres? Do their feet slide?
- [ ] The Medina market: neon look, crowd, no glowing heads.
- [ ] The location panel shows "station time" matching your clock.
- [ ] Tycho, Ganymede and Medina (the drum, from the ring space): people stand upright, nothing floats.
- [ ] Photo mode on foot.

## 3b. Spin gravity (5 minutes)
Ceres, Tycho and Medina make their gravity by turning, so which way you run matters. Watch the location panel: it shows your weight in g as you move.
- [ ] Medina, "Mid-drum". Turn to face round the drum (the ground rising ahead of you) and run (Shift + W). One way you should feel heavy: quick short strides, eyes a touch lower, about 0.9 g on the panel. Turn round and run the other way: long slow floating bounds, about 0.05 g, and you take longer to stop. Is the floating pleasant or queasy?
- [ ] Medina: face along the drum (towards an end cap) and run for five seconds, aiming at something far off. You should be carried a couple of metres to one side, always the same side whichever end you face. Noticeable, but easy to steer against? Walking should not be carried at all.
- [ ] Medina: look up and round. The ground should curve up and over on both sides, and your feet should stay down wherever you walk round the drum.
- [ ] Tycho, the ring corridor: run its length both ways. Heavier one way (about 0.6 g), lighter the other (about 0.15 g).
- [ ] Ceres, the Concourse: run away from the entrance, then back. A gentler version: about 0.4 g out, 0.2 g back, strides a little longer on the way back. Is it enough to notice without the panel?
- [ ] Ganymede is a moon, not a wheel: nothing changes with direction there.
- [ ] `?spin=off` in the address puts walking back as it was; `?spin=real` shows the true sizes (Ceres: nothing to feel). Does the default feel better than off?

## 3c. Layout and wear (10 minutes)
Every station now has grime, clutter, railings and signs that tell you where things are. `?wear=off` in the address shows each place as it was, for comparison.
- [ ] Tycho, docking bay: the berth is boxed in warning stripes, there are catwalks along both walls and a sign over the corridor door. Does it read as a working bay, or as clutter?
- [ ] Tycho, ring corridor: follow the blue line on the floor from the bay door. It should take you to the bar. The green one goes to Operations, the orange one runs the whole corridor. Read the hanging signs walking both ways: do the arrows point the right way from where you stand?
- [ ] Tycho, yard gallery: the handrail and the viewers at the window. Can you still walk the length of the window?
- [ ] Ceres, dock to market: walk from the ship through the rails, the scanner arch and past the desk. Nothing should snag you. In the Medina, find the directory pillar near the middle and check one arrow on each face against where the door really is.
- [ ] Ceres, the Medina: bins, sacks by the stalls, litter, drips on the rock. Dirty enough? Too dirty? Do the queues at the stalls still form with the bins about?
- [ ] Ceres, tube station: the yellow line and rails at the platform edge.
- [ ] Ceres, the Concourse: should still look clean and bright. Worn paths down both sides, bins by planters, a directory to one side of the way in and three more down the middle.
- [ ] Ganymede: walk from the pad through the gate and down the path. The lights should be gentle under the sun, not neon. Does the stand by the gate look like it belongs?
- [ ] Medina, bow lift: the market street with its strings of bulbs. Walk round a stand and up to a counter. At "Mid-drum" there is a signpost: face round the drum the way the ground rises ahead and the bow should be on your left.
- [ ] Anywhere: did you get stuck on anything, or find something standing in a doorway or in a person?
- [ ] Frame rate: does any station feel slower than before?

## 4. Things to report
- Any freeze or stutter, and where.
- Anything that looks wrong at a glance: shapes, lighting, scale.
- Anything confusing about the controls.
- Browser and machine used.

- [ ] **New ship models** (dreadnought, survey ship, freighter, racer, stealth ship, Medina, corvette legs): radiators, masts, turrets, container rows, drop tanks, folded legs. Look at them close (I to inspect) and from afar in traffic: any that look wrong or too busy? Weight check: any slower where there are many ships?
- [ ] **Smoother tours and flips.** On a voyage the camera no longer stops dead on arriving at each place: the sweep round it picks up at the speed the flight in arrives with, then eases to rest before setting off. During a flip-and-burn (autopilot or X) the camera now holds the way you are travelling while the ship swings round in front of it, then settles back behind her afterwards. Does the flip read better? Any jolt as the camera settles?
- [ ] **Tour judder.** The film runs on a smoothed frame time, so a slow frame no longer makes the camera leap; surface maps for a place are now prepared as the flight to it begins, and big photo maps are decoded off the main thread. There may still be one brief pause when a big map reaches the screen (Venus, Earth, Jupiter). Is the approach and circling smooth now? Where does it still catch?
- [ ] **The Ring (new model).** From Sol, fly to the Ring and look at it from far, from 10 hoop-widths and from near the rim: plates, ribs, lamp channels, towers, and a swirling film in the middle. Same in the ring space at a gate. Too bright, too dark, too busy? (Far gates in the ring space are still the plain hoop.)
- [ ] **Ships at Tycho.** Stay at Tycho for a few minutes: ships should sidestep one another, the station and the parked ships, not pass through them. Any that still do?
- [ ] **True sizes.** The aim card now shows each object's true width ("999 m across"). Planets, moons and orbits were already true to scale; ship classes now share one length everywhere (dreadnought 800 m, hauler 500 m). Anything still look the wrong size beside something else?
- [ ] **Cinematic tours (T).** Widescreen bars, captions as a lower third, a graded and slightly grainy picture, blue streaks off bright lights, faint colour fringing at the edges, a slow hand-held sway and a lean into turns. The camera now never stops between places: each flight sets off at the speed the last sweep ended with, turns ease in and out (no whip pans), the lens widens in flight and settles long on arrival, and the subject sits off the middle of the frame. Shot types vary: sweep round the lit side, reveal (start behind with the star on the edge), low skim over the surface, side-on track for ships, pull back from a detail. Gates: the Ring is framed face on, then the camera dives through its middle, the film fills the screen, and the next place begins at the gate's other side. A soft ambient score swells in under the tour, with a whoosh at each flight. Is it too much? Anything nauseating (sway, lean, lens change)? Does the framing lean the right way? Does the score suit?

## Reversed-Z depth (2026-11-22)
- [ ] Fly close to a ship and a planet, and tour the Sol voyages: no flicker, no parts of hulls missing or drawn through each other, no planets drawn in front of nearer ships.
- [ ] Dock at Tycho and walk: smoother than before on your Mac.
- [ ] Try Safari and Firefox. If the picture breaks, add `?logdepth` to the address to compare, and tell me which browser.

## Facts panel for Earth and Luna (2026-11-22, branch real-facts)
- [ ] Aim at Earth (or Luna): the aim card shows a green REAL tag and "I — facts and sources". Press I: the camera glides in as before and a panel opens on the right with the numbers, what we know, what we do not, the missions and links. I again (or the x) closes both.
- [ ] Esc frees the mouse; click a link in the panel (it opens NASA's page in a new tab). Do the numbers match the sheet it links to?
- [ ] The panel says "AI-assisted summary, sources below" and nothing reads as "NASA says". Is the wording right to you, and does anything look wrong or too sure?
- [ ] Aim at Tycho, a ship, a gate: the aim card shows a purple FICTION tag. Mars and the other bodies show no tag yet. With H open the panel shrinks above the key list; on a phone it sits at the bottom.

## Facts panels for every real body, and "based on" for the story's places (2026-11-22, branch facts-all-bodies, not merged)
All of this text is AI-assisted and flagged `humanReviewed: false`. Please read it as a sceptic, and say which panels to fix.
- [ ] Fly to a few real bodies (the Sun, Mars, Phobos, Io, Titan, Pluto, Ceres, Eros, Halley, Haumea, Sedna). Each aim card has a green REAL tag and "I — facts and sources"; I opens a panel with numbers, what we know, what we do not, missions and links. Bodies with no panel (Oort Cloud, Amalthea, Himalia, Mimas, Tethys, Dione, Hyperion, Phoebe, Ariel, Umbriel, Proteus, Nereid, ships, gates) show no REAL tag, which is deliberate for now.
- [ ] Check ten numbers against the sheet each one links to (NSSDCA fact sheet, or the JPL Small-Body Database entry for asteroids, dwarf planets and comets). Anything that differs? Mass for small bodies is worked out from the catalogue's GM, and the panel says so.
- [ ] Read the "What we know" and "What we do not know" lists as a sceptic: is any line wrong, too sure, or something you would not say? Facts not on a sheet (for example Hayabusa2 returning a sample, the Halley fleet of 1986, Ida's moon Dactyl) come from general knowledge and need a source check.
- [ ] Missions: only spacecraft whose NSSDCA Master Catalog page we could fetch are listed, so Galileo, Cassini, Magellan, Rosetta, Hayabusa2 and Giotto are missing from the lists for now. For moons, a mission is listed when its catalogue page names the planet, not always the moon; check that each flyby claimed for a moon is right (Voyager at Miranda, Titania, Oberon, Triton, Enceladus, Rhea, Iapetus, Callisto, Europa, Ganymede).
- [ ] Walk into Ceres Station, Tycho Station, Medina Station or Ganymede: the location line says "Fiction · I: what is real". I opens a panel with "what is real about it" and "what is made up". For Ceres Station and Ganymede the "see the real Ceres / Ganymede" link opens the real body's panel; "back" returns. Does the "based on" wording seem fair and modest?
- [ ] Tycho Station from space: purple FICTION tag, "Based on rotating space-habitat designs such as the O'Neill cylinder and the Stanford torus", and I opens a short panel. Is the Stanford torus / O'Neill cylinder pairing right to you?
- [ ] On a phone width the panel sits at the bottom; the lists after "What we know" start folded (tap the heading with the mouse free, Esc). Is the panel readable, and is it too tall?
- [ ] Haumea, Makemake, Eris, Orcus, Quaoar, Sedna, Gonggong, ʻOumuamua and Borisov show no diameter because the Small-Body Database has none; each says so under "What we do not know". Would you rather have curated sizes from another source?

## The Rocinante's voyages: The Canterbury (2026-11-22, branch scenario-engine, not merged)
- [ ] Press T, choose "The Rocinante's voyages" (9). A card should warn "Spoilers for Leviathan Wakes" and list The Canterbury. Enter or a click starts it; Esc closes the card.
- [ ] Watch all 190 seconds: widescreen bars, graded picture, lower-third captions. The hauler flips and brakes, the shuttle crosses and comes back, two torpedoes run in, the hauler is vaporised in a flash and shell, and the shuttle burns away through the debris. Is the pacing right? Is anything too bright, too dark, too slow, or nauseating (flash, sway)? Can you see the stealth ship at all (it is deliberately black; a muzzle flash lights it for a moment)?
- [ ] Any key hands the ship back where you left it, with the normal HUD returning. Does it? At the end the film hands back by itself with a closing line.
- [ ] No sound design yet: only the tour score plays. Does the silence at the blast read, or should the score fade out there?
- [ ] Any hitch at the start (a lamp is added to the scene, which recompiles shaders once) or at the blast (first frame of the flash).
- [ ] Safari and Firefox: the flash and trails with and without `?logdepth`.
- [ ] Facts to check against the books (the research could not read them): Canterbury and Knight sizes, whether the Knight is nearly hit by debris, where the Scopuli ends up, how many missiles. Each actor's confidence is in `src/scenarios/canterbury.ts` and shown with `?debug`.

## The Rocinante's voyages: The Donnager (2026-11-22, branch combat-donnager, not merged)
- [ ] T, 9, arrow down, Enter: the card lists The Canterbury and The Donnager. Watch all 200 s: tracer bursts, railgun lines, breaches venting, explosions along the hull, the Tachi leaving the belly hangar, the scuttling, the run. Too dark in places? (83-93 s is quiet and dark.) Do the stealth ships read at all?
- [ ] Sound, on speakers: inside the Donnager (28-42 s) PDC rattle, impact and railgun thump; inside the Tachi (132-150 s) drive roar and her cannons; wide exterior shots silent apart from the score, which fades at the scuttling. Too loud, too boomy, too clicky?
- [ ] Any hitch at the start (one ~90 ms pause as everything is drawn once) or mid-film. Safari and Firefox, with and without `?logdepth`.
- [ ] Facts the research could not settle: number of attackers (we show four, invented), whether the Tachi has a railgun, boarding (not shown). Confidence is in `src/scenarios/donnager.ts` and `?debug`.

## Data and maths (2026-11-22, branch data-and-maths, not merged)
- [ ] Start screen: below the credits line there is a line about facts from NASA NSSDCA and JPL, "not yet checked by a person", with a "Data and sources" link. Click it: a short account opens inside the box (counts, three source families, licence, link to CREDITS.md); click again to close. Does it read as honest and not too long? Launch closes it.
- [ ] In flight, aim at Phoebe, Hyperion, Nereid, Ariel (the 11 new moons: Amalthea, Himalia, Mimas, Tethys, Dione, Hyperion, Phoebe, Ariel, Umbriel, Proteus, Nereid) and press I: each has numbers, a Real tag, what we know / do not know, links. Check a few of the sentences against what you know; Himalia, Proteus and Nereid show no density because the sheet lists none. At the foot of the panel, "Data and sources" opens the same account with a back link.
- [ ] Mars now lists 17 missions and the Moon 9; is the folded "Missions that visited" list too long on a phone?
- [ ] Person review: `bun tools/review-facts.ts` lists the 71 unchecked entities; `--show mars` prints one with its sources. If you want to try an approval, use a scratch copy (`--file` and `--reviews` point at other files), because a real approval is recorded in tools/facts-reviews.json. The panel then says "Checked by a person: name, date, note".
- [ ] Honest transit times (src/transit.ts) are tested but not shown anywhere yet; the Canterbury burn should look exactly as before (it is bit-identical in the numbers; seeking at 0, 20, 40, 60 s gives the same positions).
