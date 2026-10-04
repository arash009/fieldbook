import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '../scripts/lib/bundle.mjs';
import { buildSite, buildSingleFile } from '../scripts/lib/build.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

test('bundle wires imports between modules and runs in order', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fb-bundle-'));
  await mkdir(join(dir, 'sub'));
  await writeFile(join(dir, 'sub/a.js'), "export const greet = (n) => `hi ${n}`;\nexport async function later() { return 1; }\n");
  await writeFile(join(dir, 'b.js'), "import { greet as hello } from './sub/a.js';\nexport function run() { return hello('x'); }\n");
  await writeFile(join(dir, 'main.js'), "import { run } from './b.js';\nglobalThis.out = run();\n");
  const code = await bundle(join(dir, 'main.js'));
  const sandbox = {};
  vm.runInNewContext(code, sandbox);
  assert.equal(sandbox.out, 'hi x');
});

test('bundle rejects unsupported module syntax', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fb-bundle-'));
  await writeFile(join(dir, 'main.js'), 'export default 1;\n');
  await assert.rejects(bundle(join(dir, 'main.js')), /only/);
});

test('the real app bundles into valid JavaScript', async () => {
  const code = await bundle(join(ROOT, 'app/js/main.js'));
  assert.doesNotThrow(() => new vm.Script(code));
});

test('buildSite writes the site and keeps existing trip files', async () => {
  const out = await mkdtemp(join(tmpdir(), 'fb-site-'));
  await mkdir(join(out, 'trips'));
  await writeFile(join(out, 'trips/abcd.enc'), '{}');
  await writeFile(join(out, 'stale.txt'), 'old');
  const { version } = await buildSite({ root: ROOT, out });
  assert.match(version, /^[0-9a-f]{12}$/);
  const names = await readdir(out);
  for (const n of ['index.html', 'app.js', 'app.css', 'manifest.webmanifest', 'sw.js', 'icons', 'demo', 'trips', '.nojekyll']) assert.ok(names.includes(n), n);
  assert.ok(!names.includes('stale.txt'));
  const sw = await readFile(join(out, 'sw.js'), 'utf8');
  assert.ok(sw.includes(version) && !sw.includes('__VERSION__'));
  const png = await readFile(join(out, 'icons/icon-192.png'));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(JSON.parse(await readFile(join(out, 'demo/trip.json'), 'utf8')).format, 'fieldbook/1');
});

test('buildSingleFile inlines everything and survives $ patterns', async () => {
  const page = await buildSingleFile({ root: ROOT, envelope: { fieldbook: 1, data: 'x$&y</script>' } });
  assert.match(page, /<script id="fb-envelope" type="application\/json">/);
  assert.ok(page.includes('x$&y\\u003c/script>'));
  assert.doesNotMatch(page, /manifest\.webmanifest|src="app\.js"|href="app\.css"/);
  assert.match(page, /<style>/);
});
