// What we choose to show about the real bodies in the game (BACKLOG E2.2/E2.3). The NUMBERS are not
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

const NSSDC = 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/';
const sheet = (file: string, name: string): Raw => ({ file: `${file}.html`, url: `${NSSDC}${file}.html`, name });
for (const [k, label] of [['sun', 'Sun'], ['mercury', 'Mercury'], ['venus', 'Venus'], ['mars', 'Mars'], ['jupiter', 'Jupiter'], ['saturn', 'Saturn'], ['uranus', 'Uranus'], ['neptune', 'Neptune'], ['pluto', 'Pluto']] as const) RAW[k] = sheet(`${k}fact`, `NASA NSSDCA ${label} Fact Sheet`);
RAW.jovsat = sheet('joviansatfact', 'NASA NSSDCA Jovian Satellite Fact Sheet');
RAW.satsat = sheet('saturniansatfact', 'NASA NSSDCA Saturnian Satellite Fact Sheet');
RAW.urasat = sheet('uraniansatfact', 'NASA NSSDCA Uranian Satellite Fact Sheet');
RAW.nepsat = sheet('neptuniansatfact', 'NASA NSSDCA Neptunian Satellite Fact Sheet');
RAW.smallworlds = sheet('galileanfact_table', 'NASA NSSDCA Solar System Small Worlds Fact Sheet');
/** Spacecraft pages in the NSSDCA Master Catalog. Only IDs that returned a page naming the spacecraft on the day we read them. */
export const NMC: Record<string, [string, string]> = {
  mariner2: ['1962-041A', 'Mariner 2'], mariner4: ['1964-077A', 'Mariner 4'], mariner5: ['1967-060A', 'Mariner 5'], mariner9: ['1971-051A', 'Mariner 9'], mariner10: ['1973-085A', 'Mariner 10'],
  pioneer10: ['1972-012A', 'Pioneer 10'], pioneer11: ['1973-019A', 'Pioneer 11'], voyager1: ['1977-084A', 'Voyager 1'], voyager2: ['1977-076A', 'Voyager 2'],
  vikinglander1: ['1975-075C', 'Viking 1 Lander'], vikingorbiter1: ['1975-075A', 'Viking 1 Orbiter'], pvo: ['1978-051A', 'Pioneer Venus Orbiter'], pathfinder: ['1996-068A', 'Mars Pathfinder'],
  near: ['1996-008A', 'NEAR Shoemaker'], stardust: ['1999-003A', 'Stardust/NExT'], deepimpact: ['2005-001A', 'Deep Impact/EPOXI'], messenger: ['2004-030A', 'MESSENGER'], dawn: ['2007-043A', 'Dawn'],
  msl: ['2011-070A', 'Mars Science Laboratory'], juno: ['2011-040A', 'Juno'], mars2020: ['2020-052A', 'Mars 2020'], newhorizons: ['2006-001A', 'New Horizons'], osirisrex: ['2016-055A', 'OSIRIS-REx'], parker: ['2018-065A', 'Parker Solar Probe'],
};
for (const [k, [id, label]] of Object.entries(NMC)) RAW[k] = { file: `nmc-${id}.html`, url: `https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=${id}`, name: `NASA NSSDCA Master Catalog: ${label}` };

export const LICENCE = 'NASA content is generally not subject to copyright in the United States (NASA media usage guidelines); used for education and information, no endorsement implied';
export const CREDIT = 'NASA Space Science Data Coordinated Archive (NSSDCA), Goddard Space Flight Center';

/** `re` runs over the page text (whitespace collapsed) and its first group is the number as printed.
 *  `scale` turns the printed unit into the stored one (the sheet prints mass in 10^24 kg). */
export interface FactSpec { /** read the page text only from the first place this appears (the sheets list several bodies) */ after?: string; id: string; label: string; raw: string; re: RegExp; unit: string; scale?: number; fmt: 'int' | 'dec1' | 'dec2' | 'dec3' | 'sci'; text?: (m: RegExpMatchArray) => { value: string; display: string } }

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

