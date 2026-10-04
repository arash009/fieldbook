// Draws the app icon (a white F with an orange square on black) as PNGs, with no image libraries.
import { deflateSync, crc32 } from 'node:zlib';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const WHITE = [255, 255, 255];
const ORANGE = [194, 65, 12];
const BLACK = [0, 0, 0];
const inBox = (x, y, [x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1;
const F = [[0.34, 0.25, 0.68, 0.35], [0.34, 0.25, 0.44, 0.75], [0.34, 0.46, 0.66, 0.55]];
const DOT = [0.6, 0.62, 0.7, 0.72];
const colourAt = (x, y) => (inBox(x, y, DOT) ? ORANGE : F.some((b) => inBox(x, y, b)) ? WHITE : BLACK);

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

export function iconPng(size) {
  const row = size * 3 + 1;
  const pixels = Buffer.alloc(row * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    pixels.set(colourAt(x / size, y / size), y * row + 1 + x * 3);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}

export async function writeIcons(dir) {
  for (const size of [192, 512]) await writeFile(join(dir, `icon-${size}.png`), iconPng(size));
}
