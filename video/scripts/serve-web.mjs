/** Serve la build web dell'app (cartella `app-web`, creata da `npm run app:build`) su http://localhost:8099, con ritorno a index.html per le pagine interne. */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'app-web');
const port = Number(process.env.PORT || 8099);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.wasm': 'application/wasm' };
createServer((req, res) => {
  let p = join(root, decodeURIComponent((req.url || '/').split('?')[0]));
  if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) p = join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(port, () => console.log(`App web su http://localhost:${port}`));