/** `mentions`: words the catalogue page must contain (the body or its planet); the build fails if it does not. */
export interface MissionSpec { name: string; raw: string; what: string; mentions?: string[] }
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

// ---------------------------------------------------------------------------------------------
// Everything below is generated from the cached sheets by the same patterns, so a body's numbers
// are the ones printed on its page. See tools/build-facts.ts for how each spec is run.

const N = '[\\d.,]+';
/** The standard set for a planet's own NSSDCA sheet. */
function planetFacts(raw: string, o: { giant?: boolean; radius: FactSpec['fmt']; escape?: FactSpec['fmt']; year: FactSpec['fmt']; temp?: { label: string; re: RegExp }; }): FactSpec[] {
  const f: FactSpec[] = [
    { id: 'radius-mean', label: 'Mean radius', raw, re: new RegExp(`Volumetric mean radius \\(km\\) (${N})`), unit: 'km', fmt: o.radius },
    { id: 'mass', label: 'Mass', raw, re: new RegExp(`Mass \\(1024 kg\\) (${N})`), unit: 'kg', scale: 1e24, fmt: 'sci' },
    { id: 'density', label: 'Mean density', raw, re: new RegExp(`Mean density \\(kg\\/m3\\) (${N})`), unit: 'kg/m3', fmt: 'int' },
    o.giant ? { id: 'gravity', label: 'Gravity at the 1 bar level', raw, re: new RegExp(`Gravity \\(mean, 1 bar\\) \\(m\\/s2\\) (${N})`), unit: 'm/s2', fmt: 'dec2' }
      : { id: 'gravity', label: 'Surface gravity', raw, re: new RegExp(`Surface [Gg]ravity \\((?:mean|eq\\.)\\) \\(m\\/s2\\) (${N})`), unit: 'm/s2', fmt: 'dec2' },
    { id: 'escape', label: 'Escape velocity', raw, re: new RegExp(`Escape velocity \\(km\\/s\\) (${N})`), unit: 'km/s', fmt: o.escape ?? 'dec1' },
    { id: 'distance', label: 'Mean distance from the Sun', raw, re: new RegExp(`Semimajor axis \\(106 km\\) (${N})`), unit: 'km', scale: 1e6, fmt: 'sci' },
    { id: 'year', label: 'Orbit period (sidereal)', raw, re: new RegExp(`Sidereal orbit period \\(days\\) (${N})`), unit: 'days', fmt: o.year },
    { id: 'rotation', label: 'Rotation period (sidereal)', raw, re: /Sidereal rotation period \(hrs\) (-?[\d.,]+)/, unit: 'hours', fmt: 'dec2',
      text: (m) => { const v = parseFloat(m[1].replace(/,/g, '')); const a = Math.abs(v); return { value: String(v), display: `${a.toLocaleString('en-GB', { minimumFractionDigits: a < 100 ? 2 : 1, maximumFractionDigits: a < 100 ? 2 : 1 })} hours${v < 0 ? ' (retrograde: it turns backwards)' : ''}` }; } },
    { id: 'tilt', label: 'Axial tilt', raw, re: new RegExp(`Obliquity to orbit \\(deg\\) (${N})`), unit: 'degrees', fmt: 'dec2' },
  ];
  if (o.temp) f.push({ id: 'temp', label: o.temp.label, raw, re: o.temp.re, unit: 'K', fmt: 'int' });
  f.push({ id: 'moons', label: 'Natural satellites', raw, re: /Number of natural satellites (\d+)/, unit: '', fmt: 'int' });
  return f;
}
const AVG_TEMP = { label: 'Average temperature', re: /Average temperature: ~?([\d.,]+) K/ };
const ONE_BAR = { label: 'Temperature at the 1 bar level', re: /Temperature at 1 bar: ([\d.,]+) K/ };

