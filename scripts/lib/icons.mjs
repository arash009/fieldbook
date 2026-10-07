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

// The demo's sample ticket: a 600×600 block pattern, like a barcode, with SAMPLE written in blocks in the middle.
const FONT = {
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
};

export function samplePng(size = 600) {
  const cell = 20;
  const word = 'SAMPLE';
  const dot = 6;
  const textW = (word.length * 6 - 1) * dot;
  const textH = 7 * dot;
  const box = [(size - textW) / 2 - 24, (size - textH) / 2 - 24, (size + textW) / 2 + 24, (size + textH) / 2 + 24];
  const inText = (x, y) => {
    const tx = Math.floor((x - (size - textW) / 2) / dot);
    const ty = Math.floor((y - (size - textH) / 2) / dot);
    if (tx < 0 || ty < 0 || ty >= 7 || tx >= word.length * 6 - 1 || tx % 6 === 5) return false;
    return FONT[word[Math.floor(tx / 6)]][ty][tx % 6] === '1';
  };
  const row = size * 3 + 1;
  const pixels = Buffer.alloc(row * size, 255);
  for (let y = 0; y < size; y++) {
    pixels[y * row] = 0;
    for (let x = 0; x < size; x++) {
      const inBoxArea = x >= box[0] && x < box[2] && y >= box[1] && y < box[3];
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const block = ((cx * 7919 + cy * 104729 + cx * cy * 31) % 11) < 5;
      const black = inBoxArea ? inText(x, y) : block;
      if (black) pixels.fill(0, y * row + 1 + x * 3, y * row + 4 + x * 3);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
