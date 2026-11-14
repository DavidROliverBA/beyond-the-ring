// Photographic maps for the real bodies of the Sol system. Each has a small
// map that loads with the system and a large one fetched when you fly close.
// Planet maps: Solar System Scope (CC BY 4.0), built from NASA mission data.
// Moon relief: NASA Scientific Visualization Studio, CGI Moon Kit.
// Europa: USGS. Enceladus, Rhea, Iapetus: NASA/JPL-Caltech/SSI/LPI (public domain).
// Ganymede, Callisto: Askaniy Anpilogov and others, via Wikimedia Commons (CC BY-SA 3.0).

import earthLo from '../assets/tex/earth_lo.jpg';
import earthHi from '../assets/tex/earth_hi.jpg';
import earthNightLo from '../assets/tex/earth_night_lo.jpg';
import earthNightHi from '../assets/tex/earth_night_hi.jpg';
import earthCloudsLo from '../assets/tex/earth_clouds_lo.jpg';
import earthCloudsHi from '../assets/tex/earth_clouds_hi.jpg';
import earthNormal from '../assets/tex/earth_normal_hi.jpg';
import earthSpec from '../assets/tex/earth_spec_hi.jpg';
import moonLo from '../assets/tex/moon_lo.jpg';
import moonHi from '../assets/tex/moon_hi.jpg';
import moonBump from '../assets/tex/moon_bump_hi.jpg';
import marsLo from '../assets/tex/mars_lo.jpg';
import marsHi from '../assets/tex/mars_hi.jpg';
import jupiterLo from '../assets/tex/jupiter_lo.jpg';
import jupiterHi from '../assets/tex/jupiter_hi.jpg';
import saturnLo from '../assets/tex/saturn_lo.jpg';
import saturnHi from '../assets/tex/saturn_hi.jpg';
import saturnRing from '../assets/tex/saturn_ring.png';
import mercuryLo from '../assets/tex/mercury_lo.jpg';
import mercuryHi from '../assets/tex/mercury_hi.jpg';
import venusLo from '../assets/tex/venus_lo.jpg';
import venusHi from '../assets/tex/venus_hi.jpg';
import sunLo from '../assets/tex/sun_lo.jpg';
import sunHi from '../assets/tex/sun_hi.jpg';
import ceresLo from '../assets/tex/ceres_lo.jpg';
import ceresHi from '../assets/tex/ceres_hi.jpg';
import uranusLo from '../assets/tex/uranus_lo.jpg';
import uranusHi from '../assets/tex/uranus_hi.jpg';
import neptuneLo from '../assets/tex/neptune_lo.jpg';
import neptuneHi from '../assets/tex/neptune_hi.jpg';
import europaLo from '../assets/tex/europa_lo.jpg';
import europaHi from '../assets/tex/europa_hi.jpg';
import ganymedeLo from '../assets/tex/ganymede_lo.jpg';
import ganymedeHi from '../assets/tex/ganymede_hi.jpg';
import callistoLo from '../assets/tex/callisto_lo.jpg';
import callistoHi from '../assets/tex/callisto_hi.jpg';
import enceladusLo from '../assets/tex/enceladus_lo.jpg';
import enceladusHi from '../assets/tex/enceladus_hi.jpg';
import rheaLo from '../assets/tex/rhea_lo.jpg';
import rheaHi from '../assets/tex/rhea_hi.jpg';
import iapetusLo from '../assets/tex/iapetus_lo.jpg';
import iapetusHi from '../assets/tex/iapetus_hi.jpg';
import stars from '../assets/tex/stars.jpg';

type Pair = [lo: string, hi: string];

export interface PhotoSet {
  color: Pair;
  /** City lights, shown on the night side. */
  night?: Pair;
  clouds?: Pair;
  /** Loaded with the large map only. */
  normal?: string;
  /** White where the surface is water. */
  water?: string;
  bump?: string;
  bumpScale?: number;
  ring?: string;
}

export const STARS = stars;

export const PHOTOS: Record<string, PhotoSet> = {
  sun: { color: [sunLo, sunHi] },
  mercury: { color: [mercuryLo, mercuryHi] },
  venus: { color: [venusLo, venusHi] },
  earth: { color: [earthLo, earthHi], night: [earthNightLo, earthNightHi], clouds: [earthCloudsLo, earthCloudsHi], normal: earthNormal, water: earthSpec },
  luna: { color: [moonLo, moonHi], bump: moonBump, bumpScale: 4 },
  mars: { color: [marsLo, marsHi] },
  ceres: { color: [ceresLo, ceresHi] },
  jupiter: { color: [jupiterLo, jupiterHi] },
  europa: { color: [europaLo, europaHi] },
  ganymede: { color: [ganymedeLo, ganymedeHi] },
  callisto: { color: [callistoLo, callistoHi] },
  enceladus: { color: [enceladusLo, enceladusHi] },
  rhea: { color: [rheaLo, rheaHi] },
  iapetus: { color: [iapetusLo, iapetusHi] },
  saturn: { color: [saturnLo, saturnHi], ring: saturnRing },
  uranus: { color: [uranusLo, uranusHi] },
  neptune: { color: [neptuneLo, neptuneHi] },
};
