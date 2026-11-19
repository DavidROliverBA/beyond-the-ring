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
- [ ] T plays the tour from where you are; any key hands control back where you were.
- [ ] Near Tycho, aim at a ship or the station and press I: the camera glides in; move the mouse to circle it, wheel to zoom; I again to fly on. Do the new hull textures, grime and lit windows look right up close?
- [ ] P (photo mode): HUD gone, time frozen, mouse looks, [ ] exposure, Enter saves a PNG, P again to fly on.
- [ ] Fly through the Ring into the ring space, then out through a gate.

## 3. Docking and walking (10 minutes)
- [ ] Dock at Ceres (L when close). No freeze when the screen comes back, nor when you first turn round.
- [ ] Walk (W A S D, Shift to run). Starting and stopping should feel eased, not instant. You slide along walls and step round people.
- [ ] Concourse entrance: people walk both ways, turn round in a small arc, sometimes stop and stand. Do they look natural from a few metres? Do their feet slide?
- [ ] The Medina market: neon look, crowd, no glowing heads.
- [ ] The location panel shows "station time" matching your clock.
- [ ] Tycho, Ganymede and Medina (the drum, from the ring space): people stand upright, nothing floats.
- [ ] Photo mode on foot.

## 4. Things to report
- Any freeze or stutter, and where.
- Anything that looks wrong at a glance: shapes, lighting, scale.
- Anything confusing about the controls.
- Browser and machine used.
