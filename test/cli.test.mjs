import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encryptTrip, checkPassphrase } from '../scripts/lib/encrypt.mjs';
import { serve } from '../scripts/lib/serve.mjs';
import { deploy } from '../scripts/lib/deploy.mjs';
import { open } from '../app/js/crypto.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PASS = 'amber-otter-quiet-ladder-mango-seven';

test('weak passphrases are refused', () => {
  assert.throws(() => checkPassphrase(''), /TRIP_PASSPHRASE/);
  assert.throws(() => checkPassphrase('short one'), /too weak/);
  assert.doesNotThrow(() => checkPassphrase(PASS));
});

test('encryptTrip writes a decryptable file, keeps its salt and makes a backup page', async () => {
  const trip = await mkdtemp(join(tmpdir(), 'fb-trip-'));
  await cp(join(ROOT, 'demo'), trip, { recursive: true });
  const out = await mkdtemp(join(tmpdir(), 'fb-out-'));
  const single = join(out, 'backup.html');
  const first = await encryptTrip({ root: ROOT, tripDir: trip, outDir: out, id: 'abcd1234', singleFile: single, passphrase: PASS, iterations: 1000 });
  const env = JSON.parse(await readFile(join(out, 'abcd1234.enc'), 'utf8'));
  const { data } = await open(env, PASS);
  assert.equal(data.trip.meta.title, 'Lisbon weekend (sample)');
  assert.ok((await readFile(single, 'utf8')).includes(env.iv));
  const second = await encryptTrip({ root: ROOT, tripDir: trip, outDir: out, id: 'abcd1234', passphrase: PASS, iterations: 1000 });
  assert.equal(second.envelope.salt, first.envelope.salt);
  await assert.rejects(encryptTrip({ root: ROOT, tripDir: trip, outDir: out, id: 'BAD ID', passphrase: PASS, iterations: 1000 }), /Trip id/);
});

test('serve returns files with the right type and refuses to leave its folder', async () => {
  const server = await serve({ dir: join(ROOT, 'app'), port: 0 });
  const { port } = server.address();
  const page = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.equal((await fetch(`http://127.0.0.1:${port}/..%2Fpackage.json`)).status, 404);
  server.close();
});

test('deploy pushes the folder as one orphan commit', async () => {
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  const remote = await mkdtemp(join(tmpdir(), 'fb-remote-'));
  git(remote, 'init', '--bare', '-q');
  const repo = await mkdtemp(join(tmpdir(), 'fb-repo-'));
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.name', 'Test');
  git(repo, 'config', 'user.email', 'test@example.com');
  git(repo, 'remote', 'add', 'origin', remote);
  const site = await mkdtemp(join(tmpdir(), 'fb-dist-'));
  await cp(join(ROOT, 'app/index.html'), join(site, 'index.html'));
  await deploy({ dir: site, repoDir: repo, branch: 'gh-pages' });
  await deploy({ dir: site, repoDir: repo, branch: 'gh-pages' });
  assert.equal(git(remote, 'rev-list', '--count', 'gh-pages').trim(), '1');
  assert.match(git(remote, 'ls-tree', '--name-only', 'gh-pages'), /index\.html/);
});
