// Passphrase encryption for trip files. The same code runs in the browser and in Node 22.
export const ITERATIONS = 600000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

export async function deriveKey(passphrase, salt, iterations = ITERATIONS) {
  const base = await subtle().importKey('raw', encoder.encode(passphrase.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function sealWithKey(data, key, salt, iterations = ITERATIONS) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(data))));
  return { fieldbook: 1, kdf: 'PBKDF2-SHA256', iterations, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(ct) };
}

export async function seal(data, passphrase, { salt = randomBytes(16), iterations = ITERATIONS } = {}) {
  return sealWithKey(data, await deriveKey(passphrase, salt, iterations), salt, iterations);
}

export async function openWithKey(envelope, key) {
  const plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv) }, key, fromBase64(envelope.data));
  return JSON.parse(decoder.decode(plain));
}

export async function open(envelope, passphrase) {
  const key = await deriveKey(passphrase, fromBase64(envelope.salt), envelope.iterations);
  return { key, data: await openWithKey(envelope, key) };
}