export const SUN_FACTS: FactSpec[] = [
  { id: 'radius-mean', label: 'Mean radius', raw: 'sun', re: new RegExp(`Volumetric mean radius \\(km\\) (${N})`), unit: 'km', fmt: 'int' },
  { id: 'mass', label: 'Mass', raw: 'sun', re: new RegExp(`Mass \\(1024 kg\\) (${N})`), unit: 'kg', scale: 1e24, fmt: 'sci' },
  { id: 'density', label: 'Mean density', raw: 'sun', re: new RegExp(`Mean density \\(kg\\/m3\\) (${N})`), unit: 'kg/m3', fmt: 'int' },
  { id: 'gravity', label: 'Surface gravity (equator)', raw: 'sun', re: new RegExp(`Surface gravity \\(eq\\.\\) \\(m\\/s2\\) (${N})`), unit: 'm/s2', fmt: 'int' },
  { id: 'escape', label: 'Escape velocity', raw: 'sun', re: new RegExp(`Escape velocity \\(km\\/s\\) (${N})`), unit: 'km/s', fmt: 'int' },
  { id: 'rotation', label: 'Rotation period (at 16\u00b0 latitude)', raw: 'sun', re: new RegExp(`Sidereal rotation period \\(hrs\\)\\* (${N})`), unit: 'hours', fmt: 'dec1' },
  { id: 'temp', label: 'Effective temperature', raw: 'sun', re: /Effective temperature: ([\d.,]+) K/, unit: 'K', fmt: 'int' },
  { id: 'luminosity', label: 'Luminosity', raw: 'sun', re: new RegExp(`Luminosity \\(1024 J\\/s\\) (${N})`), unit: 'W', scale: 1e24, fmt: 'sci' },
  { id: 'spectral', label: 'Spectral type', raw: 'sun', re: /Spectral type (G2 V)/, unit: '', fmt: 'int', text: (m) => ({ value: m[1], display: m[1] }) },
  { id: 'cycle', label: 'Sunspot cycle', raw: 'sun', re: /Sun Spot Cycle: ([\d.]+) yr/, unit: 'years', fmt: 'dec1' },
];
export const PLANET_FACTS: Record<string, FactSpec[]> = {
  mercury: planetFacts('mercury', { radius: 'dec1', year: 'dec2', temp: AVG_TEMP }),
  venus: planetFacts('venus', { radius: 'dec1', year: 'dec2', temp: AVG_TEMP }),
  mars: planetFacts('mars', { radius: 'dec1', year: 'dec2', temp: AVG_TEMP }),
  jupiter: planetFacts('jupiter', { giant: true, radius: 'int', year: 'int', temp: ONE_BAR }),
  saturn: planetFacts('saturn', { giant: true, radius: 'int', year: 'int', temp: ONE_BAR }),
  uranus: planetFacts('uranus', { giant: true, radius: 'int', year: 'int', temp: ONE_BAR }),
  neptune: planetFacts('neptune', { giant: true, radius: 'int', year: 'int', temp: ONE_BAR }),
  pluto: planetFacts('pluto', { radius: 'int', escape: 'dec2', year: 'int', temp: { label: 'Surface temperature', re: /Surface temperature: ([\d.]+) - [\d.]+ K/ } }),
};
PLANET_FACTS.pluto[PLANET_FACTS.pluto.findIndex((f) => f.id === 'temp')].text = (m) => ({ value: m[0].replace('Surface temperature: ', ''), display: `${m[0].replace('Surface temperature: ', '').replace(' - ', ' to ')}` });
PLANET_FACTS.pluto[PLANET_FACTS.pluto.findIndex((f) => f.id === 'temp')].re = /Surface temperature: (\d+) - (\d+) K/;
PLANET_FACTS.pluto[PLANET_FACTS.pluto.findIndex((f) => f.id === 'temp')].text = (m) => ({ value: `${m[1]} to ${m[2]}`, display: `${m[1]} K to ${m[2]} K` });

const discovery = (raw: string): FactSpec => ({ id: 'discovered', label: 'Discovered', raw, re: /Discoverer: (.+?) Discovery Date: (.+?) Distance from Earth/, unit: 'date', fmt: 'int',
  text: (m) => ({ value: m[2], display: `${m[2]} \u00b7 ${m[1].replace(/ \(.*$/, '')}` }) });
