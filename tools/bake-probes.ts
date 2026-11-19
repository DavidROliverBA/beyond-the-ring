// Take the light probes of every interior and save them in assets/probes/ (see src/probes.ts).
// Run it again whenever an interior's rooms or lights change; docking warns in the console if
// a saved file no longer fits.
//
//   bun run dev                      (in another terminal)
//   bun tools/bake-probes.ts [port]  (default 5180)
//
// It drives a headless Chromium through Playwright, which is not one of this project's
// packages. Point PLAYWRIGHT at an installed copy's index.mjs if `playwright` cannot be found
// from here, and CHROME at a Chromium binary if Playwright has none of its own.

import { join } from 'node:path';

const port = process.argv[2] ?? '5180';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
// What to click in the list of places to fly to, and the address ending that puts it in reach.
const STATIONS: [id: string, nav: string, hash: string][] = [['ceres', 'Ceres', ''], ['tycho', 'Tycho Station', ''], ['ganymede', 'Ganymede', ''], ['medina', 'Medina', '#slow']];

for (const [id, nav, hash] of STATIONS) {
  if (process.env.ONLY && process.env.ONLY !== id) continue;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e: Error) => console.log('page error: ' + e.message));
  page.on('console', (m: { type(): string; text(): string }) => { if (m.type() === 'error') console.log('page: ' + m.text()); });
  // (Saving a file makes the dev server rebuild, so the next page can be slow to arrive.)
  await page.goto(`http://localhost:${port}/?debug&bake${hash}`, { timeout: 180000 });
  await page.waitForSelector('#launch:not([disabled])', { timeout: 180000 });
  await page.click('#launch');
  await page.click(`#nav-list .nav-item:has-text("${nav}") >> text=/dock/`);
  // The autopilot flies there; L docks once in range. With ?bake every probe is filled before
  // the docking fade lifts, however long that takes.
  for (let i = 0; ; i++) {
    if (i > 450) throw new Error(`${id}: never finished docking`);
    await page.waitForTimeout(2000);
    await page.keyboard.press('KeyL');
    if (await page.evaluate(() => (globalThis as any).__bounce?.done)) break;
  }
  const data: number[] | null = await page.evaluate(() => (globalThis as any).__saveProbes());
  const count: number = await page.evaluate(() => (globalThis as any).__bounce.count);
  await browser.close();
  if (!data) throw new Error(`${id}: no probes came back`);
  await Bun.write(join(import.meta.dir, '..', 'assets', 'probes', `${id}.bin`), new Uint16Array(data));
  console.log(`${id}: ${count} probes, ${(data.length * 2 / 1024).toFixed(1)} kB`);
}
