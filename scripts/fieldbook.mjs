#!/usr/bin/env node
// Fieldbook's command line: validate an itinerary, build the site, encrypt a trip, serve and deploy.
import { parseArgs } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTripDir } from './lib/load.mjs';
import { validatePayload } from './lib/validate.mjs';
import { buildSite } from './lib/build.mjs';
import { encryptTrip } from './lib/encrypt.mjs';
import { serve } from './lib/serve.mjs';
import { deploy } from './lib/deploy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = `Usage: fieldbook <command> [options]

  validate --trip <dir>                          check an itinerary folder
  build [--out <dir>]                            build the site (app + demo), default dist/
  encrypt --trip <dir> --out <dir> [--id <id>] [--single-file <file>]
                                                 encrypt a trip with $TRIP_PASSPHRASE
  serve [--dir <dir>] [--port 8080]              serve the built site on localhost
  deploy [--dir <dir>] [--repo <dir>] [--branch gh-pages]
                                                 publish the site as one orphan commit`;

const OPTIONS = { trip: { type: 'string' }, out: { type: 'string' }, id: { type: 'string' }, 'single-file': { type: 'string' }, dir: { type: 'string' }, port: { type: 'string' }, repo: { type: 'string' }, branch: { type: 'string' } };

function need(value, flag) {
  if (!value) throw new Error(`${flag} is required\n\n${USAGE}`);
  return value;
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { values: o } = parseArgs({ args: rest, options: OPTIONS });
  const dist = resolve(o.dir ?? o.out ?? join(ROOT, 'dist'));
  switch (command) {
    case 'validate': {
      const errors = validatePayload(await loadTripDir(resolve(need(o.trip, '--trip'))));
      if (errors.length) { console.error(errors.map((e) => `✗ ${e}`).join('\n')); process.exitCode = 1; return; }
      console.log('✓ The itinerary is valid.');
      return;
    }
    case 'build': {
      const { version } = await buildSite({ root: ROOT, out: dist });
      console.log(`✓ Built the site (version ${version}) in ${dist}`);
      return;
    }
    case 'encrypt': {
      const { id } = await encryptTrip({ root: ROOT, tripDir: resolve(need(o.trip, '--trip')), outDir: resolve(need(o.out, '--out')), id: o.id, singleFile: o['single-file'] && resolve(o['single-file']), passphrase: process.env.TRIP_PASSPHRASE });
      console.log(`✓ Encrypted trip ${id}`);
      return;
    }
    case 'serve': {
      const port = Number(o.port ?? 8080);
      await serve({ dir: dist, port });
      console.log(`Serving ${dist} on http://localhost:${port}/`);
      return;
    }
    case 'deploy': {
      await deploy({ dir: dist, repoDir: resolve(o.repo ?? ROOT), branch: o.branch ?? 'gh-pages' });
      console.log('✓ Deployed');
      return;
    }
    default:
      console.log(USAGE);
      if (command) process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