PLANET_FACTS.venus.splice(-1, 0, { id: 'pressure', label: 'Surface air pressure', raw: 'venus', re: /Surface pressure: ([\d.]+) bars/, unit: 'bar', fmt: 'int' });
PLANET_FACTS.mars.splice(-1, 0, { id: 'pressure', label: 'Surface air pressure', raw: 'mars', re: /Surface pressure: ([\d.]+) mb/, unit: 'mb', fmt: 'dec2' });
for (const b of ['uranus', 'neptune', 'pluto']) PLANET_FACTS[b].push(discovery(b));

/** A moon on one of the satellite sheets: bulk row first, then the orbital row (after 'Orbital parameters'). */
function satFacts(raw: string, name: string, parent: string, o: { retro?: boolean } = {}): FactSpec[] {
  const code = '\\([A-Z]*[IVX]+[^)]*\\)';
  const lead = `(?<![A-Za-z])${name} ${code}`;
  const radiusRe = new RegExp(`${lead} ${N} (${N}(?: x ${N}){0,2}) `);
  return [
    { id: 'radius-mean', label: 'Radius', raw, re: radiusRe, unit: 'km', fmt: 'dec1',
      text: (m) => { const parts = m[1].split(' x '); return parts.length === 1 ? { value: parseFloat(m[1].replace(/,/g, '')), display: `${parseFloat(m[1].replace(/,/g, '')).toLocaleString('en-GB', { maximumFractionDigits: 1 })} km` } as never : { value: parts.join(' x '), display: `${parts.join(' \u00d7 ')} km (three axes)` }; } },
    { id: 'mass', label: 'Mass', raw, re: new RegExp(`${lead} (${N}) `), unit: 'kg', scale: 1e20, fmt: 'sci' },
    { id: 'density', label: 'Mean density', raw, re: new RegExp(`${lead} ${N} ${N}(?: x ${N}){0,2} (${N}) `), unit: 'kg/m3', fmt: 'int' },
    { id: 'distance', label: `Distance from ${parent}`, raw, after: 'Orbital parameters', re: new RegExp(`${lead} (${N}) `), unit: 'km', scale: 1e3, fmt: 'int' },
    { id: 'period', label: o.retro ? 'Orbit period (retrograde)' : 'Orbit period', raw, after: 'Orbital parameters', re: new RegExp(`${lead} ${N} ${N} ([\\d.]+)R? `), unit: 'days', fmt: 'dec2' },
    { id: 'ecc', label: 'Orbit eccentricity', raw, after: 'Orbital parameters', re: new RegExp(`${lead} ${N} ${N} [\\d.]+R? (?:[SC] )?[\\d.]+ ([\\d.]+)`), unit: '', fmt: 'dec3' },
  ];
}
/** One column of the 'small worlds' table (the sheet lists CALLISTO GANYMEDE EUROPA IO MOON MERCURY PLUTO TITAN TRITON CERES EARTH). */
const SMALL_COLS = ['CALLISTO', 'GANYMEDE', 'EUROPA', 'IO', 'MOON', 'MERCURY', 'PLUTO', 'TITAN', 'TRITON', 'CERES', 'EARTH'];
function smallWorld(name: string): FactSpec[] {
  const i = SMALL_COLS.indexOf(name);
  const col = `(?:-?[\\d.,]+ ){${i}}(-?[\\d.,]+)`;
  return [
    { id: 'gravity', label: 'Surface gravity', raw: 'smallworlds', re: new RegExp(`Gravity \\(m\\/s2\\) ${col}`), unit: 'm/s2', fmt: 'dec2' },
    { id: 'temp-c', label: 'Mean surface temperature', raw: 'smallworlds', re: new RegExp(`Mean Temperature \\(C\\) ${col}`), unit: '\u00b0C', fmt: 'int' },
  ];
}

