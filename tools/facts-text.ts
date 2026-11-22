// The words for every real body beyond Earth and the Moon, and for the fiction that has a real analogue
// (BACKLOG E2.2.b, E2.3.c). Written for this game in our own words, drafted with AI help from the sources
// linked on each panel; no agency prose is copied and nothing is phrased as the agency speaking.
// Numbers that appear in the sentences are ones printed on the cached sheets (see facts-curated.ts) or
// stated by a reader-checkable source; every entity ships with humanReviewed = false until a person checks it.
import type { EntityKind, Link } from '../src/facts';

export interface BodyText { name: string; kind: EntityKind; summary: string; know: string[]; unknown: string[]; links?: Link[] }
const sci = (label: string, path: string): Link => ({ label: `NASA Science: ${label}`, url: `https://science.nasa.gov/${path}/` });

export const BODY_TEXT: Record<string, BodyText> = {
  sun: {
    name: 'The Sun', kind: 'star',
    summary: 'The star at the centre of the solar system: a ball of hot hydrogen and helium holding more than 99% of the system’s mass and lighting every world in it.',
    know: [
      'It is about 333,000 times as massive as Earth and 109 times as wide, and it is a yellow-white dwarf star of spectral type G2 V.',
      'Its visible surface is around 5,772 K, and by number of atoms it is roughly 91% hydrogen and 9% helium.',
      'It does not spin as one piece: the equator turns faster than the poles, and the rotation time quoted is for 16 degrees of latitude.',
      'Sunspots and flares rise and fall in a cycle of about 11 years, and its magnetic field drives that.',
    ],
    unknown: [
      'Why the corona, the Sun’s outer atmosphere, is hundreds of times hotter than the surface beneath it is still being worked out.',
      'How the magnetic cycle is generated deep inside, and why one cycle is stronger than the next, cannot yet be predicted well.',
    ],
    links: [sci('Sun', 'sun')],
  },
  mercury: {
    name: 'Mercury', kind: 'planet',
    summary: 'The smallest planet and the closest to the Sun: a cratered, airless world with a huge metal core and swings of heat and cold.',
    know: [
      'It is only about 40% wider than the Moon, yet its density, 5,429 kg/m³, is nearly Earth’s, so a large share of it must be metal.',
      'It turns exactly three times for every two orbits, which makes one sunrise-to-sunrise day last about 176 Earth days.',
      'It has no true atmosphere, only a thin exosphere, and a magnetic field about a hundredth as strong as Earth’s, discovered by spacecraft.',
      'Its axis is almost upright, so the floors of some deep polar craters never see sunlight.',
    ],
    unknown: [
      'How it ended up with such a large metal core for its size. Ideas include a giant impact that stripped away rock, but none is settled.',
      'How much of the material in its polar shadows is water ice, and where it came from.',
    ],
    links: [sci('Mercury', 'mercury')],
  },
  venus: {
    name: 'Venus', kind: 'planet',
    summary: 'Earth’s near twin in size, but wrapped in a crushing carbon dioxide atmosphere that makes it the hottest planet.',
    know: [
      'The surface sits near 737 K under about 92 bars of air, which is mostly carbon dioxide, and the heat does not change between day and night.',
      'It turns backwards (retrograde) and very slowly: one spin takes about 243 Earth days, longer than its 225-day year.',
      'Its axis is tilted about 177 degrees, which is the same as being upside down.',
      'Radar from orbit has mapped the surface through the clouds, showing volcanoes, plains and few craters.',
    ],
    unknown: [
      'Whether any volcano is erupting now. Signs of recent lava flows have been reported, but activity is not confirmed.',
      'How and when it lost its water, and whether it ever had a cooler, wetter past.',
      'Why it turns the wrong way round; a giant impact and tides in its thick air are among the ideas.',
    ],
    links: [sci('Venus', 'venus')],
  },
  mars: {
    name: 'Mars', kind: 'planet',
    summary: 'A cold, dry, red desert world with a thin carbon dioxide atmosphere, giant volcanoes and the dry beds of ancient rivers.',
    know: [
      'A day on Mars is a little longer than Earth’s, 24.6 hours, and its axis is tilted about 25 degrees, so it has seasons.',
      'Surface air pressure is about 6 millibars, under 1% of Earth’s, and the average temperature is around 214 K.',
      'It has two small moons, Phobos and Deimos.',
      'Landers and rovers have found rocks laid down in water, so liquid water once lay on the surface.',
    ],
    unknown: [
      'Whether life ever arose there. Rover samples are being collected so that they can one day be studied on Earth.',
      'Where all of its early water went, and how long lakes lasted.',
      'How much ice lies below the surface and how deep it goes.',
    ],
    links: [sci('Mars', 'mars')],
  },
  phobos: {
    name: 'Phobos', kind: 'moon',
    summary: 'The larger and closer of Mars’s two small moons: a dark, cratered, potato-shaped lump that circles low over the planet.',
    know: [
      'It is about 26 km long, and it orbits only 9,378 km from the centre of Mars, closer than any other moon in the solar system is to its planet.',
      'It goes round in about 7.7 hours, faster than Mars turns, so from the surface it would rise in the west and set in the east.',
      'Its density, 1,900 kg/m³, is low enough to suggest a loosely packed or porous body.',
      'Tides are slowly pulling it towards Mars, so it will eventually break up or hit the planet.',
    ],
    unknown: [
      'Where it came from: a captured asteroid, or debris that came together after something struck Mars. Both ideas have supporters.',
      'What it is made of under the dust, and what the grooves across its surface mean.',
    ],
    links: [sci('Mars', 'mars')],
  },
  deimos: {
    name: 'Deimos', kind: 'moon',
    summary: 'The smaller, farther moon of Mars: a smooth-looking, dusty body only about 16 km long.',
    know: [
      'It orbits about 23,459 km from Mars and takes about 30 hours to go round, longer than a Martian day.',
      'Its density, about 1,750 kg/m³, is similar to Phobos’s.',
      'Dust has filled many of its craters, giving it a smoother look than Phobos.',
    ],
    unknown: [
      'Whether it and Phobos share an origin.',
      'Its composition is only known from distant measurements; no spacecraft has landed on it.',
    ],
    links: [sci('Mars', 'mars')],
  },
  jupiter: {
    name: 'Jupiter', kind: 'planet',
    summary: 'The largest planet: a gas giant of mostly hydrogen and helium, with bands of cloud, huge storms and dozens of moons.',
    know: [
      'It is more than 300 times Earth’s mass and its atmosphere is about 90% hydrogen and 10% helium by number of molecules.',
      'It turns in under 10 hours, the fastest of any planet, which stretches its clouds into bands and flattens it at the poles.',
      'The Great Red Spot is a storm bigger than Earth, seen for well over a century.',
      'It has faint rings and a very strong magnetic field.',
      'Its count of moons stands at 95 on the sheet we read, and rises as new ones are found.',
    ],
    unknown: [
      'How big and how well-defined its core is. Data from orbit suggest the centre is more spread out than once thought.',
      'How deep the winds and bands go.',
      'How it formed so quickly, before the gas of the young solar system disappeared.',
    ],
    links: [sci('Jupiter', 'jupiter')],
  },
  io: {
    name: 'Io', kind: 'moon',
    summary: 'The most volcanic body known: a sulphur-coloured moon of Jupiter that is constantly resurfaced by eruptions.',
    know: [
      'It is slightly bigger than the Moon and the densest of Jupiter’s four large moons, 3,530 kg/m³, so it is mostly rock and metal with very little ice.',
      'Jupiter and the other large moons keep squeezing and stretching its orbit, and the heat made by that flexing drives the volcanoes.',
      'It goes round in 1.77 days, with the same face always towards Jupiter.',
      'It sits deep inside Jupiter’s radiation belts.',
    ],
    unknown: [
      'How much molten rock lies under the crust, and whether it forms a global ocean of magma or scattered pockets.',
      'Exactly how much heat it loses and how that changes over time.',
    ],
    links: [sci('Jupiter', 'jupiter')],
  },
  europa: {
    name: 'Europa', kind: 'moon',
    summary: 'A moon of Jupiter with a cracked, young-looking shell of ice that is believed to cover a deep salty ocean.',
    know: [
      'It is a little smaller than the Moon, with a density of 3,010 kg/m³: rock and metal inside under a layer of water that is mostly frozen at the top.',
      'Its surface has few craters, which tells us it is geologically young and is renewed.',
      'The mean surface temperature is about −170 °C.',
      'It orbits in 3.55 days, with the same side always to Jupiter.',
    ],
    unknown: [
      'How thick the ice is, and whether the ocean below touches rock where chemistry for life might happen.',
      'Whether water vapour erupts from it as plumes.',
      'Whether anything lives there; a mission launched in 2024 is on its way to study it.',
    ],
    links: [sci('Jupiter', 'jupiter')],
  },
  ganymede: {
    name: 'Ganymede', kind: 'moon',
    summary: 'The largest moon in the solar system, bigger than Mercury, with a magnetic field of its own and probably an ocean buried inside.',
    know: [
      'Its radius, 2,631 km, is larger than Mercury’s, though at 1,482 × 10²⁰ kg it has less than half Mercury’s mass because it is full of ice.',
      'Its density is 1,940 kg/m³, and the surface combines old dark cratered ground with brighter, grooved ground.',
      'It is the only moon known to have its own magnetic field.',
      'It circles Jupiter every 7.15 days.',
    ],
    unknown: [
      'How many layers of ice and salty water there are inside it, and how deep they lie.',
      'Why it has a magnetic field when the other big moons do not, and what is generating it.',
    ],
    links: [sci('Jupiter', 'jupiter')],
  },
  callisto: {
    name: 'Callisto', kind: 'moon',
    summary: 'The outermost of Jupiter’s four large moons: a dark, ancient, heavily cratered world of ice and rock.',
    know: [
      'Its density is the lowest of the four, 1,830 kg/m³, so about half of it is ice.',
      'It has one of the most cratered surfaces known, so little has changed on it for billions of years.',
      'It orbits at 1.88 million km from Jupiter, outside the worst of the radiation, and takes 16.7 days.',
      'It has no global magnetic field of its own.',
    ],
    unknown: [
      'Whether a salty ocean hides under its crust; magnetic hints suggest it might.',
      'Why its rock and ice are only partly separated, unlike Ganymede, which is about the same size.',
    ],
    links: [sci('Jupiter', 'jupiter')],
  },
  saturn: {
    name: 'Saturn', kind: 'planet',
    summary: 'The ringed giant: a gas planet so light that it would float on water, with the brightest and most extensive rings of any planet.',
    know: [
      'Its mean density is 687 kg/m³, less than water’s, because it is made mostly of hydrogen and helium.',
      'The rings are mainly water ice in pieces from dust to house size, spread very thin across a huge width.',
      'It turns once in about 10 hours 39 minutes and goes round the Sun in about 29.5 years.',
      'It has 274 known moons on the sheet we read, after a large batch of discoveries in 2025.',
    ],
    unknown: [
      'How old the rings are. They may be as old as the planet or much younger, and the question is still debated.',
      'How fast the deep interior spins, which makes the exact length of a day uncertain.',
      'What the core is like and how it blends into the gas above it.',
    ],
    links: [sci('Saturn', 'saturn')],
  },
  enceladus: {
    name: 'Enceladus', kind: 'moon',
    summary: 'A small, bright, icy moon of Saturn that throws jets of water vapour and ice into space from a hidden ocean.',
    know: [
      'It is only about 504 km across, yet it reflects nearly all the light that falls on it, because its surface is fresh ice.',
      'Jets of ice and vapour spray from cracks near its south pole and feed one of Saturn’s rings.',
      'Its density, 1,610 kg/m³, means ice and rock in comparable amounts.',
      'It circles Saturn in 1.37 days, and tides from the larger moons keep it warm inside.',
    ],
    unknown: [
      'How long its ocean has been there, which affects whether life could have developed.',
      'Exactly where the heat that keeps the ocean liquid comes from.',
    ],
    links: [sci('Saturn', 'saturn')],
  },
  rhea: {
    name: 'Rhea', kind: 'moon',
    summary: 'Saturn’s second-largest moon: a cratered ball of mostly water ice with some rock.',
    know: [
      'Its radius is about 763 km and its density 1,240 kg/m³, so it is mostly ice.',
      'It is locked to Saturn, going round in 4.52 days with one face always towards the planet.',
      'It is bright and heavily cratered.',
    ],
    unknown: [
      'How far its rock and ice have separated into layers.',
      'Its inside is poorly pinned down: measurements so far give only a rough answer.',
    ],
    links: [sci('Saturn', 'saturn')],
  },
  titan: {
    name: 'Titan', kind: 'moon',
    summary: 'Saturn’s giant moon, larger than Mercury, with a thick nitrogen atmosphere and seas of liquid methane and ethane.',
    know: [
      'It is the only moon with a dense atmosphere: mostly nitrogen, with methane, and an orange haze that hides the surface.',
      'With a radius of 2,575 km it is bigger than Mercury, but with a density of 1,880 kg/m³ it is made of ice and rock.',
      'Surface temperature is about −180 °C, cold enough for methane to rain and pool in lakes.',
      'One orbit of Saturn takes 15.9 days.',
    ],
    unknown: [
      'Whether a liquid water ocean lies under the ice, and how deep.',
      'What replaces the methane that sunlight keeps breaking down.',
      'How far its complex chemistry goes toward the building blocks of life.',
    ],
    links: [sci('Saturn', 'saturn')],
  },
  iapetus: {
    name: 'Iapetus', kind: 'moon',
    summary: 'A moon of Saturn with one side nearly black and the other bright, and a ridge running round its equator.',
    know: [
      'One hemisphere reflects about 5% of the light and the other about 50%, so it looks two-toned.',
      'It orbits far from Saturn, at about 3.56 million km, and takes 79 days, on an orbit tilted nearly 15 degrees.',
      'Its density, 1,090 kg/m³, means mostly ice.',
      'A ridge, in places many kilometres high, runs along its equator, which gives it a walnut shape.',
    ],
    unknown: [
      'Why the equatorial ridge exists.',
      'The full story of the dark material: how much comes from outside and how much from the moon itself.',
    ],
    links: [sci('Saturn', 'saturn')],
  },
  uranus: {
    name: 'Uranus', kind: 'planet',
    summary: 'An ice giant that rolls round the Sun on its side, with faint dark rings and a pale blue-green colour from methane.',
    know: [
      'Its axis is tilted nearly 98 degrees, so each pole in turn faces the Sun for decades of its 84-year orbit.',
      'It turns backwards (retrograde) in about 17 hours 14 minutes.',
      'Its atmosphere is mostly hydrogen and helium with about 2% methane, which absorbs red light.',
      'It has 13 known rings and 28 known moons; the five large ones are Miranda, Ariel, Umbriel, Titania and Oberon.',
      'It was found by William Herschel in 1781.',
    ],
    unknown: [
      'What knocked it over, if anything did. A giant impact is one explanation.',
      'Why it gives off so little internal heat compared with the other giants.',
      'What its interior is like; the water-ammonia-methane “ices” are inferred, not seen.',
    ],
    links: [sci('Uranus', 'uranus')],
  },
  miranda: {
    name: 'Miranda', kind: 'moon',
    summary: 'The smallest and innermost of Uranus’s five large moons, with a patchwork of cliffs, grooves and rough ground.',
    know: [
      'It is about 470 km across and is made mostly of water ice, with a density of 1,200 kg/m³.',
      'It orbits at 129,900 km from Uranus in 1.41 days, with an orbit tilted by 4.34 degrees, more than any other large Uranian moon.',
      'Its jumbled terrain includes cliffs many kilometres high.',
    ],
    unknown: [
      'How the strange “coronae” and cliffs formed: by internal heating, a shattering impact that re-formed, or something else.',
      'Only one flyby has ever imaged it, and only part of its surface was lit then.',
    ],
    links: [sci('Uranus', 'uranus')],
  },
  titania: {
    name: 'Titania', kind: 'moon',
    summary: 'The largest moon of Uranus: an icy, cratered world with long canyons.',
    know: [
      'Its radius is 788.9 km, a little larger than Oberon’s, and its mass is about 34.2 × 10²⁰ kg.',
      'Its density, 1,660 kg/m³, points to ice and rock in about equal parts.',
      'It circles Uranus at 436,300 km, once every 8.71 days.',
      'Long canyons show that its crust has been stretched at some time.',
    ],
    unknown: [
      'Whether any liquid remains inside it, since heat from decay of its rock could keep a layer warm.',
      'How its surface looks away from the side seen by the flyby; most of it has never been imaged.',
    ],
    links: [sci('Uranus', 'uranus')],
  },
  oberon: {
    name: 'Oberon', kind: 'moon',
    summary: 'The outermost of Uranus’s large moons: an old, dark, cratered ice world.',
    know: [
      'Its radius is 761.4 km and its density 1,560 kg/m³.',
      'It orbits at 583,500 km from Uranus in 13.46 days.',
      'Some craters have dark floors, and a very tall mountain shows against the limb in one picture.',
    ],
    unknown: [
      'What the dark material on the crater floors is.',
      'Whether it has been geologically active, since only part of its surface has been seen at all.',
    ],
    links: [sci('Uranus', 'uranus')],
  },
  neptune: {
    name: 'Neptune', kind: 'planet',
    summary: 'The farthest planet: a deep blue ice giant with the fastest winds in the solar system.',
    know: [
      'It takes about 165 years to go once round the Sun; found in 1846, it completed its first full orbit as a known planet in 2011.',
      'It was found by Johann Galle after Adams and Le Verrier worked out where an unseen planet must be from the pull on Uranus.',
      'Winds reach up to 580 m/s, and it is far from the Sun but still gives out more heat than it receives.',
      'It has 16 known moons and a set of faint rings. The big one is Triton.',
    ],
    unknown: [
      'What drives the fastest winds in a place with so little sunlight.',
      'What its deep interior is made of, and whether “diamond rain” falls there as some experiments suggest.',
    ],
    links: [sci('Neptune', 'neptune')],
  },
  triton: {
    name: 'Triton', kind: 'moon',
    summary: 'Neptune’s largest moon: icy, bright and geologically active, and the only large moon that orbits backwards.',
    know: [
      'It orbits in the opposite direction to Neptune’s spin (retrograde) and tilted 157 degrees, which is unlike any normal moon and points to capture from elsewhere.',
      'It has a thin nitrogen atmosphere and a surface about −215 °C.',
      'Few craters mark its surface, so it is young, and dark streaks suggest nitrogen geysers.',
      'Tides are slowly shrinking its orbit.',
    ],
    unknown: [
      'Whether an ocean lies beneath the ice.',
      'What powers the geysers.',
      'How it was captured, and from where.',
    ],
    links: [sci('Neptune', 'neptune')],
  },
  pluto: {
    name: 'Pluto', kind: 'dwarf',
    summary: 'The best-known dwarf planet: a small, cold world of ice and rock with a thin nitrogen atmosphere, five moons and a heart-shaped plain of frozen nitrogen.',
    know: [
      'It was found by Clyde Tombaugh in 1930, and counted as the ninth planet until 2006, when the IAU created the class of dwarf planets.',
      'It orbits in 248 years, on a path tilted 17 degrees and stretched enough that it sometimes comes inside Neptune’s orbit.',
      'Its air is about 99% nitrogen with some methane, at roughly 13 microbar, 1/80,000 of Earth’s pressure.',
      'It and its large moon Charon circle a point between them, and both show the same face to the other.',
    ],
    unknown: [
      'Whether a liquid ocean lies beneath the ice, as the shape and cracks of the surface hint.',
      'How its atmosphere changes over its 248-year orbit, as it moves away from the Sun and refreezes.',
      'How its five moons formed; a giant collision is the leading idea.',
    ],
    links: [sci('Pluto', 'dwarf-planets/pluto')],
  },
  charon: {
    name: 'Charon', kind: 'moon',
    summary: 'Pluto’s largest moon, about half Pluto’s width, so big that the two are often called a double system.',
    know: [
      'Its radius is 606 km and its density 1,700 kg/m³, so it is rock and ice.',
      'It goes round Pluto in 6.387 days at 19,596 km, and both spin in that same time, so each always shows the same face to the other.',
      'The centre of their orbit lies in the space between them, not inside Pluto.',
      'It is darker than Pluto and has a dark reddish cap at its pole.',
    ],
    unknown: [
      'How it formed. A giant impact on young Pluto is the usual idea.',
      'Whether it ever had an ocean below its surface; its large canyons suggest a past with some internal change.',
    ],
    links: [sci('Pluto', 'dwarf-planets/pluto')],
  },
  amalthea: {
    name: 'Amalthea', kind: 'moon',
    summary: 'A small, red, elongated moon of Jupiter that circles just outside the planet’s faint inner rings.',
    know: [
      'It measures about 250 km long by 146 across and 128 deep (the sheet gives radii of 125 × 73 × 64 km), so it is shaped more like a lumpy brick than a ball.',
      'It orbits at 181,400 km from Jupiter’s centre and goes round in 0.498 days, under twelve hours, always showing the same face to the planet.',
      'It is the largest of the moons that orbit inside the four big ones, and it lies deep within Jupiter’s radiation belts.',
      'It has been seen close up only by passing spacecraft, so its surface is mapped only in part.',
    ],
    unknown: [
      'What it is made of and how porous it is. Its mass is poorly known, so the density printed for it should be read with care.',
      'Whether it formed near Jupiter or was captured, and why it looks redder than most moons.',
    ],
    links: [sci('Jupiter', 'jupiter')],
  },
  himalia: {
    name: 'Himalia', kind: 'moon',
    summary: 'The largest of Jupiter’s far-out irregular moons: a dark, roughly round lump about 170 km across, orbiting millions of kilometres from the planet.',
    know: [
      'Its radius is about 85 km, and it orbits 11.46 million km from Jupiter in 250.6 days, on an orbit tilted about 27.5 degrees and fairly eccentric (0.162).',
      'It turns once in about 0.4 days, roughly ten hours.',
      'Several other small moons share much the same orbit, which suggests they are pieces of one body that broke apart.',
      'It reflects only about 3% of the light that falls on it.',
    ],
    unknown: [
      'Its density: the sheet gives none, since its mass is only roughly known.',
      'Where its family of moons came from, and whether it was captured whole or broke up afterwards.',
    ],
    links: [sci('Jupiter', 'jupiter')],
  },
  mimas: {
    name: 'Mimas', kind: 'moon',
    summary: 'The smallest and innermost of Saturn’s big round moons, an icy ball with one huge crater that gives it a distinctive, dented look.',
    know: [
      'Its radii are 208 × 197 × 191 km, and its density, 1,150 kg/m³, is little above water ice, so it is nearly all ice.',
      'It orbits 185,520 km from Saturn’s centre in 0.94 days, closer than any of the other major moons.',
      'One crater, a third of its width, dominates a face; the impact that made it came close to breaking the moon apart.',
      'Its orbit is slightly squashed (eccentricity 0.020) and tilted about 1.5 degrees.',
    ],
    unknown: [
      'Whether anything liquid lies inside. Its wobble as it orbits has been read as either a young ocean or an odd-shaped core, and the matter is still argued.',
      'How old its surface is.',
    ],
    links: [sci('Saturn', 'saturn')],
  },
  tethys: {
    name: 'Tethys', kind: 'moon',
    summary: 'A bright, icy moon of Saturn, scarred by one very large crater and a vast canyon that runs most of the way round it.',
    know: [
      'Its radii are 538 × 528 × 526 km, and its density, 985 kg/m³, is lower than that of water ice alone.',
      'That low density points to an almost pure-ice body with little rock.',
      'It orbits 294,660 km from Saturn in 1.89 days on a path that is nearly circular (eccentricity 0.000 on the sheet, so very nearly circular).',
      'Two small moons, Telesto and Calypso, share its orbit, one ahead and one behind.',
    ],
    unknown: [
      'How the great canyon formed. One idea is the freezing of an internal ocean; another is the stress left by the big impact.',
      'Why its surface is so bright and clean in places.',
    ],
    links: [sci('Saturn', 'saturn')],
  },
  dione: {
    name: 'Dione', kind: 'moon',
    summary: 'An icy moon of Saturn with a bright, wispy-looking terrain on its trailing side, made of tall ice cliffs, and with its own small companion moons.',
    know: [
      'Its radii are 563 × 561 × 560 km, and its density, 1,480 kg/m³, means roughly a third rock and the rest ice.',
      'It orbits 377,400 km from Saturn in 2.74 days.',
      'Two small moons, Helene and Polydeuces, travel in its orbit ahead of and behind it.',
      'One side is heavily cratered and the other is crossed by long bright fractures.',
    ],
    unknown: [
      'Whether there is a liquid layer deep inside, and how thick the ice crust is.',
      'How much its surface has been renewed.',
    ],
    links: [sci('Saturn', 'saturn')],
  },
  hyperion: {
    name: 'Hyperion', kind: 'moon',
    summary: 'A battered, sponge-looking moon of Saturn that tumbles chaotically instead of spinning on a steady axis.',
    know: [
      'Its radii are 180 × 133 × 103 km, so it is clearly not round, and its density, 550 kg/m³, is low enough that much of it must be empty space.',
      'It orbits 1.5 million km from Saturn in 21.3 days on a fairly stretched orbit (eccentricity 0.104).',
      'The sheet marks its rotation as chaotic: its axis and spin rate change unpredictably, in part because of the pull of Titan.',
      'Its surface is covered in deep, sharp-edged craters.',
    ],
    unknown: [
      'What it is, in detail: a piece of a larger body or a loosely packed pile of ice and rock.',
      'How its spin will change over time, since a tumbling body is hard to predict.',
    ],
    links: [sci('Saturn', 'saturn')],
  },
  phoebe: {
    name: 'Phoebe', kind: 'moon',
    summary: 'A dark, irregular moon of Saturn that orbits far out, the wrong way round, and is probably a captured wanderer from the outer solar system.',
    know: [
      'Its radii are 109 × 109 × 102 km, and its density, 1,640 kg/m³, is higher than that of Saturn’s inner icy moons.',
      'It orbits 12.9 million km from Saturn in 548 days, backwards (retrograde), on an orbit tilted about 175 degrees.',
      'It turns once in about 0.4 days, roughly nine and a half hours.',
      'It reflects only about 8% of the light, and the dark dust it has shed is thought to coat part of Iapetus.',
    ],
    unknown: [
      'Where it came from; its makeup looks more like a comet or a Kuiper-belt body than like the inner moons.',
      'How much of the dust ring that carries its name is fed by it today.',
    ],
    links: [sci('Saturn', 'saturn')],
  },
  ariel: {
    name: 'Ariel', kind: 'moon',
    summary: 'The brightest of Uranus’s big moons: an icy world with a surface of canyons, valleys and relatively few craters.',
    know: [
      'Its radii are 581.1 × 577.9 × 577.7 km, and its density, 1,590 kg/m³, suggests about half ice and half rock.',
      'It orbits 190,900 km from Uranus in 2.52 days, on a nearly circular path.',
      'Only one spacecraft has seen it close up, so most of one hemisphere has never been mapped.',
      'It reflects about 39% of the light, more than any other big moon of Uranus.',
    ],
    unknown: [
      'How its valleys formed: ice cracking as the inside froze is the usual idea, and there are signs of fresh, flowing ice.',
      'Whether any heat is left inside, and whether it ever had a liquid ocean.',
    ],
    links: [sci('Uranus', 'uranus')],
  },
  umbriel: {
    name: 'Umbriel', kind: 'moon',
    summary: 'The darkest of Uranus’s big moons: an old, heavily cratered ball of ice and rock with a single bright ring on its floor.',
    know: [
      'Its radius is 584.7 km, and its density, 1,460 kg/m³, is a little lower than Ariel’s.',
      'It orbits 266,000 km from Uranus in 4.14 days.',
      'It reflects about 21% of the light, the least of the five big moons.',
      'Few areas of fresh ice show, so its surface looks old and little changed.',
    ],
    unknown: [
      'What the bright ring in one crater is: frost, fresh ice or something else.',
      'Why it is so much darker than its neighbours, with their similar sizes.',
    ],
    links: [sci('Uranus', 'uranus')],
  },
  proteus: {
    name: 'Proteus', kind: 'moon',
    summary: 'Neptune’s second-largest moon, a dark, blocky body about as large as a moon can be without pulling itself into a ball.',
    know: [
      'Its radii are 220 × 208 × 202 km, so it is slightly squashed and angular.',
      'It orbits 117,647 km from Neptune in 1.12 days, on a nearly circular path.',
      'It reflects only about 10% of the light that reaches it.',
      'It is dark and sits close to Neptune’s glare, so it went unseen from Earth: it was found in pictures from the Voyager 2 flyby.',
    ],
    unknown: [
      'Its density: the sheet lists none. Its mass is only roughly known.',
      'Its history: it may be made of debris left after a violent event in the Neptune system, which is thought to have followed Triton’s capture.',
    ],
    links: [sci('Neptune', 'neptune')],
  },
  nereid: {
    name: 'Nereid', kind: 'moon',
    summary: 'A moon of Neptune on one of the most stretched-out orbits of any moon, swinging from close to Neptune to far beyond it.',
    know: [
      'Its radius is about 170 km, and it reflects about 16% of the light.',
      'It orbits 5.51 million km from Neptune in 360 days, on a path tilted 7.2 degrees with an eccentricity of 0.751, so its distance varies by a large factor.',
      'Its brightness changes over time, so it may be elongated or tumbling.',
      'Triton, the large moon, probably wrecked the original system of Neptune’s moons when it was captured, and Nereid may be a survivor or a piece of that event.',
    ],
    unknown: [
      'Its rotation, shape and density: no density is listed, and no spacecraft has gone near it.',
      'Whether it formed with Neptune or was thrown into its odd orbit later.',
    ],
    links: [sci('Neptune', 'neptune')],
  },
  ceres: {
    name: 'Ceres', kind: 'dwarf',
    summary: 'The largest object in the main asteroid belt and the only dwarf planet in the inner solar system: a round, dark world of rock and ice.',
    know: [
      'It was found by Giuseppe Piazzi in 1801 and first counted as a planet, then as an asteroid, and since 2006 as a dwarf planet.',
      'Its mean diameter is about 939 km and it spins in about 9.07 hours.',
      'It goes round the Sun in 4.6 years, in a nearly circular orbit at 2.77 AU.',
      'Its mass, derived from its gravity, is about 9.4 × 10²⁰ kg: roughly a third of the whole belt’s mass.',
      'Bright patches of salt, in Occator crater, were seen by an orbiter.',
    ],
    unknown: [
      'How much water ice and brine lies beneath the surface, and whether a deep reservoir of brine exists today.',
      'Where it formed: in the belt, or further out and moved in later.',
    ],
    links: [sci('Ceres', 'dwarf-planets/ceres')],
  },
  vesta: {
    name: 'Vesta', kind: 'asteroid',
    summary: 'One of the largest asteroids: a bright, rocky, layered body, close to a small planet that never finished forming.',
    know: [
      'It averages about 523 km across and reflects about 42% of the light that falls on it, bright for an asteroid.',
      'It spins in 5.34 hours and has a huge impact basin at its south pole.',
      'It has a layered inside (a metal core, a rocky mantle and a crust), unlike a plain rubble heap.',
      'Meteorites that have fallen on Earth are known to be chips from it.',
    ],
    unknown: [
      'How much of its original crust survived the giant impacts that dug the south polar basins.',
      'Exactly how its layers formed and how long it stayed hot inside.',
    ],
    links: [],
  },
  pallas: {
    name: 'Pallas', kind: 'asteroid',
    summary: 'One of the largest asteroids, on an unusually tilted orbit, and the second to be discovered.',
    know: [
      'It was found in 1802 and measures about 513 km on average, with an extent of 568 × 532 × 448 km.',
      'Its orbit is tilted nearly 35 degrees to the plane of the planets, far more than most asteroids.',
      'It spins in about 7.8 hours.',
    ],
    unknown: [
      'No spacecraft has visited it, so its surface and inside are known only from telescopes and radar.',
      'Whether it is a surviving protoplanet or a blend of broken-up pieces.',
    ],
    links: [],
  },
  hygiea: {
    name: 'Hygiea', kind: 'asteroid',
    summary: 'One of the largest asteroids in the belt, dark and carbon-rich, behind only Ceres, Vesta and Pallas in size.',
    know: [
      'Its mean diameter is about 407 km and it turns in about 13.8 hours.',
      'It reflects only about 7% of the light that falls on it, so it is dark.',
      'It orbits at 3.15 AU, towards the outer part of the belt, and is the largest member of its own family of related asteroids.',
    ],
    unknown: [
      'Whether it is round enough to count as a dwarf planet; telescope images suggest it may be, and the question is still being studied.',
      'The mass is only roughly known, so its density and makeup are uncertain.',
    ],
    links: [],
  },
  interamnia: {
    name: 'Interamnia', kind: 'asteroid',
    summary: 'A large, dark asteroid in the outer part of the main belt, among the biggest of its kind.',
    know: [
      'Its mean diameter is about 306 km.',
      'It spins every 8.7 hours and reflects about 8% of the light on it.',
      'Its orbit is at 3.06 AU, tilted about 17 degrees.',
    ],
    unknown: [
      'It has never been visited, so its shape and composition are known only roughly from telescopes.',
      'How massive it is. Estimates differ.',
    ],
    links: [],
  },
  eunomia: {
    name: 'Eunomia', kind: 'asteroid',
    summary: 'A large, bright, rocky asteroid in the middle of the main belt, leader of its own family of fragments.',
    know: [
      'Its mean diameter is about 232 km, and it reflects about a quarter of the light that hits it.',
      'It spins in about 6.1 hours.',
      'It orbits at 2.64 AU, with an orbit tilted nearly 12 degrees.',
    ],
    unknown: [
      'Its mass and make-up are only roughly known because no spacecraft has been there.',
      'How the family of asteroids around it was formed.',
    ],
    links: [],
  },
  juno: {
    name: 'Juno', kind: 'asteroid',
    summary: 'A large, bright rocky asteroid, the third to be discovered.',
    know: [
      'It was found in 1804 and has a mean diameter of about 247 km.',
      'It reflects about 21% of the light that falls on it and turns in 7.2 hours.',
      'It orbits at 2.67 AU, tilted 13 degrees.',
    ],
    unknown: [
      'No spacecraft has visited it, so little is known of its shape and surface in detail.',
    ],
    links: [],
  },
  psyche: {
    name: 'Psyche', kind: 'asteroid',
    summary: 'A large asteroid in the middle of the belt that looks, from Earth, as if it may be rich in metal.',
    know: [
      'Its mean diameter is about 222 km, with an extent of 278 × 238 × 171 km, so it is clearly not round.',
      'It spins in about 4.2 hours.',
      'Radar and heat measurements point to a surface with a lot of metal, unusual for an asteroid.',
      'A spacecraft with the same name was launched on 13 October 2023 and is on its way to orbit it.',
    ],
    unknown: [
      'How much of it is metal, and whether it is the exposed core of a broken planetary building block or something else.',
      'Its true density, which depends on how much empty space is inside.',
    ],
    links: [{ label: 'NSSDCA Master Catalog: Psyche spacecraft', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2023-157A' }],
  },
  eros: {
    name: 'Eros', kind: 'asteroid',
    summary: 'A long, peanut-shaped near-Earth asteroid, the first of its kind to be found and the first to be orbited and landed on.',
    know: [
      'It measures about 34.4 × 11.2 × 11.2 km, so it is long and thin, and spins in about 5.27 hours.',
      'It was found in 1898 by Gustav Witt and comes within about 22 million km of Earth.',
      'Its orbit crosses Mars’s but not Earth’s, which makes it an Amor-type near-Earth asteroid.',
      'A spacecraft orbited it for a year and then touched down on it in February 2001.',
    ],
    unknown: [
      'How it got its shape, and how it came to be in an orbit near Earth.',
      'What lies beneath its thick, dusty regolith.',
    ],
    links: [],
  },
  ida: {
    name: 'Ida', kind: 'asteroid',
    summary: 'An elongated main-belt asteroid that has its own small moon, called Dactyl.',
    know: [
      'It is about 60 km long, with an extent of 59.8 × 25.4 × 18.6 km, and spins in about 4.6 hours.',
      'It was found in 1884 and is a member of a family of asteroids that formed from a larger body.',
      'Dactyl, a small moon about 1.4 km across, was found orbiting it in images from a passing spacecraft in 1993, the first moon seen around an asteroid.',
    ],
    unknown: [
      'How Dactyl came to be in orbit.',
      'How old the Ida family is; estimates range widely.',
    ],
    links: [],
  },
  apophis: {
    name: 'Apophis', kind: 'asteroid',
    summary: 'A small near-Earth asteroid that will pass closer to Earth in April 2029 than the ring of satellites in geostationary orbit.',
    know: [
      'It is about 340 m across and spins slowly, about once every 30.6 hours.',
      'Early orbit estimates suggested a small chance of impact in 2029 or 2036; later observations have ruled those out.',
      'On 13 April 2029 it will pass at roughly 32,000 km from Earth’s centre, close enough to see with the naked eye in some places.',
    ],
    unknown: [
      'How Earth’s gravity and tides will change its spin and orbit during the pass.',
      'What it looks like up close; only radar and telescope measurements exist.',
    ],
    links: [],
  },
  bennu: {
    name: 'Bennu', kind: 'asteroid',
    summary: 'A small, dark, spinning-top asteroid that a spacecraft sampled and whose rock is now in laboratories on Earth.',
    know: [
      'It is about 484 m across and is a loose heap of boulders and rubble rather than a solid rock.',
      'It spins every 4.3 hours and passes near Earth’s orbit every six years.',
      'It is very dark, reflecting only about 4% of the light on it, and rich in carbon.',
      'A sample from its surface came back to Earth in September 2023.',
    ],
    unknown: [
      'What the sample reveals about the chemistry of the early solar system; analysis is still going on.',
      'Why it threw small particles into space during the visit.',
    ],
    links: [],
  },
  ryugu: {
    name: 'Ryugu', kind: 'asteroid',
    summary: 'A small, very dark, top-shaped asteroid visited by a Japanese spacecraft that brought a sample back to Earth.',
    know: [
      'It is about 900 m across and a loose pile of rubble, with a spinning-top shape that spins in 7.6 hours.',
      'It reflects only about 4.5% of the light on it, one of the darkest bodies known.',
      'JAXA’s Hayabusa2 reached it in 2018 and sent a capsule of samples back to Earth in December 2020.',
    ],
    unknown: [
      'What the returned samples show about the early solar system and about organic material.',
      'How its top shape formed.',
    ],
    links: [],
  },
  hektor: {
    name: 'Hektor', kind: 'asteroid',
    summary: 'One of the largest Jupiter Trojans, a dark, elongated asteroid that shares Jupiter’s orbit.',
    know: [
      'Its mean diameter is about 225 km and it spins in about 6.9 hours.',
      'It travels in Jupiter’s orbit at 5.28 AU, in the swarm that leads the planet.',
      'It is very dark, reflecting only about 2.5% of the light on it.',
      'Its brightness changes a lot as it turns, which shows it is elongated.',
    ],
    unknown: [
      'Where Trojans formed. They might have been moved there when the giant planets shifted position.',
      'What it is made of under its dark surface.',
    ],
    links: [],
  },
  chiron: {
    name: 'Chiron', kind: 'asteroid',
    summary: 'The first centaur found: an icy object between Saturn and Uranus that sometimes behaves like a comet.',
    know: [
      'It was found in 1977 and has a diameter of about 166 km.',
      'It orbits at 13.7 AU, crossing the orbit of Saturn on its way in towards the Sun, and takes about 50 years.',
      'It spins in about 5.9 hours.',
      'It can show a faint cloud of gas, which is why it also has a comet designation.',
    ],
    unknown: [
      'Whether it has rings or jets of material.',
      'How long it will survive in such an orbit: the planets will eventually throw it elsewhere.',
    ],
    links: [],
  },
  oumuamua: {
    name: 'ʻOumuamua', kind: 'asteroid',
    summary: 'The first object known to have come from outside the solar system, found in 2017 as it sped away.',
    know: [
      'Its orbit is hyperbolic: eccentricity 1.2 means it is not bound to the Sun and came from interstellar space.',
      'It passed the Sun at 0.256 AU, inside the orbit of Mercury, tilted 123 degrees to the planets.',
      'Its brightness varied with a period of about 7.9 hours, so it tumbles and is strongly elongated.',
      'It showed small unexplained changes in speed while showing no visible gas cloud.',
    ],
    unknown: [
      'Its real shape (cigar-like or flat) and its size, which are inferred from brightness alone.',
      'What caused the extra push it showed, and which star system it came from.',
    ],
    links: [],
  },
  haumea: {
    name: 'Haumea', kind: 'dwarf',
    summary: 'A fast-spinning, egg-shaped dwarf planet in the Kuiper belt, with two moons and a ring.',
    know: [
      'It spins in under 4 hours, one of the fastest of any large body, which has stretched it into a long shape.',
      'It orbits at 43.1 AU, takes about 282 years, and was found in 2003.',
      'It has two known moons, and a ring was found round it when it passed in front of a star.',
      'Credit for finding it is disputed between two teams; the date and names shown follow the Small-Body Database.',
    ],
    unknown: [
      'Its exact size and shape: the Small-Body Database holds no diameter for it, and the values come from other kinds of measurement.',
      'How it came to spin so fast, and whether a collision created its moons and the family of icy fragments around it.',
    ],
    links: [sci('Haumea', 'dwarf-planets/haumea')],
  },
  makemake: {
    name: 'Makemake', kind: 'dwarf',
    summary: 'A bright, icy dwarf planet in the Kuiper belt, slightly smaller than Pluto.',
    know: [
      'It orbits at 45.6 AU, takes about 307 years and was found in 2005.',
      'It spins in a little under 23 hours, and its surface is covered in methane ice.',
      'It has one small moon.',
    ],
    unknown: [
      'Its precise size: the Small-Body Database lists no diameter.',
      'Whether it has any atmosphere, even a thin or temporary one.',
    ],
    links: [sci('Makemake', 'dwarf-planets/makemake')],
  },
  eris: {
    name: 'Eris', kind: 'dwarf',
    summary: 'The most massive dwarf planet beyond Neptune: its discovery led directly to Pluto being reclassified.',
    know: [
      'It orbits at 67.9 AU, takes about 561 years and is tilted nearly 44 degrees to the planets.',
      'It was found in 2003, and because it seemed to be as large as Pluto, the IAU defined “dwarf planet” in 2006.',
      'It has one moon, Dysnomia.',
      'It spins in about 26 hours.',
    ],
    unknown: [
      'Its size: the Small-Body Database holds no diameter for it, so values come from other methods.',
      'Whether its surface ice moves with the seasons, as it travels very far from the Sun on its long orbit.',
    ],
    links: [sci('Eris', 'dwarf-planets/eris')],
  },
  orcus: {
    name: 'Orcus', kind: 'dwarf',
    summary: 'A large Kuiper belt object on an orbit very like Pluto’s, with a big moon.',
    know: [
      'It orbits at 39.4 AU, takes about 247 years, and was found in 2004.',
      'It is in the same orbital resonance with Neptune as Pluto, three orbits for every two of Neptune, and is sometimes called the anti-Pluto because it is always on the opposite side of the Sun.',
      'It has a large moon, Vanth.',
    ],
    unknown: [
      'Its size: the Small-Body Database lists no diameter.',
      'Whether it is round enough and big enough to count as a dwarf planet; the IAU has not formally ruled.',
    ],
    links: [],
  },
  quaoar: {
    name: 'Quaoar', kind: 'dwarf',
    summary: 'A large Kuiper belt object with a moon and a ring far out from its body.',
    know: [
      'It orbits at 43.2 AU, takes about 285 years, and was found in 2002.',
      'It spins in about 8.8 hours.',
      'A ring was found around it in 2023, much farther out than rings are expected to survive.',
      'It has a small moon, Weywot.',
    ],
    unknown: [
      'Why its ring stays as a ring and does not form another moon.',
      'Its precise size: the Small-Body Database lists no diameter.',
    ],
    links: [],
  },
  sedna: {
    name: 'Sedna', kind: 'dwarf',
    summary: 'One of the most distant known objects of the solar system, on an enormous orbit that never brings it near Neptune.',
    know: [
      'It was found in 2003 by Michael Brown, Chad Trujillo and David Rabinowitz.',
      'The orbit solution used here puts its closest point to the Sun at 76 AU and its farthest at about 1,010 AU, a journey of around 12,700 years.',
      'It spins in about 10.3 hours.',
      'It is very red.',
    ],
    unknown: [
      'How it got to such an orbit. Candidates include a passing star, the Sun’s birth cluster, or an unseen distant planet.',
      'Its size: the Small-Body Database lists no diameter.',
    ],
    links: [],
  },
  gonggong: {
    name: 'Gonggong', kind: 'dwarf',
    summary: 'A large, red Kuiper belt object on a stretched, tilted orbit, with a moon called Xiangliu.',
    know: [
      'It orbits at 66.9 AU, takes about 547 years, and was found in 2007.',
      'It spins in about 22 hours, slowly for its size, possibly because its moon’s tides slowed it.',
      'Its orbit is stretched, with an eccentricity of 0.50.',
    ],
    unknown: [
      'Its size: the Small-Body Database lists no diameter.',
      'Whether it has kept any thin atmosphere or ices at the surface.',
    ],
    links: [],
  },
  halley: {
    name: 'Halley’s Comet', kind: 'comet',
    summary: 'The most famous periodic comet: seen from Earth every 75 to 76 years, and observed by a fleet of spacecraft in 1986.',
    know: [
      'Its orbit takes about 75.8 years, is very stretched (eccentricity 0.968) and runs backwards, tilted 162 degrees to the planets.',
      'Its nucleus is a dark, peanut-shaped lump about 15 × 8 km, reflecting only about 4% of the light.',
      'Edmond Halley showed that comets seen in 1531, 1607 and 1682 were the same object, and predicted its return; it came back in 1758.',
      'It last passed the Sun in February 1986 and is due again in 2061.',
    ],
    unknown: [
      'The spin of its nucleus is complicated and not well measured.',
      'How many more passes it can make before it breaks up or runs out of ice.',
    ],
    links: [],
  },
  halebopp: {
    name: 'Hale–Bopp', kind: 'comet',
    summary: 'The Great Comet of 1997, one of the brightest seen in modern times, visible to the naked eye for about 18 months.',
    know: [
      'It was found on 23 July 1995 by Alan Hale and Thomas Bopp, when still far beyond Jupiter.',
      'Its nucleus is large for a comet, about 60 km across by the estimate used here.',
      'It came closest to the Sun, 0.891 AU, in spring 1997, on an orbit nearly at right angles to the planets (89 degrees).',
      'Its period is currently about 2,360 years, so it will not return for a very long time.',
    ],
    unknown: [
      'The nucleus size is an estimate with a wide margin.',
      'How the planets\u2019 pull changed its orbit on this pass; the figures here are for one date.',
    ],
    links: [],
  },
  '67p': {
    name: 'Churyumov–Gerasimenko (67P)', kind: 'comet',
    summary: 'A Jupiter-family comet with a two-lobed, rubber-duck-shaped nucleus that ESA’s Rosetta orbited and landed on.',
    know: [
      'Its nucleus is about 3.4 km across and spins in about 12.8 hours.',
      'It orbits in about 6.4 years, passing the Sun at 1.2 AU and travelling out to about 5.7 AU, a little beyond Jupiter’s orbit.',
      'Rosetta orbited it for two years from 2014 and sent down the Philae lander.',
      'Its mass, derived from its gravity, is only about 1 × 10¹³ kg.',
    ],
    unknown: [
      'Whether its two lobes were once separate comets that merged.',
      'How much of the water on Earth was delivered by comets like it; its ice is different from Earth’s ocean water in one measurement.',
    ],
    links: [],
  },
  tempel1: {
    name: 'Tempel 1', kind: 'comet',
    summary: 'A Jupiter-family comet that was hit on purpose in 2005 so a spacecraft could look at what lay below its surface.',
    know: [
      'Its nucleus is about 6 km across, measuring roughly 7.6 × 4.9 km, and spins in about 40.7 hours.',
      'It goes round the Sun in about 5.6 years.',
      'Deep Impact released an impactor that struck it on 4 July 2005, and a second spacecraft returned in 2011 to see the crater.',
      'It reflects only about 5% of the light that falls on it.',
    ],
    unknown: [
      'How much of its inside is dust and how much is ice.',
      'How its surface changes from one orbit to the next.',
    ],
    links: [],
  },
  swifttuttle: {
    name: 'Swift–Tuttle', kind: 'comet',
    summary: 'A big comet with a 133-year orbit, parent of the Perseid meteor shower.',
    know: [
      'Its nucleus is about 26 km across, the largest known object that crosses Earth’s orbit regularly.',
      'It takes about 133 years round the Sun on an orbit tilted 113 degrees.',
      'It was found in 1862, and the dust it leaves along its orbit produces the Perseids every August.',
      'Its last perihelion was in 1992; the next is due in 2126.',
    ],
    unknown: [
      'Its long-term orbit is hard to predict beyond a few passes.',
    ],
    links: [],
  },
  borisov: {
    name: 'Borisov', kind: 'comet',
    summary: 'The first interstellar comet: it came from another star system and passed through ours in 2019.',
    know: [
      'It was found by Gennady Borisov in August 2019, and its orbit is strongly hyperbolic, with an eccentricity of 3.36.',
      'It passed the Sun at about 2.0 AU, outside the orbit of Mars.',
      'Its orbit is tilted 44 degrees to the planets.',
      'It is the second interstellar object identified, after ʻOumuamua.',
    ],
    unknown: [
      'The size of its nucleus, which is hidden by the cloud of gas and dust around it.',
      'Which star it came from, and how long it travelled to get here.',
    ],
    links: [],
  },
};

/** Fiction with an honest real analogue (E2.3.c). know = what is real about the idea, unknown = what is made up. */
export interface FictionText { id: string; name: string; summary: string; basedOn: string; basedOnId?: string; know: string[]; unknown: string[]; links: Link[] }
const SETTLEMENTS: Link = { label: 'NASA: Space Settlements: A Design Study (1975 summer study at Ames, published 1977)', url: 'https://ntrs.nasa.gov/citations/19770014162' };
export const FICTION_TEXT: FictionText[] = [
  {
    id: 'tycho', name: 'Tycho Station',
    summary: 'A shipyard from the story: a kilometre-wide sphere with two counter-rotating habitat rings and a yard on top. The station is made up.',
    basedOn: 'rotating space-habitat designs such as the O’Neill cylinder and the Stanford torus',
    know: [
      'Spinning a large ring or cylinder so that its floor presses outwards, and feels like gravity, is a real idea studied since the 1950s.',
      'In 1975 a NASA summer study worked out how large wheel-shaped and cylindrical settlements could be built; the wheel became known as the Stanford torus.',
      'Gerard O’Neill’s 1970s cylinder designs would be miles long and turn about once every two minutes.',
    ],
    unknown: [
      'No station of this kind has been built. The International Space Station is far smaller and does not spin.',
      'The sphere, the engines, the shipyard and its engineers are inventions of the story.',
    ],
    links: [SETTLEMENTS],
  },
  {
    id: 'interior:tycho', name: 'Tycho Station (inside)',
    summary: 'The corridors and rings of the shipyard from the story. It is made up.',
    basedOn: 'rotating space-habitat designs such as the O’Neill cylinder and the Stanford torus',
    know: [
      'Real design studies describe the same trick: a turning ring whose inner rim becomes the floor, with gravity felt as outward push.',
      'On a ring, “down” points away from the axis, so a walker sees the floor curve up ahead and behind.',
    ],
    unknown: ['None of this exists. The shipyard, its people and its corridors are fiction.'],
    links: [SETTLEMENTS],
  },
  {
    id: 'interior:medina', name: 'Medina Station (inside)',
    summary: 'The farmland drum at the heart of the station from the story. It is made up.',
    basedOn: 'rotating space-habitat designs such as the O’Neill cylinder',
    know: [
      'A hollow drum turning on its axis can give a floor on its inner wall; Gerard O’Neill’s 1970s cylinders were this kind of design, with farmland on the inside.',
      'The turning rate sets how strong the felt gravity is: a faster turn or a wider drum makes it stronger.',
    ],
    unknown: ['No drum habitat has been built. The station, its farms and its people are made up.'],
    links: [SETTLEMENTS],
  },
  {
    id: 'interior:ceres', name: 'Ceres Station (inside)',
    summary: 'The tunnelled, crowded port inside the rock in the story. It is made up, but the rock is real.',
    basedOn: 'the real Ceres, the largest object in the asteroid belt', basedOnId: 'ceres',
    know: [
      'Ceres is real: a dwarf planet in the asteroid belt, about 939 km across, found in 1801.',
      'Its real surface gravity, about 0.26 m/s², is under a thirtieth of Earth’s.',
    ],
    unknown: [
      'Nobody lives on Ceres. The spun-up rock, the tunnels, the millions of residents and the port are inventions of the story.',
      'Ceres turns once in about 9 hours, which is far too slow to give people gravity on its own.',
    ],
    links: [],
  },
  {
    id: 'interior:ganymede', name: 'Ganymede (inside)',
    summary: 'The farming dome on Jupiter’s moon in the story. The dome and its farms are made up, but the moon is real.',
    basedOn: 'the real Ganymede, Jupiter’s largest moon', basedOnId: 'ganymede',
    know: [
      'Ganymede is real: the largest moon in the solar system, with a radius of 2,631 km and a magnetic field of its own.',
      'Jupiter sits always in the same part of its sky, because the moon keeps one face towards the planet.',
    ],
    unknown: [
      'No one lives there and nothing is grown there. The dome, its farms and its people are made up.',
      'Ganymede’s real surface is icy and its radiation environment is harsh, unlike the story’s greenhouse.',
    ],
    links: [],
  },
];
