// Builds the public site (app + demo) and the single-file backup of an encrypted trip.
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { bundle } from './bundle.mjs';
import { writeIcons } from './icons.mjs';
import { loadTripDir } from './load.mjs';
import { validatePayload } from './validate.mjs';

async function hashTree(dir, skip) {
  const hash = createHash('sha256');
  const walk = async (d) => {
    const entries = (await readdir(d, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const path = join(d, e.name);
      const rel = relative(dir, path).split('\\').join('/');
      if (skip.includes(rel)) continue;
      if (e.isDirectory()) await walk(path);
      else hash.update(rel).update(await readFile(path));
    }
  };
  await walk(dir);
  return hash.digest('hex').slice(0, 12);
}

export async function buildSite({ root, out }) {
  const demo = await loadTripDir(join(root, 'demo'));
  const errors = validatePayload(demo);
  if (errors.length) throw new Error(`The demo itinerary has errors:\n${errors.join('\n')}`);
  await mkdir(out, { recursive: true });
  for (const name of await readdir(out)) if (name !== 'trips') await rm(join(out, name), { recursive: true, force: true });
  await writeFile(join(out, 'app.js'), await bundle(join(root, 'app/js/main.js')));
  for (const f of ['index.html', 'app.css', 'manifest.webmanifest']) await cp(join(root, 'app', f), join(out, f));
  await cp(join(root, 'app/icons'), join(out, 'icons'), { recursive: true });
  await writeIcons(join(out, 'icons'));
  await mkdir(join(out, 'demo'), { recursive: true });
  await writeFile(join(out, 'demo/trip.json'), JSON.stringify(demo));
  await writeFile(join(out, '.nojekyll'), '');
  const version = await hashTree(out, ['trips', 'sw.js']);
  const sw = await readFile(join(root, 'app/sw.js'), 'utf8');
  await writeFile(join(out, 'sw.js'), sw.replace('__VERSION__', version));
  return { version };
}

export async function buildSingleFile({ root, envelope }) {
  const [index, css, js] = await Promise.all([
    readFile(join(root, 'app/index.html'), 'utf8'),
    readFile(join(root, 'app/app.css'), 'utf8'),
    bundle(join(root, 'app/js/main.js')),
  ]);
  const data = JSON.stringify(envelope).replace(/</g, '\\u003c');
  const script = js.replace(/<\/script/gi, '<\\/script');
  return index
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, () => `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">`)
    .replace(/<link rel="manifest"[^>]*>\s*/, () => '')
    .replace(/<link rel="icon"[^>]*>\s*/, () => '')
    .replace(/<link rel="stylesheet" href="app\.css">/, () => `<style>${css}</style>`)
    .replace(/<script src="app\.js"><\/script>/, () => `<script id="fb-envelope" type="application/json">${data}</script>\n<script>${script}</script>`);
}