const MARS_SATS = 'Satellites of Mars';
function marsMoon(idx: 1 | 2): FactSpec[] {
  const pick = (k: number) => `(?:${N} ){${idx - 1}}(${N})`;
  void pick;
  const col = `(?:${N} ){${idx - 1}}(${N})`;
  const axes = new RegExp(`Subplanetary axis radius \\(km\\) ((?:${N} ){2})Along-orbit axis radius \\(km\\) ((?:${N} ){2})Polar axis radius \\(km\\) (${N} ${N})`);
  return [
    { id: 'radius-mean', label: 'Radii (three axes)', raw: 'mars', after: MARS_SATS, re: axes, unit: 'km', fmt: 'dec1',
      text: (m) => { const g = (s: string) => s.trim().split(' ')[idx - 1]; return { value: `${g(m[1])} x ${g(m[2])} x ${g(m[3])}`, display: `${g(m[1])} \u00d7 ${g(m[2])} \u00d7 ${g(m[3])} km` }; } },
    { id: 'mass', label: 'Mass', raw: 'mars', after: MARS_SATS, re: new RegExp(`Mass \\(1015 kg\\) ${col}`), unit: 'kg', scale: 1e15, fmt: 'sci' },
    { id: 'density', label: 'Mean density', raw: 'mars', after: MARS_SATS, re: new RegExp(`Mean density \\(kg\\/m3\\) ${col}`), unit: 'kg/m3', fmt: 'int' },
    { id: 'distance', label: 'Distance from Mars', raw: 'mars', after: MARS_SATS, re: new RegExp(`Semimajor axis\\* \\(km\\) ${col}`), unit: 'km', fmt: 'int' },
    { id: 'period', label: 'Orbit period', raw: 'mars', after: MARS_SATS, re: new RegExp(`Sidereal orbit period \\(days\\) ${col}`), unit: 'days', fmt: 'dec3' },
    { id: 'ecc', label: 'Orbit eccentricity', raw: 'mars', after: MARS_SATS, re: new RegExp(`Orbital eccentricity ${col}`), unit: '', fmt: 'dec3' },
  ];
}
const CHARON = 'Charon (P1)';
export const CHARON_FACTS: FactSpec[] = [
  { id: 'radius-mean', label: 'Radius', raw: 'pluto', after: CHARON, re: new RegExp(`Equatorial radius \\(km\\) (${N})`), unit: 'km', fmt: 'int' },
  { id: 'mass', label: 'Mass', raw: 'pluto', after: CHARON, re: new RegExp(`Mass \\(10 ?21 kg\\) (${N})`), unit: 'kg', scale: 1e21, fmt: 'sci' },
  { id: 'density', label: 'Mean density', raw: 'pluto', after: CHARON, re: new RegExp(`Mean density \\(kg\\/m ?3 ?\\) (${N})`), unit: 'kg/m3', fmt: 'int' },
  { id: 'gravity', label: 'Surface gravity', raw: 'pluto', after: CHARON, re: new RegExp(`Surface gravity \\(m\\/s ?2 ?\\) (${N})`), unit: 'm/s2', fmt: 'dec2' },
  { id: 'distance', label: 'Distance from Pluto', raw: 'pluto', after: CHARON, re: new RegExp(`Mean distance from Pluto \\(km\\) (${N})`), unit: 'km', fmt: 'int' },
  { id: 'period', label: 'Orbit period', raw: 'pluto', after: CHARON, re: new RegExp(`Sidereal orbit period \\(days\\) (${N})`), unit: 'days', fmt: 'dec2' },
  { id: 'rotation', label: 'Rotation period', raw: 'pluto', after: CHARON, re: new RegExp(`Sidereal rotation period \\(days\\) (${N})`), unit: 'days', fmt: 'dec2' },
];

