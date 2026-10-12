// Server statico minimo per l'export web di Expo (con fallback SPA / .html), senza dipendenze.
//   node scripts/ci/serve-static.mjs <cartella> [porta]
// Scrive "READY <porta>" su stdout quando e' in ascolto. Si ferma con SIGTERM/SIGINT.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || 'dist');
const port = Number(process.argv[3] || process.env.PORT || 8099);
if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) { console.error(`Cartella non trovata: ${root}`); process.exit(2); }

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.map': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
};
const isFile = (f) => { try { return fs.statSync(f).isFile(); } catch { return false; } };

const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); res.end('bad request'); return; }
  const candidates = [p, p + '.html', path.join(p, 'index.html'), '/index.html'];
  for (const c of candidates) {
    const full = path.join(root, c);
    // niente uscita dalla radice (../)
    if (full !== root && !full.startsWith(root + path.sep)) continue;
    if (isFile(full)) {
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      if (req.method === 'HEAD') { res.end(); return; }
      fs.createReadStream(full).pipe(res);
      return;
    }
  }
  res.writeHead(404); res.end('not found');
});
server.listen(port, '127.0.0.1', () => console.log(`READY ${port} ${root}`));
for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => server.close(() => process.exit(0)));
