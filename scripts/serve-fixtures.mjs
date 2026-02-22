import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = normalize(join(__dirname, '..'));
const fixturesRoot = join(repoRoot, 'tests', 'fixtures');
const host = process.env.FIXTURE_HOST ?? '127.0.0.1';
const port = Number(process.env.FIXTURE_PORT ?? 4174);

const mimeByExt = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
};

function resolveFixturePath(urlPath) {
  const cleaned = (urlPath === '/' ? '/site-alpha/chapter-1.html' : urlPath).replace(/^\/+/, '');
  const joined = normalize(join(fixturesRoot, cleaned));
  if (!joined.startsWith(fixturesRoot)) {
    return null;
  }
  return joined;
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? '/', `http://${host}:${port}`);
  const filePath = resolveFixturePath(requestUrl.pathname);

  if (!filePath) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Invalid path');
    return;
  }

  try {
    const content = await readFile(filePath);
    const ext = extname(filePath);
    const contentType = mimeByExt[ext] ?? 'application/octet-stream';

    res.writeHead(200, { 'content-type': contentType });
    res.end(content);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Fixture not found');
  }
});

server.listen(port, host, () => {
  console.log(`Fixture server running at http://${host}:${port}`);
  console.log('Default page: /site-alpha/chapter-1.html');
  console.log('Loop page: /site-beta/loop-a.html');
});