/** Every real body with a hand-written panel that is NOT a JPL small body. */
export const BODY_FACTS: Record<string, FactSpec[]> = {
  sun: SUN_FACTS, ...PLANET_FACTS,
  phobos: marsMoon(1), deimos: marsMoon(2),
  io: [...satFacts('jovsat', 'Io', 'Jupiter'), ...smallWorld('IO')], europa: [...satFacts('jovsat', 'Europa', 'Jupiter'), ...smallWorld('EUROPA')],
  ganymede: [...satFacts('jovsat', 'Ganymede', 'Jupiter'), ...smallWorld('GANYMEDE')], callisto: [...satFacts('jovsat', 'Callisto', 'Jupiter'), ...smallWorld('CALLISTO')],
  enceladus: satFacts('satsat', 'Enceladus', 'Saturn'), rhea: satFacts('satsat', 'Rhea', 'Saturn'),
  titan: [...satFacts('satsat', 'Titan', 'Saturn'), ...smallWorld('TITAN')], iapetus: satFacts('satsat', 'Iapetus', 'Saturn'),
  miranda: satFacts('urasat', 'Miranda', 'Uranus'), titania: satFacts('urasat', 'Titania', 'Uranus'), oberon: satFacts('urasat', 'Oberon', 'Uranus'),
  triton: [...satFacts('nepsat', 'Triton', 'Neptune', { retro: true }), ...smallWorld('TRITON')],
  charon: CHARON_FACTS,
};
/** Which pages feed a body's 'Sources' links and which sheet the 'what we know' text leans on. */
export const BODY_SHEETS: Record<string, string[]> = {
  sun: ['sun'], mercury: ['mercury'], venus: ['venus'], mars: ['mars'], jupiter: ['jupiter'], saturn: ['saturn'], uranus: ['uranus'], neptune: ['neptune'], pluto: ['pluto'],
  phobos: ['mars'], deimos: ['mars'], io: ['jovsat', 'smallworlds'], europa: ['jovsat', 'smallworlds'], ganymede: ['jovsat', 'smallworlds'], callisto: ['jovsat', 'smallworlds'],
  enceladus: ['satsat'], rhea: ['satsat'], titan: ['satsat', 'smallworlds'], iapetus: ['satsat'], miranda: ['urasat'], titania: ['urasat'], oberon: ['urasat'], triton: ['nepsat', 'smallworlds'], charon: ['pluto'],
};

/** Small bodies read from the JPL Small-Body Database API (one cached JSON response each). */
export interface SmallSpec { id: string; sstr: string }
export const SMALL: SmallSpec[] = [
  { id: 'ceres', sstr: '1' }, { id: 'vesta', sstr: '4' }, { id: 'pallas', sstr: '2' }, { id: 'hygiea', sstr: '10' }, { id: 'interamnia', sstr: '704' }, { id: 'eunomia', sstr: '15' },
  { id: 'juno', sstr: '3' }, { id: 'psyche', sstr: '16' }, { id: 'eros', sstr: '433' }, { id: 'ida', sstr: '243' }, { id: 'apophis', sstr: '99942' }, { id: 'bennu', sstr: '101955' },
  { id: 'ryugu', sstr: '162173' }, { id: 'hektor', sstr: '624' }, { id: 'chiron', sstr: '2060' }, { id: 'oumuamua', sstr: '1I' }, { id: 'haumea', sstr: '136108' }, { id: 'makemake', sstr: '136472' },
  { id: 'eris', sstr: '136199' }, { id: 'orcus', sstr: '90482' }, { id: 'quaoar', sstr: '50000' }, { id: 'sedna', sstr: '90377' }, { id: 'gonggong', sstr: '225088' },
  { id: 'halley', sstr: '1P' }, { id: 'halebopp', sstr: 'C/1995 O1' }, { id: '67p', sstr: '67P' }, { id: 'tempel1', sstr: '9P' }, { id: 'swifttuttle', sstr: '109P' }, { id: 'borisov', sstr: '2I' },
];
export const sbdbFile = (id: string) => `sbdb-${id}.json`;
export const sbdbUrl = (sstr: string) => `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${encodeURIComponent(sstr)}&phys-par=1&discovery=1`;
export const sbdbLookup = (sstr: string) => `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(sstr)}`;
export const SBDB_NAME = 'NASA/JPL Small-Body Database (SBDB) API';
export const SBDB_CREDIT = 'NASA/JPL Solar System Dynamics group, Small-Body Database';

