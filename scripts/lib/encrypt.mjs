// Encrypts an itinerary folder into a public-safe trip file, plus an optional single-file backup page.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { deriveKey, sealWithKey, sealBytes, toBase64, fromBase64, randomBytes, ITERATIONS } from '../../app/js/crypto.js';
import { loadTripDir } from './load.mjs';
import { validatePayload } from './validate.mjs';
import { buildSingleFile, TICKET_MIME } from './build.mjs';

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

async function packTickets({ tripDir, list, key, outDir, tripId }) {
  const dir = join(outDir, tripId);
  await rm(dir, { recursive: true, force: true });
  if (!list.length) return [];
  await mkdir(dir, { recursive: true });
  const out = [];
  for (const t of list) {
    const path = join(tripDir, 'private', 'tickets', t.file);
    let bytes;
    try { bytes = await readFile(path); } catch { throw new Error(`Ticket file not found: private/tickets/${t.file}`); }
    const mime = TICKET_MIME[extname(t.file).toLowerCase()];
    if (!mime) throw new Error(`Ticket ${t.file}: only PDF, PNG and JPG are supported`);
    const name = Buffer.from(randomBytes(8)).toString('hex');
    await writeFile(join(dir, `${name}.enc`), JSON.stringify(await sealBytes(new Uint8Array(bytes), key)));
    const { file, ...meta } = t;
    out.push({ ...meta, mime, file: `${tripId}/${name}.enc` });
  }
  return out;
}

export async function encryptTrip({ root, tripDir, outDir, id, singleFile, passphrase, iterations }) {
  checkPassphrase(passphrase);
  const payload = await loadTripDir(tripDir);
  const errors = validatePayload(payload);
  if (errors.length) throw new Error(`The itinerary has errors:\n${errors.map((e) => `✗ ${e}`).join('\n')}`);
  const tripId = id ?? payload.private.config.tripId;
  if (!/^[a-z0-9]{4,32}$/.test(tripId ?? '')) throw new Error('Trip id must be 4–32 lowercase letters or digits (pass --id or set tripId in private/config.json).');
  const salt = await saltFor(join(tripDir, 'private', 'salt.txt'));
  const iters = iterations ?? ITERATIONS;
  const key = await deriveKey(passphrase, salt, iters);
  await mkdir(outDir, { recursive: true });
  payload.private.tickets = await packTickets({ tripDir, list: payload.private.ticketList ?? [], key, outDir, tripId });
  delete payload.private.ticketList;
  const envelope = await sealWithKey(payload, key, salt, iters);
  await writeFile(join(outDir, `${tripId}.enc`), JSON.stringify(envelope));
  if (singleFile) {
    await mkdir(dirname(singleFile), { recursive: true });
    await writeFile(singleFile, await buildSingleFile({ root, envelope }));
  }
  return { id: tripId, envelope };
}
