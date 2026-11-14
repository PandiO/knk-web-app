// Serves the production build (`build/`) for the end-to-end tests, with the single-page fallback
// the app's router needs: any path that is not a file gets index.html. No dependencies, so CI
// needs nothing beyond `npm ci`. Every /api request is answered by the tests (page.route), so a
// request that reaches this server means a spec forgot a mock: it gets a 502.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'build');
const port = Number(process.env.E2E_PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

async function fileFor(urlPath) {
  const path = normalize(join(root, decodeURIComponent(urlPath)));
  if (!path.startsWith(root)) return null;
  try {
    return (await stat(path)).isFile() ? path : null;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;
  if (urlPath.startsWith('/api/')) {
    res.writeHead(502, { 'content-type': 'text/plain' }).end('No mock for this API request in the e2e spec');
    return;
  }
  const file = (await fileFor(urlPath)) ?? join(root, 'index.html');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain' }).end(`No build in ${root}: run npm run build first`);
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Serving ${root} on http://127.0.0.1:${port}`);
});
