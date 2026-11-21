// Build assets/stars/stars.bin from the HYG database (v4.0, CC BY-SA 4.0, https://github.com/astronexus/HYG-Database),
// which merges the Hipparcos, Yale Bright Star and Gliese catalogues.
//   bun tools/stars/build-catalogue.ts <path to hygdata_v40.csv> [limiting magnitude, default 7.4]
// File layout (little endian), 6 bytes a star, brightest first:
//   uint16 ra   : right ascension, J2000, 0..65535 = 0..24 h
//   int16  dec  : declination, -32768..32767 = -90..+90 degrees
//   uint8  mag  : (apparent V magnitude + 1.5) * 25, so -1.5..8.7
//   int8   ci   : B-V colour index * 40 (about -0.4..+2.0 after clamping)

const [csvPath, limit = '7.4'] = process.argv.slice(2);
if (!csvPath) throw new Error('usage: bun tools/stars/build-catalogue.ts hygdata_v40.csv [mag]');
const lim = Number(limit);
const lines = (await Bun.file(csvPath).text()).split('\n');
const head = lines[0].split(',').map((s) => s.replace(/"/g, ''));
const col = (n: string) => head.indexOf(n);
const [iRa, iDec, iMag, iCi, iId] = ['ra', 'dec', 'mag', 'ci', 'id'].map(col);

interface S { ra: number; dec: number; mag: number; ci: number }
const stars: S[] = [];
for (let i = 1; i < lines.length; i++) {
  const f = lines[i].split(',');
  if (f.length < head.length - 8 || f[iId] === '0') continue;      // skip blanks and Sol itself
  const mag = parseFloat(f[iMag]);
  if (!(mag <= lim)) continue;
  const ci = parseFloat(f[iCi]);
  stars.push({ ra: parseFloat(f[iRa]), dec: parseFloat(f[iDec]), mag, ci: Number.isFinite(ci) ? ci : 0.6 });
}
stars.sort((a, b) => a.mag - b.mag);
const buf = new ArrayBuffer(stars.length * 6), v = new DataView(buf);
stars.forEach((s, i) => {
  v.setUint16(i * 6, Math.round((s.ra / 24) * 65535) & 0xffff, true);
  v.setInt16(i * 6 + 2, Math.round((s.dec / 90) * 32767), true);
  v.setUint8(i * 6 + 4, Math.max(0, Math.min(255, Math.round((s.mag + 1.5) * 25))));
  v.setInt8(i * 6 + 5, Math.max(-127, Math.min(127, Math.round(s.ci * 40))));
});
await Bun.write('assets/stars/stars.bin', buf);
console.log(`${stars.length} stars to magnitude ${lim}, ${(buf.byteLength / 1024).toFixed(0)} kB; brightest ${stars[0].mag}, faintest ${stars[stars.length - 1].mag}`);
// A plain text copy for tests (ra hours, dec degrees, mag, B-V).
await Bun.write(process.env.DUMP ?? '/dev/null', stars.map((s) => `${s.ra} ${s.dec} ${s.mag} ${s.ci}`).join('\n'));
