// Controllo statico dei flussi Maestro (senza emulatore): intestazione appId, separatore '---', tag ammessi,
// file referenziati da runFlow esistenti, un takeScreenshot per flusso. Esce con 1 se qualcosa non va.
//   node scripts/ci/maestro-check.mjs
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.maestro');
const TAGS = new Set(['smoke', 'native', 'slow', 'fragile', 'disabled']);
const APP_ID = JSON.parse(readFileSync(join(root, '..', 'app.json'), 'utf8')).expo.android.package;
const errors = [];
const err = (f, m) => errors.push(`${f}: ${m}`);

const files = readdirSync(root).filter((f) => f.endsWith('.yaml') && f !== 'config.yaml');
const subs = readdirSync(join(root, 'subflows')).filter((f) => f.endsWith('.yaml'));
if (!files.length) err('.maestro', 'nessun flusso');

function check(path, label, top) {
  const t = readFileSync(path, 'utf8');
  const parts = t.split(/^---\s*$/m);
  if (parts.length !== 2) err(label, 'serve esattamente un separatore "---" (intestazione / comandi)');
  const head = parts[0];
  const m = head.match(/^appId:\s*(\S+)/m);
  if (!m) err(label, 'manca appId'); else if (m[1] !== APP_ID) err(label, `appId ${m[1]} != ${APP_ID} (app.json)`);
  if (/\t/.test(t)) err(label, 'contiene tabulazioni');
  if (top) {
    if (!/^name:/m.test(head)) err(label, 'manca name');
    const tags = [...head.matchAll(/^\s+-\s+(\w+)\s*$/gm)].map((x) => x[1]);
    if (!tags.length) err(label, 'nessun tag (smoke/native/slow)');
    for (const g of tags) if (!TAGS.has(g)) err(label, `tag sconosciuto: ${g}`);
    if (!/takeScreenshot:/.test(parts[1] || '')) err(label, 'nessun takeScreenshot');
  }
  const dir = dirname(path);
  for (const r of (parts[1] || '').matchAll(/runFlow:\s*(?:\n\s+file:\s*)?([\w./-]+\.yaml)/g)) {
    if (!existsSync(join(dir, r[1])) && !existsSync(join(root, r[1]))) err(label, `runFlow verso file inesistente: ${r[1]}`);
  }
}
for (const f of files) check(join(root, f), f, true);
for (const f of subs) check(join(root, 'subflows', f), `subflows/${f}`, false);
const cfg = join(root, 'config.yaml');
if (!existsSync(cfg)) err('config.yaml', 'manca');
if (errors.length) { console.error(errors.map((e) => 'ERRORE ' + e).join('\n')); process.exit(1); }
console.log(`maestro-check: ${files.length} flussi e ${subs.length} sotto-flussi ok (appId ${APP_ID})`);
