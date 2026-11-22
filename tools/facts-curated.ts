// What we choose to show about Earth and the Moon (BACKLOG E2.2/E2.3 thin slice). The NUMBERS are not
// typed here: each fact names a pattern that tools/build-facts.ts runs over the cached NSSDCA page, so
// the value in facts.json is the one on the page. The WORDS (summary, what we know, what we do not,
// what each mission was) are ours, drafted with AI help from those pages. Never copy agency prose.

export interface Raw { file: string; url: string; name: string }
export const RAW: Record<string, Raw> = {
  earth: { file: 'earthfact.html', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html', name: 'NASA NSSDCA Earth Fact Sheet' },
  moon: { file: 'moonfact.html', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html', name: 'NASA NSSDCA Moon Fact Sheet' },
  apollo8: { file: 'nmc-1968-118A.html', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1968-118A', name: 'NASA NSSDCA Master Catalog: Apollo 8' },
  apollo11: { file: 'nmc-1969-059C.html', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C', name: 'NASA NSSDCA Master Catalog: Apollo 11 Lunar Module' },
  apollo17: { file: 'nmc-1972-096A.html', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1972-096A', name: 'NASA NSSDCA Master Catalog: Apollo 17 Command and Service Module' },
  landsat1: { file: 'nmc-1972-058A.html', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1972-058A', name: 'NASA NSSDCA Master Catalog: Landsat 1' },
  lro: { file: 'nmc-2009-031A.html', url: 'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2009-031A', name: 'NASA NSSDCA Master Catalog: Lunar Reconnaissance Orbiter' },
};

export const LICENCE = 'NASA content is generally not subject to copyright in the United States (NASA media usage guidelines); used for education and information, no endorsement implied';
export const CREDIT = 'NASA Space Science Data Coordinated Archive (NSSDCA), Goddard Space Flight Center';

/** `re` runs over the page text (whitespace collapsed) and its first group is the number as printed.
 *  `scale` turns the printed unit into the stored one (the sheet prints mass in 10^24 kg). */
export interface FactSpec { id: string; label: string; raw: string; re: RegExp; unit: string; scale?: number; fmt: 'int' | 'dec1' | 'dec2' | 'dec3' | 'sci'; text?: (m: RegExpMatchArray) => { value: string; display: string } }

export const EARTH_FACTS: FactSpec[] = [
  { id: 'radius-mean', label: 'Mean radius', raw: 'earth', re: /Volumetric mean radius \(km\) ([\d.,]+)/, unit: 'km', fmt: 'int' },
  { id: 'mass', label: 'Mass', raw: 'earth', re: /Mass \(1024 kg\) ([\d.,]+)/, unit: 'kg', scale: 1e24, fmt: 'sci' },
  { id: 'density', label: 'Mean density', raw: 'earth', re: /Mean density \(kg\/m3\) ([\d.,]+)/, unit: 'kg/m3', fmt: 'int' },
  { id: 'gravity', label: 'Surface gravity', raw: 'earth', re: /Surface gravity \(mean\) \(m\/s2\) ([\d.,]+)/, unit: 'm/s2', fmt: 'dec2' },
  { id: 'escape', label: 'Escape velocity', raw: 'earth', re: /Escape velocity \(km\/s\) ([\d.,]+)/, unit: 'km/s', fmt: 'dec1' },
  { id: 'distance', label: 'Mean distance from the Sun', raw: 'earth', re: /Semimajor axis \(106 km\) ([\d.,]+)/, unit: 'km', scale: 1e6, fmt: 'sci' },
  { id: 'year', label: 'Orbit period (sidereal)', raw: 'earth', re: /Sidereal orbit period \(days\) ([\d.,]+)/, unit: 'days', fmt: 'dec2' },
  { id: 'rotation', label: 'Rotation period (sidereal)', raw: 'earth', re: /Sidereal rotation period \(hrs\) ([\d.,]+)/, unit: 'hours', fmt: 'dec2' },
  { id: 'tilt', label: 'Axial tilt', raw: 'earth', re: /Obliquity to orbit \(deg\) ([\d.,]+)/, unit: 'degrees', fmt: 'dec2' },
  { id: 'temp', label: 'Average surface temperature', raw: 'earth', re: /Average temperature: ([\d.,]+) K/, unit: 'K', fmt: 'int' },
  { id: 'moons', label: 'Natural satellites', raw: 'earth', re: /Number of natural satellites ([\d]+)/, unit: '', fmt: 'int' },
];

export const MOON_FACTS: FactSpec[] = [
  { id: 'radius-mean', label: 'Mean radius', raw: 'moon', re: /Volumetric mean radius \(km\) ([\d.,]+)/, unit: 'km', fmt: 'dec1' },
  { id: 'mass', label: 'Mass', raw: 'moon', re: /Mass \(1024 kg\) ([\d.,]+)/, unit: 'kg', scale: 1e24, fmt: 'sci' },
  { id: 'density', label: 'Mean density', raw: 'moon', re: /Mean density \(kg\/m3\) ([\d.,]+)/, unit: 'kg/m3', fmt: 'int' },
  { id: 'gravity', label: 'Surface gravity', raw: 'moon', re: /Surface gravity \(m\/s2\) ([\d.,]+)/, unit: 'm/s2', fmt: 'dec2' },
  { id: 'escape', label: 'Escape velocity', raw: 'moon', re: /Escape velocity \(km\/s\) ([\d.,]+)/, unit: 'km/s', fmt: 'dec2' },
  { id: 'distance', label: 'Mean distance from Earth', raw: 'moon', re: /Semimajor axis \(106 km\) ([\d.,]+)/, unit: 'km', scale: 1e6, fmt: 'int' },
  { id: 'period', label: 'Orbit period', raw: 'moon', re: /Revolution period \(days\) ([\d.,]+)/, unit: 'days', fmt: 'dec2' },
  { id: 'rotation', label: 'Rotation period (sidereal)', raw: 'moon', re: /Sidereal rotation period \(hrs\) ([\d.,]+)/, unit: 'hours', fmt: 'dec2' },
  { id: 'recession', label: 'Moving away from Earth', raw: 'moon', re: /Recession rate from Earth \(cm\/yr\) ([\d.,]+)/, unit: 'cm/yr', fmt: 'dec1' },
  { id: 'temp', label: 'Temperature range at the equator', raw: 'moon', re: /Diurnal temperature range \(equator\): (\d+) K to (\d+) K/, unit: 'K', fmt: 'int',
    text: (m) => ({ value: `${m[1]} to ${m[2]}`, display: `${m[1]} K to ${m[2]} K over a lunar day` }) },
];

export interface MissionSpec { name: string; raw: string; what: string }
export const EARTH_MISSIONS: MissionSpec[] = [
  { name: 'Apollo 8', raw: 'apollo8', what: 'First crewed flight to leave Earth\'s gravity and go into orbit round the Moon; the crew looked back at Earth and sent live television.' },
  { name: 'Landsat 1', raw: 'landsat1', what: 'Launched as ERTS-1, the first of a long line of Earth-watching satellites that image land, water and weather from a polar orbit.' },
];
export const MOON_MISSIONS: MissionSpec[] = [
  { name: 'Apollo 8', raw: 'apollo8', what: 'The first crew to orbit the Moon, photographing its near and far sides to prepare the landings.' },
  { name: 'Apollo 11', raw: 'apollo11', what: 'Its lunar module Eagle made the first crewed landing, on 20 July 1969: Neil Armstrong and Buzz Aldrin walked on the surface.' },
  { name: 'Apollo 17', raw: 'apollo17', what: 'The sixth and last Apollo landing, at Taurus-Littrow in December 1972, and the first with a scientist on the surface.' },
  { name: 'Lunar Reconnaissance Orbiter', raw: 'lro', what: 'An orbiter launched in 2009 to map the surface, look for resources such as ice, and survey possible landing sites.' },
];

const NSSDC_EARTH = { label: 'NSSDCA Earth Fact Sheet', url: RAW.earth.url };
const NSSDC_MOON = { label: 'NSSDCA Moon Fact Sheet', url: RAW.moon.url };

export const TEXT = {
  earth: {
    name: 'Earth', kind: 'planet' as const,
    summary: 'The third planet from the Sun and the only place known to host life, with liquid water on its surface under a nitrogen-and-oxygen atmosphere.',
    know: [
      'Its air is about 78% nitrogen and 21% oxygen by volume (dry), and the surface carries roughly 1.4 × 10²¹ kg of water in oceans, ice and rivers.',
      'It turns once in about 23.93 hours, and its axis is tilted by about 23.4 degrees, which is why there are seasons.',
      'A magnetic field, roughly that of a tilted bar magnet, surrounds it and turns aside most charged particles from the Sun.',
      'It has one natural satellite, the Moon, and no rings.',
    ],
    unknown: [
      'How and where life first began is still an open question.',
      'The core and deep interior are probed only indirectly, by earthquake waves and magnetic measurements, so details of their makeup and heat flow remain uncertain.',
      'Exactly how Earth gained its water (already present as it formed, or delivered later by asteroids and comets) is debated.',
    ],
    links: [
      { label: 'NASA Science: Earth', url: 'https://science.nasa.gov/earth/' },
      NSSDC_EARTH,
    ],
  },
  luna: {
    name: 'The Moon (Luna)', kind: 'moon' as const,
    summary: 'Earth\'s only natural satellite: a dry, almost airless world of rock that always shows us the same face, and the only other body humans have walked on.',
    know: [
      'Its spin takes 655.7 hours and its orbit 27.3 days: the two match, so the same side always faces Earth.',
      'It is drifting away from Earth by about 3.8 cm a year.',
      'Six Apollo missions put crews on the surface between 1969 and 1972, the last being Apollo 17.',
      'It has almost no atmosphere, only about 25,000 kg of gas in total, and the surface swings between roughly 95 K and 390 K at the equator.',
    ],
    unknown: [
      'How it formed. The leading idea is a giant impact on the young Earth, but the makeup of the impactor and the details are still argued over.',
      'How much water ice lies in permanently shadowed polar craters, in what form, and how easily it could be used.',
      'What its thin atmosphere is made of: the mix is poorly known and changes, and daytime levels were hard to measure.',
    ],
    links: [
      { label: 'NASA Science: Earth\'s Moon', url: 'https://science.nasa.gov/moon/' },
      NSSDC_MOON,
      { label: 'NASA Science: Lunar Reconnaissance Orbiter', url: 'https://science.nasa.gov/mission/lro/' },
    ],
  },
};
