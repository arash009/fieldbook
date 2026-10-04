// Encrypts an itinerary folder into a public-safe trip file, plus an optional single-file backup page.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { seal, toBase64, fromBase64, randomBytes } from '../../app/js/crypto.js';
import { loadTripDir } from './load.mjs';
import { validatePayload } from './validate.mjs';
import { buildSingleFile } from './build.mjs';

export function checkPassphrase(passphrase) {
  if (!passphrase) throw new Error('Set TRIP_PASSPHRASE (for example in a git-ignored .env file).');
  const words = passphrase.trim().split(/[\s-]+/).filter(Boolean);
  if (passphrase.length < 24 || words.length < 5) {
    throw new Error('TRIP_PASSPHRASE is too weak: use at least 5 random words and 24 characters. The encrypted file is public.');
  }
}

async function saltFor(file) {
  try {
    return fromBase64((await readFile(file, 'utf8')).trim());
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    const salt = randomBytes(16);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${toBase64(salt)}\n`);
    return salt;
  }
}

export async function encryptTrip({ root, tripDir, outDir, id, singleFile, passphrase, iterations }) {
  checkPassphrase(passphrase);
  const payload = await loadTripDir(tripDir);
  const errors = validatePayload(payload);
  if (errors.length) throw new Error(`The itinerary has errors:\n${errors.map((e) => `✗ ${e}`).join('\n')}`);
  const tripId = id ?? payload.private.config.tripId;
  if (!/^[a-z0-9]{4,32}$/.test(tripId ?? '')) throw new Error('Trip id must be 4–32 lowercase letters or digits (pass --id or set tripId in private/config.json).');
  const salt = await saltFor(join(tripDir, 'private', 'salt.txt'));
  const envelope = await seal(payload, passphrase, iterations ? { salt, iterations } : { salt });
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, `${tripId}.enc`), JSON.stringify(envelope));
  if (singleFile) {
    await mkdir(dirname(singleFile), { recursive: true });
    await writeFile(singleFile, await buildSingleFile({ root, envelope }));
  }
  return { id: tripId, envelope };
}