/** Missions per body. Only spacecraft whose NSSDCA catalogue page we fetched and that names the body (or its planet, for a moon). */
const M = (name: string, raw: string, what: string, mentions: string[]): MissionSpec => ({ name, raw, what, mentions });
export const BODY_MISSIONS: Record<string, MissionSpec[]> = {
  sun: [M('Parker Solar Probe', 'parker', 'A probe that flies repeatedly through the Sun\u2019s outer atmosphere, closer than anything before it, to study how the solar wind is made and heated.', ['Sun'])],
  mercury: [
    M('Mariner 10', 'mariner10', 'Used Venus\u2019s gravity to reach Mercury and flew past it three times in 1974 and 1975, the first spacecraft to see it close up.', ['Mercury']),
    M('MESSENGER', 'messenger', 'The first spacecraft to orbit Mercury; it mapped the whole surface and measured its magnetic field and thin exosphere.', ['Mercury']),
  ],
  venus: [
    M('Mariner 2', 'mariner2', 'Flew past Venus in December 1962 and measured its temperature and atmosphere from close range.', ['Venus']),
    M('Mariner 5', 'mariner5', 'Passed close to Venus in 1967 and measured its atmosphere and magnetic environment.', ['Venus']),
    M('Pioneer Venus Orbiter', 'pvo', 'Orbited Venus from 1978 and mapped its surface by radar, as well as studying the clouds and upper air.', ['Venus']),
  ],
  mars: [
    M('Mariner 4', 'mariner4', 'Sent back the first close pictures of Mars in 1965, showing a cratered, dry world.', ['Mars']),
    M('Mariner 9', 'mariner9', 'The first spacecraft to orbit another planet; it mapped most of Mars and revealed its volcanoes and canyons.', ['Mars']),
    M('Viking 1 Lander', 'vikinglander1', 'Touched down in 1976 and worked on the surface for years, searching the soil for signs of life.', ['Mars']),
    M('Mars Pathfinder', 'pathfinder', 'A lander and the small rover Sojourner, which drove around beside it on the surface in 1997.', ['Mars']),
    M('Curiosity (Mars Science Laboratory)', 'msl', 'A car-sized rover that landed in Gale crater in 2012 to judge whether the place could once have supported microbes.', ['Mars']),
    M('Perseverance (Mars 2020)', 'mars2020', 'A rover that landed in Jezero crater in 2021 to look for signs of ancient life and to cache rock samples.', ['Mars']),
  ],
  phobos: [M('Mariner 9', 'mariner9', 'Photographed both moons of Mars as it orbited the planet, showing Phobos as a cratered, potato-shaped lump.', ['Phobos']), M('Viking 1 Orbiter', 'vikingorbiter1', 'Made close approaches to Phobos in 1977, with its closest orbit point lowered to about 300 km.', ['Phobos'])],
  deimos: [M('Mariner 9', 'mariner9', 'Photographed both moons of Mars as it orbited the planet, giving the first clear look at Deimos.', ['Deimos'])],
  jupiter: [
    M('Pioneer 10', 'pioneer10', 'The first spacecraft to cross the asteroid belt and fly past Jupiter, in December 1973.', ['Jupiter']),
    M('Pioneer 11', 'pioneer11', 'Passed Jupiter in late 1974 on its way to be the first visitor to Saturn.', ['Jupiter']),
    M('Voyager 1', 'voyager1', 'Passed Jupiter in March 1979 and found active volcanoes on Io.', ['Jupiter']),
    M('Voyager 2', 'voyager2', 'Passed Jupiter in July 1979, returning more detail of its clouds, rings and moons.', ['Jupiter']),
    M('Juno', 'juno', 'Has orbited over Jupiter\u2019s poles since 2016, probing its interior, magnetic field and auroras from close in.', ['Jupiter']),
  ],
  io: [M('Pioneer 10', 'pioneer10', 'Its radio signal passed behind Io on the Jupiter flyby, which revealed that the moon has an atmosphere of its own.', ['Io']), M('Voyager 1', 'voyager1', 'Photographed Io in 1979 and caught volcanoes erupting on it, the first active volcanoes seen beyond Earth.', ['Jupiter'])],
  europa: [M('Voyager 2', 'voyager2', 'Took the best early pictures of Europa\u2019s cracked, young-looking ice in 1979.', ['Jupiter']), M('Juno', 'juno', 'Flew close past Europa in September 2022 while on its extended mission.', ['Jupiter'])],
  ganymede: [M('Voyager 1', 'voyager1', 'Showed Ganymede in 1979 as a large moon of two kinds of terrain, dark old ground and bright grooved ground.', ['Jupiter']), M('Juno', 'juno', 'Made the closest pass at Ganymede for over twenty years in June 2021.', ['Jupiter'])],
  callisto: [M('Voyager 1', 'voyager1', 'Imaged the heavily cratered face of Callisto in 1979.', ['Jupiter'])],
  saturn: [
    M('Pioneer 11', 'pioneer11', 'The first spacecraft to reach Saturn, in September 1979; it passed through the ring plane and measured the magnetic field.', ['Saturn']),
    M('Voyager 1', 'voyager1', 'Passed Saturn in November 1980 and made a close pass of Titan before leaving the ecliptic.', ['Saturn']),
    M('Voyager 2', 'voyager2', 'Passed Saturn in August 1981 and used its gravity to carry on towards Uranus.', ['Saturn']),
  ],
  enceladus: [M('Voyager 2', 'voyager2', 'Imaged Enceladus in 1981 and showed an unusually smooth, bright surface.', ['Saturn'])],
  rhea: [M('Voyager 1', 'voyager1', 'Imaged the cratered surface of Rhea during the 1980 Saturn flyby.', ['Saturn'])],
  titan: [M('Voyager 1', 'voyager1', 'Its close flyby of Titan in 1980 showed a thick orange haze hiding the surface.', ['Titan'])],
  iapetus: [M('Voyager 2', 'voyager2', 'Imaged Iapetus from a long way off in 1981, helping to show how its two halves differ in brightness.', ['Saturn'])],
  uranus: [M('Voyager 2', 'voyager2', 'The only spacecraft to visit Uranus, in January 1986; it found new rings and moons.', ['Uranus'])],
  miranda: [M('Voyager 2', 'voyager2', 'Passed within about 30,000 km of Miranda in 1986 and sent back its patchwork of cliffs and grooves.', ['Uranus'])],
  titania: [M('Voyager 2', 'voyager2', 'Imaged Titania during the 1986 flyby, the only close look it has had.', ['Uranus'])],
  oberon: [M('Voyager 2', 'voyager2', 'Imaged Oberon during the 1986 flyby, the only close look it has had.', ['Uranus'])],
  neptune: [M('Voyager 2', 'voyager2', 'The only spacecraft to visit Neptune, in August 1989; it saw the Great Dark Spot, fast winds and faint rings.', ['Neptune'])],
  triton: [M('Voyager 2', 'voyager2', 'Flew past Triton in 1989 and saw geysers of dark material and almost no craters.', ['Neptune'])],
  pluto: [M('New Horizons', 'newhorizons', 'Flew through the Pluto system on 14 July 2015, the first and so far only visit, and went on to the Kuiper belt.', ['Pluto'])],
  charon: [M('New Horizons', 'newhorizons', 'Mapped Charon during the 2015 flyby and found a huge canyon system and a dark polar cap.', ['Charon'])],
  ceres: [M('Dawn', 'dawn', 'Orbited Vesta first and then moved on to orbit Ceres, studying both from close in.', ['Ceres'])],
  vesta: [M('Dawn', 'dawn', 'Orbited Vesta in 2011 and 2012 before moving on to Ceres.', ['Vesta'])],
  eros: [M('NEAR Shoemaker', 'near', 'Orbited Eros for a year from 2000 and then landed on it, the first landing on an asteroid.', ['Eros'])],
  bennu: [M('OSIRIS-REx', 'osirisrex', 'Studied Bennu, took a sample from its surface in 2020 and brought it back to Earth in 2023.', ['Bennu'])],
  tempel1: [M('Deep Impact', 'deepimpact', 'Fired a copper-heavy impactor into the nucleus in 2005 to see what lay beneath the surface.', ['Tempel']), M('Stardust/NExT', 'stardust', 'After collecting comet dust elsewhere, the craft was redirected and flew past Tempel 1 in 2011 to look at the crater.', ['Tempel'])],
};
