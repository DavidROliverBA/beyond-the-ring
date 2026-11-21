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
