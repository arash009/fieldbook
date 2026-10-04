// A small static server for trying the built site locally (service workers work on localhost).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.enc': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8',
};

export function serve({ dir, port = 8080, host = '127.0.0.1' }) {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    try {
      let file = normalize(join(root, decodeURIComponent(new URL(req.url, 'http://local').pathname)));
      if (file !== root && !file.startsWith(root + sep)) throw new Error('outside');
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('Not found');
    }
  });
  return new Promise((ok) => server.listen(port, host, () => ok(server)));
}
