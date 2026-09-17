import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist');
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    res.writeHead(200, {'Content-Type':types[extname(path)] || 'application/octet-stream','Cache-Control':'no-store'});
    res.end(await readFile(path));
  } catch { res.writeHead(404).end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('PartyPoss is ready at http://127.0.0.1:4173'));
